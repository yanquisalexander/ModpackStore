// src/core/bootstrap/loaders/fabric.rs
// Fabric loader installer implementation

use crate::core::bootstrap::download::download_file;
use crate::core::bootstrap_error::{BootstrapError, BootstrapStep};
use crate::core::minecraft_instance::MinecraftInstance;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tauri_plugin_http::reqwest;

const FABRIC_META_URL: &str = "https://meta.fabricmc.net/v2";

#[derive(Serialize, Deserialize, Debug, Clone)]
struct FabricVersion {
    loader: LoaderInfo,
    intermediary: IntermediaryInfo,
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
struct IntermediaryInfo {
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
    client: Vec<LibraryEntry>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct LibraryEntry {
    name: String,
    url: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct MainClass {
    client: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct FabricLoaderVersion {
    version: String,
    stable: bool,
}

pub struct FabricInstaller<'a> {
    client: &'a reqwest::blocking::Client,
    minecraft_version: String,
    loader_version: String,
}

impl<'a> FabricInstaller<'a> {
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

    /// Fetch available Fabric loader versions for a Minecraft version
    pub fn fetch_loader_versions(
        client: &reqwest::blocking::Client,
        minecraft_version: &str,
    ) -> Result<Vec<String>, String> {
        let url = format!("{}/versions/loader/{}", FABRIC_META_URL, minecraft_version);

        let response = client
            .get(&url)
            .send()
            .map_err(|e| format!("Failed to fetch Fabric loader versions: {}", e))?;

        if !response.status().is_success() {
            return Err(format!(
                "Failed to fetch Fabric loader versions: HTTP {}",
                response.status()
            ));
        }

        let versions: Vec<FabricLoaderVersion> = response
            .json()
            .map_err(|e| format!("Failed to parse Fabric loader versions: {}", e))?;

        Ok(versions.into_iter().map(|v| v.version).collect())
    }

    /// Install Fabric loader for the instance
    pub fn install(
        &self,
        instance: &MinecraftInstance,
        versions_dir: &Path,
    ) -> Result<(), BootstrapError> {
        log::info!(
            "[Instance: {}] Installing Fabric {} for Minecraft {}",
            instance.instanceId,
            self.loader_version,
            self.minecraft_version
        );

        // Fetch Fabric profile JSON
        let fabric_profile = self.fetch_fabric_profile()?;

        // Create Fabric version directory
        let fabric_version_name = format!(
            "fabric-loader-{}-{}",
            self.loader_version, self.minecraft_version
        );
        let fabric_version_dir = versions_dir.join(&fabric_version_name);

        if !fabric_version_dir.exists() {
            fs::create_dir_all(&fabric_version_dir).map_err(|e| {
                BootstrapError::filesystem_error(
                    BootstrapStep::CreatingDirectories,
                    format!("Failed to create Fabric version directory: {}", e),
                )
            })?;
        }

        // Generate and save Fabric version JSON
        let version_json = self.generate_version_json(&fabric_profile, &fabric_version_name)?;
        let version_json_path = fabric_version_dir.join(format!("{}.json", fabric_version_name));

        fs::write(&version_json_path, serde_json::to_string_pretty(&version_json).unwrap())
            .map_err(|e| {
                BootstrapError::filesystem_error(
                    BootstrapStep::CreatingFiles,
                    format!("Failed to write Fabric version JSON: {}", e),
                )
            })?;

        log::info!(
            "[Instance: {}] Fabric installation completed successfully",
            instance.instanceId
        );

        Ok(())
    }

    /// Fetch Fabric profile from meta API
    fn fetch_fabric_profile(&self) -> Result<FabricVersion, BootstrapError> {
        let url = format!(
            "{}/versions/loader/{}/{}/profile/json",
            FABRIC_META_URL, self.minecraft_version, self.loader_version
        );

        log::debug!("Fetching Fabric profile from: {}", url);

        let response = self.client.get(&url).send().map_err(|e| {
            BootstrapError::network_error(
                BootstrapStep::DownloadingManifest,
                format!("Failed to fetch Fabric profile: {}", e),
            )
        })?;

        if !response.status().is_success() {
            return Err(BootstrapError::network_error(
                BootstrapStep::DownloadingManifest,
                format!(
                    "Failed to fetch Fabric profile: HTTP {}",
                    response.status()
                ),
            ));
        }

        let fabric_version: FabricVersion = response.json().map_err(|e| {
            BootstrapError::network_error(
                BootstrapStep::DownloadingManifest,
                format!("Failed to parse Fabric profile: {}", e),
            )
        })?;

        Ok(fabric_version)
    }

    /// Generate Minecraft version JSON for Fabric
    fn generate_version_json(
        &self,
        fabric_profile: &FabricVersion,
        version_id: &str,
    ) -> Result<serde_json::Value, BootstrapError> {
        // Build libraries array
        let mut libraries = Vec::new();

        // Add Fabric loader libraries
        for lib in &fabric_profile.launcher_meta.libraries.common {
            libraries.push(serde_json::json!({
                "name": lib.name,
                "url": lib.url
            }));
        }

        for lib in &fabric_profile.launcher_meta.libraries.client {
            libraries.push(serde_json::json!({
                "name": lib.name,
                "url": lib.url
            }));
        }

        // Add intermediary library
        libraries.push(serde_json::json!({
            "name": fabric_profile.intermediary.maven,
            "url": "https://maven.fabricmc.net/"
        }));

        // Add loader library
        libraries.push(serde_json::json!({
            "name": fabric_profile.loader.maven,
            "url": "https://maven.fabricmc.net/"
        }));

        // Create version JSON
        let version_json = serde_json::json!({
            "id": version_id,
            "inheritsFrom": self.minecraft_version,
            "releaseTime": chrono::Utc::now().to_rfc3339(),
            "time": chrono::Utc::now().to_rfc3339(),
            "type": "release",
            "mainClass": fabric_profile.launcher_meta.main_class.client,
            "libraries": libraries,
            "arguments": {
                "game": [],
                "jvm": []
            }
        });

        Ok(version_json)
    }
}
