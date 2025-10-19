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

/// Common trait for all modloader installers.
///
/// This trait defines the interface that all modloader implementations must follow,
/// enabling a consistent and extensible architecture for supporting multiple modloaders.
///
/// # Design Philosophy
///
/// - **Separation of Concerns**: Each modloader handles its own installation logic
/// - **Extensibility**: New modloaders can be added by implementing this trait
/// - **Consistency**: All modloaders follow the same interface and lifecycle
///
/// # Implementation Guide
///
/// To add a new modloader:
///
/// 1. Create a new file in `bootstrap/loaders/` (e.g., `myloader.rs`)
/// 2. Define a struct for your installer (e.g., `MyLoaderInstaller`)
/// 3. Implement this trait for your struct
/// 4. Add a bootstrap method in `instance_bootstrap.rs`
///
/// # Example
///
/// ```rust,ignore
/// pub struct MyLoaderInstaller<'a> {
///     client: &'a reqwest::blocking::Client,
///     minecraft_version: String,
///     loader_version: String,
/// }
///
/// impl<'a> ModLoaderInstaller for MyLoaderInstaller<'a> {
///     fn name(&self) -> &str { "MyLoader" }
///     fn loader_version(&self) -> &str { &self.loader_version }
///     fn minecraft_version(&self) -> &str { &self.minecraft_version }
///     // ... implement other required methods
/// }
/// ```
pub trait ModLoaderInstaller: Send + Sync {
    /// Get the name of the modloader (e.g., "Forge", "Fabric", "NeoForge", "Quilt")
    fn name(&self) -> &str;

    /// Get the loader version being installed (e.g., "47.2.0", "0.15.0")
    fn loader_version(&self) -> &str;

    /// Get the Minecraft version this loader is for (e.g., "1.20.1")
    fn minecraft_version(&self) -> &str;

    /// Download loader-specific libraries.
    ///
    /// This is called after the base Minecraft libraries are downloaded.
    /// Some loaders (like Forge/NeoForge) handle library downloads internally,
    /// while others (like Fabric/Quilt) define libraries in their version JSON.
    ///
    /// # Arguments
    ///
    /// * `libraries_dir` - The directory where libraries should be stored
    /// * `instance` - The Minecraft instance being bootstrapped
    ///
    /// # Returns
    ///
    /// `Ok(())` if libraries were downloaded successfully, or an error describing what went wrong
    fn download_libraries(
        &self,
        libraries_dir: &Path,
        instance: &MinecraftInstance,
    ) -> Result<(), BootstrapError>;

    /// Run post-installation steps (e.g., Forge processors, manifest merging).
    ///
    /// This is called after all files are downloaded and the loader is ready to be configured.
    /// Examples of post-install steps:
    /// - Running Forge processors to patch libraries
    /// - Merging manifests for complex loaders
    /// - Creating version JSON files
    ///
    /// # Arguments
    ///
    /// * `minecraft_dir` - The Minecraft directory (contains versions, libraries, etc.)
    /// * `versions_dir` - The versions directory specifically
    /// * `instance` - The Minecraft instance being bootstrapped
    fn run_post_install(
        &self,
        minecraft_dir: &Path,
        versions_dir: &Path,
        instance: &MinecraftInstance,
    ) -> Result<(), BootstrapError>;

    /// Complete installation flow for the modloader.
    ///
    /// This orchestrates the entire installation process. The default implementation
    /// calls `download_libraries` followed by `run_post_install`, which works for most loaders.
    ///
    /// Override this method if your loader needs a different installation flow.
    ///
    /// # Arguments
    ///
    /// * `minecraft_dir` - The Minecraft directory
    /// * `versions_dir` - The versions directory
    /// * `libraries_dir` - The libraries directory
    /// * `instance` - The Minecraft instance being bootstrapped
    fn install(
        &self,
        minecraft_dir: &Path,
        versions_dir: &Path,
        libraries_dir: &Path,
        instance: &MinecraftInstance,
    ) -> Result<(), BootstrapError> {
        log::info!(
            "[Instance: {}] [Trait] Installing {} {} for Minecraft {} - libraries_dir: {}",
            instance.instanceId,
            self.name(),
            self.loader_version(),
            self.minecraft_version(),
            libraries_dir.display()
        );

        // Download loader-specific libraries
        log::info!("[Instance: {}] [Trait] Calling download_libraries for {}", instance.instanceId, self.name());
        self.download_libraries(libraries_dir, instance)?;

        // Run post-installation steps
        self.run_post_install(minecraft_dir, versions_dir, instance)?;

        log::info!(
            "[Instance: {}] [Trait] {} installation completed successfully",
            instance.instanceId,
            self.name()
        );

        Ok(())
    }

    /// Get the version name that will be used for this loader.
    ///
    /// This is used as the directory name and JSON file name in the versions directory.
    ///
    /// # Examples
    ///
    /// - Forge: "1.20.1-forge-47.2.0"
    /// - Fabric: "fabric-loader-0.15.0-1.20.1"
    /// - NeoForge: "neoforge-20.4.80"
    /// - Quilt: "quilt-loader-0.24.0-1.20.1"
    fn get_version_name(&self) -> String;

    /// Check if this loader requires a Java path for installation.
    ///
    /// Some loaders (Forge, NeoForge) need to run Java installers that process
    /// libraries and set up the environment. Others (Fabric, Quilt) just need
    /// to download files and create version JSONs.
    ///
    /// # Returns
    ///
    /// `true` if Java is required, `false` otherwise
    fn requires_java_for_install(&self) -> bool {
        false
    }
}
