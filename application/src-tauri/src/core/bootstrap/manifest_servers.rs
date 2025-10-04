// src/core/bootstrap/manifest_servers.rs
// Alternative Minecraft launcher meta servers with failover support

use serde_json::Value;
use tauri_plugin_http::reqwest;
use std::time::Duration;

/// List of alternative Minecraft launcher meta servers
/// These servers mirror the official Mojang launcher meta API
pub const MANIFEST_SERVERS: &[&str] = &[
    "https://launchermeta.mojang.com/mc/game/version_manifest.json",           // Official Mojang
    "https://launchermeta.fastmcmirror.org/mc/game/version_manifest.json", // FastMC Mirror
    "https://bmclapi2.bangbang93.com/mc/game/version_manifest.json",           // BMCLAPI (China mirror)
    "https://download.mcbbs.net/mc/game/version_manifest.json",                 // MCBBS (China mirror)
];

/// Configuration for server failover behavior
pub struct FailoverConfig {
    /// Timeout for each server request
    pub timeout: Duration,
    /// Maximum number of retries per server
    pub max_retries_per_server: usize,
}

impl Default for FailoverConfig {
    fn default() -> Self {
        Self {
            timeout: Duration::from_secs(10),
            max_retries_per_server: 1,
        }
    }
}

/// Fetches the version manifest with automatic failover to alternative servers
/// Tries each server in sequence until one succeeds
pub fn fetch_manifest_with_failover(
    client: &reqwest::blocking::Client,
    config: &FailoverConfig,
) -> Result<Value, String> {
    let mut last_error = String::new();

    for server_url in MANIFEST_SERVERS {
        log::info!("[fetch_manifest_with_failover] Trying server: {}", server_url);
        
        for attempt in 0..=config.max_retries_per_server {
            if attempt > 0 {
                log::warn!(
                    "[fetch_manifest_with_failover] Retry attempt {} for server: {}",
                    attempt,
                    server_url
                );
            }

            match fetch_manifest_from_server(client, server_url, config.timeout) {
                Ok(manifest) => {
                    log::info!(
                        "[fetch_manifest_with_failover] Successfully fetched manifest from: {}",
                        server_url
                    );
                    return Ok(manifest);
                }
                Err(e) => {
                    last_error = format!("Server {} failed: {}", server_url, e);
                    log::warn!("[fetch_manifest_with_failover] {}", last_error);
                    
                    // Don't retry immediately, wait a bit before next attempt
                    if attempt < config.max_retries_per_server {
                        std::thread::sleep(Duration::from_millis(500));
                    }
                }
            }
        }
    }

    Err(format!(
        "All manifest servers failed. Last error: {}",
        last_error
    ))
}

/// Fetches manifest from a specific server URL
fn fetch_manifest_from_server(
    client: &reqwest::blocking::Client,
    url: &str,
    timeout: Duration,
) -> Result<Value, reqwest::Error> {
    client
        .get(url)
        .timeout(timeout)
        .send()?
        .error_for_status()?
        .json::<Value>()
}

/// Fetches a specific version's JSON file with failover
/// Converts the URL from the primary server to alternative servers
pub fn fetch_version_json_with_failover(
    client: &reqwest::blocking::Client,
    version_url: &str,
    config: &FailoverConfig,
) -> Result<Value, String> {
    let mut last_error = String::new();

    // Extract the path component from the version URL
    // Example: https://launchermeta.mojang.com/v1/packages/xxx/1.20.1.json
    // We want to try alternative base URLs
    
    let alternative_urls = convert_to_alternative_urls(version_url);
    
    for url in alternative_urls {
        log::info!("[fetch_version_json_with_failover] Trying URL: {}", url);
        
        match fetch_version_json_from_url(client, &url, config.timeout) {
            Ok(json) => {
                log::info!(
                    "[fetch_version_json_with_failover] Successfully fetched version JSON from: {}",
                    url
                );
                return Ok(json);
            }
            Err(e) => {
                last_error = format!("URL {} failed: {}", url, e);
                log::warn!("[fetch_version_json_with_failover] {}", last_error);
            }
        }
    }

    Err(format!(
        "Failed to fetch version JSON from all mirrors. Last error: {}",
        last_error
    ))
}

/// Converts a Mojang URL to alternative mirror URLs
fn convert_to_alternative_urls(mojang_url: &str) -> Vec<String> {
    let mut urls = vec![mojang_url.to_string()]; // Start with original URL
    
    // If it's a Mojang URL, create alternative mirror URLs
    if mojang_url.starts_with("https://launchermeta.mojang.com/") {
        let path = mojang_url.replace("https://launchermeta.mojang.com/", "");
        
        // Add BMCLAPI mirror
        urls.push(format!("https://bmclapi2.bangbang93.com/{}", path));
        
        // Add MCBBS mirror
        urls.push(format!("https://download.mcbbs.net/{}", path));
    }
    
    urls
}

/// Fetches version JSON from a specific URL
fn fetch_version_json_from_url(
    client: &reqwest::blocking::Client,
    url: &str,
    timeout: Duration,
) -> Result<Value, reqwest::Error> {
    client
        .get(url)
        .timeout(timeout)
        .send()?
        .error_for_status()?
        .json::<Value>()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_convert_to_alternative_urls() {
        let mojang_url = "https://launchermeta.mojang.com/v1/packages/abc123/1.20.1.json";
        let urls = convert_to_alternative_urls(mojang_url);
        
        assert_eq!(urls.len(), 3);
        assert_eq!(urls[0], mojang_url);
        assert!(urls[1].contains("bmclapi2.bangbang93.com"));
        assert!(urls[2].contains("download.mcbbs.net"));
    }

    #[test]
    fn test_convert_non_mojang_url() {
        let other_url = "https://example.com/some/path.json";
        let urls = convert_to_alternative_urls(other_url);
        
        assert_eq!(urls.len(), 1);
        assert_eq!(urls[0], other_url);
    }
}
