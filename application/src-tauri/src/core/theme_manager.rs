use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ThemeColors {
    pub background: String,
    pub foreground: String,
    pub card: String,
    pub card_foreground: String,
    pub popover: String,
    pub popover_foreground: String,
    pub primary: String,
    pub primary_foreground: String,
    pub secondary: String,
    pub secondary_foreground: String,
    pub muted: String,
    pub muted_foreground: String,
    pub accent: String,
    pub accent_foreground: String,
    pub destructive: String,
    pub border: String,
    pub input: String,
    pub ring: String,
    pub chart1: String,
    pub chart2: String,
    pub chart3: String,
    pub chart4: String,
    pub chart5: String,
    pub sidebar: String,
    pub sidebar_foreground: String,
    pub sidebar_primary: String,
    pub sidebar_primary_foreground: String,
    pub sidebar_accent: String,
    pub sidebar_accent_foreground: String,
    pub sidebar_border: String,
    pub sidebar_ring: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ThemeMetadata {
    pub id: String,
    pub name: String,
    pub description: String,
    pub author: String,
    pub version: String,
    #[serde(default)]
    pub is_premium: bool,
    #[serde(default)]
    pub is_external: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Theme {
    pub metadata: ThemeMetadata,
    pub colors: ThemeColors,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ThemeDefinition {
    pub metadata: ThemeMetadata,
    pub colors: ThemeColors,
    pub file_path: Option<String>,
}

// Internal themes embedded in the binary
const DARK_THEME: &str = include_str!("../../src/themes/dark.json");
const ICE_THEME: &str = include_str!("../../src/themes/ice.json");
const DARK_KNIGHT_THEME: &str = include_str!("../../src/themes/dark-knight.json");

/// Load all available themes (internal + external)
#[tauri::command]
pub async fn get_available_themes(app: tauri::AppHandle) -> Result<Vec<ThemeDefinition>, String> {
    let mut themes = Vec::new();

    // Load internal themes
    let internal_themes = vec![
        ("dark", DARK_THEME),
        ("ice", ICE_THEME),
        ("dark-knight", DARK_KNIGHT_THEME),
    ];

    for (id, theme_str) in internal_themes {
        match serde_json::from_str::<Theme>(theme_str) {
            Ok(theme) => {
                themes.push(ThemeDefinition {
                    metadata: theme.metadata,
                    colors: theme.colors,
                    file_path: None,
                });
            }
            Err(e) => {
                log::error!("Error loading internal theme {}: {}", id, e);
            }
        }
    }

    // Load external themes from app data directory
    if let Some(external_themes) = load_external_themes(&app).await {
        themes.extend(external_themes);
    }

    Ok(themes)
}

/// Get a specific theme by ID
#[tauri::command]
pub async fn get_theme_by_id(
    app: tauri::AppHandle,
    theme_id: String,
) -> Result<ThemeDefinition, String> {
    let themes = get_available_themes(app).await?;
    themes
        .into_iter()
        .find(|t| t.metadata.id == theme_id)
        .ok_or_else(|| format!("Theme '{}' not found", theme_id))
}

/// Apply a theme by setting it in the configuration
#[tauri::command]
pub async fn apply_theme(theme_id: String) -> Result<(), String> {
    use crate::config::set_config;
    set_config("theme".to_string(), serde_json::json!(theme_id))
        .map_err(|e| format!("Error applying theme: {}", e))
}

/// Get the current active theme
#[tauri::command]
pub async fn get_current_theme(app: tauri::AppHandle) -> Result<ThemeDefinition, String> {
    use crate::config::get_config_value;

    let theme_id = get_config_value("theme".to_string())
        .and_then(|v| v.as_str().map(|s| s.to_string()))
        .unwrap_or_else(|| "dark".to_string());

    get_theme_by_id(app, theme_id).await
}

/// Load external themes from the app data directory
async fn load_external_themes(app: &tauri::AppHandle) -> Option<Vec<ThemeDefinition>> {
    let app_data_dir = app.path().app_data_dir().ok()?;
    let themes_dir = app_data_dir.join("themes");

    if !themes_dir.exists() {
        if let Err(e) = fs::create_dir_all(&themes_dir) {
            log::error!("Failed to create themes directory: {}", e);
            return None;
        }
    }

    let mut external_themes = Vec::new();

    if let Ok(entries) = fs::read_dir(themes_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) == Some("json") {
                match fs::read_to_string(&path) {
                    Ok(content) => match serde_json::from_str::<Theme>(&content) {
                        Ok(mut theme) => {
                            theme.metadata.is_external = true;
                            external_themes.push(ThemeDefinition {
                                metadata: theme.metadata,
                                colors: theme.colors,
                                file_path: Some(path.to_string_lossy().to_string()),
                            });
                        }
                        Err(e) => {
                            log::error!("Error parsing theme file {:?}: {}", path, e);
                        }
                    },
                    Err(e) => {
                        log::error!("Error reading theme file {:?}: {}", path, e);
                    }
                }
            }
        }
    }

    Some(external_themes)
}

/// Import an external theme from a file
#[tauri::command]
pub async fn import_theme(app: tauri::AppHandle, file_path: String) -> Result<String, String> {
    let source_path = PathBuf::from(&file_path);

    if !source_path.exists() {
        return Err("Theme file does not exist".to_string());
    }

    // Read and validate the theme file
    let content =
        fs::read_to_string(&source_path).map_err(|e| format!("Error reading theme file: {}", e))?;

    let theme: Theme =
        serde_json::from_str(&content).map_err(|e| format!("Invalid theme file format: {}", e))?;

    // Get the app data directory and create themes folder if needed
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;
    let themes_dir = app_data_dir.join("themes");

    if !themes_dir.exists() {
        fs::create_dir_all(&themes_dir)
            .map_err(|e| format!("Failed to create themes directory: {}", e))?;
    }

    // Copy theme file to themes directory
    let dest_path = themes_dir.join(format!("{}.json", theme.metadata.id));
    fs::copy(&source_path, &dest_path).map_err(|e| format!("Error copying theme file: {}", e))?;

    Ok(theme.metadata.id)
}

/// Delete an external theme
#[tauri::command]
pub async fn delete_theme(app: tauri::AppHandle, theme_id: String) -> Result<(), String> {
    let theme = get_theme_by_id(app.clone(), theme_id.clone()).await?;

    if !theme.metadata.is_external {
        return Err("Cannot delete internal themes".to_string());
    }

    if let Some(file_path) = theme.file_path {
        fs::remove_file(&file_path).map_err(|e| format!("Error deleting theme file: {}", e))?;
    }

    Ok(())
}

/// Open the themes directory in the system file explorer
#[tauri::command]
pub async fn open_themes_directory(app: tauri::AppHandle) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;

    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;
    let themes_dir = app_data_dir.join("themes");

    if !themes_dir.exists() {
        fs::create_dir_all(&themes_dir)
            .map_err(|e| format!("Failed to create themes directory: {}", e))?;
    }

    app.opener()
        .open_path(&themes_dir, None::<&str>)
        .map_err(|e| format!("Failed to open themes directory: {}", e))?;

    Ok(())
}
