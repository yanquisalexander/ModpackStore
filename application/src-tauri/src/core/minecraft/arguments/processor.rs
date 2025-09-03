use super::super::version_compatibility::{
    VersionCompatibility, VersionFeature, VersionGeneration,
};
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
    generation: VersionGeneration,
}

impl<'a> ArgumentProcessor<'a> {
    pub fn new(
        manifest: &'a Value,
        account: &'a MinecraftAccount,
        paths: &'a MinecraftPaths,
        memory: u32,
    ) -> Self {
        let version = manifest
            .get("id")
            .and_then(|v| v.as_str())
            .unwrap_or(paths.minecraft_version());
        let generation = VersionCompatibility::detect_generation(version, Some(manifest));

        Self {
            manifest,
            account,
            paths,
            memory,
            generation,
        }
    }

    pub fn process_arguments(&self) -> Option<(Vec<String>, Vec<String>)> {
        let placeholders = self.create_placeholders();
        let features = self.create_features_map();

        let jvm_args = self.process_jvm_arguments(&placeholders)?;
        let game_args = self.process_game_arguments(&placeholders, &features)?;

        Some((jvm_args, game_args))
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
        let version = self
            .manifest
            .get("id")
            .and_then(|v| v.as_str())
            .unwrap_or(self.paths.minecraft_version());

        placeholders.insert(
            "auth_player_name".to_string(),
            self.account.username().to_string(),
        );
        placeholders.insert("version_name".to_string(), version.to_string());
        placeholders.insert(
            "game_directory".to_string(),
            self.paths.game_dir().to_string_lossy().to_string(),
        );
        placeholders.insert(
            "assets_root".to_string(),
            self.paths.assets_dir().to_string_lossy().to_string(),
        );

        let binding = crate::GLOBAL_APP_HANDLE.lock().unwrap();
        let app_handle = binding.as_ref().unwrap();
        let (width, height) = Self::get_screen_resolution(app_handle);
        placeholders.insert("resolution_width".to_string(), width.to_string());
        placeholders.insert("resolution_height".to_string(), height.to_string());

        // Version-aware asset index handling
        let asset_index = VersionCompatibility::get_asset_index_name(version, Some(self.manifest));
        placeholders.insert("assets_index_name".to_string(), asset_index);

        placeholders.insert("auth_uuid".to_string(), self.account.uuid().to_string());
        placeholders.insert(
            "auth_access_token".to_string(),
            self.account.access_token().unwrap_or("null").to_string(),
        );

        // Enhanced user type detection
        let user_type = if self.account.user_type() != "offline" {
            "mojang"
        } else {
            match self.generation {
                VersionGeneration::PreClassic => "legacy",
                _ => "mojang",
            }
        };
        placeholders.insert("user_type".to_string(), user_type.to_string());

        placeholders.insert("version_type".to_string(), "release".to_string());
        placeholders.insert(
            "natives_directory".to_string(),
            self.paths.natives_dir().to_string_lossy().to_string(),
        );

        placeholders.insert(
            "library_directory".to_string(),
            self.paths.libraries_dir().to_string_lossy().to_string(),
        );
        placeholders.insert(
            "classpath_separator".to_string(),
            if cfg!(windows) { ";" } else { ":" }.to_string(),
        );

        placeholders.insert("launcher_name".to_string(), "modpackstore".to_string());
        placeholders.insert("launcher_version".to_string(), "1.0.0".to_string());

        placeholders.insert("classpath".to_string(), self.paths.classpath_str());

        placeholders
    }

    fn create_features_map(&self) -> HashMap<String, bool> {
        let mut features = HashMap::new();

        // Version-aware feature detection
        let version = self
            .manifest
            .get("id")
            .and_then(|v| v.as_str())
            .unwrap_or(self.paths.minecraft_version());

        features.insert(
            "has_custom_resolution".to_string(),
            VersionCompatibility::supports_feature(version, VersionFeature::CustomResolution),
        );
        features.insert("has_quick_plays_support".to_string(), false);
        features.insert("is_demo_user".to_string(), false);
        features.insert("is_quick_play_singleplayer".to_string(), false);
        features.insert("is_quick_play_multiplayer".to_string(), false);
        features.insert("is_quick_play_realms".to_string(), false);

        // Modern version features
        if matches!(
            self.generation,
            VersionGeneration::Modern | VersionGeneration::Future
        ) {
            features.insert("supports_java_agents".to_string(), true);
            features.insert("supports_rule_based_args".to_string(), true);
        }

        features
    }

    fn process_jvm_arguments(&self, placeholders: &HashMap<String, String>) -> Option<Vec<String>> {
        let mut jvm_args = vec![format!("-Xms512M"), format!("-Xmx{}M", self.memory)];

        // Add enhanced version-specific JVM arguments
        let version = self
            .manifest
            .get("id")
            .and_then(|v| v.as_str())
            .unwrap_or(self.paths.minecraft_version());
        
        let enhanced_args = VersionCompatibility::get_enhanced_jvm_args(version, Some(self.manifest));
        jvm_args.extend(enhanced_args);

        // Process manifest arguments based on version generation
        match self.generation {
            VersionGeneration::Modern | VersionGeneration::Future => {
                if let Some(args_obj) = self.manifest.get("arguments").and_then(|v| v.get("jvm")) {
                    let manifest_args = self.process_arguments_list(args_obj, placeholders, None);
                    let filtered_args: Vec<String> = manifest_args
                        .into_iter()
                        .filter(|arg| !self.is_redundant_jvm_arg(arg, &jvm_args))
                        .collect();
                    jvm_args.extend(filtered_args);
                }
            }
            _ => {
                // Legacy fallback arguments with enhanced compatibility
                self.add_enhanced_legacy_jvm_arguments(&mut jvm_args, version);
            }
        }

        // Ensure classpath is present
        if !jvm_args
            .iter()
            .any(|arg| arg == "-cp" || arg == "-classpath")
        {
            let classpath = self.paths.classpath_str();
            jvm_args.push("-cp".to_string());
            jvm_args.push(classpath);
        }

        log::debug!("[ArgumentProcessor] Final JVM args: {:?}", jvm_args);
        Some(jvm_args)
    }

    /// Check if a JVM argument is redundant (already present)
    fn is_redundant_jvm_arg(&self, new_arg: &str, existing_args: &[String]) -> bool {
        // Check for duplicate system properties
        if new_arg.starts_with("-D") {
            let prop_name = new_arg.split('=').next().unwrap_or(new_arg);
            return existing_args.iter().any(|arg| arg.starts_with(prop_name));
        }

        // Check for duplicate memory flags
        if new_arg.starts_with("-Xms") || new_arg.starts_with("-Xmx") {
            return existing_args.iter().any(|arg| {
                (new_arg.starts_with("-Xms") && arg.starts_with("-Xms")) ||
                (new_arg.starts_with("-Xmx") && arg.starts_with("-Xmx"))
            });
        }

        // Check for duplicate flags
        existing_args.contains(&new_arg.to_string())
    }

    /// Add enhanced legacy JVM arguments for older versions
    fn add_enhanced_legacy_jvm_arguments(&self, jvm_args: &mut Vec<String>, version: &str) {
        // Base legacy arguments
        self.add_legacy_jvm_arguments(jvm_args);
        
        // Version-specific enhancements
        if let Some((_, minor, _)) = VersionCompatibility::parse_version_number(version) {
            match minor {
                6..=7 => {
                    // 1.6-1.7.10 specific arguments
                    jvm_args.push("-Dfml.ignoreInvalidMinecraftCertificates=true".to_string());
                    jvm_args.push("-Dfml.ignorePatchDiscrepancies=true".to_string());
                }
                8..=12 => {
                    // 1.8-1.12.2 specific arguments  
                    jvm_args.push("-Dminecraft.applet.TargetDirectory=.".to_string());
                }
                _ => {}
            }
        }
    }

    /// Add legacy JVM arguments for older versions
    fn add_legacy_jvm_arguments(&self, jvm_args: &mut Vec<String>) {
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

    fn process_game_arguments(
        &self,
        placeholders: &HashMap<String, String>,
        features: &HashMap<String, bool>,
    ) -> Option<Vec<String>> {
        let mut args = match self.generation {
            VersionGeneration::Modern | VersionGeneration::Future => {
                self.process_modern_game_arguments(placeholders, features)
            }
            VersionGeneration::Legacy => self.process_legacy_game_arguments(placeholders),
            VersionGeneration::PreClassic => self.process_preclassic_game_arguments(placeholders),
        }?;

        // Add GUI scale if not present (for better user experience)
        if !args.contains(&"--guiScale".to_string()) {
            args.push("--guiScale".to_string());
            args.push("2".to_string());
        }

        Some(args)
    }

    fn process_modern_game_arguments(
        &self,
        placeholders: &HashMap<String, String>,
        features: &HashMap<String, bool>,
    ) -> Option<Vec<String>> {
        if let Some(args_obj) = self.manifest.get("arguments").and_then(|v| v.get("game")) {
            Some(self.process_arguments_list(args_obj, placeholders, Some(features)))
        } else {
            // Fallback to basic arguments for modern versions without proper argument structure
            Some(self.create_basic_game_arguments(placeholders))
        }
    }

    fn process_legacy_game_arguments(
        &self,
        placeholders: &HashMap<String, String>,
    ) -> Option<Vec<String>> {
        if let Some(min_args) = self
            .manifest
            .get("minecraftArguments")
            .and_then(|v| v.as_str())
        {
            let args: Vec<String> = min_args
                .split_whitespace()
                .map(|arg| self.replace_placeholders(arg, placeholders))
                .collect();
            Some(args)
        } else {
            // Create legacy-style arguments if not present
            Some(self.create_legacy_game_arguments(placeholders))
        }
    }

    fn process_preclassic_game_arguments(
        &self,
        placeholders: &HashMap<String, String>,
    ) -> Option<Vec<String>> {
        // Very old versions have minimal argument requirements
        Some(vec![
            placeholders
                .get("auth_player_name")
                .cloned()
                .unwrap_or_default(),
            "".to_string(), // Session ID (empty for offline)
        ])
    }

    fn create_basic_game_arguments(&self, placeholders: &HashMap<String, String>) -> Vec<String> {
        vec![
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
        ]
    }

    fn create_legacy_game_arguments(&self, placeholders: &HashMap<String, String>) -> Vec<String> {
        // Create arguments in the format expected by 1.6-1.12 versions
        vec![
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
            "--userProperties".to_string(),
            "{}".to_string(),
            "--userType".to_string(),
            placeholders["user_type"].clone(),
        ]
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
