// src/core/bootstrap/loaders/mod.rs
// Module for loader-specific installers (Fabric, NeoForge, Quilt, Forge)

use crate::core::bootstrap_error::BootstrapError;
use crate::core::minecraft_instance::MinecraftInstance;
use serde_json::Value as JsonValue;
use std::path::{Path, PathBuf};

pub mod fabric;
pub mod forge;
pub mod neoforge;
pub mod quilt;

pub use fabric::*;
pub use forge::*;
pub use neoforge::*;
pub use quilt::*;

/// Common trait for all modloader installers
/// Defines the interface that all modloader implementations must follow
pub trait ModLoaderInstaller: Send + Sync {
    /// Get the name of the modloader (e.g., "Forge", "Fabric", "NeoForge", "Quilt")
    fn name(&self) -> &str;

    /// Get the loader version being installed
    fn loader_version(&self) -> &str;

    /// Get the Minecraft version this loader is for
    fn minecraft_version(&self) -> &str;

    /// Download loader-specific libraries
    /// This is called after the base Minecraft libraries are downloaded
    fn download_libraries(
        &self,
        libraries_dir: &Path,
        instance: &MinecraftInstance,
    ) -> Result<(), BootstrapError>;

    /// Run post-installation steps (e.g., Forge processors, manifest merging)
    /// This is called after all files are downloaded and ready
    fn run_post_install(
        &self,
        minecraft_dir: &Path,
        versions_dir: &Path,
        instance: &MinecraftInstance,
    ) -> Result<(), BootstrapError>;

    /// Complete installation flow for the modloader
    /// This orchestrates the entire installation process
    fn install(
        &self,
        minecraft_dir: &Path,
        versions_dir: &Path,
        libraries_dir: &Path,
        instance: &MinecraftInstance,
    ) -> Result<(), BootstrapError> {
        log::info!(
            "[Instance: {}] Installing {} {} for Minecraft {}",
            instance.instanceId,
            self.name(),
            self.loader_version(),
            self.minecraft_version()
        );

        // Download loader-specific libraries
        self.download_libraries(libraries_dir, instance)?;

        // Run post-installation steps
        self.run_post_install(minecraft_dir, versions_dir, instance)?;

        log::info!(
            "[Instance: {}] {} installation completed successfully",
            instance.instanceId,
            self.name()
        );

        Ok(())
    }

    /// Get the version name that will be used for this loader
    /// Format: e.g., "1.20.1-forge-47.2.0" or "fabric-loader-0.15.0-1.20.1"
    fn get_version_name(&self) -> String;

    /// Check if this loader requires a Java path for installation
    /// (e.g., Forge and NeoForge need Java to run their installers)
    fn requires_java_for_install(&self) -> bool {
        false
    }
}
