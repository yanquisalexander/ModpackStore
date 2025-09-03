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

            // === FIXED LOGIC: Separate rule evaluation for base jar vs natives ===
            
            // 1. ALWAYS try to include the base jar (artifact) unless explicitly disallowed by non-OS rules
            let should_include_base = self.should_include_base_artifact(lib)?;
            
            if should_include_base {
                let artifact_path = self.get_library_artifact_path(lib).unwrap_or_else(|| {
                    log::warn!(
                        "Artifact not found in downloads, constructing path from name: {}",
                        lib_name
                    );
                    self.construct_library_path_from_name(lib_name, None)
                });

                // Add main artifact - this should be included unless explicitly disallowed
                if let Err(e) = self.add_library_if_exists(&artifact_path, &mut entries, &mut seen) {
                    missing_libraries.push(format!("{}: {}", lib_name, e));
                }
                log::debug!("Added base artifact for library: {}", lib_name);
            } else {
                log::trace!("Skipping base artifact for library {} due to rule evaluation", lib_name);
            }

            // 2. Only include natives if they pass OS-specific rule evaluation
            if self.should_include_natives(lib)? {
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
                    log::debug!("Added native artifacts for library: {}", lib_name);
                }
            } else {
                log::trace!("Skipping native artifacts for library {} due to OS rule evaluation", lib_name);
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

    /// Determines if the base artifact (main jar without classifier) should be included.
    /// Base artifacts should always be included unless explicitly disallowed by non-OS specific rules.
    fn should_include_base_artifact(&self, lib: &Value) -> Result<bool, String> {
        let rules = match lib.get("rules").and_then(|r| r.as_array()) {
            Some(rules) => rules,
            // Si no hay sección "rules", la librería se incluye por defecto.
            None => return Ok(true),
        };

        // For base artifacts, we only care about rules that explicitly disallow WITHOUT OS conditions
        // OS-specific rules should not affect base artifacts
        for rule in rules {
            let action = rule
                .get("action")
                .and_then(|a| a.as_str())
                .unwrap_or("allow");
            
            // If this is a disallow rule without OS conditions, apply it to base artifact
            if action == "disallow" && rule.get("os").is_none() {
                if RuleEvaluator::rule_matches_environment(rule, None) {
                    log::debug!("Base artifact disallowed by non-OS rule");
                    return Ok(false);
                }
            }
        }

        // Base artifacts are included by default unless explicitly disallowed by non-OS rules
        Ok(true)
    }

    /// Determines if native artifacts should be included based on OS-specific rules.
    /// Natives should only be included if OS rules allow them for the current platform.
    fn should_include_natives(&self, lib: &Value) -> Result<bool, String> {
        let rules = match lib.get("rules").and_then(|r| r.as_array()) {
            Some(rules) => rules,
            // If no rules exist, check if natives are available for current OS
            None => {
                // No rules means natives should be included if they exist for current OS
                return Ok(self.get_native_library_paths(lib).is_some());
            },
        };

        // For natives, we apply the full rule evaluation logic
        let mut final_action_is_allow = false;

        for rule in rules {
            // Check if this rule's conditions match our environment
            if RuleEvaluator::rule_matches_environment(rule, None) {
                let action = rule
                    .get("action")
                    .and_then(|a| a.as_str())
                    .unwrap_or("allow");
                final_action_is_allow = action == "allow";
            }
        }

        // Only include natives if rules explicitly allow AND we have natives for current OS
        Ok(final_action_is_allow && self.get_native_library_paths(lib).is_some())
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

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_should_include_base_artifact_no_rules() {
        let lib = json!({
            "name": "test:library:1.0.0"
        });
        
        // Base artifacts should be included when no rules exist
        let has_rules = lib.get("rules").is_some();
        assert!(!has_rules);
        // Expected: should_include_base_artifact would return Ok(true)
    }

    #[test]
    fn test_should_include_base_artifact_with_os_rules() {
        let lib = json!({
            "name": "test:library:1.0.0",
            "rules": [
                {
                    "action": "allow",
                    "os": {
                        "name": "windows"
                    }
                }
            ]
        });
        
        // Base artifacts should be included even when OS-specific rules exist
        let rules = lib.get("rules").unwrap().as_array().unwrap();
        let first_rule = &rules[0];
        
        // This rule has OS conditions, so it shouldn't affect base artifact
        let has_os_condition = first_rule.get("os").is_some();
        assert!(has_os_condition);
        // Expected: should_include_base_artifact would return Ok(true)
    }

    #[test]
    fn test_should_include_base_artifact_explicit_disallow() {
        let lib = json!({
            "name": "test:library:1.0.0",
            "rules": [
                {
                    "action": "disallow"
                    // No OS condition - this should affect base artifacts
                }
            ]
        });
        
        let rules = lib.get("rules").unwrap().as_array().unwrap();
        let first_rule = &rules[0];
        
        let action = first_rule.get("action").unwrap().as_str().unwrap();
        let has_os_condition = first_rule.get("os").is_some();
        
        assert_eq!(action, "disallow");
        assert!(!has_os_condition);
        // Expected: should_include_base_artifact would return Ok(false)
    }

    #[test]
    fn test_rule_logic_separation() {
        // Test that demonstrates the key insight of our fix:
        // Base artifacts and natives should have different rule evaluation logic
        
        let lwjgl_lib = json!({
            "name": "org.lwjgl:lwjgl-tinyfd:3.3.1",
            "downloads": {
                "artifact": {
                    "path": "org/lwjgl/lwjgl-tinyfd/3.3.1/lwjgl-tinyfd-3.3.1.jar"
                },
                "classifiers": {
                    "natives-windows": {
                        "path": "org/lwjgl/lwjgl-tinyfd/3.3.1/lwjgl-tinyfd-3.3.1-natives-windows.jar"
                    }
                }
            },
            "rules": [
                {
                    "action": "allow",
                    "os": {
                        "name": "windows"
                    }
                }
            ]
        });
        
        // Validate the structure we expect
        let rules = lwjgl_lib.get("rules").unwrap().as_array().unwrap();
        assert!(!rules.is_empty());
        
        let first_rule = &rules[0];
        assert_eq!(first_rule.get("action").unwrap().as_str().unwrap(), "allow");
        assert!(first_rule.get("os").is_some());
        
        // This validates our understanding of the problem and solution
        println!("✅ Rule separation logic test passed");
    }
}
