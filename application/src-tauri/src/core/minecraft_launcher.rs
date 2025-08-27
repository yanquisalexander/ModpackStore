use crate::config::get_config_manager;
use crate::core::accounts_manager::AccountsManager;
use crate::core::{minecraft_account::MinecraftAccount, minecraft_instance::MinecraftInstance};
use crate::interfaces::game_launcher::GameLauncher;
use regex::Regex;
use serde_json::{Map, Value};
use std::collections::{BTreeMap, HashMap, HashSet};
use std::path::{Path, PathBuf, MAIN_SEPARATOR};
use std::process::{Child, Command, Stdio};
use std::{fs, io};

// ===================================================================================
// 1. TIPOS DE ERROR Y DE CONTEXTO PARA UN CÓDIGO MÁS LIMPIO
// ===================================================================================

/// Define todos los errores posibles que pueden ocurrir durante el lanzamiento.
#[derive(Debug)]
pub enum LaunchError {
    Io(io::Error),
    Json(serde_json::Error),
    Config(String),
    Account(String),
    Manifest(String),
    Process(String),
}

impl From<io::Error> for LaunchError {
    fn from(err: io::Error) -> Self {
        LaunchError::Io(err)
    }
}

impl From<serde_json::Error> for LaunchError {
    fn from(err: serde_json::Error) -> Self {
        LaunchError::Json(err)
    }
}

/// Contiene toda la información necesaria para el lanzamiento, evitando pasar
/// múltiples argumentos a cada función.
struct LaunchContext {
    manifest: Value,
    placeholders: HashMap<String, String>,
    game_dir: PathBuf,
    java_path: PathBuf,
    mc_memory: u32,
    main_class: String,
}

// ===================================================================================
// 2. IMPLEMENTACIÓN DEL LANZADOR
// ===================================================================================

pub struct MinecraftLauncher {
    instance: MinecraftInstance,
    // Cache para la regex de placeholders
    placeholder_regex: Regex,
}

impl MinecraftLauncher {
    pub fn new(instance: MinecraftInstance) -> Self {
        let placeholder_regex =
            Regex::new(r"\$\{(?P<key>[^}]+)\}").expect("Error al compilar regex de placeholders");

        Self {
            instance,
            placeholder_regex,
        }
    }

    /// Prepara todo lo necesario para el lanzamiento y lo agrupa en un `LaunchContext`.
    fn prepare_context(&self) -> Result<LaunchContext, LaunchError> {
        // --- 1. Obtener Configuración y Cuenta ---
        let config_lock = get_config_manager().lock().map_err(|_| {
            LaunchError::Config("No se pudo bloquear el config manager".to_string())
        })?;
        let config = config_lock.as_ref().or_else(|_| {
            Err(LaunchError::Config(
                "Config manager no inicializado".to_string(),
            ))
        })?;

        let mc_memory = config.get_minecraft_memory().unwrap_or(2048);
        let default_java_path = config.get_java_dir().ok_or_else(|| {
            LaunchError::Config("La ruta de Java no está configurada.".to_string())
        })?;
        let java_path = self
            .instance
            .javaPath
            .as_ref()
            .map(PathBuf::from)
            .unwrap_or(default_java_path)
            .join("bin")
            .join(if cfg!(windows) { "javaw.exe" } else { "java" });

        let account_uuid = self.instance.accountUuid.as_ref().ok_or_else(|| {
            LaunchError::Account("La instancia no tiene una cuenta asignada.".to_string())
        })?;
        let accounts_manager = AccountsManager::new();
        let account = accounts_manager
            .get_minecraft_account_by_uuid(account_uuid)
            .ok_or_else(|| {
                LaunchError::Account(format!("Cuenta no encontrada para UUID: {}", account_uuid))
            })?;

        // --- 2. Definir Directorios ---
        let game_dir = self
            .instance
            .instanceDirectory
            .as_ref()
            .map(PathBuf::from)
            .ok_or_else(|| {
                LaunchError::Config("La instancia no tiene un directorio asignado".to_string())
            })?
            .join("minecraft");
        if !game_dir.exists() {
            fs::create_dir_all(&game_dir)?;
        }
        let natives_dir = game_dir
            .join("natives")
            .join(&self.instance.minecraftVersion);
        let libraries_dir = game_dir.join("libraries");
        let assets_dir = game_dir.join("assets");

        // --- 3. Cargar y Unir Manifiestos ---
        let minecraft_version = self.determine_version_id(&game_dir)?;
        let manifest = self
            .load_merged_manifest(&game_dir, &minecraft_version)
            .ok_or_else(|| {
                LaunchError::Manifest("No se pudo cargar o unir los manifiestos.".to_string())
            })?;

        // --- 4. Construir Classpath ---
        let client_jar = self.get_client_jar_path(&game_dir, &self.instance.minecraftVersion);
        let classpath_str = self.build_classpath(&manifest, &client_jar, &libraries_dir);

        // --- 5. Crear Mapa de Placeholders Unificado ---
        let main_class = manifest
            .get("mainClass")
            .and_then(|v| v.as_str())
            .ok_or_else(|| {
                LaunchError::Manifest(
                    "La clase principal (mainClass) no se encontró en el manifiesto.".to_string(),
                )
            })?
            .to_string();

        let assets_index = manifest
            .get("assets")
            .and_then(|v| v.as_str())
            .or_else(|| manifest.get("assetIndex")?.get("id")?.as_str())
            .unwrap_or("legacy");

        let classpath_separator = if cfg!(windows) { ";" } else { ":" };

        let placeholders = self.build_placeholders_map(
            &account,
            &minecraft_version,
            &game_dir,
            &assets_dir,
            assets_index,
            &natives_dir,
            &libraries_dir,
            classpath_separator,
            &classpath_str,
        );

        Ok(LaunchContext {
            manifest,
            placeholders,
            game_dir,
            java_path,
            mc_memory,
            main_class,
        })
    }

    /// Construye el mapa de placeholders de forma más organizada
    fn build_placeholders_map(
        &self,
        account: &MinecraftAccount,
        minecraft_version: &str,
        game_dir: &PathBuf,
        assets_dir: &PathBuf,
        assets_index: &str,
        natives_dir: &PathBuf,
        libraries_dir: &PathBuf,
        classpath_separator: &str,
        classpath_str: &str,
    ) -> HashMap<String, String> {
        let mut placeholders = HashMap::new();

        // Placeholders de autenticación
        placeholders.insert(
            "auth_player_name".to_string(),
            account.username().to_string(),
        );
        placeholders.insert("auth_uuid".to_string(), account.uuid().to_string());
        placeholders.insert(
            "auth_access_token".to_string(),
            account.access_token().unwrap_or("null").to_string(),
        );
        placeholders.insert(
            "user_type".to_string(),
            (if account.user_type() != "offline" {
                "mojang"
            } else {
                "legacy"
            })
            .to_string(),
        );

        // Placeholders de versión y directorios
        placeholders.insert("version_name".to_string(), minecraft_version.to_string());
        placeholders.insert("version_type".to_string(), "release".to_string());
        placeholders.insert(
            "game_directory".to_string(),
            game_dir.to_string_lossy().to_string(),
        );
        placeholders.insert(
            "assets_root".to_string(),
            assets_dir.to_string_lossy().to_string(),
        );
        placeholders.insert("assets_index_name".to_string(), assets_index.to_string());
        placeholders.insert(
            "natives_directory".to_string(),
            natives_dir.to_string_lossy().to_string(),
        );
        placeholders.insert(
            "library_directory".to_string(),
            libraries_dir.to_string_lossy().to_string(),
        );

        // Placeholders del sistema
        placeholders.insert(
            "classpath_separator".to_string(),
            classpath_separator.to_string(),
        );
        placeholders.insert("classpath".to_string(), classpath_str.to_string());

        // Placeholders del launcher
        placeholders.insert("launcher_name".to_string(), "modpackstore".to_string());
        placeholders.insert("launcher_version".to_string(), "1.0.0".to_string());

        placeholders
    }

    /// Construye y lanza el proceso de Minecraft.
    fn spawn_process(&self, context: &LaunchContext) -> Result<Child, LaunchError> {
        // --- 1. Procesar Argumentos ---
        let features = HashMap::new(); // Para futuras expansiones
        let jvm_args =
            self.process_jvm_arguments(&context.manifest, &context.placeholders, context.mc_memory);
        let game_args =
            self.process_game_arguments(&context.manifest, &context.placeholders, &features);

        // --- 2. Construir Comando ---
        let mut command = Command::new(&context.java_path);
        command.current_dir(&context.game_dir);
        command.args(&jvm_args);
        command.arg(&context.main_class);
        command.args(&game_args);

        // Debug: mostrar el comando completo
        log::info!("Lanzando Minecraft con el siguiente comando:");
        log::info!("Ejecutable Java: {:?}", context.java_path);
        log::info!("Directorio de trabajo: {:?}", context.game_dir);
        log::info!("Argumentos JVM: {:?}", jvm_args);
        log::info!("Clase principal: {}", context.main_class);
        log::info!("Argumentos del juego: {:?}", game_args);

        // --- 3. Ejecutar ---
        command.stdout(Stdio::piped());
        command.stderr(Stdio::piped());

        command.spawn().map_err(|e| {
            LaunchError::Process(format!(
                "No se pudo ejecutar el proceso de Minecraft: {}",
                e
            ))
        })
    }

    /// Determina la ID de la versión a usar, leyendo `launcher_profiles.json` para Forge.
    fn determine_version_id(&self, game_dir: &Path) -> Result<String, LaunchError> {
        let mut version_id = self.instance.minecraftVersion.clone();
        if self.instance.forgeVersion.is_some() {
            let profiles_path = game_dir.join("launcher_profiles.json");
            if profiles_path.exists() {
                let contents = fs::read_to_string(profiles_path)?;
                let json: Value = serde_json::from_str(&contents)?;
                if let Some(id) = json
                    .get("profiles")
                    .and_then(|p| p.get("forge"))
                    .and_then(|f| f.get("lastVersionId"))
                    .and_then(|v| v.as_str())
                {
                    version_id = id.to_string();
                }
            }
        }
        Ok(version_id)
    }

    // ===================================================================================
    // 3. FUNCIONES AUXILIARES OPTIMIZADAS
    // ===================================================================================

    pub fn should_apply_rule(
        &self,
        rule: &Value,
        features: Option<&HashMap<String, bool>>,
    ) -> bool {
        let action = rule
            .get("action")
            .and_then(|a| a.as_str())
            .unwrap_or("allow");
        let mut should_apply = action == "allow";

        // Check OS rules
        if let Some(os_obj) = rule.get("os") {
            let mut os_match = true;

            // Check OS name
            if let Some(os_name) = os_obj.get("name").and_then(|n| n.as_str()) {
                let is_current_os = match os_name {
                    "windows" => cfg!(windows),
                    "osx" => cfg!(target_os = "macos"),
                    "linux" => cfg!(target_os = "linux"),
                    _ => false,
                };
                if !is_current_os {
                    os_match = false;
                }
            }

            // Check OS architecture
            if let Some(os_arch) = os_obj.get("arch").and_then(|a| a.as_str()) {
                let is_current_arch = match os_arch {
                    "x86" => cfg!(target_arch = "x86"),
                    "x86_64" => cfg!(target_arch = "x86_64"),
                    "arm" => cfg!(target_arch = "arm"),
                    "arm64" => cfg!(target_arch = "aarch64"),
                    _ => false,
                };
                if !is_current_arch {
                    os_match = false;
                }
            }

            should_apply = if action == "allow" {
                os_match
            } else {
                !os_match
            };
        }

        // Check feature rules
        if let Some(feature_obj) = rule.get("features") {
            if let Some(features_map) = features {
                for (feature_name, feature_value) in
                    feature_obj.as_object().unwrap_or(&serde_json::Map::new())
                {
                    if let Some(expected_value) = feature_value.as_bool() {
                        let actual_value = *features_map.get(feature_name).unwrap_or(&false);
                        if actual_value != expected_value {
                            should_apply = action != "allow";
                            break;
                        }
                    }
                }
            } else {
                // If feature rules exist but no features are provided, rule doesn't apply
                should_apply = action != "allow";
            }
        }

        should_apply
    }

    /// Reemplaza placeholders usando regex compilada (más eficiente)
    pub fn replace_placeholders(
        &self,
        input: &str,
        placeholders: &HashMap<String, String>,
    ) -> String {
        self.placeholder_regex
            .replace_all(input, |caps: &regex::Captures| {
                let key = &caps["key"];
                placeholders
                    .get(key)
                    .map_or_else(|| caps[0].to_string(), |v| v.clone())
            })
            .into_owned()
    }

    fn process_rule_values(
        &self,
        value: &Value,
        placeholder_map: &HashMap<String, String>,
    ) -> Vec<String> {
        match value {
            Value::String(s) => vec![self.replace_placeholders(s, placeholder_map)],
            Value::Array(arr) => arr
                .iter()
                .filter_map(|v| v.as_str())
                .map(|s| self.replace_placeholders(s, placeholder_map))
                .collect(),
            _ => Vec::new(),
        }
    }

    pub fn process_arguments(
        &self,
        args_obj: &Value,
        placeholders: &HashMap<String, String>,
        features: &HashMap<String, bool>,
    ) -> Vec<String> {
        let Some(args_array) = args_obj.as_array() else {
            return Vec::new();
        };

        let mut processed_args = Vec::new();

        for arg in args_array {
            match arg {
                Value::String(arg_str) => {
                    let processed_arg = self.replace_placeholders(arg_str, placeholders);
                    processed_args.push(processed_arg);
                }
                Value::Object(_) => {
                    let should_include =
                        if let Some(rules) = arg.get("rules").and_then(|r| r.as_array()) {
                            rules
                                .iter()
                                .any(|rule| self.should_apply_rule(rule, Some(features)))
                        } else {
                            true // Si no hay reglas, se aplica por defecto
                        };

                    if should_include {
                        if let Some(value) = arg.get("value") {
                            let rule_values = self.process_rule_values(value, placeholders);
                            processed_args.extend(rule_values);
                        }
                    }
                }
                _ => {} // Ignorar otros tipos
            }
        }

        processed_args
    }

    pub fn process_game_arguments(
        &self,
        manifest_json: &Value,
        placeholders: &HashMap<String, String>,
        features: &HashMap<String, bool>,
    ) -> Vec<String> {
        // Priorizar argumentos modernos
        if let Some(args_obj) = manifest_json.get("arguments").and_then(|v| v.get("game")) {
            return self.process_arguments(args_obj, placeholders, features);
        }

        // Fallback a argumentos legacy
        if let Some(min_args) = manifest_json
            .get("minecraftArguments")
            .and_then(|v| v.as_str())
        {
            return min_args
                .split_whitespace()
                .map(|arg| self.replace_placeholders(arg, placeholders))
                .collect();
        }

        Vec::new()
    }

    pub fn process_jvm_arguments(
        &self,
        manifest_json: &Value,
        placeholders: &HashMap<String, String>,
        mc_memory: u32,
    ) -> Vec<String> {
        let mut jvm_args = Vec::new();
        let features = HashMap::new(); // JVM args no suelen tener features

        // Argumentos básicos de memoria
        jvm_args.push("-Xms512M".to_string());
        jvm_args.push(format!("-Xmx{}M", mc_memory));

        // Procesar argumentos del manifiesto
        if let Some(args_obj) = manifest_json.get("arguments").and_then(|v| v.get("jvm")) {
            let manifest_args = self.process_arguments(args_obj, placeholders, &features);
            jvm_args.extend(manifest_args);
        } else {
            // Argumentos legacy para versiones más antiguas
            jvm_args.push(format!(
                "-Djava.library.path={}",
                placeholders
                    .get("natives_directory")
                    .unwrap_or(&String::new())
            ));
        }

        // Asegurar que el classpath esté presente (solo si no hay -p module-path)
        let has_classpath = jvm_args
            .iter()
            .any(|arg| arg.starts_with("-cp") || arg.starts_with("-classpath"));

        let has_module_path = jvm_args
            .iter()
            .any(|arg| arg == "-p" || arg.starts_with("--module-path"));

        if !has_classpath && !has_module_path {
            jvm_args.push("-cp".to_string());
            jvm_args.push(placeholders.get("classpath").cloned().unwrap_or_default());
        }

        // Debug: mostrar argumentos JVM procesados
        log::debug!("Argumentos JVM procesados:");
        for (i, arg) in jvm_args.iter().enumerate() {
            log::debug!("  [{}]: {}", i, arg);
        }

        jvm_args
    }

    fn build_classpath(
        &self,
        manifest_json: &Value,
        client_jar: &Path,
        libraries_dir: &Path,
    ) -> String {
        let mut entries = Vec::new();
        let mut seen = HashSet::new();
        let sep = if cfg!(windows) { ";" } else { ":" };

        // Agregar el JAR del cliente
        let client_path_str = client_jar.to_string_lossy().to_string();
        if seen.insert(client_path_str.clone()) {
            entries.push(client_path_str);
        }

        // Procesar librerías del manifiesto
        if let Some(libs) = manifest_json.get("libraries").and_then(|v| v.as_array()) {
            for lib in libs {
                // Verificar si la librería debe incluirse según las reglas
                let should_include = lib
                    .get("rules")
                    .and_then(|r| r.as_array())
                    .map(|rules| rules.iter().any(|rule| self.should_apply_rule(rule, None)))
                    .unwrap_or(true);

                if !should_include {
                    continue;
                }

                // Obtener la ruta del artifact
                if let Some(path_val) = lib
                    .get("downloads")
                    .and_then(|d| d.get("artifact"))
                    .and_then(|a| a.get("path"))
                    .and_then(|p| p.as_str())
                {
                    let jar_path =
                        libraries_dir.join(path_val.replace('/', &MAIN_SEPARATOR.to_string()));
                    if jar_path.exists() {
                        let path_str = jar_path.to_string_lossy().to_string();
                        if seen.insert(path_str.clone()) {
                            entries.push(path_str);
                        }
                    }
                }
            }
        }

        entries.join(sep)
    }

    fn get_client_jar_path(&self, game_dir: &Path, minecraft_version: &str) -> PathBuf {
        game_dir
            .join("versions")
            .join(minecraft_version)
            .join(format!("{}.jar", minecraft_version))
    }

    fn load_merged_manifest(&self, game_dir: &Path, minecraft_version: &str) -> Option<Value> {
        let version_dir = game_dir.join("versions").join(minecraft_version);
        let manifest_file = version_dir.join(format!("{}.json", minecraft_version));

        let manifest_data = fs::read_to_string(&manifest_file).ok()?;
        let manifest_json: Value = serde_json::from_str(&manifest_data).ok()?;

        if let Some(inherits_from) = manifest_json.get("inheritsFrom").and_then(|v| v.as_str()) {
            let vanilla_dir = game_dir.join("versions").join(inherits_from);
            let vanilla_file = vanilla_dir.join(format!("{}.json", inherits_from));
            let vanilla_data = fs::read_to_string(vanilla_file).ok()?;
            let vanilla_manifest: Value = serde_json::from_str(&vanilla_data).ok()?;
            Some(self.merge_manifests(vanilla_manifest, manifest_json))
        } else {
            Some(manifest_json)
        }
    }

    pub fn merge_manifests(&self, vanilla: Value, forge: Value) -> Value {
        fn extract_info(
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

        fn prefer_forge(ga: &str, vver: &Option<String>, fver: &Option<String>) -> bool {
            if ga.contains("log4j") {
                if let (Some(v), Some(f)) = (vver, fver) {
                    let cmp_v: Vec<i32> = v.split('.').filter_map(|p| p.parse().ok()).collect();
                    let cmp_f: Vec<i32> = f.split('.').filter_map(|p| p.parse().ok()).collect();
                    return cmp_f > cmp_v;
                }
            }
            true
        }

        let mut result = vanilla.clone();
        if let Some(mc) = forge.get("mainClass") {
            result["mainClass"] = mc.clone();
        }

        let mut libs: BTreeMap<String, Value> = BTreeMap::new();
        let mut duplicates: HashMap<String, Vec<String>> = HashMap::new();

        if let Some(arr) = vanilla.get("libraries").and_then(Value::as_array) {
            for lib in arr {
                if let Some((_, ga, vver, _, classifier)) = extract_info(lib) {
                    let key = if let Some(c) = &classifier {
                        format!("{}:{}", ga, c)
                    } else {
                        ga.clone()
                    };
                    if libs.contains_key(&key) {
                        duplicates
                            .entry(ga.clone())
                            .or_default()
                            .push(format!("vanilla:{}", vver.clone().unwrap_or_default()));
                    } else {
                        libs.insert(key, lib.clone());
                    }
                }
            }
        }

        if let Some(arr) = forge.get("libraries").and_then(Value::as_array) {
            for lib in arr {
                if let Some((_, ga, fver, furl, classifier)) = extract_info(lib) {
                    let key = if let Some(c) = &classifier {
                        format!("{}:{}", ga, c)
                    } else {
                        ga.clone()
                    };

                    if let Some(existing) = libs.get(&key) {
                        let (_, _, vver, vurl, _) = extract_info(existing).unwrap();
                        let is_dup = match (&vver, &fver) {
                            (Some(_), Some(_)) => true,
                            _ => furl == vurl,
                        };
                        duplicates
                            .entry(ga.clone())
                            .or_default()
                            .push(format!("forge:{}", fver.clone().unwrap_or_default()));
                        if is_dup && prefer_forge(&ga, &vver, &fver) {
                            libs.insert(key, lib.clone());
                        }
                    } else {
                        duplicates
                            .entry(ga.clone())
                            .or_default()
                            .push(format!("forge:{}", fver.clone().unwrap_or_default()));
                        libs.insert(key, lib.clone());
                    }
                }
            }
        }

        for (ga, sources) in duplicates.iter().filter(|(_, s)| s.len() > 1) {
            log::info!("Duplicate {}: {}", ga, sources.join(", "));
        }

        result["libraries"] = Value::Array(libs.into_values().collect());

        let mut args_map = Map::default();
        for kind in &["game", "jvm"] {
            let mut list = Vec::new();
            if let Some(v) = vanilla
                .get("arguments")
                .and_then(|a| a.get(kind))
                .and_then(Value::as_array)
            {
                list.extend(v.clone());
            }
            if let Some(f) = forge
                .get("arguments")
                .and_then(|a| a.get(kind))
                .and_then(Value::as_array)
            {
                list.extend(f.clone());
            }
            if !list.is_empty() {
                args_map.insert(kind.to_string(), Value::Array(list));
            }
        }
        if !args_map.is_empty() {
            result["arguments"] = Value::Object(args_map);
        }

        let mut kv = HashMap::new();
        for src in [
            vanilla.get("minecraftArguments"),
            forge.get("minecraftArguments"),
        ] {
            if let Some(Value::String(s)) = src {
                for pair in s.split_whitespace().collect::<Vec<_>>().chunks(2) {
                    if let [k, v] = pair {
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

        result
    }
}

// ===================================================================================
// 4. IMPLEMENTACIÓN DEL TRAIT `GameLauncher`
// ===================================================================================

impl GameLauncher for MinecraftLauncher {
    /// Punto de entrada principal para lanzar el juego.
    fn launch(&self) -> Option<Child> {
        log::info!(
            "Iniciando el proceso de lanzamiento para la instancia '{}'",
            self.instance.instanceName
        );

        match self.prepare_context() {
            Ok(context) => {
                log::info!("Contexto preparado exitosamente. Lanzando el proceso...");
                match self.spawn_process(&context) {
                    Ok(child) => {
                        log::info!("Minecraft lanzado exitosamente con PID: {}", child.id());
                        Some(child)
                    }
                    Err(e) => {
                        log::error!("Error al ejecutar el proceso de Minecraft: {:?}", e);
                        None
                    }
                }
            }
            Err(e) => {
                log::error!("Error al preparar el contexto de lanzamiento: {:?}", e);
                None
            }
        }
    }
}
