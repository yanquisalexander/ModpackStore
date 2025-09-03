// src/core/minecraft/arguments/rules.rs

use serde_json::Value;
use std::collections::HashMap;

pub struct RuleEvaluator;

impl RuleEvaluator {
    /// Comprueba si las condiciones de una regla (OS, features) coinciden con el entorno actual.
    /// Ignora completamente el campo "action".
    pub fn rule_matches_environment(
        rule: &Value,
        features: Option<&HashMap<String, bool>>,
    ) -> bool {
        // Comprobar condiciones del SO
        if let Some(os_obj) = rule.get("os") {
            // Si las condiciones del SO no coinciden, la regla no se aplica.
            if !Self::os_conditions_match(os_obj) {
                return false;
            }
        }

        // Comprobar condiciones de features
        if let Some(feature_obj) = rule.get("features") {
            // Si las condiciones de las features no coinciden, la regla no se aplica.
            if !Self::feature_conditions_match(feature_obj, features) {
                return false;
            }
        }

        // Si hemos llegado hasta aquí, es porque no había condiciones o todas coincidieron.
        // Por lo tanto, las condiciones de la regla SÍ se aplican a nuestro entorno.
        true
    }

    /// Función auxiliar para comprobar todas las condiciones del SO.
    fn os_conditions_match(os_obj: &Value) -> bool {
        if let Some(os_name) = os_obj.get("name").and_then(|n| n.as_str()) {
            if !Self::matches_current_os(os_name) {
                return false; // El nombre del SO no coincide
            }
        }

        if let Some(os_arch) = os_obj.get("arch").and_then(|a| a.as_str()) {
            if !Self::matches_current_arch(os_arch) {
                return false; // La arquitectura no coincide
            }
        }

        // Aquí iría la lógica para 'version' si se implementa en el futuro.

        true // Todas las condiciones de SO presentes han coincidido
    }

    /// Función auxiliar para comprobar las features.
    fn feature_conditions_match(
        feature_obj: &Value,
        features: Option<&HashMap<String, bool>>,
    ) -> bool {
        let features_map = match features {
            Some(f) => f,
            // La regla requiere features pero no se proporcionaron, por lo que no coincide.
            None => return false,
        };

        for (feature_name, expected_value) in feature_obj.as_object().unwrap() {
            if let Some(expected) = expected_value.as_bool() {
                let actual = *features_map.get(feature_name).unwrap_or(&false);
                if actual != expected {
                    return false; // Una de las features no coincide
                }
            }
        }

        true // Todas las features requeridas coinciden
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
                // Por seguridad, no coincidir si no se conoce la arquitectura.
                false
            }
        }
    }
}
