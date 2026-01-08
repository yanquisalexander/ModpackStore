#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
#![allow(non_snake_case)]
#![allow(unused_imports)]
#![allow(unused_variables)]
#![allow(unused_mut)]
#![allow(unused_attributes)]
#![allow(unused_macros)]

mod config;
mod core;
mod interfaces;
mod utils;

use core::auth::*;
use serde_json::json;
use std::process::Command;
use std::str;
use std::str::FromStr;
use std::sync::Arc;
use std::sync::Mutex;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, TrayIconBuilder, TrayIconEvent};
use tauri::Wry;
use tauri::{Emitter, Manager, PhysicalPosition, PhysicalSize}; // Necesario para get_window y emit
use tauri_plugin_log::{Target, TargetKind};
use tauri_plugin_store::StoreExt;
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState, Shortcut};

static GLOBAL_APP_HANDLE: once_cell::sync::Lazy<std::sync::Mutex<Option<tauri::AppHandle>>> =
    once_cell::sync::Lazy::new(|| std::sync::Mutex::new(None));

static API_ENDPOINT: once_cell::sync::Lazy<&'static str> = once_cell::sync::Lazy::new(|| {
    if cfg!(debug_assertions) {
        // En modo dev, usar el endpoint de desarrollo fijo
        "http://localhost:3000/v1"
    } else {
        // En producción, preferir la variable de entorno VITE_API_ENDPOINT, si no existe, usar fallback
        match std::env::var("VITE_API_ENDPOINT") {
            Ok(s) if !s.is_empty() => Box::leak(s.into_boxed_str()),
            _ => "https://api-modpackstore.saltouruguayserver.com/v1",
        }
    }
});

struct PendingInstance {
    id: Mutex<Option<String>>,
}

struct AppState {
    started_minimized: Mutex<bool>,
}

#[tauri::command]
async fn get_git_hash() -> String {
    option_env!("GIT_HASH_BUILD_TIME")
        .unwrap_or("Not available")
        .to_string()
}

#[tauri::command]
fn splash_done(app: tauri::AppHandle) {
    let splash_window = app.get_webview_window("splash").unwrap();
    let main_window = app.get_webview_window("main").unwrap();
    splash_window.close().unwrap();
    
    let state: tauri::State<Arc<AppState>> = app.state();
    let started_minimized = *state.started_minimized.lock().unwrap();

    if !started_minimized {
        main_window.set_focus().unwrap();
        log::info!("Splash screen closed, main window focused.");
        main_window.show().unwrap();
    } else {
        log::info!("Splash screen closed, main window kept hidden (started minimized).");
    }

    let id = {
        let state: tauri::State<Arc<PendingInstance>> = app.state();
        let id = state.id.lock().unwrap().take();
        id
    };
    if let Some(id) = id {
        let _ = app.emit("open-instance", id);
    };
}

#[tauri::command]
async fn get_running_instances(
) -> Result<Vec<crate::core::instance_launcher::RunningInstanceInfo>, String> {
    Ok(crate::core::instance_launcher::get_running_instances_list())
}

#[tauri::command]
async fn kill_mc_instance(instance_id: String) -> Result<(), String> {
    crate::core::instance_launcher::kill_instance(instance_id)
}

pub fn main() {
    let _ = fix_path_env::fix();

    let logs_dir = dirs::config_dir()
        .expect("No se pudo obtener el directorio de configuración")
        .join("dev.alexitoo.modpackstore")
        .join("logs");

    let log_file_name = format!(
        "mstore_{}",
        chrono::Local::now().format("%Y-%m-%d_%H-%M-%S")
    );

    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, Some(vec!["--minimized"])))
        .plugin(tauri_plugin_global_shortcut::Builder::new().with_handler(move |app, shortcut, event| {
            if event.state == ShortcutState::Pressed {
                if crate::core::hotkeys::is_fullscreen_active() {
                     log::info!("Hotkey ignored: fullscreen active");
                     return;
                }
                
                let shortcut_str = shortcut.to_string();
                
                if let Ok(config_mgr) = crate::config::get_config_manager().lock() {
                    if let Ok(config) = config_mgr.as_ref() {
                         let open_app_str = config.get("hotkeyOpenApp").and_then(|v| v.as_str()).unwrap_or("Ctrl+Alt+M");
                         let toggle_overlay_str = config.get("hotkeyToggleOverlay").and_then(|v| v.as_str()).unwrap_or("Ctrl+Shift+I");
                         let kill_instance_str = config.get("hotkeyKillInstance").and_then(|v| v.as_str()).unwrap_or("Ctrl+Alt+Shift+X");
                         
                         log::info!("Hotkey pressed: '{}'. Configured: Open='{}', Overlay='{}', Kill='{}'", shortcut_str, open_app_str, toggle_overlay_str, kill_instance_str);

                         if let Ok(s) = Shortcut::from_str(open_app_str) {
                             if shortcut == &s {
                                 crate::core::hotkeys::toggle_main_window(app);
                                 return;
                             }
                         }
                         
                         if let Ok(s) = Shortcut::from_str(toggle_overlay_str) {
                             if shortcut == &s {
                                 crate::core::hotkeys::toggle_overlay(app);
                                 return;
                             }
                         }

                         if let Ok(s) = Shortcut::from_str(kill_instance_str) {
                             if shortcut == &s {
                                 let _ = app.emit("instance:kill", ());
                                 return;
                             }
                         }
                    } else {
                        log::error!("Failed to get config reference in hotkey handler");
                    }
                } else {
                    log::error!("Failed to lock config manager in hotkey handler");
                }
            }
        }).build())
        .plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
            let _ = app
                .get_webview_window("main")
                .expect("no main window")
                .set_focus();

            if let Some(id) = get_instance_arg(&args) {
                let _ = app.emit("open-instance", id);
            }
        }))
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        /* .on_window_event(|window, event| {
            if window.label() == "running-instances-tray-window" {
                if let tauri::WindowEvent::Focused(false) = event {
                    let _ = window.hide();
                }
            }
        }) */
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_drpc::init())
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(log::LevelFilter::Info)
                .level_for("reqwest", log::LevelFilter::Info)
                .rotation_strategy(tauri_plugin_log::RotationStrategy::KeepAll)
                .target(tauri_plugin_log::Target::new(
                    tauri_plugin_log::TargetKind::Folder {
                        path: std::path::PathBuf::from(logs_dir),
                        file_name: Some(log_file_name),
                    },
                ))
                .build(),
        )
        .manage(Arc::new(AuthState::new()))
        .manage(Arc::new(PendingInstance {
            id: Mutex::new(None),
        }))
        .manage(Arc::new(AppState {
            started_minimized: Mutex::new(false),
        }))
        .setup(|app| {
            log::info!("Starting Modpack Store...");
            log::info!(
                "Running on: {}, {}",
                std::env::consts::OS,
                std::env::consts::ARCH
            );

            // Check for minimized start
            let args: Vec<String> = std::env::args().collect();
            let started_minimized = args.contains(&"--minimized".to_string());
            
            if started_minimized {
                if let Some(splash) = app.get_webview_window("splash") {
                    let _ = splash.hide();
                }
                let state: tauri::State<Arc<AppState>> = app.state();
                *state.started_minimized.lock().unwrap() = true;
                
                 use tauri_plugin_notification::NotificationExt;
                 let _ = app.notification()
                    .builder()
                    .title("Modpack Store")
                    .body("Modpack Store está corriendo en segundo plano. Usa Ctrl + Alt + M para abrir")
                    .show();
            }

            // Register hotkeys
            crate::core::hotkeys::register_hotkeys(app.handle());

            // Store the AppHandle in the static variable
            let mut app_handle = GLOBAL_APP_HANDLE.lock().unwrap();
            *app_handle = Some(app.handle().clone());

            // Initialize i18n system
            if let Err(e) = crate::core::i18n::init_i18n_manager(app.handle().clone()) {
                log::error!("Failed to initialize i18n manager: {}", e);
                return Err(Box::new(std::io::Error::new(std::io::ErrorKind::Other, e)));
            }

            // --- Tray Icon Setup ---
            let quit_i = MenuItem::with_id(app, "quit", "Salir", true, None::<&str>)?;
            let show_i = MenuItem::with_id(app, "show", "Abrir Launcher", true, None::<&str>)?;
            let instances_i = MenuItem::with_id(
                app,
                "show_instances",
                "Ver Instancias Activas",
                true,
                None::<&str>,
            )?;

            let menu = Menu::with_items(
                app,
                &[
                    &show_i,
                    &instances_i,
                    &tauri::menu::PredefinedMenuItem::separator(app)?,
                    &quit_i,
                ],
            )?;

            let _tray = TrayIconBuilder::new()
                .menu(&menu)
                .show_menu_on_left_click(false)
                .icon(app.default_window_icon().unwrap().clone())
                .on_menu_event(|app, event| {
                    match event.id().as_ref() {
                        "quit" => app.exit(0),
                        "show" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        "show_instances" => {
                            if let Some(window) =
                                app.get_webview_window("instances-overlay")
                            {
                                // Posicionamiento: Arriba a la derecha
                                if let Some(monitor) = window.current_monitor().unwrap_or(None) {
                                    let monitor_size = monitor.size();
                                    let window_size =
                                        window.outer_size().unwrap_or(PhysicalSize::new(350, 500));

                                    let x = monitor_size.width - window_size.width - 20;
                                    let y = 50; // Margen superior

                                    let _ = window
                                        .set_position(PhysicalPosition::new(x as i32, y as i32));
                                }

                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        _ => {}
                    }
                })
                .build(app)?;

            let app_handle_clone = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                // Preload common languages first
                if let Err(e) = crate::core::i18n::get_i18n_manager()
                    .preload_common_languages()
                    .await
                {
                    log::warn!("Failed to preload languages: {}", e);
                }

                // Now detect system language (after languages are preloaded)
                let detected_lang = crate::core::i18n::get_i18n_manager().detect_system_language();

                // Load current language from config or use detected system language
                let current_lang = {
                    match crate::config::get_config_manager().lock() {
                        Ok(config_result) => match &*config_result {
                            Ok(config) => config
                                .get("language")
                                .and_then(|v| v.as_str())
                                .map(|s| s.to_string())
                                .unwrap_or_else(|| detected_lang.clone()),
                            Err(_) => detected_lang.clone(),
                        },
                        Err(_) => detected_lang.clone(),
                    }
                };

                // Set initial language
                if let Err(e) = crate::core::i18n::get_i18n_manager()
                    .set_language(&current_lang)
                    .await
                {
                    log::error!("Failed to set initial language {}: {}", current_lang, e);
                } else {
                    log::info!("Initialized i18n system with language: {}", current_lang);
                }
            });

            // Emit an event to the main window

            let args: Vec<String> = std::env::args().collect();
            if let Some(id) = get_instance_arg(&args) {
                let state: tauri::State<Arc<PendingInstance>> = app.state();
                *state.id.lock().unwrap() = Some(id);
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            config::get_config,
            config::get_schema,
            config::get_config_value,
            config::set_config_value,
            config::set_config,
            core::onboarding::get_onboarding_status,
            core::onboarding::get_system_memory,
            core::onboarding::complete_onboarding,
            core::onboarding::skip_onboarding,
            core::onboarding::validate_java_installation,
            core::onboarding::install_java,
            core::onboarding::repair_java_installation,
            core::network_utilities::check_connection,
            core::network_utilities::check_real_connection,
            core::instance_manager::get_all_instances,
            core::instance_manager::get_instance_by_id,
            core::instance_manager::delete_instance,
            //utils::config_manager::get_config,
            core::instance_manager::launch_mc_instance,
            core::minecraft_instance::open_game_dir,
            core::instance_manager::update_instance,
            core::instance_manager::toggle_favorite,
            core::instance_manager::update_favorite_order,
            core::instance_manager::get_favorite_instances,
            core::instance_launcher::send_server_command,
            core::instance_manager::create_local_instance,
            core::instance_manager::create_modpack_instance,
            core::instance_manager::check_modpack_updates,
            core::instance_manager::update_modpack_instance,
            core::instance_manager::validate_modpack_password,
            core::modpack_file_manager::cleanup_instance_files,
            core::modpack_file_manager::validate_and_download_modpack_assets,
            /*             core::modpack_file_manager::audit_user_data_protection_command,
             */
            core::instance_manager::search_instances,
            core::instance_manager::remove_instance,
            core::accounts_manager::get_all_accounts,
            core::accounts_manager::add_offline_account,
            core::accounts_manager::ensure_account_exists,
            core::accounts_manager::remove_account,
            core::minecraft_instance::get_instances_by_modpack_id,
            core::auth::start_discord_auth,
            core::auth::start_twitch_auth,
            core::auth::start_patreon_auth,
            core::auth::get_current_session,
            core::auth::logout,
            core::auth::refresh_tokens,
            core::auth::init_session,
            core::microsoft_auth::start_microsoft_auth,
            core::prelaunch_appearance::get_prelaunch_appearance,
            core::prelaunch_appearance::fetch_and_save_prelaunch_appearance,
            core::prelaunch_appearance::update_prelaunch_appearance,
            core::tasks_manager::get_all_tasks_command,
            core::tasks_manager::resync_tasks_command,
            core::i18n::get_current_language,
            core::i18n::set_language,
            core::i18n::get_available_languages,
            core::i18n::get_translations,
            core::i18n::get_message,
            core::i18n::get_message_with_params,
            core::play_history::get_recent_instances,
            core::play_history::get_play_history,
            core::play_history::clear_play_history,
            core::i18n::get_detected_system_language,
            core::i18n::reset_to_system_language,
            core::mrpack_handler::validate_mrpack_file,
            core::mrpack_handler::check_mrpack_compatibility,
            core::mrpack_handler::export_instance_to_mrpack,
            core::instance_manager::create_instance_from_mrpack,
            core::minecraft::async_launcher::launch_minecraft_async,
            core::theme_manager::get_external_themes,
            core::theme_manager::get_themes_directory_path,
            core::world_manager::list_worlds,
            core::world_manager::delete_world,
            core::world_manager::export_world,
            core::world_manager::import_world,
            core::world_manager::validate_world_import,
            core::world_manager::edit_world_settings,
            utils::desktop_integration::create_shortcut,
            get_git_hash,
            get_running_instances,
            kill_mc_instance,
            splash_done,
            core::hotkeys::reload_hotkeys,
            core::hotkeys::unregister_hotkeys,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn get_instance_arg(args: &[String]) -> Option<String> {
    for arg in args {
        if let Some(rest) = arg.strip_prefix("--instance=") {
            return Some(rest.to_string());
        }
    }
    None
}
