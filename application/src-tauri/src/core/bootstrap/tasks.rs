// src/core/bootstrap/tasks.rs
// Task management integration extracted from instance_bootstrap.rs

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
