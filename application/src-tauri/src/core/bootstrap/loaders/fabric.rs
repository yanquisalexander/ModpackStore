// src/core/bootstrap/loaders/fabric.rs
// Fabric loader installer implementation

use crate::core::bootstrap::download::{download_file, download_libraries};
use crate::core::bootstrap_error::{BootstrapError, BootstrapStep};
use crate::core::minecraft_instance::MinecraftInstance;
use serde_json;
use serde_json::Value as JsonValue;
use std::fs;
use std::path::{Path, PathBuf};
use tauri_plugin_http::reqwest;

const FABRIC_META_URL: &str = "https://meta.fabricmc.net/v2";

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

        let versions: Vec<String> = response
            .json()
            .map_err(|e| format!("Failed to parse Fabric loader versions: {}", e))?;

        Ok(versions)
    }

    /// Install Fabric loader for the instance (internal implementation)
    pub fn install_fabric(&self, instance: &MinecraftInstance, versions_dir: &Path) -> Result<(), BootstrapError> {
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
    fn fetch_fabric_profile(&self) -> Result<JsonValue, BootstrapError> {
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

        let response_text = response.text().map_err(|e| {
            BootstrapError::network_error(
                BootstrapStep::DownloadingManifest,
                format!("Failed to read Fabric profile response: {}", e),
            )
        })?;

        let fabric_version: JsonValue = serde_json::from_str(&response_text).map_err(|e| {
            log::error!("Failed to parse Fabric profile JSON. Response body: {}", response_text);
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
        fabric_profile: &JsonValue,
        version_id: &str,
    ) -> Result<JsonValue, BootstrapError> {
        // Start with the fabric profile
        let mut version_json = fabric_profile.clone();

        // Update the id
        if let Some(obj) = version_json.as_object_mut() {
            obj.insert("id".to_string(), JsonValue::String(version_id.to_string()));
            obj.insert("inheritsFrom".to_string(), JsonValue::String(self.minecraft_version.clone()));
            // Keep other fields as is
        }

        Ok(version_json)
    }

    /// Get the version name for this Fabric installation
    pub fn get_version_name(&self) -> String {
        format!(
            "fabric-loader-{}-{}",
            self.loader_version, self.minecraft_version
        )
    }
}

// Implement the ModLoaderInstaller trait for FabricInstaller
impl<'a> super::ModLoaderInstaller for FabricInstaller<'a> {
    fn name(&self) -> &str {
        "Fabric"
    }

    fn loader_version(&self) -> &str {
        &self.loader_version
    }

    fn minecraft_version(&self) -> &str {
        &self.minecraft_version
    }

    fn download_libraries(
        &self,
        libraries_dir: &Path,
        instance: &MinecraftInstance,
    ) -> Result<(), BootstrapError> {
        log::info!("[Instance: {}] Starting Fabric library download", instance.instanceId);

        // First, generate the Fabric version JSON if it doesn't exist
        let fabric_version_name = self.get_version_name();
        let instance_dir = Path::new(instance.instanceDirectory.as_deref().unwrap_or(""));
        let minecraft_dir = instance_dir.join("minecraft");
        let versions_dir = minecraft_dir.join("versions");
        let fabric_version_dir = versions_dir.join(&fabric_version_name);
        let version_json_path = fabric_version_dir.join(format!("{}.json", fabric_version_name));

        if !version_json_path.exists() {
            log::info!("[Instance: {}] Generating Fabric version JSON", instance.instanceId);
            
            let fabric_profile = self.fetch_fabric_profile()?;

            if !fabric_version_dir.exists() {
                fs::create_dir_all(&fabric_version_dir).map_err(|e| {
                    BootstrapError::filesystem_error(
                        BootstrapStep::CreatingDirectories,
                        format!("Failed to create Fabric version directory: {}", e),
                    )
                })?;
            }

            let version_json = self.generate_version_json(&fabric_profile, &fabric_version_name)?;
            fs::write(&version_json_path, serde_json::to_string_pretty(&version_json).unwrap())
                .map_err(|e| {
                    BootstrapError::filesystem_error(
                        BootstrapStep::CreatingFiles,
                        format!("Failed to write Fabric version JSON: {}", e),
                    )
                })?;
        }

        // Now read the generated Fabric version JSON
        let version_json_content = fs::read_to_string(&version_json_path).map_err(|e| {
            log::error!("[Instance: {}] Failed to read Fabric version JSON: {}", instance.instanceId, e);
            BootstrapError::filesystem_error(
                BootstrapStep::DownloadingLibraries,
                format!("Failed to read Fabric version JSON: {}", e),
            )
        })?;

        let version_details: JsonValue = serde_json::from_str(&version_json_content).map_err(|e| {
            log::error!("[Instance: {}] Failed to parse Fabric version JSON: {}", instance.instanceId, e);
            BootstrapError::network_error(
                BootstrapStep::DownloadingLibraries,
                format!("Failed to parse Fabric version JSON: {}", e),
            )
        })?;

        log::info!("[Instance: {}] Successfully parsed Fabric version JSON", instance.instanceId);

        // Check if libraries exist in the JSON
        if let Some(libraries) = version_details.get("libraries").and_then(|l| l.as_array()) {
            log::info!("[Instance: {}] Found {} libraries in Fabric version JSON", instance.instanceId, libraries.len());
            for lib in libraries {
                if let Some(name) = lib.get("name").and_then(|n| n.as_str()) {
                    log::info!("[Instance: {}] Fabric library: {}", instance.instanceId, name);
                }
            }
        } else {
            log::warn!("[Instance: {}] No libraries found in Fabric version JSON", instance.instanceId);
        }

        // Download the libraries using the standard downloader
        log::info!("[Instance: {}] About to call download_libraries with {} libraries", instance.instanceId, version_details.get("libraries").and_then(|l| l.as_array()).map(|a| a.len()).unwrap_or(0));
        let download_result = download_libraries(
            self.client,
            &version_details,
            libraries_dir,
            instance,
        );
        
        match &download_result {
            Ok(_) => log::info!("[Instance: {}] download_libraries completed successfully", instance.instanceId),
            Err(e) => log::error!("[Instance: {}] download_libraries failed: {}", instance.instanceId, e),
        }
        
        download_result.map_err(|e| {
            log::error!("[Instance: {}] Failed to download Fabric libraries: {}", instance.instanceId, e);
            BootstrapError::network_error(
                BootstrapStep::DownloadingLibraries,
                format!("Failed to download Fabric libraries: {}", e),
            )
        })?;

        log::info!("[Instance: {}] Fabric library download completed", instance.instanceId);
        Ok(())
    }

    fn run_post_install(
        &self,
        _minecraft_dir: &Path,
        versions_dir: &Path,
        instance: &MinecraftInstance,
    ) -> Result<(), BootstrapError> {
        // The version JSON is already generated in install method
        // No additional post-install steps needed
        Ok(())
    }

    fn get_version_name(&self) -> String {
        format!(
            "fabric-loader-{}-{}",
            self.loader_version, self.minecraft_version
        )
    }

    fn requires_java_for_install(&self) -> bool {
        false
    }

    fn install(
        &self,
        _minecraft_dir: &Path,
        versions_dir: &Path,
        libraries_dir: &Path,
        instance: &MinecraftInstance,
    ) -> Result<(), BootstrapError> {
        log::info!(
            "[Instance: {}] Installing Fabric {} for Minecraft {}",
            instance.instanceId,
            self.loader_version(),
            self.minecraft_version()
        );

        // First generate the Fabric version JSON
        let fabric_profile = self.fetch_fabric_profile()?;
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

        // Download loader-specific libraries
        self.download_libraries(libraries_dir, instance)?;

        // Run post-installation steps (which is now empty)
        self.run_post_install(_minecraft_dir, versions_dir, instance)?;

        log::info!(
            "[Instance: {}] Fabric installation completed successfully",
            instance.instanceId
        );

        Ok(())
    }
}
