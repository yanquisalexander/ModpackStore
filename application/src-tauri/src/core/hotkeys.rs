use tauri::{AppHandle, Manager, Runtime, Emitter};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState, Shortcut};
use std::str::FromStr;

#[tauri::command]
pub fn reload_hotkeys(app: AppHandle) {
    register_hotkeys(&app);
}

#[tauri::command]
pub fn unregister_hotkeys(app: AppHandle) {
    let _ = app.global_shortcut().unregister_all();
}

#[cfg(target_os = "windows")]
use windows::Win32::UI::WindowsAndMessaging::{GetForegroundWindow, GetWindowRect, GetDesktopWindow, GetShellWindow, GetClassNameW};
#[cfg(target_os = "windows")]
use windows::Win32::Graphics::Gdi::{MonitorFromWindow, GetMonitorInfoW, MONITOR_DEFAULTTONEAREST, MONITORINFO};
#[cfg(target_os = "windows")]
use windows::Win32::Foundation::RECT;

pub fn register_hotkeys<R: Runtime>(app: &AppHandle<R>) {
    let mut open_app = "Ctrl+Alt+M".to_string();
    let mut toggle_overlay = "Ctrl+Shift+I".to_string();
    let mut kill_instance = "Ctrl+Alt+Shift+X".to_string();
    let mut enabled = true;

    // Access config safely
    // Note: This assumes config manager is already initialized or can be initialized.
    // Since this is called from setup or commands, it should be fine.
    if let Ok(config_mgr) = crate::config::get_config_manager().lock() {
        if let Ok(config) = config_mgr.as_ref() {
             if let Some(val) = config.get("hotkeysEnabled").and_then(|v| v.as_bool()) {
                 enabled = val;
             }
             if let Some(val) = config.get("hotkeyOpenApp").and_then(|v| v.as_str()) {
                 open_app = val.to_string();
             }
             if let Some(val) = config.get("hotkeyToggleOverlay").and_then(|v| v.as_str()) {
                 toggle_overlay = val.to_string();
             }
             if let Some(val) = config.get("hotkeyKillInstance").and_then(|v| v.as_str()) {
                 kill_instance = val.to_string();
             }
        }
    }

    if enabled {
        let _ = app.global_shortcut().unregister_all();
        
        if let Ok(shortcut) = Shortcut::from_str(&open_app) {
            if let Err(e) = app.global_shortcut().register(shortcut) {
                log::warn!("Failed to register shortcut {}: {}", open_app, e);
            }
        }
        if let Ok(shortcut) = Shortcut::from_str(&toggle_overlay) {
            if let Err(e) = app.global_shortcut().register(shortcut) {
                log::warn!("Failed to register shortcut {}: {}", toggle_overlay, e);
            }
        }
        if let Ok(shortcut) = Shortcut::from_str(&kill_instance) {
            if let Err(e) = app.global_shortcut().register(shortcut) {
                log::warn!("Failed to register shortcut {}: {}", kill_instance, e);
            }
        }
    } else {
        let _ = app.global_shortcut().unregister_all();
    }
}

pub fn is_fullscreen_active() -> bool {
    #[cfg(target_os = "windows")]
    unsafe {
        let foreground_window = GetForegroundWindow();
        if foreground_window.0 == std::ptr::null_mut() {
            return false;
        }

        // Ignore if foreground window is the desktop or shell
        let shell_window = GetShellWindow();
        if foreground_window == shell_window {
            return false;
        }
        
        let desktop_window = GetDesktopWindow();
        if foreground_window == desktop_window {
            return false;
        }

        // Check window class name to ignore "WorkerW" and "Progman" (desktop)
        let mut class_name = [0u16; 256];
        let len = GetClassNameW(foreground_window, &mut class_name);
        if len > 0 {
            let name = String::from_utf16_lossy(&class_name[..len as usize]);
            // Clean up null terminators and whitespace
            let name = name.trim_matches(char::from(0)).trim();
            
            // Log for debugging
            log::info!("Checking fullscreen. Foreground window class: '{}'", name);

            if name == "WorkerW" || name == "Progman" || name == "Shell_TrayWnd" || name == "Shell_SecondaryTrayWnd" {
                return false;
            }
        }

        let mut window_rect = RECT::default();
        if GetWindowRect(foreground_window, &mut window_rect).is_err() {
            return false;
        }

        // Get the monitor that the window is mostly on
        let monitor = MonitorFromWindow(foreground_window, MONITOR_DEFAULTTONEAREST);
        let mut monitor_info = MONITORINFO {
            cbSize: std::mem::size_of::<MONITORINFO>() as u32,
            ..Default::default()
        };

        if GetMonitorInfoW(monitor, &mut monitor_info).as_bool() {
            let monitor_rect = monitor_info.rcMonitor;
            
            // Check if window covers the whole monitor
            // We use a small tolerance because sometimes windows are 1px off
            // Also check if the window is visible and not minimized (though foreground usually is)
            return window_rect.left <= monitor_rect.left &&
                   window_rect.top <= monitor_rect.top &&
                   window_rect.right >= monitor_rect.right &&
                   window_rect.bottom >= monitor_rect.bottom;
        }
        
        // Fallback to desktop rect if monitor info fails (unlikely)
        let mut desktop_rect = RECT::default();
        if GetWindowRect(desktop_window, &mut desktop_rect).is_err() {
            return false;
        }

        window_rect.left <= desktop_rect.left &&
        window_rect.top <= desktop_rect.top &&
        window_rect.right >= desktop_rect.right &&
        window_rect.bottom >= desktop_rect.bottom
    }

    #[cfg(not(target_os = "windows"))]
    false
}

pub fn toggle_main_window<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        if window.is_visible().unwrap_or(false) {
            if window.is_minimized().unwrap_or(false) {
                 let _ = window.unminimize();
                 let _ = window.set_focus();
            } else {
                let _ = window.hide();
            }
        } else {
            let _ = window.show();
            let _ = window.set_focus();
        }
    }
}

pub fn toggle_overlay<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window("instances-overlay") {
        if window.is_visible().unwrap_or(false) {
            let _ = window.hide();
        } else {
            let _ = window.center();
            let _ = window.show();
            let _ = window.set_focus();
        }
    }
}
