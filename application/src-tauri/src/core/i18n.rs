// src/core/i18n.rs
// Internationalization system for Modpack Store

use crate::{GLOBAL_APP_HANDLE, API_ENDPOINT};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;
use tauri::Emitter;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct I18nData {
    pub language: String,
    pub messages: HashMap<String, Value>,
}

#[derive(Debug)]
pub struct I18nManager {
    translations: RwLock<HashMap<String, I18nData>>,
    current_language: RwLock<String>,
    i18n_dir: PathBuf,
}

impl I18nManager {
    pub fn new() -> Result<Self, String> {
        let i18n_dir = PathBuf::from("resources").join("i18n");

        let manager = Self {
            translations: RwLock::new(HashMap::new()),
            current_language: RwLock::new("en".to_string()), // Temporary default
            i18n_dir,
        };

        // Detect system language and set as current
        let detected_language = manager.detect_system_language();
        {
            let mut current = manager.current_language.try_write().map_err(|_| "Failed to acquire write lock")?;
            *current = detected_language;
        }

        Ok(manager)
    }

    /// Load a language file and cache it
    pub async fn load_language(&self, language: &str) -> Result<I18nData, String> {
        // Check if already loaded
        {
            let translations = self.translations.read().await;
            if let Some(data) = translations.get(language) {
                return Ok(data.clone());
            }
        }

        // Load from file
        let file_path = self.i18n_dir.join(format!("{}.yml", language));
        if !file_path.exists() {
            return Err(format!("Language file not found: {}", file_path.display()));
        }

        let content = fs::read_to_string(&file_path)
            .map_err(|e| format!("Failed to read language file: {}", e))?;

        // Parse YAML to JSON
        let messages: HashMap<String, Value> = serde_yaml::from_str(&content)
            .map_err(|e| format!("Failed to parse YAML: {}", e))?;

        let data = I18nData {
            language: language.to_string(),
            messages,
        };

        // Cache the translation
        {
            let mut translations = self.translations.write().await;
            translations.insert(language.to_string(), data.clone());
        }

        Ok(data)
    }

    /// Get current language data
    pub async fn get_current_language_data(&self) -> Result<I18nData, String> {
        let current_lang = self.current_language.read().await.clone();
        self.load_language(&current_lang).await
    }

    /// Set current language and emit change event
    pub async fn set_language(&self, language: &str) -> Result<(), String> {
        // Load the language to ensure it exists
        let data = self.load_language(language).await?;

        // Update current language
        {
            let mut current = self.current_language.write().await;
            *current = language.to_string();
        }

        // Emit language change event to frontend
        if let Ok(guard) = GLOBAL_APP_HANDLE.lock() {
            if let Some(app_handle) = guard.as_ref() {
                let _ = app_handle.emit("language-changed", json!({
                    "language": language,
                    "messages": data.messages
                }));
            }
        }

        Ok(())
    }

    /// Reset to system-detected language
    pub async fn reset_to_system_language(&self) -> Result<(), String> {
        let detected_lang = self.detect_system_language();
        self.set_language(&detected_lang).await
    }

    /// Get current language code
    pub async fn get_current_language(&self) -> String {
        self.current_language.read().await.clone()
    }

    /// Get available languages by scanning i18n directory
    pub fn get_available_languages(&self) -> Result<Vec<String>, String> {
        if !self.i18n_dir.exists() {
            return Ok(vec!["en".to_string()]); // fallback
        }

        let mut languages = Vec::new();
        let entries = fs::read_dir(&self.i18n_dir)
            .map_err(|e| format!("Failed to read i18n directory: {}", e))?;

        for entry in entries {
            let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
            let path = entry.path();

            if path.extension().and_then(|s| s.to_str()) == Some("yml") {
                if let Some(stem) = path.file_stem().and_then(|s| s.to_str()) {
                    languages.push(stem.to_string());
                }
            }
        }

        // Ensure English is always first
        languages.sort_by(|a, b| {
            if a == "en" {
                std::cmp::Ordering::Less
            } else if b == "en" {
                std::cmp::Ordering::Greater
            } else {
                a.cmp(b)
            }
        });

        Ok(languages)
    }

    /// Get translated message with fallback
    pub async fn get_message(&self, key: &str) -> String {
        if let Ok(data) = self.get_current_language_data().await {
            if let Some(value) = get_nested_value(&data.messages, key) {
                if let Some(s) = value.as_str() {
                    return s.to_string();
                }
            }
        }

        // Fallback to key if translation not found
        key.to_string()
    }

    /// Get translated message with parameters
    pub async fn get_message_with_params(&self, key: &str, params: HashMap<String, String>) -> String {
        let mut message = self.get_message(key).await;

        for (param, value) in params {
            message = message.replace(&format!("{{{{{} }}}}", param), &value);
        }

        message
    }

    /// Preload common languages during app initialization
    pub async fn preload_common_languages(&self) -> Result<(), String> {
        let mut languages_to_preload = vec!["en".to_string()];

        // Always preload the detected system language
        let detected_lang = self.detect_system_language();
        if !languages_to_preload.contains(&detected_lang) {
            languages_to_preload.push(detected_lang);
        }

        // Preload other common languages if available
        let available_langs = self.get_available_languages().unwrap_or_default();
        for lang in &["es-419"] {
            if available_langs.contains(&lang.to_string()) && !languages_to_preload.contains(&lang.to_string()) {
                languages_to_preload.push(lang.to_string());
            }
        }

        for lang in languages_to_preload {
            if let Err(e) = self.load_language(&lang).await {
                log::warn!("Failed to preload language {}: {}", lang, e);
            }
        }

        Ok(())
    }

    /// Detect system language and return the best matching available language
    pub fn detect_system_language(&self) -> String {
        // First try to get available languages
        let available_languages = match self.get_available_languages() {
            Ok(langs) => langs,
            Err(_) => vec!["en".to_string()],
        };

        // Detect system locale
        let system_locale = self.get_system_locale();

        // Map system locale to best available language
        self.map_locale_to_available_language(&system_locale, &available_languages)
    }

    /// Get system locale from environment variables
    fn get_system_locale(&self) -> String {
        // Try different environment variables for locale detection
        let locale_vars = [
            "LANG",
            "LC_ALL",
            "LC_MESSAGES",
            "LANGUAGE",
        ];

        for var in &locale_vars {
            if let Ok(locale) = std::env::var(var) {
                if !locale.is_empty() && locale != "C" && locale != "POSIX" {
                    // Extract language code from locale (e.g., "es_ES.UTF-8" -> "es")
                    let lang_code = locale.split('.').next()
                        .and_then(|s| s.split('_').next())
                        .unwrap_or("en");
                    return lang_code.to_lowercase();
                }
            }
        }

        // Fallback to English
        "en".to_string()
    }

    /// Map a detected locale to the best available language
    fn map_locale_to_available_language(&self, system_locale: &str, available_languages: &[String]) -> String {
        // Direct match
        if available_languages.contains(&system_locale.to_string()) {
            return system_locale.to_string();
        }

        // Language family mapping
        let language_mappings = [
            // Spanish variants -> es-419
            ("es", "es-419"),
            ("es-es", "es-419"),
            ("es-mx", "es-419"),
            ("es-ar", "es-419"),
            ("es-co", "es-419"),
            ("es-pe", "es-419"),
            ("es-ve", "es-419"),
            ("es-cl", "es-419"),
            ("es-ec", "es-419"),
            ("es-uy", "es-419"),
            ("es-py", "es-419"),
            ("es-bo", "es-419"),
            ("es-sv", "es-419"),
            ("es-hn", "es-419"),
            ("es-ni", "es-419"),
            ("es-cr", "es-419"),
            ("es-pa", "es-419"),
            ("es-gt", "es-419"),
            ("es-do", "es-419"),
            ("es-pr", "es-419"),
            ("es-cu", "es-419"),
            // Portuguese variants -> pt (if available, otherwise en)
            ("pt", "pt"),
            ("pt-br", "pt"),
            ("pt-pt", "pt"),
            // French variants -> fr (if available, otherwise en)
            ("fr", "fr"),
            ("fr-fr", "fr"),
            ("fr-ca", "fr"),
            ("fr-be", "fr"),
            // German variants -> de (if available, otherwise en)
            ("de", "de"),
            ("de-de", "de"),
            ("de-at", "de"),
            ("de-ch", "de"),
            // Chinese variants -> zh (if available, otherwise en)
            ("zh", "zh"),
            ("zh-cn", "zh"),
            ("zh-tw", "zh"),
            ("zh-hk", "zh"),
            // Japanese -> ja (if available, otherwise en)
            ("ja", "ja"),
            ("ja-jp", "ja"),
            // Korean -> ko (if available, otherwise en)
            ("ko", "ko"),
            ("ko-kr", "ko"),
            // Russian -> ru (if available, otherwise en)
            ("ru", "ru"),
            ("ru-ru", "ru"),
            // Italian -> it (if available, otherwise en)
            ("it", "it"),
            ("it-it", "it"),
            // Dutch -> nl (if available, otherwise en)
            ("nl", "nl"),
            ("nl-nl", "nl"),
            ("nl-be", "nl"),
        ];

        // Check for exact matches in mappings
        for (detected, mapped) in &language_mappings {
            if system_locale == *detected {
                if available_languages.contains(&mapped.to_string()) {
                    return mapped.to_string();
                }
            }
        }

        // Check for language prefix matches (e.g., "es-MX" -> "es")
        if let Some(prefix) = system_locale.split('-').next() {
            for (detected, mapped) in &language_mappings {
                if prefix == *detected {
                    if available_languages.contains(&mapped.to_string()) {
                        return mapped.to_string();
                    }
                }
            }
        }

        // If no match found, return English as fallback
        "en".to_string()
    }
}

/// Helper function to get nested values from JSON
fn get_nested_value<'a>(data: &'a HashMap<String, Value>, key: &str) -> Option<&'a Value> {
    let parts: Vec<&str> = key.split('.').collect();

    let mut current = data.get(parts[0])?;

    for part in &parts[1..] {
        match current {
            Value::Object(obj) => {
                current = obj.get(*part)?;
            }
            _ => return None,
        }
    }

    Some(current)
}

// Singleton for global access
use once_cell::sync::OnceCell;
static I18N_MANAGER: OnceCell<Arc<I18nManager>> = OnceCell::new();

pub fn get_i18n_manager() -> &'static Arc<I18nManager> {
    I18N_MANAGER.get_or_init(|| {
        Arc::new(I18nManager::new().expect("Failed to create I18nManager"))
    })
}

// Tauri commands

#[tauri::command]
pub async fn get_current_language() -> Result<String, String> {
    Ok(get_i18n_manager().get_current_language().await)
}

#[tauri::command]
pub async fn set_language(language: String) -> Result<(), String> {
    get_i18n_manager().set_language(&language).await
}

#[tauri::command]
pub async fn get_available_languages() -> Result<Vec<String>, String> {
    get_i18n_manager().get_available_languages()
}

#[tauri::command]
pub async fn get_translations(language: Option<String>) -> Result<Value, String> {
    let lang = language.unwrap_or_else(|| "en".to_string());
    let data = get_i18n_manager().load_language(&lang).await?;
    Ok(json!({
        "language": data.language,
        "messages": data.messages
    }))
}

#[tauri::command]
pub async fn get_message(key: String) -> Result<String, String> {
    Ok(get_i18n_manager().get_message(&key).await)
}

#[tauri::command]
pub async fn get_message_with_params(key: String, params: HashMap<String, String>) -> Result<String, String> {
    Ok(get_i18n_manager().get_message_with_params(&key, params).await)
}

#[tauri::command]
pub async fn get_detected_system_language() -> Result<String, String> {
    Ok(get_i18n_manager().detect_system_language())
}

#[tauri::command]
pub async fn reset_to_system_language() -> Result<(), String> {
    get_i18n_manager().reset_to_system_language().await
}