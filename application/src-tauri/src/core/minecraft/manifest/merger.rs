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
        if let Some(release_time) = forge.get("releaseTime") {
            result["releaseTime"] = release_time.clone();
        }
        if let Some(time) = forge.get("time") {
            result["time"] = time.clone();
        }
        if let Some(type_val) = forge.get("type") {
            result["type"] = type_val.clone();
        }
        if let Some(min_launcher) = forge.get("minimumLauncherVersion") {
            result["minimumLauncherVersion"] = min_launcher.clone();
        }
        if let Some(asset_index) = forge.get("assetIndex") {
            result["assetIndex"] = asset_index.clone();
        } else if let Some(assets) = forge.get("assets") {
            result["assets"] = assets.clone();
        }
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
        if let Some(logging) = forge.get("logging") {
            result["logging"] = logging.clone();
        }
        log::debug!("Merged basic properties from Forge manifest");
    }

    fn merge_libraries(result: &mut Value, vanilla: &Value, forge: &Value) {
        log::debug!("Starting library merge process");

        let mut merged_libs: BTreeMap<String, Value> = BTreeMap::new();
        let mut vanilla_count = 0;
        let mut forge_count = 0;
        let mut conflicts_resolved = 0;

        if let Some(arr) = vanilla.get("libraries").and_then(Value::as_array) {
            vanilla_count = arr.len();
            for lib in arr {
                if let Some((name, ga, version, _, classifier)) = Self::extract_lib_info(lib) {
                    let key = Self::build_lib_key(&ga, &version, &classifier);
                    merged_libs.insert(key, lib.clone());
                    log::debug!("Added vanilla library: {} ({})", name, ga);
                } else {
                    log::warn!("Failed to extract info from vanilla library: {:?}", lib);
                }
            }
        }

        if let Some(arr) = forge.get("libraries").and_then(Value::as_array) {
            forge_count = arr.len();
            for forge_lib in arr {
                if let Some((name, ga, fver, _, classifier)) = Self::extract_lib_info(forge_lib) {
                    let key = Self::build_lib_key(&ga, &fver, &classifier);

                    if let Some(existing_lib) = merged_libs.get_mut(&key) {
                        // Library already exists → check if it's a real conflict
                        if let Some((_, _, vver, _, _)) = Self::extract_lib_info(existing_lib) {
                            // Check if versions are identical
                            if vver == fver {
                                // Same version - keep existing, but count as duplicate resolution
                                log::debug!(
                                    "Duplicate library found - {} version {:?} (keeping existing)",
                                    ga,
                                    vver
                                );
                                conflicts_resolved += 1;
                            } else {
                                // Different versions - real conflict
                                if Self::prefer_forge(&ga, &vver, &fver) {
                                    *existing_lib = forge_lib.clone();
                                    log::info!(
                                        "Version conflict resolved - replaced Vanilla {} {:?} with Forge {:?}",
                                        ga,
                                        vver,
                                        fver
                                    );
                                } else {
                                    log::info!(
                                        "Version conflict resolved - kept Vanilla {} {:?} over Forge {:?}",
                                        ga,
                                        vver,
                                        fver
                                    );
                                }
                                conflicts_resolved += 1;
                            }
                        } else {
                            // Si no se pudo extraer versión, Forge pisa
                            *existing_lib = forge_lib.clone();
                            log::debug!("Conflict resolved (no version info) - using Forge {}", ga);
                            conflicts_resolved += 1;
                        }
                    } else {
                        // No había, agregar normalmente
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

        log::info!(
            "Library merge completed: {} vanilla + {} forge = {} final libraries ({} conflicts resolved)",
            vanilla_count,
            forge_count,
            final_count,
            conflicts_resolved
        );
    }

    fn merge_arguments(result: &mut Value, vanilla: &Value, forge: &Value) {
        log::debug!("Starting arguments merge process");

        let mut args_map = Map::default();
        let mut total_args = 0;

        for kind in &["game", "jvm"] {
            let mut list = Vec::new();
            let mut vanilla_args = 0;
            let mut forge_args = 0;

            if let Some(v) = vanilla
                .get("arguments")
                .and_then(|a| a.get(kind))
                .and_then(Value::as_array)
            {
                vanilla_args = v.len();
                list.extend_from_slice(v);
            }

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

                let mut i = 0;
                while i < args.len() {
                    if let Some(key) = args.get(i) {
                        if key.starts_with("--") {
                            if let Some(value) = args.get(i + 1) {
                                if !value.starts_with("--") {
                                    kv.insert(key.to_string(), value.to_string());
                                    i += 2;
                                    continue;
                                }
                            }
                            kv.insert(key.to_string(), "".to_string());
                            i += 1;
                        } else {
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

        // Extract classifier from multiple possible locations:
        // 1. From the name field itself (4th part after splitting by ':')
        // 2. From downloads.artifact.classifier
        // 3. From direct classifier field
        let classifier = parts
            .get(3)
            .map(|s| (*s).to_string())
            .or_else(|| {
                lib.get("downloads")
                    .and_then(|d| d.get("artifact"))
                    .and_then(|a| a.get("classifier"))
                    .and_then(Value::as_str)
                    .map(String::from)
            })
            .or_else(|| {
                lib.get("classifier")
                    .and_then(Value::as_str)
                    .map(String::from)
            });

        let url = lib.get("url").and_then(Value::as_str).map(String::from);
        Some((name, ga, version, url, classifier))
    }

    fn build_lib_key(ga: &str, _version: &Option<String>, classifier: &Option<String>) -> String {
        // Build key based on GA + classifier only (NOT version)
        // This allows proper conflict detection when same library has different versions
        let mut key = ga.to_string();
        if let Some(c) = classifier {
            key.push(':');
            key.push_str(c);
        }
        key
    }

    fn prefer_forge(ga: &str, vver: &Option<String>, fver: &Option<String>) -> bool {
        if ga.contains("log4j") {
            if let (Some(v_str), Some(f_str)) = (vver, fver) {
                return Self::is_version_newer(f_str, v_str);
            }
        }
        if ga.contains("lwjgl") {
            if let (Some(v_str), Some(f_str)) = (vver, fver) {
                return f_str != v_str;
            }
            return true;
        }
        if ga.contains("guava") {
            if let (Some(v_str), Some(f_str)) = (vver, fver) {
                return Self::is_version_newer(f_str, v_str);
            }
        }
        if ga.contains("asm") || ga.contains("objectweb") {
            return true;
        }
        if ga.contains("netty") {
            if let (Some(v_str), Some(f_str)) = (vver, fver) {
                return Self::is_version_newer(f_str, v_str);
            }
        }
        true
    }

    fn is_version_newer(new_version: &str, old_version: &str) -> bool {
        let new_parts: Vec<u32> = new_version
            .split('.')
            .filter_map(|p| p.parse().ok())
            .collect();
        let old_parts: Vec<u32> = old_version
            .split('.')
            .filter_map(|p| p.parse().ok())
            .collect();

        for (new, old) in new_parts.iter().zip(old_parts.iter()) {
            if new > old {
                return true;
            } else if new < old {
                return false;
            }
        }
        new_parts.len() > old_parts.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_build_lib_key_without_version() {
        // Test that library key does NOT include version
        assert_eq!(
            ManifestMerger::build_lib_key("commons-io:commons-io", &Some("2.5".to_string()), &None),
            "commons-io:commons-io"
        );

        // Test with classifier
        assert_eq!(
            ManifestMerger::build_lib_key(
                "org.lwjgl:lwjgl",
                &Some("3.2.1".to_string()),
                &Some("natives-windows".to_string())
            ),
            "org.lwjgl:lwjgl:natives-windows"
        );
    }

    #[test]
    fn test_extract_lib_info_with_classifier_in_name() {
        let lib = json!({
            "name": "org.lwjgl:lwjgl:3.2.1:natives-windows",
            "downloads": {
                "artifact": {
                    "url": "https://libraries.minecraft.net/org/lwjgl/lwjgl/3.2.1/lwjgl-3.2.1-natives-windows.jar"
                }
            }
        });

        let result = ManifestMerger::extract_lib_info(&lib);
        assert!(result.is_some());

        let (name, ga, version, _url, classifier) = result.unwrap();
        assert_eq!(name, "org.lwjgl:lwjgl:3.2.1:natives-windows");
        assert_eq!(ga, "org.lwjgl:lwjgl");
        assert_eq!(version, Some("3.2.1".to_string()));
        assert_eq!(classifier, Some("natives-windows".to_string()));
    }

    #[test]
    fn test_library_merge_conflict_detection() {
        let vanilla = json!({
            "libraries": [
                {
                    "name": "commons-io:commons-io:2.5",
                    "downloads": {
                        "artifact": {
                            "url": "https://libraries.minecraft.net/commons-io/commons-io/2.5/commons-io-2.5.jar"
                        }
                    }
                },
                {
                    "name": "org.lwjgl:lwjgl:3.2.1",
                    "downloads": {
                        "artifact": {
                            "url": "https://libraries.minecraft.net/org/lwjgl/lwjgl/3.2.1/lwjgl-3.2.1.jar"
                        }
                    }
                }
            ]
        });

        let forge = json!({
            "libraries": [
                {
                    "name": "commons-io:commons-io:2.6",
                    "downloads": {
                        "artifact": {
                            "url": "https://files.minecraftforge.net/maven/commons-io/commons-io/2.6/commons-io-2.6.jar"
                        }
                    }
                },
                {
                    "name": "net.minecraftforge:forge:1.19.2-43.2.0",
                    "downloads": {
                        "artifact": {
                            "url": "https://files.minecraftforge.net/maven/net/minecraftforge/forge/1.19.2-43.2.0/forge-1.19.2-43.2.0.jar"
                        }
                    }
                }
            ]
        });

        let result = ManifestMerger::merge(vanilla, forge);

        // Should have 3 libraries: commons-io (forge version), lwjgl (vanilla), forge (new)
        let libraries = result.get("libraries").unwrap().as_array().unwrap();
        assert_eq!(libraries.len(), 3);

        // Verify commons-io has the forge version (2.6)
        let commons_io = libraries
            .iter()
            .find(|lib| {
                lib.get("name")
                    .unwrap()
                    .as_str()
                    .unwrap()
                    .contains("commons-io")
            })
            .unwrap();
        assert_eq!(
            commons_io.get("name").unwrap().as_str().unwrap(),
            "commons-io:commons-io:2.6"
        );
    }
}
