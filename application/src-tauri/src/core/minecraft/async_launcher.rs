use crate::config::get_config_manager;
use crate::core::accounts_manager::AccountsManager;
use crate::core::minecraft::{
    arguments::ArgumentProcessor,
    classpath::ClasspathBuilder,
    manifest::{ManifestMerger, ManifestParser},
    paths::MinecraftPaths,
};
use crate::core::{minecraft_account::MinecraftAccount, minecraft_instance::MinecraftInstance};
use crate::core::modpackstore_auth::ModpackStoreAuth;
use std::path::Path;
use std::process::{Child, Command, Stdio};
use tauri_plugin_store::StoreExt;

pub struct AsyncMinecraftLauncher {
    instance: MinecraftInstance,
    app_handle: tauri::AppHandle,
}

impl AsyncMinecraftLauncher {
    pub fn new(instance: MinecraftInstance, app_handle: tauri::AppHandle) -> Self {
        Self { instance, app_handle }
    }

    pub async fn launch(&self) -> Result<u32, String> {
        // Extract config data before any await to avoid holding locks
        let (mc_memory, paths) = {
            let config_manager = get_config_manager()
                .lock()
                .map_err(|e| format!("Failed to lock config manager: {}", e))?;

            let config = config_manager
                .as_ref()
                .map_err(|e| format!("Failed to get config: {:?}", e))?;

            let mc_memory = config.get_minecraft_memory().unwrap_or_else(|| {
                log::warn!("No Minecraft memory config found, using default 2048MB");
                2048
            });

            // Setup paths before dropping the lock
            let paths = MinecraftPaths::new(&self.instance, config)
                .ok_or_else(|| "Failed to setup Minecraft paths".to_string())?;

            (mc_memory, paths)
        }; // config_manager is dropped here

        log::info!("[AsyncMinecraftLauncher] Config loaded");
        log::info!(
            "[AsyncMinecraftLauncher] Starting {} Minecraft instance",
            self.instance.instanceName
        );

        log::info!("Minecraft memory: {}MB", mc_memory);

        // Get or create account
        let account = self.get_or_create_account().await?;

        log::info!(
            "[AsyncMinecraftLauncher] Launching Minecraft using account: {}",
            account.username()
        );

        log::info!("[AsyncMinecraftLauncher] Minecraft paths: {:?}", paths);
        log::info!("[AsyncMinecraftLauncher] Java path: {:?}", paths.java_path());

        // Load and merge manifests
        let manifest_parser = ManifestParser::new(&paths);
        let manifest_json = manifest_parser
            .load_merged_manifest()
            .map_err(|e| format!("Failed to load manifest: {}", e))?;

        log::info!("[AsyncMinecraftLauncher] Manifest loaded");

        // Build classpath
        let classpath_builder = ClasspathBuilder::new(&manifest_json, &paths);
        let classpath_str = classpath_builder
            .build()
            .map_err(|e| format!("Failed to build classpath: {}", e))?;

        log::info!("[AsyncMinecraftLauncher] Classpath: {}", classpath_str);

        // Process arguments
        let argument_processor =
            ArgumentProcessor::new(&manifest_json, &account, &paths, mc_memory);
        let (mut jvm_args, game_args) = argument_processor
            .process_arguments()
            .map_err(|e| format!("Failed to process arguments: {}", e))?;

        // Add authlib-injector if using ModpackStore auth
        if self.instance.accountUuid.is_none() {
            let authlib_arg = self.get_authlib_injector_arg(&paths).await?;
            // Insert authlib-injector as the first JVM argument
            jvm_args.insert(0, authlib_arg);
            log::info!("[AsyncMinecraftLauncher] Added authlib-injector to JVM arguments");
        }

        // Get main class
        let main_class = manifest_json
            .get("mainClass")
            .and_then(|v| v.as_str())
            .ok_or_else(|| "No mainClass found in manifest".to_string())?;

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

        let child = command
            .spawn()
            .map_err(|e| format!("Failed to launch Minecraft: {}", e))?;

        let pid = child.id();
        log::info!(
            "[AsyncMinecraftLauncher] Minecraft process started successfully with PID: {}",
            pid
        );

        Ok(pid)
    }

    async fn get_or_create_account(&self) -> Result<MinecraftAccount, String> {
        match &self.instance.accountUuid {
            Some(uuid) => {
                // Use existing account (Microsoft or Offline)
                let accounts_manager = AccountsManager::new();
                accounts_manager
                    .get_minecraft_account_by_uuid(uuid)
                    .ok_or_else(|| format!("Account with UUID {} not found", uuid))
            }
            None => {
                // No account UUID - use ModpackStore auth
                log::info!("[AsyncMinecraftLauncher] Using ModpackStore authentication");

                // Get JWT token from store using the proper function
                let access_token = crate::core::instance_manager::get_access_token()
                    .await
                    .map_err(|e| format!("Failed to get access token: {}", e))?
                    .ok_or_else(|| "No access token found in store".to_string())?;

                // Create ModpackStore auth client
                let api_endpoint = crate::API_ENDPOINT.to_string();
                let ms_auth = ModpackStoreAuth::new(api_endpoint);

                // Get username (ms_nickname if set, otherwise default from session)
                let username = self.instance.ms_nickname.clone();

                // Authenticate with Yggdrasil server
                let auth_response = ms_auth
                    .authenticate(access_token, username)
                    .await
                    .map_err(|e| format!("Failed to authenticate with ModpackStore: {}", e))?;

                // Create temporary MinecraftAccount
                let account = MinecraftAccount::new(
                    auth_response.selected_profile.name,
                    auth_response.selected_profile.id,
                    Some(auth_response.access_token),
                    "modpackstore".to_string(),
                );

                log::info!(
                    "[AsyncMinecraftLauncher] Created ModpackStore account: {}",
                    account.username()
                );

                Ok(account)
            }
        }
    }

    async fn get_authlib_injector_arg(&self, paths: &MinecraftPaths) -> Result<String, String> {
        let api_endpoint = crate::API_ENDPOINT.to_string();
        let ms_auth = ModpackStoreAuth::new(api_endpoint.clone());

        // Get Minecraft directory from paths
        let minecraft_dir = paths.game_dir().parent()
            .ok_or_else(|| "Failed to get Minecraft directory".to_string())?;

        // Download authlib-injector if necessary
        let jar_path = ms_auth
            .get_authlib_injector_path(minecraft_dir)
            .await?;

        // Build the JVM argument
        Ok(ms_auth.build_authlib_injector_arg(&jar_path))
    }
}

#[tauri::command]
pub async fn launch_minecraft_async(
    instance_id: String,
    app_handle: tauri::AppHandle,
) -> Result<u32, String> {
    log::info!("[launch_minecraft_async] Launching instance: {}", instance_id);

    // Load instance
    let instance = MinecraftInstance::from_instance_id(&instance_id)
        .ok_or_else(|| format!("Instance {} not found", instance_id))?;

    // Create async launcher
    let launcher = AsyncMinecraftLauncher::new(instance, app_handle);

    // Launch
    launcher.launch().await
}
