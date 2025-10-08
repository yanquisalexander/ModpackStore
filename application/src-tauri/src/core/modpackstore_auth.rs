use crate::API_ENDPOINT;
use serde::{Deserialize, Serialize};
use tauri_plugin_http::reqwest::Client;

#[derive(Debug, Serialize, Deserialize)]
pub struct GameSessionRequest {
    pub username: Option<String>, // Custom nickname if set
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GameSessionResponse {
    #[serde(rename = "accessToken")]
    pub access_token: String,
    #[serde(rename = "clientToken")]
    pub client_token: String,
    #[serde(rename = "availableProfiles")]
    pub available_profiles: Vec<GameProfile>,
    #[serde(rename = "selectedProfile")]
    pub selected_profile: GameProfile,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GameProfile {
    pub id: String,
    pub name: String,
}

/// Service for managing Modpack Store game authentication
pub struct ModpackStoreAuthService {
    client: Client,
    api_endpoint: String,
}

impl ModpackStoreAuthService {
    pub fn new() -> Self {
        Self {
            client: Client::new(),
            api_endpoint: API_ENDPOINT.to_string(),
        }
    }

    /// Authenticate and get a game session token
    /// Requires a valid Modpack Store JWT token
    pub async fn authenticate(
        &self,
        jwt_token: &str,
        custom_nickname: Option<String>,
    ) -> Result<GameSessionResponse, String> {
        let url = format!("{}/authserver/authenticate", self.api_endpoint);

        let mut body = serde_json::json!({});
        if let Some(nickname) = custom_nickname {
            body["username"] = serde_json::json!(nickname);
        }

        let response = self
            .client
            .post(&url)
            .bearer_auth(jwt_token)
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("Failed to authenticate with authserver: {}", e))?;

        if !response.status().is_success() {
            let error_text = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());
            return Err(format!("Authentication failed: {}", error_text));
        }

        response
            .json::<GameSessionResponse>()
            .await
            .map_err(|e| format!("Failed to parse authentication response: {}", e))
    }

    /// Validate a game session token
    pub async fn validate(&self, access_token: &str, client_token: &str) -> Result<bool, String> {
        let url = format!("{}/authserver/validate", self.api_endpoint);

        let body = serde_json::json!({
            "accessToken": access_token,
            "clientToken": client_token,
        });

        let response = self
            .client
            .post(&url)
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("Failed to validate session: {}", e))?;

        Ok(response.status().is_success())
    }

    /// Refresh a game session token
    pub async fn refresh(
        &self,
        access_token: &str,
        client_token: &str,
    ) -> Result<GameSessionResponse, String> {
        let url = format!("{}/authserver/refresh", self.api_endpoint);

        let body = serde_json::json!({
            "accessToken": access_token,
            "clientToken": client_token,
        });

        let response = self
            .client
            .post(&url)
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("Failed to refresh session: {}", e))?;

        if !response.status().is_success() {
            let error_text = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());
            return Err(format!("Refresh failed: {}", error_text));
        }

        response
            .json::<GameSessionResponse>()
            .await
            .map_err(|e| format!("Failed to parse refresh response: {}", e))
    }

    /// Invalidate a game session (logout)
    pub async fn invalidate(&self, access_token: &str, client_token: &str) -> Result<(), String> {
        let url = format!("{}/authserver/invalidate", self.api_endpoint);

        let body = serde_json::json!({
            "accessToken": access_token,
            "clientToken": client_token,
        });

        let response = self
            .client
            .post(&url)
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("Failed to invalidate session: {}", e))?;

        if response.status().is_success() {
            Ok(())
        } else {
            Err(format!("Failed to invalidate session: {}", response.status()))
        }
    }
}
