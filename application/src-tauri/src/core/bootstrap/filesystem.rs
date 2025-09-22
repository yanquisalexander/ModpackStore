// src/core/bootstrap/filesystem.rs
// Filesystem operations extracted from instance_bootstrap.rs

use crate::core::bootstrap::tasks::{emit_status, emit_status_with_stage, Stage};
use crate::core::minecraft_instance::MinecraftInstance;
use serde_json::Value;
use std::collections::HashMap;
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

/// Extracts native libraries from JAR files to the natives directory (ENHANCED VERSION)
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
    log::info!(
        "Detectado OS: {}, Arch: {}, Classifier: {}",
        os_info.name,
        os_info.arch,
        os_info.classifier
    );

    let libraries = version_details["libraries"].as_array().ok_or_else(|| {
        log::error!("No se encontraron bibliotecas en el manifiesto de versión");
        "No se encontraron bibliotecas en el manifiesto".to_string()
    })?;

    // Enhanced native library detection including Forge-specific libraries
    let native_libraries: Vec<&Value> = libraries
        .iter()
        .filter(|lib| is_native_library_enhanced(lib, &os_info))
        .collect();

    let total_native_libraries = native_libraries.len();
    log::info!(
        "Encontradas {} bibliotecas con nativos (incluyendo bibliotecas de Forge)",
        total_native_libraries
    );

    // Log detailed information about found native libraries
    for (i, library) in native_libraries.iter().enumerate() {
        if let Some(name) = library.get("name").and_then(|n| n.as_str()) {
            log::info!("  {}: {}", i + 1, name);
        }
    }

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

    let mut successfully_extracted = 0;
    let mut failed_extractions = Vec::new();

    for (index, library) in native_libraries.iter().enumerate() {
        let progress = index + 1;

        if let Some(name) = library.get("name").and_then(|n| n.as_str()) {
            log::info!(
                "Procesando biblioteca nativa {}/{}: {}",
                progress,
                total_native_libraries,
                name
            );
        }

        let stage = Stage::ExtractingLibraries {
            current: progress,
            total: total_native_libraries,
        };
        emit_status_with_stage(instance, "instance-extracting-natives-progress", &stage);

        match extract_single_native_library_enhanced(
            library,
            libraries_dir,
            natives_dir,
            &os_info,
            instance,
        ) {
            Ok(extracted_files) => {
                successfully_extracted += 1;
                log::info!(
                    "Biblioteca nativa extraída correctamente: {} archivos extraídos",
                    extracted_files
                );
            }
            Err(e) => {
                let library_name = library
                    .get("name")
                    .and_then(|n| n.as_str())
                    .unwrap_or("desconocido");

                log::error!(
                    "Error procesando biblioteca nativa '{}': {}",
                    library_name,
                    e
                );
                failed_extractions.push((library_name.to_string(), e.clone()));

                emit_status(
                    instance,
                    "instance-native-extraction-error",
                    &format!("Error en biblioteca nativa '{}': {}", library_name, e),
                );

                // Enhanced fallback error reporting - report the library details but continue
                if let Some(downloads) = library.get("downloads") {
                    log::warn!(
                        "Información de descarga para '{}': {}",
                        library_name,
                        downloads
                    );
                }
                if let Some(url) = library.get("url").and_then(|u| u.as_str()) {
                    log::warn!("URL del repositorio para '{}': {}", library_name, url);
                }
            }
        }
    }

    // Final status report with detailed logging
    log::info!(
        "Extracción de bibliotecas nativas completada: {} exitosas, {} fallidas",
        successfully_extracted,
        failed_extractions.len()
    );

    if !failed_extractions.is_empty() {
        log::warn!("Bibliotecas que fallaron en la extracción:");
        for (name, error) in &failed_extractions {
            log::warn!("  - {}: {}", name, error);
        }

        // Don't fail the whole process, just warn about missing libraries
        emit_status(
            instance,
            "instance-native-extraction-warnings",
            &format!(
                "Extracción completada con {} advertencias (ver logs)",
                failed_extractions.len()
            ),
        );
    } else {
        emit_status(
            instance,
            "instance-native-extraction-complete",
            "Todas las bibliotecas nativas extraídas correctamente",
        );
    }

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

/// Enhanced native library detection that includes Forge-specific patterns
fn is_native_library_enhanced(library: &Value, os_info: &OsInfo) -> bool {
    // First, try the standard detection
    if is_native_library(library, os_info) {
        return true;
    }

    // Enhanced detection for Forge and modded libraries
    if let Some(name) = library.get("name").and_then(|n| n.as_str()) {
        // Check for common native library patterns
        let native_patterns = [
            "lwjgl",    // LWJGL libraries like org.lwjgl.tinyfd, org.lwjgl.glfw
            "tinyfd",   // Specific TinyFileDialogs library
            "glfw",     // GLFW windowing library
            "openal",   // OpenAL audio library
            "opengl",   // OpenGL libraries
            "jinput",   // JInput libraries
            "jutils",   // JUtils libraries
            "joml",     // Java OpenGL Math Library (sometimes has natives)
            "natives",  // General natives pattern
            "platform", // Platform-specific libraries
            "jni",      // JNI libraries
        ];

        let name_lower = name.to_lowercase();

        // Check if library name contains common native patterns
        for pattern in &native_patterns {
            if name_lower.contains(pattern) {
                // Additional verification: check if there's classifier or download info suggesting natives
                if has_native_artifacts(library, os_info) {
                    log::debug!(
                        "Detected native library via pattern '{}': {}",
                        pattern,
                        name
                    );
                    return should_include_library(library, os_info);
                }
            }
        }

        // Check for OS-specific classifiers in the name
        let os_classifiers = [
            &format!("natives-{}", os_info.name),
            &format!("{}-natives", os_info.name),
            &format!("native-{}", os_info.name),
            &format!("{}-native", os_info.name),
        ];

        for classifier in &os_classifiers {
            if name_lower.contains(*classifier) {
                log::debug!(
                    "Detected native library via OS classifier '{}': {}",
                    classifier,
                    name
                );
                return should_include_library(library, os_info);
            }
        }
    }

    // Check for download artifacts with native classifiers
    if let Some(downloads) = library.get("downloads") {
        if let Some(classifiers) = downloads.get("classifiers") {
            // Check for our OS-specific classifier
            let possible_classifiers = [
                format!("natives-{}", os_info.name),
                format!("natives-{}-{}", os_info.name, os_info.arch),
                format!("{}-natives", os_info.name),
                format!("{}-{}-natives", os_info.name, os_info.arch),
            ];

            for classifier in &possible_classifiers {
                if classifiers.get(classifier).is_some() {
                    log::debug!(
                        "Detected native library via download classifier '{}': {}",
                        classifier,
                        library
                            .get("name")
                            .and_then(|n| n.as_str())
                            .unwrap_or("unknown")
                    );
                    return should_include_library(library, os_info);
                }
            }
        }
    }

    false
}

/// Check if library has native artifacts for the current OS
fn has_native_artifacts(library: &Value, os_info: &OsInfo) -> bool {
    // Check downloads section for classifiers
    if let Some(downloads) = library.get("downloads") {
        if let Some(classifiers) = downloads.get("classifiers") {
            // Look for any native classifier that might be relevant
            for (key, _) in classifiers.as_object().unwrap_or(&serde_json::Map::new()) {
                if key.contains("native")
                    || key.contains(&os_info.name)
                    || key.contains(&os_info.classifier)
                {
                    return true;
                }
            }
        }
    }

    // Check natives section
    if let Some(natives) = library.get("natives") {
        return natives.get(&os_info.name).is_some();
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
    let library_path = get_native_library_path_enhanced(library, libraries_dir, os_info)?;

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

    // Get exclusion patterns with enhanced defaults
    let exclude_patterns = get_exclusion_patterns_enhanced(library);

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

/// Enhanced single native library extraction with better error handling and duplicate detection
fn extract_single_native_library_enhanced(
    library: &Value,
    libraries_dir: &Path,
    natives_dir: &Path,
    os_info: &OsInfo,
    instance: &MinecraftInstance,
) -> Result<usize, String> {
    let library_name = library
        .get("name")
        .and_then(|n| n.as_str())
        .unwrap_or("unknown");

    // Try to get the library path with enhanced path resolution
    let library_path = match get_native_library_path_enhanced(library, libraries_dir, os_info) {
        Ok(path) => path,
        Err(e) => {
            // Enhanced error reporting with fallback information
            log::warn!(
                "No se pudo determinar la ruta para '{}': {}",
                library_name,
                e
            );

            // Try to provide helpful information about the library
            if let Some(downloads) = library.get("downloads") {
                log::info!(
                    "Información de descarga disponible para '{}': {}",
                    library_name,
                    downloads
                );
            }
            if let Some(url) = library.get("url").and_then(|u| u.as_str()) {
                log::info!("URL del repositorio para '{}': {}", library_name, url);
            }

            return Err(format!(
                "No se pudo resolver la ruta de descarga para '{}': {}",
                library_name, e
            ));
        }
    };

    if !library_path.exists() {
        return Err(format!(
            "Archivo de biblioteca nativa no encontrado: {} (biblioteca: {})",
            library_path.display(),
            library_name
        ));
    }

    let metadata = fs::metadata(&library_path).map_err(|e| {
        format!(
            "Error obteniendo metadata del archivo {}: {}",
            library_path.display(),
            e
        )
    })?;

    if metadata.len() == 0 {
        return Err(format!(
            "Archivo de biblioteca nativa está vacío: {} (biblioteca: {})",
            library_path.display(),
            library_name
        ));
    }

    log::info!(
        "Extrayendo biblioteca nativa '{}': {} ({} bytes)",
        library_name,
        library_path.display(),
        metadata.len()
    );

    // Get exclusion patterns with enhanced defaults
    let exclude_patterns = get_exclusion_patterns_enhanced(library);

    emit_status(
        instance,
        "instance-extracting-native-library",
        &format!(
            "Extrayendo: {} ({})",
            library_path
                .file_name()
                .unwrap_or_default()
                .to_string_lossy(),
            library_name
        ),
    );

    // Extract with duplicate detection
    let extracted_files =
        extract_jar_file_enhanced(&library_path, natives_dir, &exclude_patterns, library_name)?;

    log::info!(
        "Extracción completada para '{}': {} archivos extraídos desde {}",
        library_name,
        extracted_files,
        library_path.display()
    );

    Ok(extracted_files)
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

/// Enhanced native library path resolution with better fallback support
fn get_native_library_path_enhanced(
    library: &Value,
    libraries_dir: &Path,
    os_info: &OsInfo,
) -> Result<PathBuf, String> {
    let library_name = library
        .get("name")
        .and_then(|n| n.as_str())
        .unwrap_or("unknown");

    // Strategy 1: Try classifier-specific downloads (most reliable for natives)
    if let Some(classifiers) = library.get("downloads").and_then(|d| d.get("classifiers")) {
        // Try various classifier patterns
        let possible_classifiers = vec![
            // Standard natives pattern with arch replacement
            library
                .get("natives")
                .and_then(|n| n.get(&os_info.name))
                .and_then(|n| n.as_str())
                .map(|template| template.replace("${arch}", &os_info.arch)),
            // Direct OS-specific patterns
            Some(format!("natives-{}", os_info.name)),
            Some(format!("natives-{}-{}", os_info.name, os_info.arch)),
            Some(format!("{}-natives", os_info.name)),
            Some(format!("{}-{}-natives", os_info.name, os_info.arch)),
        ];

        for classifier_opt in possible_classifiers {
            if let Some(classifier) = classifier_opt {
                if let Some(classifier_info) = classifiers.get(&classifier) {
                    if let Some(path) = classifier_info.get("path").and_then(|p| p.as_str()) {
                        let full_path = libraries_dir.join(path);
                        log::debug!(
                            "Found native library path via classifier '{}': {}",
                            classifier,
                            full_path.display()
                        );
                        return Ok(full_path);
                    }
                }
            }
        }
    }

    // Strategy 2: Try standard artifact download
    if let Some(artifact) = library.get("downloads").and_then(|d| d.get("artifact")) {
        if let Some(path) = artifact.get("path").and_then(|p| p.as_str()) {
            let full_path = libraries_dir.join(path);
            log::debug!("Found library path via artifact: {}", full_path.display());
            return Ok(full_path);
        }
    }

    // Strategy 3: Manual path construction from Maven coordinates (for Forge libraries)
    if let Some(name) = library.get("name").and_then(|n| n.as_str()) {
        let parts: Vec<&str> = name.split(':').collect();
        if parts.len() >= 3 {
            let group_id = parts[0];
            let artifact_id = parts[1];
            let version = parts[2];

            // Try to find a classifier that suggests it's a native library
            let classifier = if parts.len() > 3 {
                Some(parts[3].to_string())
            } else {
                // Check if any part of the name suggests a native classifier
                if name.contains(&os_info.classifier) {
                    Some(os_info.classifier[8..].to_string()) // Remove "natives-" prefix
                } else if name.contains(&format!("{}-native", os_info.name)) {
                    Some(format!("{}-native", os_info.name))
                } else {
                    None
                }
            };

            // Build the Maven-style path
            let group_path = group_id.replace('.', "/");
            let jar_name = if let Some(classifier) = classifier {
                format!("{}-{}-{}.jar", artifact_id, version, classifier)
            } else {
                format!("{}-{}.jar", artifact_id, version)
            };

            let maven_path = format!("{}/{}/{}/{}", group_path, artifact_id, version, jar_name);
            let full_path = libraries_dir.join(&maven_path);

            log::debug!(
                "Constructed Maven path for native library: {}",
                full_path.display()
            );
            return Ok(full_path);
        }
    }

    Err(format!(
        "No se pudo resolver la ruta para la biblioteca nativa '{}'",
        library_name
    ))
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

/// Enhanced exclusion patterns with better defaults and Forge-specific patterns
fn get_exclusion_patterns_enhanced(library: &Value) -> Vec<String> {
    let mut patterns = Vec::new();

    // Get library-specific exclusions first
    if let Some(extract) = library.get("extract") {
        if let Some(exclude) = extract.get("exclude") {
            patterns.extend(
                exclude
                    .as_array()
                    .unwrap_or(&Vec::new())
                    .iter()
                    .filter_map(|v| v.as_str().map(|s| s.to_string())),
            );
        }
    }

    // Add enhanced default exclusions if none were specified
    if patterns.is_empty() {
        patterns.extend([
            "META-INF/".to_string(),
            "*.txt".to_string(),
            "*.xml".to_string(),
            "*.md".to_string(),
            "*.properties".to_string(),
            "*.class".to_string(),  // Don't extract Java class files
            "*.java".to_string(),   // Don't extract Java source files
            "LICENSE*".to_string(), // Don't extract license files
            "NOTICE*".to_string(),  // Don't extract notice files
        ]);
    }

    // Always exclude certain patterns regardless of library specification
    patterns.extend([
        "module-info.class".to_string(), // Java 9+ module info
        "*.jar".to_string(),             // Don't extract nested JARs
        "*.zip".to_string(),             // Don't extract nested ZIPs
    ]);

    patterns
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

/// Enhanced JAR extraction with duplicate detection and better logging
fn extract_jar_file_enhanced(
    jar_path: &Path,
    target_dir: &Path,
    exclude_patterns: &[String],
    library_name: &str,
) -> Result<usize, String> {
    log::info!(
        "Iniciando extracción de JAR para '{}': {} -> {}",
        library_name,
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
    let mut duplicate_count = 0;
    let mut error_count = 0;

    for i in 0..archive.len() {
        let mut file = archive
            .by_index(i)
            .map_err(|e| format!("Error obteniendo entrada ZIP en índice {}: {}", i, e))?;

        // El nombre completo dentro del zip (ej: "org/lwjgl/lwjgl.dll")
        let full_path_in_zip = match file.enclosed_name() {
            Some(path) => path.to_owned(),
            None => {
                skipped_count += 1;
                continue;
            }
        };

        let path_str = full_path_in_zip.to_str().unwrap_or("");

        // Skip directories
        if file.is_dir() {
            log::trace!("Saltado directorio: {}", full_path_in_zip.display());
            skipped_count += 1;
            continue;
        }

        // Skip excluded files
        if should_exclude_file(path_str, exclude_patterns) {
            log::trace!("Saltado por exclusión: {}", full_path_in_zip.display());
            skipped_count += 1;
            continue;
        }

        // Extract only the final filename (flattening the directory structure)
        if let Some(file_name_only) = full_path_in_zip.file_name() {
            let output_path = target_dir.join(file_name_only);

            // Check for duplicates
            if output_path.exists() {
                // Compare file sizes to determine if it's actually the same file
                if let Ok(existing_metadata) = fs::metadata(&output_path) {
                    if existing_metadata.len() == file.size() {
                        log::debug!(
                            "Archivo duplicado detectado (mismo tamaño), saltando: {}",
                            file_name_only.to_string_lossy()
                        );
                        duplicate_count += 1;
                        continue;
                    } else {
                        log::warn!("Archivo duplicado con diferente tamaño, sobrescribiendo: {} (existente: {} bytes, nuevo: {} bytes)", 
                                 file_name_only.to_string_lossy(), existing_metadata.len(), file.size());
                    }
                }
            }

            // Extract the file
            match fs::File::create(&output_path) {
                Ok(mut output_file) => match io::copy(&mut file, &mut output_file) {
                    Ok(bytes_copied) => {
                        extracted_count += 1;
                        log::debug!(
                            "Extraído '{}': {} -> {} ({} bytes)",
                            library_name,
                            full_path_in_zip.display(),
                            output_path.display(),
                            bytes_copied
                        );
                    }
                    Err(e) => {
                        error_count += 1;
                        log::error!("Error escribiendo archivo {}: {}", output_path.display(), e);
                    }
                },
                Err(e) => {
                    error_count += 1;
                    log::error!("Error creando archivo {}: {}", output_path.display(), e);
                }
            }
        } else {
            skipped_count += 1;
            log::debug!(
                "Saltado (sin nombre de archivo): {}",
                full_path_in_zip.display()
            );
        }
    }

    log::info!(
        "Extracción completada para '{}': {} extraídos, {} saltados, {} duplicados, {} errores",
        library_name,
        extracted_count,
        skipped_count,
        duplicate_count,
        error_count
    );

    if error_count > 0 {
        return Err(format!(
            "Se produjeron {} errores durante la extracción de '{}'",
            error_count, library_name
        ));
    }

    Ok(extracted_count)
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
