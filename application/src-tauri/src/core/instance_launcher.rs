//! Handles the logic for preparing and launching a specific Minecraft instance.

// --- Standard Library Imports ---
use std::collections::{HashMap, HashSet, VecDeque};
use std::fs;
use std::io::{BufRead, BufReader};
use std::io::{Error as IoError, ErrorKind as IoErrorKind};
use std::path::PathBuf;
use std::process::{Child, Command};
use std::sync::Arc;
use std::sync::Mutex;
use std::thread;

// --- Crate Imports ---
use crate::config::get_config_manager;
use crate::core::instance_bootstrap::InstanceBootstrap;
use crate::core::minecraft::MinecraftLauncher as CoreMinecraftLauncher;
use crate::core::minecraft_instance::MinecraftInstance;
use crate::core::network_utilities;
use crate::interfaces::game_launcher::GameLauncher;
use crate::GLOBAL_APP_HANDLE;

// --- External Crates ---
use lazy_static::lazy_static;
use log::{error, info, warn};
use regex::Regex;
use serde::Serialize;
use serde_json::{json, Value};
use sysinfo::{Pid, System};
use tauri::{Emitter, Manager};
use thiserror::Error;

//-----------------------------------------------------------------------------
// Constants for Event Names
//-----------------------------------------------------------------------------
const EVENT_LAUNCH_START: &str = "instance-launch-start";
const EVENT_DOWNLOADING_ASSETS: &str = "instance-downloading-assets";
const EVENT_LAUNCHED: &str = "instance-launched";
const EVENT_EXITED: &str = "instance-exited";
const EVENT_ERROR: &str = "instance-error";

//-----------------------------------------------------------------------------
// Error Handling
//-----------------------------------------------------------------------------
#[derive(Debug, Error)]
pub enum LaunchError {
    #[error("Minecraft version is not specified in the instance configuration.")]
    VersionNotSpecified,

    #[error("Failed to revalidate assets: {0}")]
    AssetRevalidationFailed(#[from] IoError),

    #[error("Asset revalidation error: {0}")]
    AssetRevalidationError(String),

    #[error("The Minecraft launcher failed to start the process: {0}")]
    ProcessStartFailed(String),
}

impl From<String> for LaunchError {
    fn from(error: String) -> Self {
        LaunchError::AssetRevalidationError(error)
    }
}

//-----------------------------------------------------------------------------
// Exit Code Enums
//-----------------------------------------------------------------------------

#[derive(Debug)]
enum OfficialExitCode {
    Success,          // 0
    GenericError,     // 1
    JavaNotFound,     // 2
    BadJvmArgs,       // 3
    InvalidSession,   // 4
    AccessDenied,     // 5
    OutOfMemory,      // 137
    TerminatedByUser, // 143
    Unmapped(i32),
}

impl From<i32> for OfficialExitCode {
    fn from(code: i32) -> Self {
        match code {
            0 => OfficialExitCode::Success,
            1 => OfficialExitCode::GenericError,
            2 => OfficialExitCode::JavaNotFound,
            3 => OfficialExitCode::BadJvmArgs,
            4 => OfficialExitCode::InvalidSession,
            5 => OfficialExitCode::AccessDenied,
            137 => OfficialExitCode::OutOfMemory,
            143 => OfficialExitCode::TerminatedByUser,
            other => OfficialExitCode::Unmapped(other),
        }
    }
}

//-----------------------------------------------------------------------------
// Struct Definition
//-----------------------------------------------------------------------------

/// Represents the launcher for a specific Minecraft instance.
/// Holds the instance configuration and provides methods to launch it.
pub struct InstanceLauncher {
    instance: Arc<MinecraftInstance>, // Use Arc to share instance data efficiently across threads
}

//-----------------------------------------------------------------------------
// Implementation
//-----------------------------------------------------------------------------

#[derive(Debug, Serialize, Clone)]
pub struct RunningInstanceInfo {
    pub id: String,
    pub name: String,
    pub version: String,
    pub icon: Option<String>,
    pub pid: u32,
    pub player_count: u32,
    #[serde(skip)]
    pub stdin: Option<Arc<Mutex<std::process::ChildStdin>>>,
}

#[derive(Serialize)]
pub struct InstanceStats {
    pub cpu_usage: f32,
    pub memory_usage: u64, // bytes
    pub player_count: u32,
}

lazy_static! {
    static ref RUNNING_INSTANCES: Arc<Mutex<HashMap<String, RunningInstanceInfo>>> =
        Arc::new(Mutex::new(HashMap::new()));
    static ref LAUNCHING_INSTANCES: Arc<Mutex<HashSet<String>>> =
        Arc::new(Mutex::new(HashSet::new()));
    static ref SYSTEM: Arc<Mutex<System>> = Arc::new(Mutex::new(System::new_all()));
    // Regex to capture Java version mismatch details from stderr
    static ref RE_JAVA_VERSION: Regex = Regex::new(r"class file version (\d+\.\d+).*, this version of the Java Runtime only recognizes class file versions up to (\d+\.\d+)").unwrap();

    // Player tracking regex
    static ref RE_PLAYER_JOIN: Regex = Regex::new(r"\[.*\]: (.*) joined the game").unwrap();
    static ref RE_PLAYER_LEAVE: Regex = Regex::new(r"\[.*\]: (.*) left the game").unwrap();
}

pub fn get_running_instances_list() -> Vec<RunningInstanceInfo> {
    RUNNING_INSTANCES
        .lock()
        .ok()
        .map(|lock| lock.values().cloned().collect())
        .unwrap_or_default()
}

pub fn is_instance_launching(instance_id: &str) -> bool {
    LAUNCHING_INSTANCES
        .lock()
        .ok()
        .map(|lock| lock.contains(instance_id))
        .unwrap_or(false)
}

#[tauri::command]
pub fn get_instance_stats(instance_id: String) -> Result<InstanceStats, String> {
    let stats_data = {
        let lock = RUNNING_INSTANCES
            .lock()
            .map_err(|e| format!("Lock poisoned: {}", e))?;
        lock.get(&instance_id)
            .map(|info| (info.pid, info.player_count))
    };

    if let Some((pid, player_count)) = stats_data {
        let mut sys = SYSTEM.lock().map_err(|e| format!("Lock poisoned: {}", e))?;
        // Refresh only the specific process for efficiency
        sys.refresh_processes(sysinfo::ProcessesToUpdate::Some(&[Pid::from_u32(pid)]));

        if let Some(process) = sys.process(Pid::from_u32(pid)) {
            let cpu_usage = process.cpu_usage();
            let cpu_count = sys.cpus().len() as f32;

            // Normalizamos el uso de CPU dividiendo por el número de núcleos
            // Así 100% representará el total de la capacidad del sistema
            let normalized_cpu = if cpu_count > 0.0 {
                cpu_usage / cpu_count
            } else {
                cpu_usage
            };

            return Ok(InstanceStats {
                cpu_usage: normalized_cpu,
                memory_usage: process.memory(),
                player_count,
            });
        }
    }

    Err("Instance not found or not running".to_string())
}

#[tauri::command]
pub fn send_server_command(instance_id: String, command: String) -> Result<(), String> {
    let stdin = {
        let lock = RUNNING_INSTANCES
            .lock()
            .map_err(|e| format!("Lock poisoned: {}", e))?;
        lock.get(&instance_id).and_then(|info| info.stdin.clone())
    };

    if let Some(stdin_mutex) = stdin {
        let mut stdin = stdin_mutex.lock().map_err(|e| e.to_string())?;
        use std::io::Write;
        writeln!(stdin, "{}", command).map_err(|e| e.to_string())?;
        stdin.flush().map_err(|e| e.to_string())?;
        info!("[Server Command] Sent: {} to {}", command, instance_id);
        Ok(())
    } else {
        Err("Instancia no encontrada o no admite comandos".to_string())
    }
}

pub fn kill_instance(instance_id: String) -> Result<(), String> {
    let pid = {
        let lock = RUNNING_INSTANCES
            .lock()
            .map_err(|e| format!("Lock poisoned: {}", e))?;
        lock.get(&instance_id).map(|info| info.pid)
    };

    if let Some(pid) = pid {
        let mut system = System::new();
        system.refresh_processes(sysinfo::ProcessesToUpdate::All);

        if let Some(process) = system.process(Pid::from_u32(pid)) {
            process.kill();
            info!("Killed instance {} (PID: {})", instance_id, pid);
            return Ok(());
        } else {
            // Fallback: Try OS command if sysinfo didn't find it (maybe it's a zombie or sysinfo issue)
            #[cfg(target_os = "windows")]
            {
                let _ = Command::new("taskkill")
                    .args(["/F", "/PID", &pid.to_string()])
                    .output()
                    .map_err(|e| e.to_string())?;
                info!(
                    "Killed instance {} (PID: {}) via taskkill",
                    instance_id, pid
                );
                return Ok(());
            }
            #[cfg(not(target_os = "windows"))]
            {
                let _ = Command::new("kill")
                    .args(["-9", &pid.to_string()])
                    .output()
                    .map_err(|e| e.to_string())?;
                info!("Killed instance {} (PID: {}) via kill", instance_id, pid);
                return Ok(());
            }
        }
    }

    Err("Instance not found or not running".to_string())
}

impl InstanceLauncher {
    /// Creates a new `InstanceLauncher`. The instance is wrapped in an `Arc`
    /// for cheap cloning and sharing between threads.
    pub fn new(instance: MinecraftInstance) -> Self {
        Self {
            instance: Arc::new(instance),
        }
    }

    // --- Helper Methods for Event Emission ---

    fn emit_status(&self, event_name: &str, message: &str, data: Option<Value>) {
        info!(
            "[Instance: {}] Emitting Event: {} - Message: {}",
            self.instance.instanceId, event_name, message
        );
        if let Ok(guard) = GLOBAL_APP_HANDLE.lock() {
            if let Some(app_handle) = guard.as_ref() {
                let payload = json!({
                    "id": self.instance.instanceId,
                    "name": self.instance.instanceName,
                    "message": message,
                    "data": data.unwrap_or_default()
                });
                if let Err(e) = app_handle.emit(event_name, payload) {
                    error!(
                        "[Instance: {}] Failed to emit event '{}': {}",
                        self.instance.instanceId, event_name, e
                    );
                }
            } else {
                error!(
                    "[Instance: {}] Error: GLOBAL_APP_HANDLE is None when trying to emit '{}'.",
                    self.instance.instanceId, event_name
                );
            }
        } else {
            error!(
                "[Instance: {}] Error: Could not lock GLOBAL_APP_HANDLE mutex for '{}'.",
                self.instance.instanceId, event_name
            );
        }
    }

    fn emit_error(&self, error_message: &str, data: Option<Value>) {
        error!(
            "[Instance: {}] Emitting Error Event: {}",
            self.instance.instanceId, error_message
        );
        self.emit_status(EVENT_ERROR, error_message, data);
    }

    // --- Process Monitoring ---

    /// Monitors the launched Minecraft process in a separate thread.
    /// This is the core of crash detection.
    // --- Process Monitoring ---

    fn monitor_process(instance: Arc<MinecraftInstance>, mut child: Child, session_id: i64) {
        let instance_id = instance.instanceId.clone();
        let emitter_launcher = Self {
            instance: Arc::clone(&instance),
        };

        // 1. Preparamos un "Buffer Circular" compartido.
        // Guardará las últimas 200 líneas combinadas de stdout y stderr.
        // Arc<Mutex<...>> permite que los hilos de lectura escriban y el hilo principal lea al final.
        let log_buffer: Arc<Mutex<VecDeque<String>>> =
            Arc::new(Mutex::new(VecDeque::with_capacity(200)));

        // Clones para los hilos de lectura
        let stdout_buffer = Arc::clone(&log_buffer);
        let stderr_buffer = Arc::clone(&log_buffer);

        // 2. Capturamos los pipes (IMPORTANTE: Al lanzar el comando debiste usar .stdout(Stdio::piped()))
        let stdout = child.stdout.take();
        let stderr = child.stderr.take();

        // 3. Hilo para STDOUT (Log normal del juego)
        if let Some(out) = stdout {
            let inst_id = instance_id.clone();
            thread::spawn(move || {
                let reader = BufReader::new(out);
                for line in reader.lines() {
                    if let Ok(l) = line {
                        // --- Player Tracking Update ---
                        if RE_PLAYER_JOIN.is_match(&l) {
                            if let Ok(mut lock) = RUNNING_INSTANCES.lock() {
                                if let Some(info) = lock.get_mut(&inst_id) {
                                    info.player_count += 1;
                                }
                            }
                        } else if RE_PLAYER_LEAVE.is_match(&l) {
                            if let Ok(mut lock) = RUNNING_INSTANCES.lock() {
                                if let Some(info) = lock.get_mut(&inst_id) {
                                    if info.player_count > 0 {
                                        info.player_count -= 1;
                                    }
                                }
                            }
                        }

                        // Emitir evento al Frontend para una consola en tiempo real
                        if let Ok(guard) = GLOBAL_APP_HANDLE.lock() {
                            if let Some(app_handle) = guard.as_ref() {
                                let _ = app_handle.emit(
                                    "instance-console-log",
                                    json!({
                                        "id": inst_id,
                                        "message": l,
                                        "type": "stdout"
                                    }),
                                );
                            }
                        }

                        // Guardar en el buffer circular
                        if let Ok(mut buffer) = stdout_buffer.lock() {
                            if buffer.len() >= 200 {
                                buffer.pop_front();
                            } // Borrar la más vieja
                            buffer.push_back(l); // Agregar la nueva
                        }
                    }
                }
            });
        }

        // 4. Hilo para STDERR (Errores críticos de Java)
        if let Some(err) = stderr {
            let inst_id = instance_id.clone();
            thread::spawn(move || {
                let reader = BufReader::new(err);
                for line in reader.lines() {
                    if let Ok(l) = line {
                        if let Ok(guard) = GLOBAL_APP_HANDLE.lock() {
                            if let Some(app_handle) = guard.as_ref() {
                                let _ = app_handle.emit(
                                    "instance-console-log",
                                    json!({
                                        "id": inst_id,
                                        "message": l,
                                        "type": "stderr"
                                    }),
                                );
                            }
                        }

                        if let Ok(mut buffer) = stderr_buffer.lock() {
                            if buffer.len() >= 200 {
                                buffer.pop_front();
                            }
                            buffer.push_back(l);
                        }
                    }
                }
            });
        }

        // 5. El hilo principal espera a que el proceso termine
        thread::spawn(move || {
            // .wait() bloquea este hilo hasta que Minecraft se cierra, pero no consume RAM acumulando logs
            let wait_result = child.wait();

            // Remove from running instances registry
            {
                if let Ok(mut lock) = RUNNING_INSTANCES.lock() {
                    lock.remove(&instance_id);
                }
            }

            match wait_result {
                Ok(status) => {
                    let exit_code = status.code().unwrap_or(-1);
                    let official_exit_code: OfficialExitCode = exit_code.into();

                    // Recuperamos las últimas líneas guardadas en memoria
                    let captured_logs: Vec<String> = log_buffer
                        .lock()
                        .map(|b| b.iter().cloned().collect())
                        .unwrap_or_default();

                    let log_tail = captured_logs.join("\n");

                    info!(
                        "[Monitor: {}] Process exited with code {}",
                        instance.instanceId, exit_code
                    );

                    // Record session end only if it was a clean exit
                    if session_id != -1 && exit_code == 0 {
                        if let Err(e) =
                            crate::core::play_history::PlayHistoryManager::get_instance()
                                .record_session_end(session_id)
                        {
                            error!(
                                "[Monitor: {}] Failed to record session end: {}",
                                instance.instanceId, e
                            );
                        }
                    }

                    // --- Lógica de Detección de Crash ---
                    let mut crash_source = "NORMAL_EXIT";
                    let mut crash_report_content: Option<String> = None;
                    let mut detected_error_details = json!({ "code": "UNKNOWN_ERROR" });

                    if exit_code != 0 {
                        crash_source = "UNKNOWN";
                        let mc_path = PathBuf::from(&instance.minecraftPath);

                        // A. Buscar Crash Report Físico (Prioridad Alta)
                        let crash_report_dir = mc_path.join("crash-reports");
                        if let Ok(mut entries) = fs::read_dir(crash_report_dir) {
                            let latest = entries
                                .filter_map(Result::ok)
                                .map(|e| e.path())
                                .filter(|p| {
                                    p.is_file() && p.extension().map_or(false, |ext| ext == "txt")
                                })
                                .max();

                            if let Some(path) = latest {
                                if let Ok(meta) = fs::metadata(&path) {
                                    if let Ok(modified) = meta.modified() {
                                        // Solo si es reciente (< 1 min)
                                        if modified.elapsed().unwrap_or_default().as_secs() < 60 {
                                            crash_report_content = fs::read_to_string(path).ok();
                                            crash_source = "CRASH_REPORT";
                                        }
                                    }
                                }
                            }
                        }

                        // B. Buscar Crash Nativo JVM (hs_err_pid)
                        if crash_source == "UNKNOWN" {
                            if let Ok(entries) = fs::read_dir(&mc_path) {
                                let jvm_crash = entries
                                    .filter_map(Result::ok)
                                    .map(|e| e.path())
                                    .filter(|p| {
                                        p.file_name()
                                            .map(|n| n.to_string_lossy().starts_with("hs_err_pid"))
                                            .unwrap_or(false)
                                    })
                                    .max();

                                if let Some(path) = jvm_crash {
                                    if let Ok(meta) = fs::metadata(&path) {
                                        if meta
                                            .modified()
                                            .unwrap_or(std::time::SystemTime::now())
                                            .elapsed()
                                            .unwrap_or_default()
                                            .as_secs()
                                            < 60
                                        {
                                            let content =
                                                fs::read_to_string(path).unwrap_or_default();
                                            crash_report_content = Some(
                                                content
                                                    .lines()
                                                    .take(50)
                                                    .collect::<Vec<_>>()
                                                    .join("\n"),
                                            );
                                            crash_source = "JVM_CRASH";
                                            detected_error_details = json!({ "code": "JVM_CRASH", "message": "Native Java crash detected." });
                                        }
                                    }
                                }
                            }
                        }

                        // C. USAR EL LOG NORMAL (El Buffer que capturamos)
                        // Si no hay reporte, analizamos lo último que dijo el juego.
                        if crash_source == "UNKNOWN" {
                            // Análisis básico de regex sobre log_tail
                            if let Some(captures) = RE_JAVA_VERSION.captures(&log_tail) {
                                // ... lógica de versión de java ...
                                detected_error_details = json!({ "code": "JAVA_VERSION", "message": "Java version mismatch detected in logs." });
                                crash_source = "LOG_ANALYSIS";
                            } else if log_tail.contains("OutOfMemory") {
                                detected_error_details = json!({ "code": "OOM", "message": "Out of memory detected in logs." });
                                crash_source = "LOG_ANALYSIS";
                            } else {
                                // Si no detectamos nada específico, pero falló, enviamos el tail como "evidencia"
                                crash_source = "LOG_TAIL";
                                // Marcamos que usamos el log normal como reporte
                                crash_report_content = Some(format!(
                                    "--- NO CRASH REPORT FOUND. SHOWING LAST LOG LINES ---\n{}",
                                    log_tail
                                ));
                                detected_error_details = json!({
                                    "code": "GENERIC_ERROR",
                                    "message": "Game exited with error but produced no crash report. Check the attached log tail."
                                });
                            }
                        }
                    }

                    // Emitir evento final
                    emitter_launcher.emit_status(
                        EVENT_EXITED,
                        &format!("Exited with code {}", exit_code),
                        Some(json!({
                            "exitCode": exit_code,
                            "officialExitCode": format!("{:?}", official_exit_code),
                            "crashSource": crash_source,
                            "detectedError": detected_error_details,
                            "crashReport": crash_report_content, // Aquí va el log normal si no hubo crash report
                        })),
                    );
                }
                Err(e) => {
                    emitter_launcher.emit_error(&format!("Process wait failed: {}", e), None);
                }
            }
        });
    }

    /// Revalidates or downloads necessary game assets, libraries, etc.
    fn revalidate_assets(&self) -> Result<(), LaunchError> {
        info!(
            "[Instance: {}] Revalidating assets...",
            self.instance.instanceName
        );
        self.emit_status(
            EVENT_DOWNLOADING_ASSETS,
            "Verificando/Descargando assets...",
            None,
        );

        if self.instance.minecraftVersion.is_empty() {
            self.emit_error("Minecraft version is not specified.", None);
            return Err(LaunchError::VersionNotSpecified);
        }

        if !network_utilities::check_real_connection() {
            warn!(
                "[Instance: {}] No internet connection. Skipping asset revalidation.",
                self.instance.instanceId
            );
            return Ok(());
        }

        // This is tricky because revalidate_assets needs a mutable instance.
        // For this to work, we might need a Mutex around the instance data if it's to be modified.
        // For now, we assume revalidate_assets can work with a mutable copy.
        let mut instance_clone_for_bootstrap = (*self.instance).clone();
        let mut instance_bootstrap = InstanceBootstrap::new();

        // Use asset revalidation for better performance
        instance_bootstrap
            .revalidate_assets(&instance_clone_for_bootstrap)
            .map_err(|e| e.to_string())?;

        info!(
            "[Instance: {}] Asset revalidation completed.",
            self.instance.instanceName
        );
        Ok(())
    }

    // --- Internal Synchronous Launch Logic ---

    /// Contains the core, sequential steps for launching the instance.
    fn perform_launch_steps(&self) {
        info!(
            "[Launch Thread: {}] Starting launch steps...",
            self.instance.instanceId
        );
        self.emit_status(EVENT_LAUNCH_START, "Preparando lanzamiento...", None);

        // This block contains the fallible part of the launch sequence.
        let launch_result = (|| -> Result<Child, LaunchError> {
            // 1. Revalidate Assets
            self.revalidate_assets()?;
            info!(
                "[Launch Thread: {}] Asset revalidation successful.",
                self.instance.instanceId
            );

            // 2. Launch Minecraft
            let minecraft_launcher = CoreMinecraftLauncher::new((*self.instance).clone());

            minecraft_launcher
                .launch()
                .map_err(LaunchError::ProcessStartFailed)
        })();

        match launch_result {
            Ok(mut child_process) => {
                info!(
                    "[Launch Thread: {}] Minecraft process started (PID: {}).",
                    self.instance.instanceId,
                    child_process.id()
                );

                let stdin = child_process.stdin.take().map(|s| Arc::new(Mutex::new(s)));

                // Add to running instances registry
                {
                    if let Ok(mut lock) = RUNNING_INSTANCES.lock() {
                        lock.insert(
                            self.instance.instanceId.clone(),
                            RunningInstanceInfo {
                                id: self.instance.instanceId.clone(),
                                name: self.instance.instanceName.clone(),
                                version: self.instance.minecraftVersion.clone(),
                                icon: self.instance.iconUrl.clone(),
                                pid: child_process.id(),
                                player_count: 0,
                                stdin,
                            },
                        );
                    }
                }

                self.emit_status(
                    EVENT_LAUNCHED,
                    "Minecraft se está ejecutando.",
                    Some(json!({ "pid": child_process.id() })),
                );

                // Record session start
                let session_id = crate::core::play_history::PlayHistoryManager::get_instance()
                    .record_session_start(
                        &self.instance.instanceId,
                        Some(self.instance.minecraftVersion.clone()),
                    )
                    .unwrap_or_else(|e| {
                        error!(
                            "[Launch Thread: {}] Failed to record session start: {}",
                            self.instance.instanceId, e
                        );
                        -1
                    });

                Self::monitor_process(Arc::clone(&self.instance), child_process, session_id);

                // Handle closing the launcher if configured
                self.handle_close_on_launch();
            }
            Err(e) => {
                let err_msg = e.to_string();
                error!(
                    "[Launch Thread: {}] Launch sequence failed: {}",
                    self.instance.instanceId, err_msg
                );
                self.emit_error(&err_msg, None);
            }
        }
        info!(
            "[Launch Thread: {}] Finishing execution.",
            self.instance.instanceId
        );
    }

    fn handle_close_on_launch(&self) {
        let close_on_launch = match get_config_manager().lock() {
            Ok(guard) => match &*guard {
                Ok(mgr) => mgr.get_close_on_launch(),
                Err(_) => false,
            },
            Err(_) => false,
        };
        if !close_on_launch {
            return;
        }

        info!(
            "[Launch Thread: {}] Closing launcher as configured.",
            self.instance.instanceId
        );
        // Wait for the launched process to appear in the registry before closing.
        let instance_id = self.instance.instanceId.clone();
        let mut appeared = false;
        for _ in 0..10 {
            let found = RUNNING_INSTANCES
                .lock()
                .ok()
                .map(|lock| lock.contains_key(&instance_id))
                .unwrap_or(false);
            if found {
                appeared = true;
                break;
            }
            thread::sleep(std::time::Duration::from_millis(500));
        }

        if !appeared {
            warn!(
                "[Launch Thread: {}] Launcher not closed because the instance never registered as running.",
                self.instance.instanceId
            );
            return;
        }

        if let Ok(guard) = GLOBAL_APP_HANDLE.lock() {
            if let Some(app_handle) = guard.as_ref() {
                app_handle.exit(0);
            }
        }
    }

    // --- Public Asynchronous Launch Method ---

    /// Initiates the instance launch process in a separate background thread.
    pub fn launch_instance_async(&self) {
        let instance_arc_clone = Arc::clone(&self.instance);
        let instance_id = instance_arc_clone.instanceId.clone();

        let already_running = RUNNING_INSTANCES
            .lock()
            .ok()
            .map(|lock| lock.contains_key(&instance_id))
            .unwrap_or(false);
        let already_launching = LAUNCHING_INSTANCES
            .lock()
            .ok()
            .map(|lock| lock.contains(&instance_id))
            .unwrap_or(false);

        if already_running || already_launching {
            warn!(
                "[Main Thread] Instance {} is already running or launching; ignoring duplicate launch request.",
                instance_id
            );
            return;
        }

        if let Ok(mut lock) = LAUNCHING_INSTANCES.lock() {
            lock.insert(instance_id.clone());
        }

        info!(
            "[Main Thread] Spawning launch thread for instance: {}",
            instance_id
        );

        thread::spawn(move || {
            let thread_launcher = Self {
                instance: instance_arc_clone,
            };
            thread_launcher.perform_launch_steps();

            if let Ok(mut lock) = LAUNCHING_INSTANCES.lock() {
                lock.remove(&thread_launcher.instance.instanceId);
            }
        });
    }
}
