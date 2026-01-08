// src/core/bootstrap/loaders/quilt.rs
// Quilt loader installer implementation (similar to Fabric as it's a fork)

use crate::core::bootstrap::download::download_file;
use crate::core::bootstrap_error::{BootstrapError, BootstrapStep};
use crate::core::minecraft_instance::MinecraftInstance;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tauri_plugin_http::reqwest;

const QUILT_META_URL: &str = "https://meta.quiltmc.org/v3";

#[derive(Serialize, Deserialize, Debug, Clone)]
struct QuiltVersion {
    loader: LoaderInfo,
    hashed: HashedInfo,
    #[serde(rename = "launcherMeta")]
    launcher_meta: LauncherMeta,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct LoaderInfo {
    separator: String,
    build: i32,
    maven: String,
    version: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct HashedInfo {
    maven: String,
    version: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct LauncherMeta {
    version: i32,
    libraries: Libraries,
    #[serde(rename = "mainClass")]
    main_class: MainClass,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct Libraries {
    common: Vec<LibraryEntry>,
    client: Option<Vec<LibraryEntry>>,
    server: Option<Vec<LibraryEntry>>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct LibraryEntry {
    name: String,
    url: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct MainClass {
    client: Option<String>,
    server: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct QuiltLoaderVersion {
    version: String,
}

pub struct QuiltInstaller<'a> {
    client: &'a reqwest::blocking::Client,
    minecraft_version: String,
    loader_version: String,
}

impl<'a> QuiltInstaller<'a> {
    pub fn new(
        client: &'a reqwest::blocking::Client,
        minecraft_version: String,
        loader_version: String,
    ) -> Self {
        Self {
            client,
            minecraft_version,
            loader_version,
        }
    }

    /// Fetch available Quilt loader versions for a Minecraft version
    pub fn fetch_loader_versions(
        client: &reqwest::blocking::Client,
        minecraft_version: &str,
    ) -> Result<Vec<String>, String> {
        let url = format!(
            "{}/versions/loader/{}",
            QUILT_META_URL, minecraft_version
        );

        let response = client
            .get(&url)
            .send()
            .map_err(|e| format!("Failed to fetch Quilt loader versions: {}", e))?;

        if !response.status().is_success() {
            return Err(format!(
                "Failed to fetch Quilt loader versions: HTTP {}",
                response.status()
            ));
        }

        let versions: Vec<QuiltLoaderVersion> = response
            .json()
            .map_err(|e| format!("Failed to parse Quilt loader versions: {}", e))?;

        Ok(versions.into_iter().map(|v| v.version).collect())
    }

    /// Install Quilt loader for the instance
    pub fn install(
        &self,
        instance: &MinecraftInstance,
        versions_dir: &Path,
    ) -> Result<(), BootstrapError> {
        log::info!(
            "[Instance: {}] Installing Quilt {} for Minecraft {} (Server Mode: {})",
            instance.instanceId,
            self.loader_version,
            self.minecraft_version,
            instance.is_server()
        );

        // Fetch Quilt profile JSON
        let quilt_profile = self.fetch_quilt_profile(instance.is_server())?;

        // Create Quilt version directory
        let quilt_version_name = format!(
            "quilt-loader-{}-{}",
            self.loader_version, self.minecraft_version
        );
        let quilt_version_dir = versions_dir.join(&quilt_version_name);

        if !quilt_version_dir.exists() {
            fs::create_dir_all(&quilt_version_dir).map_err(|e| {
                BootstrapError::filesystem_error(
                    BootstrapStep::CreatingDirectories,
                    format!("Failed to create Quilt version directory: {}", e),
                )
            })?;
        }

        // Generate and save Quilt version JSON
        let version_json = self.generate_version_json(&quilt_profile, &quilt_version_name, instance.is_server())?;
        let version_json_path = quilt_version_dir.join(format!("{}.json", quilt_version_name));

        fs::write(&version_json_path, serde_json::to_string_pretty(&version_json).unwrap())
            .map_err(|e| {
                BootstrapError::filesystem_error(
                    BootstrapStep::CreatingFiles,
                    format!("Failed to write Quilt version JSON: {}", e),
                )
            })?;

        log::info!(
            "[Instance: {}] Quilt installation completed successfully",
            instance.instanceId
        );

        Ok(())
    }

    /// Fetch Quilt profile from meta API
    fn fetch_quilt_profile(&self, is_server: bool) -> Result<QuiltVersion, BootstrapError> {
        let endpoint = if is_server { "server" } else { "profile" };
        let url = format!(
            "{}/versions/loader/{}/{}/{}/json",
            QUILT_META_URL, self.minecraft_version, self.loader_version, endpoint
        );

        log::debug!("Fetching Quilt profile from: {}", url);

        let response = self.client.get(&url).send().map_err(|e| {
            BootstrapError::network_error(
                BootstrapStep::DownloadingManifest,
                format!("Failed to fetch Quilt profile: {}", e),
            )
        })?;

        if !response.status().is_success() {
            return Err(BootstrapError::network_error(
                BootstrapStep::DownloadingManifest,
                format!("Failed to fetch Quilt profile: HTTP {}", response.status()),
            ));
        }

        let quilt_version: QuiltVersion = response.json().map_err(|e| {
            BootstrapError::network_error(
                BootstrapStep::DownloadingManifest,
                format!("Failed to parse Quilt profile: {}", e),
            )
        })?;

        Ok(quilt_version)
    }

    /// Generate Minecraft version JSON for Quilt
    fn generate_version_json(
        &self,
        quilt_profile: &QuiltVersion,
        version_id: &str,
        is_server: bool,
    ) -> Result<serde_json::Value, BootstrapError> {
        // Build libraries array
        let mut libraries = Vec::new();

        // Add Quilt loader libraries
        for lib in &quilt_profile.launcher_meta.libraries.common {
            libraries.push(serde_json::json!({
                "name": lib.name,
                "url": lib.url
            }));
        }

        if let Some(client_libs) = &quilt_profile.launcher_meta.libraries.client {
            if !is_server {
                for lib in client_libs {
                    libraries.push(serde_json::json!({
                        "name": lib.name,
                        "url": lib.url
                    }));
                }
            }
        }
        
        if let Some(server_libs) = &quilt_profile.launcher_meta.libraries.server {
            if is_server {
                for lib in server_libs {
                    libraries.push(serde_json::json!({
                        "name": lib.name,
                        "url": lib.url
                    }));
                }
            }
        }

        // Add hashed library
        libraries.push(serde_json::json!({
            "name": quilt_profile.hashed.maven,
            "url": "https://maven.quiltmc.org/repository/release/"
        }));

        // Add loader library
        libraries.push(serde_json::json!({
            "name": quilt_profile.loader.maven,
            "url": "https://maven.quiltmc.org/repository/release/"
        }));

        let main_class = if is_server {
            quilt_profile.launcher_meta.main_class.server.clone().unwrap_or_default()
        } else {
            quilt_profile.launcher_meta.main_class.client.clone().unwrap_or_default()
        };

        // Create version JSON
        let version_json = serde_json::json!({
            "id": version_id,
            "inheritsFrom": self.minecraft_version,
            "releaseTime": chrono::Utc::now().to_rfc3339(),
            "time": chrono::Utc::now().to_rfc3339(),
            "type": "release",
            "mainClass": main_class,
            "libraries": libraries,
            "arguments": {
                "game": [],
                "jvm": []
            }
        });

        Ok(version_json)
    }

    /// Get the version name for this Quilt installation
    pub fn get_version_name(&self) -> String {
        format!(
            "quilt-loader-{}-{}",
            self.loader_version, self.minecraft_version
        )
    }
}

// Implement the ModLoaderInstaller trait for QuiltInstaller
impl<'a> super::ModLoaderInstaller for QuiltInstaller<'a> {
    fn name(&self) -> &str {
        "Quilt"
    }

    fn loader_version(&self) -> &str {
        &self.loader_version
    }

    fn minecraft_version(&self) -> &str {
        &self.minecraft_version
    }

    fn download_libraries(
        &self,
        _libraries_dir: &Path,
        _instance: &MinecraftInstance,
    ) -> Result<(), BootstrapError> {
        // Quilt libraries are defined in the version JSON
        // They will be downloaded by the standard library downloader
        Ok(())
    }

    fn run_post_install(
        &self,
        _minecraft_dir: &Path,
        versions_dir: &Path,
        instance: &MinecraftInstance,
    ) -> Result<(), BootstrapError> {
        // The actual installation is done in the install method
        // No additional post-install steps needed
        Ok(())
    }

    fn install(
        &self,
        _minecraft_dir: &Path,
        versions_dir: &Path,
        _libraries_dir: &Path,
        instance: &MinecraftInstance,
    ) -> Result<(), BootstrapError> {
        // Use the existing install method
        Self::install(self, instance, versions_dir)
    }

    fn get_version_name(&self) -> String {
        format!(
            "quilt-loader-{}-{}",
            self.loader_version, self.minecraft_version
        )
    }

    fn requires_java_for_install(&self) -> bool {
        false
    }
}
