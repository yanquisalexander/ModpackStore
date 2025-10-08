use crate::config::get_config_manager;
use crate::core::accounts_manager::AccountsManager;
use crate::core::minecraft::{
    arguments::ArgumentProcessor,
    classpath::ClasspathBuilder,
    manifest::{ManifestMerger, ManifestParser},
    paths::MinecraftPaths,
};
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
}

impl GameLauncher for MinecraftLauncher {
    fn launch(&self) -> Option<Child> {
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

        // Get account - handle ModpackStore account if accountUuid is None
        let account = if let Some(account_uuid) = &self.instance.accountUuid {
            // Use existing account (Microsoft or Offline)
            let accounts_manager = AccountsManager::new();
            match accounts_manager.get_minecraft_account_by_uuid(account_uuid) {
                Some(acc) => acc,
                None => {
                    log::error!("[MinecraftLauncher] Account not found: {}", account_uuid);
                    return None;
                }
            }
        } else {
            // Use ModpackStore account
            log::info!("[MinecraftLauncher] Using ModpackStore account");
            
            // Get JWT token from auth store
            let jwt_token = match Self::get_modpackstore_jwt_token() {
                Ok(token) => token,
                Err(e) => {
                    log::error!("[MinecraftLauncher] Failed to get ModpackStore token: {}", e);
                    return None;
                }
            };

            // Get or create game session
            let game_session = match tokio::runtime::Runtime::new()
                .unwrap()
                .block_on(async {
                    crate::core::authserver_client::AuthServerClient::get_game_session(
                        &jwt_token,
                        self.instance.ms_nickname.clone(),
                    )
                    .await
                }) {
                Ok(session) => session,
                Err(e) => {
                    log::error!("[MinecraftLauncher] Failed to get game session: {}", e);
                    return None;
                }
            };

            log::info!(
                "[MinecraftLauncher] ModpackStore session created for: {}",
                game_session.username
            );

            // Create MinecraftAccount from game session
            crate::core::minecraft_account::MinecraftAccount::new(
                game_session.username,
                game_session.uuid,
                Some(game_session.access_token),
                "modpackstore".to_string(),
            )
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

        // Add authlib-injector for ModpackStore accounts
        if self.instance.accountUuid.is_none() {
            log::info!("[MinecraftLauncher] Adding authlib-injector for ModpackStore account");
            
            // Get authserver URL
            let authserver_url = match crate::core::authserver_client::AuthServerClient::get_authserver_url() {
                Ok(url) => url,
                Err(e) => {
                    log::error!("[MinecraftLauncher] Failed to get authserver URL: {}", e);
                    return None;
                }
            };

            // Get authlib-injector JVM argument
            let authlib_arg = match tokio::runtime::Runtime::new()
                .unwrap()
                .block_on(async {
                    crate::core::authlib_injector::AuthlibInjector::get_jvm_argument(&authserver_url).await
                }) {
                Ok(arg) => arg,
                Err(e) => {
                    log::error!("[MinecraftLauncher] Failed to setup authlib-injector: {}", e);
                    return None;
                }
            };

            // Insert authlib-injector argument at the beginning of JVM args
            jvm_args.insert(0, authlib_arg);

            // Add compatibility flags
            let compat_flags = crate::core::authlib_injector::AuthlibInjector::get_compatibility_flags();
            for flag in compat_flags.iter().rev() {
                jvm_args.insert(1, flag.clone());
            }

            log::info!("[MinecraftLauncher] authlib-injector configured for: {}", authserver_url);
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

    /// Get ModpackStore JWT access token from auth store
    fn get_modpackstore_jwt_token() -> Result<String, String> {
        // Get app handle
        let app_handle = match crate::GLOBAL_APP_HANDLE.lock() {
            Ok(guard) => match guard.as_ref() {
                Some(handle) => handle.clone(),
                None => return Err("App handle not available".to_string()),
            },
            Err(e) => return Err(format!("Failed to lock app handle: {}", e)),
        };

        // Use blocking runtime to call async function
        let runtime = tokio::runtime::Runtime::new()
            .map_err(|e| format!("Failed to create runtime: {}", e))?;

        runtime.block_on(async {
            match crate::core::auth::get_access_token(app_handle).await {
                Ok(Some(token)) => Ok(token),
                Ok(None) => Err("No access token available. Please log in.".to_string()),
                Err(e) => Err(format!("Failed to get access token: {}", e)),
            }
        })
    }
}
