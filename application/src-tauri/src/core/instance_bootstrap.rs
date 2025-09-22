// src-tauri/src/instance_bootstrap.rs
use crate::config::get_config_manager;
use crate::core::bootstrap::{
    download::{download_file, download_forge_libraries, download_libraries},
    filesystem::{create_launcher_profiles, create_minecraft_directories, extract_natives},
    manifest::{
        build_forge_installer_url, get_java_version_requirement, get_version_details,
        get_version_manifest,
    },
    tasks::{
        emit_bootstrap_complete, emit_bootstrap_error, emit_bootstrap_start, emit_status,
        emit_status_with_stage, Stage,
    },
    validate::revalidate_assets,
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
    client: reqwest::blocking::Client,
    // Cache para metadatos de versiones
    version_manifest_cache: Option<(Value, u64)>, // (datos, timestamp)
}

impl InstanceBootstrap {
    pub fn new() -> Self {
        Self {
            client: reqwest::blocking::Client::new(),
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
    fn get_version_manifest(&mut self) -> Result<Value, reqwest::Error> {
        get_version_manifest(&self.client, &mut self.version_manifest_cache)
    }

    // Aquí irían más métodos para bootstrapping de instancias Vanilla y Forge
    // como bootstrap_vanilla_instance y bootstrap_forge_instance,
    // pero son bastante extensos para este contexto

    pub fn bootstrap_vanilla_instance(
        &mut self,
        instance: &MinecraftInstance,
        task_id: Option<String>,
    ) -> Result<(), String> {
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
            let version_manifest = self
                .get_version_manifest()
                .map_err(|e| format!("Error fetching version manifest: {}", e))?;

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

        // Download client jar
        let client_jar_path = version_dir.join(format!("{}.jar", instance.minecraftVersion));
        if !client_jar_path.exists() {
            let client_url = version_details["downloads"]["client"]["url"]
                .as_str()
                .ok_or_else(|| "Client download URL not found".to_string())?;

            // Update task status - 30%
            if let Some(task_id) = &task_id {
                update_task(
                    task_id,
                    TaskStatus::Running,
                    30.0,
                    &format!(
                        "Descargando cliente Minecraft: {}.jar",
                        instance.minecraftVersion
                    ),
                    Some(serde_json::json!({
                        "instanceName": instance.instanceName.clone(),
                        "instanceId": instance.instanceId.clone(),
                        "fileName": format!("{}.jar", instance.minecraftVersion),
                        "fileType": "client_jar",
                        "fileSize": version_details["downloads"]["client"]["size"]
                    })),
                );
            }

            emit_status(
                instance,
                "instance-downloading-client",
                &format!(
                    "Descargando cliente Minecraft: {}.jar",
                    instance.minecraftVersion
                ),
            );

            self.download_file(client_url, &client_jar_path)
                .map_err(|e| {
                    self.handle_network_error(
                        BootstrapStep::DownloadingClientJar,
                        format!("Error downloading client jar: {}", e),
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
                        "Cliente Minecraft ya existe: {}.jar",
                        instance.minecraftVersion
                    ),
                    Some(serde_json::json!({
                        "instanceName": instance.instanceName.clone(),
                        "instanceId": instance.instanceId.clone(),
                        "fileName": format!("{}.jar", instance.minecraftVersion),
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

        println!("Java Major Version: {}", java_major_version);

        let java_manager =
            JavaManager::new().map_err(|e| format!("Failed to create JavaManager: {}", e))?; // Convert error to String

        let is_version_installed = java_manager.is_version_installed(&java_major_version);

        if !is_version_installed {
            // Update task status - 40%
            if let Some(task_id) = &task_id {
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
            }

            // Create Tokio runtime for async task execution
            let java_path = tokio::runtime::Runtime::new()
                .expect("Failed to create Tokio runtime")
                .block_on(java_manager.get_java_path(&java_major_version))
                .map_err(|e| {
                    format!(
                        "Error obtaining Java path for version {}: {}",
                        java_major_version, e
                    )
                })?;

            let mut instance_to_modify = instance.clone();
            instance_to_modify.set_java_path(java_path);
        } else {
            // Update task status if Java is already installed
            if let Some(task_id) = &task_id {
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

        // Download and validate libraries
        emit_status(
            instance,
            "instance-downloading-libraries",
            "Descargando librerías",
        );
        download_libraries(&self.client, &version_details, &libraries_dir, instance)
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

        // Validate assets
        emit_status(instance, "instance-downloading-assets", "Validando assets");
        self.revalidate_assets(instance)
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
        if let Err(e) = extract_natives(&version_details, &libraries_dir, &natives_dir, instance) {
            log::error!("Error extrayendo bibliotecas nativas: {}", e);
            // No devolver error aquí, ya que es opcional
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

        Ok(())
    }

    fn run_forge_installer(
        &self,
        installer_path: &Path,
        minecraft_dir: &Path,
        minecraft_version: &str,
        forge_version: &str,
        instance: &MinecraftInstance,
    ) -> Result<(), BootstrapError> {
        log::info!(
            "[Instance: {}] Starting Forge installer - Minecraft: {}, Forge: {}",
            instance.instanceId,
            minecraft_version,
            forge_version
        );

        // Determinar la ruta de Java
        let java_path = self.find_java_path()?;
        log::debug!(
            "[Instance: {}] Using Java path: {}",
            instance.instanceId,
            java_path
        );

        // Crear archivo temporal para parámetros de instalación
        let install_profile = minecraft_dir.join("forge-install-profile.json");
        let install_profile_content = json!({
            "profile": format!("forge-{}-{}", minecraft_version, forge_version),
            "version": format!("{}-forge-{}", minecraft_version, forge_version),
            "installDir": minecraft_dir.to_string_lossy(),
            "minecraft": minecraft_version,
            "forge": forge_version
        });

        log::debug!(
            "[Instance: {}] Creating Forge install profile at: {}",
            instance.instanceId,
            install_profile.display()
        );

        fs::write(&install_profile, install_profile_content.to_string()).map_err(|e| {
            log::error!(
                "[Instance: {}] Failed to create install profile: {}",
                instance.instanceId,
                e
            );
            BootstrapError::filesystem_error(
                BootstrapStep::RunningForgeInstaller,
                format!("Error al crear archivo de perfil de instalación: {}", e),
            )
        })?;

        // Lista de opciones de instalación para probar secuencialmente
        let install_options = ["--installClient", "--installDir", "--installServer"];

        let mut success = false;
        let mut last_error = String::new();
        let mut attempted_options = Vec::new();

        log::info!(
            "[Instance: {}] Attempting Forge installation with {} options",
            instance.instanceId,
            install_options.len()
        );

        // Intentar cada opción de instalación hasta que una tenga éxito
        for &option in &install_options {
            attempted_options.push(option);

            // Preparar comando para ejecutar el instalador con la opción actual
            let mut install_cmd = Command::new(&java_path);
            install_cmd
                .arg("-jar")
                .arg(installer_path)
                .arg(option)
                .current_dir(minecraft_dir);

            // En Windows, usar CREATE_NO_WINDOW para evitar que aparezca una ventana de CMD
            #[cfg(target_os = "windows")]
            {
                use std::os::windows::process::CommandExt;
                install_cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
            }

            // Ejecutar instalador con la opción actual
            log::info!(
                "[Instance: {}] Executing Forge installer with option '{}': {:?}",
                instance.instanceId,
                option,
                install_cmd
            );

            match install_cmd.output() {
                Ok(output) => {
                    if output.status.success() {
                        success = true;
                        log::info!(
                            "[Instance: {}] Forge installation completed successfully using option '{}'",
                            instance.instanceId,
                            option
                        );
                        break;
                    } else {
                        let error_msg = String::from_utf8_lossy(&output.stderr);
                        let stdout_msg = String::from_utf8_lossy(&output.stdout);

                        log::warn!(
                            "[Instance: {}] Forge installation failed with option '{}' - Exit code: {:?}",
                            instance.instanceId,
                            option,
                            output.status.code()
                        );
                        log::debug!(
                            "[Instance: {}] Forge installer stderr: {}",
                            instance.instanceId,
                            error_msg
                        );
                        log::debug!(
                            "[Instance: {}] Forge installer stdout: {}",
                            instance.instanceId,
                            stdout_msg
                        );

                        last_error = format!(
                            "Error en instalación de Forge con {}: {}",
                            option, error_msg
                        );
                    }
                }
                Err(e) => {
                    log::error!(
                        "[Instance: {}] Failed to execute Forge installer with option '{}': {}",
                        instance.instanceId,
                        option,
                        e
                    );
                    last_error = format!(
                        "Error al ejecutar instalador de Forge con {}: {}",
                        option, e
                    );
                }
            }
        }

        // Limpiar archivo temporal de instalación
        if install_profile.exists() {
            if let Err(e) = fs::remove_file(&install_profile) {
                log::warn!(
                    "[Instance: {}] Failed to remove install profile: {}",
                    instance.instanceId,
                    e
                );
            } else {
                log::debug!(
                    "[Instance: {}] Cleaned up install profile",
                    instance.instanceId
                );
            }
        }

        // Verificar resultado final
        if success {
            log::info!(
                "[Instance: {}] Forge installation completed successfully",
                instance.instanceId
            );
            Ok(())
        } else {
            log::error!(
                "[Instance: {}] All Forge installation methods failed. Attempted options: {:?}. Last error: {}",
                instance.instanceId,
                attempted_options,
                last_error
            );
            Err(
                BootstrapError::forge_error(last_error).with_technical_details(format!(
                    "Tried installation options: {:?}. All failed.",
                    attempted_options
                )),
            )
        }
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
    ) -> Result<(), String> {
        // Verificar que tengamos información de Forge
        if instance.forgeVersion.is_none() || instance.forgeVersion.as_ref().unwrap().is_empty() {
            return Err("No se especificó versión de Forge".to_string());
        }

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

        // First, bootstrap the vanilla base
        self.bootstrap_vanilla_instance(instance, task_id.clone())
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

        // Setup Forge-specific files
        let forge_version = instance.forgeVersion.as_ref().unwrap();
        let forge_version_name = format!("{}-forge-{}", instance.minecraftVersion, forge_version);
        let forge_version_dir = versions_dir.join(&forge_version_name);

        if !forge_version_dir.exists() {
            // Update task status - 75%
            if let Some(task_id) = &task_id {
                update_task(
                    task_id,
                    TaskStatus::Running,
                    75.0,
                    &format!("Creando directorio para Forge {}", forge_version),
                    Some(serde_json::json!({
                        "instanceName": instance.instanceName.clone(),
                        "instanceId": instance.instanceId.clone(),
                        "forgeVersion": forge_version
                    })),
                );
            }

            fs::create_dir_all(&forge_version_dir)
                .map_err(|e| format!("Error creating Forge version directory: {}", e))?;
        }

        // Download Forge installer
        let forge_installer_url =
            build_forge_installer_url(&instance.minecraftVersion, forge_version);

        let forge_installer_path = minecraft_dir.join("forge-installer.jar");

        // Update task status - 80%
        if let Some(task_id) = &task_id {
            update_task(
                task_id,
                TaskStatus::Running,
                80.0,
                "Descargando instalador de Forge",
                Some(serde_json::json!({
                    "instanceName": instance.instanceName.clone(),
                    "instanceId": instance.instanceId.clone(),
                    "fileName": "forge-installer.jar",
                    "fileType": "forge_installer"
                })),
            );
        }

        emit_status(
            instance,
            "instance-downloading-forge-installer",
            "Descargando instalador de Forge",
        );

        self.download_file(&forge_installer_url, &forge_installer_path)
            .map_err(|e| format!("Error downloading Forge installer: {}", e))?;

        // Update task status - 85%
        if let Some(task_id) = &task_id {
            update_task(
                task_id,
                TaskStatus::Running,
                85.0,
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

        // Ejecutar el instalador de Forge
        match self.run_forge_installer(
            &forge_installer_path,
            &minecraft_dir,
            &instance.minecraftVersion,
            forge_version,
            instance,
        ) {
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

        Ok(())
    }
}
