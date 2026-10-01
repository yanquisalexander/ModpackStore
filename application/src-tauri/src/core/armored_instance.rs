//! Experimental "Armored Instance" guard.
//!
//! When a modpack opts in via `experimentalArmoredInstance: true` in its
//! prelaunch appearance, the launcher takes a snapshot of
//! `<instance>/minecraft/resourcepacks/` right after the game process spawns
//! and watches that directory while the game is running. If a new file
//! appears (or an authorized file changes), the instance is force-killed,
//! an `instance-armored-violation` event is emitted to the frontend, and an
//! optional Discord webhook (`armoredInstanceDiscordWebhook`) is notified.
//!
//! Scope is intentionally limited to `resourcepacks/` to avoid false
//! positives from files the game itself rewrites at runtime (configs, logs,
//! saves, options, etc.).
//!
//! NOTE: the webhook URL travels inside the public prelaunch-appearance
//! payload, so it must be treated as visible to anyone. Use a private
//! Discord channel for it.

use crate::core::accounts_manager::AccountsManager;
use crate::core::auth::AuthState;
use crate::core::minecraft_instance::MinecraftInstance;
use crate::core::prelaunch_appearance::PreLaunchAppearance;
use crate::GLOBAL_APP_HANDLE;
use lazy_static::lazy_static;
use notify::{Config, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use serde_json::json;
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{Emitter, Manager};

const EVENT_ARMORED_VIOLATION: &str = "instance-armored-violation";

/// How long to coalesce filesystem events before evaluating them.
const DEBOUNCE_WINDOW: Duration = Duration::from_secs(2);
/// Extra settle delay to let large copies finish before judging them.
const SETTLE_DELAY: Duration = Duration::from_secs(1);
/// Watcher poll interval while waiting for events / stop signal.
const POLL_INTERVAL: Duration = Duration::from_millis(500);

lazy_static! {
    static ref ARMORED_WATCHERS: Arc<Mutex<HashMap<String, Arc<AtomicBool>>>> =
        Arc::new(Mutex::new(HashMap::new()));
}

struct ArmoredIdentity {
    instance_name: String,
    modpack_id: Option<String>,
    modpack_version_id: Option<String>,
    /// In-game username, resolved the same way the launcher does:
    /// selected account (`accountUuid` -> AccountsManager) first,
    /// legacy `ms_nickname` as fallback.
    mc_nick: Option<String>,
    account_uuid: Option<String>,
    /// ModpackStore account username from the active session (never the OS user).
    modpackstore_user: Option<String>,
}

/// Reads the prelaunch appearance from disk (synchronous).
/// Mirrors `get_prelaunch_appearance` but without async, so it can be used
/// from the launch thread.
fn read_appearance_sync(instance_dir: &str) -> Option<PreLaunchAppearance> {
    let instance_path = PathBuf::from(instance_dir);
    let toml_path = instance_path.join("prelaunch_appearance.toml");
    let json_path = instance_path.join("prelaunch_appearance.json");

    if toml_path.exists() {
        let contents = std::fs::read_to_string(&toml_path).ok()?;
        toml::from_str::<PreLaunchAppearance>(&contents)
            .map_err(|e| {
                log::warn!("[Armored] Failed to parse prelaunch_appearance.toml: {}", e);
            })
            .ok()
    } else if json_path.exists() {
        let contents = std::fs::read(&json_path).ok()?;
        serde_json::from_slice::<PreLaunchAppearance>(&contents)
            .map_err(|e| {
                log::warn!("[Armored] Failed to parse prelaunch_appearance.json: {}", e);
            })
            .ok()
    } else {
        None
    }
}

fn is_temp_file(path: &Path) -> bool {
    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_lowercase())
        .unwrap_or_default();
    name.starts_with('.')
        || name.ends_with(".tmp")
        || name.ends_with(".part")
        || name.ends_with(".crdownload")
        || name.ends_with(".bak")
        || name.ends_with(".swp")
}

/// Snapshot of authorized resourcepacks: relative-lowercase-path -> file size.
fn snapshot_resourcepacks(rp_dir: &Path, minecraft_dir: &Path) -> HashMap<String, u64> {
    let mut snapshot = HashMap::new();
    let entries = match std::fs::read_dir(rp_dir) {
        Ok(e) => e,
        Err(_) => return snapshot,
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_file() || is_temp_file(&path) {
            continue;
        }
        let rel = path
            .strip_prefix(minecraft_dir)
            .map(|p| p.to_string_lossy().replace('\\', "/").to_lowercase())
            .unwrap_or_default();
        if rel.is_empty() {
            continue;
        }
        let size = std::fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
        snapshot.insert(rel, size);
    }
    log::info!(
        "[Armored] Snapshot: {} authorized file(s) in resourcepacks/",
        snapshot.len()
    );
    snapshot
}

fn relative_posix(path: &Path, minecraft_dir: &Path) -> Option<String> {
    path.strip_prefix(minecraft_dir)
        .ok()
        .map(|p| p.to_string_lossy().replace('\\', "/"))
}

/// Resolves the in-game username exactly like the launch path does:
/// the selected account looked up by `accountUuid` wins, legacy
/// `ms_nickname` is only a fallback.
fn resolve_mc_nick(instance: &MinecraftInstance) -> Option<String> {
    if let Some(uuid) = instance.accountUuid.as_deref() {
        let manager = AccountsManager::new();
        if let Some(account) = manager.get_minecraft_account_by_uuid(uuid) {
            let username = account.username().trim();
            if !username.is_empty() {
                return Some(username.to_string());
            }
        } else {
            log::warn!("[Armored] Account {} not found for nick resolution", uuid);
        }
    }
    instance
        .ms_nickname
        .clone()
        .map(|n| n.trim().to_string())
        .filter(|n| !n.is_empty())
}

/// Extracts a display username from a ModpackStore session payload.
/// The backend stores the whole user object flattened, so `username`
/// (frontend `UserSession.username`) is the primary key.
fn extract_session_username(session: &serde_json::Value) -> Option<String> {
    for key in ["username", "name", "displayName"] {
        if let Some(s) = session.get(key).and_then(|v| v.as_str()) {
            let s = s.trim();
            if !s.is_empty() {
                return Some(s.to_string());
            }
        }
    }
    if let Some(user) = session.get("user") {
        for key in ["username", "name", "displayName"] {
            if let Some(s) = user.get(key).and_then(|v| v.as_str()) {
                let s = s.trim();
                if !s.is_empty() {
                    return Some(s.to_string());
                }
            }
        }
    }
    None
}

/// Returns the ModpackStore username of the currently logged-in user, if any.
/// Called from plain OS threads only (never inside the async runtime).
fn modpackstore_username() -> Option<String> {
    let app = GLOBAL_APP_HANDLE.lock().ok()?.clone()?;
    let state = app.try_state::<Arc<AuthState>>()?;
    let session = tauri::async_runtime::block_on(async { state.session.lock().await.clone() })?;
    extract_session_username(&session.extra)
}

/// Starts the resourcepacks watcher for this instance if it opted in.
/// No-op for non-modpack instances or when the flag is absent/false.
/// Must be called AFTER the game process spawned (post-cleanup), so the
/// snapshot only contains authorized files.
pub fn maybe_start_armored_watch(instance: &MinecraftInstance) {
    if instance.modpackId.is_none() {
        return;
    }
    let instance_dir = match instance.instanceDirectory.as_ref() {
        Some(d) => d.clone(),
        None => return,
    };
    let appearance = match read_appearance_sync(&instance_dir) {
        Some(a) => a,
        None => return,
    };
    if appearance.experimental_armored_instance != Some(true) {
        return;
    }

    let minecraft_dir = PathBuf::from(&instance_dir).join("minecraft");
    let rp_dir = minecraft_dir.join("resourcepacks");
    if !rp_dir.exists() {
        if let Err(e) = std::fs::create_dir_all(&rp_dir) {
            log::warn!("[Armored] Could not create resourcepacks dir: {}", e);
            return;
        }
    }

    let instance_id = instance.instanceId.clone();
    {
        let lock = ARMORED_WATCHERS.lock();
        if let Ok(map) = lock {
            if map.contains_key(&instance_id) {
                log::info!("[Armored] Watcher already running for {}", instance_id);
                return;
            }
        }
    }

    let snapshot = snapshot_resourcepacks(&rp_dir, &minecraft_dir);
    let webhook = appearance
        .armored_instance_discord_webhook
        .clone()
        .filter(|u| !u.trim().is_empty());
    let identity = ArmoredIdentity {
        instance_name: instance.instanceName.clone(),
        modpack_id: instance.modpackId.clone(),
        modpack_version_id: instance.modpackVersionId.clone(),
        mc_nick: resolve_mc_nick(instance),
        account_uuid: instance.accountUuid.clone(),
        modpackstore_user: modpackstore_username(),
    };

    let stop_flag = Arc::new(AtomicBool::new(false));
    {
        if let Ok(mut map) = ARMORED_WATCHERS.lock() {
            map.insert(instance_id.clone(), Arc::clone(&stop_flag));
        }
    }

    log::info!(
        "[Armored] 🛡 Starting resourcepacks watch for instance {} ({})",
        identity.instance_name,
        instance_id
    );

    std::thread::spawn(move || {
        watch_loop(
            instance_id,
            minecraft_dir,
            rp_dir,
            snapshot,
            webhook,
            identity,
            stop_flag,
        );
    });
}

/// Signals the watcher for this instance to stop. Idempotent.
pub fn stop_armored_watch(instance_id: &str) {
    let flag = ARMORED_WATCHERS
        .lock()
        .ok()
        .and_then(|map| map.get(instance_id).cloned());
    if let Some(flag) = flag {
        flag.store(true, Ordering::Relaxed);
    }
}

/// Returns true while at least one armored-instance watcher is active.
/// Used to block full launcher exits (which would kill the watchers and
/// leave the game unprotected) while a blinded instance is running.
#[tauri::command]
pub fn has_armored_watch_running() -> bool {
    ARMORED_WATCHERS
        .lock()
        .map(|map| !map.is_empty())
        .unwrap_or(false)
}

/// Returns true if the given instance currently has an armored watcher.
pub fn is_armored_watch_running(instance_id: &str) -> bool {
    ARMORED_WATCHERS
        .lock()
        .map(|map| map.contains_key(instance_id))
        .unwrap_or(false)
}

const EVENT_EXIT_BLOCKED: &str = "instance-armored-exit-blocked";

/// Notifies the frontend that a full launcher exit was blocked because an
/// armored instance is running. The launcher stays alive (tray/hidden) so
/// the resourcepacks watch keeps protecting the game.
pub fn emit_exit_blocked(app: &tauri::AppHandle) {
    let _ = app.emit(
        EVENT_EXIT_BLOCKED,
        json!({
            "message": "Hay una instancia blindada en ejecución: el launcher seguirá en segundo plano para protegerla."
        }),
    );
}

fn watch_loop(
    instance_id: String,
    minecraft_dir: PathBuf,
    rp_dir: PathBuf,
    snapshot: HashMap<String, u64>,
    webhook: Option<String>,
    identity: ArmoredIdentity,
    stop_flag: Arc<AtomicBool>,
) {
    let (tx, rx) = std::sync::mpsc::channel();
    let mut watcher: RecommendedWatcher = match RecommendedWatcher::new(
        move |res| {
            let _ = tx.send(res);
        },
        Config::default(),
    ) {
        Ok(w) => w,
        Err(e) => {
            log::error!("[Armored] Could not create watcher for {}: {}", instance_id, e);
            cleanup_entry(&instance_id);
            return;
        }
    };
    if let Err(e) = watcher.watch(&rp_dir, RecursiveMode::Recursive) {
        log::error!("[Armored] Could not watch resourcepacks for {}: {}", instance_id, e);
        cleanup_entry(&instance_id);
        return;
    }

    let mut pending: HashSet<PathBuf> = HashSet::new();
    let mut window_start: Option<Instant> = None;

    loop {
        if stop_flag.load(Ordering::Relaxed) {
            break;
        }
        match rx.recv_timeout(POLL_INTERVAL) {
            Ok(Ok(event)) => match event.kind {
                EventKind::Create(_) | EventKind::Modify(_) => {
                    for p in event.paths {
                        // Only care about paths inside resourcepacks/
                        if p.starts_with(&rp_dir) {
                            pending.insert(p);
                        }
                    }
                    if window_start.is_none() {
                        window_start = Some(Instant::now());
                    }
                }
                _ => {}
            },
            Ok(Err(e)) => {
                log::warn!("[Armored] Watch error for {}: {}", instance_id, e);
            }
            Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {}
            Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => break,
        }

        let window_elapsed = window_start
            .map(|t| t.elapsed() >= DEBOUNCE_WINDOW)
            .unwrap_or(false);
        if !pending.is_empty() && window_elapsed {
            // Let in-progress copies settle: if any candidate is still
            // growing, wait for the next round instead of judging it now.
            std::thread::sleep(SETTLE_DELAY);
            let mut still_growing: HashSet<PathBuf> = HashSet::new();
            let mut sizes: HashMap<PathBuf, u64> = HashMap::new();
            for p in &pending {
                if p.is_file() {
                    sizes.insert(
                        p.clone(),
                        std::fs::metadata(p).map(|m| m.len()).unwrap_or(0),
                    );
                }
            }
            std::thread::sleep(SETTLE_DELAY);
            for (p, size_before) in &sizes {
                let size_now = std::fs::metadata(p).map(|m| m.len()).unwrap_or(0);
                if p.is_file() && size_now != *size_before {
                    still_growing.insert(p.clone());
                }
            }

            let mut judged: Vec<PathBuf> = Vec::new();
            for candidate in pending.difference(&still_growing) {
                judged.push(candidate.clone());
                if let Some(violation) = check_candidate(candidate, &minecraft_dir, &snapshot) {
                    handle_violation(&instance_id, &violation, &webhook, &identity);
                    cleanup_entry(&instance_id);
                    return;
                }
            }
            for j in judged {
                pending.remove(&j);
            }
            window_start = if pending.is_empty() {
                None
            } else {
                Some(Instant::now())
            };
        }
    }

    cleanup_entry(&instance_id);
    log::info!("[Armored] Stopped watch for {}", instance_id);
}

/// Returns the display path of the offending file if it is unauthorized.
fn check_candidate(
    candidate: &Path,
    minecraft_dir: &Path,
    snapshot: &HashMap<String, u64>,
) -> Option<String> {
    if !candidate.is_file() {
        return None; // deletions / dirs are not violations
    }
    if is_temp_file(candidate) {
        return None;
    }
    let rel = relative_posix(candidate, minecraft_dir)?;
    let key = rel.to_lowercase();
    match snapshot.get(&key) {
        None => {
            log::warn!("[Armored] Unauthorized new file detected: {}", rel);
            Some(rel)
        }
        Some(authorized_size) => {
            let current_size = std::fs::metadata(candidate).map(|m| m.len()).unwrap_or(0);
            if current_size != *authorized_size {
                log::warn!(
                    "[Armored] Authorized file was modified: {} ({} -> {} bytes)",
                    rel,
                    authorized_size,
                    current_size
                );
                Some(rel)
            } else {
                None
            }
        }
    }
}

fn handle_violation(
    instance_id: &str,
    file: &str,
    webhook: &Option<String>,
    identity: &ArmoredIdentity,
) {
    log::warn!(
        "[Armored] ⛔ Violation in instance {}: unauthorized resourcepack '{}'. Killing instance.",
        instance_id,
        file
    );

    // 1. Force-kill the game.
    if let Err(e) = crate::core::instance_launcher::kill_instance(instance_id.to_string()) {
        log::warn!("[Armored] kill_instance failed (may have exited already): {}", e);
    }

    // 2. Notify the frontend.
    let message = format!(
        "Esta instancia está blindada y no se permiten modificaciones no autorizadas.\nArchivo detectado: {}",
        file
    );
    if let Ok(guard) = GLOBAL_APP_HANDLE.lock() {
        if let Some(app_handle) = guard.as_ref() {
            let _ = app_handle.emit(
                EVENT_ARMORED_VIOLATION,
                json!({
                    "id": instance_id,
                    "name": identity.instance_name,
                    "message": message,
                    "data": { "file": file }
                }),
            );
        }
    }

    // 3. Fire-and-forget Discord webhook (never blocks the kill).
    if let Some(url) = webhook {
        report_to_discord(url, file, identity);
    }
}

fn report_to_discord(url: &str, file: &str, identity: &ArmoredIdentity) {
    let url = url.to_string();
    let field = |name: &str, value: Option<&String>| {
        json!({
            "name": name,
            "value": value.map(|s| s.as_str()).unwrap_or("—"),
            "inline": true
        })
    };
    let payload = json!({
        "embeds": [{
            "title": "🛡 Instancia blindada — modificación no autorizada",
            "description": format!("Se cerró forzosamente la instancia por un resourcepack no autorizado: `{}`", file),
            "fields": [
                field("Usuario", identity.modpackstore_user.as_ref()),
                field("MC nick", identity.mc_nick.as_ref()),
                field("Modpack", identity.modpack_id.as_ref()),
                field("Versión", identity.modpack_version_id.as_ref()),
                field("Instancia", Some(&identity.instance_name)),
                field("Cuenta UUID", identity.account_uuid.as_ref()),
            ],
            "timestamp": chrono::Utc::now().to_rfc3339(),
            "color": 15548997
        }]
    });
    // Blocking POST with a short timeout, in its own thread so a slow
    // network can never delay the kill path.
    std::thread::spawn(move || {
        let result = reqwest::blocking::Client::builder()
            .timeout(Duration::from_secs(5))
            .build()
            .and_then(|client| {
                client
                    .post(&url)
                    .json(&payload)
                    .send()
                    .map(|_| ())
                    .map_err(|e| e.into())
            });
        match result {
            Ok(()) => log::info!("[Armored] Discord webhook reported"),
            Err(e) => log::warn!("[Armored] Discord webhook failed: {}", e),
        }
    });
}

fn cleanup_entry(instance_id: &str) {
    if let Ok(mut map) = ARMORED_WATCHERS.lock() {
        map.remove(instance_id);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_temp_file() {
        assert!(is_temp_file(Path::new("a/.DS_Store")));
        assert!(is_temp_file(Path::new("a/pack.zip.tmp")));
        assert!(is_temp_file(Path::new("a/pack.zip.part")));
        assert!(is_temp_file(Path::new("a/pack.zip.crdownload")));
        assert!(!is_temp_file(Path::new("resourcepacks/mi_pack.zip")));
    }

    #[test]
    fn test_snapshot_case_insensitive_lookup() {
        let dir = std::env::temp_dir().join("armored_snapshot_test");
        let _ = std::fs::create_dir_all(dir.join("resourcepacks"));
        let _ = std::fs::write(dir.join("resourcepacks").join("Mi_Pack.zip"), "data1234");
        let snap = snapshot_resourcepacks(&dir.join("resourcepacks"), &dir);
        assert!(snap.contains_key("resourcepacks/mi_pack.zip"));
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_appearance_armored_fields_deserialize() {
        let json = serde_json::json!({
            "title": "Test",
            "experimentalArmoredInstance": true,
            "armoredInstanceDiscordWebhook": "https://discord.com/api/webhooks/xxx"
        });
        let app: PreLaunchAppearance = serde_json::from_value(json).unwrap();
        assert_eq!(app.experimental_armored_instance, Some(true));
        assert!(app.armored_instance_discord_webhook.is_some());

        // Absent fields default to None (backwards compatible)
        let app2: PreLaunchAppearance = serde_json::from_value(serde_json::json!({})).unwrap();
        assert_eq!(app2.experimental_armored_instance, None);
    }

    #[test]
    fn test_appearance_armored_fields_toml() {
        let toml_str = "title = \"Test\"\nexperimentalArmoredInstance = true\n";
        let app: PreLaunchAppearance = toml::from_str(toml_str).unwrap();
        assert_eq!(app.experimental_armored_instance, Some(true));
    }

    #[test]
    fn test_extract_session_username() {
        // Flat session shape (backend stores the whole user object flattened)
        let v = serde_json::json!({ "id": "123", "username": "creador_xx", "name": "Creador" });
        assert_eq!(extract_session_username(&v).as_deref(), Some("creador_xx"));

        // Nested fallback
        let v = serde_json::json!({ "user": { "username": "nested_user" } });
        assert_eq!(extract_session_username(&v).as_deref(), Some("nested_user"));

        // Nothing usable
        let v = serde_json::json!({ "id": "123" });
        assert_eq!(extract_session_username(&v), None);
        let v = serde_json::json!({ "username": "   " });
        assert_eq!(extract_session_username(&v), None);
    }
}
