use super::merger::ManifestMerger;
use crate::core::minecraft::paths::MinecraftPaths;
use serde_json::Value;
use std::fs;

pub struct ManifestParser<'a> {
    paths: &'a MinecraftPaths,
}

impl<'a> ManifestParser<'a> {
    pub fn new(paths: &'a MinecraftPaths) -> Self {
        Self { paths }
    }

    pub fn load_merged_manifest(&self) -> Result<Value, String> {
        let manifest_file = self.paths.manifest_file();
        log::info!("Loading version manifest from {}", manifest_file.display());

        // Validate that manifest file exists
        if !manifest_file.exists() {
            let error_msg = format!("Manifest file not found: {}", manifest_file.display());
            log::error!("{}", error_msg);
            return Err(error_msg);
        }

        // Read and parse main manifest
        let manifest_data = fs::read_to_string(&manifest_file).map_err(|e| {
            let error_msg = format!(
                "Failed to read manifest file '{}': {}",
                manifest_file.display(),
                e
            );
            log::error!("{}", error_msg);
            error_msg
        })?;

        let manifest_json: Value = serde_json::from_str(&manifest_data).map_err(|e| {
            let error_msg = format!(
                "Failed to parse manifest JSON from '{}': {}",
                manifest_file.display(),
                e
            );
            log::error!("{}", error_msg);
            error_msg
        })?;

        log::debug!(
            "Successfully parsed manifest. Keys: {:?}",
            manifest_json
                .as_object()
                .map(|obj| obj.keys().collect::<Vec<_>>())
        );

        // Check for inheritance
        if let Some(inherits_from) = manifest_json.get("inheritsFrom").and_then(|v| v.as_str()) {
            log::info!("Found modded instance inheriting from {}", inherits_from);
            let vanilla_manifest_file = self.paths.vanilla_manifest_file(inherits_from);

            // Validate vanilla manifest exists
            if !vanilla_manifest_file.exists() {
                let error_msg = format!(
                    "Parent manifest file not found: {}",
                    vanilla_manifest_file.display()
                );
                log::error!("{}", error_msg);
                return Err(error_msg);
            }

            // Read and parse vanilla manifest
            let vanilla_manifest_data =
                fs::read_to_string(&vanilla_manifest_file).map_err(|e| {
                    let error_msg = format!(
                        "Failed to read parent manifest file '{}': {}",
                        vanilla_manifest_file.display(),
                        e
                    );
                    log::error!("{}", error_msg);
                    error_msg
                })?;

            let vanilla_manifest: Value =
                serde_json::from_str(&vanilla_manifest_data).map_err(|e| {
                    let error_msg = format!(
                        "Failed to parse parent manifest JSON from '{}': {}",
                        vanilla_manifest_file.display(),
                        e
                    );
                    log::error!("{}", error_msg);
                    error_msg
                })?;

            log::debug!(
                "Successfully parsed parent manifest. Keys: {:?}",
                vanilla_manifest
                    .as_object()
                    .map(|obj| obj.keys().collect::<Vec<_>>())
            );

            let merged_manifest = ManifestMerger::merge(vanilla_manifest, manifest_json);
            log::info!("Successfully merged manifests for modded instance");

            // Log important merged properties for debugging
            log::debug!(
                "Merged manifest mainClass: {:?}",
                merged_manifest.get("mainClass")
            );
            log::debug!(
                "Merged manifest libraries count: {}",
                merged_manifest
                    .get("libraries")
                    .and_then(|l| l.as_array())
                    .map(|a| a.len())
                    .unwrap_or(0)
            );
            log::debug!(
                "Merged manifest has arguments: {}",
                merged_manifest.get("arguments").is_some()
            );
            log::debug!(
                "Merged manifest has minecraftArguments: {}",
                merged_manifest.get("minecraftArguments").is_some()
            );

            return Ok(merged_manifest);
        }

        log::info!("Using standalone manifest (no inheritance)");
        log::debug!(
            "Standalone manifest mainClass: {:?}",
            manifest_json.get("mainClass")
        );
        log::debug!(
            "Standalone manifest libraries count: {}",
            manifest_json
                .get("libraries")
                .and_then(|l| l.as_array())
                .map(|a| a.len())
                .unwrap_or(0)
        );

        Ok(manifest_json)
    }
}
