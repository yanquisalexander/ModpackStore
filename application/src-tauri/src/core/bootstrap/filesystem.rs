// src/core/bootstrap/filesystem.rs
// Filesystem operations extracted from instance_bootstrap.rs

use crate::core::bootstrap::tasks::{emit_status, emit_status_with_stage, Stage};
use crate::core::minecraft_instance::MinecraftInstance;
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
            fs::create_dir_all(dir_path)
                .map_err(|e| format!("Error creating directory {}: {}", dir_path.display(), e))?;
        }
    }

    Ok((
        versions_dir,
        libraries_dir,
        assets_dir,
        version_dir,
        natives_dir,
    ))
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

/// Extracts native libraries from JAR files to the natives directory (IMPROVED VERSION)
pub fn extract_natives(
    version_details: &Value,
    libraries_dir: &Path,
    natives_dir: &Path,
    instance: &MinecraftInstance,
) -> Result<(), String> {
    log::info!(
        "Iniciando extracción de nativos para instancia: {}",
        instance
            .instanceDirectory
            .as_ref()
            .unwrap_or(&"".to_string())
    );

    let os_info = get_os_info()?;
    log::info!("Detectado OS: {}, Arch: {}", os_info.name, os_info.arch);

    let libraries = version_details["libraries"].as_array().ok_or_else(|| {
        log::error!("No se encontraron bibliotecas en el manifiesto de versión");
        "No se encontraron bibliotecas en el manifiesto".to_string()
    })?;

    // Filter native libraries more accurately
    let native_libraries: Vec<&Value> = libraries
        .iter()
        .filter(|lib| is_native_library(lib, &os_info))
        .collect();

    let total_native_libraries = native_libraries.len();
    log::info!(
        "Encontradas {} bibliotecas con nativos",
        total_native_libraries
    );

    if total_native_libraries == 0 {
        log::info!("No se encontraron bibliotecas nativas para procesar");
        return Ok(());
    }

    emit_status(
        instance,
        "instance-extracting-natives-start",
        &format!(
            "Iniciando extracción de {} bibliotecas nativas",
            total_native_libraries
        ),
    );

    for (index, library) in native_libraries.iter().enumerate() {
        let progress = index + 1;
        let progress_percentage = (progress as f64 / total_native_libraries as f64) * 100.0;

        log::info!(
            "Procesando biblioteca nativa {}/{}",
            progress,
            total_native_libraries
        );

        let stage = Stage::ExtractingLibraries {
            current: progress,
            total: total_native_libraries,
        };
        emit_status_with_stage(instance, "instance-extracting-natives-progress", &stage);

        if let Err(e) =
            extract_single_native_library(library, libraries_dir, natives_dir, &os_info, instance)
        {
            log::error!("Error procesando biblioteca nativa: {}", e);
            emit_status(
                instance,
                "instance-native-extraction-error",
                &format!("Error en biblioteca nativa: {}", e),
            );
            // Continue with other libraries instead of failing completely
        }
    }

    log::info!("Extracción de bibliotecas nativas completada");
    Ok(())
}

#[derive(Debug)]
struct OsInfo {
    name: String,
    arch: String,
    classifier: String,
}

fn get_os_info() -> Result<OsInfo, String> {
    let os = std::env::consts::OS;
    let arch = std::env::consts::ARCH;

    let os_name = match os {
        "windows" => "windows",
        "macos" => "osx",
        "linux" => "linux",
        _ => return Err(format!("Sistema operativo no soportado: {}", os)),
    };

    let arch_name = match arch {
        "x86_64" => "64",
        "x86" => "32",
        "aarch64" => "arm64",
        _ => return Err(format!("Arquitectura no soportada: {}", arch)),
    };

    // Build the classifier that Minecraft uses
    let classifier = format!("natives-{}", os_name);

    Ok(OsInfo {
        name: os_name.to_string(),
        arch: arch_name.to_string(),
        classifier,
    })
}

fn is_native_library(library: &Value, os_info: &OsInfo) -> bool {
    // Check if library has natives object with our OS
    if let Some(natives) = library.get("natives") {
        if natives.get(&os_info.name).is_some() {
            // Also check rules to ensure this library should be included
            return should_include_library(library, os_info);
        }
    }

    // Check if library name contains natives classifier
    if let Some(name) = library.get("name").and_then(|n| n.as_str()) {
        if name.contains(&os_info.classifier) {
            return should_include_library(library, os_info);
        }
    }

    false
}

fn should_include_library(library: &Value, os_info: &OsInfo) -> bool {
    // Check rules array for allow/disallow conditions
    if let Some(rules) = library.get("rules").and_then(|r| r.as_array()) {
        let mut allowed = false; // Default deny if rules exist

        for rule in rules {
            if let Some(action) = rule.get("action").and_then(|a| a.as_str()) {
                let rule_matches = if let Some(os_rule) = rule.get("os") {
                    check_os_rule(os_rule, os_info)
                } else {
                    true // Rule applies to all OS if no OS specified
                };

                if rule_matches {
                    match action {
                        "allow" => allowed = true,
                        "disallow" => return false, // Explicit deny
                        _ => {}
                    }
                }
            }
        }
        allowed
    } else {
        true // No rules means allowed by default
    }
}

fn check_os_rule(os_rule: &Value, os_info: &OsInfo) -> bool {
    if let Some(rule_name) = os_rule.get("name").and_then(|n| n.as_str()) {
        if rule_name != os_info.name {
            return false;
        }
    }

    if let Some(rule_arch) = os_rule.get("arch").and_then(|a| a.as_str()) {
        // Match against system architecture
        let system_arch = std::env::consts::ARCH;
        if rule_arch != system_arch {
            return false;
        }
    }

    true
}

fn extract_single_native_library(
    library: &Value,
    libraries_dir: &Path,
    natives_dir: &Path,
    os_info: &OsInfo,
    instance: &MinecraftInstance,
) -> Result<(), String> {
    let library_path = get_native_library_path(library, libraries_dir, os_info)?;

    if !library_path.exists() {
        return Err(format!(
            "Archivo de biblioteca nativa no encontrado: {}",
            library_path.display()
        ));
    }

    let metadata = fs::metadata(&library_path)
        .map_err(|e| format!("Error obteniendo metadata del archivo: {}", e))?;

    if metadata.len() == 0 {
        return Err("Archivo de biblioteca nativa está vacío".to_string());
    }

    log::info!(
        "Extrayendo biblioteca nativa: {} ({} bytes)",
        library_path.display(),
        metadata.len()
    );

    // Get exclusion patterns
    let exclude_patterns = get_exclusion_patterns(library);

    emit_status(
        instance,
        "instance-extracting-native-library",
        &format!(
            "Extrayendo: {}",
            library_path
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
        ),
    );

    extract_jar_file(&library_path, natives_dir, &exclude_patterns)?;

    log::info!("Extracción completada para: {}", library_path.display());
    Ok(())
}

fn get_native_library_path(
    library: &Value,
    libraries_dir: &Path,
    os_info: &OsInfo,
) -> Result<PathBuf, String> {
    // Try to get classifier-specific download first
    if let Some(classifiers) = library.get("downloads").and_then(|d| d.get("classifiers")) {
        if let Some(natives) = library.get("natives") {
            if let Some(classifier_template) = natives.get(&os_info.name).and_then(|n| n.as_str()) {
                // Replace ${arch} placeholder if present
                let classifier = classifier_template.replace("${arch}", &os_info.arch);

                if let Some(classifier_info) = classifiers.get(&classifier) {
                    if let Some(path) = classifier_info.get("path").and_then(|p| p.as_str()) {
                        return Ok(libraries_dir.join(path));
                    }
                }
            }
        }
    }

    // Fallback to artifact download
    if let Some(artifact) = library.get("downloads").and_then(|d| d.get("artifact")) {
        if let Some(path) = artifact.get("path").and_then(|p| p.as_str()) {
            return Ok(libraries_dir.join(path));
        }
    }

    Err("No se encontró información de descarga para la biblioteca nativa".to_string())
}

fn get_exclusion_patterns(library: &Value) -> Vec<String> {
    if let Some(extract) = library.get("extract") {
        if let Some(exclude) = extract.get("exclude") {
            return exclude
                .as_array()
                .unwrap_or(&Vec::new())
                .iter()
                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                .collect();
        }
    }

    // Default exclusions for native libraries
    vec![
        "META-INF/".to_string(),
        "*.txt".to_string(),
        "*.xml".to_string(),
    ]
}

/// Helper function to extract a JAR file to a directory, excluding specified patterns
fn extract_jar_file(
    jar_path: &Path,
    target_dir: &Path,
    exclude_patterns: &[String],
) -> Result<(), String> {
    log::info!(
        "Iniciando extracción de JAR: {} -> {}",
        jar_path.display(),
        target_dir.display()
    );

    fs::create_dir_all(target_dir)
        .map_err(|e| format!("Error creando directorio de destino: {}", e))?;

    let file =
        fs::File::open(jar_path).map_err(|e| format!("Error abriendo archivo JAR: {}", e))?;

    let reader = std::io::BufReader::new(file);
    let mut archive =
        zip::ZipArchive::new(reader).map_err(|e| format!("Error leyendo archivo ZIP: {}", e))?;

    let mut extracted_count = 0;
    let mut skipped_count = 0;

    for i in 0..archive.len() {
        let mut file = archive
            .by_index(i)
            .map_err(|e| format!("Error obteniendo entrada ZIP: {}", e))?;

        // El nombre completo dentro del zip (ej: "org/lwjgl/lwjgl.dll")
        let full_path_in_zip = match file.enclosed_name() {
            Some(path) => path.to_owned(),
            None => continue,
        };

        // Skip directories y archivos excluidos
        if file.is_dir()
            || should_exclude_file(full_path_in_zip.to_str().unwrap_or(""), exclude_patterns)
        {
            skipped_count += 1;
            log::debug!(
                "Saltado: {} (directorio o excluido)",
                full_path_in_zip.display()
            );
            continue;
        }

        // --- INICIO DE LA CORRECCIÓN ---
        // Obtenemos solo el nombre del archivo final (ej: "lwjgl.dll")
        if let Some(file_name_only) = full_path_in_zip.file_name() {
            // Construimos la ruta de salida directamente en el directorio de destino
            let output_path = target_dir.join(file_name_only);

            // Ya no es necesario crear directorios padres, porque estamos aplanando la estructura
            // if let Some(parent) = output_path.parent() { ... } // <- Esta parte se elimina o se vuelve innecesaria.

            let mut output_file = fs::File::create(&output_path)
                .map_err(|e| format!("Error creando archivo: {}", e))?;

            io::copy(&mut file, &mut output_file)
                .map_err(|e| format!("Error escribiendo archivo: {}", e))?;

            extracted_count += 1;
            log::debug!("Extraído: {}", output_path.display());
        } else {
            // Si no tiene nombre de archivo (raro para un archivo), lo saltamos.
            skipped_count += 1;
            log::debug!(
                "Saltado: {} (sin nombre de archivo)",
                full_path_in_zip.display()
            );
        }
        // --- FIN DE LA CORRECCIÓN ---
    }

    log::info!(
        "Extracción completada: {} extraídos, {} saltados",
        extracted_count,
        skipped_count
    );

    Ok(())
}

fn should_exclude_file(file_name: &str, exclude_patterns: &[String]) -> bool {
    exclude_patterns.iter().any(|pattern| {
        if pattern.ends_with('*') {
            let prefix = &pattern[0..pattern.len() - 1];
            file_name.starts_with(prefix)
        } else if pattern.ends_with('/') {
            // Directory pattern
            file_name.starts_with(pattern)
        } else {
            file_name == *pattern || file_name.ends_with(pattern)
        }
    })
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
