// src/core/minecraft/launcher/classpath_builder.rs

use crate::core::minecraft::arguments::rules::RuleEvaluator;
use crate::core::minecraft::paths::MinecraftPaths;
use serde_json::Value;
use std::collections::HashSet;
use std::path::{Path, PathBuf, MAIN_SEPARATOR};

/// A utility for working with Java classpaths
#[derive(Debug, Clone, PartialEq, Default)]
pub struct Classpath {
    entries: Vec<String>,
}

impl Classpath {
    /// Create a new empty classpath
    pub fn new() -> Self {
        Self {
            entries: Vec::new(),
        }
    }

    /// Appends a string to the end of the classpath
    pub fn add(&mut self, string: &str) {
        self.entries.push(string.to_string());
    }

    /// Converts a path to a string and appends it to the classpath
    pub fn add_path(&mut self, path: &Path) -> Result<(), String> {
        if !path.exists() {
            return Err(format!("not found: {}", path.display()));
        }
        self.add(&path.to_string_lossy());
        Ok(())
    }

    /// Obtain the classpath as a string
    pub fn get_str(&self) -> String {
        self.entries.join(self.classpath_separator())
    }

    /// Deduplicates entries in the classpath
    pub fn deduplicate(&mut self) {
        let mut seen = HashSet::new();
        self.entries.retain(|e| seen.insert(e.clone()));
    }

    fn classpath_separator(&self) -> &str {
        if cfg!(windows) {
            ";"
        } else {
            ":"
        }
    }
}

pub struct ClasspathBuilder<'a> {
    manifest: &'a Value,
    paths: &'a MinecraftPaths,
}

impl<'a> ClasspathBuilder<'a> {
    pub fn new(manifest: &'a Value, paths: &'a MinecraftPaths) -> Self {
        Self { manifest, paths }
    }

    pub fn build(&self) -> Result<String, String> {
        let mut classpath = Classpath::new();
        let mut missing_libraries = Vec::new();

        log::debug!("Building classpath for Minecraft launcher");

        // Añadir el JAR del cliente
        let client_path = self.paths.client_jar();
        if client_path.exists() {
            if let Err(e) = classpath.add_path(&client_path) {
                return Err(e);
            }
            log::debug!("Added client JAR to classpath: {}", client_path.display());
        } else {
            return Err(format!("Client JAR not found: {}", client_path.display()));
        }

        // Procesar las librerías y recolectar las incluidas
        let mut included_libraries = Vec::new();

        // Procesar las librerías
        let libraries = self
            .manifest
            .get("libraries")
            .and_then(|v| v.as_array())
            .ok_or("No libraries found in manifest")?;

        log::info!(
            "Comenzando el procesamiento de {} bibliotecas...",
            libraries.len()
        );

        for lib in libraries {
            let lib_name = lib
                .get("name")
                .and_then(|n| n.as_str())
                .unwrap_or("unknown_library");

            // Lógica unificada: Evalúa cada biblioteca según sus reglas.
            if self.should_include_library(lib) {
                // --- LOG MODIFICADO ---
                log::info!("✅ Añadida: {}", lib_name);
                included_libraries.push(lib.clone());
            } else {
                // --- LOG MODIFICADO ---
                log::info!("🚫 Omitida: {} (no cumple las reglas para tu SO)", lib_name);
            }
        }

        // Deduplicar por group:artifact, quedándose con la versión más nueva
        let mut deduplicated = std::collections::HashMap::new();
        for lib in included_libraries {
            if let Some(name) = lib.get("name").and_then(|n| n.as_str()) {
                let parts: Vec<&str> = name.split(':').collect();
                if parts.len() >= 2 {
                    let ga = format!("{}:{}", parts[0], parts[1]);
                    let version = parts.get(2).unwrap_or(&"").to_string();
                    let entry = deduplicated
                        .entry(ga.clone())
                        .or_insert((version.clone(), lib.clone()));
                    if Self::is_version_newer(&version, &entry.0) {
                        *entry = (version, lib.clone());
                    }
                }
            }
        }

        // Ahora añadir las deduplicadas al classpath
        for (_ga, (_version, lib)) in deduplicated {
            let lib_name = lib
                .get("name")
                .and_then(|v| v.as_str())
                .unwrap_or("unknown");

            // Intenta añadir el artefacto principal definido en "downloads.artifact".
            if let Some(artifact_path) = self.get_library_artifact_path(&lib) {
                if let Err(e) = self.add_library_to_classpath(&artifact_path, &mut classpath) {
                    missing_libraries.push(format!("{}: {}", lib_name, e));
                }
            }

            // Nota: Las librerías nativas (natives) no se añaden al classpath.
            // Se deben extraer por separado y añadir al java.library.path.
            // Aquí solo manejamos los JARs de clases Java.
            if let Some(native_paths) = self.get_native_library_paths(&lib) {
                log::debug!(
                    "Native libraries found for {}: {:?}",
                    lib_name,
                    native_paths
                );
                // No añadir al classpath - las natives se manejan en el launcher
            }
        }

        if !missing_libraries.is_empty() {
            return Err(format!(
                "Missing required libraries:\n{}",
                missing_libraries.join("\n")
            ));
        }

        classpath.deduplicate();
        let classpath_str = classpath.get_str();
        log::info!(
            "Classpath construido exitosamente con {} entradas.",
            classpath.entries.len()
        );
        log::trace!("Full classpath: {}", classpath_str);

        Ok(classpath_str)
    }
    /// Determina si una biblioteca debe ser incluida evaluando su sección "rules".
    fn should_include_library(&self, lib: &Value) -> bool {
        // Si no hay una sección "rules", la biblioteca se incluye por defecto.
        let rules = match lib.get("rules").and_then(|r| r.as_array()) {
            Some(rules) => rules,
            None => return true,
        };

        // --- CORRECCIÓN AÑADIDA ---
        // Si el array de reglas está vacío, la biblioteca también se debe incluir.
        if rules.is_empty() {
            return true;
        }

        // Si hay reglas, la acción por defecto es denegar, y la última regla que coincida
        // con el entorno actual determina el resultado.
        let mut allowed = false;

        for rule in rules {
            if let Some(allow) = RuleEvaluator::should_apply_rule(rule, None) {
                allowed = allow;
            }
        }

        allowed
    }

    fn add_library_to_classpath(
        &self,
        path: &Path,
        classpath: &mut Classpath,
    ) -> Result<(), String> {
        classpath.add_path(path)
    }

    // --- El resto de funciones auxiliares (get_library_artifact_path, get_native_library_paths, etc.) permanecen igual ---

    fn get_library_artifact_path(&self, lib: &Value) -> Option<PathBuf> {
        // First, try to get the path from downloads.artifact (modern format, 1.13+)
        if let Some(path) = lib
            .get("downloads")
            .and_then(|d| d.get("artifact"))
            .and_then(|a| a.get("path"))
            .and_then(Value::as_str)
        {
            return Some(
                self.paths
                    .libraries_dir()
                    .join(path.replace('/', &MAIN_SEPARATOR.to_string())),
            );
        }

        // For older versions (pre-1.13) or libraries without downloads section,
        // construct the path from the library name.
        // Note: Some libraries (like *-platform libraries) only have natives and
        // no main artifact. We'll handle this by checking if the library has
        // the "natives" field - if it does AND has no downloads.artifact,
        // it probably doesn't have a main JAR.
        if let Some(name) = lib.get("name").and_then(Value::as_str) {
            // Check if this is a natives-only library
            let has_natives = lib.get("natives").is_some();
            let has_classifiers = lib
                .get("downloads")
                .and_then(|d| d.get("classifiers"))
                .is_some();

            // If it has natives/classifiers but no artifact section, it's natives-only
            if (has_natives || has_classifiers)
                && lib
                    .get("downloads")
                    .and_then(|d| d.get("artifact"))
                    .is_none()
            {
                log::debug!(
                    "Library {} appears to be natives-only (no artifact), skipping main JAR",
                    name
                );
                return None;
            }

            // Otherwise, construct the path from the name
            // This is essential for pre-1.13 versions like 1.12.2
            return Some(self.construct_library_path_from_name(name, None));
        }

        None
    }

    fn get_native_library_paths(&self, lib: &Value) -> Option<Vec<PathBuf>> {
        let mut native_paths = Vec::new();
        let lib_name = lib.get("name").and_then(Value::as_str)?;

        // Formato moderno con "classifiers"
        if let Some(classifiers) = lib
            .get("downloads")
            .and_then(|d| d.get("classifiers"))
            .and_then(Value::as_object)
        {
            let os_classifiers = self.get_os_native_classifiers();
            for key in os_classifiers {
                if let Some(path_val) = classifiers
                    .get(key)
                    .and_then(|i| i.get("path"))
                    .and_then(Value::as_str)
                {
                    native_paths.push(
                        self.paths
                            .libraries_dir()
                            .join(path_val.replace('/', &MAIN_SEPARATOR.to_string())),
                    );
                }
            }
        }
        // Formato antiguo con "natives"
        else if let Some(natives_obj) = lib.get("natives") {
            let os_name = if cfg!(windows) {
                "windows"
            } else if cfg!(target_os = "linux") {
                "linux"
            } else {
                "osx"
            };
            if let Some(classifier_template) = natives_obj.get(os_name).and_then(Value::as_str) {
                let arch = if cfg!(target_arch = "x86_64") {
                    "64"
                } else {
                    "32"
                };
                let classifier = classifier_template.replace("${arch}", arch);
                native_paths
                    .push(self.construct_library_path_from_name(lib_name, Some(&classifier)));
            }
        }

        if native_paths.is_empty() {
            None
        } else {
            Some(native_paths)
        }
    }

    fn get_os_native_classifiers(&self) -> Vec<&'static str> {
        if cfg!(windows) {
            if cfg!(target_arch = "aarch64") {
                vec!["natives-windows-arm64"]
            } else {
                vec![
                    "natives-windows",
                    "natives-windows-x86_64", // Some mods might use this
                    "natives-windows-64",     // Older versions
                ]
            }
        } else if cfg!(target_os = "linux") {
            vec!["natives-linux"]
        } else if cfg!(target_os = "macos") {
            if cfg!(target_arch = "aarch64") {
                vec!["natives-macos-arm64", "natives-osx-arm64"]
            } else {
                vec!["natives-macos", "natives-osx"]
            }
        } else {
            vec![]
        }
    }

    fn construct_library_path_from_name(&self, name: &str, classifier: Option<&str>) -> PathBuf {
        let parts: Vec<&str> = name.split(':').collect();
        if parts.len() < 3 {
            return self.paths.libraries_dir().join(format!("{}.jar", name));
        }

        let group = parts[0].replace('.', "/");
        let artifact = parts[1];
        let version = parts[2];

        let filename = match classifier {
            Some(c) => format!("{}-{}-{}.jar", artifact, version, c),
            None => format!("{}-{}.jar", artifact, version),
        };

        self.paths
            .libraries_dir()
            .join(group)
            .join(artifact)
            .join(version)
            .join(filename)
    }

    fn add_library_if_exists(
        &self,
        path: &Path,
        entries: &mut Vec<String>,
        seen: &mut HashSet<String>,
    ) -> Result<(), String> {
        if !path.exists() {
            log::warn!("Library not found, skipping: {}", path.display());
            return Ok(());
        }
        self.add_entry(path.to_string_lossy().to_string(), entries, seen);
        Ok(())
    }

    fn add_entry(&self, path_str: String, entries: &mut Vec<String>, seen: &mut HashSet<String>) {
        if seen.insert(path_str.clone()) {
            entries.push(path_str);
        }
    }

    fn classpath_separator(&self) -> &str {
        if cfg!(windows) {
            ";"
        } else {
            ":"
        }
    }

    fn is_version_newer(new_version: &str, old_version: &str) -> bool {
        let new_parts: Vec<u32> = new_version
            .split('.')
            .filter_map(|p| p.parse().ok())
            .collect();
        let old_parts: Vec<u32> = old_version
            .split('.')
            .filter_map(|p| p.parse().ok())
            .collect();

        for (new, old) in new_parts.iter().zip(old_parts.iter()) {
            if new > old {
                return true;
            } else if new < old {
                return false;
            }
        }
        new_parts.len() > old_parts.len()
    }
}
