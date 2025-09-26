use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Debug, Serialize, Deserialize)]
pub struct MstorepackMetadata {
    pub name: String,
    pub version: String,
    pub modpack_id: Option<String>,
    pub modpack_version_id: Option<String>,
    pub minecraft_version: String,
    pub forge_version: Option<String>,
    pub description: Option<String>,
    pub author: Option<String>,
    pub url: Option<String>,
}

impl MstorepackMetadata {
    /// Validates that the metadata contains required fields
    pub fn validate(&self) -> Result<(), String> {
        if self.name.trim().is_empty() {
            return Err("Modpack name cannot be empty".to_string());
        }
        
        if self.minecraft_version.trim().is_empty() {
            return Err("Minecraft version cannot be empty".to_string());
        }
        
        Ok(())
    }
}

#[tauri::command]
pub async fn process_mstorepack_file(file_path: String) -> Result<MstorepackMetadata, String> {
    log::info!("[MstorepackHandler] Processing .mstorepack file: {}", file_path);

    let path = Path::new(&file_path);
    
    // Verify file exists and has correct extension
    if !path.exists() {
        return Err("File does not exist".to_string());
    }
    
    if !file_path.ends_with(".mstorepack") {
        return Err("Invalid file extension, expected .mstorepack".to_string());
    }

    // Read and parse the JSON content
    let content = fs::read_to_string(path)
        .map_err(|e| format!("Failed to read file: {}", e))?;
    
    let metadata: MstorepackMetadata = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse JSON: {}", e))?;

    // Validate the metadata
    metadata.validate()?;

    log::info!("[MstorepackHandler] Successfully parsed metadata for: {}", metadata.name);
    
    Ok(metadata)
}

#[tauri::command]
pub async fn install_from_mstorepack(metadata: MstorepackMetadata) -> Result<String, String> {
    log::info!("[MstorepackHandler] Starting installation for: {}", metadata.name);
    
    // Validate metadata before starting installation
    metadata.validate()?;
    
    // This would integrate with the existing modpack installation system
    // For now, we'll return a success message indicating the process should start
    
    Ok(format!("Starting installation of modpack: {}", metadata.name))
}