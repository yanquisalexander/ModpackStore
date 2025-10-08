use crate::core::auth::storage;
use crate::core::authlib_injector::AuthlibInjectorManager;
use crate::core::minecraft_account::MinecraftAccount;
use crate::core::minecraft_instance::MinecraftInstance;
use crate::core::modpackstore_auth::{ModpackStoreAuthService, GameSessionResponse};
use crate::GLOBAL_APP_HANDLE;
use std::path::PathBuf;

/// Manages Modpack Store account integration for game launches
pub struct GameSessionManager {
    authlib_manager: AuthlibInjectorManager,
    auth_service: ModpackStoreAuthService,
}

impl GameSessionManager {
    pub fn new() -> Result<Self, String> {
        let authlib_manager = AuthlibInjectorManager::new()?;
        let auth_service = ModpackStoreAuthService::new();

        Ok(Self {
            authlib_manager,
            auth_service,
        })
    }

    /// Check if instance uses Modpack Store account (accountUuid is None)
    pub fn uses_ms_account(instance: &MinecraftInstance) -> bool {
        instance.accountUuid.is_none()
    }

    /// Prepare game session for Modpack Store account
    /// Returns the MinecraftAccount to use for launch and additional JVM args
    pub async fn prepare_game_session(
        &self,
        instance: &MinecraftInstance,
    ) -> Result<(MinecraftAccount, Vec<String>), String> {
        // Ensure authlib-injector is downloaded
        self.authlib_manager.ensure_downloaded().await?;

        // Get JWT token from storage
        let app_handle = {
            let binding = GLOBAL_APP_HANDLE.lock().unwrap();
            binding
                .as_ref()
                .ok_or("AppHandle not initialized")?
                .clone()
        };

        let jwt_token = storage::load_tokens(&app_handle)
            .await
            .map_err(|e| format!("Failed to load auth tokens: {}", e))?
            .ok_or("No authentication tokens found - please log in to Modpack Store")?
            .access_token;

        // Get custom nickname if set
        let custom_nickname = instance.ms_nickname.clone();

        // Authenticate and get game session
        let game_session = self
            .auth_service
            .authenticate(&jwt_token, custom_nickname)
            .await?;

        // Create a temporary MinecraftAccount for this session
        let account = self.create_account_from_session(&game_session);

        // Build JVM arguments for authlib-injector
        let mut jvm_args = Vec::new();

        // Get authserver URL from API endpoint
        let api_endpoint = crate::API_ENDPOINT.to_string();
        
        // Add authlib-injector javaagent
        jvm_args.push(self.authlib_manager.get_jvm_argument(&api_endpoint));

        // Add compatibility arguments
        jvm_args.extend(self.authlib_manager.get_compatibility_arguments());

        log::info!(
            "[GameSessionManager] Created game session for user: {} (UUID: {})",
            account.username(),
            account.uuid()
        );
        log::debug!("[GameSessionManager] Additional JVM args: {:?}", jvm_args);

        Ok((account, jvm_args))
    }

    /// Create a MinecraftAccount from a game session response
    fn create_account_from_session(&self, session: &GameSessionResponse) -> MinecraftAccount {
        MinecraftAccount::new(
            session.selected_profile.name.clone(),
            session.selected_profile.id.clone(),
            Some(session.access_token.clone()),
            "modpackstore".to_string(), // Custom user type for MS accounts
        )
    }

    /// Get the authlib-injector JAR path (for UI display or validation)
    pub fn get_authlib_path(&self) -> &PathBuf {
        self.authlib_manager.get_jar_path()
    }

    /// Check if authlib-injector is already downloaded
    pub fn is_authlib_downloaded(&self) -> bool {
        self.authlib_manager.is_downloaded()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_uses_ms_account() {
        let mut instance = MinecraftInstance::new();
        assert!(GameSessionManager::uses_ms_account(&instance));

        instance.accountUuid = Some("test-uuid".to_string());
        assert!(!GameSessionManager::uses_ms_account(&instance));
    }
}
