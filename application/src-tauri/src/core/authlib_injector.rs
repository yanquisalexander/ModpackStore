use std::fs;
use std::path::{Path, PathBuf};
use dirs::config_dir;
use log::{info, error, warn};

const AUTHLIB_INJECTOR_VERSION: &str = "1.2.5";
const AUTHLIB_INJECTOR_DOWNLOAD_URL: &str = "https://github.com/yushijinhun/authlib-injector/releases/download/v1.2.5/authlib-injector-1.2.5.jar";
const AUTHLIB_INJECTOR_FILENAME: &str = "authlib-injector-1.2.5.jar";

/// Manages authlib-injector JAR file download and location
pub struct AuthlibInjectorManager {
    jar_path: PathBuf,
}

impl AuthlibInjectorManager {
    /// Create a new AuthlibInjectorManager
    pub fn new() -> Result<Self, String> {
        let config_dir = config_dir()
            .ok_or_else(|| "Failed to get config directory".to_string())?;
        
        let authlib_dir = config_dir
            .join("dev.alexitoo.modpackstore")
            .join("authlib-injector");

        // Ensure directory exists
        if !authlib_dir.exists() {
            fs::create_dir_all(&authlib_dir)
                .map_err(|e| format!("Failed to create authlib-injector directory: {}", e))?;
        }

        let jar_path = authlib_dir.join(AUTHLIB_INJECTOR_FILENAME);

        Ok(Self { jar_path })
    }

    /// Get the path to the authlib-injector JAR file
    pub fn get_jar_path(&self) -> &Path {
        &self.jar_path
    }

    /// Check if authlib-injector JAR exists
    pub fn is_downloaded(&self) -> bool {
        self.jar_path.exists()
    }

    /// Download authlib-injector JAR if not present
    pub async fn ensure_downloaded(&self) -> Result<(), String> {
        if self.is_downloaded() {
            info!("authlib-injector already downloaded at {:?}", self.jar_path);
            return Ok(());
        }

        info!("Downloading authlib-injector from {}", AUTHLIB_INJECTOR_DOWNLOAD_URL);
        
        // Download the JAR file
        let response = reqwest::get(AUTHLIB_INJECTOR_DOWNLOAD_URL)
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
            .map_err(|e| format!("Failed to read authlib-injector response: {}", e))?;

        // Write to file
        fs::write(&self.jar_path, bytes)
            .map_err(|e| format!("Failed to write authlib-injector JAR: {}", e))?;

        info!("authlib-injector downloaded successfully to {:?}", self.jar_path);
        Ok(())
    }

    /// Delete the downloaded JAR (for cleanup or re-download)
    pub fn delete(&self) -> Result<(), String> {
        if self.is_downloaded() {
            fs::remove_file(&self.jar_path)
                .map_err(|e| format!("Failed to delete authlib-injector JAR: {}", e))?;
            info!("authlib-injector JAR deleted");
        }
        Ok(())
    }

    /// Get the version of authlib-injector being managed
    pub fn get_version(&self) -> &str {
        AUTHLIB_INJECTOR_VERSION
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_manager_creation() {
        let manager = AuthlibInjectorManager::new();
        assert!(manager.is_ok());
    }

    #[test]
    fn test_jar_path() {
        let manager = AuthlibInjectorManager::new().unwrap();
        let path = manager.get_jar_path();
        assert!(path.to_str().unwrap().contains("authlib-injector"));
    }
}
