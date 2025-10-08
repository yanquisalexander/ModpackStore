use std::fs::{self, File};
use std::io::Write;
use std::path::{Path, PathBuf};
use tauri_plugin_http::reqwest::Client;

const AUTHLIB_INJECTOR_VERSION: &str = "1.2.5";
const AUTHLIB_INJECTOR_URL: &str = "https://github.com/yushijinhun/authlib-injector/releases/download/v1.2.5/authlib-injector-1.2.5.jar";
const AUTHLIB_INJECTOR_FILENAME: &str = "authlib-injector-1.2.5.jar";

/// Manages authlib-injector JAR file for ModpackStore accounts
pub struct AuthlibInjector;

impl AuthlibInjector {
    /// Get the path where authlib-injector should be stored
    pub fn get_storage_path() -> Result<PathBuf, String> {
        let config_manager_mutex = crate::utils::config_manager::get_config_manager();
        let config_manager = config_manager_mutex
            .lock()
            .map_err(|e| format!("Failed to lock config manager: {}", e))?;

        let libraries_dir = config_manager.get_libraries_dir();
        let authlib_dir = libraries_dir.join("authlib-injector");

        // Create directory if it doesn't exist
        if !authlib_dir.exists() {
            fs::create_dir_all(&authlib_dir)
                .map_err(|e| format!("Failed to create authlib-injector directory: {}", e))?;
        }

        Ok(authlib_dir.join(AUTHLIB_INJECTOR_FILENAME))
    }

    /// Check if authlib-injector is downloaded
    pub fn is_downloaded() -> Result<bool, String> {
        let path = Self::get_storage_path()?;
        Ok(path.exists())
    }

    /// Download authlib-injector if not already present
    pub async fn ensure_downloaded() -> Result<PathBuf, String> {
        let path = Self::get_storage_path()?;

        if path.exists() {
            log::info!("[AuthlibInjector] Already downloaded at: {:?}", path);
            return Ok(path);
        }

        log::info!(
            "[AuthlibInjector] Downloading from: {}",
            AUTHLIB_INJECTOR_URL
        );

        let client = Client::new();
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
            .map_err(|e| format!("Failed to read authlib-injector bytes: {}", e))?;

        let mut file = File::create(&path)
            .map_err(|e| format!("Failed to create authlib-injector file: {}", e))?;

        file.write_all(&bytes)
            .map_err(|e| format!("Failed to write authlib-injector file: {}", e))?;

        log::info!("[AuthlibInjector] Downloaded to: {:?}", path);

        Ok(path)
    }

    /// Get the JVM argument for authlib-injector
    /// 
    /// # Arguments
    /// * `authserver_url` - URL of the authserver (e.g., https://api.modpackstore.com/v1/authserver)
    /// 
    /// # Returns
    /// The JVM argument string to add to the Java command line
    pub async fn get_jvm_argument(authserver_url: &str) -> Result<String, String> {
        let jar_path = Self::ensure_downloaded().await?;
        let jar_path_str = jar_path
            .to_str()
            .ok_or_else(|| "Invalid authlib-injector path".to_string())?;

        Ok(format!("-javaagent:{}={}", jar_path_str, authserver_url))
    }

    /// Get recommended compatibility flags for authlib-injector
    /// These flags ensure compatibility with various Minecraft versions
    pub fn get_compatibility_flags() -> Vec<String> {
        vec![
            // Enable Mojang namespace compatibility
            "-Dauthlibinjector.mojangNamespace=enabled".to_string(),
            // Enable legacy skin polyfill for older versions
            "-Dauthlibinjector.legacySkinPolyfill=enabled".to_string(),
            // Disable profile key check for versions that don't support it
            "-Dauthlibinjector.profileKey=disabled".to_string(),
            // Disable strict username check
            "-Dauthlibinjector.usernameCheck=disabled".to_string(),
        ]
    }
}
