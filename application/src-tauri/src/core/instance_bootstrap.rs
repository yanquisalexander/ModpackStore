// src-tauri/src/instance_bootstrap.rs
use crate::config::get_config_manager;
use crate::core::instance_manager::get_instance_by_id;
use crate::core::java_manager::JavaManager;
use crate::core::minecraft_instance::MinecraftInstance;
use crate::core::tasks_manager::{add_task, remove_task, update_task, TaskStatus};
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
    const MOJANG_VERSION_MANIFEST_URL: &'static str =
        "https://launchermeta.mojang.com/mc/game/version_manifest.json";
    const FORGE_API_BASE_URL: &'static str = "https://mc-versions-api.net/api/forge";
    const CACHE_EXPIRY_MS: u64 = 3600000; // 1 hora

    pub fn new() -> Self {
        Self {
            client: reqwest::blocking::Client::new(),
            version_manifest_cache: None,
        }
    }

    // --- Helper Methods for Event Emission ---

    /// Emits a status update event to the frontend.
    /// Uses the global `AppHandle` to send events to all windows.
    ///
    /// # Arguments
    ///
    /// * `event_name` - The name of the event (e.g., "instance-launch-start").
    /// * `message` - A descriptive message for the frontend.
    fn emit_status(instance: &MinecraftInstance, event_name: &str, message: &str) {
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

    // Implementación del método extract_natives
    fn extract_natives(
        &self,
        version_details: &Value,
        libraries_dir: &Path,
        natives_dir: &Path,
        instance: &MinecraftInstance,
    ) -> Result<(), String> {
        // Obtener el sistema operativo actual
        let os = std::env::consts::OS;
        let os_name = match os {
            "windows" => "windows",
            "macos" => "osx",
            "linux" => "linux",
            _ => return Err(format!("Sistema operativo no soportado: {}", os)),
        };

        // Obtener la arquitectura
        let arch = std::env::consts::ARCH;
        let arch_name = match arch {
            "x86_64" => "64",
            "x86" => "32",
            "aarch64" => "arm64",
            _ => return Err(format!("Arquitectura no soportada: {}", arch)),
        };

        // Obtener las bibliotecas del manifiesto de versión
        let libraries = version_details["libraries"]
            .as_array()
            .ok_or_else(|| "No se encontraron bibliotecas en el manifiesto".to_string())?;

        let mut processed_libraries = 0;
        let total_native_libraries = libraries
            .iter()
            .filter(|lib| lib.get("natives").is_some())
            .count();

        Self::emit_status(
            instance,
            "instance-extracting-natives-start",
            &format!(
                "Iniciando extracción de {} bibliotecas nativas",
                total_native_libraries
            ),
        );

        for library in libraries {
            // Verificar si la biblioteca tiene nativos
            if let Some(natives) = library.get("natives") {
                processed_libraries += 1;

                // Update progress for each native library
                let progress_percentage = if total_native_libraries > 0 {
                    (processed_libraries as f64 / total_native_libraries as f64) * 100.0
                } else {
                    100.0
                };

                Self::emit_status(
                    instance,
                    "instance-extracting-natives-progress",
                    &format!(
                        "Procesando biblioteca nativa {}/{} ({:.1}%)",
                        processed_libraries, total_native_libraries, progress_percentage
                    ),
                );

                let os_natives = natives.get(os_name);

                // Si hay nativos para este sistema operativo
                if let Some(os_natives_value) = os_natives {
                    // Obtener información sobre la biblioteca
                    let library_info = library["downloads"]["classifiers"]
                        .get(
                            os_natives_value
                                .as_str()
                                .unwrap_or(&format!("{}-{}", os_name, arch_name)),
                        )
                        .or_else(|| {
                            library["downloads"]["classifiers"]
                                .get(&format!("{}-{}", os_name, arch_name))
                        })
                        .ok_or_else(|| {
                            format!("No se encontró información de nativos para la biblioteca")
                        })?;

                    // Obtener la ruta y URL del archivo JAR
                    let path = library_info["path"]
                        .as_str()
                        .ok_or_else(|| "No se encontró la ruta del archivo nativo".to_string())?;

                    let library_path = libraries_dir.join(path);

                    // Si el archivo no existe, descargarlo
                    if !library_path.exists() {
                        let url = library_info["url"].as_str().ok_or_else(|| {
                            "No se encontró la URL del archivo nativo".to_string()
                        })?;

                        // Crear el directorio padre si no existe
                        if let Some(parent) = library_path.parent() {
                            fs::create_dir_all(parent).map_err(|e| {
                                format!("Error creando directorio para biblioteca nativa: {}", e)
                            })?;
                        }

                        Self::emit_status(
                            instance,
                            "instance-downloading-native-library",
                            &format!("Descargando biblioteca nativa: {}", path),
                        );

                        // Descargar el archivo JAR
                        self.download_file(url, &library_path)
                            .map_err(|e| format!("Error descargando biblioteca nativa: {}", e))?;
                    }

                    // Verificar si hay reglas de extracción (exclude)
                    let exclude_patterns: Vec<String> =
                        if let Some(extract) = library.get("extract") {
                            if let Some(exclude) = extract.get("exclude") {
                                exclude
                                    .as_array()
                                    .unwrap_or(&Vec::new())
                                    .iter()
                                    .filter_map(|v| v.as_str().map(|s| s.to_string()))
                                    .collect()
                            } else {
                                Vec::new()
                            }
                        } else {
                            Vec::new()
                        };

                    // Extraer el archivo JAR al directorio de nativos
                    Self::emit_status(
                        instance,
                        "instance-extracting-native-library",
                        &format!("Extrayendo biblioteca nativa: {}", path),
                    );

                    // Abrir el archivo JAR
                    let file = fs::File::open(&library_path)
                        .map_err(|e| format!("Error abriendo archivo JAR: {}", e))?;

                    let reader = std::io::BufReader::new(file);
                    let mut archive = zip::ZipArchive::new(reader)
                        .map_err(|e| format!("Error leyendo archivo ZIP: {}", e))?;

                    // Extraer cada entrada que no esté excluida
                    for i in 0..archive.len() {
                        let mut file = archive
                            .by_index(i)
                            .map_err(|e| format!("Error obteniendo entrada ZIP: {}", e))?;

                        let file_name = file.name().to_string();

                        // Verificar si el archivo está excluido
                        let should_extract = !exclude_patterns.iter().any(|pattern| {
                            if pattern.ends_with("*") {
                                let prefix = &pattern[0..pattern.len() - 1];
                                file_name.starts_with(prefix)
                            } else {
                                file_name == *pattern
                            }
                        });

                        if should_extract && !file.is_dir() {
                            // Crear la ruta de destino
                            let output_path = natives_dir.join(file_name);

                            // Crear directorios padres si no existen
                            if let Some(parent) = output_path.parent() {
                                fs::create_dir_all(parent).map_err(|e| {
                                    format!("Error creando directorio para archivo nativo: {}", e)
                                })?;
                            }

                            // Extraer el archivo
                            let mut output_file = fs::File::create(&output_path)
                                .map_err(|e| format!("Error creando archivo nativo: {}", e))?;

                            std::io::copy(&mut file, &mut output_file)
                                .map_err(|e| format!("Error escribiendo archivo nativo: {}", e))?;
                        }
                    }
                }
            }
        }

        Ok(())
    }

    pub fn revalidate_assets(&mut self, instance: &MinecraftInstance) -> IoResult<()> {
        log::info!("Revalidando assets para: {}", instance.instanceName);

        // Verificar si la versión de Minecraft está disponible
        if instance.minecraftVersion.is_empty() {
            return Err(io::Error::new(
                io::ErrorKind::InvalidData,
                "No se pudo determinar la versión de Minecraft",
            ));
        }

        // Obtener la ruta de la instancia
        let instance_dir = Path::new(instance.instanceDirectory.as_deref().unwrap_or(""));
        let minecraft_folder = instance_dir.join("minecraft");
        let assets_dir = minecraft_folder.join("assets");
        let assets_indexes_dir = assets_dir.join("indexes");
        let assets_objects_dir = assets_dir.join("objects");

        // Crear directorios si no existen
        fs::create_dir_all(&assets_indexes_dir)?;
        fs::create_dir_all(&assets_objects_dir)?;

        // Obtener detalles de la versión
        let version_details = self
            .get_version_details(&instance.minecraftVersion)
            .map_err(|e| {
                io::Error::new(
                    io::ErrorKind::Other,
                    format!("Error al obtener detalles de versión: {}", e),
                )
            })?;

        // Obtener información del índice de assets
        let asset_index_node = version_details.get("assetIndex").ok_or_else(|| {
            io::Error::new(
                io::ErrorKind::NotFound,
                "No se encontró información del índice de assets",
            )
        })?;

        let assets_index_id = asset_index_node
            .get("id")
            .and_then(|v| v.as_str())
            .ok_or_else(|| {
                io::Error::new(
                    io::ErrorKind::InvalidData,
                    "ID de índice de assets inválido",
                )
            })?;

        let assets_index_url = asset_index_node
            .get("url")
            .and_then(|v| v.as_str())
            .ok_or_else(|| {
                io::Error::new(
                    io::ErrorKind::InvalidData,
                    "URL de índice de assets inválido",
                )
            })?;

        let assets_index_file = assets_indexes_dir.join(format!("{}.json", assets_index_id));

        // Descargar o validar el índice de assets
        if !assets_index_file.exists() {
            log::info!(
                "Descargando índice de assets para la versión {}",
                instance.minecraftVersion
            );
            self.download_file(assets_index_url, &assets_index_file)
                .map_err(|e| {
                    io::Error::new(
                        io::ErrorKind::Other,
                        format!("Error al descargar índice de assets: {}", e),
                    )
                })?;
        }

        // Leer y procesar el índice de assets
        let assets_index_content = fs::read_to_string(&assets_index_file)?;
        let assets_index_root: Value =
            serde_json::from_str(&assets_index_content).map_err(|e| {
                io::Error::new(
                    io::ErrorKind::InvalidData,
                    format!("Error al parsear índice de assets: {}", e),
                )
            })?;

        let objects = assets_index_root
            .get("objects")
            .and_then(|v| v.as_object())
            .ok_or_else(|| {
                io::Error::new(
                    io::ErrorKind::InvalidData,
                    "No se encontraron objetos de assets en el índice",
                )
            })?;

        let total_assets = objects.len();
        let mut processed_assets = 0;
        let mut missing_assets = 0;

        log::info!("Validando {} assets...", total_assets);

        // Procesar cada asset
        for (asset_name, asset_info) in objects {
            processed_assets += 1;

            let hash = asset_info
                .get("hash")
                .and_then(|v| v.as_str())
                .ok_or_else(|| {
                    io::Error::new(
                        io::ErrorKind::InvalidData,
                        format!("Hash inválido para asset: {}", asset_name),
                    )
                })?;

            let hash_prefix = &hash[0..2];
            let asset_file = assets_objects_dir.join(hash_prefix).join(hash);

            // Informar progreso

            log::info!(
                "Validando assets: {}/{} ({:.1}%)",
                processed_assets,
                total_assets,
                (processed_assets as f64 * 100.0 / total_assets as f64)
            );
            Self::emit_status(
                instance,
                "instance-downloading-assets",
                &format!(
                    "Validando assets: {}/{} ({:.1}%)",
                    processed_assets,
                    total_assets,
                    (processed_assets as f64 * 100.0 / total_assets as f64)
                ),
            );

            if !asset_file.exists() {
                missing_assets += 1;
                let asset_url = format!(
                    "https://resources.download.minecraft.net/{}/{}",
                    hash_prefix, hash
                );
                let target_dir = assets_objects_dir.join(hash_prefix);

                if !target_dir.exists() {
                    fs::create_dir_all(&target_dir)?;
                }

                self.download_file(&asset_url, &asset_file).map_err(|e| {
                    io::Error::new(
                        io::ErrorKind::Other,
                        format!("Error al descargar asset {}: {}", asset_name, e),
                    )
                })?;
            }
        }

        if missing_assets > 0 {
            log::info!("Se han descargado {} assets faltantes.", missing_assets);
        } else {
            log::info!("Todos los assets están validados.");
        }

        log::info!("Asset revalidation completed");

        // Emitir evento de finalización
        Self::emit_status(
            instance,
            "instance-finish-assets-download",
            &format!(
                "Validación de assets completada para {}",
                instance.instanceName
            ),
        );
        Ok(())
    }

    // Método para obtener detalles de la versión
    fn get_version_details(&mut self, version: &str) -> Result<Value, String> {
        // Obtener el manifiesto de versiones
        let version_manifest = self
            .get_version_manifest()
            .map_err(|e| format!("Error fetching version manifest: {}", e))?;

        let versions_node = version_manifest["versions"]
            .as_array()
            .ok_or_else(|| "Invalid version manifest format".to_string())?;

        // Buscar la versión específica
        let version_info = versions_node
            .iter()
            .find(|v| v["id"].as_str() == Some(version))
            .ok_or_else(|| format!("Version {} not found in manifest", version))?;

        let version_url = version_info["url"]
            .as_str()
            .ok_or_else(|| "Invalid version info format".to_string())?;

        // Descargar detalles de la versión
        self.client
            .get(version_url)
            .send()
            .map_err(|e| format!("Error fetching version details: {}", e))?
            .json::<Value>()
            .map_err(|e| format!("Error parsing version details: {}", e))
    }

    // Método para descargar archivos
    fn download_file(&self, url: &str, destination: &Path) -> Result<(), String> {
        // Asegurarse de que el directorio padre existe
        if let Some(parent) = destination.parent() {
            fs::create_dir_all(parent).map_err(|e| format!("Error creating directory: {}", e))?;
        }

        let mut response = self
            .client
            .get(url)
            .send()
            .map_err(|e| format!("Download error: {}", e))?;

        if !response.status().is_success() {
            return Err(format!(
                "Download failed with status: {}",
                response.status()
            ));
        }

        let mut file =
            fs::File::create(destination).map_err(|e| format!("Error creating file: {}", e))?;

        response
            .copy_to(&mut file)
            .map_err(|e| format!("Error writing file: {}", e))?;

        Ok(())
    }

    // Implementaciones auxiliares
    fn get_version_manifest(&mut self) -> Result<Value, reqwest::Error> {
        let current_time = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;

        // Verificar caché
        if let Some((cached_manifest, cache_time)) = &self.version_manifest_cache {
            if current_time - cache_time < Self::CACHE_EXPIRY_MS {
                return Ok(cached_manifest.clone());
            }
        }

        // Obtener nuevo manifiesto
        let manifest = self
            .client
            .get(Self::MOJANG_VERSION_MANIFEST_URL)
            .send()?
            .json::<Value>()?;

        // Actualizar caché
        self.version_manifest_cache = Some((manifest.clone(), current_time));

        Ok(manifest)
    }

    // Aquí irían más métodos para bootstrapping de instancias Vanilla y Forge
    // como bootstrap_vanilla_instance y bootstrap_forge_instance,
    // pero son bastante extensos para este contexto

    pub fn bootstrap_vanilla_instance(
        &mut self,
        instance: &MinecraftInstance,
        task_id: Option<String>,
    ) -> Result<(), String> {
        // Emit start event
        Self::emit_status(
            instance,
            "instance-bootstrap-start",
            "Iniciando bootstrap de instancia Vanilla",
        );

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
            fs::create_dir_all(&minecraft_dir)
                .map_err(|e| format!("Error creating minecraft directory: {}", e))?;
        }

        // Create required subdirectories
        let versions_dir = minecraft_dir.join("versions");
        let libraries_dir = minecraft_dir.join("libraries");
        let assets_dir = minecraft_dir.join("assets");
        let version_dir = versions_dir.join(&instance.minecraftVersion);
        let natives_dir = minecraft_dir
            .join("natives")
            .join(&instance.minecraftVersion);

        let directories = [
            ("versions", &versions_dir),
            ("libraries", &libraries_dir),
            ("assets", &assets_dir),
            ("version", &version_dir),
            ("natives", &natives_dir),
        ];

        for (dir_name, dir_path) in &directories {
            if !dir_path.exists() {
                // Update task status for each directory creation
                if let Some(task_id) = &task_id {
                    update_task(
                        task_id,
                        TaskStatus::Running,
                        10.0,
                        &format!("Creando directorio: {}", dir_name),
                        Some(serde_json::json!({
                            "instanceName": instance.instanceName.clone(),
                            "instanceId": instance.instanceId.clone()
                        })),
                    );
                }

                fs::create_dir_all(dir_path).map_err(|e| {
                    format!("Error creating directory {}: {}", dir_path.display(), e)
                })?;
            }
        }

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
        Self::emit_status(
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
            .map_err(|e| format!("Error fetching version details: {}", e))?;

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

            Self::emit_status(
                instance,
                "instance-downloading-json",
                &format!(
                    "Descargando archivo de configuración: {}.json",
                    instance.minecraftVersion
                ),
            );

            self.download_file(version_url, &version_json_path)
                .map_err(|e| format!("Error downloading version JSON: {}", e))?;
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

            Self::emit_status(
                instance,
                "instance-downloading-client",
                &format!(
                    "Descargando cliente Minecraft: {}.jar",
                    instance.minecraftVersion
                ),
            );

            self.download_file(client_url, &client_jar_path)
                .map_err(|e| format!("Error downloading client jar: {}", e))?;
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
        let java_version = version_details["javaVersion"]
            .as_object()
            .ok_or_else(|| "Java version not found in version details".to_string())?;

        println!("");
        println!("");
        println!("");

        println!("Java Version Details: {:?}", java_version);
        println!("");
        println!("");
        println!("");

        // As string
        let java_major_version = java_version
            .get("majorVersion")
            .and_then(|v| v.as_u64()) // Lo tomás como número primero
            .map(|v| v.to_string()) // Luego lo convertís a String
            .ok_or_else(|| "8".to_string())?; // Valor por defecto si falla

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
        Self::emit_status(
            instance,
            "instance-downloading-libraries",
            "Descargando librerías",
        );
        self.download_libraries(&version_details, &libraries_dir, instance)
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
        Self::emit_status(instance, "instance-downloading-assets", "Validando assets");
        self.revalidate_assets(instance)
            .map_err(|e| format!("Error validating assets: {}", e))?;

        // Create launcher profiles.json if it doesn't exist
        let launcher_profiles_path = minecraft_dir.join("launcher_profiles.json");
        if !launcher_profiles_path.exists() {
            // Update task status - 55%
            if let Some(task_id) = &task_id {
                update_task(
                    task_id,
                    TaskStatus::Running,
                    55.0,
                    "Creando configuración del launcher",
                    Some(serde_json::json!({
                        "instanceName": instance.instanceName.clone(),
                        "instanceId": instance.instanceId.clone(),
                        "fileName": "launcher_profiles.json"
                    })),
                );
            }

            let default_profiles = json!({
                "profiles": {},
                "settings": {},
                "version": 3
            });

            fs::write(&launcher_profiles_path, default_profiles.to_string())
                .map_err(|e| format!("Error creating launcher_profiles.json: {}", e))?;
        } else {
            // Update task status if file already exists
            if let Some(task_id) = &task_id {
                update_task(
                    task_id,
                    TaskStatus::Running,
                    55.0,
                    "Configuración del launcher ya existe",
                    Some(serde_json::json!({
                        "instanceName": instance.instanceName.clone(),
                        "instanceId": instance.instanceId.clone(),
                        "fileName": "launcher_profiles.json",
                        "status": "already_exists"
                    })),
                );
            }
        }

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

        Self::emit_status(
            instance,
            "instance-extracting-natives",
            "Extrayendo bibliotecas nativas",
        );

        // Extraer bibliotecas nativas
        if let Err(e) =
            self.extract_natives(&version_details, &libraries_dir, &natives_dir, instance)
        {
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

        Self::emit_status(
            instance,
            "vanilla-instance-bootstrapped",
            &format!(
                "Bootstrap de instancia Vanilla {} completado",
                instance.minecraftVersion
            ),
        );

        Ok(())
    }

    fn download_forge_libraries(
        &self,
        version_details: &Value,
        libraries_dir: &Path,
        instance: &MinecraftInstance,
    ) -> Result<(), String> {
        // Verificar que tengamos la sección de librerías
        let libraries = version_details["libraries"].as_array().ok_or_else(|| {
            "Lista de librerías no encontrada en detalles de versión Forge".to_string()
        })?;

        let total_libraries = libraries.len();
        let mut downloaded_libraries = 0;

        Self::emit_status(
            instance,
            "instance-downloading-forge-libraries",
            &format!(
                "Descargando librerías de Forge: 0/{} (0.0%)",
                total_libraries
            ),
        );

        for library in libraries {
            // Verificar reglas de exclusión/inclusión para esta librería
            if let Some(rules) = library.get("rules") {
                let mut allowed = false;

                for rule in rules.as_array().unwrap_or(&Vec::new()) {
                    let action = rule["action"].as_str().unwrap_or("disallow");

                    // Manejar reglas específicas de SO
                    if let Some(os) = rule.get("os") {
                        let os_name = os["name"].as_str().unwrap_or("");
                        let current_os = if cfg!(target_os = "windows") {
                            "windows"
                        } else if cfg!(target_os = "macos") {
                            "osx"
                        } else {
                            "linux"
                        };

                        if os_name == current_os {
                            allowed = action == "allow";
                        }
                    } else {
                        // No OS especificado, aplicar a todos
                        allowed = action == "allow";
                    }
                }

                if !allowed {
                    continue; // Skip this library
                }
            }

            // Manejo de librerías con formato Maven (común en Forge)
            let name = library["name"].as_str().unwrap_or("");

            // Si la librería tiene información de descarga directa
            if let Some(downloads) = library.get("downloads") {
                // Descargar artefacto principal
                if let Some(artifact) = downloads.get("artifact") {
                    let path = artifact["path"]
                        .as_str()
                        .ok_or_else(|| "Ruta de artefacto no encontrada".to_string())?;
                    let url = artifact["url"]
                        .as_str()
                        .ok_or_else(|| "URL de artefacto no encontrada".to_string())?;

                    let target_path = libraries_dir.join(path);

                    // Crear directorios padre si es necesario
                    if let Some(parent) = target_path.parent() {
                        fs::create_dir_all(parent)
                            .map_err(|e| format!("Error al crear directorio: {}", e))?;
                    }

                    // Descargar si el archivo no existe
                    if !target_path.exists() {
                        self.download_file(url, &target_path)
                            .map_err(|e| format!("Error al descargar librería: {}", e))?;
                    }
                }

                // Descargar librerías nativas (classifiers)
                if let Some(classifiers) = downloads.get("classifiers") {
                    let current_os = if cfg!(target_os = "windows") {
                        "natives-windows"
                    } else if cfg!(target_os = "macos") {
                        "natives-osx"
                    } else {
                        "natives-linux"
                    };

                    if let Some(native) = classifiers.get(current_os) {
                        let url = native["url"]
                            .as_str()
                            .ok_or_else(|| "URL de librería nativa no encontrada".to_string())?;
                        let path = native["path"]
                            .as_str()
                            .ok_or_else(|| "Ruta de librería nativa no encontrada".to_string())?;

                        let target_path = libraries_dir.join(path);

                        // Crear directorios padre si es necesario
                        if let Some(parent) = target_path.parent() {
                            fs::create_dir_all(parent)
                                .map_err(|e| format!("Error al crear directorio: {}", e))?;
                        }

                        // Descargar si el archivo no existe
                        if !target_path.exists() {
                            self.download_file(url, &target_path).map_err(|e| {
                                format!("Error al descargar librería nativa: {}", e)
                            })?;
                        }
                    }
                }
            }
            // Para librerías sin información de descarga directa, usar formato Maven
            else if !name.is_empty() {
                // Parsear el nombre en formato Maven: groupId:artifactId:version[:classifier]
                let parts: Vec<&str> = name.split(':').collect();
                if parts.len() >= 3 {
                    let group_id = parts[0];
                    let artifact_id = parts[1];
                    let version = parts[2];
                    let classifier = if parts.len() > 3 {
                        Some(parts[3])
                    } else {
                        None
                    };

                    // Convertir la especificación de grupo en path
                    let group_path = group_id.replace('.', "/");

                    // Construir la ruta al archivo JAR
                    let jar_name = if let Some(classifier) = classifier {
                        format!("{}-{}-{}.jar", artifact_id, version, classifier)
                    } else {
                        format!("{}-{}.jar", artifact_id, version)
                    };

                    let relative_path =
                        format!("{}/{}/{}/{}", group_path, artifact_id, version, jar_name);
                    let target_path = libraries_dir.join(&relative_path);

                    // Crear directorios padre si es necesario
                    if let Some(parent) = target_path.parent() {
                        fs::create_dir_all(parent)
                            .map_err(|e| format!("Error al crear directorio: {}", e))?;
                    }

                    // Construir la URL para la descarga
                    // Probar primero con el repositorio de Forge
                    let repo_url = library["url"]
                        .as_str()
                        .unwrap_or("https://maven.minecraftforge.net/");
                    let download_url = format!("{}{}", repo_url, relative_path);

                    // Descargar si el archivo no existe
                    if !target_path.exists() {
                        if let Err(e) = self.download_file(&download_url, &target_path) {
                            // Si falla con el repositorio de Forge, intentar con el de Maven Central
                            let maven_url =
                                format!("https://repo1.maven.org/maven2/{}", relative_path);
                            self.download_file(&maven_url, &target_path).map_err(|e| {
                                format!(
                                    "Error al descargar librería desde múltiples repositorios: {}",
                                    e
                                )
                            })?;
                        }
                    }
                }
            }

            downloaded_libraries += 1;

            // Actualizar progreso cada 5 librerías o en la última
            if downloaded_libraries % 5 == 0 || downloaded_libraries == total_libraries {
                let progress = (downloaded_libraries as f32 / total_libraries as f32) * 100.0;
                Self::emit_status(
                    instance,
                    "instance-downloading-forge-libraries",
                    &format!(
                        "Descargando librerías de Forge: {}/{} ({:.1}%)",
                        downloaded_libraries, total_libraries, progress
                    ),
                );
            }
        }

        Ok(())
    }

    fn download_libraries(
        &self,
        version_details: &Value,
        libraries_dir: &Path,
        instance: &MinecraftInstance,
    ) -> Result<(), String> {
        let libraries = version_details["libraries"]
            .as_array()
            .ok_or_else(|| "Libraries list not found in version details".to_string())?;

        let total_libraries = libraries.len();
        let mut downloaded_libraries = 0;
        let mut skipped_libraries = 0;

        // Emit initial status
        Self::emit_status(
            instance,
            "instance-downloading-libraries-start",
            &format!("Iniciando descarga de {} librerías", total_libraries),
        );

        for library in libraries {
            // Check if we should skip this library based on rules
            if let Some(rules) = library.get("rules") {
                let mut allowed = false;

                for rule in rules.as_array().unwrap_or(&Vec::new()) {
                    let action = rule["action"].as_str().unwrap_or("disallow");

                    // Handle OS-specific rules
                    if let Some(os) = rule.get("os") {
                        let os_name = os["name"].as_str().unwrap_or("");
                        let current_os = if cfg!(target_os = "windows") {
                            "windows"
                        } else if cfg!(target_os = "macos") {
                            "osx"
                        } else {
                            "linux"
                        };

                        if os_name == current_os {
                            allowed = action == "allow";
                        }
                    } else {
                        // No OS specified, apply to all
                        allowed = action == "allow";
                    }
                }

                if !allowed {
                    skipped_libraries += 1;
                    continue; // Skip this library
                }
            }

            // Check if the library is already downloaded
            let name = library["name"].as_str().unwrap_or("");
            let path = library["path"].as_str().unwrap_or("");

            // For libraries with direct download information
            if let Some(downloads) = library.get("downloads") {
                if let Some(artifact) = downloads.get("artifact") {
                    let artifact_path = artifact["path"]
                        .as_str()
                        .ok_or_else(|| "Artifact path not found".to_string())?;
                    let artifact_url = artifact["url"]
                        .as_str()
                        .ok_or_else(|| "Artifact URL not found".to_string())?;

                    let target_path = libraries_dir.join(artifact_path);

                    // Create parent directories if necessary
                    if let Some(parent) = target_path.parent() {
                        fs::create_dir_all(parent)
                            .map_err(|e| format!("Error creating directory for library: {}", e))?;
                    }

                    // Download the artifact if it doesn't exist
                    if !target_path.exists() {
                        Self::emit_status(
                            instance,
                            "instance-downloading-library",
                            &format!("Descargando librería: {}", artifact_path),
                        );

                        self.download_file(artifact_url, &target_path)
                            .map_err(|e| format!("Error downloading library: {}", e))?;
                    } else {
                        Self::emit_status(
                            instance,
                            "instance-library-already-exists",
                            &format!("Librería ya existe: {}", artifact_path),
                        );
                    }
                }
            }
            // For libraries without direct download information, use Maven format
            else if !name.is_empty() {
                // Parse the name in Maven format: groupId:artifactId:version[:classifier]
                let parts: Vec<&str> = name.split(':').collect();
                if parts.len() >= 3 {
                    let group_id = parts[0];
                    let artifact_id = parts[1];
                    let version = parts[2];
                    let classifier = if parts.len() > 3 {
                        Some(parts[3])
                    } else {
                        None
                    };

                    // Convert the group specification to path
                    let group_path = group_id.replace('.', "/");

                    // Build the path to the JAR file
                    let jar_name = if let Some(classifier) = classifier {
                        format!("{}-{}-{}.jar", artifact_id, version, classifier)
                    } else {
                        format!("{}-{}.jar", artifact_id, version)
                    };

                    let relative_path =
                        format!("{}/{}/{}/{}", group_path, artifact_id, version, jar_name);
                    let target_path = libraries_dir.join(&relative_path);

                    // Create parent directories if necessary
                    if let Some(parent) = target_path.parent() {
                        fs::create_dir_all(parent)
                            .map_err(|e| format!("Error creating directory for library: {}", e))?;
                    }

                    // Build the URL for the download
                    // First, try the Forge repository
                    let repo_url = library["url"]
                        .as_str()
                        .unwrap_or("https://maven.minecraftforge.net/");
                    let download_url = format!("{}{}", repo_url, relative_path);

                    // Download if the file doesn't exist
                    if !target_path.exists() {
                        Self::emit_status(
                            instance,
                            "instance-downloading-library",
                            &format!("Descargando librería Maven: {}", jar_name),
                        );

                        if let Err(e) = self.download_file(&download_url, &target_path) {
                            // If it fails with the Forge repository, try the Maven Central one
                            let maven_url =
                                format!("https://repo1.maven.org/maven2/{}", relative_path);
                            self.download_file(&maven_url, &target_path).map_err(|e| {
                                format!(
                                    "Error al descargar librería desde múltiples repositorios: {}",
                                    e
                                )
                            })?;
                        }
                    } else {
                        Self::emit_status(
                            instance,
                            "instance-library-already-exists",
                            &format!("Librería Maven ya existe: {}", jar_name),
                        );
                    }
                }
            }

            downloaded_libraries += 1;

            // Actualizar progreso cada 3 librerías o en la última
            if downloaded_libraries % 3 == 0
                || downloaded_libraries == total_libraries - skipped_libraries
            {
                let progress = (downloaded_libraries as f32
                    / (total_libraries - skipped_libraries) as f32)
                    * 100.0;
                Self::emit_status(
                    instance,
                    "instance-downloading-libraries",
                    &format!(
                        "Descargando librerías: {}/{} ({:.1}%)",
                        downloaded_libraries,
                        total_libraries - skipped_libraries,
                        progress
                    ),
                );
            }
        }

        // Emit final status
        Self::emit_status(
            instance,
            "instance-libraries-downloaded",
            &format!(
                "Descarga de librerías completada: {} descargadas, {} omitidas",
                downloaded_libraries, skipped_libraries
            ),
        );

        Ok(())
    }

    fn run_forge_installer(
        &self,
        installer_path: &Path,
        minecraft_dir: &Path,
        minecraft_version: &str,
        forge_version: &str,
        instance: &MinecraftInstance,
    ) -> Result<(), String> {
        // Determinar la ruta de Java
        let java_path = self.find_java_path()?;

        // Crear archivo temporal para parámetros de instalación
        let install_profile = minecraft_dir.join("forge-install-profile.json");
        let install_profile_content = json!({
            "profile": format!("forge-{}-{}", minecraft_version, forge_version),
            "version": format!("{}-forge-{}", minecraft_version, forge_version),
            "installDir": minecraft_dir.to_string_lossy(),
            "minecraft": minecraft_version,
            "forge": forge_version
        });

        fs::write(&install_profile, install_profile_content.to_string())
            .map_err(|e| format!("Error al crear archivo de perfil de instalación: {}", e))?;

        // Lista de opciones de instalación para probar secuencialmente
        let install_options = ["--installClient", "--installDir", "--installServer"];

        let mut success = false;
        let mut last_error = String::new();

        // Intentar cada opción de instalación hasta que una tenga éxito
        for &option in &install_options {
            // Preparar comando para ejecutar el instalador con la opción actual
            let mut install_cmd = Command::new(&java_path);
            install_cmd
                .arg("-jar")
                .arg(installer_path)
                .arg(option)
                .current_dir(minecraft_dir);

            // Ejecutar instalador con la opción actual
            log::info!("Ejecutando instalador Forge con comando: {:?}", install_cmd);

            match install_cmd.output() {
                Ok(output) => {
                    if output.status.success() {
                        success = true;
                        log::info!(
                            "Instalación de Forge completada con éxito usando {}",
                            option
                        );
                        break;
                    } else {
                        let error_msg = String::from_utf8_lossy(&output.stderr);
                        log::warn!(
                            "Fallo en instalación de Forge con {}: {}",
                            option,
                            error_msg
                        );
                        last_error = format!(
                            "Error en instalación de Forge con {}: {}",
                            option, error_msg
                        );
                    }
                }
                Err(e) => {
                    log::warn!(
                        "Error al ejecutar instalador de Forge con {}: {}",
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
            let _ = fs::remove_file(install_profile);
        }

        // Verificar resultado final
        if success {
            Ok(())
        } else {
            log::error!(
                "Todos los métodos de instalación de Forge fallaron. Último error: {}",
                last_error
            );
            Err(format!(
                "Todos los métodos de instalación de Forge fallaron. Último error: {}",
                last_error
            ))
        }
    }

    fn find_java_path(&self) -> Result<String, String> {
        let config_lock = get_config_manager()
            .lock()
            .expect("Failed to lock config manager mutex");

        let config = config_lock
            .as_ref()
            .expect("Config manager failed to initialize");

        let java_path = config
            .get_java_dir()
            .ok_or_else(|| "Java path is not set".to_string())?
            .join("bin")
            .join(if cfg!(windows) { "javaw.exe" } else { "java" });

        if !java_path.exists() {
            return Err(format!(
                "Java executable not found at: {}",
                java_path.display()
            ));
        }
        Ok(java_path.to_string_lossy().to_string())
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

        // Emit start event
        Self::emit_status(
            instance,
            "instance-bootstrap-start",
            "Iniciando bootstrap de instancia Forge",
        );

        // Update task status if task_id exists
        if let Some(task_id) = &task_id {
            update_task(
                task_id,
                TaskStatus::Running,
                5.0,
                "Iniciando bootstrap de instancia Forge",
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
            fs::create_dir_all(&minecraft_dir)
                .map_err(|e| format!("Error creating minecraft directory: {}", e))?;
        }

        // Create required subdirectories
        let versions_dir = minecraft_dir.join("versions");
        let libraries_dir = minecraft_dir.join("libraries");
        let assets_dir = minecraft_dir.join("assets");
        let version_dir = versions_dir.join(&instance.minecraftVersion);
        let natives_dir = minecraft_dir
            .join("natives")
            .join(&instance.minecraftVersion);

        let directories = [
            ("versions", &versions_dir),
            ("libraries", &libraries_dir),
            ("assets", &assets_dir),
            ("version", &version_dir),
            ("natives", &natives_dir),
        ];

        for (dir_name, dir_path) in &directories {
            if !dir_path.exists() {
                // Update task status for each directory creation
                if let Some(task_id) = &task_id {
                    update_task(
                        task_id,
                        TaskStatus::Running,
                        10.0,
                        &format!("Creando directorio: {}", dir_name),
                        Some(serde_json::json!({
                            "instanceName": instance.instanceName.clone(),
                            "instanceId": instance.instanceId.clone()
                        })),
                    );
                }

                fs::create_dir_all(dir_path).map_err(|e| {
                    format!("Error creating directory {}: {}", dir_path.display(), e)
                })?;
            }
        }

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
        Self::emit_status(
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
            .map_err(|e| format!("Error fetching version details: {}", e))?;

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

            Self::emit_status(
                instance,
                "instance-downloading-json",
                &format!(
                    "Descargando archivo de configuración: {}.json",
                    instance.minecraftVersion
                ),
            );

            self.download_file(version_url, &version_json_path)
                .map_err(|e| format!("Error downloading version JSON: {}", e))?;
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

            Self::emit_status(
                instance,
                "instance-downloading-client",
                &format!(
                    "Descargando cliente Minecraft: {}.jar",
                    instance.minecraftVersion
                ),
            );

            self.download_file(client_url, &client_jar_path)
                .map_err(|e| format!("Error downloading client jar: {}", e))?;
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
        let java_version = version_details["javaVersion"]
            .as_object()
            .ok_or_else(|| "Java version not found in version details".to_string())?;

        println!("");
        println!("");
        println!("");

        println!("Java Version Details: {:?}", java_version);
        println!("");
        println!("");
        println!("");

        // As string
        let java_major_version = java_version
            .get("majorVersion")
            .and_then(|v| v.as_u64()) // Lo tomás como número primero
            .map(|v| v.to_string()) // Luego lo convertís a String
            .ok_or_else(|| "8".to_string())?; // Valor por defecto si falla

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
        Self::emit_status(
            instance,
            "instance-downloading-libraries",
            "Descargando librerías",
        );
        self.download_libraries(&version_details, &libraries_dir, instance)
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
        Self::emit_status(instance, "instance-downloading-assets", "Validando assets");
        self.revalidate_assets(instance)
            .map_err(|e| format!("Error validating assets: {}", e))?;

        // Create launcher profiles.json if it doesn't exist
        let launcher_profiles_path = minecraft_dir.join("launcher_profiles.json");
        if !launcher_profiles_path.exists() {
            // Update task status - 55%
            if let Some(task_id) = &task_id {
                update_task(
                    task_id,
                    TaskStatus::Running,
                    55.0,
                    "Creando configuración del launcher",
                    Some(serde_json::json!({
                        "instanceName": instance.instanceName.clone(),
                        "instanceId": instance.instanceId.clone(),
                        "fileName": "launcher_profiles.json"
                    })),
                );
            }

            let default_profiles = json!({
                "profiles": {},
                "settings": {},
                "version": 3
            });

            fs::write(&launcher_profiles_path, default_profiles.to_string())
                .map_err(|e| format!("Error creating launcher_profiles.json: {}", e))?;
        } else {
            // Update task status if file already exists
            if let Some(task_id) = &task_id {
                update_task(
                    task_id,
                    TaskStatus::Running,
                    55.0,
                    "Configuración del launcher ya existe",
                    Some(serde_json::json!({
                        "instanceName": instance.instanceName.clone(),
                        "instanceId": instance.instanceId.clone(),
                        "fileName": "launcher_profiles.json",
                        "status": "already_exists"
                    })),
                );
            }
        }

        // Setup Forge-specific files
        let forge_version = instance.forgeVersion.as_ref().unwrap();
        let forge_version_name = format!("{}-forge-{}", instance.minecraftVersion, forge_version);
        let forge_version_dir = versions_dir.join(&forge_version_name);

        if !forge_version_dir.exists() {
            // Update task status - 65%
            if let Some(task_id) = &task_id {
                update_task(
                    task_id,
                    TaskStatus::Running,
                    65.0,
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
        let forge_installer_url = format!(
            "https://maven.minecraftforge.net/net/minecraftforge/forge/{}-{}/forge-{}-{}-installer.jar",
            instance.minecraftVersion, forge_version, instance.minecraftVersion, forge_version
        );

        let forge_installer_path = minecraft_dir.join("forge-installer.jar");

        // Update task status - 70%
        if let Some(task_id) = &task_id {
            update_task(
                task_id,
                TaskStatus::Running,
                70.0,
                "Descargando instalador de Forge",
                Some(serde_json::json!({
                    "instanceName": instance.instanceName.clone(),
                    "instanceId": instance.instanceId.clone(),
                    "fileName": "forge-installer.jar",
                    "fileType": "forge_installer"
                })),
            );
        }

        Self::emit_status(
            instance,
            "instance-downloading-forge-installer",
            "Descargando instalador de Forge",
        );

        self.download_file(&forge_installer_url, &forge_installer_path)
            .map_err(|e| format!("Error downloading Forge installer: {}", e))?;

        // Update task status - 75%
        if let Some(task_id) = &task_id {
            update_task(
                task_id,
                TaskStatus::Running,
                75.0,
                "Instalando Forge",
                Some(serde_json::json!({
                    "instanceName": instance.instanceName.clone(),
                    "instanceId": instance.instanceId.clone(),
                    "forgeVersion": forge_version
                })),
            );
        }

        // Run Forge installer (simplified - would need actual implementation)
        Self::emit_status(instance, "instance-installing-forge", "Instalando Forge");

        // Ejecutar el instalador de Forge
        self.run_forge_installer(
            &forge_installer_path,
            &minecraft_dir,
            &instance.minecraftVersion,
            forge_version,
            instance,
        )
        .map_err(|e| format!("Error ejecutando instalador de Forge: {}", e))?;

        // Update task status - 85%
        if let Some(task_id) = &task_id {
            update_task(
                task_id,
                TaskStatus::Running,
                85.0,
                "Forge instalado correctamente",
                Some(serde_json::json!({
                    "instanceName": instance.instanceName.clone(),
                    "instanceId": instance.instanceId.clone(),
                    "forgeVersion": forge_version
                })),
            );
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

        Self::emit_status(
            instance,
            "forge-instance-bootstrapped",
            &format!(
                "Bootstrap de instancia Forge {} para Minecraft {} completado",
                forge_version, instance.minecraftVersion
            ),
        );

        Ok(())
    }
}
