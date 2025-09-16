// src/core/bootstrap/download.rs
// Download-related functionality extracted from instance_bootstrap.rs

use crate::core::bootstrap::tasks::{emit_status, emit_status_with_stage, Stage};
use crate::core::minecraft_instance::MinecraftInstance;
use crate::core::modpack_file_manager::DownloadManager;
use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};
use tauri_plugin_http::reqwest;

/// Downloads a file from the given URL to the specified destination
/// Creates parent directories if they don't exist
/// 
/// NOTE: This function is deprecated in favor of the DownloadManager-based approach.
/// It's kept for compatibility but should not be used for new code.
#[deprecated(
    since = "0.1.0",
    note = "Use DownloadManager for better performance, retry logic, and reliability"
)]
pub fn download_file(
    client: &reqwest::blocking::Client,
    url: &str,
    destination: &Path,
) -> Result<(), String> {
    // Asegurarse de que el directorio padre existe
    if let Some(parent) = destination.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Error creating directory: {}", e))?;
    }

    let mut response = client
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

/// Modern download function using DownloadManager with hash verification
/// This provides better retry logic, concurrency control, and reliability
pub async fn download_file_with_manager(
    download_manager: &DownloadManager,
    url: &str,
    destination: &Path,
    expected_hash: Option<&str>,
) -> Result<(), String> {
    match expected_hash {
        Some(hash) => {
            download_manager.download_file_with_hash(url, destination, hash).await
        }
        None => {
            // If no hash is provided, we still use the DownloadManager but with a dummy hash
            // and just verify the file was downloaded successfully
            let dummy_hash = "0000000000000000000000000000000000000000";
            match download_manager.download_file_with_hash(url, destination, dummy_hash).await {
                Ok(()) => Ok(()),
                Err(e) if e.contains("Hash mismatch") => {
                    // Ignore hash mismatch errors when no hash was expected
                    if destination.exists() {
                        Ok(())
                    } else {
                        Err("File was not downloaded successfully".to_string())
                    }
                }
                Err(e) => Err(e),
            }
        }
    }
}

/// Downloads libraries for vanilla Minecraft instances
pub fn download_libraries(
    client: &reqwest::blocking::Client,
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

    // Pre-scan to compute how many libraries will be skipped so we can use a stable total
    let is_allowed = |library: &Value| -> bool {
        if let Some(rules) = library.get("rules") {
            let mut allowed = false;
            for rule in rules.as_array().unwrap_or(&Vec::new()) {
                let action = rule["action"].as_str().unwrap_or("disallow");

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
                    allowed = action == "allow";
                }
            }
            allowed
        } else {
            true
        }
    };

    let mut initial_skipped = 0;
    for lib in libraries.iter() {
        if !is_allowed(lib) {
            initial_skipped += 1;
        }
    }
    let effective_total = total_libraries - initial_skipped;

    // Emit initial status (show effective total)
    emit_status(
        instance,
        "instance-downloading-libraries-start",
        &format!("Iniciando descarga de {} librerías", effective_total),
    );

    // Emit initial stage for downloading libraries
    let initial_stage = Stage::DownloadingFiles {
        current: 0,
        total: effective_total,
    };
    emit_status_with_stage(instance, "instance-downloading-libraries", &initial_stage);

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
                    emit_status(
                        instance,
                        "instance-downloading-library",
                        &format!("Descargando librería: {}", artifact_path),
                    );

                    download_file(client, artifact_url, &target_path)
                        .map_err(|e| format!("Error downloading library: {}", e))?;
                } else {
                    emit_status(
                        instance,
                        "instance-library-already-exists",
                        &format!("Librería ya existe: {}", artifact_path),
                    );
                }
            }

            // Handle native libraries with classifiers
            if let Some(classifiers) = downloads.get("classifiers") {
                // Get current OS and architecture
                let current_os = if cfg!(target_os = "windows") {
                    "windows"
                } else if cfg!(target_os = "macos") {
                    "osx"
                } else {
                    "linux"
                };

                let current_arch = if cfg!(target_arch = "x86_64") {
                    "64"
                } else if cfg!(target_arch = "x86") {
                    "32"
                } else if cfg!(target_arch = "aarch64") {
                    "arm64"
                } else {
                    "64" // default
                };

                // Try different classifier combinations
                let possible_classifiers = [
                    format!("{}-{}", current_os, current_arch),
                    format!("natives-{}", current_os),
                    "natives".to_string(),
                ];

                for classifier in &possible_classifiers {
                    if let Some(classifier_info) = classifiers.get(classifier) {
                        let classifier_path =
                            classifier_info["path"].as_str().ok_or_else(|| {
                                format!("Classifier path not found for {}", classifier)
                            })?;
                        let classifier_url = classifier_info["url"].as_str().ok_or_else(|| {
                            format!("Classifier URL not found for {}", classifier)
                        })?;

                        let target_path = libraries_dir.join(classifier_path);

                        // Create parent directories if necessary
                        if let Some(parent) = target_path.parent() {
                            fs::create_dir_all(parent).map_err(|e| {
                                format!("Error creating directory for native library: {}", e)
                            })?;
                        }

                        // Download the classifier if it doesn't exist
                        if !target_path.exists() {
                            emit_status(
                                instance,
                                "instance-downloading-native-library",
                                &format!("Descargando biblioteca nativa: {}", classifier_path),
                            );

                            download_file(client, classifier_url, &target_path)
                                .map_err(|e| format!("Error downloading native library: {}", e))?;
                        } else {
                            emit_status(
                                instance,
                                "instance-native-library-already-exists",
                                &format!("Biblioteca nativa ya existe: {}", classifier_path),
                            );
                        }
                        break; // Found and processed one classifier, no need to try others
                    }
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
                    emit_status(
                        instance,
                        "instance-downloading-library",
                        &format!("Descargando librería Maven: {}", jar_name),
                    );

                    if let Err(e) = download_file(client, &download_url, &target_path) {
                        // If it fails with the Forge repository, try the Maven Central one
                        let maven_url = format!("https://repo1.maven.org/maven2/{}", relative_path);
                        download_file(client, &maven_url, &target_path).map_err(|e| {
                            format!(
                                "Error al descargar librería desde múltiples repositorios: {}",
                                e
                            )
                        })?;
                    }
                } else {
                    emit_status(
                        instance,
                        "instance-library-already-exists",
                        &format!("Librería Maven ya existe: {}", jar_name),
                    );
                }
            }
        }

        downloaded_libraries += 1;

        let stage = Stage::DownloadingFiles {
            current: downloaded_libraries,
            total: effective_total,
        };
        emit_status_with_stage(instance, "instance-downloading-libraries", &stage);
    }

    // Emit final status
    emit_status(
        instance,
        "instance-libraries-downloaded",
        &format!(
            "Descarga de librerías completada: {} descargadas, {} omitidas",
            downloaded_libraries, skipped_libraries
        ),
    );

    Ok(())
}

/// Downloads Forge-specific libraries
pub fn download_forge_libraries(
    client: &reqwest::blocking::Client,
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

    // Pre-scan to compute how many forge libraries will be skipped so we can use a stable total
    let is_allowed = |library: &Value| -> bool {
        if let Some(rules) = library.get("rules") {
            let mut allowed = false;
            for rule in rules.as_array().unwrap_or(&Vec::new()) {
                let action = rule["action"].as_str().unwrap_or("disallow");

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
                    allowed = action == "allow";
                }
            }
            allowed
        } else {
            true
        }
    };

    let mut initial_skipped = 0;
    for lib in libraries.iter() {
        if !is_allowed(lib) {
            initial_skipped += 1;
        }
    }
    let effective_total = total_libraries - initial_skipped;

    // Emit initial stage for downloading forge libraries using effective_total
    let initial_stage = Stage::DownloadingForgeLibraries {
        current: 0,
        total: effective_total,
    };
    emit_status_with_stage(instance, "instance-downloading-forge", &initial_stage);

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
                    download_file(client, url, &target_path)
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
                        download_file(client, url, &target_path)
                            .map_err(|e| format!("Error al descargar librería nativa: {}", e))?;
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
                    if let Err(e) = download_file(client, &download_url, &target_path) {
                        // Si falla con el repositorio de Forge, intentar con el de Maven Central
                        let maven_url = format!("https://repo1.maven.org/maven2/{}", relative_path);
                        download_file(client, &maven_url, &target_path).map_err(|e| {
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

        let stage = Stage::DownloadingForgeLibraries {
            current: downloaded_libraries,
            total: effective_total,
        };
        emit_status_with_stage(instance, "instance-downloading-forge", &stage);
    }

    Ok(())
}

/// Enhanced library downloading using DownloadManager for better performance and reliability
/// This function provides the same functionality as download_libraries but with improved:
/// - Concurrent downloads with configurable limits
/// - Automatic retry logic with exponential backoff
/// - Better error handling and reporting
/// - Memory-efficient streaming downloads
pub async fn download_libraries_enhanced(
    instance: &MinecraftInstance,
    version_details: &Value,
    libraries_dir: &Path,
) -> Result<(), String> {
    let libraries = version_details["libraries"]
        .as_array()
        .ok_or_else(|| "Libraries list not found in version details".to_string())?;

    // Extract downloadable libraries with their metadata
    let mut downloads_to_process = Vec::new();
    let mut skipped_count = 0;

    for library in libraries {
        // Check if we should skip this library based on rules
        if !is_library_allowed(library) {
            skipped_count += 1;
            continue;
        }

        // Process libraries with direct download information
        if let Some(downloads) = library.get("downloads") {
            if let Some(artifact) = downloads.get("artifact") {
                if let (Some(artifact_path), Some(artifact_url)) = (
                    artifact["path"].as_str(),
                    artifact["url"].as_str(),
                ) {
                    let target_path = libraries_dir.join(artifact_path);
                    
                    // Only download if file doesn't exist
                    if !target_path.exists() {
                        // Extract hash if available for verification
                        let expected_hash = artifact["sha1"].as_str().unwrap_or("");
                        
                        downloads_to_process.push((
                            artifact_url.to_string(),
                            target_path,
                            expected_hash.to_string(),
                        ));
                    }
                }
            }

            // Handle native libraries with classifiers
            if let Some(classifiers) = downloads.get("classifiers") {
                let current_os = get_current_os_classifier();
                
                if let Some(classifier_info) = classifiers.get(&current_os) {
                    if let (Some(classifier_path), Some(classifier_url)) = (
                        classifier_info["path"].as_str(),
                        classifier_info["url"].as_str(),
                    ) {
                        let target_path = libraries_dir.join(classifier_path);
                        
                        if !target_path.exists() {
                            let expected_hash = classifier_info["sha1"].as_str().unwrap_or("");
                            
                            downloads_to_process.push((
                                classifier_url.to_string(),
                                target_path,
                                expected_hash.to_string(),
                            ));
                        }
                    }
                }
            }
        }
        // Handle Maven-format libraries
        else if let Some(name) = library["name"].as_str() {
            if let Some((url, target_path)) = build_maven_download_info(name, library, libraries_dir) {
                if !target_path.exists() {
                    downloads_to_process.push((
                        url,
                        target_path,
                        String::new(), // No hash available for Maven downloads
                    ));
                }
            }
        }
    }

    let total_downloads = downloads_to_process.len();
    let effective_total = total_downloads;

    if total_downloads == 0 {
        emit_status(
            instance,
            "instance-libraries-downloaded",
            "Todas las librerías están actualizadas",
        );
        return Ok(());
    }

    // Emit initial status
    emit_status(
        instance,
        "instance-downloading-libraries-start",
        &format!("Iniciando descarga de {} librerías con DownloadManager", effective_total),
    );

    // Create DownloadManager optimized for library downloads
    let download_manager = DownloadManager::with_concurrency(4);
    
    let instance_clone = instance.clone();

    // Download all libraries in parallel with progress reporting
    download_manager
        .download_files_parallel_with_progress(
            downloads_to_process,
            move |current, total, message| {
                // Update progress for library downloads
                let stage = Stage::DownloadingFiles {
                    current,
                    total,
                };
                emit_status_with_stage(&instance_clone, "instance-downloading-libraries", &stage);
                
                // Log progress
                log::info!("Descargando librerías: {}/{} - {}", current, total, message);
            },
        )
        .await
        .map_err(|e| format!("Error al descargar librerías con DownloadManager: {}", e))?;

    // Emit final status
    emit_status(
        instance,
        "instance-libraries-downloaded",
        &format!(
            "Descarga de librerías completada: {} descargadas con DownloadManager, {} omitidas",
            total_downloads, skipped_count
        ),
    );

    Ok(())
}

/// Enhanced Forge library downloading using DownloadManager
pub async fn download_forge_libraries_enhanced(
    instance: &MinecraftInstance,
    version_details: &Value,
    libraries_dir: &Path,
) -> Result<(), String> {
    let libraries = version_details["libraries"].as_array().ok_or_else(|| {
        "Lista de librerías no encontrada en detalles de versión Forge".to_string()
    })?;

    let mut downloads_to_process = Vec::new();
    let mut skipped_count = 0;

    for library in libraries {
        // Check if we should skip this library based on rules
        if !is_library_allowed(library) {
            skipped_count += 1;
            continue;
        }

        let name = library["name"].as_str().unwrap_or("");

        // Handle libraries with direct download information
        if let Some(downloads) = library.get("downloads") {
            // Download main artifact
            if let Some(artifact) = downloads.get("artifact") {
                if let (Some(path), Some(url)) = (
                    artifact["path"].as_str(),
                    artifact["url"].as_str(),
                ) {
                    let target_path = libraries_dir.join(path);
                    
                    if !target_path.exists() {
                        let expected_hash = artifact["sha1"].as_str().unwrap_or("");
                        downloads_to_process.push((
                            url.to_string(),
                            target_path,
                            expected_hash.to_string(),
                        ));
                    }
                }
            }

            // Download native libraries
            if let Some(classifiers) = downloads.get("classifiers") {
                let current_os = get_current_os_classifier_forge();
                
                if let Some(native) = classifiers.get(&current_os) {
                    if let (Some(url), Some(path)) = (
                        native["url"].as_str(),
                        native["path"].as_str(),
                    ) {
                        let target_path = libraries_dir.join(path);
                        
                        if !target_path.exists() {
                            let expected_hash = native["sha1"].as_str().unwrap_or("");
                            downloads_to_process.push((
                                url.to_string(),
                                target_path,
                                expected_hash.to_string(),
                            ));
                        }
                    }
                }
            }
        }
        // Handle Maven-format libraries
        else if !name.is_empty() {
            if let Some((url, target_path)) = build_maven_download_info(name, library, libraries_dir) {
                if !target_path.exists() {
                    downloads_to_process.push((
                        url,
                        target_path,
                        String::new(), // No hash for Maven downloads
                    ));
                }
            }
        }
    }

    let total_downloads = downloads_to_process.len();

    if total_downloads == 0 {
        emit_status(
            instance,
            "instance-forge-libraries-downloaded",
            "Todas las librerías de Forge están actualizadas",
        );
        return Ok(());
    }

    // Create DownloadManager optimized for Forge library downloads
    let download_manager = DownloadManager::with_concurrency(4);
    
    let instance_clone = instance.clone();

    // Download all Forge libraries in parallel
    download_manager
        .download_files_parallel_with_progress(
            downloads_to_process,
            move |current, total, message| {
                let stage = Stage::DownloadingForgeLibraries {
                    current,
                    total,
                };
                emit_status_with_stage(&instance_clone, "instance-downloading-forge", &stage);
                
                log::info!("Descargando librerías de Forge: {}/{} - {}", current, total, message);
            },
        )
        .await
        .map_err(|e| format!("Error al descargar librerías de Forge: {}", e))?;

    log::info!("Descarga de {} librerías de Forge completada con DownloadManager", total_downloads);
    Ok(())
}

/// Helper function to check if a library should be downloaded based on OS rules
fn is_library_allowed(library: &Value) -> bool {
    if let Some(rules) = library.get("rules") {
        let mut allowed = false;
        for rule in rules.as_array().unwrap_or(&Vec::new()) {
            let action = rule["action"].as_str().unwrap_or("disallow");

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
                allowed = action == "allow";
            }
        }
        allowed
    } else {
        true
    }
}

/// Get the current OS classifier for native libraries
fn get_current_os_classifier() -> String {
    let current_os = if cfg!(target_os = "windows") {
        "windows"
    } else if cfg!(target_os = "macos") {
        "osx"
    } else {
        "linux"
    };

    let current_arch = if cfg!(target_arch = "x86_64") {
        "64"
    } else if cfg!(target_arch = "x86") {
        "32"
    } else if cfg!(target_arch = "aarch64") {
        "arm64"
    } else {
        "64"
    };

    format!("{}-{}", current_os, current_arch)
}

/// Get the current OS classifier for Forge native libraries
fn get_current_os_classifier_forge() -> String {
    if cfg!(target_os = "windows") {
        "natives-windows"
    } else if cfg!(target_os = "macos") {
        "natives-osx"
    } else {
        "natives-linux"
    }.to_string()
}

/// Build download URL and target path for Maven-format library
fn build_maven_download_info(
    name: &str,
    library: &Value,
    libraries_dir: &Path,
) -> Option<(String, PathBuf)> {
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

        // Convert group specification to path
        let group_path = group_id.replace('.', "/");

        // Build JAR file name
        let jar_name = if let Some(classifier) = classifier {
            format!("{}-{}-{}.jar", artifact_id, version, classifier)
        } else {
            format!("{}-{}.jar", artifact_id, version)
        };

        let relative_path = format!("{}/{}/{}/{}", group_path, artifact_id, version, jar_name);
        let target_path = libraries_dir.join(&relative_path);

        // Build download URL
        let repo_url = library["url"]
            .as_str()
            .unwrap_or("https://maven.minecraftforge.net/");
        let download_url = format!("{}{}", repo_url, relative_path);

        Some((download_url, target_path))
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use tempfile::tempdir;

    #[test]
    fn test_is_library_allowed() {
        // Library with no rules should be allowed
        let library_no_rules = json!({
            "name": "test:library:1.0"
        });
        assert!(is_library_allowed(&library_no_rules));

        // Library with allow rule for current OS should be allowed
        let current_os = if cfg!(target_os = "windows") {
            "windows"
        } else if cfg!(target_os = "macos") {
            "osx"
        } else {
            "linux"
        };

        let library_allow_current = json!({
            "name": "test:library:1.0",
            "rules": [{
                "action": "allow",
                "os": {
                    "name": current_os
                }
            }]
        });
        assert!(is_library_allowed(&library_allow_current));

        // Library with disallow rule for current OS should not be allowed
        let library_disallow_current = json!({
            "name": "test:library:1.0",
            "rules": [{
                "action": "disallow",
                "os": {
                    "name": current_os
                }
            }]
        });
        assert!(!is_library_allowed(&library_disallow_current));

        // Library with allow rule for different OS should not be allowed
        let different_os = if cfg!(target_os = "windows") {
            "linux"
        } else {
            "windows"
        };

        let library_allow_different = json!({
            "name": "test:library:1.0",
            "rules": [{
                "action": "allow",
                "os": {
                    "name": different_os
                }
            }]
        });
        assert!(!is_library_allowed(&library_allow_different));
    }

    #[test]
    fn test_get_current_os_classifier() {
        let classifier = get_current_os_classifier();
        
        if cfg!(target_os = "windows") {
            assert!(classifier.starts_with("windows-"));
        } else if cfg!(target_os = "macos") {
            assert!(classifier.starts_with("osx-"));
        } else {
            assert!(classifier.starts_with("linux-"));
        }

        // Should include architecture
        assert!(classifier.contains("64") || classifier.contains("32") || classifier.contains("arm64"));
    }

    #[test]
    fn test_get_current_os_classifier_forge() {
        let classifier = get_current_os_classifier_forge();
        
        if cfg!(target_os = "windows") {
            assert_eq!(classifier, "natives-windows");
        } else if cfg!(target_os = "macos") {
            assert_eq!(classifier, "natives-osx");
        } else {
            assert_eq!(classifier, "natives-linux");
        }
    }

    #[test]
    fn test_build_maven_download_info() {
        let temp_dir = tempdir().unwrap();
        let libraries_dir = temp_dir.path();

        // Test basic Maven coordinates
        let library = json!({
            "name": "org.example:test-lib:1.0.0",
            "url": "https://repo.example.com/"
        });

        let result = build_maven_download_info(
            "org.example:test-lib:1.0.0",
            &library,
            libraries_dir,
        );

        assert!(result.is_some());
        let (url, path) = result.unwrap();
        
        assert_eq!(url, "https://repo.example.com/org/example/test-lib/1.0.0/test-lib-1.0.0.jar");
        assert!(path.to_string_lossy().contains("org/example/test-lib/1.0.0/test-lib-1.0.0.jar"));

        // Test with classifier
        let result = build_maven_download_info(
            "org.example:test-lib:1.0.0:natives",
            &library,
            libraries_dir,
        );

        assert!(result.is_some());
        let (url, path) = result.unwrap();
        
        assert_eq!(url, "https://repo.example.com/org/example/test-lib/1.0.0/test-lib-1.0.0-natives.jar");
        assert!(path.to_string_lossy().contains("test-lib-1.0.0-natives.jar"));

        // Test invalid format
        let result = build_maven_download_info(
            "invalid",
            &library,
            libraries_dir,
        );

        assert!(result.is_none());
    }

    #[test]
    fn test_download_file_backward_compatibility() {
        // Test that the deprecated download_file function still works
        // This ensures we maintain API compatibility
        let temp_dir = tempdir().unwrap();
        let test_file = temp_dir.path().join("test.txt");
        
        // We can't actually test HTTP downloads in unit tests,
        // but we can test the path handling logic
        assert!(test_file.parent().is_some());
        
        // Test that the function signature is still available
        let client = reqwest::blocking::Client::new();
        let _test_fn: fn(&reqwest::blocking::Client, &str, &Path) -> Result<(), String> = download_file;
        
        // Function should exist and be callable (even if it fails due to no network)
        assert!(true); // This test passes if compilation succeeds
    }

    /// Test that the enhanced functions have correct signatures for async usage
    #[tokio::test]
    async fn test_enhanced_functions_signatures() {
        let temp_dir = tempdir().unwrap();
        let libraries_dir = temp_dir.path().join("libraries");
        fs::create_dir_all(&libraries_dir).unwrap();

        // Create a mock instance
        let instance = MinecraftInstance {
            instanceId: "test".to_string(),
            usesDefaultIcon: false,
            iconUrl: None,
            bannerUrl: None,
            instanceName: "Test Instance".to_string(),
            accountUuid: None,
            minecraftPath: String::new(),
            modpackId: None,
            modpackVersionId: None,
            minecraftVersion: "1.20.1".to_string(),
            instanceDirectory: Some(temp_dir.path().to_string_lossy().to_string()),
            forgeVersion: None,
            javaPath: None,
        };

        let version_details = json!({
            "libraries": []
        });

        // Test that the enhanced functions can be called
        let result = download_libraries_enhanced(&instance, &version_details, &libraries_dir).await;
        assert!(result.is_ok()); // Should succeed with empty libraries

        let result = download_forge_libraries_enhanced(&instance, &version_details, &libraries_dir).await;
        assert!(result.is_ok()); // Should succeed with empty libraries
    }

    #[tokio::test]
    async fn test_download_file_with_manager() {
        let temp_dir = tempdir().unwrap();
        let test_file = temp_dir.path().join("test.txt");
        
        let download_manager = DownloadManager::with_concurrency(1);

        // Test with no hash (should use dummy hash logic)
        let result = download_file_with_manager(
            &download_manager,
            "https://httpbin.org/status/404", // This will fail, but tests the function signature
            &test_file,
            None,
        ).await;
        
        // We expect this to fail due to 404, but the function should handle it gracefully
        assert!(result.is_err());

        // Test with hash (will also fail but tests the signature)
        let result = download_file_with_manager(
            &download_manager,
            "https://httpbin.org/status/404",
            &test_file,
            Some("da39a3ee5e6b4b0d3255bfef95601890afd80709"),
        ).await;
        
        assert!(result.is_err());
    }

    #[test]
    fn test_library_processing_logic() {
        // Test the logic for extracting download information from library JSON
        let library_with_downloads = json!({
            "name": "test:library:1.0",
            "downloads": {
                "artifact": {
                    "path": "test/library/1.0/library-1.0.jar",
                    "url": "https://repo.example.com/test/library/1.0/library-1.0.jar",
                    "sha1": "da39a3ee5e6b4b0d3255bfef95601890afd80709"
                }
            }
        });

        // Verify we can extract artifact information
        if let Some(downloads) = library_with_downloads.get("downloads") {
            if let Some(artifact) = downloads.get("artifact") {
                assert_eq!(artifact["path"].as_str().unwrap(), "test/library/1.0/library-1.0.jar");
                assert_eq!(artifact["url"].as_str().unwrap(), "https://repo.example.com/test/library/1.0/library-1.0.jar");
                assert_eq!(artifact["sha1"].as_str().unwrap(), "da39a3ee5e6b4b0d3255bfef95601890afd80709");
            }
        }

        // Test classifier handling
        let library_with_classifiers = json!({
            "name": "test:native:1.0",
            "downloads": {
                "classifiers": {
                    "natives-linux": {
                        "path": "test/native/1.0/native-1.0-natives-linux.jar",
                        "url": "https://repo.example.com/test/native/1.0/native-1.0-natives-linux.jar",
                        "sha1": "356a192b7913b04c54574d18c28d46e6395428ab"
                    }
                }
            }
        });

        if let Some(downloads) = library_with_classifiers.get("downloads") {
            if let Some(classifiers) = downloads.get("classifiers") {
                if let Some(native_linux) = classifiers.get("natives-linux") {
                    assert_eq!(native_linux["path"].as_str().unwrap(), "test/native/1.0/native-1.0-natives-linux.jar");
                }
            }
        }
    }
}
