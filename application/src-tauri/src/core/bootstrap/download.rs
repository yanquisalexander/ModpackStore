// src/core/bootstrap/download.rs
// Download-related functionality extracted from instance_bootstrap.rs
// 
// NOTE: Asset downloads have been successfully migrated to use DownloadManager for
// concurrent downloads, retries, and unified progress reporting. The functions in this 
// module still use the legacy blocking download approach for libraries, JARs, and manifests.
// 
// TODO: Consider migrating remaining download types to DownloadManager for full consistency:
//   - Library downloads (download_libraries, download_forge_libraries)
//   - JAR downloads (client JARs, forge installers)
//   - Manifest downloads (version JSON files)
// This would provide the same performance benefits and unified UX for all download types.

use crate::core::bootstrap::tasks::{emit_status, emit_status_with_stage, Stage};
use crate::core::minecraft_instance::MinecraftInstance;
use serde_json::Value;
use std::fs;
use std::path::Path;
use tauri_plugin_http::reqwest;

/// Downloads a file from the given URL to the specified destination
/// Creates parent directories if they don't exist
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
