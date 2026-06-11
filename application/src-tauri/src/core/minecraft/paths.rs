use crate::config::get_config_manager;
use crate::core::minecraft::{classpath::ClasspathBuilder, manifest::ManifestMerger};
use crate::core::minecraft_instance::{MinecraftInstance, ModLoaderType};
use dirs;
use std::path::{Path, PathBuf};

use super::{launcher, ManifestParser};

#[derive(Debug)]
pub struct MinecraftPaths {
    game_dir: PathBuf,
    java_path: PathBuf,
    minecraft_version: String,
    forge_version: Option<String>,
    loader_type: ModLoaderType,
    loader_version: Option<String>,
}

impl MinecraftPaths {
    pub fn new(
        instance: &MinecraftInstance,
        config: &crate::config::ConfigManager,
    ) -> Option<Self> {
        log::info!(
            "[MinecraftPaths] Creating paths for instance: {}",
            instance.instanceName
        );

        let java_path_str = instance
            .javaPath
            .as_ref()
            .cloned()
            .or_else(|| {
                config
                    .get("javaDir")
                    .and_then(|v| v.as_str())
                    .map(String::from)
            })
            .unwrap_or_else(|| "default_java".to_string());

        let java_path = expand_path(&java_path_str)
            .join("bin")
            .join(if cfg!(windows) { "javaw.exe" } else { "java" });

        let game_dir = instance
            .instanceDirectory
            .as_ref()
            .map(|s| expand_path(s))
            .unwrap_or_else(|| PathBuf::from("default_path"))
            .join("minecraft");

        log::info!("[MinecraftPaths] Game directory: {}", game_dir.display());
        log::info!("[MinecraftPaths] Java path: {}", java_path.display());
        log::info!("[MinecraftPaths] Loader type: {:?}", instance.loaderType);

        Some(Self {
            game_dir,
            java_path,
            minecraft_version: instance.minecraftVersion.clone(),
            forge_version: instance.forgeVersion.clone(),
            loader_type: instance.loaderType.clone(),
            loader_version: instance.loaderVersion.clone(),
        })
    }

    pub fn game_dir(&self) -> &Path {
        &self.game_dir
    }

    pub fn java_path(&self) -> &Path {
        &self.java_path
    }

    pub fn minecraft_version(&self) -> &str {
        &self.minecraft_version
    }

    pub fn forge_version(&self) -> Option<&str> {
        self.forge_version.as_deref()
    }

    pub fn loader_type(&self) -> &ModLoaderType {
        &self.loader_type
    }

    pub fn loader_version(&self) -> Option<&str> {
        self.loader_version.as_deref()
    }

    pub fn manifest_file(&self) -> PathBuf {
        let version_dir = self.game_dir.join("versions");

        // Handle different loader types
        match self.loader_type {
            ModLoaderType::Forge => {
                if let Some(forge_ref) =
                    self.forge_version.as_ref().or(self.loader_version.as_ref())
                {
                    log::info!(
                        "[MinecraftPaths] Searching for Forge version manifest {}",
                        forge_ref
                    );

                    // Fallback: Try to use the provided forge reference directly
                    let forge_dir = format!("{}-forge-{}", self.minecraft_version, forge_ref);
                    let forge_path = version_dir
                        .join(&forge_dir)
                        .join(format!("{}.json", forge_dir));

                    if forge_path.exists() {
                        log::info!(
                            "[MinecraftPaths] Using Forge manifest: {}",
                            forge_path.display()
                        );
                        return forge_path;
                    }

                    // Intentar formato alternativo para el directorio de Forge
                    let alt_forge_dir = format!("{}-{}", self.minecraft_version, forge_ref);
                    let alt_forge_path = version_dir
                        .join(&alt_forge_dir)
                        .join(format!("{}.json", alt_forge_dir));

                    if alt_forge_path.exists() {
                        log::info!(
                            "[MinecraftPaths] Using alternative Forge manifest: {}",
                            alt_forge_path.display()
                        );
                        return alt_forge_path;
                    }

                    log::warn!(
                        "[MinecraftPaths] No matching Forge version found, falling back to vanilla"
                    );
                }
            }
            ModLoaderType::Fabric => {
                if let Some(fabric_version) = &self.loader_version {
                    let fabric_dir = format!(
                        "fabric-loader-{}-{}",
                        fabric_version, self.minecraft_version
                    );
                    let fabric_path = version_dir
                        .join(&fabric_dir)
                        .join(format!("{}.json", fabric_dir));

                    if fabric_path.exists() {
                        log::info!(
                            "[MinecraftPaths] Using Fabric manifest: {}",
                            fabric_path.display()
                        );
                        return fabric_path;
                    }

                    log::warn!("[MinecraftPaths] No matching Fabric version found, falling back to vanilla");
                }
            }
            ModLoaderType::NeoForge => {
                if let Some(neoforge_version) = &self.loader_version {
                    let neoforge_dir =
                        format!("{}-neoforge-{}", self.minecraft_version, neoforge_version);
                    let neoforge_path = version_dir
                        .join(&neoforge_dir)
                        .join(format!("{}.json", neoforge_dir));

                    if neoforge_path.exists() {
                        log::info!(
                            "[MinecraftPaths] Using NeoForge manifest: {}",
                            neoforge_path.display()
                        );
                        return neoforge_path;
                    }

                    // Also try the format that the NeoForge installer creates
                    let alt_neoforge_dir = format!("neoforge-{}", neoforge_version);
                    let alt_neoforge_path = version_dir
                        .join(&alt_neoforge_dir)
                        .join(format!("{}.json", alt_neoforge_dir));

                    if alt_neoforge_path.exists() {
                        log::info!(
                            "[MinecraftPaths] Using alternative NeoForge manifest: {}",
                            alt_neoforge_path.display()
                        );
                        return alt_neoforge_path;
                    }

                    log::warn!("[MinecraftPaths] No matching NeoForge version found, falling back to vanilla");
                }
            }
            ModLoaderType::Quilt => {
                if let Some(quilt_version) = &self.loader_version {
                    let quilt_dir =
                        format!("quilt-loader-{}-{}", quilt_version, self.minecraft_version);
                    let quilt_path = version_dir
                        .join(&quilt_dir)
                        .join(format!("{}.json", quilt_dir));

                    if quilt_path.exists() {
                        log::info!(
                            "[MinecraftPaths] Using Quilt manifest: {}",
                            quilt_path.display()
                        );
                        return quilt_path;
                    }

                    log::warn!(
                        "[MinecraftPaths] No matching Quilt version found, falling back to vanilla"
                    );
                }
            }
            ModLoaderType::Vanilla => {
                // Proceed to vanilla manifest
            }
        }

        // Default to vanilla manifest
        log::info!("[MinecraftPaths] Using vanilla manifest file");
        version_dir
            .join(&self.minecraft_version)
            .join(format!("{}.json", self.minecraft_version))
    }

    pub fn vanilla_manifest_file(&self, version: &str) -> PathBuf {
        self.game_dir
            .join("versions")
            .join(version)
            .join(format!("{}.json", version))
    }

    pub fn client_jar(&self) -> PathBuf {
        // For simplicity, return vanilla client jar
        // In a real implementation, this would check for Forge client jars
        self.game_dir
            .join("versions")
            .join(&self.minecraft_version)
            .join(format!("{}.jar", self.minecraft_version))
    }

    pub fn libraries_dir(&self) -> PathBuf {
        self.game_dir.join("libraries")
    }

    pub fn assets_dir(&self) -> PathBuf {
        self.game_dir.join("assets")
    }

    pub fn natives_dir(&self) -> PathBuf {
        self.game_dir.join("natives").join(&self.minecraft_version)
    }

    pub fn classpath_str(&self) -> String {
        log::debug!("Building classpath string for {}", self.minecraft_version);

        let manifest_parser = ManifestParser::new(self);
        let manifest_json = match manifest_parser.load_merged_manifest() {
            Ok(manifest) => manifest,
            Err(e) => {
                log::error!("Failed to load manifest for classpath: {}", e);
                return String::new();
            }
        };

        // beautiful print json
        if let Ok(json_str) = serde_json::to_string_pretty(&manifest_json) {
            log::debug!("Manifest JSON: {}", json_str);
        }

        let classpath_builder = ClasspathBuilder::new(&manifest_json, self);
        match classpath_builder.build() {
            Ok(classpath) => {
                log::debug!(
                    "Successfully built classpath with {} chars",
                    classpath.len()
                );
                classpath
            }
            Err(e) => {
                log::error!("Failed to build classpath: {}", e);
                String::new()
            }
        }
    }
}

// Expande una ruta con variables de entorno y ~
fn expand_path(path: &str) -> PathBuf {
    let mut result = path.to_string();

    // Reemplazar ~ con la ruta del home
    if result.starts_with("~") {
        if let Some(home) = dirs::home_dir() {
            result = result.replacen("~", home.to_str().unwrap_or(""), 1);
        }
    }

    // Reemplazar variables de entorno (maneja tanto $VAR como %VAR%)
    if result.contains("$") || result.contains("%") {
        for (key, value) in std::env::vars() {
            result = result.replace(&format!("${}", key), &value);
            result = result.replace(&format!("%{}%", key), &value);
        }
    }

    PathBuf::from(result)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;

    #[test]
    fn test_expand_path() {
        // Setup environment variable
        env::set_var("TEST_VAR", "expanded_value");

        // Test basic expansion
        let path = "$TEST_VAR/subdir";
        let expanded = expand_path(path);

        #[cfg(target_os = "windows")]
        assert_eq!(expanded.to_str().unwrap(), "expanded_value\\subdir");

        #[cfg(not(target_os = "windows"))]
        assert_eq!(expanded.to_str().unwrap(), "expanded_value/subdir");

        // Test Windows style expansion
        let path_win = "%TEST_VAR%/subdir";
        let expanded_win = expand_path(path_win);

        #[cfg(target_os = "windows")]
        assert_eq!(expanded_win.to_str().unwrap(), "expanded_value\\subdir");

        // Cleanup
        env::remove_var("TEST_VAR");
    }
}
