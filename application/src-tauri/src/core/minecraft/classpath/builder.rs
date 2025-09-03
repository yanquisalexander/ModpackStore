use crate::core::minecraft::paths::MinecraftPaths;
use crate::core::minecraft::RuleEvaluator;
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

    pub fn build(&self) -> Option<String> {
        let mut entries = Vec::new();
        let mut seen = HashSet::new();

        log::info!("[ClasspathBuilder] Building classpath from manifest");

        // Add client JAR first - this is critical for Minecraft to start
        let client_jar_path = self.determine_client_jar_path();
        if let Some(client_path) = client_jar_path {
            let client_path_str = client_path.to_string_lossy().to_string();
            entries.push(client_path_str.clone());
            seen.insert(client_path_str);
            log::debug!("[ClasspathBuilder] Added client JAR: {}", client_path.display());
        } else {
            log::warn!("[ClasspathBuilder] Could not determine client JAR path");
        }

        // Process libraries from manifest
        self.process_manifest_libraries(&mut entries, &mut seen);

        if entries.is_empty() {
            log::error!("[ClasspathBuilder] No classpath entries found!");
            return None;
        }

        let classpath = entries.join(self.classpath_separator());
        log::info!("[ClasspathBuilder] Built classpath with {} entries", entries.len());
        log::debug!("[ClasspathBuilder] Final classpath: {}", classpath);
        
        Some(classpath)
    }

    /// Determine the correct client JAR path based on version and type
    fn determine_client_jar_path(&self) -> Option<std::path::PathBuf> {
        // Check if this is a Forge installation first
        if self.is_forge_installation() {
            if let Some(forge_client) = self.find_forge_client_jar() {
                return Some(forge_client);
            }
        }

        // Fallback to vanilla client JAR
        let vanilla_client = self.paths.client_jar();
        if vanilla_client.exists() {
            Some(vanilla_client)
        } else {
            log::warn!("[ClasspathBuilder] Vanilla client JAR not found: {}", vanilla_client.display());
            None
        }
    }

    /// Check if this manifest represents a Forge installation
    fn is_forge_installation(&self) -> bool {
        // Check for inheritsFrom
        if self.manifest.get("inheritsFrom").is_some() {
            return true;
        }

        // Check for Forge libraries
        if let Some(libraries) = self.manifest.get("libraries").and_then(|v| v.as_array()) {
            for lib in libraries {
                if let Some(name) = lib.get("name").and_then(|v| v.as_str()) {
                    if name.contains("minecraftforge") || name.contains("net.minecraftforge") {
                        return true;
                    }
                }
            }
        }

        false
    }

    /// Find Forge-specific client JAR
    fn find_forge_client_jar(&self) -> Option<std::path::PathBuf> {
        // For modern Forge, the client JAR is usually in the same location as vanilla
        // but for older versions, we might need to look for specific Forge artifacts
        
        if let Some(version_id) = self.manifest.get("id").and_then(|v| v.as_str()) {
            // Try version-specific client JAR first
            let version_client = self.paths.game_dir()
                .join("versions")
                .join(version_id)
                .join(format!("{}.jar", version_id));
            
            if version_client.exists() {
                log::debug!("[ClasspathBuilder] Found Forge client JAR: {}", version_client.display());
                return Some(version_client);
            }
        }

        // Fallback to vanilla client JAR
        let vanilla_client = self.paths.client_jar();
        if vanilla_client.exists() {
            Some(vanilla_client)
        } else {
            None
        }
    }

    /// Process all libraries from the manifest
    fn process_manifest_libraries(&self, entries: &mut Vec<String>, seen: &mut HashSet<String>) {
    /// Process all libraries from the manifest
    fn process_manifest_libraries(&self, entries: &mut Vec<String>, seen: &mut HashSet<String>) {
        if let Some(libs) = self.manifest.get("libraries").and_then(|v| v.as_array()) {
            log::debug!("[ClasspathBuilder] Processing {} libraries", libs.len());
            
            for lib in libs {
                if !self.should_include_library(lib) {
                    continue;
                }

                // Add main artifact
                self.add_library_artifact(lib, entries, seen);

                // Add native classifiers if present
                self.add_native_classifiers(lib, entries, seen);
            }
        } else {
            log::warn!("[ClasspathBuilder] No libraries found in manifest");
        }
    }

    /// Add the main library artifact to classpath
    fn add_library_artifact(&self, lib: &Value, entries: &mut Vec<String>, seen: &mut HashSet<String>) {
        if let Some(path_val) = lib
            .get("downloads")
            .and_then(|d| d.get("artifact"))
            .and_then(|a| a.get("path"))
            .and_then(Value::as_str)
        {
            let jar = self
                .paths
                .libraries_dir()
                .join(path_val.replace('/', &MAIN_SEPARATOR.to_string()));
            self.add_if_new(&jar, entries, seen);
        } else {
            // Fallback for older manifest formats that might not have downloads/artifact
            if let Some(name) = lib.get("name").and_then(Value::as_str) {
                if let Some(jar_path) = self.construct_library_path_from_name(name) {
                    self.add_if_new(&jar_path, entries, seen);
                }
            }
        }
    }

    /// Construct library path from Maven coordinates (group:artifact:version)
    fn construct_library_path_from_name(&self, name: &str) -> Option<std::path::PathBuf> {
        let parts: Vec<&str> = name.split(':').collect();
        if parts.len() >= 3 {
            let group = parts[0].replace('.', "/");
            let artifact = parts[1];
            let version = parts[2];
            
            let jar_name = if parts.len() > 3 {
                // Has classifier
                let classifier = parts[3];
                format!("{}-{}-{}.jar", artifact, version, classifier)
            } else {
                format!("{}-{}.jar", artifact, version)
            };
            
            let jar_path = self.paths.libraries_dir()
                .join(group)
                .join(artifact)
                .join(version)
                .join(jar_name);
                
            Some(jar_path)
        } else {
            log::warn!("[ClasspathBuilder] Invalid library name format: {}", name);
            None
        }
    }

    /// Add native classifiers for the current platform
    fn add_native_classifiers(&self, lib: &Value, entries: &mut Vec<String>, seen: &mut HashSet<String>) {
    /// Add native classifiers for the current platform
    fn add_native_classifiers(&self, lib: &Value, entries: &mut Vec<String>, seen: &mut HashSet<String>) {
        if let Some(classifiers) = lib
            .get("downloads")
            .and_then(|d| d.get("classifiers"))
            .and_then(Value::as_object)
        {
            let os_classifiers = self.get_platform_classifiers();
            
            for classifier in &os_classifiers {
                if let Some(info) = classifiers.get(classifier) {
                    if let Some(path_val) = info.get("path").and_then(Value::as_str) {
                        let native_jar = self
                            .paths
                            .libraries_dir()
                            .join(path_val.replace('/', &MAIN_SEPARATOR.to_string()));
                        self.add_if_new(&native_jar, entries, seen);
                    }
                }
            }
        }
    }

    /// Get platform-specific classifiers to look for
    fn get_platform_classifiers(&self) -> Vec<&'static str> {
        if cfg!(windows) {
            vec!["natives-windows", "natives-windows-64", "natives-windows-32"]
        } else if cfg!(target_os = "macos") {
            vec!["natives-osx", "natives-macos", "natives-macos-arm64"]
        } else if cfg!(target_os = "linux") {
            vec!["natives-linux", "natives-linux-64"]
        } else {
            vec!["natives-linux"] // Default fallback
        }
    }

    fn should_include_library(&self, lib: &Value) -> bool {
        // Enhanced rule evaluation with better error handling
        if let Some(rules) = lib.get("rules").and_then(|r| r.as_array()) {
            let should_include = rules
                .iter()
                .any(|rule| RuleEvaluator::should_apply_rule(rule, None));
            
            if !should_include {
                if let Some(name) = lib.get("name").and_then(|v| v.as_str()) {
                    log::debug!("[ClasspathBuilder] Excluding library due to rules: {}", name);
                }
            }
            
            should_include
        } else {
            // No rules means include by default
            true
        }
    }

    fn add_if_new(&self, path: &Path, entries: &mut Vec<String>, seen: &mut HashSet<String>) {
        let path_str = path.to_string_lossy().to_string();
        
        if path.exists() {
            if seen.insert(path_str.clone()) {
                entries.push(path_str);
                log::debug!("[ClasspathBuilder] Added library: {}", path.display());
            } else {
                log::debug!("[ClasspathBuilder] Skipped duplicate library: {}", path.display());
            }
        } else {
            log::warn!("[ClasspathBuilder] Library not found: {}", path.display());
            
            // For critical libraries, we might want to try alternative locations
            if self.is_critical_library(path) {
                if let Some(alternative) = self.find_alternative_library_location(path) {
                    if seen.insert(alternative.clone()) {
                        entries.push(alternative);
                        log::info!("[ClasspathBuilder] Found alternative for critical library: {}", path.display());
                    }
                }
            }
        }
    }

    /// Check if a library is critical for Minecraft operation
    fn is_critical_library(&self, path: &Path) -> bool {
        let path_str = path.to_string_lossy().to_lowercase();
        path_str.contains("lwjgl") || 
        path_str.contains("minecraft") || 
        path_str.contains("forge") ||
        path_str.contains("authlib") ||
        path_str.contains("netty")
    }

    /// Try to find alternative locations for missing critical libraries
    fn find_alternative_library_location(&self, _path: &Path) -> Option<String> {
        // For now, return None - this could be enhanced to search common locations
        // or download missing libraries in the future
        None
    }

    fn classpath_separator(&self) -> &str {
        if cfg!(windows) {
            ";"
        } else {
            ":"
        }
    }
}
