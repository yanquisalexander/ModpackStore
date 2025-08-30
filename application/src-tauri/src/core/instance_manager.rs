// src-tauri/src/core/instance_manager.rs

use crate::config::get_config_manager;
use crate::core::instance_bootstrap::InstanceBootstrap;
use crate::core::minecraft_instance::{self, MinecraftInstance};
use crate::core::modpack_file_manager::ModpackManifest;
use crate::core::tasks_manager::{add_task, remove_task, update_task, TaskStatus};
use crate::API_ENDPOINT;
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
pub fn launch_mc_instance(instance_id: String) -> Result<(), String> {
    let instances_dir = get_instances_dir()?;
    let instances = get_instances(instances_dir.to_str().unwrap_or_default())?;

    let instance = instances
        .into_iter()
        .find(|i| i.instanceId == instance_id)
        .ok_or_else(|| format!("Instance with ID {} not found", instance_id))?;

    instance
        .launch()
        .map_err(|e| format!("Failed to launch instance: {}", e))?;

    Ok(())
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

    // Determinar versión
    let final_version_id = match version_id {
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

    update_task(
        &task_id,
        TaskStatus::Running,
        10.0,
        "Descargando información del modpack...",
        None,
    );

    // Obtener manifiesto
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

    let manifest_clone = manifest.clone();

    // Crear instancia
    let instance = create_modpack_instance_struct(
        instance_name,
        modpack_id.clone(),
        final_version_id.clone(),
        manifest,
        modpack_info,
    )
    .await?;

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

#[tauri::command]
pub async fn check_modpack_updates(
    modpack_id: String,
    current_version: String,
) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    let url = format!(
        "{}/explore/modpacks/{}/check-update?currentVersion={}",
        API_ENDPOINT, modpack_id, current_version
    );

    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Failed to check for updates: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("API error: {}", response.status()));
    }

    response
        .json()
        .await
        .map_err(|e| format!("Failed to parse JSON: {}", e))
}

#[tauri::command]
pub async fn update_modpack_instance(
    instance_id: String,
    target_version_id: Option<String>,
) -> Result<String, String> {
    let mut instance =
        MinecraftInstance::from_instance_id(&instance_id).ok_or("Instance not found")?;

    let modpack_id = instance
        .modpackId
        .as_ref()
        .ok_or("Instance is not a modpack instance")?
        .clone();

    let task_id = add_task(
        &format!("Actualizando modpack: {}", instance.instanceName),
        Some(serde_json::json!({
            "type": "modpack_update",
            "instanceId": instance_id,
            "instanceName": instance.instanceName,
            "modpackId": modpack_id
        })),
    );

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
                update_task(
                    &task_id,
                    TaskStatus::Failed,
                    0.0,
                    &format!("Error en bootstrap: {}", e),
                    None,
                );
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
            update_task(
                &task_id,
                TaskStatus::Failed,
                0.0,
                &format!("Error en bootstrap: {}", e),
                None,
            );
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
            crate::core::modpack_file_manager::download_and_install_files(&instance, &manifest)
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

fn spawn_modpack_update_task(
    instance: MinecraftInstance,
    manifest: ModpackManifest,
    task_id: String,
) {
    std::thread::spawn(move || {
        update_task(
            &task_id,
            TaskStatus::Running,
            25.0,
            "Descargando archivos actualizados...",
            None,
        );

        // Limpiar archivos obsoletos
        let removed_files =
            crate::core::modpack_file_manager::cleanup_obsolete_files(&instance, &manifest);

        let removed_files = match removed_files {
            Ok(files) => files,
            Err(e) => {
                update_task(
                    &task_id,
                    TaskStatus::Failed,
                    0.0,
                    &format!("Error limpiando archivos: {}", e),
                    None,
                );
                return;
            }
        };

        update_task(
            &task_id,
            TaskStatus::Running,
            50.0,
            &format!("Eliminados {} archivos obsoletos", removed_files.len()),
            None,
        );

        // Instalar archivos actualizados
        let files_processed = tokio::runtime::Runtime::new().unwrap().block_on(async {
            crate::core::modpack_file_manager::download_and_install_files(&instance, &manifest)
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
            &format!("Modpack {} actualizado exitosamente", instance.instanceName),
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
    instance.modpackId = Some(modpack_id);
    instance.modpackVersionId = Some(final_version_id);
    instance.minecraftVersion = manifest.mc_version;
    instance.forgeVersion = manifest.forge_version;

    // Configurar banner
    if let Some(banner_url) = modpack_info["bannerUrl"].as_str() {
        let base64_banner = download_image_as_base64(banner_url).await?;
        instance.bannerUrl = Some(format!("data:image/png;base64,{}", base64_banner));
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

    Ok(instance)
}

// Funciones auxiliares para API
async fn fetch_latest_version(modpack_id: &str) -> Result<String, String> {
    let client = reqwest::Client::new();
    let url = format!("{}/explore/modpacks/{}/latest", API_ENDPOINT, modpack_id);

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
    let url = format!("{}/explore/modpacks/{}", API_ENDPOINT, modpack_id);

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
        API_ENDPOINT, modpack_id, version_id
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
    let base64_data = base64::encode(&bytes);

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
