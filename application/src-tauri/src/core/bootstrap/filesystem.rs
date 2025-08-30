// src/core/bootstrap/filesystem.rs
// Filesystem operations extracted from instance_bootstrap.rs

use crate::core::minecraft_instance::MinecraftInstance;
use crate::core::bootstrap::tasks::emit_status;
use serde_json::Value;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};

/// Creates the standard directory structure for a Minecraft instance
pub fn create_minecraft_directories(
    minecraft_dir: &Path,
    minecraft_version: &str,
) -> Result<(PathBuf, PathBuf, PathBuf, PathBuf, PathBuf), String> {
    // Create required subdirectories
    let versions_dir = minecraft_dir.join("versions");
    let libraries_dir = minecraft_dir.join("libraries");
    let assets_dir = minecraft_dir.join("assets");
    let version_dir = versions_dir.join(minecraft_version);
    let natives_dir = minecraft_dir.join("natives").join(minecraft_version);

    let directories = [
        ("versions", &versions_dir),
        ("libraries", &libraries_dir),
        ("assets", &assets_dir),
        ("version", &version_dir),
        ("natives", &natives_dir),
    ];

    for (dir_name, dir_path) in &directories {
        if !dir_path.exists() {
            fs::create_dir_all(dir_path).map_err(|e| {
                format!("Error creating directory {}: {}", dir_path.display(), e)
            })?;
        }
    }

    Ok((versions_dir, libraries_dir, assets_dir, version_dir, natives_dir))
}

/// Creates a launcher_profiles.json file if it doesn't exist
pub fn create_launcher_profiles(minecraft_dir: &Path) -> Result<(), String> {
    let launcher_profiles_path = minecraft_dir.join("launcher_profiles.json");
    if !launcher_profiles_path.exists() {
        let default_profiles = serde_json::json!({
            "profiles": {},
            "settings": {},
            "version": 3
        });

        fs::write(&launcher_profiles_path, default_profiles.to_string())
            .map_err(|e| format!("Error creating launcher_profiles.json: {}", e))?;
    }
    Ok(())
}

/// Extracts native libraries from JAR files to the natives directory
pub fn extract_natives(
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

    emit_status(
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

            emit_status(
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

                // Si el archivo no existe, ya debería haber sido descargado por download_libraries
                if !library_path.exists() {
                    continue; // Skip this library if not downloaded
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
                emit_status(
                    instance,
                    "instance-extracting-native-library",
                    &format!("Extrayendo biblioteca nativa: {}", path),
                );

                extract_jar_file(&library_path, natives_dir, &exclude_patterns)?;
            }
        }
    }

    Ok(())
}

/// Helper function to extract a JAR file to a directory, excluding specified patterns
fn extract_jar_file(
    jar_path: &Path,
    target_dir: &Path,
    exclude_patterns: &[String],
) -> Result<(), String> {
    // Abrir el archivo JAR
    let file = fs::File::open(jar_path)
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
            let output_path = target_dir.join(file_name);

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

    Ok(())
}

/// Creates asset directories required for Minecraft
pub fn create_asset_directories(minecraft_dir: &Path) -> Result<(PathBuf, PathBuf), io::Error> {
    let assets_dir = minecraft_dir.join("assets");
    let assets_indexes_dir = assets_dir.join("indexes");
    let assets_objects_dir = assets_dir.join("objects");

    // Create directories if they don't exist
    fs::create_dir_all(&assets_indexes_dir)?;
    fs::create_dir_all(&assets_objects_dir)?;

    Ok((assets_indexes_dir, assets_objects_dir))
}