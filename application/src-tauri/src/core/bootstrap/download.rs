// src/core/bootstrap/download.rs
// Download-related functionality extracted from instance_bootstrap.rs

use crate::core::bootstrap::tasks::{emit_status, emit_status_with_stage, Stage};
use crate::core::minecraft_instance::MinecraftInstance;
use crate::core::modpack_file_manager::DownloadManager;
use serde_json::Value;
use std::fs;
use itertools::Itertools;
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
pub async fn download_file_with_manager(
    download_manager: &DownloadManager,
    url: &str,
    destination: &Path,
    expected_hash: Option<&str>,
) -> Result<(), String> {
    match expected_hash {
        Some(hash) => {
            download_manager
                .download_file_with_hash(url, destination, hash)
                .await
        }
        None => {
            let dummy_hash = "0000000000000000000000000000000000000000";
            match download_manager
                .download_file_with_hash(url, destination, dummy_hash)
                .await
            {
                Ok(()) => Ok(()),
                Err(e) if e.contains("Hash mismatch") => {
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

    // Partition libraries into allowed and skipped. Collect skipped items so we can
    // compute the skipped count from the resulting Vec's length.
    let (allowed_libraries, skipped): (Vec<_>, Vec<_>) = libraries
        .iter()
        .partition_map(|lib| {
            if is_library_allowed(lib) {
                itertools::Either::Left(lib)
            } else {
                itertools::Either::Right(lib)
            }
        });

    let skipped_count = skipped.len();

    let effective_total = allowed_libraries.len();

    emit_status(
        instance,
        "instance-downloading-libraries-start",
        &format!("Iniciando descarga de {} librerías", effective_total),
    );

    emit_status_with_stage(
        instance,
        "instance-downloading-libraries",
        &Stage::DownloadingFiles {
            current: 0,
            total: effective_total,
        },
    );

    for (index, library) in allowed_libraries.iter().enumerate() {
        process_library(client, library, libraries_dir, instance)?;

        let stage = Stage::DownloadingFiles {
            current: index + 1,
            total: effective_total,
        };
        emit_status_with_stage(instance, "instance-downloading-libraries", &stage);
    }

    emit_status(
        instance,
        "instance-libraries-downloaded",
        &format!(
            "Descarga de librerías completada: {} descargadas, {} omitidas",
            effective_total, skipped_count
        ),
    );

    Ok(())
}

/// Process a single library (vanilla or forge)
fn process_library(
    client: &reqwest::blocking::Client,
    library: &Value,
    libraries_dir: &Path,
    instance: &MinecraftInstance,
) -> Result<(), String> {
    if let Some(downloads) = library.get("downloads") {
        download_artifact(client, downloads, libraries_dir, instance)?;
        download_classifiers(client, downloads, libraries_dir, instance)?;
    } else if let Some(name) = library["name"].as_str() {
        download_maven_library(client, name, library, libraries_dir, instance)?;
    }
    Ok(())
}

/// Download main artifact
fn download_artifact(
    client: &reqwest::blocking::Client,
    downloads: &Value,
    libraries_dir: &Path,
    instance: &MinecraftInstance,
) -> Result<(), String> {
    if let Some(artifact) = downloads.get("artifact") {
        let path = artifact["path"]
            .as_str()
            .ok_or("Artifact path not found")?;
        let url = artifact["url"].as_str().ok_or("Artifact URL not found")?;
        let target_path = libraries_dir.join(path);

        if !target_path.exists() {
            create_parent_dirs(&target_path)?;
            emit_status(
                instance,
                "instance-downloading-library",
                &format!("Descargando librería: {}", path),
            );
            download_file(client, url, &target_path)?;
        }
    }
    Ok(())
}

/// Download native classifiers
fn download_classifiers(
    client: &reqwest::blocking::Client,
    downloads: &Value,
    libraries_dir: &Path,
    instance: &MinecraftInstance,
) -> Result<(), String> {
    let Some(classifiers) = downloads.get("classifiers") else {
        return Ok(());
    };

    let classifier_keys = get_classifier_keys();

    for key in classifier_keys {
        if let Some(classifier_info) = classifiers.get(&key) {
            let path = classifier_info["path"]
                .as_str()
                .ok_or("Classifier path not found")?;
            let url = classifier_info["url"]
                .as_str()
                .ok_or("Classifier URL not found")?;
            let target_path = libraries_dir.join(path);

            if !target_path.exists() {
                create_parent_dirs(&target_path)?;
                emit_status(
                    instance,
                    "instance-downloading-native-library",
                    &format!("Descargando biblioteca nativa: {}", path),
                );
                download_file(client, url, &target_path)?;
            }
            break;
        }
    }

    Ok(())
}

/// Download Maven-format library
fn download_maven_library(
    client: &reqwest::blocking::Client,
    name: &str,
    library: &Value,
    libraries_dir: &Path,
    instance: &MinecraftInstance,
) -> Result<(), String> {
    let Some((download_url, target_path, jar_name)) =
        build_maven_info(name, library, libraries_dir)
    else {
        return Ok(());
    };

    if target_path.exists() {
        return Ok(());
    }

    create_parent_dirs(&target_path)?;
    emit_status(
        instance,
        "instance-downloading-library",
        &format!("Descargando librería Maven: {}", jar_name),
    );

    download_file(client, &download_url, &target_path).or_else(|_| {
        let maven_url = download_url.replace("maven.minecraftforge.net", "repo1.maven.org/maven2");
        download_file(client, &maven_url, &target_path)
    })?;

    Ok(())
}

/// Downloads Forge-specific libraries
pub fn download_forge_libraries(
    client: &reqwest::blocking::Client,
    version_details: &Value,
    libraries_dir: &Path,
    instance: &MinecraftInstance,
) -> Result<(), String> {
    let libraries = version_details["libraries"]
        .as_array()
        .ok_or("Lista de librerías no encontrada en detalles de versión Forge")?;

    let allowed_libraries: Vec<_> = libraries
        .iter()
        .filter(|lib| is_library_allowed(lib))
        .collect();

    let skipped_count = libraries.len() - allowed_libraries.len();
    let effective_total = allowed_libraries.len();

    emit_status_with_stage(
        instance,
        "instance-downloading-forge",
        &Stage::DownloadingForgeLibraries {
            current: 0,
            total: effective_total,
        },
    );

    for (index, library) in allowed_libraries.iter().enumerate() {
        process_library(client, library, libraries_dir, instance)?;

        emit_status_with_stage(
            instance,
            "instance-downloading-forge",
            &Stage::DownloadingForgeLibraries {
                current: index + 1,
                total: effective_total,
            },
        );
    }

    Ok(())
}

/// Enhanced library downloading using DownloadManager
pub async fn download_libraries_enhanced(
    instance: &MinecraftInstance,
    version_details: &Value,
    libraries_dir: &Path,
) -> Result<(), String> {
    let libraries = version_details["libraries"]
        .as_array()
        .ok_or("Libraries list not found in version details")?;

    let downloads_to_process = collect_downloads(libraries, libraries_dir)?;
    let total_downloads = downloads_to_process.len();

    if total_downloads == 0 {
        emit_status(
            instance,
            "instance-libraries-downloaded",
            "Todas las librerías están actualizadas",
        );
        return Ok(());
    }

    emit_status(
        instance,
        "instance-downloading-libraries-start",
        &format!(
            "Iniciando descarga de {} librerías con DownloadManager",
            total_downloads
        ),
    );

    let download_manager = DownloadManager::with_concurrency(4);
    let instance_clone = instance.clone();

    download_manager
        .download_files_parallel_with_progress(
            downloads_to_process,
            move |current, total, message| {
                emit_status_with_stage(
                    &instance_clone,
                    "instance-downloading-libraries",
                    &Stage::DownloadingFiles { current, total },
                );
                log::info!("Descargando librerías: {}/{} - {}", current, total, message);
            },
        )
        .await
        .map_err(|e| format!("Error al descargar librerías con DownloadManager: {}", e))?;

    emit_status(
        instance,
        "instance-libraries-downloaded",
        &format!("Descarga de librerías completada: {} descargadas", total_downloads),
    );

    Ok(())
}

/// Enhanced Forge library downloading using DownloadManager
pub async fn download_forge_libraries_enhanced(
    instance: &MinecraftInstance,
    version_details: &Value,
    libraries_dir: &Path,
) -> Result<(), String> {
    let libraries = version_details["libraries"]
        .as_array()
        .ok_or("Lista de librerías no encontrada en detalles de versión Forge")?;

    let downloads_to_process = collect_downloads(libraries, libraries_dir)?;
    let total_downloads = downloads_to_process.len();

    if total_downloads == 0 {
        emit_status(
            instance,
            "instance-forge-libraries-downloaded",
            "Todas las librerías de Forge están actualizadas",
        );
        return Ok(());
    }

    let download_manager = DownloadManager::with_concurrency(4);
    let instance_clone = instance.clone();

    download_manager
        .download_files_parallel_with_progress(
            downloads_to_process,
            move |current, total, message| {
                emit_status_with_stage(
                    &instance_clone,
                    "instance-downloading-forge",
                    &Stage::DownloadingForgeLibraries { current, total },
                );
                log::info!("Descargando librerías de Forge: {}/{} - {}", current, total, message);
            },
        )
        .await
        .map_err(|e| format!("Error al descargar librerías de Forge: {}", e))?;

    log::info!("Descarga de {} librerías de Forge completada", total_downloads);
    Ok(())
}

// ============================================================================
// Helper Functions
// ============================================================================

/// Check if a library should be downloaded based on OS rules
fn is_library_allowed(library: &Value) -> bool {
    let Some(rules) = library.get("rules") else {
        return true;
    };

    let current_os = get_current_os();
    let mut allowed = false;

    for rule in rules.as_array().unwrap_or(&Vec::new()) {
        let action = rule["action"].as_str().unwrap_or("disallow");

        if let Some(os) = rule.get("os") {
            if os["name"].as_str() == Some(current_os) {
                allowed = action == "allow";
            }
        } else {
            allowed = action == "allow";
        }
    }

    allowed
}

/// Get current OS name
fn get_current_os() -> &'static str {
    if cfg!(target_os = "windows") {
        "windows"
    } else if cfg!(target_os = "macos") {
        "osx"
    } else {
        "linux"
    }
}

/// Get current architecture
fn get_current_arch() -> &'static str {
    if cfg!(target_arch = "x86_64") {
        "64"
    } else if cfg!(target_arch = "aarch64") {
        "arm64"
    } else {
        "32"
    }
}

/// Get classifier keys for current platform
fn get_classifier_keys() -> Vec<String> {
    vec![
        format!("{}-{}", get_current_os(), get_current_arch()),
        format!("natives-{}", get_current_os()),
        "natives".to_string(),
    ]
}

/// Create parent directories if they don't exist
fn create_parent_dirs(path: &Path) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Error creating directory: {}", e))?;
    }
    Ok(())
}

/// Build Maven download information
fn build_maven_info(
    name: &str,
    library: &Value,
    libraries_dir: &Path,
) -> Option<(String, PathBuf, String)> {
    let parts: Vec<&str> = name.split(':').collect();
    if parts.len() < 3 {
        return None;
    }

    let (group_id, artifact_id, version) = (parts[0], parts[1], parts[2]);
    let classifier = parts.get(3).copied();

    let group_path = group_id.replace('.', "/");
    let jar_name = match classifier {
        Some(c) => format!("{}-{}-{}.jar", artifact_id, version, c),
        None => format!("{}-{}.jar", artifact_id, version),
    };

    let relative_path = format!("{}/{}/{}/{}", group_path, artifact_id, version, jar_name);
    let target_path = libraries_dir.join(&relative_path);

    let repo_url = library["url"]
        .as_str()
        .unwrap_or("https://maven.minecraftforge.net/");
    let download_url = format!("{}{}", repo_url, relative_path);

    Some((download_url, target_path, jar_name))
}

/// Collect all downloads from libraries
fn collect_downloads(
    libraries: &[Value],
    libraries_dir: &Path,
) -> Result<Vec<(String, PathBuf, String)>, String> {
    let mut downloads = Vec::new();

    for library in libraries {
        if !is_library_allowed(library) {
            continue;
        }

        if let Some(lib_downloads) = library.get("downloads") {
            // Main artifact
            if let Some(artifact) = lib_downloads.get("artifact") {
                if let (Some(path), Some(url)) = (artifact["path"].as_str(), artifact["url"].as_str()) {
                    let target_path = libraries_dir.join(path);
                    if !target_path.exists() {
                        let hash = artifact["sha1"].as_str().unwrap_or("").to_string();
                        downloads.push((url.to_string(), target_path, hash));
                    }
                }
            }

            // Classifiers
            if let Some(classifiers) = lib_downloads.get("classifiers") {
                for key in get_classifier_keys() {
                    if let Some(classifier) = classifiers.get(&key) {
                        if let (Some(path), Some(url)) =
                            (classifier["path"].as_str(), classifier["url"].as_str())
                        {
                            let target_path = libraries_dir.join(path);
                            if !target_path.exists() {
                                let hash = classifier["sha1"].as_str().unwrap_or("").to_string();
                                downloads.push((url.to_string(), target_path, hash));
                            }
                        }
                        break;
                    }
                }
            }
        } else if let Some(name) = library["name"].as_str() {
            if let Some((url, target_path, _)) = build_maven_info(name, library, libraries_dir) {
                if !target_path.exists() {
                    downloads.push((url, target_path, String::new()));
                }
            }
        }
    }

    Ok(downloads)
}