use crate::core::instance_manager::get_instance_by_id;
use crate::core::minecraft_instance::MinecraftInstance;
use crate::API_ENDPOINT;
use anyhow::Context;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use tokio::io::AsyncReadExt;

fn toml_value_to_json(val: toml::Value) -> serde_json::Value {
    match val {
        toml::Value::String(s) => serde_json::Value::String(s),
        toml::Value::Integer(i) => serde_json::json!(i),
        toml::Value::Float(f) => serde_json::json!(f),
        toml::Value::Boolean(b) => serde_json::Value::Bool(b),
        toml::Value::Datetime(d) => serde_json::Value::String(d.to_string()),
        toml::Value::Array(arr) => {
            serde_json::Value::Array(arr.into_iter().map(toml_value_to_json).collect())
        }
        toml::Value::Table(table) => {
            let map: serde_json::Map<String, serde_json::Value> = table
                .into_iter()
                .map(|(k, v)| (k, toml_value_to_json(v)))
                .collect();
            serde_json::Value::Object(map)
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LogoPosition {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub top: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub left: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub right: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bottom: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub transform: Option<String>,

    // Captura campos desconocidos
    #[serde(flatten)]
    #[serde(skip_serializing)]
    pub unknown_fields: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Logo {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub height: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub position: Option<LogoPosition>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fade_in_duration: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fade_in_delay: Option<String>,

    // Captura campos desconocidos
    #[serde(flatten)]
    #[serde(skip_serializing)]
    pub unknown_fields: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayButtonPosition {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub top: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub left: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub right: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bottom: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub transform: Option<String>,

    // Captura campos desconocidos
    #[serde(flatten)]
    #[serde(skip_serializing)]
    pub unknown_fields: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayButton {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub background_color: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hover_color: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text_color: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub border_color: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub position: Option<PlayButtonPosition>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fade_in_duration: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fade_in_delay: Option<String>,

    // Captura campos desconocidos
    #[serde(flatten)]
    #[serde(skip_serializing)]
    pub unknown_fields: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Background {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub image_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub video_url: Option<Vec<String>>,

    // Captura campos desconocidos
    #[serde(flatten)]
    #[serde(skip_serializing)]
    pub unknown_fields: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Audio {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub volume: Option<f32>,

    // Captura campos desconocidos
    #[serde(flatten)]
    #[serde(skip_serializing)]
    pub unknown_fields: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewsPosition {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub top: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub right: Option<String>,

    // Captura campos desconocidos
    #[serde(flatten)]
    #[serde(skip_serializing)]
    pub unknown_fields: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewsStyle {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub background: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub border_radius: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub padding: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub width: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub font_size: Option<String>,

    // Captura campos desconocidos
    #[serde(flatten)]
    #[serde(skip_serializing)]
    pub unknown_fields: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Entry {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content: Option<String>,

    // Captura campos desconocidos
    #[serde(flatten)]
    #[serde(skip_serializing)]
    pub unknown_fields: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct News {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub position: Option<NewsPosition>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub style: Option<NewsStyle>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub entries: Option<Vec<Entry>>,

    // Captura campos desconocidos
    #[serde(flatten)]
    #[serde(skip_serializing)]
    pub unknown_fields: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FooterStyle {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub background: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub border_radius: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub padding: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub width: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub font_size: Option<String>,

    // Captura campos desconocidos
    #[serde(flatten)]
    #[serde(skip_serializing)]
    pub unknown_fields: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomBlockPosition {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub top: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub left: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub right: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bottom: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub transform: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub z_index: Option<f64>,

    // Captura campos desconocidos
    #[serde(flatten)]
    #[serde(skip_serializing)]
    pub unknown_fields: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomBlock {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub class_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tag_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub style: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub render_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub position: Option<CustomBlockPosition>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<CustomBlock>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub z_index: Option<f64>,

    // Captura campos desconocidos
    #[serde(flatten)]
    #[serde(skip_serializing)]
    pub unknown_fields: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct PreLaunchDefaults {
    #[serde(default)]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub use_modpack_store_auth: Option<bool>,

    // Captura campos desconocidos
    #[serde(flatten)]
    #[serde(skip_serializing)]
    pub unknown_fields: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PreLaunchAppearance {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub defaults: Option<PreLaunchDefaults>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub logo: Option<Logo>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub play_button: Option<PlayButton>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub background: Option<Background>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub audio: Option<Audio>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub news: Option<News>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub footer_style: Option<FooterStyle>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub footer_text: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub custom_blocks: Option<Vec<CustomBlock>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub loading_indicator: Option<LoadingIndicator>,

    // Captura campos desconocidos
    #[serde(flatten)]
    #[serde(skip_serializing)]
    pub unknown_fields: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoadingIndicatorPosition {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub top: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub left: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub right: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bottom: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub transform: Option<String>,

    // Captura campos desconocidos
    #[serde(flatten)]
    #[serde(skip_serializing)]
    pub unknown_fields: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoadingIndicator {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub style: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub position: Option<LoadingIndicatorPosition>,

    // Captura campos desconocidos
    #[serde(flatten)]
    #[serde(skip_serializing)]
    pub unknown_fields: HashMap<String, serde_json::Value>,
}

use std::io::Result;
use tokio::fs::File;
use tokio::io::BufReader;

// Función auxiliar para registrar campos desconocidos
fn log_unknown_fields(parent_name: &str, unknown_fields: &HashMap<String, serde_json::Value>) {
    if !unknown_fields.is_empty() {
        for field in unknown_fields.keys() {
            log::info!("Unsupported attribute for {}: {}", parent_name, field);
        }
    }
}

#[tauri::command]
pub async fn get_prelaunch_appearance(instance_id: String) -> Option<PreLaunchAppearance> {
    let instance = get_instance_by_id(instance_id.clone()).ok()??;
    let instance_dir = instance.instanceDirectory?;

    let instance_path = PathBuf::from(instance_dir);

    // Try TOML first, then fall back to JSON for legacy instances
    let toml_path = instance_path.join("prelaunch_appearance.toml");
    let json_path = instance_path.join("prelaunch_appearance.json");

    let (contents, format) = if tokio::fs::metadata(&toml_path).await.is_ok() {
        let mut file = File::open(&toml_path).await.ok()?;
        let mut contents = Vec::new();
        file.read_to_end(&mut contents).await.ok()?;
        (contents, "toml")
    } else if tokio::fs::metadata(&json_path).await.is_ok() {
        let mut file = File::open(&json_path).await.ok()?;
        let mut contents = Vec::new();
        file.read_to_end(&mut contents).await.ok()?;
        (contents, "json")
    } else {
        log::error!(
            "Prelaunch appearance file not found for instance: {:?}",
            instance_id
        );
        return None;
    };

    log::info!(
        "Reading prelaunch appearance as {} from instance: {:?}",
        format,
        instance_id
    );

    let result = if format == "toml" {
        let toml_str = String::from_utf8_lossy(&contents);
        match toml::from_str::<toml::Value>(&toml_str) {
            Ok(toml_val) => {
                let json_val = toml_value_to_json(toml_val);
                let json_bytes = serde_json::to_vec(&json_val).ok()?;
                serde_json::from_slice::<PreLaunchAppearance>(&json_bytes)
            }
            Err(e) => {
                log::error!("Failed to parse prelaunch_appearance.toml: {:?}", e);
                return None;
            }
        }
    } else {
        serde_json::from_slice::<PreLaunchAppearance>(&contents)
    };

    match result {
        Ok(data) => {
            log_unknown_fields("prelaunch_appearance", &data.unknown_fields);

            if let Some(defaults) = &data.defaults {
                log_unknown_fields("defaults", &defaults.unknown_fields);
            }

            if let Some(logo) = &data.logo {
                log_unknown_fields("logo", &logo.unknown_fields);
                if let Some(position) = &logo.position {
                    log_unknown_fields("logo.position", &position.unknown_fields);
                }
            }

            if let Some(play_button) = &data.play_button {
                log_unknown_fields("play_button", &play_button.unknown_fields);
                if let Some(position) = &play_button.position {
                    log_unknown_fields("play_button.position", &position.unknown_fields);
                }
            }

            if let Some(background) = &data.background {
                log_unknown_fields("background", &background.unknown_fields);
            }

            if let Some(audio) = &data.audio {
                log_unknown_fields("audio", &audio.unknown_fields);
            }

            if let Some(news) = &data.news {
                log_unknown_fields("news", &news.unknown_fields);
                if let Some(position) = &news.position {
                    log_unknown_fields("news.position", &position.unknown_fields);
                }
                if let Some(style) = &news.style {
                    log_unknown_fields("news.style", &style.unknown_fields);
                }
                if let Some(entries) = &news.entries {
                    for (i, entry) in entries.iter().enumerate() {
                        log_unknown_fields(&format!("news.entries[{}]", i), &entry.unknown_fields);
                    }
                }
            }

            if let Some(footer_style) = &data.footer_style {
                log_unknown_fields("footer_style", &footer_style.unknown_fields);
            }

            if let Some(custom_blocks) = &data.custom_blocks {
                for (i, custom_block) in custom_blocks.iter().enumerate() {
                    log_unknown_fields(
                        &format!("custom_blocks[{}]", i),
                        &custom_block.unknown_fields,
                    );
                    if let Some(position) = &custom_block.position {
                        log_unknown_fields(
                            &format!("custom_blocks[{}].position", i),
                            &position.unknown_fields,
                        );
                    }
                    if let Some(children) = &custom_block.children {
                        for (j, child) in children.iter().enumerate() {
                            log_unknown_fields(
                                &format!("custom_blocks[{}].children[{}]", i, j),
                                &child.unknown_fields,
                            );
                            if let Some(child_position) = &child.position {
                                log_unknown_fields(
                                    &format!("custom_blocks[{}].children[{}].position", i, j),
                                    &child_position.unknown_fields,
                                );
                            }
                        }
                    }
                }
            }

            if let Some(loading_indicator) = &data.loading_indicator {
                log_unknown_fields("loading_indicator", &loading_indicator.unknown_fields);
                if let Some(position) = &loading_indicator.position {
                    log_unknown_fields("loading_indicator.position", &position.unknown_fields);
                }
            }

            Some(data)
        }
        Err(e) => {
            log::error!("Failed to parse prelaunch_appearance ({}): {:?}", format, e);
            None
        }
    }
}

/// Fetch prelaunch appearance from the ModpackStore API
async fn fetch_prelaunch_appearance_from_api(
    modpack_id: &str,
) -> std::result::Result<Option<PreLaunchAppearance>, String> {
    let url = format!(
        "{}/explore/modpacks/{}/prelaunch-appearance",
        *API_ENDPOINT, modpack_id
    );
    log::info!("Fetching prelaunch appearance from API: {}", url);

    match reqwest::get(&url).await {
        Ok(response) => {
            if response.status().is_success() {
                let response_text = response
                    .text()
                    .await
                    .map_err(|e| format!("Failed to read response: {}", e))?;

                #[derive(Deserialize)]
                struct ApiResponse {
                    data: Option<ApiData>,
                }

                #[derive(Deserialize)]
                struct ApiData {
                    attributes: Option<PreLaunchAppearance>,
                }

                let api_response: ApiResponse = serde_json::from_str(&response_text)
                    .map_err(|e| format!("Failed to parse API response: {}", e))?;

                match api_response.data {
                    Some(data) => Ok(data.attributes),
                    None => Ok(None),
                }
            } else if response.status() == 404 {
                log::info!("Prelaunch appearance not found for modpack: {}", modpack_id);
                Ok(None)
            } else {
                log::warn!(
                    "API returned error for modpack {}: {}",
                    modpack_id,
                    response.status()
                );
                Ok(None) // Return None instead of error to allow offline mode
            }
        }
        Err(e) => {
            log::warn!(
                "Network error fetching prelaunch appearance for modpack {}: {}",
                modpack_id,
                e
            );
            Ok(None) // Return None instead of error to allow offline mode
        }
    }
}

/// Save prelaunch appearance to the instance directory as TOML
async fn save_prelaunch_appearance(
    instance_dir: &PathBuf,
    appearance: &PreLaunchAppearance,
) -> std::result::Result<(), String> {
    let prelaunch_appearance_path = instance_dir.join("prelaunch_appearance.toml");

    let toml_content = toml::to_string_pretty(appearance)
        .map_err(|e| format!("Failed to serialize prelaunch appearance to TOML: {}", e))?;

    tokio::fs::write(&prelaunch_appearance_path, toml_content)
        .await
        .map_err(|e| format!("Failed to save prelaunch appearance: {}", e))?;

    log::info!(
        "Saved prelaunch appearance to: {:?}",
        prelaunch_appearance_path
    );
    Ok(())
}

/// Fetch and save prelaunch appearance for a modpack instance
#[tauri::command]
pub async fn fetch_and_save_prelaunch_appearance(
    modpack_id: String,
    instance_id: String,
) -> std::result::Result<bool, String> {
    log::info!(
        "Fetching prelaunch appearance for modpack: {}, instance: {}",
        modpack_id,
        instance_id
    );

    // Get the instance to find its directory
    let instance = get_instance_by_id(instance_id.clone())
        .map_err(|e| format!("Failed to get instance: {}", e))?
        .ok_or_else(|| "Instance not found".to_string())?;

    let instance_dir = instance
        .instanceDirectory
        .ok_or_else(|| "Instance directory not set".to_string())?;

    let instance_dir_path = PathBuf::from(instance_dir);

    // Fetch from API
    match fetch_prelaunch_appearance_from_api(&modpack_id).await {
        Ok(Some(appearance)) => {
            // Save to local file
            save_prelaunch_appearance(&instance_dir_path, &appearance).await?;
            Ok(true)
        }
        Ok(None) => {
            log::info!(
                "No prelaunch appearance available for modpack: {} (could be offline mode)",
                modpack_id
            );
            Ok(false)
        }
        Err(e) => {
            // This should not happen anymore since we handle errors in fetch_prelaunch_appearance_from_api
            log::error!("Unexpected error fetching prelaunch appearance: {}", e);
            Ok(false) // Return false instead of error to continue in offline mode
        }
    }
}

/// Update prelaunch appearance for an instance (fetch latest from API)
#[tauri::command]
pub async fn update_prelaunch_appearance(instance_id: String) -> std::result::Result<bool, String> {
    log::info!(
        "Updating prelaunch appearance for instance: {}",
        instance_id
    );

    // Get the instance to find the modpack ID
    let instance = get_instance_by_id(instance_id.clone())
        .map_err(|e| format!("Failed to get instance: {}", e))?
        .ok_or_else(|| "Instance not found".to_string())?;

    let modpack_id = instance
        .modpackId
        .ok_or_else(|| "Instance is not a modpack instance".to_string())?;

    // Use the fetch and save function
    fetch_and_save_prelaunch_appearance(modpack_id, instance_id).await
}
