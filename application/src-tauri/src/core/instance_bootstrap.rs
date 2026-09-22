// src-tauri/src/instance_bootstrap.rs
use crate::config::get_config_manager;
use crate::core::bootstrap::loaders::ModLoaderInstaller;
use crate::core::clients::BLOCKING_CLIENT;
use crate::core::bootstrap::{
    download::{
        download_file, download_forge_libraries, download_libraries, download_libraries_enhanced,
    },
    filesystem::{create_launcher_profiles, create_minecraft_directories, extract_natives},
    manifest::{
        build_forge_installer_url, get_download_urls, get_java_version_requirement,
        get_version_details, get_version_manifest,
    },
    tasks::{
        emit_bootstrap_complete, emit_bootstrap_error, emit_bootstrap_start, emit_status,
        emit_status_with_stage, Stage,
    },
    validate::{revalidate_assets, revalidate_assets_with_runtime},
};
use crate::core::bootstrap_error::{BootstrapError, BootstrapStep, ErrorCategory};
use crate::core::instance_manager::get_instance_by_id;
use crate::core::java_manager::JavaManager;
use crate::core::minecraft_instance::MinecraftInstance;
use crate::core::tasks_manager::{
    add_task, remove_task, update_task, update_task_with_bootstrap_error, TaskStatus,
};
use crate::GLOBAL_APP_HANDLE;
use serde_json::{json, Value};
use std::fs;
use std::io::{self, Result as IoResult};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::{Arc, Mutex};
use tauri::Emitter;
use tauri_plugin_http::reqwest;

pub struct InstanceBootstrap {
    client: &'static reqwest::blocking::Client,
    // Cache para metadatos de versiones
    version_manifest_cache: Option<(Value, u64)>, // (datos, timestamp)
}

impl InstanceBootstrap {
    pub fn new() -> Self {
        Self {
            client: &*BLOCKING_CLIENT,
            version_manifest_cache: None,
        }
    }

    // --- Error handling helpers ---

    fn handle_network_error(
        &self,
        step: BootstrapStep,
        error: impl std::fmt::Display,
    ) -> BootstrapError {
        BootstrapError::network_error(step, error.to_string())
    }

    fn handle_filesystem_error(
        &self,
        step: BootstrapStep,
        error: impl std::fmt::Display,
    ) -> BootstrapError {
        BootstrapError::filesystem_error(step, error.to_string())
    }

    // --- Public Methods ---

    pub fn revalidate_assets(&mut self, instance: &MinecraftInstance) -> IoResult<()> {
        // Get version details first
        let version_details = self
            .get_version_details(&instance.minecraftVersion)
            .map_err(|e| {
                io::Error::new(
                    io::ErrorKind::Other,
                    format!("Error al obtener detalles de versión: {}", e),
                )
            })?;

        // Use the modular revalidate_assets function
        revalidate_assets(&self.client, instance, &version_details)
    }

    // Método para obtener detalles de la versión
    fn get_version_details(&mut self, version: &str) -> Result<Value, String> {
        get_version_details(&self.client, &mut self.version_manifest_cache, version)
    }

    // Método para descargar archivos
    fn download_file(&self, url: &str, destination: &Path) -> Result<(), String> {
        download_file(&self.client, url, destination)
    }

    // Implementaciones auxiliares
    fn get_version_manifest(&mut self) -> Result<Value, String> {
        get_version_manifest(&self.client, &mut self.version_manifest_cache)
    }

    // Aquí irían más métodos para bootstrapping de instancias Vanilla y Forge
    // como bootstrap_vanilla_instance y bootstrap_forge_instance,
    // pero son bastante extensos para este contexto

    pub fn bootstrap_vanilla_instance(
        &mut self,
        instance: &MinecraftInstance,
        task_id: Option<String>,
    ) -> Result<Option<PathBuf>, String> {
        // Emit start event using modular function
        emit_bootstrap_start(instance, "Vanilla");

        // Update task status if task_id exists
        if let Some(task_id) = &task_id {
            update_task(
                task_id,
                TaskStatus::Running,
                5.0,
                "Iniciando bootstrap de instancia Vanilla",
                Some(serde_json::json!({
                    "instanceName": instance.instanceName.clone(),
                    "instanceId": instance.instanceId.clone()
                })),
            );
        }

        // Create minecraft directory if it doesn't exist
        let instance_dir = Path::new(instance.instanceDirectory.as_deref().unwrap_or(""));
        let minecraft_dir = instance_dir.join("minecraft");

        // Update task status - 8%
        if let Some(task_id) = &task_id {
            update_task(
                task_id,
                TaskStatus::Running,
                8.0,
                "Creando directorios base",
                Some(serde_json::json!({
                    "instanceName": instance.instanceName.clone(),
                    "instanceId": instance.instanceId.clone()
                })),
            );
        }

        if !minecraft_dir.exists() {
            fs::create_dir_all(&minecraft_dir).map_err(|e| {
                self.handle_filesystem_error(
                    BootstrapStep::CreatingDirectories,
                    format!("Error creating minecraft directory: {}", e),
                )
            })?;
        }

        // Create required subdirectories using modular function
        let (versions_dir, libraries_dir, _assets_dir, version_dir, natives_dir) =
            create_minecraft_directories(&minecraft_dir, &instance.minecraftVersion)?;

        // Update task status - 15%
        if let Some(task_id) = &task_id {
            update_task(
                task_id,
                TaskStatus::Running,
                15.0,
                "Descargando manifiesto de versión",
                Some(serde_json::json!({
                    "instanceName": instance.instanceName.clone(),
                    "instanceId": instance.instanceId.clone()
                })),
            );
        }

        // Get version details
        emit_status(
            instance,
            "instance-downloading-manifest",
            "Descargando manifiesto de versión",
        );

        // Update task status - 18%
        if let Some(task_id) = &task_id {
            update_task(
                task_id,
                TaskStatus::Running,
                18.0,
                "Descargando manifiesto de versiones de Minecraft",
                Some(serde_json::json!({
                    "instanceName": instance.instanceName.clone(),
                    "instanceId": instance.instanceId.clone(),
                    "fileName": "version_manifest.json",
                    "fileType": "version_manifest"
                })),
            );
        }

        let version_details = self
            .get_version_details(&instance.minecraftVersion)
            .map_err(|e| {
                self.handle_network_error(
                    BootstrapStep::DownloadingManifest,
                    format!("Error fetching version details: {}", e),
                )
            })?;

        // Update task status after manifest download - 20%
        if let Some(task_id) = &task_id {
            update_task(
                task_id,
                TaskStatus::Running,
                20.0,
                "Manifiesto de versiones descargado correctamente",
                Some(serde_json::json!({
                    "instanceName": instance.instanceName.clone(),
                    "instanceId": instance.instanceId.clone(),
                    "status": "manifest_downloaded"
                })),
            );
        }

        // Download version JSON
        let version_json_path = version_dir.join(format!("{}.json", instance.minecraftVersion));
        if !version_json_path.exists() {
            let version_manifest = self.get_version_manifest()?;

            let versions = version_manifest["versions"]
                .as_array()
                .ok_or_else(|| "Invalid version manifest format".to_string())?;

            let version_info = versions
                .iter()
                .find(|v| v["id"].as_str() == Some(&instance.minecraftVersion))
                .ok_or_else(|| {
                    format!(
                        "Version {} not found in manifest",
                        instance.minecraftVersion
                    )
                })?;

            let version_url = version_info["url"]
                .as_str()
                .ok_or_else(|| "Invalid version info format".to_string())?;

            // Update task status - 25%
            if let Some(task_id) = &task_id {
                update_task(
                    task_id,
                    TaskStatus::Running,
                    25.0,
                    &format!(
                        "Descargando archivo de configuración: {}.json",
                        instance.minecraftVersion
                    ),
                    Some(serde_json::json!({
                        "instanceName": instance.instanceName.clone(),
                        "instanceId": instance.instanceId.clone(),
                        "fileName": format!("{}.json", instance.minecraftVersion),
                        "fileType": "version_json"
                    })),
                );
            }

            emit_status(
                instance,
                "instance-downloading-json",
                &format!(
                    "Descargando archivo de configuración: {}.json",
                    instance.minecraftVersion
                ),
            );

            self.download_file(version_url, &version_json_path)
                .map_err(|e| {
                    self.handle_network_error(
                        BootstrapStep::DownloadingVersionJson,
                        format!("Error downloading version JSON: {}", e),
                    )
                })?;
        } else {
            // Update task status if file already exists
            if let Some(task_id) = &task_id {
                update_task(
                    task_id,
                    TaskStatus::Running,
                    25.0,
                    &format!(
                        "Archivo de configuración ya existe: {}.json",
                        instance.minecraftVersion
                    ),
                    Some(serde_json::json!({
                        "instanceName": instance.instanceName.clone(),
                        "instanceId": instance.instanceId.clone(),
                        "fileName": format!("{}.json", instance.minecraftVersion),
                        "status": "already_exists"
                    })),
                );
            }
        }

        // Download client or server jar depending on instance type
        let is_server = instance.is_server();
        let jar_filename = if is_server {
            "server.jar".to_string()
        } else {
            format!("{}.jar", instance.minecraftVersion)
        };

        let jar_path = version_dir.join(&jar_filename);

        // Determine what we are downloading for status messages
        let file_type_desc = if is_server { "servidor" } else { "cliente" };
        let file_type_key = if is_server {
            "server_jar"
        } else {
            "client_jar"
        };
        let status_key = if is_server {
            "instance-downloading-server"
        } else {
            "instance-downloading-client"
        };

        if !jar_path.exists() {
            // Use the helper to get the correct URL from the manifest JSON we already parsed
            // Note: version_details is the parsed JSON of the version manifest
            // We can reuse get_download_urls logic or just extract manually here since we have the json

            // Extract URL based on type
            let download_key = if is_server { "server" } else { "client" };
            let jar_url = version_details["downloads"][download_key]["url"]
                .as_str()
                .ok_or_else(|| {
                    format!(
                        "{} download URL not found",
                        if is_server { "Server" } else { "Client" }
                    )
                })?;

            let jar_size = version_details["downloads"][download_key]["size"].as_u64();

            // Update task status - 30%
            if let Some(task_id) = &task_id {
                update_task(
                    task_id,
                    TaskStatus::Running,
                    30.0,
                    &format!("Descargando {} Minecraft: {}", file_type_desc, jar_filename),
                    Some(serde_json::json!({
                        "instanceName": instance.instanceName.clone(),
                        "instanceId": instance.instanceId.clone(),
                        "fileName": jar_filename.clone(),
                        "fileType": file_type_key,
                        "fileSize": jar_size
                    })),
                );
            }

            emit_status(
                instance,
                status_key,
                &format!("Descargando {} Minecraft: {}", file_type_desc, jar_filename),
            );

            self.download_file(jar_url, &jar_path).map_err(|e| {
                self.handle_network_error(
                    if is_server {
                        BootstrapStep::DownloadingServerJar
                    } else {
                        BootstrapStep::DownloadingClientJar
                    },
                    format!("Error downloading {} jar: {}", file_type_desc, e),
                )
            })?;
        } else {
            // Update task status if file already exists
            if let Some(task_id) = &task_id {
                update_task(
                    task_id,
                    TaskStatus::Running,
                    30.0,
                    &format!(
                        "{} Minecraft ya existe: {}",
                        if is_server { "Servidor" } else { "Cliente" },
                        jar_filename
                    ),
                    Some(serde_json::json!({
                        "instanceName": instance.instanceName.clone(),
                        "instanceId": instance.instanceId.clone(),
                        "fileName": jar_filename.clone(),
                        "status": "already_exists"
                    })),
                );
            }
        }

        // Update task status - 45%
        if let Some(task_id) = &task_id {
            update_task(
                task_id,
                TaskStatus::Running,
                45.0,
                "Descargando librerías",
                Some(serde_json::json!({
                    "instanceName": instance.instanceName.clone(),
                    "instanceId": instance.instanceId.clone()
                })),
            );
        }

        /*
        "javaVersion": {"majorVersion": 21},
        */
        // Check if correct Java version is installed for this instance
        let java_major_version = get_java_version_requirement(&version_details)?;

        log::info!("Java Major Version: {}", java_major_version);

        let java_manager =
            JavaManager::new().map_err(|e| format!("Failed to create JavaManager: {}", e))?; // Convert error to String

        // Always get the Java path, downloading if necessary
        // Update task status - 40%
        if let Some(task_id) = &task_id {
            let is_version_installed = java_manager.is_version_installed(&java_major_version);
            if !is_version_installed {
                update_task(
                    task_id,
                    TaskStatus::Running,
                    40.0,
                    &format!(
                        "Instalando Java {} (requerido por Minecraft {})",
                        java_major_version, instance.minecraftVersion
                    ),
                    Some(serde_json::json!({
                        "instanceName": instance.instanceName.clone(),
                        "instanceId": instance.instanceId.clone(),
                        "javaVersion": java_major_version,
                        "reason": "required_by_minecraft"
                    })),
                );
            } else {
                update_task(
                    task_id,
                    TaskStatus::Running,
                    40.0,
                    &format!("Java {} ya está instalado", java_major_version),
                    Some(serde_json::json!({
                        "instanceName": instance.instanceName.clone(),
                        "instanceId": instance.instanceId.clone(),
                        "javaVersion": java_major_version,
                        "status": "already_installed"
                    })),
                );
            }
        }

        // Create a SINGLE Tokio runtime and reuse it for all async operations in this bootstrap.
        // Creating multiple runtimes in the same thread is wasteful and can panic if a Tauri
        // runtime is already active in the calling context.
        let async_rt = tokio::runtime::Runtime::new()
            .map_err(|e| format!("Failed to create Tokio runtime: {}", e))?;

        // Get Java path (downloading if necessary)
        let java_path = async_rt
            .block_on(java_manager.get_java_path(&java_major_version))
            .map_err(|e| {
                format!(
                    "Error obtaining Java path for version {}: {}",
                    java_major_version, e
                )
            })?;

        // Download and validate libraries
        emit_status(
            instance,
            "instance-downloading-libraries",
            "Descargando librerías",
        );

        // Use enhanced download manager for libraries (reuse the same runtime)
        async_rt
            .block_on(download_libraries_enhanced(
                instance,
                &version_details,
                &libraries_dir,
            ))
            .map_err(|e| format!("Error downloading libraries: {}", e))?;

        // Update task status - 60%
        if let Some(task_id) = &task_id {
            update_task(
                task_id,
                TaskStatus::Running,
                60.0,
                "Validando assets",
                Some(serde_json::json!({
                    "instanceName": instance.instanceName.clone(),
                    "instanceId": instance.instanceId.clone()
                })),
            );
        }

        // Validate assets — reuse the already-created runtime to avoid creating nested runtimes.
        // This is the step that caused the UI freeze: previously it created a new Runtime
        // inside validate.rs while one was already alive on this thread.
        emit_status(instance, "instance-downloading-assets", "Validando assets");
        revalidate_assets_with_runtime(&self.client, instance, &version_details, &async_rt)
            .map_err(|e| format!("Error validating assets: {}", e))?;

        // Create launcher profiles.json if it doesn't exist
        create_launcher_profiles(&minecraft_dir)?;

        // Extraemos las librerías nativas en el directorio de nativos con el nombre de la versión
        // por ejemplo /natives/1.20.2

        if !natives_dir.exists() {
            fs::create_dir_all(&natives_dir)
                .map_err(|e| format!("Error creating natives directory: {}", e))?;
        }

        if let Some(task_id) = &task_id {
            update_task(
                task_id,
                TaskStatus::Running,
                75.0,
                "Extrayendo bibliotecas nativas",
                Some(serde_json::json!({
                    "instanceName": instance.instanceName.clone(),
                    "instanceId": instance.instanceId.clone()
                })),
            );
        }

        emit_status(
            instance,
            "instance-extracting-natives",
            "Extrayendo bibliotecas nativas",
        );

        // Extraer bibliotecas nativas
        // Check if extraction was already completed successfully via marker file
        let extraction_marker = natives_dir.join(".extraction_complete");
        let needs_extraction = !extraction_marker.exists();

        if needs_extraction {
            let mut extraction_result = extract_natives(
                &version_details,
                &libraries_dir,
                &natives_dir,
                instance,
            );

            // Retry once on failure
            if let Err(ref e) = extraction_result {
                log::warn!(
                    "Native extraction failed, retrying once: {}",
                    e
                );
                extraction_result = extract_natives(
                    &version_details,
                    &libraries_dir,
                    &natives_dir,
                    instance,
                );
            }

            if let Err(e) = extraction_result {
                log::error!("Error extrayendo bibliotecas nativas after retry: {}", e);
                if let Some(task_id) = &task_id {
                    update_task(
                        task_id,
                        TaskStatus::Failed,
                        0.0,
                        &format!("Error extrayendo bibliotecas nativas: {}", e),
                        Some(serde_json::json!({
                            "instanceName": instance.instanceName.clone(),
                            "instanceId": instance.instanceId.clone(),
                            "errorType": "native_extraction"
                        })),
                    );
                }
                return Err(format!("Error extrayendo bibliotecas nativas: {}", e));
            }
        } else {
            log::info!(
                "Native libraries already extracted (marker found), skipping extraction"
            );
        }

        #[cfg(target_os = "macos")]
        {
            if let Err(e) = crate::core::macos_permissions::repair_native_permissions(&natives_dir) {
                log::warn!("[instance_bootstrap] Failed to repair macOS native permissions: {}", e);
            }
        }

        // Update task status - 90%
        if let Some(task_id) = &task_id {
            update_task(
                task_id,
                TaskStatus::Running,
                90.0,
                "Finalizando configuración",
                Some(serde_json::json!({
                    "instanceName": instance.instanceName.clone(),
                    "instanceId": instance.instanceId.clone()
                })),
            );
        }

        // No emitimos el 100% aquí porque también usamos este método para
        // crear instancias de Forge, y no queremos que se emita el evento
        // de finalización, así que lo hará la función que llame al proceso
        // de bootstrap.

        emit_bootstrap_complete(instance, "Vanilla");

        // Return the Java path so the caller can update the instance
        Ok(Some(java_path))
    }

    fn find_java_path(&self) -> Result<String, BootstrapError> {
        log::debug!("Starting Java path resolution");

        let config_lock = get_config_manager().lock().map_err(|e| {
            log::error!("Failed to lock config manager: {}", e);
            BootstrapError::new(
                BootstrapStep::CheckingJavaVersion,
                ErrorCategory::Configuration,
                format!("Failed to lock config manager: {}", e),
            )
        })?;

        let config = config_lock.as_ref().map_err(|e| {
            log::error!("Config manager failed to initialize: {}", e);
            BootstrapError::new(
                BootstrapStep::CheckingJavaVersion,
                ErrorCategory::Configuration,
                format!("Config manager failed to initialize: {}", e),
            )
        })?;

        let java_dir = config.get_java_dir().ok_or_else(|| {
            log::warn!("Java path is not set in configuration");
            BootstrapError::java_error(
                BootstrapStep::CheckingJavaVersion,
                "Java path is not set in configuration",
            )
            .with_suggestion("Ve a Configuración → Java y configura la ruta de Java")
        })?;

        log::debug!("Java directory from config: {}", java_dir.display());

        let java_path = java_dir
            .join("bin")
            .join(if cfg!(windows) { "javaw.exe" } else { "java" });

        log::debug!("Expected Java executable path: {}", java_path.display());

        if !java_path.exists() {
            log::error!(
                "Java executable not found at expected path: {}",
                java_path.display()
            );

            // Try to provide more helpful information
            let bin_dir = java_dir.join("bin");
            if !bin_dir.exists() {
                log::debug!("Java bin directory does not exist: {}", bin_dir.display());
                return Err(BootstrapError::java_error(
                    BootstrapStep::CheckingJavaVersion,
                    format!("Java bin directory not found at: {}", bin_dir.display()),
                )
                .with_suggestion(
                    "Verifica que la ruta de Java apunte a una instalación válida de Java",
                )
                .with_technical_details(format!(
                    "Expected Java executable at: {}",
                    java_path.display()
                )));
            } else {
                log::debug!("Java bin directory exists, but executable is missing");
                return Err(BootstrapError::java_error(
                    BootstrapStep::CheckingJavaVersion,
                    format!("Java executable not found at: {}", java_path.display()),
                )
                .with_suggestion(
                    "Verifica que Java esté instalado correctamente en la ruta configurada",
                )
                .with_technical_details(format!(
                    "Bin directory exists at: {}, but executable is missing",
                    bin_dir.display()
                )));
            }
        }

        let java_path_string = java_path.to_string_lossy().to_string();
        log::info!("Java executable found at: {}", java_path_string);
        Ok(java_path_string)
    }

    pub fn bootstrap_forge_instance(
        &mut self,
        instance: &MinecraftInstance,
        task_id: Option<String>,
    ) -> Result<Option<PathBuf>, String> {
        use crate::core::bootstrap::loaders::ForgeInstaller;

        // Verificar que tengamos información de Forge
        let forge_version = match instance.forgeVersion.as_ref() {
            Some(v) if !v.is_empty() => v.clone(),
            _ => return Err("No se especificó versión de Forge".to_string()),
        };

        // Emit start event using modular function
        emit_bootstrap_start(instance, "Forge");

        // Update task status if task_id exists
        if let Some(task_id) = &task_id {
            update_task(
                task_id,
                TaskStatus::Running,
                5.0,
                "Iniciando configuración base de Vanilla",
                Some(serde_json::json!({
                    "instanceName": instance.instanceName.clone(),
                    "instanceId": instance.instanceId.clone()
                })),
            );
        }

        // First, bootstrap the vanilla base (this will download/detect Java)
        let java_path_option = self
            .bootstrap_vanilla_instance(instance, task_id.clone())
            .map_err(|e| format!("Error configurando base Vanilla: {}", e))?;

        // Update task status - 70%
        if let Some(task_id) = &task_id {
            update_task(
                task_id,
                TaskStatus::Running,
                70.0,
                "Configuración base Vanilla completada, configurando Forge",
                Some(serde_json::json!({
                    "instanceName": instance.instanceName.clone(),
                    "instanceId": instance.instanceId.clone()
                })),
            );
        }

        // Get minecraft directory (reuse from vanilla bootstrap)
        let instance_dir = Path::new(instance.instanceDirectory.as_deref().unwrap_or(""));
        let minecraft_dir = instance_dir.join("minecraft");
        let versions_dir = minecraft_dir.join("versions");

        // Get Java path for the Forge installer
        let java_path = self
            .find_java_path()
            .map_err(|e| format!("Error finding Java: {}", e))?;

        // Setup Forge installer
        let forge_installer = ForgeInstaller::new(
            &self.client,
            instance.minecraftVersion.clone(),
            forge_version.clone(),
        );

        // Update task status - 80%
        if let Some(task_id) = &task_id {
            update_task(
                task_id,
                TaskStatus::Running,
                80.0,
                "Instalando Forge",
                Some(serde_json::json!({
                    "instanceName": instance.instanceName.clone(),
                    "instanceId": instance.instanceId.clone(),
                    "forgeVersion": forge_version
                })),
            );
        }

        // Run Forge installer
        let stage = Stage::InstallingForge;
        emit_status_with_stage(instance, "instance-installing-forge", &stage);

        // Install Forge using the new installer
        match forge_installer.install(&minecraft_dir, &versions_dir, instance, &java_path) {
            Ok(_) => {
                // Update task status - 95%
                if let Some(task_id) = &task_id {
                    update_task(
                        task_id,
                        TaskStatus::Running,
                        95.0,
                        "Forge instalado correctamente",
                        Some(serde_json::json!({
                            "instanceName": instance.instanceName.clone(),
                            "instanceId": instance.instanceId.clone(),
                            "forgeVersion": forge_version
                        })),
                    );
                }
            }
            Err(bootstrap_error) => {
                // Emit bootstrap error event
                emit_bootstrap_error(instance, &bootstrap_error);

                // Update task with error information
                if let Some(task_id) = &task_id {
                    update_task_with_bootstrap_error(task_id, &bootstrap_error);
                }

                return Err(bootstrap_error.into());
            }
        }

        emit_bootstrap_complete(instance, "Forge");

        // Return the Java path so the caller can update the instance
        Ok(java_path_option)
    }

    pub fn bootstrap_fabric_instance(
        &mut self,
        instance: &MinecraftInstance,
        task_id: Option<String>,
    ) -> Result<Option<PathBuf>, String> {
        log::info!(
            "[Instance: {}] Starting Fabric bootstrap",
            instance.instanceId
        );

        use crate::core::bootstrap::loaders::FabricInstaller;

        // Verificar que tengamos información de Fabric
        let fabric_loader_version = match instance.loaderVersion.as_ref() {
            Some(v) if !v.is_empty() => v.clone(),
            _ => return Err("No se especificó versión de Fabric".to_string()),
        };

        // Emit start event using modular function
        emit_bootstrap_start(instance, "Fabric");

        // Update task status if task_id exists
        if let Some(task_id) = &task_id {
            update_task(
                task_id,
                TaskStatus::Running,
                5.0,
                "Iniciando configuración base de Vanilla",
                Some(serde_json::json!({
                    "instanceName": instance.instanceName.clone(),
                    "instanceId": instance.instanceId.clone()
                })),
            );
        }

        // First, bootstrap the vanilla base (this will download/detect Java)
        let java_path_option = self
            .bootstrap_vanilla_instance(instance, task_id.clone())
            .map_err(|e| format!("Error configurando base Vanilla: {}", e))?;

        // Update task status - 70%
        if let Some(task_id) = &task_id {
            update_task(
                task_id,
                TaskStatus::Running,
                70.0,
                "Configuración base Vanilla completada, configurando Fabric",
                Some(serde_json::json!({
                    "instanceName": instance.instanceName.clone(),
                    "instanceId": instance.instanceId.clone()
                })),
            );
        }

        // Get minecraft directory
        let instance_dir = Path::new(instance.instanceDirectory.as_deref().unwrap_or(""));
        let minecraft_dir = instance_dir.join("minecraft");
        let versions_dir = minecraft_dir.join("versions");
        let libraries_dir = minecraft_dir.join("libraries");

        // Update task status - 80%
        if let Some(task_id) = &task_id {
            update_task(
                task_id,
                TaskStatus::Running,
                80.0,
                "Instalando Fabric",
                Some(serde_json::json!({
                    "instanceName": instance.instanceName.clone(),
                    "instanceId": instance.instanceId.clone(),
                    "loaderVersion": &fabric_loader_version
                })),
            );
        }

        emit_status(instance, "instance-installing-fabric", "Instalando Fabric");

        // Install Fabric
        let fabric_installer = FabricInstaller::new(
            &self.client,
            instance.minecraftVersion.clone(),
            fabric_loader_version.clone(),
        );

        fabric_installer
            .install(&minecraft_dir, &versions_dir, &libraries_dir, instance)
            .map_err(|e| {
                emit_bootstrap_error(instance, &e);
                if let Some(task_id) = &task_id {
                    update_task_with_bootstrap_error(task_id, &e);
                }
                e.to_string()
            })?;

        // Update task status - 95%
        if let Some(task_id) = &task_id {
            update_task(
                task_id,
                TaskStatus::Running,
                95.0,
                "Fabric instalado correctamente",
                Some(serde_json::json!({
                    "instanceName": instance.instanceName.clone(),
                    "instanceId": instance.instanceId.clone(),
                    "loaderVersion": &fabric_loader_version
                })),
            );
        }

        emit_bootstrap_complete(instance, "Fabric");

        // Return the Java path so the caller can update the instance
        Ok(java_path_option)
    }

    pub fn bootstrap_neoforge_instance(
        &mut self,
        instance: &MinecraftInstance,
        task_id: Option<String>,
    ) -> Result<Option<PathBuf>, String> {
        use crate::core::bootstrap::loaders::NeoForgeInstaller;

        // Verificar que tengamos información de NeoForge
        let neoforge_loader_version = match instance.loaderVersion.as_ref() {
            Some(v) if !v.is_empty() => v.clone(),
            _ => return Err("No se especificó versión de NeoForge".to_string()),
        };

        // Emit start event using modular function
        emit_bootstrap_start(instance, "NeoForge");

        // Update task status if task_id exists
        if let Some(task_id) = &task_id {
            update_task(
                task_id,
                TaskStatus::Running,
                5.0,
                "Iniciando configuración base de Vanilla",
                Some(serde_json::json!({
                    "instanceName": instance.instanceName.clone(),
                    "instanceId": instance.instanceId.clone()
                })),
            );
        }

        // First, bootstrap the vanilla base (this will download/detect Java)
        let java_path_option = self
            .bootstrap_vanilla_instance(instance, task_id.clone())
            .map_err(|e| format!("Error configurando base Vanilla: {}", e))?;

        // Update task status - 70%
        if let Some(task_id) = &task_id {
            update_task(
                task_id,
                TaskStatus::Running,
                70.0,
                "Configuración base Vanilla completada, configurando NeoForge",
                Some(serde_json::json!({
                    "instanceName": instance.instanceName.clone(),
                    "instanceId": instance.instanceId.clone()
                })),
            );
        }

        // Get minecraft directory
        let instance_dir = Path::new(instance.instanceDirectory.as_deref().unwrap_or(""));
        let minecraft_dir = instance_dir.join("minecraft");
        let versions_dir = minecraft_dir.join("versions");

        // Update task status - 80%
        if let Some(task_id) = &task_id {
            update_task(
                task_id,
                TaskStatus::Running,
                80.0,
                "Descargando instalador de NeoForge",
                Some(serde_json::json!({
                    "instanceName": instance.instanceName.clone(),
                    "instanceId": instance.instanceId.clone(),
                    "loaderVersion": &neoforge_loader_version
                })),
            );
        }

        emit_status(
            instance,
            "instance-installing-neoforge",
            "Instalando NeoForge",
        );

        // Install NeoForge
        let java_path = self.find_java_path()?;
        let neoforge_installer = NeoForgeInstaller::new(
            &self.client,
            instance.minecraftVersion.clone(),
            neoforge_loader_version.clone(),
        );

        neoforge_installer
            .install(instance, &minecraft_dir, &versions_dir, &java_path)
            .map_err(|e| {
                emit_bootstrap_error(instance, &e);
                if let Some(task_id) = &task_id {
                    update_task_with_bootstrap_error(task_id, &e);
                }
                e.to_string()
            })?;

        // Update task status - 95%
        if let Some(task_id) = &task_id {
            update_task(
                task_id,
                TaskStatus::Running,
                95.0,
                "NeoForge instalado correctamente",
                Some(serde_json::json!({
                    "instanceName": instance.instanceName.clone(),
                    "instanceId": instance.instanceId.clone(),
                    "loaderVersion": &neoforge_loader_version
                })),
            );
        }

        emit_bootstrap_complete(instance, "NeoForge");

        // Return the Java path so the caller can update the instance
        Ok(java_path_option)
    }

    pub fn bootstrap_quilt_instance(
        &mut self,
        instance: &MinecraftInstance,
        task_id: Option<String>,
    ) -> Result<Option<PathBuf>, String> {
        use crate::core::bootstrap::loaders::QuiltInstaller;

        // Verificar que tengamos información de Quilt
        let quilt_loader_version = match instance.loaderVersion.as_ref() {
            Some(v) if !v.is_empty() => v.clone(),
            _ => return Err("No se especificó versión de Quilt".to_string()),
        };

        // Emit start event using modular function
        emit_bootstrap_start(instance, "Quilt");

        // Update task status if task_id exists
        if let Some(task_id) = &task_id {
            update_task(
                task_id,
                TaskStatus::Running,
                5.0,
                "Iniciando configuración base de Vanilla",
                Some(serde_json::json!({
                    "instanceName": instance.instanceName.clone(),
                    "instanceId": instance.instanceId.clone()
                })),
            );
        }

        // First, bootstrap the vanilla base (this will download/detect Java)
        let java_path_option = self
            .bootstrap_vanilla_instance(instance, task_id.clone())
            .map_err(|e| format!("Error configurando base Vanilla: {}", e))?;

        // Update task status - 70%
        if let Some(task_id) = &task_id {
            update_task(
                task_id,
                TaskStatus::Running,
                70.0,
                "Configuración base Vanilla completada, configurando Quilt",
                Some(serde_json::json!({
                    "instanceName": instance.instanceName.clone(),
                    "instanceId": instance.instanceId.clone()
                })),
            );
        }

        // Get minecraft directory
        let instance_dir = Path::new(instance.instanceDirectory.as_deref().unwrap_or(""));
        let minecraft_dir = instance_dir.join("minecraft");
        let versions_dir = minecraft_dir.join("versions");

        // Update task status - 80%
        if let Some(task_id) = &task_id {
            update_task(
                task_id,
                TaskStatus::Running,
                80.0,
                "Instalando Quilt",
                Some(serde_json::json!({
                    "instanceName": instance.instanceName.clone(),
                    "instanceId": instance.instanceId.clone(),
                    "loaderVersion": &quilt_loader_version
                })),
            );
        }

        emit_status(instance, "instance-installing-quilt", "Instalando Quilt");

        // Install Quilt
        let quilt_installer = QuiltInstaller::new(
            &self.client,
            instance.minecraftVersion.clone(),
            quilt_loader_version.clone(),
        );

        quilt_installer
            .install(instance, &versions_dir)
            .map_err(|e| {
                emit_bootstrap_error(instance, &e);
                if let Some(task_id) = &task_id {
                    update_task_with_bootstrap_error(task_id, &e);
                }
                e.to_string()
            })?;

        // Update task status - 95%
        if let Some(task_id) = &task_id {
            update_task(
                task_id,
                TaskStatus::Running,
                95.0,
                "Quilt instalado correctamente",
                Some(serde_json::json!({
                    "instanceName": instance.instanceName.clone(),
                    "instanceId": instance.instanceId.clone(),
                    "loaderVersion": &quilt_loader_version
                })),
            );
        }

        emit_bootstrap_complete(instance, "Quilt");

        // Return the Java path so the caller can update the instance
        Ok(java_path_option)
    }
}
