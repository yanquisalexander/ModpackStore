use crate::API_ENDPOINT;
use serde::{Deserialize, Serialize};
use tauri_plugin_http::reqwest::Client;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GameSessionResponse {
    pub data: GameSessionData,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GameSessionData {
    #[serde(rename = "accessToken")]
    pub access_token: String,
    #[serde(rename = "clientToken")]
    pub client_token: String,
    pub username: String,
    pub uuid: String,
}

#[derive(Debug, Serialize)]
struct GameSessionRequest {
    token: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    nickname: Option<String>,
}

/// AuthServer client for communicating with ModpackStore AuthServer
pub struct AuthServerClient;

impl AuthServerClient {
    /// Get or create a game session for the current user
    /// 
    /// # Arguments
    /// * `jwt_token` - ModpackStore JWT access token
    /// * `nickname` - Optional custom nickname for this session
    /// 
    /// # Returns
    /// GameSessionData with access token, client token, username and UUID
    pub async fn get_game_session(
        jwt_token: &str,
        nickname: Option<String>,
    ) -> Result<GameSessionData, String> {
        let api_endpoint = match API_ENDPOINT.lock() {
            Ok(guard) => guard.clone(),
            Err(e) => return Err(format!("Failed to get API endpoint: {}", e)),
        };

        let client = Client::new();
        let url = format!("{}/v1/authserver/gamesession", api_endpoint);

        let request_body = GameSessionRequest {
            token: jwt_token.to_string(),
            nickname,
        };

        log::info!("[AuthServerClient] Requesting game session from: {}", url);

        let response = client
            .post(&url)
            .json(&request_body)
            .send()
            .await
            .map_err(|e| format!("Failed to send request: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());
            return Err(format!(
                "AuthServer request failed with status {}: {}",
                status, error_text
            ));
        }

        let session_response: GameSessionResponse = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse response: {}", e))?;

        log::info!(
            "[AuthServerClient] Game session created for user: {}",
            session_response.data.username
        );

        Ok(session_response.data)
    }

    /// Get the authserver URL for authlib-injector
    pub fn get_authserver_url() -> Result<String, String> {
        let api_endpoint = match API_ENDPOINT.lock() {
            Ok(guard) => guard.clone(),
            Err(e) => return Err(format!("Failed to get API endpoint: {}", e)),
        };

        Ok(format!("{}/v1/authserver", api_endpoint))
    }
}
