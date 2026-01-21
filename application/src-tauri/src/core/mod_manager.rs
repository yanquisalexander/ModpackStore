// src-tauri/src/core/mod_manager.rs
use crate::core::minecraft_instance::MinecraftInstance;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModFile {
    #[serde(rename = "fileName")]
    pub file_name: String,
    #[serde(rename = "filePath")]
    pub file_path: String,
    pub size: u64,
    #[serde(rename = "isEnabled")]
    pub is_enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModrinthSearchResult {
    pub project_id: String,
    pub slug: String,
    pub title: String,
    pub description: String,
    pub categories: Vec<String>,
    pub client_side: String,
    pub server_side: String,
    pub downloads: u64,
    pub icon_url: Option<String>,
    pub author: String,
    pub latest_version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModrinthVersion {
    pub id: String,
    pub version_number: String,
    pub name: String,
    pub game_versions: Vec<String>,
    pub loaders: Vec<String>,
    pub files: Vec<ModrinthFile>,
    pub date_published: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModrinthFile {
    pub url: String,
    pub filename: String,
    pub primary: bool,
    pub size: u64,
}

/// Get the mods directory for an instance
fn get_mods_directory(instance: &MinecraftInstance) -> Result<PathBuf, String> {
    let instance_dir = instance
        .instanceDirectory
        .as_ref()
        .ok_or("Instance directory not found")?;

    let mods_dir = Path::new(instance_dir).join("minecraft").join("mods");

    // Create mods directory if it doesn't exist
    if !mods_dir.exists() {
        fs::create_dir_all(&mods_dir)
            .map_err(|e| format!("Failed to create mods directory: {}", e))?;
    }

    Ok(mods_dir)
}

/// List all mods in an instance
#[tauri::command]
pub async fn list_instance_mods(instance_id: String) -> Result<Vec<ModFile>, String> {
    let instance = MinecraftInstance::from_instance_id(&instance_id).ok_or("Instance not found")?;

    let mods_dir = get_mods_directory(&instance)?;

    let mut mods = Vec::new();

    // Read all files in mods directory
    let entries =
        fs::read_dir(&mods_dir).map_err(|e| format!("Failed to read mods directory: {}", e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();

        // Only include .jar files and disabled mods (.jar.disabled)
        if path.is_file() {
            let file_name = path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("")
                .to_string();

            let is_jar = file_name.ends_with(".jar");
            let is_disabled = file_name.ends_with(".jar.disabled");

            if is_jar || is_disabled {
                let metadata = fs::metadata(&path)
                    .map_err(|e| format!("Failed to read file metadata: {}", e))?;

                mods.push(ModFile {
                    file_name: file_name.clone(),
                    file_path: path.to_string_lossy().to_string(),
                    size: metadata.len(),
                    is_enabled: is_jar,
                });
            }
        }
    }

    // Sort by name
    mods.sort_by(|a, b| a.file_name.to_lowercase().cmp(&b.file_name.to_lowercase()));

    Ok(mods)
}

/// Delete a mod from an instance
#[tauri::command]
pub async fn delete_instance_mod(instance_id: String, mod_file_name: String) -> Result<(), String> {
    let instance = MinecraftInstance::from_instance_id(&instance_id).ok_or("Instance not found")?;

    let mods_dir = get_mods_directory(&instance)?;
    let mod_path = mods_dir.join(&mod_file_name);

    if !mod_path.exists() {
        return Err(format!("Mod file not found: {}", mod_file_name));
    }

    fs::remove_file(&mod_path).map_err(|e| format!("Failed to delete mod: {}", e))?;

    Ok(())
}

/// Toggle a mod (enable/disable) by renaming it
#[tauri::command]
pub async fn toggle_instance_mod(
    instance_id: String,
    mod_file_name: String,
    enable: bool,
) -> Result<(), String> {
    let instance = MinecraftInstance::from_instance_id(&instance_id).ok_or("Instance not found")?;

    let mods_dir = get_mods_directory(&instance)?;
    let old_path = mods_dir.join(&mod_file_name);

    if !old_path.exists() {
        return Err(format!("Mod file not found: {}", mod_file_name));
    }

    let new_name = if enable {
        // Remove .disabled extension
        if mod_file_name.ends_with(".jar.disabled") {
            mod_file_name.trim_end_matches(".disabled").to_string()
        } else {
            return Err("Mod is already enabled".to_string());
        }
    } else {
        // Add .disabled extension
        if mod_file_name.ends_with(".jar") {
            format!("{}.disabled", mod_file_name)
        } else {
            return Err("Mod is already disabled".to_string());
        }
    };

    let new_path = mods_dir.join(&new_name);

    fs::rename(&old_path, &new_path).map_err(|e| format!("Failed to rename mod: {}", e))?;

    Ok(())
}

/// Open the mods folder in the file explorer
#[tauri::command]
pub async fn open_instance_mods_folder(instance_id: String) -> Result<(), String> {
    let instance = MinecraftInstance::from_instance_id(&instance_id).ok_or("Instance not found")?;

    let mods_dir = get_mods_directory(&instance)?;

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&mods_dir)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&mods_dir)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&mods_dir)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }

    Ok(())
}

/// Search mods on Modrinth
#[tauri::command]
pub async fn search_modrinth_mods(
    query: String,
    minecraft_version: String,
    loader_type: String,
) -> Result<Vec<ModrinthSearchResult>, String> {
    let client = reqwest::Client::new();

    // Build facets for filtering
    let facets = format!(
        "[[\"project_type:mod\"],[\"versions:{}\"],[\"categories:{}\"]]",
        minecraft_version,
        loader_type.to_lowercase()
    );

    let url = format!(
        "https://api.modrinth.com/v2/search?query={}&facets={}&limit=20",
        urlencoding::encode(&query),
        urlencoding::encode(&facets)
    );

    let response = client
        .get(&url)
        .header("User-Agent", "ModpackStore/1.0")
        .send()
        .await
        .map_err(|e| format!("Failed to search mods: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Modrinth API error: {}", response.status()));
    }

    let json: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    let hits = json["hits"].as_array().ok_or("Invalid response format")?;

    let mut results = Vec::new();

    for hit in hits {
        results.push(ModrinthSearchResult {
            project_id: hit["project_id"].as_str().unwrap_or("").to_string(),
            slug: hit["slug"].as_str().unwrap_or("").to_string(),
            title: hit["title"].as_str().unwrap_or("Unknown").to_string(),
            description: hit["description"].as_str().unwrap_or("").to_string(),
            categories: hit["categories"]
                .as_array()
                .map(|arr| {
                    arr.iter()
                        .filter_map(|v| v.as_str().map(String::from))
                        .collect()
                })
                .unwrap_or_default(),
            client_side: hit["client_side"].as_str().unwrap_or("unknown").to_string(),
            server_side: hit["server_side"].as_str().unwrap_or("unknown").to_string(),
            downloads: hit["downloads"].as_u64().unwrap_or(0),
            icon_url: hit["icon_url"].as_str().map(String::from),
            author: hit["author"].as_str().unwrap_or("Unknown").to_string(),
            latest_version: hit["latest_version"].as_str().map(String::from),
        });
    }

    Ok(results)
}

/// Get versions of a specific mod from Modrinth
#[tauri::command]
pub async fn get_modrinth_mod_versions(
    project_id: String,
    minecraft_version: String,
    loader_type: String,
) -> Result<Vec<ModrinthVersion>, String> {
    let client = reqwest::Client::new();

    let url = format!(
        "https://api.modrinth.com/v2/project/{}/version?game_versions=[\"{}\"]&loaders=[\"{}\"]",
        project_id,
        minecraft_version,
        loader_type.to_lowercase()
    );

    let response = client
        .get(&url)
        .header("User-Agent", "ModpackStore/1.0")
        .send()
        .await
        .map_err(|e| format!("Failed to fetch versions: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Modrinth API error: {}", response.status()));
    }

    let json: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    let versions_array = json.as_array().ok_or("Invalid response format")?;

    let mut versions = Vec::new();

    for version in versions_array {
        let files: Vec<ModrinthFile> = version["files"]
            .as_array()
            .unwrap_or(&Vec::new())
            .iter()
            .map(|file| ModrinthFile {
                url: file["url"].as_str().unwrap_or("").to_string(),
                filename: file["filename"].as_str().unwrap_or("").to_string(),
                primary: file["primary"].as_bool().unwrap_or(false),
                size: file["size"].as_u64().unwrap_or(0),
            })
            .collect();

        versions.push(ModrinthVersion {
            id: version["id"].as_str().unwrap_or("").to_string(),
            version_number: version["version_number"].as_str().unwrap_or("").to_string(),
            name: version["name"].as_str().unwrap_or("").to_string(),
            game_versions: version["game_versions"]
                .as_array()
                .map(|arr| {
                    arr.iter()
                        .filter_map(|v| v.as_str().map(String::from))
                        .collect()
                })
                .unwrap_or_default(),
            loaders: version["loaders"]
                .as_array()
                .map(|arr| {
                    arr.iter()
                        .filter_map(|v| v.as_str().map(String::from))
                        .collect()
                })
                .unwrap_or_default(),
            files,
            date_published: version["date_published"].as_str().unwrap_or("").to_string(),
        });
    }

    Ok(versions)
}

/// Download a mod file to an instance
#[tauri::command]
pub async fn download_mod_to_instance(
    instance_id: String,
    download_url: String,
    file_name: String,
) -> Result<(), String> {
    let instance = MinecraftInstance::from_instance_id(&instance_id).ok_or("Instance not found")?;

    let mods_dir = get_mods_directory(&instance)?;
    let output_path = mods_dir.join(&file_name);

    // Check if file already exists
    if output_path.exists() {
        return Err(format!(
            "Mod '{}' already exists in this instance",
            file_name
        ));
    }

    let client = reqwest::Client::new();

    let response = client
        .get(&download_url)
        .header("User-Agent", "ModpackStore/1.0")
        .send()
        .await
        .map_err(|e| format!("Failed to download mod: {}", e))?;

    if !response.status().is_success() {
        return Err(format!(
            "Download failed with status: {}",
            response.status()
        ));
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Failed to read download: {}", e))?;

    fs::write(&output_path, bytes).map_err(|e| format!("Failed to save mod file: {}", e))?;

    Ok(())
}
