// src/core/bootstrap/loaders/forge.rs
// Forge loader installer implementation

use crate::core::bootstrap::download::download_file;
use crate::core::bootstrap::manifest::build_forge_installer_url;
use crate::core::bootstrap_error::{BootstrapError, BootstrapStep};
use crate::core::minecraft_instance::MinecraftInstance;
use serde_json::json;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use tauri_plugin_http::reqwest;

pub struct ForgeInstaller<'a> {
    client: &'a reqwest::blocking::Client,
    minecraft_version: String,
    forge_version: String,
}

impl<'a> ForgeInstaller<'a> {
    pub fn new(
        client: &'a reqwest::blocking::Client,
        minecraft_version: String,
        forge_version: String,
    ) -> Self {
        Self {
            client,
            minecraft_version,
            forge_version,
        }
    }

    /// Get the version name for this Forge installation
    pub fn get_version_name(&self) -> String {
        format!("{}-forge-{}", self.minecraft_version, self.forge_version)
    }

    /// Install Forge for the instance
    /// This downloads the Forge installer and runs it
    pub fn install(
        &self,
        minecraft_dir: &Path,
        versions_dir: &Path,
        instance: &MinecraftInstance,
        java_path: &str,
    ) -> Result<(), BootstrapError> {
        log::info!(
            "[Instance: {}] Installing Forge {} for Minecraft {}",
            instance.instanceId,
            self.forge_version,
            self.minecraft_version
        );

        // Create Forge version directory
        let forge_version_name = self.get_version_name();
        let forge_version_dir = versions_dir.join(&forge_version_name);

        if !forge_version_dir.exists() {
            fs::create_dir_all(&forge_version_dir).map_err(|e| {
                BootstrapError::filesystem_error(
                    BootstrapStep::CreatingDirectories,
                    format!("Failed to create Forge version directory: {}", e),
                )
            })?;
        }

        // Download Forge installer
        let installer_path = self.download_installer(minecraft_dir)?;

        // Run Forge installer
        self.run_installer(&installer_path, minecraft_dir, instance, java_path)?;

        log::info!(
            "[Instance: {}] Forge installation completed successfully",
            instance.instanceId
        );

        Ok(())
    }

    /// Download the Forge installer JAR
    fn download_installer(&self, minecraft_dir: &Path) -> Result<PathBuf, BootstrapError> {
        let installer_url = build_forge_installer_url(&self.minecraft_version, &self.forge_version);
        let installer_path = minecraft_dir.join("forge-installer.jar");

        log::debug!("Downloading Forge installer from: {}", installer_url);

        download_file(self.client, &installer_url, &installer_path).map_err(|e| {
            BootstrapError::network_error(
                BootstrapStep::DownloadingForgeInstaller,
                format!("Failed to download Forge installer: {}", e),
            )
        })?;

        Ok(installer_path)
    }

    /// Run the Forge installer
    /// Tries multiple installation options until one succeeds
    fn run_installer(
        &self,
        installer_path: &Path,
        minecraft_dir: &Path,
        instance: &MinecraftInstance,
        java_path: &str,
    ) -> Result<(), BootstrapError> {
        log::info!(
            "[Instance: {}] Starting Forge installer - Minecraft: {}, Forge: {}",
            instance.instanceId,
            self.minecraft_version,
            self.forge_version
        );

        log::debug!(
            "[Instance: {}] Using Java path: {}",
            instance.instanceId,
            java_path
        );

        // Create temporary installation profile
        let install_profile = minecraft_dir.join("forge-install-profile.json");
        let install_profile_content = json!({
            "profile": format!("forge-{}-{}", self.minecraft_version, self.forge_version),
            "version": format!("{}-forge-{}", self.minecraft_version, self.forge_version),
            "installDir": minecraft_dir.to_string_lossy(),
            "minecraft": self.minecraft_version,
            "forge": self.forge_version
        });

        log::debug!(
            "[Instance: {}] Creating Forge install profile at: {}",
            instance.instanceId,
            install_profile.display()
        );

        fs::write(&install_profile, install_profile_content.to_string()).map_err(|e| {
            log::error!(
                "[Instance: {}] Failed to create install profile: {}",
                instance.instanceId,
                e
            );
            BootstrapError::filesystem_error(
                BootstrapStep::RunningForgeInstaller,
                format!("Error creating installation profile: {}", e),
            )
        })?;

        // Try different installation options sequentially
        let install_options = ["--installClient", "--installDir", "--installServer"];
        let mut success = false;
        let mut last_error = String::new();
        let mut attempted_options = Vec::new();

        log::info!(
            "[Instance: {}] Attempting Forge installation with {} options",
            instance.instanceId,
            install_options.len()
        );

        for &option in &install_options {
            attempted_options.push(option);

            let mut install_cmd = Command::new(java_path);
            install_cmd
                .arg("-jar")
                .arg(installer_path)
                .arg(option)
                .current_dir(minecraft_dir);

            // On Windows, use CREATE_NO_WINDOW to prevent CMD window popup
            #[cfg(target_os = "windows")]
            {
                use std::os::windows::process::CommandExt;
                install_cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
            }

            log::info!(
                "[Instance: {}] Executing Forge installer with option '{}': {:?}",
                instance.instanceId,
                option,
                install_cmd
            );

            match install_cmd.output() {
                Ok(output) => {
                    if output.status.success() {
                        success = true;
                        log::info!(
                            "[Instance: {}] Forge installation completed successfully using option '{}'",
                            instance.instanceId,
                            option
                        );
                        break;
                    } else {
                        let error_msg = String::from_utf8_lossy(&output.stderr);
                        let stdout_msg = String::from_utf8_lossy(&output.stdout);

                        log::warn!(
                            "[Instance: {}] Forge installation failed with option '{}' - Exit code: {:?}",
                            instance.instanceId,
                            option,
                            output.status.code()
                        );
                        log::debug!(
                            "[Instance: {}] Forge installer stderr: {}",
                            instance.instanceId,
                            error_msg
                        );
                        log::debug!(
                            "[Instance: {}] Forge installer stdout: {}",
                            instance.instanceId,
                            stdout_msg
                        );

                        last_error = format!(
                            "Forge installation error with {}: {}",
                            option, error_msg
                        );
                    }
                }
                Err(e) => {
                    log::error!(
                        "[Instance: {}] Failed to execute Forge installer with option '{}': {}",
                        instance.instanceId,
                        option,
                        e
                    );
                    last_error = format!(
                        "Failed to execute Forge installer with {}: {}",
                        option, e
                    );
                }
            }
        }

        // Clean up temporary installation profile
        if install_profile.exists() {
            if let Err(e) = fs::remove_file(&install_profile) {
                log::warn!(
                    "[Instance: {}] Failed to remove install profile: {}",
                    instance.instanceId,
                    e
                );
            } else {
                log::debug!(
                    "[Instance: {}] Cleaned up install profile",
                    instance.instanceId
                );
            }
        }

        // Check final result
        if success {
            log::info!(
                "[Instance: {}] Forge installation completed successfully",
                instance.instanceId
            );
            Ok(())
        } else {
            log::error!(
                "[Instance: {}] All Forge installation methods failed. Attempted options: {:?}. Last error: {}",
                instance.instanceId,
                attempted_options,
                last_error
            );
            Err(
                BootstrapError::forge_error(last_error).with_technical_details(format!(
                    "Tried installation options: {:?}. All failed.",
                    attempted_options
                )),
            )
        }
    }
}

// Implement the ModLoaderInstaller trait for ForgeInstaller
impl<'a> super::ModLoaderInstaller for ForgeInstaller<'a> {
    fn name(&self) -> &str {
        "Forge"
    }

    fn loader_version(&self) -> &str {
        &self.forge_version
    }

    fn minecraft_version(&self) -> &str {
        &self.minecraft_version
    }

    fn download_libraries(
        &self,
        _libraries_dir: &Path,
        _instance: &MinecraftInstance,
    ) -> Result<(), BootstrapError> {
        // Forge installer handles library downloads internally
        // No need to manually download libraries
        Ok(())
    }

    fn run_post_install(
        &self,
        minecraft_dir: &Path,
        versions_dir: &Path,
        instance: &MinecraftInstance,
    ) -> Result<(), BootstrapError> {
        // For Forge, we need Java to run the installer
        // This will be handled by the bootstrap flow
        // The actual installation is done in the `install` method
        Ok(())
    }

    fn get_version_name(&self) -> String {
        format!("{}-forge-{}", self.minecraft_version, self.forge_version)
    }

    fn requires_java_for_install(&self) -> bool {
        true
    }
}
