/// Safe URL/path opener that works correctly inside Linux AppImage environments.
///
/// The problem: Inside an AppImage, environment variables like `APPDIR`, `APPIMAGE`,
/// and `LD_LIBRARY_PATH` point to the AppImage's internal mounted filesystem.
/// When `xdg-open` is invoked, it may use the AppImage's bundled libraries/config
/// instead of the host system's, causing it to fail silently. This prevents users
/// from opening any external URL, including authentication flows.
///
/// The fix: On Linux, when running inside an AppImage, we sanitize the environment
/// before invoking `xdg-open`, stripping all AppImage-specific variables so the
/// host system's browser is used instead.

use tauri::AppHandle;

/// Opens a URL in the user's default browser.
///
/// On Linux AppImage, sanitizes the environment so xdg-open uses
/// the host system's browser instead of the AppImage-internal one.
pub fn open_url(app: &AppHandle, url: &str) -> Result<(), String> {
    #[cfg(target_os = "linux")]
    {
        if is_appimage() {
            log::info!("AppImage detected, using sanitized xdg-open for URL: {}", url);
            return open_via_sanitized_command(url, false);
        }
    }

    // Default: use tauri-plugin-opener
    use tauri_plugin_opener::OpenerExt;
    app.opener()
        .open_url(url, None::<&str>)
        .map_err(|e| format!("Error opening URL: {}", e))
}

/// Opens a path (file or directory) with the system's default handler.
///
/// On Linux AppImage, sanitizes the environment so xdg-open uses
/// the host system's file manager instead of the AppImage-internal one.
pub fn open_path(app: &AppHandle, path: &str) -> Result<(), String> {
    #[cfg(target_os = "linux")]
    {
        if is_appimage() {
            log::info!("AppImage detected, using sanitized xdg-open for path: {}", path);
            return open_via_sanitized_command(path, true);
        }
    }

    // Default: use tauri-plugin-opener
    use tauri_plugin_opener::OpenerExt;
    app.opener()
        .open_path(path, None::<&str>)
        .map_err(|e| format!("Error opening path: {}", e))
}

/// Check if we're running inside an AppImage.
#[cfg(target_os = "linux")]
fn is_appimage() -> bool {
    std::env::var("APPIMAGE").is_ok() || std::env::var("APPDIR").is_ok()
}

/// Open a URL or path using the host system's xdg-open, with AppImage
/// environment variables stripped to avoid interference.
#[cfg(target_os = "linux")]
fn open_via_sanitized_command(target: &str, is_path: bool) -> Result<(), String> {
    use std::process::Command;

    // Environment variables set by the AppImage runtime that interfere
    // with the host's xdg-open / browser / file manager.
    const APPIMAGE_ENV_VARS: &[&str] = &[
        "APPDIR",
        "APPIMAGE",
        "OWD",
        "ARGV0",
        "LD_LIBRARY_PATH",
        "LD_PRELOAD",
        "GDK_BACKEND",
        "DESKTOPINTEGRATION",
        "APPIMAGE_ORIGINAL_LD_LIBRARY_PATH",
        "PYTHONPATH",
        "PYTHONHOME",
        "PERLLIB",
        "GSETTINGS_SCHEMA_DIR",
        "QT_PLUGIN_PATH",
    ];

    // Try multiple openers in order of preference
    let openers: Vec<(&str, Vec<&str>)> = if is_path {
        vec![
            ("xdg-open", vec![target]),
            ("gio", vec!["open", target]),
        ]
    } else {
        vec![
            ("xdg-open", vec![target]),
            ("gio", vec!["open", target]),
        ]
    };

    let mut last_error = String::new();

    for (opener, args) in &openers {
        let mut cmd = Command::new(opener);
        cmd.args(args);

        // Strip all AppImage environment variables
        for var in APPIMAGE_ENV_VARS {
            cmd.env_remove(var);
        }

        match cmd.spawn() {
            Ok(_child) => {
                log::info!("Successfully spawned '{}' for: {}", opener, target);
                return Ok(());
            }
            Err(e) => {
                log::warn!("Failed to spawn '{}': {}", opener, e);
                last_error = format!("{}: {}", opener, e);
                continue;
            }
        }
    }

    Err(format!(
        "Failed to open '{}': no suitable opener found (last error: {})",
        target, last_error
    ))
}
