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

    fn launch_server(&self) -> Option<Child> {
        let config_manager = match get_config_manager().lock() {
            Ok(manager) => manager,
            Err(_) => return None,
        };

        let config = match config_manager.as_ref() {
            Ok(cfg) => cfg,
            Err(_) => return None,
        };

        let paths = MinecraftPaths::new(&self.instance, config)?;
        let game_dir = paths.game_dir();

        // Find server JAR
        // 1. Check for server.jar
        // 2. Check for any jar that doesn't look like a mod in the root
        let mut server_jar = game_dir.join("server.jar");
        if !server_jar.exists() {
            // Try to find any jar in the root that might be a server
            if let Ok(entries) = std::fs::read_dir(&game_dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_file() && path.extension().map_or(false, |ext| ext == "jar") {
                        let name = path.file_name().unwrap().to_string_lossy().to_lowercase();
                        if name.contains("server")
                            || name.contains("forge")
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
                            let name = path.file_name().unwrap().to_string_lossy().to_lowercase();
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
            log::error!(
                "[MinecraftLauncher] No server JAR found in {}",
                game_dir.display()
            );
            return None;
        }

        let mc_memory = config.get_minecraft_memory().unwrap_or(2048);

        let mut command = Command::new(paths.java_path());
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

        log::info!("[MinecraftLauncher] Launching Server: {:?}", command);

        command.spawn().ok()
    }
}

impl GameLauncher for MinecraftLauncher {
    fn launch(&self) -> Option<Child> {
        if self.instance.is_server() {
            return self.launch_server();
        }

        let config_manager = match get_config_manager().lock() {
            Ok(manager) => manager,
            Err(_) => return None,
        };

        let config = match config_manager.as_ref() {
            Ok(cfg) => cfg,
            Err(_) => return None,
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
        let account = match &self.instance.accountUuid {
            Some(uuid) => {
                // Use existing account (Microsoft or Offline)
                match accounts_manager.get_minecraft_account_by_uuid(uuid) {
                    Some(acc) => {
                        log::info!(
                            "[MinecraftLauncher] Using account from manager: {}",
                            acc.username()
                        );
                        acc
                    }
                    None => {
                        log::error!("[MinecraftLauncher] Account with UUID {} not found", uuid);
                        return None;
                    }
                }
            }
            None => {
                // No account UUID - use ModpackStore auth
                log::info!("[MinecraftLauncher] No account UUID found, using ModpackStore auth");

                // Get JWT token from store synchronously
                let app_handle = match crate::GLOBAL_APP_HANDLE.lock() {
                    Ok(guard) => guard.as_ref().cloned(),
                    Err(_) => return None,
                };

                let access_token = match app_handle {
                    Some(handle) => {
                        match crate::core::instance_manager::get_access_token_sync(&handle) {
                            Ok(Some(token)) => token,
                            _ => {
                                log::error!("[MinecraftLauncher] No access token found in store");
                                return None;
                            }
                        }
                    }
                    None => {
                        log::error!("[MinecraftLauncher] No app handle available");
                        return None;
                    }
                };

                // Create ModpackStore auth client
                let api_endpoint = crate::API_ENDPOINT.to_string();
                let ms_auth = ModpackStoreAuth::new(api_endpoint);

                // Get username (ms_nickname if set, otherwise default from session)
                let username = self
                    .instance
                    .ms_nickname
                    .clone()
                    .unwrap_or_else(|| "Player".to_string());

                // For synchronous launcher, we need to block on the async authentication
                // This is not ideal but maintains compatibility
                let rt = tokio::runtime::Runtime::new().unwrap();
                let auth_response =
                    match rt.block_on(ms_auth.authenticate(access_token, Some(username))) {
                        Ok(response) => response,
                        Err(e) => {
                            log::error!(
                                "[MinecraftLauncher] Failed to authenticate with ModpackStore: {}",
                                e
                            );
                            return None;
                        }
                    };

                // Create temporary MinecraftAccount
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
            }
        };

        log::info!(
            "[MinecraftLauncher] Launching Minecraft using account: {}",
            account.username()
        );

        // Setup paths
        let paths = MinecraftPaths::new(&self.instance, config)?;

        log::info!("[MinecraftLauncher] Minecraft paths: {:?}", paths);
        log::info!("[MinecraftLauncher] Java path: {:?}", paths.java_path());
        // Load and merge manifests if needed
        let manifest_parser = ManifestParser::new(&paths);
        let manifest_json = match manifest_parser.load_merged_manifest() {
            Ok(manifest) => manifest,
            Err(e) => {
                log::error!("[MinecraftLauncher] Failed to load manifest: {}", e);
                return None;
            }
        };

        log::info!("[MinecraftLauncher] Manifest loaded");

        // Build classpath
        let classpath_builder = ClasspathBuilder::new(&manifest_json, &paths);
        let classpath_str = match classpath_builder.build() {
            Ok(classpath) => classpath,
            Err(e) => {
                log::error!("[MinecraftLauncher] Failed to build classpath: {}", e);
                return None;
            }
        };

        log::info!("[MinecraftLauncher] Classpath: {}", classpath_str);

        // Process arguments
        let argument_processor =
            ArgumentProcessor::new(&manifest_json, &account, &paths, mc_memory);
        let (mut jvm_args, game_args) = match argument_processor.process_arguments() {
            Ok(args) => args,
            Err(e) => {
                log::error!("[MinecraftLauncher] Failed to process arguments: {}", e);
                return None;
            }
        };

        // Add authlib-injector if using ModpackStore auth
        if self.instance.accountUuid.is_none() {
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
                    log::error!(
                        "[MinecraftLauncher] Failed to get authlib-injector argument: {}",
                        e
                    );
                    return None;
                }
            }
        }

        // Get main class
        let main_class = match manifest_json.get("mainClass").and_then(|v| v.as_str()) {
            Some(class) => class,
            None => {
                log::error!("[MinecraftLauncher] No mainClass found in manifest");
                return None;
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
                Some(child)
            }
            Err(e) => {
                log::error!("[MinecraftLauncher] Failed to launch Minecraft: {}", e);
                log::error!(
                    "[MinecraftLauncher] Java path exists: {}",
                    paths.java_path().exists()
                );
                log::error!(
                    "[MinecraftLauncher] Working directory exists: {}",
                    paths.game_dir().exists()
                );
                None
            }
        }
    }
}
