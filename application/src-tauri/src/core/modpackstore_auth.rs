use crate::core::clients::HTTP_CLIENT;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

#[derive(Debug)]
struct AuthLibVersion {
    version: &'static str,
    url: &'static str,
    min_java_version: u32,
}

const AUTHLIB_VERSIONS: &[AuthLibVersion] = &[
    AuthLibVersion {
        version: "1.2.6",
        url: "https://github.com/yushijinhun/authlib-injector/releases/download/v1.2.6/authlib-injector-1.2.6.jar",
        min_java_version: 11,
    },
    AuthLibVersion {
        version: "1.2.5",
        url: "https://github.com/yushijinhun/authlib-injector/releases/download/v1.2.5/authlib-injector-1.2.5.jar",
        min_java_version: 8,
    },
];

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
    #[serde(rename = "minecraftUuid", skip_serializing_if = "Option::is_none")]
    pub minecraft_uuid: Option<String>,
}

pub struct ModpackStoreAuth {
    api_endpoint: String,
}

impl ModpackStoreAuth {
    pub fn new(api_endpoint: String) -> Self {
        Self { api_endpoint }
    }

    /// Detect Java version by running 'java -version'
    fn detect_java_version() -> Result<u32, String> {
        let mut command = Command::new("java");
        command.arg("-version");

        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x08000000;
            command.creation_flags(CREATE_NO_WINDOW);
        }

        let output = command
            .output()
            .map_err(|e| format!("Failed to run java -version: {}", e))?;

        let stderr = String::from_utf8_lossy(&output.stderr);

        // Parse version from output like "java version "1.8.0_XXX"" or "openjdk version "17.0.1""
        if let Some(version_line) = stderr.lines().find(|line| line.contains("version")) {
            if let Some(quote_start) = version_line.find('"') {
                if let Some(quote_end) = version_line[quote_start + 1..].find('"') {
                    let version_str = &version_line[quote_start + 1..quote_start + 1 + quote_end];

                    // Parse major version (e.g., "1.8.0_XXX" -> 8, "17.0.1" -> 17)
                    if let Some(dot_pos) = version_str.find('.') {
                        let major_str = &version_str[..dot_pos];
                        if major_str == "1" {
                            // Java 8 and below format: 1.8.0_XXX
                            if let Some(second_dot) = version_str[dot_pos + 1..].find('.') {
                                let minor_str = &version_str[dot_pos + 1..dot_pos + 1 + second_dot];
                                return minor_str.parse::<u32>().map_err(|e| {
                                    format!("Failed to parse Java minor version: {}", e)
                                });
                            }
                        } else {
                            // Java 9+ format: 17.0.1, 11.0.2, etc.
                            return major_str
                                .parse::<u32>()
                                .map_err(|e| format!("Failed to parse Java major version: {}", e));
                        }
                    }
                }
            }
        }

        Err("Could not parse Java version from output".to_string())
    }

    /// Select appropriate AuthLib Injector version based on Java version
    fn select_authlib_version(java_version: u32) -> &'static AuthLibVersion {
        // Find the highest version that is compatible with the Java version
        for version in AUTHLIB_VERSIONS {
            if java_version >= version.min_java_version {
                return version;
            }
        }

        // Fallback to the oldest version if no compatible version found
        &AUTHLIB_VERSIONS[AUTHLIB_VERSIONS.len() - 1]
    }

    /// Authenticate with ModpackStore Yggdrasil server
    pub async fn authenticate(
        &self,
        jwt_token: String,
        username: Option<String>,
        minecraft_uuid: Option<String>,
    ) -> Result<YggdrasilAuthResponse, String> {
        let client = &*HTTP_CLIENT;

        let request_body = YggdrasilAuthRequest {
            username,
            password: jwt_token,
            client_token: None,
            minecraft_uuid,
        };

        let url = format!("{}/yggdrasil/authenticate", self.api_endpoint);

        log::info!(
            "[ModpackStoreAuth] Authenticating with Yggdrasil server: {}",
            url
        );

        let response = client
            .post(&url)
            .json(&request_body)
            .send()
            .await
            .map_err(|e| format!("Failed to send authentication request: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            log::error!(
                "[ModpackStoreAuth] Authentication failed: {} - {}",
                status,
                error_text
            );
            return Err(format!(
                "Authentication failed: {} - {}",
                status, error_text
            ));
        }

        let auth_response: YggdrasilAuthResponse = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse authentication response: {}", e))?;

        log::info!(
            "[ModpackStoreAuth] Successfully authenticated as {}",
            auth_response.selected_profile.name
        );

        Ok(auth_response)
    }

    /// Get authlib-injector JAR path, downloading if necessary
    pub async fn get_authlib_injector_path(
        &self,
        minecraft_path: &Path,
    ) -> Result<PathBuf, String> {
        let java_version = Self::detect_java_version()
            .map_err(|e| format!("Failed to detect Java version: {}", e))?;
        let authlib_version = Self::select_authlib_version(java_version);

        let libraries_dir = minecraft_path.join("libraries").join("authlib-injector");
        let jar_path =
            libraries_dir.join(format!("authlib-injector-{}.jar", authlib_version.version));

        // Check if already downloaded
        if jar_path.exists() {
            log::info!(
                "[ModpackStoreAuth] authlib-injector already exists at {:?}",
                jar_path
            );
            return Ok(jar_path);
        }

        // Create directory if it doesn't exist
        fs::create_dir_all(&libraries_dir)
            .map_err(|e| format!("Failed to create authlib-injector directory: {}", e))?;

        // Download authlib-injector
        log::info!(
            "[ModpackStoreAuth] Downloading authlib-injector {} (compatible with Java {}) from {}",
            authlib_version.version,
            java_version,
            authlib_version.url
        );

        let client = &*HTTP_CLIENT;
        let response = client
            .get(authlib_version.url)
            .send()
            .await
            .map_err(|e| format!("Failed to download authlib-injector: {}", e))?;

        if !response.status().is_success() {
            return Err(format!(
                "Failed to download authlib-injector: HTTP {}",
                response.status()
            ));
        }

        let bytes = response
            .bytes()
            .await
            .map_err(|e| format!("Failed to read authlib-injector bytes: {}", e))?;

        fs::write(&jar_path, bytes)
            .map_err(|e| format!("Failed to write authlib-injector JAR: {}", e))?;

        log::info!(
            "[ModpackStoreAuth] Successfully downloaded authlib-injector {} to {:?}",
            authlib_version.version,
            jar_path
        );

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
