use super::rules::RuleEvaluator;
use crate::core::minecraft::paths::MinecraftPaths;
use crate::core::minecraft_account::MinecraftAccount;
use serde_json::Value;
use std::collections::HashMap;
use std::path::Path;
use tauri::Window;

pub struct ArgumentProcessor<'a> {
    manifest: &'a Value,
    account: &'a MinecraftAccount,
    paths: &'a MinecraftPaths,
    memory: u32,
}

impl<'a> ArgumentProcessor<'a> {
    pub fn new(
        manifest: &'a Value,
        account: &'a MinecraftAccount,
        paths: &'a MinecraftPaths,
        memory: u32,
    ) -> Self {
        Self {
            manifest,
            account,
            paths,
            memory,
        }
    }

    pub fn process_arguments(&self) -> Result<(Vec<String>, Vec<String>), String> {
        let placeholders = self.create_placeholders();
        let features = self.create_features_map();

        let jvm_args = self.process_jvm_arguments(&placeholders)?;
        let game_args = self.process_game_arguments(&placeholders, &features)?;

        log::debug!("Successfully processed arguments - JVM: {} args, Game: {} args", 
                   jvm_args.len(), game_args.len());
        log::debug!("JVM arguments: {:?}", jvm_args);
        log::debug!("Game arguments: {:?}", game_args);

        Ok((jvm_args, game_args))
    }

    fn get_screen_resolution(app_handle: &tauri::AppHandle) -> (u32, u32) {
        if let Some(monitor) = app_handle.primary_monitor().unwrap_or(None) {
            let size = monitor.size();
            (size.width, size.height)
        } else {
            (800, 600)
        }
    }

    fn create_placeholders(&self) -> HashMap<String, String> {
        let mut placeholders = HashMap::new();
        
        // Basic authentication and player info
        placeholders.insert(
            "auth_player_name".to_string(),
            self.account.username().to_string(),
        );
        placeholders.insert("auth_uuid".to_string(), self.account.uuid().to_string());
        placeholders.insert(
            "auth_access_token".to_string(),
            self.account.access_token().unwrap_or("null").to_string(),
        );
        placeholders.insert(
            "user_type".to_string(),
            if self.account.user_type() != "offline" {
                "mojang"
            } else {
                "legacy"
            }
            .to_string(),
        );

        // Version and game info
        placeholders.insert(
            "version_name".to_string(),
            self.paths.minecraft_version().to_string(),
        );
        placeholders.insert("version_type".to_string(), "release".to_string());

        // Directory paths
        placeholders.insert(
            "game_directory".to_string(),
            self.paths.game_dir().to_string_lossy().to_string(),
        );
        placeholders.insert(
            "assets_root".to_string(),
            self.paths.assets_dir().to_string_lossy().to_string(),
        );
        placeholders.insert(
            "natives_directory".to_string(),
            self.paths.natives_dir().to_string_lossy().to_string(),
        );
        placeholders.insert(
            "library_directory".to_string(),
            self.paths.libraries_dir().to_string_lossy().to_string(),
        );

        // Assets info - try multiple ways to get asset index
        let assets_index = self.manifest
            .get("assets")
            .and_then(|v| v.as_str())
            .or_else(|| self.manifest.get("assetIndex")?.get("id")?.as_str())
            .or_else(|| {
                // Fallback for very old versions
                let version = self.paths.minecraft_version();
                if version.starts_with("1.6") || version.starts_with("1.5") || version.starts_with("1.4") {
                    Some("legacy")
                } else if version.starts_with("1.7") {
                    Some("1.7.10") 
                } else {
                    Some("legacy")
                }
            })
            .unwrap_or("legacy");
            
        placeholders.insert("assets_index_name".to_string(), assets_index.to_string());

        // Screen resolution
        let (width, height) = if let Ok(binding) = crate::GLOBAL_APP_HANDLE.lock() {
            if let Some(app_handle) = binding.as_ref() {
                Self::get_screen_resolution(app_handle)
            } else {
                (800, 600) // fallback
            }
        } else {
            (800, 600) // fallback
        };
        
        placeholders.insert("resolution_width".to_string(), width.to_string());
        placeholders.insert("resolution_height".to_string(), height.to_string());

        // System info
        placeholders.insert(
            "classpath_separator".to_string(),
            if cfg!(windows) { ";" } else { ":" }.to_string(),
        );

        // Launcher info
        placeholders.insert("launcher_name".to_string(), "modpackstore".to_string());
        placeholders.insert("launcher_version".to_string(), "1.0.0".to_string());

        // Classpath - this is crucial for the launcher
        let classpath = self.paths.classpath_str();
        placeholders.insert("classpath".to_string(), classpath);

        // Additional placeholders for newer versions
        placeholders.insert("client_id".to_string(), "".to_string());
        placeholders.insert("auth_xuid".to_string(), "".to_string());
        placeholders.insert("user_properties".to_string(), "{}".to_string());

        log::debug!("Created {} placeholders for argument processing", placeholders.len());
        
        placeholders
    }

    fn create_features_map(&self) -> HashMap<String, bool> {
        let mut features = HashMap::new();
        // features.insert("has_custom_resolution".to_string(), true); // Cambiado a true para incluir argumentos de resolución
        features.insert("has_quick_plays_support".to_string(), false);
        features.insert("is_demo_user".to_string(), false);
        features.insert("is_quick_play_singleplayer".to_string(), false);
        features.insert("is_quick_play_multiplayer".to_string(), false);
        features.insert("is_quick_play_realms".to_string(), false);
        features
    }

    fn process_jvm_arguments(&self, placeholders: &HashMap<String, String>) -> Result<Vec<String>, String> {
        let mut jvm_args = vec![format!("-Xms512M"), format!("-Xmx{}M", self.memory)];

        log::debug!("Processing JVM arguments with {}MB memory", self.memory);

        // Check for modern arguments format (1.13+)
        if let Some(args_obj) = self.manifest.get("arguments").and_then(|v| v.get("jvm")) {
            log::debug!("Using modern JVM arguments format from manifest");
            let manifest_args = self.process_arguments_list(args_obj, placeholders, None);
            
            // Filter out any memory arguments that conflict with ours
            let filtered_args: Vec<String> = manifest_args
                .into_iter()
                .filter(|arg| !arg.starts_with("-Xms") && !arg.starts_with("-Xmx"))
                .collect();
            
            jvm_args.extend(filtered_args);
        } else {
            // Legacy format or no JVM arguments specified - add defaults
            log::debug!("Using legacy/default JVM arguments");
            jvm_args.extend(vec![
                format!("-Djava.library.path={}", self.paths.natives_dir().display()),
                format!("-Dminecraft.launcher.brand=modpackstore"),
                format!("-Dminecraft.launcher.version=1.0.0"),
                format!("-Djna.tmpdir={}", self.paths.natives_dir().display()),
                format!(
                    "-Dorg.lwjgl.system.SharedLibraryExtractPath={}",
                    self.paths.natives_dir().display()
                ),
                format!(
                    "-Dio.netty.native.workdir={}",
                    self.paths.natives_dir().display()
                ),
            ]);

            // OS-specific arguments
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

        // Ensure classpath is always added if not present
        if !jvm_args.iter().any(|arg| arg == "-cp" || arg == "-classpath") {
            let classpath = self.paths.classpath_str();
            if classpath.is_empty() {
                return Err("Classpath is empty - cannot launch Minecraft".to_string());
            }
            jvm_args.push("-cp".to_string());
            jvm_args.push(classpath);
        }

        // Replace placeholders in all arguments
        let final_args: Vec<String> = jvm_args
            .into_iter()
            .map(|arg| self.replace_placeholders(&arg, placeholders))
            .collect();

        log::debug!("Final JVM arguments: {:?}", final_args);
        Ok(final_args)
    }

    fn process_game_arguments(
        &self,
        placeholders: &HashMap<String, String>,
        features: &HashMap<String, bool>,
    ) -> Result<Vec<String>, String> {
        // Check for modern arguments format first (1.13+)
        if let Some(args_obj) = self.manifest.get("arguments").and_then(|v| v.get("game")) {
            log::debug!("Using modern game arguments format from manifest");
            let mut args = self.process_arguments_list(args_obj, placeholders, Some(features));
            
            // Add GUI scale if not present
            if !args.contains(&"--guiScale".to_string()) {
                args.push("--guiScale".to_string());
                args.push("2".to_string());
            }
            
            log::debug!("Modern game arguments processed: {} args", args.len());
            return Ok(args);
        }
        
        // Check for legacy arguments format (pre-1.13)
        if let Some(min_args) = self.manifest.get("minecraftArguments").and_then(|v| v.as_str()) {
            log::debug!("Using legacy minecraftArguments format from manifest");
            let mut args: Vec<String> = min_args
                .split_whitespace()
                .map(|arg| self.replace_placeholders(arg, placeholders))
                .collect();
                
            // Add GUI scale if not present
            if !args.contains(&"--guiScale".to_string()) {
                args.push("--guiScale".to_string());
                args.push("2".to_string());
            }
            
            log::debug!("Legacy game arguments processed: {} args", args.len());
            return Ok(args);
        }
        
        // Fallback to constructing basic arguments (very old versions or missing data)
        log::debug!("No game arguments found in manifest, using fallback arguments");
        
        // Verify required placeholders exist
        let required_placeholders = [
            "auth_player_name", "version_name", "game_directory", 
            "assets_root", "assets_index_name", "auth_uuid", 
            "auth_access_token", "user_type"
        ];
        
        for placeholder in &required_placeholders {
            if !placeholders.contains_key(*placeholder) {
                return Err(format!("Missing required placeholder: {}", placeholder));
            }
        }
        
        let mut arguments = vec![
            "--username".to_string(),
            placeholders["auth_player_name"].clone(),
            "--version".to_string(),
            placeholders["version_name"].clone(),
            "--gameDir".to_string(),
            placeholders["game_directory"].clone(),
            "--assetsDir".to_string(),
            placeholders["assets_root"].clone(),
            "--assetIndex".to_string(),
            placeholders["assets_index_name"].clone(),
            "--uuid".to_string(),
            placeholders["auth_uuid"].clone(),
            "--accessToken".to_string(),
            placeholders["auth_access_token"].clone(),
            "--userType".to_string(),
            placeholders["user_type"].clone(),
        ];
        
        // Add GUI scale
        arguments.push("--guiScale".to_string());
        arguments.push("2".to_string());
        
        log::debug!("Fallback game arguments constructed: {} args", arguments.len());
        Ok(arguments)
    }

    fn process_arguments_list(
        &self,
        args_obj: &Value,
        placeholders: &HashMap<String, String>,
        features: Option<&HashMap<String, bool>>,
    ) -> Vec<String> {
        let mut processed_args = Vec::new();

        if let Some(args_array) = args_obj.as_array() {
            for arg in args_array {
                if let Some(arg_str) = arg.as_str() {
                    processed_args.push(self.replace_placeholders(arg_str, placeholders));
                } else if arg.is_object() {
                    if let Some(rules) = arg.get("rules").and_then(|r| r.as_array()) {
                        let mut should_include = false;
                        for rule in rules {
                            if RuleEvaluator::should_apply_rule(rule, features) {
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

    fn replace_placeholders(&self, input: &str, placeholders: &HashMap<String, String>) -> String {
        let mut result = input.to_string();
        for (key, value) in placeholders {
            result = result.replace(&format!("${{{}}}", key), value);
        }
        result
    }
}
