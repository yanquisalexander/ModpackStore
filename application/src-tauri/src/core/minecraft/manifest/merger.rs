use serde_json::{Map, Value};
use std::collections::{BTreeMap, HashMap};

pub struct ManifestMerger;

impl ManifestMerger {
    pub fn merge(vanilla: Value, forge: Value) -> Value {
        let mut result = vanilla.clone();

        log::debug!("Starting manifest merge process");
        log::debug!(
            "Vanilla manifest has mainClass: {}",
            vanilla.get("mainClass").is_some()
        );
        log::debug!(
            "Forge manifest has mainClass: {}",
            forge.get("mainClass").is_some()
        );

        // Merge mainClass - Forge always takes precedence
        if let Some(mc) = forge.get("mainClass") {
            result["mainClass"] = mc.clone();
            log::debug!("Using Forge mainClass: {:?}", mc);
        }

        // Merge other important properties
        Self::merge_basic_properties(&mut result, &vanilla, &forge);
        Self::merge_libraries(&mut result, &vanilla, &forge);
        Self::merge_arguments(&mut result, &vanilla, &forge);
        Self::merge_legacy_arguments(&mut result, &vanilla, &forge);

        log::debug!("Manifest merge completed");
        log::debug!(
            "Final merged manifest has mainClass: {}",
            result.get("mainClass").is_some()
        );
        log::debug!(
            "Final merged manifest libraries count: {}",
            result
                .get("libraries")
                .and_then(|l| l.as_array())
                .map(|a| a.len())
                .unwrap_or(0)
        );

        result
    }

    fn merge_basic_properties(result: &mut Value, vanilla: &Value, forge: &Value) {
        // Merge basic properties, preferring Forge when available

        // Merge releaseTime and time fields
        if let Some(release_time) = forge.get("releaseTime") {
            result["releaseTime"] = release_time.clone();
        }
        if let Some(time) = forge.get("time") {
            result["time"] = time.clone();
        }

        // Merge type field
        if let Some(type_val) = forge.get("type") {
            result["type"] = type_val.clone();
        }

        // Merge minimumLauncherVersion if present
        if let Some(min_launcher) = forge.get("minimumLauncherVersion") {
            result["minimumLauncherVersion"] = min_launcher.clone();
        }

        // Merge assetIndex if Forge specifies it
        if let Some(asset_index) = forge.get("assetIndex") {
            result["assetIndex"] = asset_index.clone();
        } else if let Some(assets) = forge.get("assets") {
            // Handle legacy assets field
            result["assets"] = assets.clone();
        }

        // Merge downloads section if present
        if let Some(downloads) = forge.get("downloads") {
            if let Some(existing_downloads) = result.get_mut("downloads") {
                if let (Some(existing_obj), Some(forge_obj)) =
                    (existing_downloads.as_object_mut(), downloads.as_object())
                {
                    for (key, value) in forge_obj {
                        existing_obj.insert(key.clone(), value.clone());
                    }
                }
            } else {
                result["downloads"] = downloads.clone();
            }
        }

        // Merge logging configuration if present
        if let Some(logging) = forge.get("logging") {
            result["logging"] = logging.clone();
        }

        log::debug!("Merged basic properties from Forge manifest");
    }

    fn merge_libraries(result: &mut Value, vanilla: &Value, forge: &Value) {
        log::debug!("Starting library merge process");

        // Use a map to handle duplicates easily. Key is `group:artifact:classifier`
        let mut merged_libs: BTreeMap<String, Value> = BTreeMap::new();
        let mut vanilla_count = 0;
        let mut forge_count = 0;
        let mut conflicts_resolved = 0;

        // 1. First pass: Add all vanilla libraries as base
        if let Some(arr) = vanilla.get("libraries").and_then(Value::as_array) {
            vanilla_count = arr.len();
            log::debug!("Processing {} vanilla libraries", vanilla_count);

            for lib in arr {
                if let Some((name, ga, version, _, classifier)) = Self::extract_lib_info(lib) {
                    let key = Self::build_lib_key(&ga, &classifier);
                    merged_libs.insert(key, lib.clone());
                    log::debug!("Added vanilla library: {} ({})", name, ga);
                } else {
                    log::warn!("Failed to extract info from vanilla library: {:?}", lib);
                }
            }
        }

        // 2. Second pass: Add Forge libraries, resolving conflicts
        if let Some(arr) = forge.get("libraries").and_then(Value::as_array) {
            forge_count = arr.len();
            log::debug!("Processing {} forge libraries", forge_count);

            for forge_lib in arr {
                if let Some((name, ga, fver, _, classifier)) = Self::extract_lib_info(forge_lib) {
                    let key = Self::build_lib_key(&ga, &classifier);

                    // Check if a version of this library already exists (from vanilla)
                    if let Some(vanilla_lib) = merged_libs.get_mut(&key) {
                        // Conflict: decide which to keep
                        if let Some((_, _, vver, _, _)) = Self::extract_lib_info(vanilla_lib) {
                            if Self::prefer_forge(&ga, &vver, &fver) {
                                // If we prefer Forge, replace the existing entry
                                *vanilla_lib = forge_lib.clone();
                                conflicts_resolved += 1;
                                log::debug!(
                                    "Conflict resolved - using Forge version of {}: {} -> {:?}",
                                    ga,
                                    vver.unwrap_or("unknown".to_string()),
                                    fver
                                );
                            } else {
                                log::debug!("Conflict resolved - keeping vanilla version of {}: {:?} over {:?}", 
                                           ga, vver, fver);
                            }
                        }
                    } else {
                        // No conflict, simply add it
                        merged_libs.insert(key, forge_lib.clone());
                        log::debug!("Added new forge library: {} ({})", name, ga);
                    }
                } else {
                    log::warn!("Failed to extract info from forge library: {:?}", forge_lib);
                }
            }
        }

        let final_count = merged_libs.len();
        result["libraries"] = Value::Array(merged_libs.into_values().collect());

        log::info!("Library merge completed: {} vanilla + {} forge = {} final libraries ({} conflicts resolved)", 
                  vanilla_count, forge_count, final_count, conflicts_resolved);
    }

    fn merge_arguments(result: &mut Value, vanilla: &Value, forge: &Value) {
        log::debug!("Starting arguments merge process");

        let mut args_map = Map::default();
        let mut total_args = 0;

        for kind in &["game", "jvm"] {
            let mut list = Vec::new();
            let mut vanilla_args = 0;
            let mut forge_args = 0;

            // Add vanilla arguments first
            if let Some(v) = vanilla
                .get("arguments")
                .and_then(|a| a.get(kind))
                .and_then(Value::as_array)
            {
                vanilla_args = v.len();
                list.extend_from_slice(v);
            }

            // Add forge arguments
            if let Some(f) = forge
                .get("arguments")
                .and_then(|a| a.get(kind))
                .and_then(Value::as_array)
            {
                forge_args = f.len();
                list.extend_from_slice(f);
            }

            if !list.is_empty() {
                args_map.insert(kind.to_string(), Value::Array(list));
                total_args += vanilla_args + forge_args;
                log::debug!(
                    "Merged {} arguments: {} vanilla + {} forge = {} total",
                    kind,
                    vanilla_args,
                    forge_args,
                    vanilla_args + forge_args
                );
            }
        }

        if !args_map.is_empty() {
            result["arguments"] = Value::Object(args_map);
            log::debug!(
                "Arguments merge completed with {} total arguments",
                total_args
            );
        } else {
            log::debug!("No modern arguments found to merge");
        }
    }

    fn merge_legacy_arguments(result: &mut Value, vanilla: &Value, forge: &Value) {
        log::debug!("Starting legacy arguments merge process");

        // Enhanced logic to be more robust and avoid panics
        let mut kv = HashMap::new();
        let mut vanilla_processed = false;
        let mut forge_processed = false;

        for (source_name, src) in [
            ("vanilla", vanilla.get("minecraftArguments")),
            ("forge", forge.get("minecraftArguments")),
        ] {
            if let Some(Value::String(s)) = src {
                log::debug!("Processing {} legacy arguments: {}", source_name, s);
                let args: Vec<&str> = s.split_whitespace().collect();

                // Parse arguments in pairs safely
                let mut i = 0;
                while i < args.len() {
                    if let Some(key) = args.get(i) {
                        if key.starts_with("--") {
                            // Found a flag, look for its value
                            if let Some(value) = args.get(i + 1) {
                                if !value.starts_with("--") {
                                    // This is a key-value pair
                                    kv.insert(key.to_string(), value.to_string());
                                    i += 2;
                                    continue;
                                }
                            }
                            // This is a standalone flag (no value)
                            kv.insert(key.to_string(), "".to_string());
                            i += 1;
                        } else {
                            // Not a flag, skip
                            i += 1;
                        }
                    } else {
                        break;
                    }
                }

                if source_name == "vanilla" {
                    vanilla_processed = true;
                } else {
                    forge_processed = true;
                }
            }
        }

        if !kv.is_empty() {
            let merged_legacy = kv
                .iter()
                .map(|(k, v)| {
                    if v.is_empty() {
                        k.clone()
                    } else {
                        format!("{} {}", k, v)
                    }
                })
                .collect::<Vec<_>>()
                .join(" ");

            result["minecraftArguments"] = Value::String(merged_legacy.clone());

            log::debug!(
                "Legacy arguments merge completed: {} pairs from {} sources",
                kv.len(),
                if vanilla_processed && forge_processed {
                    "both"
                } else if vanilla_processed {
                    "vanilla only"
                } else {
                    "forge only"
                }
            );
            log::debug!("Merged legacy arguments: {}", merged_legacy);
        } else {
            log::debug!("No legacy arguments found to merge");
        }
    }

    // --- Funciones de ayuda (sin cambios, excepto que 'build_complete_lib_key' y 'furl' ya no se usan) ---

    fn extract_lib_info(
        lib: &Value,
    ) -> Option<(
        String,
        String,
        Option<String>,
        Option<String>,
        Option<String>,
    )> {
        let name = lib.get("name")?.as_str()?.to_string();
        let parts: Vec<&str> = name.split(':').collect();
        let ga = if parts.len() >= 2 {
            format!("{}:{}", parts[0], parts[1])
        } else {
            name.clone()
        };
        let version = parts.get(2).map(|s| s.to_string());
        // El clasificador puede estar en varios sitios, esta lógica es correcta
        let classifier = lib
            .get("downloads")
            .and_then(|d| d.get("artifact"))
            .and_then(|a| a.get("classifier"))
            .or_else(|| lib.get("classifier"))
            .and_then(Value::as_str)
            .map(String::from);
        let url = lib.get("url").and_then(Value::as_str).map(String::from);
        Some((name, ga, version, url, classifier))
    }

    fn build_lib_key(ga: &str, classifier: &Option<String>) -> String {
        if let Some(c) = classifier {
            format!("{}:{}", ga, c)
        } else {
            ga.to_string()
        }
    }

    // Enhanced rules for deciding if we prefer the Forge version over the Vanilla version
    fn prefer_forge(ga: &str, vver: &Option<String>, fver: &Option<String>) -> bool {
        // Special rule for log4j: always use the most recent version for security
        if ga.contains("log4j") {
            if let (Some(v_str), Some(f_str)) = (vver, fver) {
                return Self::is_version_newer(f_str, v_str);
            }
        }

        // Special rule for LWJGL: Forge usually has better compatibility
        if ga.contains("lwjgl") {
            if let (Some(v_str), Some(f_str)) = (vver, fver) {
                // For LWJGL, prefer Forge if versions are different
                return f_str != v_str;
            }
            return true; // Prefer Forge if we can't compare versions
        }

        // Special rule for Guava: prefer newer versions
        if ga.contains("guava") {
            if let (Some(v_str), Some(f_str)) = (vver, fver) {
                return Self::is_version_newer(f_str, v_str);
            }
        }

        // Special rule for ASM: Forge versions are often more compatible
        if ga.contains("asm") || ga.contains("objectweb") {
            return true;
        }

        // Special rule for Netty: prefer newer versions for performance
        if ga.contains("netty") {
            if let (Some(v_str), Some(f_str)) = (vver, fver) {
                return Self::is_version_newer(f_str, v_str);
            }
        }

        // Default rule: always prefer the Forge library if no other rule applies
        // This ensures Forge-specific modifications are preserved
        true
    }

    // Helper function to compare versions
    fn is_version_newer(new_version: &str, old_version: &str) -> bool {
        // Simple version comparison - split by dots and compare numerically
        let new_parts: Vec<u32> = new_version
            .split('.')
            .filter_map(|p| p.parse().ok())
            .collect();
        let old_parts: Vec<u32> = old_version
            .split('.')
            .filter_map(|p| p.parse().ok())
            .collect();

        // Compare version parts
        for (new, old) in new_parts.iter().zip(old_parts.iter()) {
            if new > old {
                return true;
            } else if new < old {
                return false;
            }
        }

        // If all compared parts are equal, prefer the one with more parts
        new_parts.len() > old_parts.len()
    }
}
