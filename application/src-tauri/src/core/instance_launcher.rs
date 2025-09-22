//! Handles the logic for preparing and launching a specific Minecraft instance.

// --- Standard Library Imports ---
use std::fs;
use std::io::{Error as IoError, ErrorKind as IoErrorKind};
use std::path::PathBuf;
use std::process::{Child, Command};
use std::sync::Arc;
use std::thread;

// --- Crate Imports ---
use crate::core::instance_bootstrap::InstanceBootstrap;
use crate::core::minecraft::MinecraftLauncher as CoreMinecraftLauncher;
use crate::core::minecraft_instance::MinecraftInstance;
use crate::core::network_utilities;
use crate::interfaces::game_launcher::GameLauncher;
use crate::utils::config_manager::get_config_manager;
use crate::GLOBAL_APP_HANDLE;

// --- External Crates ---
use lazy_static::lazy_static;
use log::{error, info, warn};
use regex::Regex;
use serde_json::{json, Value};
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

    #[error("The Minecraft launcher failed to start the process.")]
    ProcessStartFailed,
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

lazy_static! {
    // Regex to capture Java version mismatch details from stderr
    static ref RE_JAVA_VERSION: Regex = Regex::new(r"class file version (\d+\.\d+).*, this version of the Java Runtime only recognizes class file versions up to (\d+\.\d+)").unwrap();
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
    fn monitor_process(instance: Arc<MinecraftInstance>, mut child: Child) {
        let emitter_launcher = Self {
            instance: Arc::clone(&instance),
        };

        thread::spawn(move || {
            info!(
                "[Monitor: {}] Started monitoring process.",
                instance.instanceId
            );

            match child.wait_with_output() {
                Ok(output) => {
                    let exit_code = output.status.code().unwrap_or(-1);
                    let stdout = String::from_utf8_lossy(&output.stdout);
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    let official_exit_code: OfficialExitCode = exit_code.into();

                    info!("[Minecraft:{} stdout]\n{}", instance.instanceId, stdout);
                    if !stderr.is_empty() {
                        error!("[Minecraft:{} stderr]\n{}", instance.instanceId, stderr);
                    }

                    let mut crash_report_content: Option<String> = None;
                    let mut detected_error_details = json!({ "code": "UNKNOWN_ERROR" });

                    // Only search for crash reports and analyze stderr if the game exited with an error
                    if exit_code != 0 {
                        // --- 1. The Holy Grail: Search for a crash report file ---
                        let crash_report_dir =
                            PathBuf::from(&instance.minecraftPath).join("crash-reports");
                        if crash_report_dir.exists() {
                            if let Ok(mut entries) = fs::read_dir(crash_report_dir) {
                                let latest_report = entries
                                    .filter_map(Result::ok)
                                    .map(|e| e.path())
                                    .filter(|p| {
                                        p.is_file()
                                            && p.extension().map_or(false, |ext| ext == "txt")
                                    })
                                    .max(); // Filename timestamp ensures max() gets the latest

                                if let Some(report_path) = latest_report {
                                    info!(
                                        "[Monitor: {}] Found crash report: {:?}",
                                        instance.instanceId, report_path
                                    );
                                    crash_report_content = fs::read_to_string(report_path).ok();
                                }
                            }
                        }

                        // --- 2. Advanced stderr analysis with Regex ---
                        if let Some(captures) = RE_JAVA_VERSION.captures(&stderr) {
                            let expected_ver = captures.get(1).map_or("?", |m| m.as_str());
                            let actual_ver = captures.get(2).map_or("?", |m| m.as_str());
                            detected_error_details = json!({
                                "code": "INCOMPATIBLE_JAVA_VERSION",
                                "message": format!("Java version mismatch. Game requires Java {}, but launcher is using Java {}.", expected_ver, actual_ver),
                            });
                        } else if stderr.contains("java.lang.OutOfMemoryError") {
                            detected_error_details = json!({
                                "code": "OUT_OF_MEMORY",
                                "message": "The game ran out of memory. Try allocating more RAM to the instance."
                            });
                        }
                    }

                    let message = format!(
                        "Minecraft instance '{}' exited with code {} ({:?})",
                        instance.instanceName, exit_code, official_exit_code
                    );
                    emitter_launcher.emit_status(
                        EVENT_EXITED,
                        &message,
                        Some(json!({
                            "exitCode": exit_code,
                            "officialExitCode": format!("{:?}", official_exit_code),
                            "detectedError": detected_error_details, // Detailed error object
                            "crashReport": crash_report_content, // Full crash report text
                            "stdout": stdout.trim_end(),
                            "stderr": stderr.trim_end(),
                        })),
                    );
                }
                Err(err) => {
                    let error_msg = format!("Failed to wait for process: {}", err);
                    error!("[Monitor: {}] {}", instance.instanceId, error_msg);
                    emitter_launcher.emit_error(&error_msg, None);
                }
            }

            info!("[Monitor: {}] Finished monitoring.", instance.instanceId);
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
                .ok_or(LaunchError::ProcessStartFailed)
        })();

        match launch_result {
            Ok(child_process) => {
                info!(
                    "[Launch Thread: {}] Minecraft process started (PID: {}).",
                    self.instance.instanceId,
                    child_process.id()
                );
                self.emit_status(EVENT_LAUNCHED, "Minecraft se está ejecutando.", None);
                Self::monitor_process(Arc::clone(&self.instance), child_process);

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
        let close_on_launch = get_config_manager()
            .lock()
            .expect("Failed to lock config manager")
            .get_close_on_launch();
        if !close_on_launch {
            return;
        }

        info!(
            "[Launch Thread: {}] Closing launcher as configured.",
            self.instance.instanceId
        );
        thread::sleep(std::time::Duration::from_secs(5)); // Give MC time to load

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
        info!(
            "[Main Thread] Spawning launch thread for instance: {}",
            instance_arc_clone.instanceId
        );

        thread::spawn(move || {
            let thread_launcher = Self {
                instance: instance_arc_clone,
            };
            thread_launcher.perform_launch_steps();
        });
    }
}
