use crate::config::get_config_manager;
use crate::core::accounts_manager::AccountsManager;
use crate::core::minecraft::{
    arguments::ArgumentProcessor,
    classpath::ClasspathBuilder,
    manifest::{ManifestMerger, ManifestParser},
    paths::MinecraftPaths,
};
use crate::core::modpackstore_auth::ModpackStoreAuth;
use crate::core::{minecraft_account::MinecraftAccount, minecraft_instance::MinecraftInstance};
use crate::interfaces::game_launcher::GameLauncher;
use std::process::{Child, Command, Stdio};
use uuid::Uuid;

pub struct MinecraftLauncher {
    instance: MinecraftInstance,
}

impl MinecraftLauncher {
    pub fn new(instance: MinecraftInstance) -> Self {
        Self { instance }
    }

    fn launch_server(&self) -> Result<Child, String> {
        let config_manager = match get_config_manager().lock() {
            Ok(manager) => manager,
            Err(e) => return Err(format!("Failed to lock config manager: {}", e)),
        };

        let config = match config_manager.as_ref() {
            Ok(cfg) => cfg,
            Err(e) => return Err(format!("Failed to load config: {}", e)),
        };

        let paths = MinecraftPaths::new(&self.instance, config)
            .ok_or_else(|| "Failed to resolve Minecraft paths for server launch".to_string())?;
        let game_dir = paths.game_dir();

        // 1. Try to find Modern Forge/NeoForge startup scripts (run.bat / run.sh)
        // These versions (1.17+) use @user_jvm_args.txt and @libraries/.../win_args.txt
        let run_script = if cfg!(windows) {
            game_dir.join("run.bat")
        } else {
            game_dir.join("run.sh")
        };

        if run_script.exists() {
            if let Ok(content) = std::fs::read_to_string(&run_script) {
                // Look for patterns like @user_jvm_args.txt or @libraries/...
                let mut args_files = Vec::new();
                for word in content.split_whitespace() {
                    let processed = word.trim_matches('"').trim_matches('\'');
                    if processed.starts_with('@') {
                        args_files.push(processed.to_string());
                    }
                }

                if !args_files.is_empty() {
                    log::info!(
                        "[MinecraftLauncher] Found modern Forge startup script with args: {:?}",
                        args_files
                    );

                    let java_exe = if cfg!(windows) {
                        paths.java_path().with_file_name("java.exe")
                    } else {
                        paths.java_path().to_path_buf()
                    };

                    let mut command = Command::new(java_exe);
                    // For modern forge, we MUST be in the game_dir
                    command.current_dir(game_dir);

                    // Add the @ files
                    for arg in args_files {
                        command.arg(arg);
                    }

                    command
                        .arg("nogui")
                        .stdin(Stdio::piped())
                        .stdout(Stdio::piped())
                        .stderr(Stdio::piped());

                    #[cfg(target_os = "windows")]
                    {
                        use std::os::windows::process::CommandExt;
                        const CREATE_NO_WINDOW: u32 = 0x08000000;
                        command.creation_flags(CREATE_NO_WINDOW);
                    }

                    log::info!("[MinecraftLauncher] Launching Modern Server: {:?}", command);
                    return command
                        .spawn()
                        .map_err(|e| format!("Failed to spawn modern server process: {}", e));
                }
            }
        }

        // 2. Fallback to Legacy Search (JAR based)
        // Find server JAR
        // 1. Check for server.jar
        // 2. Check for any jar that doesn't look like a mod or installer in the root
        let mut server_jar = game_dir.join("server.jar");
        if !server_jar.exists() {
            // Try to find any jar in the root that might be a server
            if let Ok(entries) = std::fs::read_dir(&game_dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_file() && path.extension().map_or(false, |ext| ext == "jar") {
                        let name = path
                            .file_name()
                            .and_then(|n| n.to_str())
                            .unwrap_or("")
                            .to_lowercase();

                        // IMPORTANT: Skip installers!
                        if name.contains("installer") {
                            continue;
                        }

                        if name.contains("server")
                            || (name.contains("forge") && !name.contains("installer"))
                            || name.contains("fabric")
                            || name.contains("neoforge")
                        {
                            server_jar = path;
                            break;
                        }
                    }
                }
            }
        }

        // If still not found, search in the instance directory (parent of minecraft/ if it exists)
        if !server_jar.exists() {
            if let Some(inst_dir) = &self.instance.instanceDirectory {
                let inst_path = std::path::Path::new(inst_dir);
                if let Ok(entries) = std::fs::read_dir(inst_path) {
                    for entry in entries.flatten() {
                        let path = entry.path();
                        if path.is_file() && path.extension().map_or(false, |ext| ext == "jar") {
                            let name = path
                                .file_name()
                                .and_then(|n| n.to_str())
                                .unwrap_or("")
                                .to_lowercase();

                            if name.contains("installer") {
                                continue;
                            }

                            if name.contains("server")
                                || name.contains("forge")
                                || name.contains("fabric")
                            {
                                server_jar = path;
                                break;
                            }
                        }
                    }
                }
            }
        }

        if !server_jar.exists() {
            let message = format!("No server JAR found in {}", game_dir.display());
            log::error!("[MinecraftLauncher] {}", message);
            return Err(message);
        }

        let mc_memory = config.get_minecraft_memory().unwrap_or(2048);

        let java_exe = if cfg!(windows) {
            paths.java_path().with_file_name("java.exe")
        } else {
            paths.java_path().to_path_buf()
        };

        let mut command = Command::new(java_exe);
        command
            .arg(format!("-Xmx{}M", mc_memory))
            .arg(format!("-Xms{}M", mc_memory / 2))
            .arg("-jar")
            .arg(server_jar)
            .arg("nogui")
            .current_dir(game_dir)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x08000000;
            command.creation_flags(CREATE_NO_WINDOW);
        }

        log::info!("[MinecraftLauncher] Launching Server: {:?}", command);

        command
            .spawn()
            .map_err(|e| format!("Failed to spawn server process: {}", e))
    }
}

impl GameLauncher for MinecraftLauncher {
    fn launch(&self) -> Result<Child, String> {
        if self.instance.is_server() {
            return self.launch_server();
        }

        let config_manager = match get_config_manager().lock() {
            Ok(manager) => manager,
            Err(e) => return Err(format!("Failed to lock config manager: {}", e)),
        };

        let config = match config_manager.as_ref() {
            Ok(cfg) => cfg,
            Err(e) => return Err(format!("Failed to load config: {}", e)),
        };

        log::info!("[MinecraftLauncher] Config loaded");
        log::info!(
            "[MinecraftLauncher] Starting {} Minecraft instance",
            self.instance.instanceName
        );

        let mc_memory = match config.get_minecraft_memory() {
            Some(mem) => mem,
            None => {
                log::warn!("No Minecraft memory config found, using default 2048MB");
                2048
            }
        };

        log::info!("Minecraft memory: {}MB", mc_memory);

        // Get account - either from account manager or create ModpackStore account
        let accounts_manager = AccountsManager::new();
        let account = if self.instance.useModpackStoreAuth {
            // ModpackStore Yggdrasil auth - look up username from selected account
            log::info!("[MinecraftLauncher] Using ModpackStore authentication");

            let account_uuid = match self.instance.accountUuid.as_deref() {
                Some(uuid) => uuid,
                None => {
                        let message = "useModpackStoreAuth is true but no account UUID set".to_string();
                        log::error!("[MinecraftLauncher] {}", message);
                        return Err(message);
                }
            };

            // Fetch the selected account's username
            let selected_account = match accounts_manager.get_minecraft_account_by_uuid(account_uuid) {
                Some(acc) => acc,
                None => {
                    let message = format!("Account with UUID {} not found", account_uuid);
                    log::error!("[MinecraftLauncher] {}", message);
                    return Err(message);
                }
            };
            let username = selected_account.username().to_string();

            // Get JWT token from store synchronously
            let app_handle = match crate::GLOBAL_APP_HANDLE.lock() {
                Ok(guard) => guard.as_ref().cloned(),
                Err(e) => return Err(format!("Failed to lock global app handle: {}", e)),
            };

            let access_token = match app_handle {
                Some(handle) => {
                    match crate::core::instance_manager::get_access_token_sync(&handle) {
                        Ok(Some(token)) => token,
                        _ => {
                            let message = "No access token found in store".to_string();
                            log::error!("[MinecraftLauncher] {}", message);
                            return Err(message);
                        }
                    }
                }
                None => {
                    let message = "No app handle available".to_string();
                    log::error!("[MinecraftLauncher] {}", message);
                    return Err(message);
                }
            };

            let api_endpoint = crate::API_ENDPOINT.to_string();
            let ms_auth = ModpackStoreAuth::new(api_endpoint);

            let rt = match tokio::runtime::Runtime::new() {
                Ok(rt) => rt,
                Err(e) => {
                    let message = format!("Failed to create Tokio runtime: {}", e);
                    log::error!("[MinecraftLauncher] {}", message);
                    return Err(message);
                }
            };
            let auth_response =
                match rt.block_on(ms_auth.authenticate(access_token, Some(username))) {
                    Ok(response) => response,
                    Err(e) => {
                        let message = format!("Failed to authenticate with ModpackStore: {}", e);
                        log::error!("[MinecraftLauncher] {}", message);
                        return Err(message);
                    }
                };

            let account = MinecraftAccount::new(
                auth_response.selected_profile.name,
                auth_response.selected_profile.id,
                Some(auth_response.access_token),
                "modpackstore".to_string(),
            );

            log::info!(
                "[MinecraftLauncher] Created ModpackStore account: {}",
                account.username()
            );

            account
        } else if let Some(uuid) = &self.instance.accountUuid {
            // Local account auth
            match accounts_manager.get_minecraft_account_by_uuid(uuid) {
                Some(acc) => {
                    log::info!(
                        "[MinecraftLauncher] Using account from manager: {}",
                        acc.username()
                    );
                    acc
                }
                None => {
                    let message = format!("Account with UUID {} not found", uuid);
                    log::error!("[MinecraftLauncher] {}", message);
                    return Err(message);
                }
            }
        } else {
            let message = "No account assigned to this instance".to_string();
            log::error!("[MinecraftLauncher] {}", message);
            return Err(message);
        };

        log::info!(
            "[MinecraftLauncher] Launching Minecraft using account: {}",
            account.username()
        );

        // Setup paths
        let paths = MinecraftPaths::new(&self.instance, config)
            .ok_or_else(|| "Failed to resolve Minecraft paths".to_string())?;

        log::info!("[MinecraftLauncher] Minecraft paths: {:?}", paths);
        log::info!("[MinecraftLauncher] Java path: {:?}", paths.java_path());
        // Load and merge manifests if needed
        let manifest_parser = ManifestParser::new(&paths);
        let manifest_json = match manifest_parser.load_merged_manifest() {
            Ok(manifest) => manifest,
            Err(e) => {
                let message = format!("Failed to load manifest: {}", e);
                log::error!("[MinecraftLauncher] {}", message);
                return Err(message);
            }
        };

        log::info!("[MinecraftLauncher] Manifest loaded");

        // Build classpath
        let classpath_builder = ClasspathBuilder::new(&manifest_json, &paths);
        let classpath_str = match classpath_builder.build() {
            Ok(classpath) => classpath,
            Err(e) => {
                let message = format!("Failed to build classpath: {}", e);
                log::error!("[MinecraftLauncher] {}", message);
                return Err(message);
            }
        };

        log::info!("[MinecraftLauncher] Classpath: {}", classpath_str);

        // Process arguments
        let argument_processor =
            ArgumentProcessor::new(&manifest_json, &account, &paths, mc_memory);
        let (mut jvm_args, game_args) = match argument_processor.process_arguments() {
            Ok(args) => args,
            Err(e) => {
                let message = format!("Failed to process arguments: {}", e);
                log::error!("[MinecraftLauncher] {}", message);
                return Err(message);
            }
        };

        // Add authlib-injector if using ModpackStore auth
        if self.instance.useModpackStoreAuth {
            match crate::core::instance_manager::get_authlib_injector_arg_sync(
                &self.instance,
                &paths,
            ) {
                Ok(authlib_arg) => {
                    // Insert authlib-injector as the first JVM argument
                    jvm_args.insert(0, authlib_arg);
                    log::info!("[MinecraftLauncher] Added authlib-injector to JVM arguments");
                }
                Err(e) => {
                    let message = format!("Failed to get authlib-injector argument: {}", e);
                    log::error!("[MinecraftLauncher] {}", message);
                    return Err(message);
                }
            }
        }

        // Get main class
        let main_class = match manifest_json.get("mainClass").and_then(|v| v.as_str()) {
            Some(class) => class,
            None => {
                let message = "No mainClass found in manifest".to_string();
                log::error!("[MinecraftLauncher] {}", message);
                return Err(message);
            }
        };

        // Build and execute command
        let mut command = Command::new(paths.java_path());
        command
            .args(&jvm_args)
            .arg(main_class)
            .args(&game_args)
            .current_dir(paths.game_dir())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x08000000;
            command.creation_flags(CREATE_NO_WINDOW);
        }

        // Log the complete launch command for debugging
        log::info!("Launching Minecraft with command: {:?}", command);
        log::debug!("Java executable: {}", paths.java_path().display());
        log::debug!("Main class: {}", main_class);
        log::debug!("Working directory: {}", paths.game_dir().display());
        log::debug!("JVM arguments ({}): {:?}", jvm_args.len(), jvm_args);
        log::debug!("Game arguments ({}): {:?}", game_args.len(), game_args);

        // Build full command string for easy debugging
        let mut full_command = vec![paths.java_path().to_string_lossy().to_string()];
        full_command.extend(jvm_args.iter().cloned());
        full_command.push(main_class.to_string());
        full_command.extend(game_args.iter().cloned());

        log::info!(
            "[MinecraftLauncher] Full launch command: {}",
            full_command.join(" ")
        );

        match command.spawn() {
            Ok(child) => {
                log::info!(
                    "[MinecraftLauncher] Minecraft process started successfully with PID: {:?}",
                    child.id()
                );
                Ok(child)
            }
            Err(e) => {
                let message = format!("Failed to launch Minecraft: {}", e);
                log::error!("[MinecraftLauncher] {}", message);
                log::error!(
                    "[MinecraftLauncher] Java path exists: {}",
                    paths.java_path().exists()
                );
                log::error!(
                    "[MinecraftLauncher] Working directory exists: {}",
                    paths.game_dir().exists()
                );
                Err(message)
            }
        }
    }
}
