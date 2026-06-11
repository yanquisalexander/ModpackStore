use std::path::Path;

use crate::core::bootstrap::tasks::{emit_bootstrap_complete, emit_status};
use crate::core::minecraft_instance::MinecraftInstance;
use crate::core::tasks_manager::{add_task_with_auto_start, remove_task, update_task, TaskStatus};
use tauri::Emitter;

use super::download_manager::{
    download_modpack_files, fetch_modpack_manifest, validate_modpack_assets,
};
use super::modpack_cleanup::{audit_user_data_protection, cleanup_obsolete_files};

#[tauri::command]
pub async fn cleanup_instance_files(instance_id: String) -> Result<Vec<String>, String> {
    log::info!("[Cleanup] Starting cleanup for instance: {}", instance_id);

    let instance = MinecraftInstance::from_instance_id(&instance_id).ok_or("Instance not found")?;

    // Only cleanup modpack instances
    let modpack_id = instance
        .modpackId
        .as_ref()
        .ok_or("Instance is not a modpack instance")?;

    let version_id = instance
        .modpackVersionId
        .as_ref()
        .ok_or("Instance does not have a version ID")?;

    let minecraft_dir = Path::new(
        instance
            .instanceDirectory
            .as_ref()
            .ok_or("Instance directory not set")?,
    )
    .join("minecraft");

    // CRITICAL: Audit user data protection before cleanup operations
    log::info!("[UserDataProtection] Performing pre-operation audit for modpack cleanup");
    match audit_user_data_protection(&minecraft_dir, "Modpack Cleanup") {
        Ok(audit_report) => {
            log::info!("[UserDataProtection] Pre-cleanup audit completed successfully");
            log::info!(
                "[UserDataProtection] {} files and {} directories are protected",
                audit_report.protected_files.len(),
                audit_report.protected_directories.len()
            );

            // Log the audit summary for transparency
            let summary = audit_report.generate_summary();
            log::info!("[UserDataProtection] Audit Summary:\n{}", summary);
        }
        Err(e) => {
            log::error!("[UserDataProtection] Pre-cleanup audit failed: {}", e);
            return Err(format!(
                "User data protection audit failed before cleanup: {}",
                e
            ));
        }
    }

    log::info!(
        "[Cleanup] Fetching manifest for modpack {} version {}",
        modpack_id,
        version_id
    );

    // Fetch current manifest
    let target = if instance.is_server() {
        "server"
    } else {
        "client"
    };
    let manifest = fetch_modpack_manifest(modpack_id, version_id, Some(target)).await?;

    log::info!("[Cleanup] Starting safe cleanup process");

    // Cleanup obsolete files using improved method
    let removed_files = cleanup_obsolete_files(&instance, &manifest)?;

    log::info!(
        "[Cleanup] Cleanup completed successfully, {} files removed",
        removed_files.len()
    );

    Ok(removed_files)
}

#[tauri::command]
pub async fn validate_and_download_modpack_assets(instance_id: String) -> Result<usize, String> {
    let instance = MinecraftInstance::from_instance_id(&instance_id).ok_or("Instance not found")?;

    // Only process modpack instances
    let modpack_id = instance
        .modpackId
        .as_ref()
        .ok_or("Instance is not a modpack instance")?;

    let version_id = instance
        .modpackVersionId
        .as_ref()
        .ok_or("Instance does not have a version ID")?;

    let minecraft_dir = Path::new(
        instance
            .instanceDirectory
            .as_ref()
            .ok_or("Instance directory not set")?,
    )
    .join("minecraft");

    // CRITICAL: Audit user data protection before any modpack operations
    log::info!("[UserDataProtection] Performing pre-operation audit for modpack asset validation");
    match audit_user_data_protection(&minecraft_dir, "Modpack Asset Validation") {
        Ok(audit_report) => {
            log::info!("[UserDataProtection] Audit completed successfully");
            log::info!(
                "[UserDataProtection] Protected files: {}",
                audit_report.protected_files.len()
            );
            log::info!(
                "[UserDataProtection] Protected directories: {}",
                audit_report.protected_directories.len()
            );

            if !audit_report.warnings.is_empty() {
                log::warn!(
                    "[UserDataProtection] {} warnings in audit - proceeding with caution",
                    audit_report.warnings.len()
                );
                for warning in &audit_report.warnings {
                    log::warn!("[UserDataProtection] {}", warning);
                }
            }
        }
        Err(e) => {
            log::error!("[UserDataProtection] Audit failed: {}", e);
            return Err(format!("User data protection audit failed: {}", e));
        }
    }

    // Create a task for this operation with proper title
    let task_title = format!(
        "Validación de assets - {}",
        if instance.instanceName.is_empty() {
            "Modpack"
        } else {
            instance.instanceName.as_str()
        }
    );

    let task_id = add_task_with_auto_start(
        &task_title,
        Some(serde_json::json!({
            "status": "Validando assets del modpack",
            "progress": 0.0,
            "message": "Iniciando validación...",
            "instanceId": instance_id.clone()
        })),
    );

    // Update task status to Running to prevent it from staying in Pending
    update_task(
        &task_id,
        TaskStatus::Running,
        0.0,
        "Iniciando validación de assets...",
        None,
    );

    // Fetch current manifest
    let target = if instance.is_server() {
        "server"
    } else {
        "client"
    };
    let manifest = match fetch_modpack_manifest(modpack_id, version_id, Some(target)).await {
        Ok(manifest) => manifest,
        Err(e) => {
            update_task(
                &task_id,
                TaskStatus::Failed,
                0.0,
                &format!("Error obteniendo manifest: {}", e),
                None,
            );

            // Schedule task removal after a delay on failure
            let task_id_for_cleanup = task_id.clone();
            tokio::spawn(async move {
                tokio::time::sleep(tokio::time::Duration::from_secs(3)).await;
                remove_task(&task_id_for_cleanup);
                log::info!(
                    "Cleaned up failed modpack validation task (manifest error): {}",
                    task_id_for_cleanup
                );
            });

            log::warn!("No se pudo obtener el manifest (offline o error de red): {}. Permitimos continuar el lanzamiento sin validación de assets.", e);
            return Ok(0);
        }
    };

    // FIRST: Clean up obsolete files before validation and download
    update_task(
        &task_id,
        TaskStatus::Running,
        10.0,
        "Limpiando archivos obsoletos...",
        None,
    );

    let removed_files = cleanup_obsolete_files(&instance, &manifest)?;
    log::info!(
        "Cleaned up {} obsolete files before validation",
        removed_files.len()
    );

    // Emit event to indicate we're downloading modpack assets
    if let Ok(guard) = crate::GLOBAL_APP_HANDLE.lock() {
        if let Some(app_handle) = guard.as_ref() {
            let _ = app_handle.emit(
                &format!("instance-{}", instance_id),
                serde_json::json!({
                    "id": instance_id,
                    "status": "downloading-assets",
                    "message": "Validando assets del modpack..."
                }),
            );
        }
    }

    // Validate assets and get files that need downloading
    update_task(
        &task_id,
        TaskStatus::Running,
        30.0,
        "Validando integridad de archivos...",
        None,
    );

    let files_to_download =
        match validate_modpack_assets(&instance, &manifest, Some(task_id.clone())).await {
            Ok(files) => files,
            Err(e) => {
                update_task(
                    &task_id,
                    TaskStatus::Failed,
                    0.0,
                    &format!("Error validando assets: {}", e),
                    None,
                );

                // Schedule task removal after a delay even on failure
                let task_id_for_cleanup = task_id.clone();
                tokio::spawn(async move {
                    tokio::time::sleep(tokio::time::Duration::from_secs(3)).await;
                    remove_task(&task_id_for_cleanup);
                    log::info!(
                        "Cleaned up failed modpack validation task: {}",
                        task_id_for_cleanup
                    );
                });

                return Err(e);
            }
        };

    if files_to_download.is_empty() {
        update_task(
            &task_id,
            TaskStatus::Completed,
            100.0,
            "Todos los assets están actualizados",
            None,
        );

        // Schedule task removal after a delay to allow UI to show completion
        let task_id_for_cleanup = task_id.clone();
        tokio::spawn(async move {
            tokio::time::sleep(tokio::time::Duration::from_secs(3)).await;
            remove_task(&task_id_for_cleanup);
            log::info!(
                "Cleaned up completed modpack validation task (no downloads needed): {}",
                task_id_for_cleanup
            );
        });

        return Ok(0);
    }

    // Download missing/corrupt files
    update_task(
        &task_id,
        TaskStatus::Running,
        0.0,
        &format!("Descargando {} archivos...", files_to_download.len()),
        None,
    );

    let downloaded_count =
        download_modpack_files(&instance, &files_to_download, Some(task_id.clone())).await?;

    emit_bootstrap_complete(&instance, "forge");

    // Notify frontend that assets download finished so listeners can clear stages
    emit_status(
        &instance,
        "instance-finish-assets-download",
        &format!("Descargados {} archivos", downloaded_count),
    );

    update_task(
        &task_id,
        TaskStatus::Completed,
        100.0,
        &format!("Descargados {} archivos", downloaded_count),
        None,
    );

    // Schedule task removal after a delay to allow UI to show completion
    let task_id_for_cleanup = task_id.clone();
    tokio::spawn(async move {
        tokio::time::sleep(tokio::time::Duration::from_secs(3)).await;
        remove_task(&task_id_for_cleanup);
        log::info!(
            "Cleaned up completed modpack validation task: {}",
            task_id_for_cleanup
        );
    });

    Ok(downloaded_count)
}
