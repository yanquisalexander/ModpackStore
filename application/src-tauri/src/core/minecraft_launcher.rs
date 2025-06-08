use crate::config::get_config_manager;
use crate::core::accounts_manager::AccountsManager;
use crate::core::minecraft::classpath::ClasspathBuilder;
use crate::core::minecraft::manifest::ManifestParser;
use crate::core::minecraft::paths::MinecraftPaths;
use crate::core::{minecraft_account::MinecraftAccount, minecraft_instance::MinecraftInstance};
use crate::interfaces::game_launcher::GameLauncher;
use serde_json::{Map, Value};
use std::collections::HashSet;
use std::collections::{BTreeMap, HashMap};
use std::path::MAIN_SEPARATOR;
use std::{
    fs,
    io::{Read, Write},
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
};
use uuid::Uuid;

pub struct MinecraftLauncher {
    instance: MinecraftInstance,
}

impl MinecraftLauncher {
    pub fn new(instance: MinecraftInstance) -> Self {
        Self { instance }
    }

    // Checks if a rule should apply based on OS, arch, and feature requirements
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

            if action == "allow" {
                should_apply = os_match;
            } else {
                should_apply = !os_match;
            }
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

    // Process values from a rule or argument
    fn process_rule_values(
        &self,
        value: &Value,
        placeholder_map: &HashMap<String, String>,
    ) -> Vec<String> {
        let mut values = Vec::new();

        if let Some(value_str) = value.as_str() {
            values.push(self.replace_placeholders(value_str, placeholder_map));
        } else if let Some(value_arr) = value.as_array() {
            for v in value_arr {
                if let Some(v_str) = v.as_str() {
                    values.push(self.replace_placeholders(v_str, placeholder_map));
                }
            }
        }

        values
    }

    // Replace placeholders in a string using a map
    pub fn replace_placeholders(
        &self,
        input: &str,
        placeholders: &HashMap<String, String>,
    ) -> String {
        let mut result = input.to_string();
        for (key, value) in placeholders {
            result = result.replace(&format!("${{{}}}", key), value);
        }
        result
    }

    // Process arguments (both JVM and game) using the new rule evaluation system
    pub fn process_arguments(
        &self,
        args_obj: &Value,
        placeholders: &HashMap<String, String>,
        features: Option<&HashMap<String, bool>>,
    ) -> Vec<String> {
        let mut processed_args = Vec::new();

        if let Some(args_array) = args_obj.as_array() {
            for arg in args_array {
                // If it's a simple string argument
                if let Some(arg_str) = arg.as_str() {
                    processed_args.push(self.replace_placeholders(arg_str, placeholders));
                }
                // If it's a complex rule-based argument
                else if arg.is_object() {
                    // Check if rules allow this argument
                    if let Some(rules) = arg.get("rules").and_then(|r| r.as_array()) {
                        let mut should_include = false;

                        for rule in rules {
                            if self.should_apply_rule(rule, features) {
                                should_include = true;
                                break;
                            }
                        }

                        if should_include {
                            if let Some(value) = arg.get("value") {
                                processed_args
                                    .extend(self.process_rule_values(value, placeholders));
                            }
                        }
                    }
                }
            }
        }

        processed_args
    }

    // Helper function to process game arguments from the manifest
    pub fn process_game_arguments(
        &self,
        manifest_json: &Value,
        account: &MinecraftAccount,
        game_dir: &Path,
        assets_dir: &Path,
        natives_dir: &Path,
        minecraft_version: &str,
        assets_index: &str,
    ) -> Vec<String> {
        // Create placeholder map for variable substitution
        let mut placeholders = HashMap::new();
        placeholders.insert(
            "auth_player_name".to_string(),
            account.username().to_string(),
        );
        placeholders.insert("version_name".to_string(), minecraft_version.to_string());
        placeholders.insert(
            "game_directory".to_string(),
            game_dir.to_string_lossy().to_string(),
        );
        placeholders.insert(
            "assets_root".to_string(),
            assets_dir.to_string_lossy().to_string(),
        );
        placeholders.insert("assets_index_name".to_string(), assets_index.to_string());
        placeholders.insert("auth_uuid".to_string(), account.uuid().to_string());
        placeholders.insert(
            "auth_access_token".to_string(),
            account.access_token().unwrap_or("null").to_string(),
        );
        placeholders.insert(
            "user_type".to_string(),
            if account.user_type() != "offline" {
                "mojang"
            } else {
                "legacy"
            }
            .to_string(),
        );
        placeholders.insert("version_type".to_string(), "release".to_string());
        placeholders.insert(
            "natives_directory".to_string(),
            natives_dir.to_string_lossy().to_string(),
        );
        placeholders.insert("launcher_name".to_string(), "modpackstore".to_string());
        placeholders.insert("launcher_version".to_string(), "1.0.0".to_string());

        // Define QuickPlay features (disabled by default)
        let mut features = HashMap::new();
        features.insert("has_custom_resolution".to_string(), false);
        features.insert("has_quick_plays_support".to_string(), false);
        features.insert("is_demo_user".to_string(), false);
        features.insert("is_quick_play_singleplayer".to_string(), false);
        features.insert("is_quick_play_multiplayer".to_string(), false);
        features.insert("is_quick_play_realms".to_string(), false);

        // Check for new-style arguments (1.13+)
        if let Some(args_obj) = manifest_json.get("arguments").and_then(|v| v.get("game")) {
            return self.process_arguments(args_obj, &placeholders, Some(&features));
        }

        // Legacy-style arguments (pre-1.13)
        if let Some(min_args) = manifest_json
            .get("minecraftArguments")
            .and_then(|v| v.as_str())
        {
            return min_args
                .split_whitespace()
                .map(|arg| self.replace_placeholders(arg, &placeholders))
                .collect();
        }

        // Fallback to hardcoded arguments for very old versions
        let mut arguments = vec![
            "--username".to_string(),
            placeholders["auth_player_name"].clone(),
            "--version".to_string(),
            placeholders["version_name"].clone(),
            "--gameDir".to_string(),
            placeholders["game_directory"].clone(),
            "--assetsDir".to_string(),
            placeholders["assets_root"].clone(),
        ];

        // Additional arguments for slightly newer but still old versions
        if !assets_index.is_empty() {
            arguments.extend(vec![
                "--assetIndex".to_string(),
                placeholders["assets_index_name"].clone(),
            ]);
        }

        arguments.extend(vec![
            "--uuid".to_string(),
            placeholders["auth_uuid"].clone(),
            "--accessToken".to_string(),
            placeholders["auth_access_token"].clone(),
            "--userType".to_string(),
            placeholders["user_type"].clone(),
        ]);

        arguments
    }

    // Process JVM arguments from the manifest
    pub fn process_jvm_arguments(
        &self,
        manifest_json: &Value,
        natives_dir: &Path,
        classpath_str: &str,
        mc_memory: u32,
    ) -> Vec<String> {
        // Create placeholder map for variable substitution
        let mut placeholders = HashMap::new();
        placeholders.insert(
            "natives_directory".to_string(),
            natives_dir.to_string_lossy().to_string(),
        );
        placeholders.insert("launcher_name".to_string(), "modpackstore".to_string());
        placeholders.insert("launcher_version".to_string(), "1.0.0".to_string());
        placeholders.insert("classpath".to_string(), classpath_str.to_string());

        // Base memory settings that should always be included
        let mut jvm_args = vec![format!("-Xms512M"), format!("-Xmx{}M", mc_memory)];

        // Check if there are JVM args in the manifest (modern format)
        if let Some(args_obj) = manifest_json.get("arguments").and_then(|v| v.get("jvm")) {
            // Process JVM args from manifest
            let manifest_args = self.process_arguments(args_obj, &placeholders, None);

            // Add all arguments from manifest that aren't already included
            let filtered_args: Vec<_> = manifest_args
                .into_iter()
                .filter(|arg| !jvm_args.contains(arg))
                .collect();
            jvm_args.extend(filtered_args);
        } else {
            // Legacy format: include all standard arguments
            jvm_args.extend(vec![
                format!("-Djava.library.path={}", natives_dir.display()),
                format!("-Dminecraft.launcher.brand=modpackstore"),
                format!("-Dminecraft.launcher.version=1.0.0"),
                format!("-Djna.tmpdir={}", natives_dir.display()),
                format!(
                    "-Dorg.lwjgl.system.SharedLibraryExtractPath={}",
                    natives_dir.display()
                ),
                format!("-Dio.netty.native.workdir={}", natives_dir.display()),
            ]);

            // Add OS-specific arguments for legacy versions
            if cfg!(target_os = "macos") {
                jvm_args.push("-XstartOnFirstThread".to_string());
            }

            if cfg!(windows) {
                jvm_args.push("-XX:HeapDumpPath=MojangTricksIntelDriversForPerformance_javaw.exe_minecraft.exe.heapdump".to_string());
            }

            if cfg!(target_arch = "x86") {
                jvm_args.push("-Xss1M".to_string());
            }
        }

        // Make sure classpath is included
        if !jvm_args
            .iter()
            .any(|arg| arg == "-cp" || arg == "-classpath")
        {
            jvm_args.push("-cp".to_string());
            jvm_args.push(classpath_str.to_string());
        }

        jvm_args
    }

    // Get the appropriate client JAR path based on whether it's modded or vanilla
    fn get_client_jar_path(&self, manifest_json: &Value, paths: &MinecraftPaths) -> PathBuf {
        // For test, return vanilla client jar
        // let version_dir = game_dir
        //     .join("versions")
        //     .join(self.instance.minecraftVersion.clone());
        // let client_jar = version_dir.join(format!("{}.jar", self.instance.minecraftVersion));

        // return client_jar;

        if let Some(vanilla_version_id) = manifest_json.get("inheritsFrom").and_then(|v| v.as_str()) {
            // Modded instance
            if let Some(libraries) = manifest_json.get("libraries").and_then(|v| v.as_array()) {
                for lib in libraries {
                    if let Some(name) = lib.get("name").and_then(|n| n.as_str()) {
                        // Heuristic: Identify Forge client JAR by name.
                        // Example: "net.minecraftforge:forge:1.19.4-45.1.0:client"
                        // Or sometimes just "net.minecraftforge:forge:1.19.4-45.1.0" and relies on vanilla
                        if name.starts_with("net.minecraftforge:forge:") && name.ends_with(":client") {
                            if let Some(artifact) = lib.get("downloads").and_then(|d| d.get("artifact")) {
                                if let Some(path_str) = artifact.get("path").and_then(|p| p.as_str()) {
                                    let client_jar_path = paths.libraries_dir().join(path_str.replace('/', &MAIN_SEPARATOR.to_string()));
                                    if client_jar_path.exists() {
                                        return client_jar_path;
                                    }
                                }
                            }
                        }
                    }
                }
            }
            // If Forge client JAR not found in libraries, or if it's a newer Forge that uses vanilla JAR,
            // use the vanilla JAR specified by inheritsFrom.
            let version_dir = paths.versions_dir().join(vanilla_version_id);
            return version_dir.join(format!("{}.jar", vanilla_version_id));
        } else {
            // Vanilla instance
            let version_id = &self.instance.minecraftVersion;
            let version_dir = paths.versions_dir().join(version_id);
            return version_dir.join(format!("{}.jar", version_id));
        }
    }
}

impl GameLauncher for MinecraftLauncher {
    fn launch(&self) -> Option<Child> {
        let config_lock = get_config_manager()
            .lock()
            .expect("Failed to lock config manager mutex");

        let config = config_lock
            .as_ref()
            .expect("Config manager failed to initialize");

        let mc_memory = config.get_minecraft_memory().unwrap_or(2048); // Default to 2GB if not set
        println!("Minecraft memory: {}MB", mc_memory);

        // Get Java path from configuration
        let default_java_path = config.get_java_dir().unwrap_or_else(|| {
            println!("Java path is not set");
            PathBuf::from("default_java_path")
        });

        // Get Java path from instance or use default
        let java_path = match &self.instance.javaPath {
            Some(path) => PathBuf::from(path),
            None => default_java_path,
        }
        .join("bin")
        .join(if cfg!(windows) { "javaw.exe" } else { "java" });

        println!("Java path: {}", java_path.display());

        let accounts_manager = AccountsManager::new();

        // If instance does not have an account, return None
        let account_uuid = match &self.instance.accountUuid {
            Some(uuid) => uuid,
            None => {
                println!("No account found for this instance.");
                return None;
            }
        };

        let account = match accounts_manager.get_minecraft_account_by_uuid(account_uuid) {
            Some(acct) => acct,
            None => {
                println!("Account not found for UUID: {}", account_uuid);
                MinecraftAccount::new(
                    "offline".to_string(),
                    Uuid::new_v4().to_string(),
                    None,
                    "offline".to_string(),
                )
            }
        };

        println!("Account: {:?}", account);

        // Get game directory
        let game_dir = match &self.instance.instanceDirectory {
            Some(dir) => PathBuf::from(dir).join("minecraft"),
            None => PathBuf::from("default_path").join("minecraft"),
        };

        if !game_dir.exists() {
            fs::create_dir_all(&game_dir).expect("Failed to create game directory");
        }

        let vanilla_mc_version = self.instance.minecraftVersion.clone();
        let mut minecraft_version = self.instance.minecraftVersion.clone();

        // Check if this is a Forge instance
        let is_forge = self.instance.forgeVersion.is_some();
        if is_forge {
            println!("Detected Forge version: {:?}", self.instance.forgeVersion);

            let launcher_profiles_file = game_dir.join("launcher_profiles.json");
            // Get "forge" version from launcher_profiles.json

            if launcher_profiles_file.exists() {
                let mut file = fs::File::open(&launcher_profiles_file)
                    .expect("Failed to open launcher_profiles.json");
                let mut contents = String::new();
                file.read_to_string(&mut contents)
                    .expect("Failed to read launcher_profiles.json");

                // Parse the JSON and extract the Forge version
                let json: Value = serde_json::from_str(&contents).unwrap();
                if let Some(profiles) = json.get("profiles") {
                    if let Some(forge_profile) = profiles.get("forge") {
                        if let Some(version) = forge_profile.get("lastVersionId") {
                            minecraft_version = version
                                .as_str()
                                .unwrap_or(minecraft_version.as_str())
                                .to_string();
                        }
                    }
                }
            }
        }

        let natives_dir = game_dir.join("natives").join(&vanilla_mc_version);
        let libraries_dir = game_dir.join("libraries");
        let assets_dir = game_dir.join("assets");

        println!("Launching Minecraft with the following directories:");
        println!("Libraries directory: {}", libraries_dir.display());
        println!("Assets directory: {}", assets_dir.display());
        println!("Game directory: {}", game_dir.display());

        // Load and possibly merge manifests
        let mc_paths = crate::core::minecraft::paths::MinecraftPaths::new(&game_dir, &minecraft_version);
        let manifest_parser = crate::core::minecraft::manifest::ManifestParser::new(mc_paths);
        let manifest_json = match manifest_parser.load_merged_manifest() {
            Ok(json) => json,
            Err(_) => {
                println!("Failed to load or merge manifests");
                return None;
            }
        };

        // Get the appropriate client jar path
        let client_jar = self.get_client_jar_path(&manifest_json, &mc_paths);

        // Log paths for debugging
        println!("client_jar: {}", client_jar.display());
        println!("natives_dir: {}", natives_dir.display());
        println!("libraries_dir: {}", libraries_dir.display());
        println!("assets_dir: {}", assets_dir.display());
        println!("game_dir: {}", game_dir.display());

        // Validate required files and directories
        for (desc, path) in &[
            ("Client JAR", &client_jar),
            ("Natives", &natives_dir),
            ("Libraries", &libraries_dir),
        ] {
            if !path.exists() {
                // Create the directory if it doesn't exist
                if let Some(parent) = path.parent() {
                    if !parent.exists() {
                        fs::create_dir_all(parent).expect(&format!("Failed to create {}", desc));
                    }
                }
            }
        }

        // Get main class from manifest
        let main_class = match manifest_json.get("mainClass").and_then(|v| v.as_str()) {
            Some(class) => class,
            None => {
                println!("Main class not found in manifest");
                return None;
            }
        };

        // Get assets index
        let assets_index = manifest_json
            .get("assets")
            .and_then(|v| v.as_str())
            .or_else(|| manifest_json.get("assetIndex")?.get("id")?.as_str())
            .unwrap_or("legacy");

        // Build classpath
        let classpath_builder = crate::core::minecraft::classpath::ClasspathBuilder::new(&manifest_json, &mc_paths);
        let classpath_str = classpath_builder.build(&client_jar);

        // Process game arguments from manifest
        let game_args = self.process_game_arguments(
            &manifest_json,
            &account,
            &game_dir,
            &assets_dir,
            &natives_dir,
            &minecraft_version,
            assets_index,
        );

        // Process JVM arguments from manifest
        let jvm_args =
            self.process_jvm_arguments(&manifest_json, &natives_dir, &classpath_str, mc_memory);

        // Build command
        let mut command = Command::new(&java_path);

        // Add JVM arguments
        command.args(&jvm_args);

        // Add main class
        command.arg(main_class);

        // Add game arguments
        command.args(&game_args);

        command.current_dir(&game_dir);
        log::info!("Launching Minecraft with command: {:?}", command);
        log::info!("Arguments: {:?}", command.get_args());

        command.stdout(Stdio::piped());
        command.stderr(Stdio::piped());

        // Execute command
        match command.spawn() {
            Ok(child) => {
                println!("Spawned child process: {:?}", child.id());
                Some(child)
            }
            Err(e) => {
                println!("Failed to spawn Minecraft process: {}", e);
                None
            }
        }
    }
}
