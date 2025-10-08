use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::fs;

const AUTHLIB_INJECTOR_VERSION: &str = "1.2.5";
const AUTHLIB_INJECTOR_URL: &str = "https://github.com/yushijinhun/authlib-injector/releases/download/v1.2.5/authlib-injector-1.2.5.jar";

#[derive(Debug, Serialize, Deserialize)]
pub struct YggdrasilAuthResponse {
    #[serde(rename = "accessToken")]
    pub access_token: String,
    #[serde(rename = "clientToken")]
    pub client_token: String,
    #[serde(rename = "availableProfiles")]
    pub available_profiles: Vec<YggdrasilProfile>,
    #[serde(rename = "selectedProfile")]
    pub selected_profile: YggdrasilProfile,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct YggdrasilProfile {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct YggdrasilAuthRequest {
    pub username: Option<String>,
    pub password: String, // This will be the JWT token
    #[serde(rename = "clientToken")]
    pub client_token: Option<String>,
}

pub struct ModpackStoreAuth {
    api_endpoint: String,
}

impl ModpackStoreAuth {
    pub fn new(api_endpoint: String) -> Self {
        Self { api_endpoint }
    }

    /// Authenticate with ModpackStore Yggdrasil server
    pub async fn authenticate(
        &self,
        jwt_token: String,
        username: Option<String>,
    ) -> Result<YggdrasilAuthResponse, String> {
        let client = reqwest::Client::new();
        
        let request_body = YggdrasilAuthRequest {
            username,
            password: jwt_token,
            client_token: None,
        };

        let url = format!("{}/yggdrasil/authenticate", self.api_endpoint);
        
        log::info!("[ModpackStoreAuth] Authenticating with Yggdrasil server: {}", url);
        
        let response = client
            .post(&url)
            .json(&request_body)
            .send()
            .await
            .map_err(|e| format!("Failed to send authentication request: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            log::error!("[ModpackStoreAuth] Authentication failed: {} - {}", status, error_text);
            return Err(format!("Authentication failed: {} - {}", status, error_text));
        }

        let auth_response: YggdrasilAuthResponse = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse authentication response: {}", e))?;

        log::info!("[ModpackStoreAuth] Successfully authenticated as {}", auth_response.selected_profile.name);

        Ok(auth_response)
    }

    /// Get authlib-injector JAR path, downloading if necessary
    pub async fn get_authlib_injector_path(&self, minecraft_path: &Path) -> Result<PathBuf, String> {
        let libraries_dir = minecraft_path.join("libraries").join("authlib-injector");
        let jar_path = libraries_dir.join(format!("authlib-injector-{}.jar", AUTHLIB_INJECTOR_VERSION));

        // Check if already downloaded
        if jar_path.exists() {
            log::info!("[ModpackStoreAuth] authlib-injector already exists at {:?}", jar_path);
            return Ok(jar_path);
        }

        // Create directory if it doesn't exist
        fs::create_dir_all(&libraries_dir)
            .map_err(|e| format!("Failed to create authlib-injector directory: {}", e))?;

        // Download authlib-injector
        log::info!("[ModpackStoreAuth] Downloading authlib-injector from {}", AUTHLIB_INJECTOR_URL);
        
        let client = reqwest::Client::new();
        let response = client
            .get(AUTHLIB_INJECTOR_URL)
            .send()
            .await
            .map_err(|e| format!("Failed to download authlib-injector: {}", e))?;

        if !response.status().is_success() {
            return Err(format!("Failed to download authlib-injector: HTTP {}", response.status()));
        }

        let bytes = response
            .bytes()
            .await
            .map_err(|e| format!("Failed to read authlib-injector bytes: {}", e))?;

        fs::write(&jar_path, bytes)
            .map_err(|e| format!("Failed to write authlib-injector JAR: {}", e))?;

        log::info!("[ModpackStoreAuth] Successfully downloaded authlib-injector to {:?}", jar_path);

        Ok(jar_path)
    }

    /// Build authlib-injector JVM argument
    pub fn build_authlib_injector_arg(&self, jar_path: &Path) -> String {
        let yggdrasil_server_url = format!("{}/yggdrasil", self.api_endpoint);
        format!(
            "-javaagent:{}={}",
            jar_path.to_string_lossy(),
            yggdrasil_server_url
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_authlib_injector_arg() {
        let auth = ModpackStoreAuth::new("https://api.modpackstore.com".to_string());
        let jar_path = Path::new("/path/to/authlib-injector.jar");
        let arg = auth.build_authlib_injector_arg(jar_path);
        
        assert!(arg.starts_with("-javaagent:/path/to/authlib-injector.jar="));
        assert!(arg.contains("https://api.modpackstore.com/yggdrasil"));
    }
}
