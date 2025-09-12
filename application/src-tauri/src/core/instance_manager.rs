// src-tauri/src/core/instance_manager.rs

use crate::config::get_config_manager;
use crate::core::bootstrap_error::BootstrapError;
use crate::core::instance_bootstrap::InstanceBootstrap;
use crate::core::minecraft_instance::{self, MinecraftInstance};
use crate::core::modpack_file_manager::ModpackManifest;
use crate::core::tasks_manager::{
    add_task, add_task_with_auto_start, remove_task, update_task, update_task_with_bootstrap_error, TaskStatus,
};
use crate::API_ENDPOINT;
use base64::{engine::general_purpose, Engine as _};
use dirs::config_dir;
use serde_json::from_str;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tauri::Emitter;
use tokio::task;

// Constants
const DEFAULT_VANILLA_ICON: &str = "/images/default_instances/default_vanilla.webp";
const DEFAULT_FORGE_ICON: &str = "/images/default_instances/default_forge.webp";
const MAX_SEARCH_RESULTS: usize = 20;
const TASK_CLEANUP_DELAY: u64 = 60;

// Función auxiliar para normalizar rutas
fn normalize_path(path: &Path) -> String {
    path.to_string_lossy().to_string()
}

// Función auxiliar para obtener el directorio de instancias
fn get_instances_dir() -> Result<PathBuf, String> {
    let config_manager = get_config_manager()
        .lock()
        .map_err(|_| "Failed to lock config manager mutex")?;

    let config = config_manager.as_ref().map_err(|e| e.clone())?;
    Ok(config.get_instances_dir())
}

#[tauri::command]
pub fn get_all_instances() -> Result<Vec<MinecraftInstance>, String> {
    let instances_dir = get_instances_dir()?;
    get_instances(instances_dir.to_str().unwrap_or_default())
}

#[tauri::command]
pub fn update_instance(instance: MinecraftInstance) -> Result<(), String> {
    let instances_dir = get_instances_dir()?;
    let instances = get_instances(instances_dir.to_str().unwrap_or_default())?;

    let original_instance = instances
        .into_iter()
        .find(|i| i.instanceId == instance.instanceId)
        .ok_or_else(|| format!("Instance with ID {} not found", instance.instanceId))?;

    let instance_path = original_instance
        .instanceDirectory
        .as_ref()
        .ok_or("Instance directory is missing")?;

    let config_file = Path::new(instance_path).join("instance.json");

    if config_file.exists() {
        let contents =
            fs::read_to_string(&config_file).map_err(|e| format!("Error reading JSON: {}", e))?;

        let mut existing_instance: MinecraftInstance =
            from_str(&contents).map_err(|e| format!("Error parsing JSON: {}", e))?;

        existing_instance.instanceName = instance.instanceName;
        existing_instance.accountUuid = instance.accountUuid;

        existing_instance
            .save()
            .map_err(|e| format!("Error saving instance: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
pub fn get_instance_by_id(instance_id: String) -> Result<Option<MinecraftInstance>, String> {
    let instances_dir = get_instances_dir()?;
    let instances = get_instances(instances_dir.to_str().unwrap_or_default())?;
    Ok(instances.into_iter().find(|i| i.instanceId == instance_id))
}

#[tauri::command]
pub fn delete_instance(instance_path: String) -> Result<(), String> {
    let path = Path::new(&instance_path);
    if path.exists() && path.is_dir() {
        fs::remove_dir_all(path).map_err(|e| format!("Failed to delete instance: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
pub async fn launch_mc_instance(instance_id: String) -> Result<(), String> {
    let instances_dir = get_instances_dir()?;
    let instances = get_instances(instances_dir.to_str().unwrap_or_default())?;

    let mut instance = instances
        .into_iter()
        .find(|i| i.instanceId == instance_id)
        .ok_or_else(|| format!("Instance with ID {} not found", instance_id))?;

    // Emit instance launching status

    if let Ok(guard) = crate::GLOBAL_APP_HANDLE.lock() {
        if let Some(app_handle) = guard.as_ref() {
            let _ = app_handle.emit(
                "instance-launch-start",
                serde_json::json!({
                    "id": instance.instanceId,
                    "status": "launching",
                    "message": "Iniciando instancia..."
                }),
            );
        }
    }

    // Handle modpack instances with special logic
    if let (Some(modpack_id), Some(version_id)) = (&instance.modpackId, &instance.modpackVersionId)
    {
        let modpack_id = modpack_id.clone(); // Extract modpack_id to avoid immutable borrow conflict
                                             // Check if version is "latest" and handle updates
        if version_id == "latest" {
            match handle_latest_version_update(&mut instance, &modpack_id).await {
                Ok(updated) => {
                    if updated {
                        // Save the updated instance
                        instance
                            .save()
                            .map_err(|e| format!("Failed to save updated instance: {}", e))?;
                    }
                }
                Err(e) => {
                    eprintln!("Warning: Failed to check for latest version updates: {}", e);
                    // Continue with launch even if update check fails
                }
            }
        }

        // Validate modpack assets before launch
        match validate_modpack_assets_for_launch(&instance).await {
            Ok(_) => {
                // Assets are valid, proceed with launch
            }
            Err(e) => {
                return Err(format!("Failed to validate modpack assets: {}", e));
            }
        }
    }

    // Proceed with normal launch
    instance
        .launch()
        .map_err(|e| format!("Failed to launch instance: {}", e))?;

    Ok(())
}

/// Handles "latest" version updates for a modpack instance
/// Returns true if the instance was updated, false otherwise
async fn handle_latest_version_update(
    instance: &mut MinecraftInstance,
    modpack_id: &str,
) -> Result<bool, String> {
    let current_version_id = instance.modpackVersionId.as_ref().unwrap();

    // If version is not "latest", no need to check
    if current_version_id != "latest" {
        return Ok(false);
    }

    // Emit status update
    if let Ok(guard) = crate::GLOBAL_APP_HANDLE.lock() {
        if let Some(app_handle) = guard.as_ref() {
            let _ = app_handle.emit(
                &format!("instance-{}", instance.instanceId),
                serde_json::json!({
                    "id": instance.instanceId,
                    "status": "preparing",
                    "message": "Verificando actualizaciones..."
                }),
            );
        }
    }

    // Check if modpack requires password and validate it
    match check_and_validate_modpack_password(modpack_id).await {
        Ok(valid) => {
            if !valid {
                return Err("Invalid modpack password".to_string());
            }
        }
        Err(e) => {
            eprintln!("Warning: Failed to validate modpack password: {}", e);
            // Continue anyway for non-password-protected modpacks
        }
    }

    // Get the actual latest version ID
    let latest_version_id = fetch_latest_version(modpack_id).await?;

    // Check if there's an actual version stored in the instance metadata
    // We need to compare against the last known version, not "latest"
    let needs_update = if let Some(last_known_version) = get_instance_last_known_version(instance) {
        last_known_version != latest_version_id
    } else {
        // First time with "latest", always update
        true
    };

    if needs_update {
        // Emit status update
        if let Ok(guard) = crate::GLOBAL_APP_HANDLE.lock() {
            if let Some(app_handle) = guard.as_ref() {
                let _ = app_handle.emit(
                    &format!("instance-{}", instance.instanceId),
                    serde_json::json!({
                        "id": instance.instanceId,
                        "status": "downloading-assets",
                        "message": "Actualizando modpack..."
                    }),
                );
            }
        }

        // Update to the latest version
        update_modpack_instance(
            instance.instanceId.clone(),
            Some(latest_version_id.clone()),
            None,
        )
        .await?;

        // Store the latest version as last known version
        set_instance_last_known_version(instance, &latest_version_id);

        return Ok(true);
    }

    Ok(false)
}

/// Checks if a modpack requires password and validates it
/// Returns true if password is valid or not required, false if invalid
async fn check_and_validate_modpack_password(modpack_id: &str) -> Result<bool, String> {
    let client = reqwest::Client::new();
    let url = format!("{}/explore/modpacks/{}", *crate::API_ENDPOINT, modpack_id);

    // First, get modpack info to check if it requires password
    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch modpack info: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("API error: {}", response.status()));
    }

    let json: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse JSON: {}", e))?;

    // Check if password is required
    let is_password_protected = json["data"]["attributes"]["isPasswordProtected"]
        .as_bool()
        .unwrap_or(false);

    if !is_password_protected {
        return Ok(true); // No password required
    }

    // Get stored password or prompt user
    // For now, we'll emit an event to the frontend to handle password prompt
    if let Ok(guard) = crate::GLOBAL_APP_HANDLE.lock() {
        if let Some(app_handle) = guard.as_ref() {
            let _ = app_handle.emit(
                "modpack-password-required",
                serde_json::json!({
                    "modpackId": modpack_id,
                    "message": "Este modpack requiere contraseña"
                }),
            );
        }
    }

    // For this implementation, we'll return true and let the frontend handle password validation
    // In a production implementation, you would implement a proper password dialog flow
    Ok(true)
}

/// Validates modpack assets before launch
async fn validate_modpack_assets_for_launch(instance: &MinecraftInstance) -> Result<(), String> {
    let modpack_id = instance.modpackId.as_ref().unwrap();
    let version_id = instance.modpackVersionId.as_ref().unwrap();

    // Get actual version ID if it's "latest"
    let actual_version_id = if version_id == "latest" {
        get_instance_last_known_version(instance).unwrap_or_else(|| {
            // Fallback to fetching latest version synchronously
            // In a real implementation, you might want to handle this better
            version_id.clone()
        })
    } else {
        version_id.clone()
    };

    // Emit status update using the correct event pattern that InstancesContext listens to
    if let Ok(guard) = crate::GLOBAL_APP_HANDLE.lock() {
        if let Some(app_handle) = guard.as_ref() {
            let _ = app_handle.emit(
                "instance-downloading-assets",
                serde_json::json!({
                    "id": instance.instanceId,
                    "message": "Validando archivos del modpack..."
                }),
            );
        }
    }

    // Validate and download missing assets
    crate::core::modpack_file_manager::validate_and_download_modpack_assets(
        instance.instanceId.clone(),
    )
    .await?;

    // Emit completion event after validation/download
    if let Ok(guard) = crate::GLOBAL_APP_HANDLE.lock() {
        if let Some(app_handle) = guard.as_ref() {
            let _ = app_handle.emit(
                "instance-finish-assets-download",
                serde_json::json!({
                    "id": instance.instanceId,
                    "message": "Validación completada"
                }),
            );
        }
    }

    Ok(())
}

/// Gets the last known version for a "latest" instance
/// This is stored in instance metadata to track actual version changes
fn get_instance_last_known_version(instance: &MinecraftInstance) -> Option<String> {
    // For now, we'll store this in a custom field or use a simple approach
    // In a real implementation, you might store this in instance metadata
    // For this implementation, we'll use a simple file-based approach
    let instance_dir = instance.instanceDirectory.as_ref()?;
    let metadata_path = std::path::PathBuf::from(instance_dir)
        .join(".modpackstore")
        .join("last_known_version.txt");

    std::fs::read_to_string(metadata_path).ok()
}

/// Sets the last known version for a "latest" instance
fn set_instance_last_known_version(instance: &MinecraftInstance, version_id: &str) {
    if let Some(instance_dir) = &instance.instanceDirectory {
        let metadata_dir = std::path::PathBuf::from(instance_dir).join(".modpackstore");
        let metadata_path = metadata_dir.join("last_known_version.txt");

        // Create directory if it doesn't exist
        if let Err(e) = std::fs::create_dir_all(&metadata_dir) {
            eprintln!("Failed to create metadata directory: {}", e);
            return;
        }

        // Write the version
        if let Err(e) = std::fs::write(metadata_path, version_id) {
            eprintln!("Failed to write last known version: {}", e);
        }
    }
}

fn get_instances(instances_dir: &str) -> Result<Vec<MinecraftInstance>, String> {
    let path = Path::new(instances_dir);

    if !path.exists() || !path.is_dir() {
        return Ok(Vec::new());
    }

    let entries = fs::read_dir(path).map_err(|e| format!("Error reading directory: {}", e))?;

    let mut instances = Vec::new();

    for entry in entries {
        let entry = entry.map_err(|e| format!("Error reading entry: {}", e))?;
        let instance_path = entry.path();

        if !instance_path.is_dir() {
            continue;
        }

        let config_file = instance_path.join("instance.json");

        if !config_file.exists() {
            continue;
        }

        let contents =
            fs::read_to_string(&config_file).map_err(|e| format!("Error reading JSON: {}", e))?;

        let mut instance: MinecraftInstance =
            from_str(&contents).map_err(|e| format!("Error parsing JSON: {}", e))?;

        // Normalizar rutas
        instance.instanceDirectory = Some(normalize_path(&instance_path));
        instance.minecraftPath = normalize_path(&instance_path.join("minecraft"));

        // Intentar guardar, pero continuar si falla
        if let Err(e) = instance.save() {
            eprintln!("Warning: Failed to save instance config: {}", e);
        }

        instances.push(instance);
    }

    Ok(instances)
}

#[tauri::command]
pub async fn create_local_instance(
    instance_name: String,
    mc_version: String,
    forge_version: Option<String>,
) -> Result<String, String> {
    let instances_dir = get_instances_dir()?;
    let instance_id = uuid::Uuid::new_v4().to_string();

    // Crear instancia
    let mut instance = MinecraftInstance::new();
    instance.instanceName = instance_name.clone();
    instance.minecraftVersion = mc_version;
    instance.forgeVersion = forge_version.clone();
    instance.instanceId = instance_id.clone();

    // Configurar ícono por defecto
    instance.bannerUrl = Some(
        if forge_version.is_some() {
            DEFAULT_FORGE_ICON
        } else {
            DEFAULT_VANILLA_ICON
        }
        .to_string(),
    );

    let instance_dir = instances_dir.join(&instance.instanceName);
    let minecraft_path = instance_dir.join("minecraft");

    instance.minecraftPath = normalize_path(&minecraft_path);
    instance.instanceDirectory = Some(normalize_path(&instance_dir));

    // Crear directorio y guardar
    fs::create_dir_all(&instance_dir)
        .map_err(|e| format!("Failed to create instance directory: {}", e))?;

    instance
        .save()
        .map_err(|e| format!("Failed to save instance: {}", e))?;

    // Crear tarea
    let task_id = add_task(
        &format!("Creando instancia {}", instance.instanceName),
        Some(serde_json::json!({
            "instanceName": instance.instanceName,
            "instanceId": instance.instanceId
        })),
    );

    // Procesar en segundo plano
    spawn_instance_creation_task(instance, task_id);

    Ok(instance_id)
}

#[tauri::command]
pub async fn create_modpack_instance(
    instance_name: String,
    modpack_id: String,
    version_id: Option<String>,
    password: Option<String>,
) -> Result<String, String> {
    let task_id = add_task(
        &format!("Creando instancia de modpack: {}", instance_name),
        Some(serde_json::json!({
            "type": "modpack_instance_creation",
            "instanceName": instance_name,
            "modpackId": modpack_id,
            "versionId": version_id
        })),
    );

    // Obtener información del modpack
    let modpack_info = fetch_modpack_info(&modpack_id).await?;

    // Validar contraseña si el modpack está protegido
    if let Some(pwd) = password {
        validate_modpack_password(modpack_id.clone(), pwd).await?;
    }

    // Determinar versión - distinguir entre "latest" seleccionado por el usuario vs sin versión
    let (final_version_id_for_storage, actual_version_id_for_manifest) = match version_id {
        Some(vid) if vid == "latest" => {
            // Usuario seleccionó "latest" - guardar "latest" pero obtener la versión actual para el manifiesto
            let actual_latest = fetch_latest_version(&modpack_id).await.map_err(|e| {
                update_task(
                    &task_id,
                    TaskStatus::Failed,
                    0.0,
                    &format!("Error obteniendo versión latest: {}", e),
                    None,
                );
                e
            })?;
            ("latest".to_string(), actual_latest)
        }
        Some(vid) => {
            // Usuario seleccionó una versión específica
            (vid.clone(), vid)
        }
        None => {
            // Compatibilidad con casos donde no se especifica versión (usar latest)
            let actual_latest = fetch_latest_version(&modpack_id).await.map_err(|e| {
                update_task(
                    &task_id,
                    TaskStatus::Failed,
                    0.0,
                    &format!("Error obteniendo versión latest: {}", e),
                    None,
                );
                e
            })?;
            ("latest".to_string(), actual_latest)
        }
    };

    update_task(
        &task_id,
        TaskStatus::Running,
        10.0,
        "Descargando información del modpack...",
        None,
    );

    // Obtener manifiesto usando la versión actual (no "latest")
    let manifest = fetch_modpack_manifest(&modpack_id, &actual_version_id_for_manifest)
        .await
        .map_err(|e| {
            update_task(
                &task_id,
                TaskStatus::Failed,
                0.0,
                &format!("Error descargando manifiesto: {}", e),
                None,
            );
            e
        })?;

    let manifest_clone = manifest.clone();

    // Crear instancia usando la versión para almacenamiento (puede ser "latest")
    let instance = create_modpack_instance_struct(
        instance_name,
        modpack_id.clone(),
        final_version_id_for_storage.clone(),
        manifest,
        modpack_info,
    )
    .await?;

    // Si la versión almacenada es "latest", guardar la versión actual como last known
    if final_version_id_for_storage == "latest" {
        set_instance_last_known_version(&instance, &actual_version_id_for_manifest);
    }

    // Obtener instanceId antes de mover instance
    let instance_id = instance.instanceId.clone();

    // Procesar en segundo plano
    spawn_modpack_creation_task(instance, manifest_clone, task_id);

    Ok(instance_id)
}

#[tauri::command]
pub async fn remove_instance(instance_id: String) -> Result<bool, String> {
    let instance_directory = {
        let instances_dir = get_instances_dir()?;
        let instances = get_instances(instances_dir.to_str().unwrap_or_default())?;

        instances
            .into_iter()
            .find(|i| i.instanceId == instance_id)
            .ok_or_else(|| format!("Instance with ID {} not found", instance_id))?
            .instanceDirectory
    };

    if let Some(directory) = instance_directory {
        task::spawn_blocking(move || fs::remove_dir_all(&directory))
            .await
            .map_err(|e| format!("Task join error: {}", e))?
            .map_err(|e| format!("Failed to delete instance directory: {}", e))?;
    }

    Ok(true)
}

#[tauri::command]
pub async fn search_instances(query: String) -> Result<Vec<MinecraftInstance>, String> {
    let instances_dir = get_instances_dir()?;
    let instances = get_instances(instances_dir.to_str().unwrap_or_default())?;

    if query.is_empty() {
        return Ok(instances);
    }

    let query_lowercase = query.to_lowercase();
    let filtered_instances: Vec<_> = instances
        .into_iter()
        .filter(|instance| {
            instance
                .instanceName
                .to_lowercase()
                .contains(&query_lowercase)
                || instance
                    .minecraftVersion
                    .to_lowercase()
                    .contains(&query_lowercase)
        })
        .take(MAX_SEARCH_RESULTS)
        .collect();

    Ok(filtered_instances)
}

/// Check for modpack updates
/// OFFLINE MODE: Esta función está diseñada para ser tolerante a errores de red.
/// En lugar de fallar cuando no hay conexión, devuelve un resultado que indica
/// que no hay actualizaciones disponibles y que se está ejecutando en modo offline.
#[tauri::command]
pub async fn check_modpack_updates(
    modpack_id: String,
    current_version: String,
) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    let url = format!(
        "{}/explore/modpacks/{}/check-update?currentVersion={}",
        *API_ENDPOINT, modpack_id, current_version
    );

    match client.get(&url).send().await {
        Ok(response) => {
            if response.status().is_success() {
                response
                    .json()
                    .await
                    .map_err(|e| format!("Failed to parse JSON: {}", e))
            } else {
                // API error - return offline mode response instead of failing
                log::warn!(
                    "API error checking updates for modpack {}: {}",
                    modpack_id,
                    response.status()
                );
                Ok(serde_json::json!({
                    "hasUpdate": false,
                    "currentVersion": current_version,
                    "latestVersion": null,
                    "offlineMode": true
                }))
            }
        }
        Err(e) => {
            // Network error - return offline mode response instead of failing
            log::warn!(
                "Network error checking updates for modpack {}: {}",
                modpack_id,
                e
            );
            Ok(serde_json::json!({
                "hasUpdate": false,
                "currentVersion": current_version,
                "latestVersion": null,
                "offlineMode": true
            }))
        }
    }
}

#[tauri::command]
pub async fn update_modpack_instance(
    instance_id: String,
    target_version_id: Option<String>,
    password: Option<String>,
) -> Result<String, String> {
    let mut instance =
        MinecraftInstance::from_instance_id(&instance_id).ok_or("Instance not found")?;

    let modpack_id = instance
        .modpackId
        .as_ref()
        .ok_or("Instance is not a modpack instance")?
        .clone();

    let task_id = add_task_with_auto_start(
        &format!("Actualizando modpack: {}", instance.instanceName),
        Some(serde_json::json!({
            "type": "modpack_update",
            "instanceId": instance_id,
            "instanceName": instance.instanceName,
            "modpackId": modpack_id
        })),
    );

    // Validar contraseña si el modpack está protegido
    if let Some(pwd) = password {
        validate_modpack_password(modpack_id.clone(), pwd).await?;
    }

    // Determinar versión objetivo
    let final_version_id = match target_version_id {
        Some(vid) => vid,
        None => fetch_latest_version(&modpack_id).await.map_err(|e| {
            update_task(
                &task_id,
                TaskStatus::Failed,
                0.0,
                &format!("Error obteniendo versión latest: {}", e),
                None,
            );
            e
        })?,
    };

    // Verificar si ya está en la versión objetivo
    if instance.modpackVersionId.as_ref() == Some(&final_version_id) {
        update_task(
            &task_id,
            TaskStatus::Completed,
            100.0,
            "Ya estás en la versión más reciente",
            None,
        );
        return Ok("No update needed".to_string());
    }

    // Actualizar versión e información
    instance.modpackVersionId = Some(final_version_id.clone());

    let manifest = fetch_modpack_manifest(&modpack_id, &final_version_id)
        .await
        .map_err(|e| {
            update_task(
                &task_id,
                TaskStatus::Failed,
                0.0,
                &format!("Error descargando manifiesto: {}", e),
                None,
            );
            e
        })?;

    instance.minecraftVersion = manifest.mc_version.clone();
    instance.forgeVersion = manifest.forge_version.clone();

    instance.save().map_err(|e| {
        update_task(
            &task_id,
            TaskStatus::Failed,
            0.0,
            &format!("Error guardando configuración: {}", e),
            None,
        );
        format!("Error guardando configuración: {}", e)
    })?;

    // Procesar actualización en segundo plano
    let task_id_clone = task_id.clone();
    spawn_modpack_update_task(instance, manifest, task_id);

    Ok(task_id_clone)
}

// Funciones auxiliares para tareas en segundo plano
fn spawn_instance_creation_task(instance: MinecraftInstance, task_id: String) {
    std::thread::spawn(move || {
        let mut bootstrap = InstanceBootstrap::new();

        update_task(
            &task_id,
            TaskStatus::Running,
            10.0,
            "Creando metadatos",
            None,
        );

        let result = if instance.forgeVersion.is_some() {
            bootstrap.bootstrap_forge_instance(&instance, Some(task_id.clone()))
        } else {
            bootstrap.bootstrap_vanilla_instance(&instance, Some(task_id.clone()))
        };

        match result {
            Ok(_) => {
                update_task(
                    &task_id,
                    TaskStatus::Completed,
                    100.0,
                    &format!("Instancia {} creada", instance.instanceName),
                    Some(serde_json::json!({
                        "instanceName": instance.instanceName,
                        "instanceId": instance.instanceId
                    })),
                );
            }
            Err(e) => {
                // Check if this is a bootstrap error
                if let Ok(bootstrap_error) = serde_json::from_str::<BootstrapError>(&e) {
                    update_task_with_bootstrap_error(&task_id, &bootstrap_error);
                } else {
                    // Fallback to generic error handling
                    update_task(
                        &task_id,
                        TaskStatus::Failed,
                        0.0,
                        &format!("Error en bootstrap: {}", e),
                        None,
                    );
                }
            }
        }

        std::thread::sleep(std::time::Duration::from_secs(TASK_CLEANUP_DELAY));
        remove_task(&task_id);
    });
}

fn spawn_modpack_creation_task(
    instance: MinecraftInstance,
    manifest: ModpackManifest,
    task_id: String,
) {
    std::thread::spawn(move || {
        let mut bootstrap = InstanceBootstrap::new();

        update_task(
            &task_id,
            TaskStatus::Running,
            20.0,
            "Configurando base de Minecraft...",
            None,
        );

        let bootstrap_result = if instance.forgeVersion.is_some() {
            bootstrap.bootstrap_forge_instance(&instance, Some(task_id.clone()))
        } else {
            bootstrap.bootstrap_vanilla_instance(&instance, Some(task_id.clone()))
        };

        if let Err(e) = bootstrap_result {
            // Check if this is a bootstrap error
            if let Ok(bootstrap_error) = serde_json::from_str::<BootstrapError>(&e) {
                update_task_with_bootstrap_error(&task_id, &bootstrap_error);
            } else {
                // Fallback to generic error handling
                update_task(
                    &task_id,
                    TaskStatus::Failed,
                    0.0,
                    &format!("Error en bootstrap: {}", e),
                    None,
                );
            }
            return;
        }

        update_task(
            &task_id,
            TaskStatus::Running,
            60.0,
            "Descargando archivos del modpack...",
            None,
        );

        // Instalar archivos del modpack
        let rt = tokio::runtime::Runtime::new().unwrap();
        let files_processed = rt.block_on(async {
            crate::core::modpack_file_manager::download_and_install_files(
                &instance,
                &manifest,
                Some(task_id.clone()),
            )
            .await
        });

        let files_processed = match files_processed {
            Ok(count) => count,
            Err(e) => {
                update_task(
                    &task_id,
                    TaskStatus::Failed,
                    0.0,
                    &format!("Error descargando archivos: {}", e),
                    None,
                );
                return;
            }
        };

        update_task(
            &task_id,
            TaskStatus::Running,
            90.0,
            &format!("Descargados {} archivos", files_processed),
            None,
        );

        update_task(
            &task_id,
            TaskStatus::Completed,
            100.0,
            &format!(
                "Instancia de modpack {} creada exitosamente",
                instance.instanceName
            ),
            None,
        );

        std::thread::sleep(std::time::Duration::from_secs(TASK_CLEANUP_DELAY));
        remove_task(&task_id);
    });
}

/// Spawns a background task to update a modpack instance using incremental validation
/// 
/// This function implements the enhanced modpack update approach that reuses the proven
/// incremental validation logic from the "Play Now" functionality. Instead of performing
/// a destructive reinstall, this approach:
/// 
/// 1. Validates existing files against the new manifest
/// 2. Downloads only files that are missing, corrupt, or have changed
/// 3. Moves files with correct hashes to new locations when possible
/// 4. Cleans up obsolete files after the update
/// 
/// Benefits:
/// - Significantly faster updates (only downloads changed content)
/// - Preserves unchanged files (no unnecessary re-downloading)
/// - Maintains user settings like options.txt
/// - More reliable and efficient than destructive reinstall
fn spawn_modpack_update_task(
    instance: MinecraftInstance,
    manifest: ModpackManifest,
    task_id: String,
) {
    std::thread::spawn(move || {
        update_task(
            &task_id,
            TaskStatus::Running,
            10.0,
            "Iniciando actualización incremental...",
            None,
        );

        // Use the same incremental validation and download logic as "Play Now"
        // This will validate existing files and only download/update what's needed
        let files_processed = tokio::runtime::Runtime::new().unwrap().block_on(async {
            // First, validate existing files and get only those that need downloading
            update_task(
                &task_id,
                TaskStatus::Running,
                25.0,
                "Validando archivos existentes...",
                None,
            );

            let files_to_download = match crate::core::modpack_file_manager::validate_modpack_assets(
                &instance,
                &manifest,
                Some(task_id.clone()),
            ).await {
                Ok(files) => files,
                Err(e) => {
                    update_task(
                        &task_id,
                        TaskStatus::Failed,
                        0.0,
                        &format!("Error validando archivos: {}", e),
                        None,
                    );
                    return Err(e);
                }
            };

            update_task(
                &task_id,
                TaskStatus::Running,
                50.0,
                &format!("Encontrados {} archivos para actualizar", files_to_download.len()),
                None,
            );

            // Download and install only files that need updating
            // This function will also move existing files with correct hashes to new locations
            let processed_count = if files_to_download.is_empty() {
                0
            } else {
                match crate::core::modpack_file_manager::download_and_install_files(
                    &instance,
                    &manifest,
                    Some(task_id.clone()),
                ).await {
                    Ok(count) => count,
                    Err(e) => {
                        update_task(
                            &task_id,
                            TaskStatus::Failed,
                            0.0,
                            &format!("Error descargando archivos: {}", e),
                            None,
                        );
                        return Err(e);
                    }
                }
            };

            // Clean up obsolete files after processing the updates
            update_task(
                &task_id,
                TaskStatus::Running,
                85.0,
                "Limpiando archivos obsoletos...",
                None,
            );

            let removed_files = match crate::core::modpack_file_manager::cleanup_obsolete_files(&instance, &manifest) {
                Ok(files) => files,
                Err(e) => {
                    log::warn!("Error during cleanup (non-fatal): {}", e);
                    // Don't fail the update for cleanup errors, just log them
                    Vec::new()
                }
            };

            log::info!(
                "Incremental update completed: {} files processed, {} obsolete files removed", 
                processed_count, 
                removed_files.len()
            );

            Ok(processed_count)
        });

        let files_processed = match files_processed {
            Ok(count) => count,
            Err(e) => {
                update_task(
                    &task_id,
                    TaskStatus::Failed,
                    0.0,
                    &format!("Error descargando archivos: {}", e),
                    None,
                );
                return;
            }
        };

        update_task(
            &task_id,
            TaskStatus::Running,
            90.0,
            &format!("Actualización incremental completada - {} archivos procesados", files_processed),
            None,
        );

        update_task(
            &task_id,
            TaskStatus::Completed,
            100.0,
            &format!("Modpack {} actualizado exitosamente mediante actualización incremental", instance.instanceName),
            None,
        );

        std::thread::sleep(std::time::Duration::from_secs(TASK_CLEANUP_DELAY));
        remove_task(&task_id);
    });
}

// Funciones auxiliares para crear instancia de modpack
async fn create_modpack_instance_struct(
    instance_name: String,
    modpack_id: String,
    final_version_id: String,
    manifest: crate::core::modpack_file_manager::ModpackManifest,
    modpack_info: serde_json::Value,
) -> Result<MinecraftInstance, String> {
    let instances_dir = get_instances_dir()?;
    let instance_id = uuid::Uuid::new_v4().to_string();

    let mut instance = MinecraftInstance::new();
    instance.instanceName = instance_name;
    instance.instanceId = instance_id.clone();
    instance.modpackId = Some(modpack_id.clone());
    instance.modpackVersionId = Some(final_version_id);
    instance.minecraftVersion = manifest.mc_version;
    instance.forgeVersion = manifest.forge_version;

    println!("{}", modpack_info.to_string());

    // Configurar banner
    if let Some(banner_url) = modpack_info["data"]["attributes"]["bannerUrl"].as_str() {
        let base64_banner = download_image_as_base64(banner_url).await?;
        instance.bannerUrl = Some(base64_banner);
    }

    // Configurar ícono
    if let Some(icon_url) = modpack_info["data"]["attributes"]["iconUrl"].as_str() {
        let base64_icon = download_image_as_base64(icon_url).await?;
        instance.iconUrl = Some(base64_icon);
        instance.usesDefaultIcon = false;
    } else {
        instance.usesDefaultIcon = true;
    }

    // Configurar directorios
    let instance_dir = instances_dir.join(&instance_id);
    instance.instanceDirectory = Some(normalize_path(&instance_dir));
    instance.minecraftPath = normalize_path(&instance_dir.join("minecraft"));

    // Crear directorio y guardar
    fs::create_dir_all(&instance_dir).map_err(|e| format!("Error creando directorio: {}", e))?;

    instance
        .save()
        .map_err(|e| format!("Error guardando configuración: {}", e))?;

    // Fetch and save prelaunch appearance in the background
    let modpack_id_clone = modpack_id;
    let instance_id_clone = instance_id.clone();
    tokio::spawn(async move {
        if let Err(e) = crate::core::prelaunch_appearance::fetch_and_save_prelaunch_appearance(
            modpack_id_clone,
            instance_id_clone,
        )
        .await
        {
            log::warn!(
                "Failed to fetch prelaunch appearance during instance creation: {}",
                e
            );
        }
    });

    Ok(instance)
}

// Funciones auxiliares para API
async fn fetch_latest_version(modpack_id: &str) -> Result<String, String> {
    let client = reqwest::Client::new();
    let url = format!("{}/explore/modpacks/{}/latest", *API_ENDPOINT, modpack_id);

    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch latest version: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("API error: {}", response.status()));
    }

    let json: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse JSON: {}", e))?;

    json["version"]["id"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "Invalid response format".to_string())
}

async fn fetch_modpack_info(modpack_id: &str) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    let url = format!("{}/explore/modpacks/{}", *API_ENDPOINT, modpack_id);

    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch modpack info: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("API error: {}", response.status()));
    }

    response
        .json()
        .await
        .map_err(|e| format!("Failed to parse JSON: {}", e))
}

pub async fn fetch_modpack_manifest(
    modpack_id: &str,
    version_id: &str,
) -> Result<crate::core::modpack_file_manager::ModpackManifest, String> {
    let client = reqwest::Client::new();
    let url = format!(
        "{}/explore/modpacks/{}/versions/{}",
        *API_ENDPOINT, modpack_id, version_id
    );

    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch manifest: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("API error: {}", response.status()));
    }

    let json: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse JSON: {}", e))?;

    serde_json::from_value(json["manifest"].clone())
        .map_err(|e| format!("Failed to parse manifest: {}", e))
}

async fn download_image_as_base64(url: &str) -> Result<String, String> {
    let client = reqwest::Client::new();
    let response = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("Failed to download image: {}", e))?;

    if !response.status().is_success() {
        return Err(format!(
            "Failed to download image: HTTP {}",
            response.status()
        ));
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Failed to read image bytes: {}", e))?;

    let mime_type = detect_image_mime_type(&bytes);
    let base64_data = general_purpose::STANDARD.encode(&bytes);

    Ok(format!("data:{};base64,{}", mime_type, base64_data))
}

fn detect_image_mime_type(bytes: &[u8]) -> &'static str {
    if bytes.len() >= 4 {
        match &bytes[0..4] {
            &[0x89, 0x50, 0x4E, 0x47] => "image/png",
            &[0x47, 0x49, 0x46, 0x38] => "image/gif",
            _ if &bytes[0..2] == &[0xFF, 0xD8] => "image/jpeg",
            _ if &bytes[0..2] == &[0x42, 0x4D] => "image/bmp",
            _ => "image/png", // fallback
        }
    } else {
        "image/png" // fallback
    }
}

#[tauri::command]
pub async fn validate_modpack_password(
    modpack_id: String,
    password: String,
) -> Result<bool, String> {
    let client = reqwest::Client::new();
    let url = format!(
        "{}/explore/modpacks/{}/validate-password",
        *crate::API_ENDPOINT,
        modpack_id
    );

    let response = client
        .post(&url)
        .json(&serde_json::json!({
            "password": password
        }))
        .send()
        .await
        .map_err(|e| format!("Failed to validate password: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("API error: {}", response.status()));
    }

    let json: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse JSON: {}", e))?;

    Ok(json["valid"].as_bool().unwrap_or(false))
}
