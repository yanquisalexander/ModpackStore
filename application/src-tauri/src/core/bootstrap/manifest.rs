// src/core/bootstrap/manifest.rs
// Manifest processing functionality extracted from instance_bootstrap.rs

use serde_json::Value;
use tauri_plugin_http::reqwest;

/// Constants for manifest URLs
pub const MOJANG_VERSION_MANIFEST_URL: &str =
    "https://launchermeta.mojang.com/mc/game/version_manifest.json";
pub const FORGE_API_BASE_URL: &str = "https://mc-versions-api.net/api/forge";
pub const CACHE_EXPIRY_MS: u64 = 3600000; // 1 hour

/// Fetches and caches the Mojang version manifest with failover support
pub fn get_version_manifest(
    client: &reqwest::blocking::Client,
    cache: &mut Option<(Value, u64)>,
) -> Result<Value, String> {
    let current_time = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64;

    // Check cache first
    if let Some((cached_manifest, cache_time)) = cache {
        if current_time - *cache_time < CACHE_EXPIRY_MS {
            return Ok(cached_manifest.clone());
        }
    }

    // Fetch new manifest with failover support
    use super::manifest_servers::{fetch_manifest_with_failover, FailoverConfig};

    let config = FailoverConfig::default();
    let manifest = fetch_manifest_with_failover(client, &config).map_err(|e| {
        log::error!("[get_version_manifest] Failed to fetch manifest: {}", e);
        e
    })?;

    // Update cache
    *cache = Some((manifest.clone(), current_time));

    Ok(manifest)
}

/// Gets detailed information for a specific Minecraft version with failover support
pub fn get_version_details(
    client: &reqwest::blocking::Client,
    cache: &mut Option<(Value, u64)>,
    version: &str,
) -> Result<Value, String> {
    // Get the version manifest
    let version_manifest = get_version_manifest(client, cache)?;

    let versions_node = version_manifest["versions"]
        .as_array()
        .ok_or_else(|| "Invalid version manifest format".to_string())?;

    // Find the specific version
    let version_info = versions_node
        .iter()
        .find(|v| v["id"].as_str() == Some(version))
        .ok_or_else(|| format!("Version {} not found in manifest", version))?;

    let version_url = version_info["url"]
        .as_str()
        .ok_or_else(|| "Invalid version info format".to_string())?;

    // Download version details with failover support
    use super::manifest_servers::{fetch_version_json_with_failover, FailoverConfig};

    let config = FailoverConfig::default();
    fetch_version_json_with_failover(client, version_url, &config)
}

/// Extracts Java version requirements from version details
pub fn get_java_version_requirement(version_details: &Value) -> Result<String, String> {
    let java_version = version_details["javaVersion"]
        .as_object()
        .ok_or_else(|| "Java version not found in version details".to_string())?;

    let java_major_version = java_version
        .get("majorVersion")
        .and_then(|v| v.as_u64())
        .map(|v| v.to_string())
        .unwrap_or_else(|| "8".to_string()); // Default to Java 8 if not specified

    Ok(java_major_version)
}

/// Gets download URLs for client/server and version JSON files
pub fn get_download_urls(
    version_details: &Value,
    is_server: bool,
) -> Result<(String, String), String> {
    let jar_type = if is_server { "server" } else { "client" };

    let jar_url = version_details["downloads"][jar_type]["url"]
        .as_str()
        .ok_or_else(|| format!("{} download URL not found", jar_type))?;

    let version_json_url = version_details["url"]
        .as_str()
        .or_else(|| {
            // Try to extract from the downloads section if direct URL not available
            version_details["downloads"][jar_type]["url"].as_str()
        })
        .ok_or_else(|| "Version JSON URL not found".to_string())?;

    Ok((jar_url.to_string(), version_json_url.to_string()))
}

/// Gets asset index information from version details
pub fn get_asset_index_info(version_details: &Value) -> Result<(String, String), String> {
    let asset_index_node = version_details
        .get("assetIndex")
        .ok_or_else(|| "Asset index information not found".to_string())?;

    let assets_index_id = asset_index_node
        .get("id")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Asset index ID not found".to_string())?;

    let assets_index_url = asset_index_node
        .get("url")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Asset index URL not found".to_string())?;

    Ok((assets_index_id.to_string(), assets_index_url.to_string()))
}

/// Builds Forge installer download URL
pub fn build_forge_installer_url(minecraft_version: &str, forge_version: &str) -> String {
    format!(
        "https://maven.minecraftforge.net/net/minecraftforge/forge/{}-{}/forge-{}-{}-installer.jar",
        minecraft_version, forge_version, minecraft_version, forge_version
    )
}

/// Validates a version manifest format
pub fn validate_version_manifest(manifest: &Value) -> Result<(), String> {
    if !manifest.is_object() {
        return Err("Manifest is not a valid JSON object".to_string());
    }

    if !manifest.get("versions").map_or(false, |v| v.is_array()) {
        return Err("Manifest does not contain a valid versions array".to_string());
    }

    Ok(())
}

/// Validates version details format
pub fn validate_version_details(details: &Value) -> Result<(), String> {
    if !details.is_object() {
        return Err("Version details is not a valid JSON object".to_string());
    }

    // Check for required fields
    let required_fields = ["id", "type", "downloads", "libraries"];
    for field in &required_fields {
        if !details.get(field).is_some() {
            return Err(format!("Version details missing required field: {}", field));
        }
    }

    Ok(())
}
