use serde_json::Value;
use std::collections::HashMap;

pub struct RuleEvaluator;

impl RuleEvaluator {
    pub fn should_apply_rule(rule: &Value, features: Option<&HashMap<String, bool>>) -> bool {
        let action = rule
            .get("action")
            .and_then(|a| a.as_str())
            .unwrap_or("allow");
        let mut should_apply = action == "allow";

        log::debug!("Evaluating rule with action: {}", action);

        // Check OS rules
        if let Some(os_obj) = rule.get("os") {
            let mut os_match = true;

            // Check OS name
            if let Some(os_name) = os_obj.get("name").and_then(|n| n.as_str()) {
                let is_current_os = Self::matches_current_os(os_name);
                log::debug!("OS rule '{}' matches current OS: {}", os_name, is_current_os);
                if !is_current_os {
                    os_match = false;
                }
            }

            // Check OS architecture
            if let Some(os_arch) = os_obj.get("arch").and_then(|a| a.as_str()) {
                let is_current_arch = Self::matches_current_arch(os_arch);
                log::debug!("Arch rule '{}' matches current arch: {}", os_arch, is_current_arch);
                if !is_current_arch {
                    os_match = false;
                }
            }

            // Check OS version (optional)
            if let Some(os_version) = os_obj.get("version").and_then(|v| v.as_str()) {
                // For now, we'll be permissive with version checks
                // In a full implementation, you'd want to check actual OS version
                log::debug!("OS version rule '{}' - treating as match", os_version);
            }

            // Apply the rule logic
            if action == "allow" {
                should_apply = os_match;
            } else if action == "disallow" {
                should_apply = !os_match;
            }

            log::debug!("OS rule evaluation: os_match={}, action={}, should_apply={}", 
                       os_match, action, should_apply);
        }

        // Check feature rules
        if let Some(feature_obj) = rule.get("features") {
            if let Some(features_map) = features {
                for (feature_name, feature_value) in
                    feature_obj.as_object().unwrap_or(&serde_json::Map::new())
                {
                    if let Some(expected_value) = feature_value.as_bool() {
                        let actual_value = *features_map.get(feature_name).unwrap_or(&false);
                        log::debug!("Feature rule '{}': expected={}, actual={}", 
                                   feature_name, expected_value, actual_value);
                        
                        if actual_value != expected_value {
                            should_apply = action != "allow";
                            log::debug!("Feature mismatch, setting should_apply={}", should_apply);
                            break;
                        }
                    }
                }
            } else {
                // No features provided, but rule requires features
                should_apply = action != "allow";
                log::debug!("No features provided for feature rule, should_apply={}", should_apply);
            }
        }

        log::debug!("Final rule evaluation result: {}", should_apply);
        should_apply
    }

    fn matches_current_os(os_name: &str) -> bool {
        match os_name.to_lowercase().as_str() {
            "windows" | "win" => cfg!(windows),
            "osx" | "macos" | "mac" => cfg!(target_os = "macos"),
            "linux" => cfg!(target_os = "linux"),
            _ => {
                log::warn!("Unknown OS name in rule: {}", os_name);
                false
            }
        }
    }

    fn matches_current_arch(arch_name: &str) -> bool {
        match arch_name.to_lowercase().as_str() {
            "x86" | "i386" | "32" => cfg!(target_arch = "x86"),
            "x86_64" | "x64" | "amd64" | "64" => cfg!(target_arch = "x86_64"),
            "arm" => cfg!(target_arch = "arm"),
            "arm64" | "aarch64" => cfg!(target_arch = "aarch64"),
            _ => {
                log::warn!("Unknown architecture name in rule: {}", arch_name);
                // Default to matching for unknown architectures to be permissive
                true
            }
        }
    }
}
