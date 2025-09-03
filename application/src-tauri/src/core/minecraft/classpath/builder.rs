// src/core/minecraft/launcher/classpath_builder.rs

use crate::core::minecraft::arguments::rules::RuleEvaluator;
use crate::core::minecraft::paths::MinecraftPaths;
use serde_json::Value;
use std::collections::HashSet;
use std::path::{Path, PathBuf, MAIN_SEPARATOR};

pub struct ClasspathBuilder<'a> {
    manifest: &'a Value,
    paths: &'a MinecraftPaths,
}

impl<'a> ClasspathBuilder<'a> {
    pub fn new(manifest: &'a Value, paths: &'a MinecraftPaths) -> Self {
        Self { manifest, paths }
    }

    pub fn build(&self) -> Result<String, String> {
        let mut entries = Vec::new();
        let mut seen = HashSet::new();
        let mut missing_libraries = Vec::new();

        log::debug!("Building classpath for Minecraft launcher");

        // Añadir el JAR del cliente
        let client_path = self.paths.client_jar();
        if client_path.exists() {
            self.add_entry(
                client_path.to_string_lossy().to_string(),
                &mut entries,
                &mut seen,
            );
            log::debug!("Added client JAR to classpath: {}", client_path.display());
        } else {
            return Err(format!("Client JAR not found: {}", client_path.display()));
        }

        // Procesar las librerías
        let libraries = self
            .manifest
            .get("libraries")
            .and_then(|v| v.as_array())
            .ok_or("No libraries found in manifest")?;

        log::debug!("Processing {} libraries from manifest", libraries.len());

        for lib in libraries {
            let lib_name = lib
                .get("name")
                .and_then(|n| n.as_str())
                .unwrap_or("unknown_library");

            if !self.should_include_library(lib)? {
                log::trace!("Skipping library {} due to rule evaluation", lib_name);
                continue;
            }

            // --- Asegurarse de agregar siempre el artifact principal ---
            let artifact_path = self.get_library_artifact_path(lib).unwrap_or_else(|| {
                log::warn!(
                    "Artifact not found in downloads, constructing path from name: {}",
                    lib_name
                );
                self.construct_library_path_from_name(lib_name, None)
            });

            // Add main artifact - required for all libraries
            if let Err(e) = self.add_library_if_exists(&artifact_path, &mut entries, &mut seen) {
                missing_libraries.push(format!("{}: {}", lib_name, e));
            }

            // --- Luego agregamos los nativos ---
            if let Some(native_paths) = self.get_native_library_paths(lib) {
                for native_path in native_paths {
                    if let Err(e) =
                        self.add_library_if_exists(&native_path, &mut entries, &mut seen)
                    {
                        // For libraries with native components, native JARs are also required
                        // This ensures both main and native JARs are present for libraries like LWJGL
                        missing_libraries.push(format!("{} (native): {}", lib_name, e));
                        log::error!("Required native library missing for {}: {}", lib_name, e);
                    }
                }
            }
        }

        if !missing_libraries.is_empty() {
            return Err(format!(
                "Missing required libraries:\n{}",
                missing_libraries.join("\n")
            ));
        }

        let classpath = entries.join(self.classpath_separator());
        log::info!(
            "Successfully built classpath with {} entries",
            entries.len()
        );
        log::debug!("Full classpath: {}", classpath);

        Ok(classpath)
    }

    // === ESTA ES LA FUNCIÓN CORREGIDA ===
    fn should_include_library(&self, lib: &Value) -> Result<bool, String> {
        let rules = match lib.get("rules").and_then(|r| r.as_array()) {
            Some(rules) => rules,
            // Si no hay sección "rules", la librería se incluye por defecto.
            None => return Ok(true),
        };

        // La acción por defecto si NINGUNA regla coincide es NO incluir la librería.
        let mut final_action_is_allow = false;

        for rule in rules {
            // 1. Preguntamos: ¿Las condiciones de esta regla coinciden con mi PC?
            if RuleEvaluator::rule_matches_environment(rule, None) {
                // 2. Si coinciden, esta regla se convierte en la decisión final (hasta que otra coincida).
                let action = rule
                    .get("action")
                    .and_then(|a| a.as_str())
                    .unwrap_or("allow");
                final_action_is_allow = action == "allow";
            }
        }

        Ok(final_action_is_allow)
    }

    // --- El resto de funciones auxiliares ---

    fn get_library_artifact_path(&self, lib: &Value) -> Option<PathBuf> {
        lib.get("downloads")
            .and_then(|d| d.get("artifact"))
            .and_then(|a| a.get("path"))
            .and_then(Value::as_str)
            .map(|p| {
                self.paths
                    .libraries_dir()
                    .join(p.replace('/', &MAIN_SEPARATOR.to_string()))
            })
            .or_else(|| {
                lib.get("name")
                    .and_then(Value::as_str)
                    .map(|n| self.construct_library_path_from_name(n, None))
            })
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
            vec![
                "natives-windows",
                "natives-windows-x86_64",
                "natives-windows-64",
            ]
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
            return Err(format!("not found: {}", path.display()));
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
}
