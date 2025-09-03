use crate::core::minecraft::arguments::rules::RuleEvaluator;
use crate::core::minecraft::paths::MinecraftPaths;
use serde_json::Value;
use std::collections::HashSet;
use std::path::{Path, MAIN_SEPARATOR};

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

        // Add client JAR
        let client_path = self.paths.client_jar();
        if client_path.exists() {
            let client_str = client_path.to_string_lossy().to_string();
            entries.push(client_str.clone());
            seen.insert(client_str);
            log::debug!("Added client JAR to classpath: {}", client_path.display());
        } else {
            let error_msg = format!("Client JAR not found: {}", client_path.display());
            log::error!("{}", error_msg);
            return Err(error_msg);
        }

        // Process libraries
        let libraries = self
            .manifest
            .get("libraries")
            .and_then(|v| v.as_array())
            .ok_or_else(|| {
                let error_msg = "No libraries found in manifest";
                log::error!("{}", error_msg);
                error_msg.to_string()
            })?;

        log::debug!("Processing {} libraries from manifest", libraries.len());

        for (index, lib) in libraries.iter().enumerate() {
            let lib_name = lib
                .get("name")
                .and_then(|n| n.as_str())
                .map(|s| s.to_string())
                .unwrap_or_else(|| format!("library_{}", index));

            log::debug!("Processing library {}: {}", index + 1, lib_name);

            // Check if library should be included based on rules
            if !self.should_include_library(lib)? {
                log::debug!("Skipping library {} due to rule evaluation", lib_name);
                continue;
            }

            // Enhanced multi-artifact resolution: handle main + native artifacts together
            let has_native_artifacts = self.library_has_native_artifacts(lib);
            let main_artifact_path = self.get_library_artifact_path(lib);
            let native_paths = self.get_native_library_paths(lib);

            // For libraries with native artifacts, we need BOTH main and native JARs
            if has_native_artifacts {
                let mut library_complete = true;

                // Add main artifact (required for libraries with natives)
                if let Some(artifact_path) = main_artifact_path {
                    match self.add_library_if_exists(&artifact_path, &mut entries, &mut seen) {
                        Ok(added) => {
                            if added {
                                log::debug!("Added main artifact for native library: {}", artifact_path.display());
                            }
                        }
                        Err(e) => {
                            log::error!("Missing main artifact for native library {}: {}", lib_name, e);
                            missing_libraries.push(format!("{} (main JAR): {}", lib_name, e));
                            library_complete = false;
                        }
                    }
                } else {
                    log::error!("No main artifact path found for native library: {}", lib_name);
                    missing_libraries.push(format!("{}: No main artifact path available", lib_name));
                    library_complete = false;
                }

                // Add native classifiers (also required for native libraries)
                if let Some(native_paths) = native_paths {
                    for native_path in native_paths {
                        match self.add_library_if_exists(&native_path, &mut entries, &mut seen) {
                            Ok(added) => {
                                if added {
                                    log::debug!("Added native classifier: {}", native_path.display());
                                }
                            }
                            Err(e) => {
                                log::warn!("Native classifier not found for {}: {}", lib_name, e);
                                // Native missing is less critical, but log it
                            }
                        }
                    }
                }

                if library_complete {
                    log::debug!("Successfully resolved multi-artifact library: {}", lib_name);
                }
            } else {
                // Standard library processing (no native artifacts)
                if let Some(artifact_path) = main_artifact_path {
                    match self.add_library_if_exists(&artifact_path, &mut entries, &mut seen) {
                        Ok(added) => {
                            if added {
                                log::debug!("Added library artifact: {}", artifact_path.display());
                            }
                        }
                        Err(e) => {
                            missing_libraries.push(format!("{}: {}", lib_name, e));
                        }
                    }
                }
            }
        }

        if !missing_libraries.is_empty() {
            let error_msg = format!(
                "Missing required libraries:\n{}",
                missing_libraries.join("\n")
            );
            log::error!("{}", error_msg);
            return Err(error_msg);
        }

        let classpath = entries.join(self.classpath_separator());
        log::info!(
            "Successfully built classpath with {} entries",
            entries.len()
        );
        log::debug!("Full classpath: {}", classpath);

        Ok(classpath)
    }

    fn should_include_library(&self, lib: &Value) -> Result<bool, String> {
        // If no rules are specified, include the library
        let rules = match lib.get("rules").and_then(|r| r.as_array()) {
            Some(rules) => rules,
            None => return Ok(true),
        };

        // Evaluate all rules - if any rule says to allow, include the library
        for rule in rules {
            if RuleEvaluator::should_apply_rule(rule, None) {
                log::debug!("Library included by rule: {:?}", rule);
                return Ok(true);
            }
        }

        log::debug!("Library excluded by rules");
        Ok(false)
    }

    fn get_library_artifact_path(&self, lib: &Value) -> Option<std::path::PathBuf> {
        // Try new format first (downloads.artifact.path)
        if let Some(path_val) = lib
            .get("downloads")
            .and_then(|d| d.get("artifact"))
            .and_then(|a| a.get("path"))
            .and_then(Value::as_str)
        {
            return Some(
                self.paths
                    .libraries_dir()
                    .join(path_val.replace('/', &MAIN_SEPARATOR.to_string())),
            );
        }

        // Fallback to constructing path from name
        if let Some(name) = lib.get("name").and_then(Value::as_str) {
            return Some(self.construct_library_path_from_name(name));
        }

        None
    }

    fn get_native_library_paths(&self, lib: &Value) -> Option<Vec<std::path::PathBuf>> {
        let classifiers = lib
            .get("downloads")
            .and_then(|d| d.get("classifiers"))
            .and_then(Value::as_object)?;

        let mut native_paths = Vec::new();

        // Get the appropriate native classifier for current OS
        let os_classifiers = self.get_os_native_classifiers();

        for classifier in os_classifiers {
            if let Some(info) = classifiers.get(classifier) {
                if let Some(path_val) = info.get("path").and_then(Value::as_str) {
                    let native_path = self
                        .paths
                        .libraries_dir()
                        .join(path_val.replace('/', &MAIN_SEPARATOR.to_string()));
                    native_paths.push(native_path);
                }
            }
        }

        if native_paths.is_empty() {
            None
        } else {
            Some(native_paths)
        }
    }

    /// Check if a library has native artifacts for the current OS
    fn library_has_native_artifacts(&self, lib: &Value) -> bool {
        // Check if library has classifiers with native artifacts
        if let Some(classifiers) = lib
            .get("downloads")
            .and_then(|d| d.get("classifiers"))
            .and_then(Value::as_object)
        {
            let os_classifiers = self.get_os_native_classifiers();
            for classifier in os_classifiers {
                if classifiers.contains_key(classifier) {
                    return true;
                }
            }
        }

        // Check if library has natives section for current OS
        if let Some(natives) = lib.get("natives") {
            let os_name = if cfg!(windows) {
                "windows"
            } else if cfg!(target_os = "linux") {
                "linux"
            } else if cfg!(target_os = "macos") {
                "osx"
            } else {
                "linux" // fallback
            };
            
            if natives.get(os_name).is_some() {
                return true;
            }
        }

        false
    }

    fn get_os_native_classifiers(&self) -> Vec<&'static str> {
        if cfg!(windows) {
            if cfg!(target_arch = "x86_64") {
                vec![
                    "natives-windows",
                    "natives-windows-64",
                    "natives-windows-x86_64",
                ]
            } else {
                vec![
                    "natives-windows",
                    "natives-windows-32",
                    "natives-windows-x86",
                ]
            }
        } else if cfg!(target_os = "linux") {
            if cfg!(target_arch = "x86_64") {
                vec!["natives-linux", "natives-linux-64", "natives-linux-x86_64"]
            } else {
                vec!["natives-linux", "natives-linux-32", "natives-linux-x86"]
            }
        } else if cfg!(target_os = "macos") {
            if cfg!(target_arch = "aarch64") {
                vec!["natives-macos", "natives-osx", "natives-macos-arm64"]
            } else {
                vec!["natives-macos", "natives-osx", "natives-macos-x86_64"]
            }
        } else {
            vec!["natives-linux"] // fallback
        }
    }

    fn construct_library_path_from_name(&self, name: &str) -> std::path::PathBuf {
        let parts: Vec<&str> = name.split(':').collect();
        if parts.len() >= 3 {
            let group = parts[0].replace('.', "/");
            let artifact = parts[1];
            let version = parts[2];
            let classifier = if parts.len() > 3 { parts[3] } else { "" };

            let filename = if classifier.is_empty() {
                format!("{}-{}.jar", artifact, version)
            } else {
                format!("{}-{}-{}.jar", artifact, version, classifier)
            };

            self.paths
                .libraries_dir()
                .join(&group)
                .join(artifact)
                .join(version)
                .join(filename)
        } else {
            // Fallback for malformed names
            self.paths.libraries_dir().join(format!("{}.jar", name))
        }
    }

    fn add_library_if_exists(
        &self,
        path: &Path,
        entries: &mut Vec<String>,
        seen: &mut HashSet<String>,
    ) -> Result<bool, String> {
        if !path.exists() {
            return Err(format!("Library not found: {}", path.display()));
        }

        let path_str = path.to_string_lossy().to_string();
        if seen.insert(path_str.clone()) {
            entries.push(path_str);
            Ok(true)
        } else {
            Ok(false) // Already added
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
