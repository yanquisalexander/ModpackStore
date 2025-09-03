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
                        // Ya existía → conflicto
                        if let Some((_, _, vver, _, _)) = Self::extract_lib_info(existing_lib) {
                            if Self::prefer_forge(&ga, &vver, &fver) {
                                *existing_lib = forge_lib.clone();
                                log::debug!(
                                    "Conflict resolved - replaced Vanilla {} {:?} with Forge {:?}",
                                    ga,
                                    vver,
                                    fver
                                );
                            } else {
                                log::debug!(
                                    "Conflict resolved - kept Vanilla {} {:?} over Forge {:?}",
                                    ga,
                                    vver,
                                    fver
                                );
                            }
                        } else {
                            // Si no se pudo extraer versión, Forge pisa
                            *existing_lib = forge_lib.clone();
                            log::debug!("Conflict resolved (no version info) - using Forge {}", ga);
                        }
                        conflicts_resolved += 1;
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

    fn build_lib_key(ga: &str, version: &Option<String>, classifier: &Option<String>) -> String {
        let mut key = if let Some(v) = version {
            format!("{}:{}", ga, v)
        } else {
            ga.to_string()
        };
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
