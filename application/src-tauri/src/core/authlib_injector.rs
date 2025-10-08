use std::fs;
use std::io::Write;
use std::path::PathBuf;
use dirs::config_dir;
use tauri_plugin_http::reqwest;

const AUTHLIB_INJECTOR_VERSION: &str = "1.2.5";
const AUTHLIB_INJECTOR_URL: &str = "https://github.com/yushijinhun/authlib-injector/releases/download/v1.2.5/authlib-injector-1.2.5.jar";

/// Manages authlib-injector JAR file for Modpack Store authentication
pub struct AuthlibInjectorManager {
    authlib_path: PathBuf,
}

impl AuthlibInjectorManager {
    pub fn new() -> Result<Self, String> {
        let config_path = config_dir()
            .ok_or_else(|| "Could not determine config directory".to_string())?;
        
        let authlib_dir = config_path.join("ModpackStore").join("authlib-injector");
        
        fs::create_dir_all(&authlib_dir)
            .map_err(|e| format!("Failed to create authlib-injector directory: {}", e))?;
        
        let authlib_path = authlib_dir.join(format!("authlib-injector-{}.jar", AUTHLIB_INJECTOR_VERSION));
        
        Ok(Self { authlib_path })
    }

    /// Get the path to the authlib-injector JAR file
    pub fn get_jar_path(&self) -> &PathBuf {
        &self.authlib_path
    }

    /// Check if authlib-injector is already downloaded
    pub fn is_downloaded(&self) -> bool {
        self.authlib_path.exists() && self.authlib_path.is_file()
    }

    /// Download authlib-injector if not already present
    pub async fn ensure_downloaded(&self) -> Result<(), String> {
        if self.is_downloaded() {
            log::info!("authlib-injector already downloaded at {:?}", self.authlib_path);
            return Ok(());
        }

        log::info!("Downloading authlib-injector from {}", AUTHLIB_INJECTOR_URL);
        
        let client = reqwest::Client::new();
        let response = client
            .get(AUTHLIB_INJECTOR_URL)
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
            .map_err(|e| format!("Failed to read authlib-injector response: {}", e))?;

        let mut file = fs::File::create(&self.authlib_path)
            .map_err(|e| format!("Failed to create authlib-injector file: {}", e))?;

        file.write_all(&bytes)
            .map_err(|e| format!("Failed to write authlib-injector file: {}", e))?;

        log::info!("authlib-injector downloaded successfully to {:?}", self.authlib_path);
        Ok(())
    }

    /// Get the JVM argument string for authlib-injector
    pub fn get_jvm_argument(&self, authserver_url: &str) -> String {
        format!(
            "-javaagent:{}={}",
            self.authlib_path.to_string_lossy(),
            authserver_url
        )
    }

    /// Get additional compatibility JVM arguments
    pub fn get_compatibility_arguments(&self) -> Vec<String> {
        vec![
            // Enable Mojang namespace for better compatibility
            "-Dauthlibinjector.mojangNamespace=true".to_string(),
            // Enable legacy skin polyfill for older MC versions
            "-Dauthlibinjector.legacySkinPolyfill=true".to_string(),
            // Disable profile key for compatibility (not using signed chat)
            "-Dauthlibinjector.profileKey=false".to_string(),
            // Disable username check for custom nicknames
            "-Dauthlibinjector.usernameCheck=false".to_string(),
        ]
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_authlib_manager_creation() {
        let manager = AuthlibInjectorManager::new();
        assert!(manager.is_ok());
    }

    #[test]
    fn test_jvm_argument_format() {
        let manager = AuthlibInjectorManager::new().unwrap();
        let arg = manager.get_jvm_argument("https://example.com/authserver");
        assert!(arg.starts_with("-javaagent:"));
        assert!(arg.contains("https://example.com/authserver"));
    }
}
