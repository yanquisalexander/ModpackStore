use super::super::version_compatibility::{VersionCompatibility, VersionGeneration};
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

    pub fn load_merged_manifest(&self) -> Option<Value> {
        let manifest_file = self.paths.manifest_file();
        log::info!("Loading version manifest from {}", manifest_file.display());

        let manifest_data = fs::read_to_string(&manifest_file).ok()?;
        let mut manifest_json: Value = serde_json::from_str(&manifest_data).ok()?;

        // Detect version and apply compatibility fixes
        let version = manifest_json
            .get("id")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .unwrap_or_else(|| self.paths.minecraft_version().to_string());

        // Apply version-specific fixes before merging
        self.apply_version_compatibility_fixes(&mut manifest_json, &version);

        // Check for inheritance
        if let Some(inherits_from) = manifest_json.get("inheritsFrom").and_then(|v| v.as_str()) {
            log::info!("Found modded instance inheriting from {}", inherits_from);
            return self.merge_with_vanilla(&manifest_json, inherits_from);
        }

        Some(manifest_json)
    }

    /// Apply version-specific compatibility fixes to the manifest
    fn apply_version_compatibility_fixes(&self, manifest: &mut Value, version: &str) {
        let generation = VersionCompatibility::detect_generation(version, Some(manifest));

        // Ensure proper mainClass is set using dynamic detection
        if manifest.get("mainClass").is_none() {
            if let Some(detected_main_class) = VersionCompatibility::detect_main_class(manifest, version) {
                manifest["mainClass"] = Value::String(detected_main_class);
            } else {
                // Fallback to default
                let main_class = VersionCompatibility::get_default_main_class(&generation);
                manifest["mainClass"] = Value::String(main_class.to_string());
            }
        }

        // Ensure proper asset index
        if manifest.get("assets").is_none() && manifest.get("assetIndex").is_none() {
            let asset_index = VersionCompatibility::get_asset_index_name(version, Some(manifest));
            manifest["assets"] = Value::String(asset_index);
        }

        // Add version-specific JVM arguments if missing
        self.ensure_jvm_arguments(manifest, version, &generation);

        // Fix legacy argument format issues
        if generation == VersionGeneration::Legacy {
            self.fix_legacy_arguments(manifest);
        }
    }

    /// Ensure proper JVM arguments are present
    fn ensure_jvm_arguments(
        &self,
        manifest: &mut Value,
        version: &str,
        generation: &VersionGeneration,
    ) {
        let version_specific_args = VersionCompatibility::get_version_specific_jvm_args(version);

        if !version_specific_args.is_empty() {
            match generation {
                VersionGeneration::Modern | VersionGeneration::Future => {
                    // Asegurarse de que manifest sea un objeto JSON
                    if !manifest.is_object() {
                        *manifest = Value::Object(serde_json::Map::new());
                    }

                    if let Value::Object(manifest_map) = manifest {
                        // Obtener o crear el objeto "arguments"
                        let args_obj = manifest_map
                            .entry("arguments")
                            .or_insert_with(|| Value::Object(serde_json::Map::new()));

                        if let Value::Object(args_map) = args_obj {
                            // Obtener o crear el array "jvm" dentro de "arguments"
                            let jvm_args = args_map
                                .entry("jvm")
                                .or_insert_with(|| Value::Array(Vec::new()));

                            if let Value::Array(jvm_array) = jvm_args {
                                for arg in version_specific_args {
                                    let arg_value = Value::String(arg);
                                    if !jvm_array.contains(&arg_value) {
                                        jvm_array.push(arg_value);
                                    }
                                }
                            }
                        }
                    }
                }
                _ => {
                    // Para versiones legacy, los args JVM se agregarían en el launcher
                    log::debug!("Legacy version detected, JVM args will be added during launch");
                }
            }
        }
    }

    /// Fix common issues with legacy argument format
    fn fix_legacy_arguments(&self, manifest: &mut Value) {
        if let Some(Value::String(args)) = manifest.get("minecraftArguments") {
            // Ensure arguments are properly formatted
            let cleaned_args = args.split_whitespace().collect::<Vec<_>>().join(" ");

            if cleaned_args != *args {
                manifest["minecraftArguments"] = Value::String(cleaned_args);
                log::debug!("Fixed legacy argument formatting");
            }
        }
    }

    /// Merge modded manifest with vanilla base
    fn merge_with_vanilla(&self, forge_manifest: &Value, inherits_from: &str) -> Option<Value> {
        let vanilla_manifest_file = self.paths.vanilla_manifest_file(inherits_from);

        let vanilla_manifest_data = fs::read_to_string(&vanilla_manifest_file).ok()?;
        let mut vanilla_manifest: Value = serde_json::from_str(&vanilla_manifest_data).ok()?;

        // Apply compatibility fixes to vanilla manifest too
        self.apply_version_compatibility_fixes(&mut vanilla_manifest, inherits_from);

        log::info!(
            "Merging {} with vanilla {}",
            forge_manifest
                .get("id")
                .and_then(|v| v.as_str())
                .unwrap_or("unknown"),
            inherits_from
        );

        Some(ManifestMerger::merge(
            vanilla_manifest,
            forge_manifest.clone(),
        ))
    }
}
