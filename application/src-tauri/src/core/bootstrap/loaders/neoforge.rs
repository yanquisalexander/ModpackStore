// src/core/bootstrap/loaders/neoforge.rs
// NeoForge loader installer implementation

use crate::core::bootstrap::download::download_file;
use crate::core::bootstrap_error::{BootstrapError, BootstrapStep};
use crate::core::minecraft_instance::MinecraftInstance;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use tauri_plugin_http::reqwest;

const NEOFORGE_MAVEN_URL: &str = "https://maven.neoforged.net/releases";
const NEOFORGE_META_URL: &str = "https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge";

#[derive(Serialize, Deserialize, Debug, Clone)]
struct NeoForgeVersions {
    versions: Vec<String>,
}

pub struct NeoForgeInstaller<'a> {
    client: &'a reqwest::blocking::Client,
    minecraft_version: String,
    neoforge_version: String,
}

impl<'a> NeoForgeInstaller<'a> {
    pub fn new(
        client: &'a reqwest::blocking::Client,
        minecraft_version: String,
        neoforge_version: String,
    ) -> Self {
        Self {
            client,
            minecraft_version,
            neoforge_version,
        }
    }

    /// Fetch available NeoForge versions
    pub fn fetch_loader_versions(
        client: &reqwest::blocking::Client,
    ) -> Result<Vec<String>, String> {
        let response = client
            .get(NEOFORGE_META_URL)
            .send()
            .map_err(|e| format!("Failed to fetch NeoForge versions: {}", e))?;

        if !response.status().is_success() {
            return Err(format!(
                "Failed to fetch NeoForge versions: HTTP {}",
                response.status()
            ));
        }

        let versions: NeoForgeVersions = response
            .json()
            .map_err(|e| format!("Failed to parse NeoForge versions: {}", e))?;

        Ok(versions.versions)
    }

    /// Install NeoForge for the instance
    pub fn install(
        &self,
        instance: &MinecraftInstance,
        minecraft_dir: &Path,
        versions_dir: &Path,
        java_path: &str,
    ) -> Result<(), BootstrapError> {
        log::info!(
            "[Instance: {}] Installing NeoForge {} for Minecraft {}",
            instance.instanceId,
            self.neoforge_version,
            self.minecraft_version
        );

        // Download NeoForge installer
        let installer_path = self.download_installer(minecraft_dir)?;

        // Run NeoForge installer
        self.run_installer(&installer_path, minecraft_dir, java_path, instance)?;

        log::info!(
            "[Instance: {}] NeoForge installation completed successfully",
            instance.instanceId
        );

        Ok(())
    }

    /// Download NeoForge installer JAR
    fn download_installer(&self, minecraft_dir: &Path) -> Result<PathBuf, BootstrapError> {
        let installer_url = format!(
            "{}/net/neoforged/neoforge/{}/neoforge-{}-installer.jar",
            NEOFORGE_MAVEN_URL, self.neoforge_version, self.neoforge_version
        );

        let installer_path = minecraft_dir.join("neoforge-installer.jar");

        log::debug!(
            "Downloading NeoForge installer from: {}",
            installer_url
        );

        download_file(self.client, &installer_url, &installer_path).map_err(|e| {
            BootstrapError::network_error(
                BootstrapStep::DownloadingForgeInstaller,
                format!("Failed to download NeoForge installer: {}", e),
            )
        })?;

        Ok(installer_path)
    }

    /// Run NeoForge installer
    fn run_installer(
        &self,
        installer_path: &Path,
        minecraft_dir: &Path,
        java_path: &str,
        instance: &MinecraftInstance,
    ) -> Result<(), BootstrapError> {
        let install_type = if instance.is_server() { "Server" } else { "Client" };
        log::info!(
            "[Instance: {}] Running NeoForge installer ({})",
            instance.instanceId,
            install_type
        );
        
        let install_arg = if instance.is_server() { "--installServer" } else { "--installClient" };

        let mut install_cmd = Command::new(java_path);
        install_cmd
            .arg("-jar")
            .arg(installer_path)
            .arg(install_arg)
            .arg(minecraft_dir)
            .current_dir(minecraft_dir);

        // On Windows, use CREATE_NO_WINDOW flag
        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            install_cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
        }

        log::debug!(
            "[Instance: {}] Executing NeoForge installer: {:?}",
            instance.instanceId,
            install_cmd
        );

        let output = install_cmd.output().map_err(|e| {
            BootstrapError::filesystem_error(
                BootstrapStep::RunningForgeInstaller,
                format!("Failed to execute NeoForge installer: {}", e),
            )
        })?;

        if !output.status.success() {
            let error_msg = String::from_utf8_lossy(&output.stderr);
            let stdout_msg = String::from_utf8_lossy(&output.stdout);

            log::error!(
                "[Instance: {}] NeoForge installer failed - stderr: {}",
                instance.instanceId,
                error_msg
            );
            log::error!(
                "[Instance: {}] NeoForge installer failed - stdout: {}",
                instance.instanceId,
                stdout_msg
            );

            return Err(BootstrapError::new(
                BootstrapStep::RunningForgeInstaller,
                crate::core::bootstrap_error::ErrorCategory::Forge,
                format!("NeoForge installer failed: {}", error_msg),
            ));
        }

        log::info!(
            "[Instance: {}] NeoForge installer completed successfully",
            instance.instanceId
        );

        Ok(())
    }

    /// Get the version name for this NeoForge installation
    pub fn get_version_name(&self) -> String {
        format!("neoforge-{}", self.neoforge_version)
    }
}

// Implement the ModLoaderInstaller trait for NeoForgeInstaller
impl<'a> super::ModLoaderInstaller for NeoForgeInstaller<'a> {
    fn name(&self) -> &str {
        "NeoForge"
    }

    fn loader_version(&self) -> &str {
        &self.neoforge_version
    }

    fn minecraft_version(&self) -> &str {
        &self.minecraft_version
    }

    fn download_libraries(
        &self,
        _libraries_dir: &Path,
        _instance: &MinecraftInstance,
    ) -> Result<(), BootstrapError> {
        // NeoForge installer handles library downloads internally
        Ok(())
    }

    fn run_post_install(
        &self,
        _minecraft_dir: &Path,
        _versions_dir: &Path,
        _instance: &MinecraftInstance,
    ) -> Result<(), BootstrapError> {
        // Post-install steps are handled by the NeoForge installer
        Ok(())
    }

    fn get_version_name(&self) -> String {
        format!("neoforge-{}", self.neoforge_version)
    }

    fn requires_java_for_install(&self) -> bool {
        true
    }
}
