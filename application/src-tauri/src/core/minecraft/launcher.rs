use crate::config::get_config_manager;
use crate::core::accounts_manager::AccountsManager;
use crate::core::authlib_injector::AuthlibInjectorManager;
use crate::core::modpackstore_auth::ModpackStoreAuth;
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

    /// Resolves which account to use for the instance
    /// Returns (account, authlib_injector_path)
    async fn resolve_account(&self) -> Option<(MinecraftAccount, Option<String>)> {
        match &self.instance.accountUuid {
            // If accountUuid is set, use the account from AccountsManager
            Some(uuid) => {
                let accounts_manager = AccountsManager::new();
                let account = accounts_manager.get_minecraft_account_by_uuid(uuid)?;
                log::info!(
                    "[MinecraftLauncher] Using account from AccountManager: {}",
                    account.username()
                );
                Some((account, None))
            }
            // If accountUuid is null, use ModpackStore account
            None => {
                log::info!("[MinecraftLauncher] No account UUID set, using ModpackStore account");
                
                // Determine profile name: use ms_nickname if set, otherwise user's username
                // The actual username will come from the server based on the user's JWT
                let profile_name = self.instance.ms_nickname.as_ref()
                    .map(|s| s.as_str())
                    .unwrap_or("Player"); // Fallback, will be replaced by server

                // Validate profile name
                if !ModpackStoreAuth::is_valid_minecraft_username(profile_name) {
                    log::error!(
                        "[MinecraftLauncher] Invalid ms_nickname: {}. Must be 3-16 alphanumeric characters.",
                        profile_name
                    );
                    return None;
                }

                // Get game session from ModpackStore AuthServer
                let account = match Self::get_modpackstore_account_blocking(profile_name) {
                    Ok(acc) => acc,
                    Err(e) => {
                        log::error!("[MinecraftLauncher] Failed to get ModpackStore game session: {}", e);
                        return None;
                    }
                };

                log::info!(
                    "[MinecraftLauncher] Using ModpackStore account: {}",
                    account.username()
                );

                // Ensure authlib-injector is downloaded
                let authlib_manager = match AuthlibInjectorManager::new() {
                    Ok(mgr) => mgr,
                    Err(e) => {
                        log::error!("[MinecraftLauncher] Failed to initialize authlib-injector manager: {}", e);
                        return None;
                    }
                };

                if let Err(e) = Self::ensure_authlib_downloaded_blocking(&authlib_manager) {
                    log::error!("[MinecraftLauncher] Failed to download authlib-injector: {}", e);
                    return None;
                }

                let authlib_path = authlib_manager.get_jar_path().to_string_lossy().to_string();
                log::info!("[MinecraftLauncher] authlib-injector path: {}", authlib_path);

                Some((account, Some(authlib_path)))
            }
        }
    }

    /// Blocking wrapper for async get_game_session
    fn get_modpackstore_account_blocking(profile_name: &str) -> Result<MinecraftAccount, String> {
        let runtime = tokio::runtime::Runtime::new()
            .map_err(|e| format!("Failed to create tokio runtime: {}", e))?;
        runtime.block_on(ModpackStoreAuth::get_game_session(profile_name))
    }

    /// Blocking wrapper for async ensure_downloaded
    fn ensure_authlib_downloaded_blocking(authlib_manager: &AuthlibInjectorManager) -> Result<(), String> {
        let runtime = tokio::runtime::Runtime::new()
            .map_err(|e| format!("Failed to create tokio runtime: {}", e))?;
        runtime.block_on(authlib_manager.ensure_downloaded())
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

        // Resolve account (Microsoft/Offline or ModpackStore)
        let runtime = tokio::runtime::Runtime::new().ok()?;
        let (account, authlib_injector_path) = runtime.block_on(self.resolve_account())?;

        log::info!(
            "[MinecraftLauncher] Launching Minecraft using account: {} (type: {})",
            account.username(),
            account.user_type()
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

        // Add authlib-injector if using ModpackStore account
        if let Some(authlib_path) = authlib_injector_path {
            let authlib_arg = format!("-javaagent:{}={}/yggdrasil", authlib_path, *crate::API_ENDPOINT);
            log::info!("[MinecraftLauncher] Adding authlib-injector argument: {}", authlib_arg);
            jvm_args.insert(0, authlib_arg);
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
