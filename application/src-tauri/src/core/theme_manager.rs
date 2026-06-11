use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThemeColors {
    pub background: Option<String>,
    pub foreground: Option<String>,
    pub card: Option<String>,
    #[serde(rename = "cardForeground")]
    pub card_foreground: Option<String>,
    pub popover: Option<String>,
    #[serde(rename = "popoverForeground")]
    pub popover_foreground: Option<String>,
    pub primary: Option<String>,
    #[serde(rename = "primaryForeground")]
    pub primary_foreground: Option<String>,
    pub secondary: Option<String>,
    #[serde(rename = "secondaryForeground")]
    pub secondary_foreground: Option<String>,
    pub muted: Option<String>,
    #[serde(rename = "mutedForeground")]
    pub muted_foreground: Option<String>,
    pub accent: Option<String>,
    #[serde(rename = "accentForeground")]
    pub accent_foreground: Option<String>,
    pub destructive: Option<String>,
    pub border: Option<String>,
    pub input: Option<String>,
    pub ring: Option<String>,
    pub chart1: Option<String>,
    pub chart2: Option<String>,
    pub chart3: Option<String>,
    pub chart4: Option<String>,
    pub chart5: Option<String>,
    pub sidebar: Option<String>,
    #[serde(rename = "sidebarForeground")]
    pub sidebar_foreground: Option<String>,
    #[serde(rename = "sidebarPrimary")]
    pub sidebar_primary: Option<String>,
    #[serde(rename = "sidebarPrimaryForeground")]
    pub sidebar_primary_foreground: Option<String>,
    #[serde(rename = "sidebarAccent")]
    pub sidebar_accent: Option<String>,
    #[serde(rename = "sidebarAccentForeground")]
    pub sidebar_accent_foreground: Option<String>,
    #[serde(rename = "sidebarBorder")]
    pub sidebar_border: Option<String>,
    #[serde(rename = "sidebarRing")]
    pub sidebar_ring: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExternalThemeManifest {
    pub id: String,
    pub name: String,
    pub description: String,
    pub author: String,
    pub version: String,
    #[serde(rename = "isPremium")]
    pub is_premium: Option<bool>,
    pub colors: ThemeColors,
    #[serde(rename = "customProperties")]
    pub custom_properties: Option<serde_json::Value>,
    #[serde(rename = "backgroundImage")]
    pub background_image: Option<String>,
    #[serde(rename = "fontFamily")]
    pub font_family: Option<String>,
    #[serde(rename = "jsFile")]
    pub js_file: Option<String>,
}

/// Get the themes directory path
fn get_themes_directory() -> Result<PathBuf, String> {
    let app_data_dir = dirs::data_local_dir()
        .ok_or_else(|| "No se pudo obtener el directorio de datos de la aplicación".to_string())?;

    let themes_dir = app_data_dir
        .join("dev.alexitoo.modpackstore")
        .join("themes");

    // Create directory if it doesn't exist
    if !themes_dir.exists() {
        fs::create_dir_all(&themes_dir)
            .map_err(|e| format!("Error al crear directorio de temas: {}", e))?;
    }

    Ok(themes_dir)
}

/// Load external themes from the themes directory
#[tauri::command]
pub async fn get_external_themes() -> Result<Vec<ExternalThemeManifest>, String> {
    let themes_dir = get_themes_directory()?;
    let mut themes = Vec::new();

    // Read all subdirectories in the themes directory
    let entries = fs::read_dir(&themes_dir)
        .map_err(|e| format!("Error al leer directorio de temas: {}", e))?;

    for entry in entries {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };

        let path = entry.path();
        if !path.is_dir() {
            continue;
        }

        // Look for theme.json in the directory
        let manifest_path = path.join("theme.json");
        if !manifest_path.exists() {
            continue;
        }

        // Read and parse the manifest
        match fs::read_to_string(&manifest_path) {
            Ok(content) => {
                match serde_json::from_str::<ExternalThemeManifest>(&content) {
                    Ok(mut manifest) => {
                        // If background image is specified, resolve the path
                        if let Some(bg_image) = &manifest.background_image {
                            if !bg_image.starts_with("http") {
                                let bg_path = path.join(bg_image);
                                if bg_path.exists() {
                                    // Convert to file URL
                                    manifest.background_image =
                                        Some(format!("file://{}", bg_path.display()));
                                }
                            }
                        }

                        themes.push(manifest);
                    }
                    Err(e) => {
                        log::warn!("Error al parsear tema en {:?}: {}", manifest_path, e);
                        continue;
                    }
                }
            }
            Err(e) => {
                log::warn!(
                    "Error al leer manifiesto de tema en {:?}: {}",
                    manifest_path,
                    e
                );
                continue;
            }
        }
    }

    Ok(themes)
}

/// Get the themes directory path as a string
#[tauri::command]
pub async fn get_themes_directory_path() -> Result<String, String> {
    let themes_dir = get_themes_directory()?;
    Ok(themes_dir.to_string_lossy().to_string())
}
