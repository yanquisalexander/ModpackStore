use crate::config::get_config_manager;
use crate::core::accounts_manager::AccountsManager;
use crate::core::auth::storage;
use crate::core::authlib_injector::AuthlibInjectorManager;
use crate::core::modpackstore_auth::ModpackStoreAuthService;
use crate::core::minecraft::{
    arguments::ArgumentProcessor,
    classpath::ClasspathBuilder,
    manifest::{ManifestMerger, ManifestParser},
    paths::MinecraftPaths,
};
use crate::core::{minecraft_account::MinecraftAccount, minecraft_instance::MinecraftInstance};
use crate::interfaces::game_launcher::GameLauncher;
use crate::GLOBAL_APP_HANDLE;
use std::process::{Child, Command, Stdio};
use uuid::Uuid;

pub struct MinecraftLauncher {
    instance: MinecraftInstance,
    /// Optional override account for MS account sessions
    pub override_account: Option<MinecraftAccount>,
    /// Additional JVM arguments (e.g., for authlib-injector)
    pub additional_jvm_args: Vec<String>,
}

impl MinecraftLauncher {
    pub fn new(instance: MinecraftInstance) -> Self {
        Self {
            instance,
            override_account: None,
            additional_jvm_args: Vec::new(),
        }
    }

    /// Create launcher with MS account session data
    pub fn with_ms_account(
        instance: MinecraftInstance,
        account: MinecraftAccount,
        jvm_args: Vec<String>,
    ) -> Self {
        Self {
            instance,
            override_account: Some(account),
            additional_jvm_args: jvm_args,
        }
    }

    /// Get or create a MinecraftAccount for launching
    /// If accountUuid is None, creates a temporary MS account with game session
    fn get_launch_account(&self) -> Option<MinecraftAccount> {
        // If we have an override account (from MS session), use that
        if let Some(ref account) = self.override_account {
            return Some(account.clone());
        }

        // If instance has an accountUuid, use that account
        if let Some(account_uuid) = &self.instance.accountUuid {
            let accounts_manager = AccountsManager::new();
            return accounts_manager.get_minecraft_account_by_uuid(account_uuid);
        }

        // Otherwise, use Modpack Store account
        // This requires async operations, so we need to handle it differently
        // For now, return None and handle this case in the async launcher
        log::warn!("[MinecraftLauncher] Instance has no accountUuid - MS account launch not yet implemented in sync context");
        None
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

        // Get account - either from account manager or MS account
        let account = self.get_launch_account()?;

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

        // Inject additional JVM arguments (e.g., for authlib-injector)
        if !self.additional_jvm_args.is_empty() {
            log::info!(
                "[MinecraftLauncher] Adding {} additional JVM arguments",
                self.additional_jvm_args.len()
            );
            // Insert at the beginning (before main JVM args but after -Xmx/-Xms)
            // Find where to insert (after memory args)
            let insert_pos = jvm_args
                .iter()
                .position(|arg| !arg.starts_with("-Xm"))
                .unwrap_or(jvm_args.len());
            
            for (i, arg) in self.additional_jvm_args.iter().enumerate() {
                jvm_args.insert(insert_pos + i, arg.clone());
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
