// src/core/bootstrap/tasks.rs
// Task management integration extracted from instance_bootstrap.rs

use crate::core::bootstrap_error::BootstrapError;
use crate::core::minecraft_instance::MinecraftInstance;
use crate::GLOBAL_APP_HANDLE;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::Emitter;

/// Represents different stages of the installation process
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum Stage {
    DownloadingFiles { current: usize, total: usize },
    ExtractingLibraries { current: usize, total: usize },
    InstallingForge,
    ValidatingAssets { current: usize, total: usize },
    DownloadingForgeLibraries { current: usize, total: usize },
    DownloadingModpackFiles { current: usize, total: usize },
    InstallingJava { progress: f32, message: String },
}

/// Emits a status update event to the frontend.
/// Uses the global `AppHandle` to send events to all windows.
///
/// # Arguments
///
/// * `instance` - The Minecraft instance being processed
/// * `event_name` - The name of the event (e.g., "instance-launch-start").
/// * `message` - A descriptive message for the frontend.
pub fn emit_status(instance: &MinecraftInstance, event_name: &str, message: &str) {
    println!(
        "[Instance: {}] Emitting Event: {} - Message: {}",
        instance.instanceId, event_name, message
    );
    if let Ok(guard) = GLOBAL_APP_HANDLE.lock() {
        if let Some(app_handle) = guard.as_ref() {
            let payload = serde_json::json!({
                "id": instance.instanceId,
                "name": instance.instanceName,
                "message": message
            });
            // Use emit to notify the specific window listening for this event
            if let Err(e) = app_handle.emit(event_name, payload) {
                log::info!("[Bootstrap] Error emitting event '{}': {}", event_name, e);
            }
        } else {
            log::info!(
                "[Bootstrap] Error: GLOBAL_APP_HANDLE is None when trying to emit '{}'.",
                event_name
            );
        }
    } else {
        eprintln!(
            "[Bootstrap] Error: Failed to lock GLOBAL_APP_HANDLE when trying to emit '{}'.",
            event_name
        );
    }
}

/// Emits a status update event with stage information to the frontend.
/// This function enhances the original emit_status to include stage data.
///
/// # Arguments
///
/// * `instance` - The Minecraft instance being processed
/// * `event_name` - The name of the event (e.g., "instance-launch-start").
/// * `stage` - The current stage information
pub fn emit_status_with_stage(instance: &MinecraftInstance, event_name: &str, stage: &Stage) {
    let message = format_stage_message(stage);

    println!(
        "[Instance: {}] Emitting Event: {} - Stage: {:?}",
        instance.instanceId, event_name, stage
    );

    if let Ok(guard) = GLOBAL_APP_HANDLE.lock() {
        if let Some(app_handle) = guard.as_ref() {
            let payload = serde_json::json!({
                "id": instance.instanceId,
                "name": instance.instanceName,
                "message": message,
                "stage": stage
            });
            // Use emit to notify the specific window listening for this event
            if let Err(e) = app_handle.emit(event_name, payload) {
                log::info!("[Bootstrap] Error emitting event '{}': {}", event_name, e);
            }
        } else {
            log::info!(
                "[Bootstrap] Error: GLOBAL_APP_HANDLE is None when trying to emit '{}'.",
                event_name
            );
        }
    } else {
        eprintln!(
            "[Bootstrap] Error: Failed to lock GLOBAL_APP_HANDLE when trying to emit '{}'.",
            event_name
        );
    }
}

/// Formats a stage into a user-friendly message according to requirements
fn format_stage_message(stage: &Stage) -> String {
    match stage {
        Stage::DownloadingFiles { current, total } => {
            let percentage = if *total > 0 {
                (*current as f32 * 100.0) / *total as f32
            } else {
                0.0
            };
            format!(
                "Descargando archivos: {}/{} ({:.1}%)",
                current, total, percentage
            )
        }
        Stage::ExtractingLibraries { current, total } => {
            let percentage = if *total > 0 {
                (*current as f32 * 100.0) / *total as f32
            } else {
                0.0
            };
            format!(
                "Extrayendo librerías: {}/{} ({:.1}%)",
                current, total, percentage
            )
        }
        Stage::InstallingForge => "Instalando Forge...".to_string(),
        Stage::ValidatingAssets { current, total } => {
            let percentage = if *total > 0 {
                (*current as f32 * 100.0) / *total as f32
            } else {
                0.0
            };
            format!(
                "Validando assets: {}/{} ({:.1}%)",
                current, total, percentage
            )
        }
        Stage::DownloadingForgeLibraries { current, total } => {
            let percentage = if *total > 0 {
                (*current as f32 * 100.0) / *total as f32
            } else {
                0.0
            };
            format!(
                "Descargando librerías de Forge: {}/{} ({:.1}%)",
                current, total, percentage
            )
        }
        Stage::DownloadingModpackFiles { current, total } => {
            let percentage = if *total > 0 {
                (*current as f32 * 100.0) / *total as f32
            } else {
                0.0
            };
            format!(
                "Descargando archivos del modpack: {}/{} ({:.1}%)",
                current, total, percentage
            )
        }
        Stage::InstallingJava { progress, message } => {
            format!("Instalando Java: {} ({:.1}%)", message, progress)
        }
    }
}

/// Convenience function to emit bootstrap start event
pub fn emit_bootstrap_start(instance: &MinecraftInstance, instance_type: &str) {
    emit_status(
        instance,
        "instance-bootstrap-start",
        &format!("Iniciando bootstrap de instancia {}", instance_type),
    );
}

/// Convenience function to emit bootstrap completion event
pub fn emit_bootstrap_complete(instance: &MinecraftInstance, instance_type: &str) {
    emit_status(
        instance,
        &format!("{}-instance-bootstrapped", instance_type.to_lowercase()),
        &format!(
            "Bootstrap de instancia {} completado para {}",
            instance_type, instance.minecraftVersion
        ),
    );
}

/// Convenience function to emit download progress events
pub fn emit_download_progress(
    instance: &MinecraftInstance,
    event_type: &str,
    current: usize,
    total: usize,
    percentage: f32,
) {
    emit_status(
        instance,
        event_type,
        &format!("Progreso: {}/{} ({:.1}%)", current, total, percentage),
    );
}

/// Emits a bootstrap error event with enhanced error information
pub fn emit_bootstrap_error(instance: &MinecraftInstance, error: &BootstrapError) {
    // Detailed logging for debugging (this won't affect user experience)
    log::error!(
        "[Instance: {}] Bootstrap error in step '{}': {}",
        instance.instanceId,
        error.step,
        error.message
    );
    
    // Log additional context for debugging
    log::debug!(
        "[Instance: {}] Bootstrap error details - Category: {:?}, Step: {:?}",
        instance.instanceId,
        error.category,
        error.step
    );
    
    if let Some(suggestion) = &error.suggestion {
        log::info!(
            "[Instance: {}] Bootstrap error suggestion: {}",
            instance.instanceId,
            suggestion
        );
    }
    
    if let Some(technical_details) = &error.technical_details {
        log::debug!(
            "[Instance: {}] Bootstrap error technical details: {}",
            instance.instanceId,
            technical_details
        );
    }

    if let Ok(guard) = GLOBAL_APP_HANDLE.lock() {
        if let Some(app_handle) = guard.as_ref() {
            let payload = serde_json::json!({
                "id": instance.instanceId,
                "name": instance.instanceName,
                "message": error.message,
                "step": error.step,
                "category": error.category,
                "suggestion": error.suggestion,
                "technical_details": error.technical_details,
                "error": error
            });

            // Emit both the specific bootstrap-error event and the general instance-error event
            if let Err(e) = app_handle.emit("bootstrap-error", payload.clone()) {
                log::error!("Error emitting bootstrap-error event: {}", e);
            }

            if let Err(e) = app_handle.emit("instance-error", payload) {
                log::error!("Error emitting instance-error event: {}", e);
            }
        } else {
            log::error!("GLOBAL_APP_HANDLE is None when trying to emit bootstrap error");
        }
    } else {
        log::error!("Failed to lock GLOBAL_APP_HANDLE when trying to emit bootstrap error");
    }
}
