use serde_json::{Map, Value};
use std::collections::{BTreeMap, HashMap};
use super::version_compatibility::{VersionCompatibility, VersionGeneration};

pub struct ManifestMerger;

impl ManifestMerger {
    pub fn merge(vanilla: Value, forge: Value) -> Value {
        let mut result = vanilla.clone();

        // Detect version generation for compatibility
        let version = vanilla.get("id").and_then(|v| v.as_str()).unwrap_or("unknown");
        let generation = VersionCompatibility::detect_generation(version, Some(&vanilla));

        if let Some(mc) = forge.get("mainClass") {
            result["mainClass"] = mc.clone();
        }

        Self::merge_libraries(&mut result, &vanilla, &forge);
        Self::merge_arguments_compatible(&mut result, &vanilla, &forge, &generation);
        Self::merge_assets(&mut result, &vanilla, &forge);

        result
    }

    fn merge_libraries(result: &mut Value, vanilla: &Value, forge: &Value) {
        // Enhanced library merging with better conflict resolution
        let mut merged_libs: BTreeMap<String, Value> = BTreeMap::new();

        // 1. Add vanilla libraries as base
        if let Some(arr) = vanilla.get("libraries").and_then(Value::as_array) {
            for lib in arr {
                if let Some((_, ga, _, _, classifier)) = Self::extract_lib_info(lib) {
                    let key = Self::build_lib_key(&ga, &classifier);
                    merged_libs.insert(key, lib.clone());
                }
            }
        }

        // 2. Add forge libraries, resolving conflicts intelligently
        if let Some(arr) = forge.get("libraries").and_then(Value::as_array) {
            for forge_lib in arr {
                if let Some((_, ga, fver, _, classifier)) = Self::extract_lib_info(forge_lib) {
                    let key = Self::build_lib_key(&ga, &classifier);

                    // Check for conflict with existing library
                    if let Some(vanilla_lib) = merged_libs.get_mut(&key) {
                        let (_, _, vver, _, _) = Self::extract_lib_info(vanilla_lib).unwrap();

                        if Self::prefer_forge_library(&ga, &vver, &fver, forge_lib, vanilla_lib) {
                            *vanilla_lib = forge_lib.clone();
                        }
                    } else {
                        merged_libs.insert(key, forge_lib.clone());
                    }
                }
            }
        }

        result["libraries"] = Value::Array(merged_libs.into_values().collect());
    }

    /// Enhanced library preference logic with more sophisticated rules
    fn prefer_forge_library(ga: &str, vver: &Option<String>, fver: &Option<String>, forge_lib: &Value, vanilla_lib: &Value) -> bool {
        // Security-critical libraries: always use newer version
        if ga.contains("log4j") || ga.contains("security") || ga.contains("crypto") {
            if let (Some(v_str), Some(f_str)) = (vver, fver) {
                return Self::is_version_newer(f_str, v_str);
            }
            return true; // Default to Forge if version comparison fails
        }

        // LWJGL libraries: prefer Forge version for compatibility
        if ga.contains("lwjgl") {
            return true;
        }

        // Minecraft-specific libraries: prefer Forge
        if ga.contains("minecraft") || ga.contains("mojang") {
            return true;
        }

        // For native libraries, check if forge version has better platform support
        if Self::is_native_library(forge_lib) && Self::is_native_library(vanilla_lib) {
            return Self::has_better_native_support(forge_lib, vanilla_lib);
        }

        // Default: prefer Forge version
        true
    }

    /// Check if a version string is newer than another
    fn is_version_newer(version1: &str, version2: &str) -> bool {
        use std::cmp::Ordering;
        
        let v1_parts: Vec<u32> = version1.split('.').filter_map(|p| p.parse().ok()).collect();
        let v2_parts: Vec<u32> = version2.split('.').filter_map(|p| p.parse().ok()).collect();
        
        let max_len = v1_parts.len().max(v2_parts.len());
        for i in 0..max_len {
            let v1_part = v1_parts.get(i).unwrap_or(&0);
            let v2_part = v2_parts.get(i).unwrap_or(&0);
            
            match v1_part.cmp(v2_part) {
                Ordering::Greater => return true,
                Ordering::Less => return false,
                Ordering::Equal => continue,
            }
        }
        false // Equal versions, don't prefer
    }

    /// Check if a library is a native library
    fn is_native_library(lib: &Value) -> bool {
        lib.get("downloads")
            .and_then(|d| d.get("classifiers"))
            .is_some() ||
        lib.get("natives").is_some()
    }

    /// Determine if forge native library has better platform support
    fn has_better_native_support(forge_lib: &Value, vanilla_lib: &Value) -> bool {
        // Count supported platforms
        let forge_platforms = Self::count_native_platforms(forge_lib);
        let vanilla_platforms = Self::count_native_platforms(vanilla_lib);
        
        forge_platforms >= vanilla_platforms
    }

    /// Count the number of native platforms supported by a library
    fn count_native_platforms(lib: &Value) -> usize {
        let mut count = 0;
        
        if let Some(classifiers) = lib.get("downloads").and_then(|d| d.get("classifiers")).and_then(|c| c.as_object()) {
            count += classifiers.len();
        }
        
        if let Some(natives) = lib.get("natives").and_then(|n| n.as_object()) {
            count += natives.len();
        }
        
        count
    }

    /// Version-aware argument merging that automatically handles legacy and modern formats
    fn merge_arguments_compatible(result: &mut Value, vanilla: &Value, forge: &Value, generation: &VersionGeneration) {
        match generation {
            VersionGeneration::Legacy | VersionGeneration::PreClassic => {
                Self::merge_legacy_arguments_improved(result, vanilla, forge);
            }
            VersionGeneration::Modern | VersionGeneration::Future => {
                Self::merge_arguments(result, vanilla, forge);
                // Also check for legacy arguments in case of mixed format
                if vanilla.get("minecraftArguments").is_some() || forge.get("minecraftArguments").is_some() {
                    Self::merge_legacy_arguments_improved(result, vanilla, forge);
                }
            }
        }
    }

    fn merge_arguments(result: &mut Value, vanilla: &Value, forge: &Value) {
        // Enhanced version with better duplicate handling
        let mut args_map = Map::default();
        for kind in &["game", "jvm"] {
            let mut list = Vec::new();
            let mut seen_args = std::collections::HashSet::new();
            
            // Add vanilla arguments first
            if let Some(v) = vanilla
                .get("arguments")
                .and_then(|a| a.get(kind))
                .and_then(Value::as_array)
            {
                for arg in v {
                    let arg_key = Self::get_argument_key(arg);
                    if !seen_args.contains(&arg_key) {
                        list.push(arg.clone());
                        seen_args.insert(arg_key);
                    }
                }
            }
            
            // Add forge arguments, avoiding duplicates
            if let Some(f) = forge
                .get("arguments")
                .and_then(|a| a.get(kind))
                .and_then(Value::as_array)
            {
                for arg in f {
                    let arg_key = Self::get_argument_key(arg);
                    if !seen_args.contains(&arg_key) {
                        list.push(arg.clone());
                        seen_args.insert(arg_key);
                    }
                }
            }
            
            if !list.is_empty() {
                args_map.insert(kind.to_string(), Value::Array(list));
            }
        }
        if !args_map.is_empty() {
            result["arguments"] = Value::Object(args_map);
        }
    }

    /// Get a unique key for an argument to detect duplicates
    fn get_argument_key(arg: &Value) -> String {
        match arg {
            Value::String(s) => s.clone(),
            Value::Object(obj) => {
                // For rule-based arguments, use the value as key
                if let Some(value) = obj.get("value") {
                    match value {
                        Value::String(s) => s.clone(),
                        Value::Array(arr) => arr.iter()
                            .filter_map(|v| v.as_str())
                            .collect::<Vec<_>>()
                            .join(" "),
                        _ => format!("{:?}", value),
                    }
                } else {
                    format!("{:?}", obj)
                }
            }
            _ => format!("{:?}", arg),
        }
    }

    fn merge_legacy_arguments_improved(result: &mut Value, vanilla: &Value, forge: &Value) {
        let mut all_args = Vec::new();
        let mut seen_flags = std::collections::HashSet::new();
        
        // Process vanilla arguments
        if let Some(Value::String(s)) = vanilla.get("minecraftArguments") {
            let args: Vec<&str> = s.split_whitespace().collect();
            Self::process_legacy_args(&args, &mut all_args, &mut seen_flags);
        }
        
        // Process forge arguments, avoiding duplicates
        if let Some(Value::String(s)) = forge.get("minecraftArguments") {
            let args: Vec<&str> = s.split_whitespace().collect();
            Self::process_legacy_args(&args, &mut all_args, &mut seen_flags);
        }

        if !all_args.is_empty() {
            let merged_legacy = all_args.join(" ");
            result["minecraftArguments"] = Value::String(merged_legacy);
        }
    }

    /// Process legacy arguments while avoiding duplicates
    fn process_legacy_args(args: &[&str], all_args: &mut Vec<String>, seen_flags: &mut std::collections::HashSet<String>) {
        let mut i = 0;
        while i < args.len() {
            let arg = args[i];
            
            // Check if this is a flag (starts with --)
            if arg.starts_with("--") {
                if !seen_flags.contains(arg) {
                    all_args.push(arg.to_string());
                    seen_flags.insert(arg.to_string());
                    
                    // If next argument exists and doesn't start with --, it's the value
                    if i + 1 < args.len() && !args[i + 1].starts_with("--") {
                        i += 1;
                        all_args.push(args[i].to_string());
                    }
                } else {
                    // Skip duplicate flag and its value if present
                    if i + 1 < args.len() && !args[i + 1].starts_with("--") {
                        i += 1;
                    }
                }
            } else {
                // Not a flag, just add it
                all_args.push(arg.to_string());
            }
            i += 1;
        }
    }

    /// Merge asset configurations
    fn merge_assets(result: &mut Value, vanilla: &Value, forge: &Value) {
        // Prefer Forge assets if available, otherwise use vanilla
        if let Some(forge_assets) = forge.get("assets") {
            result["assets"] = forge_assets.clone();
        }
        
        // Merge assetIndex if present
        if let Some(forge_asset_index) = forge.get("assetIndex") {
            result["assetIndex"] = forge_asset_index.clone();
        }
    }

    // --- Helper functions ---

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
        
        // Enhanced classifier detection
        let classifier = lib
            .get("downloads")
            .and_then(|d| d.get("artifact"))
            .and_then(|a| a.get("classifier"))
            .or_else(|| lib.get("classifier"))
            .or_else(|| {
                // Check in natives section
                lib.get("natives")
                    .and_then(|n| n.as_object())
                    .and_then(|natives| {
                        // Get first available native classifier
                        for (_, classifier_name) in natives {
                            if let Some(c) = classifier_name.as_str() {
                                return Some(Value::String(c.to_string()));
                            }
                        }
                        None
                    })
            })
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

    // Legacy method for backwards compatibility
    #[allow(dead_code)]
    fn prefer_forge(ga: &str, vver: &Option<String>, fver: &Option<String>) -> bool {
        // Simplified version of the new prefer_forge_library method
        if ga.contains("log4j") {
            if let (Some(v_str), Some(f_str)) = (vver, fver) {
                return Self::is_version_newer(f_str, v_str);
            }
        }
        true
    }
}
