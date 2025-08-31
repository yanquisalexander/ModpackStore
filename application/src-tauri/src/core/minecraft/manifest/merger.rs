use serde_json::{Map, Value};
use std::collections::{BTreeMap, HashMap};

pub struct ManifestMerger;

impl ManifestMerger {
    pub fn merge(vanilla: Value, forge: Value) -> Value {
        let mut result = vanilla.clone();

        if let Some(mc) = forge.get("mainClass") {
            result["mainClass"] = mc.clone();
        }

        Self::merge_libraries(&mut result, &vanilla, &forge);
        Self::merge_arguments(&mut result, &vanilla, &forge);
        Self::merge_legacy_arguments(&mut result, &vanilla, &forge);

        result
    }

    fn merge_libraries(result: &mut Value, vanilla: &Value, forge: &Value) {
        // Usamos un mapa para manejar duplicados fácilmente. La clave es `ga:classifier`.
        let mut merged_libs: BTreeMap<String, Value> = BTreeMap::new();

        // 1. Primera pasada: Agregar todas las bibliotecas de vanilla como base.
        if let Some(arr) = vanilla.get("libraries").and_then(Value::as_array) {
            for lib in arr {
                if let Some((_, ga, _, _, classifier)) = Self::extract_lib_info(lib) {
                    let key = Self::build_lib_key(&ga, &classifier);
                    merged_libs.insert(key, lib.clone());
                }
            }
        }

        // 2. Segunda pasada: Agregar bibliotecas de Forge, resolviendo conflictos.
        if let Some(arr) = forge.get("libraries").and_then(Value::as_array) {
            for forge_lib in arr {
                if let Some((_, ga, fver, _, classifier)) = Self::extract_lib_info(forge_lib) {
                    let key = Self::build_lib_key(&ga, &classifier);

                    // Verificamos si ya existe una versión de esta biblioteca (de vanilla).
                    if let Some(vanilla_lib) = merged_libs.get_mut(&key) {
                        // Conflicto: decidir cuál mantener.
                        let (_, _, vver, _, _) = Self::extract_lib_info(vanilla_lib).unwrap();

                        if Self::prefer_forge(&ga, &vver, &fver) {
                            // Si preferimos Forge, reemplazamos la entrada existente.
                            *vanilla_lib = forge_lib.clone();
                        }
                        // Si no, no hacemos nada y mantenemos la de vanilla.
                    } else {
                        // Si no hay conflicto, simplemente la agregamos.
                        merged_libs.insert(key, forge_lib.clone());
                    }
                }
            }
        }

        result["libraries"] = Value::Array(merged_libs.into_values().collect());
    }

    fn merge_arguments(result: &mut Value, vanilla: &Value, forge: &Value) {
        // Esta función ya era correcta, no necesita cambios.
        let mut args_map = Map::default();
        for kind in &["game", "jvm"] {
            let mut list = Vec::new();
            if let Some(v) = vanilla
                .get("arguments")
                .and_then(|a| a.get(kind))
                .and_then(Value::as_array)
            {
                list.extend_from_slice(v);
            }
            if let Some(f) = forge
                .get("arguments")
                .and_then(|a| a.get(kind))
                .and_then(Value::as_array)
            {
                list.extend_from_slice(f);
            }
            if !list.is_empty() {
                args_map.insert(kind.to_string(), Value::Array(list));
            }
        }
        if !args_map.is_empty() {
            result["arguments"] = Value::Object(args_map);
        }
    }

    fn merge_legacy_arguments(result: &mut Value, vanilla: &Value, forge: &Value) {
        // Lógica mejorada para ser más robusta y evitar panics.
        let mut kv = HashMap::new();
        for src in [
            vanilla.get("minecraftArguments"),
            forge.get("minecraftArguments"),
        ] {
            if let Some(Value::String(s)) = src {
                let args: Vec<&str> = s.split_whitespace().collect();
                // Iteramos en pares de forma segura.
                for i in (0..args.len()).step_by(2) {
                    if let (Some(k), Some(v)) = (args.get(i), args.get(i + 1)) {
                        kv.insert(k.to_string(), v.to_string());
                    }
                }
            }
        }

        if !kv.is_empty() {
            let merged_legacy = kv
                .into_iter()
                .map(|(k, v)| format!("{} {}", k, v))
                .collect::<Vec<_>>()
                .join(" ");
            result["minecraftArguments"] = Value::String(merged_legacy);
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

    // Reglas para decidir si preferimos la versión de Forge sobre la de Vanilla
    fn prefer_forge(ga: &str, vver: &Option<String>, fver: &Option<String>) -> bool {
        // Regla especial para log4j: siempre usar la versión más reciente por seguridad.
        if ga.contains("log4j") {
            if let (Some(v_str), Some(f_str)) = (vver, fver) {
                // Comparamos versiones numéricamente
                let v_parts: Vec<u32> = v_str.split('.').filter_map(|p| p.parse().ok()).collect();
                let f_parts: Vec<u32> = f_str.split('.').filter_map(|p| p.parse().ok()).collect();
                if f_parts > v_parts {
                    return true; // La versión de Forge es más nueva
                } else {
                    return false; // La de Vanilla es igual o más nueva
                }
            }
        }

        // Regla por defecto: siempre preferir la biblioteca de Forge si no hay otra regla.
        true
    }
}
