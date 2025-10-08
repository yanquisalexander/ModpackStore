use crate::core::auth::storage;
use crate::core::minecraft_account::MinecraftAccount;
use crate::GLOBAL_APP_HANDLE;
use crate::API_ENDPOINT;
use log::{error, info, warn};
use serde::{Deserialize, Serialize};
use tauri_plugin_http::reqwest::Client;

/// Response from the Yggdrasil authenticate endpoint
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct YggdrasilAuthResponse {
    pub accessToken: String,
    pub clientToken: String,
    pub availableProfiles: Vec<YggdrasilProfile>,
    pub selectedProfile: YggdrasilProfile,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct YggdrasilProfile {
    pub id: String,
    pub name: String,
}

/// Handles authentication for ModpackStore accounts
pub struct ModpackStoreAuth;

impl ModpackStoreAuth {
    /// Get a game session token from the ModpackStore AuthServer
    /// 
    /// # Arguments
    /// * `profile_name` - The Minecraft username to use (from ms_nickname or user.username)
    /// 
    /// # Returns
    /// A MinecraftAccount with the game session token
    pub async fn get_game_session(profile_name: &str) -> Result<MinecraftAccount, String> {
        info!("[ModpackStoreAuth] Requesting game session for profile: {}", profile_name);

        // Get the app handle
        let app_handle = {
            let binding = GLOBAL_APP_HANDLE.lock().unwrap();
            binding
                .as_ref()
                .ok_or("AppHandle not initialized")?
                .clone()
        };

        // Load ModpackStore JWT tokens
        let tokens = storage::load_tokens(&app_handle)
            .await?
            .ok_or("No authentication tokens found. Please login to ModpackStore first.")?;

        // Call the Yggdrasil authenticate endpoint
        let auth_endpoint = format!("{}/yggdrasil/authenticate?profileName={}", *API_ENDPOINT, profile_name);
        
        let client = Client::new();
        let response = client
            .post(&auth_endpoint)
            .header("Authorization", format!("Bearer {}", tokens.access_token))
            .header("Content-Type", "application/json")
            .body("{}")
            .send()
            .await
            .map_err(|e| format!("Failed to request game session: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());
            return Err(format!(
                "Failed to authenticate with ModpackStore AuthServer (HTTP {}): {}",
                status, error_text
            ));
        }

        let auth_response: YggdrasilAuthResponse = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse authentication response: {}", e))?;

        info!(
            "[ModpackStoreAuth] Game session obtained successfully for profile: {}",
            auth_response.selectedProfile.name
        );

        // Create a MinecraftAccount with the game session token
        // The UUID from ModpackStore is already in the correct format
        Ok(MinecraftAccount::new(
            auth_response.selectedProfile.name,
            Self::format_uuid_with_dashes(&auth_response.selectedProfile.id),
            Some(auth_response.accessToken),
            "modpackstore".to_string(),
        ))
    }

    /// Validate Minecraft username according to Mojang rules
    pub fn is_valid_minecraft_username(username: &str) -> bool {
        if username.len() < 3 || username.len() > 16 {
            return false;
        }
        username.chars().all(|c| c.is_alphanumeric() || c == '_')
    }

    /// Format UUID with dashes (Mojang format)
    /// Input: "550e8400e29b41d4a716446655440000"
    /// Output: "550e8400-e29b-41d4-a716-446655440000"
    fn format_uuid_with_dashes(uuid: &str) -> String {
        if uuid.len() == 32 {
            format!(
                "{}-{}-{}-{}-{}",
                &uuid[0..8],
                &uuid[8..12],
                &uuid[12..16],
                &uuid[16..20],
                &uuid[20..32]
            )
        } else {
            uuid.to_string()
        }
    }

    /// Check if user is authenticated with ModpackStore
    pub async fn is_authenticated() -> bool {
        let app_handle_result = {
            let binding = GLOBAL_APP_HANDLE.lock().unwrap();
            binding.as_ref().cloned()
        };

        if let Some(app_handle) = app_handle_result {
            storage::load_tokens(&app_handle)
                .await
                .ok()
                .flatten()
                .is_some()
        } else {
            false
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_username_validation() {
        assert!(ModpackStoreAuth::is_valid_minecraft_username("Player"));
        assert!(ModpackStoreAuth::is_valid_minecraft_username("Player_123"));
        assert!(ModpackStoreAuth::is_valid_minecraft_username("abc"));
        assert!(!ModpackStoreAuth::is_valid_minecraft_username("ab")); // too short
        assert!(!ModpackStoreAuth::is_valid_minecraft_username("Player-123")); // invalid char
        assert!(!ModpackStoreAuth::is_valid_minecraft_username("ThisIsAReallyLongUsername")); // too long
    }

    #[test]
    fn test_uuid_formatting() {
        let uuid_without_dashes = "550e8400e29b41d4a716446655440000";
        let expected = "550e8400-e29b-41d4-a716-446655440000";
        assert_eq!(
            ModpackStoreAuth::format_uuid_with_dashes(uuid_without_dashes),
            expected
        );

        let uuid_with_dashes = "550e8400-e29b-41d4-a716-446655440000";
        assert_eq!(
            ModpackStoreAuth::format_uuid_with_dashes(uuid_with_dashes),
            uuid_with_dashes
        );
    }
}
