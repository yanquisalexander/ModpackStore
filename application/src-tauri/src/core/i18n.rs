// src/core/i18n.rs
// Internationalization system for Modpack Store

use crate::GLOBAL_APP_HANDLE; // Asumo que aún lo necesitas para `init`
use locale_config::Locale;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::{path::BaseDirectory, AppHandle, Emitter, Manager};
use thiserror::Error;
use tokio::fs;
use tokio::sync::RwLock;

#[derive(Error, Debug)]
pub enum I18nError {
    #[error("I18nManager ya estaba inicializado")]
    AlreadyInitialized,

    #[error("No se pudo resolver la ruta del recurso: {0}")]
    ResourcePath(String),

    #[error("Error de I/O: {0}")]
    Io(#[from] std::io::Error),

    #[error("Error al parsear YAML: {0}")]
    ParseYaml(#[from] serde_yaml::Error),

    #[error("Error al resolver ruta de Tauri: {0}")]
    TauriPath(#[from] tauri::Error),
}

// Convertimos el error personalizado a String para los comandos de Tauri
impl From<I18nError> for String {
    fn from(error: I18nError) -> Self {
        error.to_string()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct I18nData {
    pub language: String,
    pub messages: HashMap<String, Value>,
}

#[derive(Debug)]
pub struct I18nManager {
    translations: RwLock<HashMap<String, I18nData>>,
    current_language: RwLock<String>,
    app_handle: AppHandle,
}

impl I18nManager {
    pub fn new(app_handle: AppHandle) -> Self {
        Self {
            translations: RwLock::new(HashMap::new()),
            current_language: RwLock::new("en".to_string()), // Default temporal
            app_handle,
        }
    }

    /// Carga un archivo de idioma y lo cachea
    pub async fn load_language(&self, language: &str) -> Result<I18nData, I18nError> {
        // 1. Revisar si ya está en caché
        {
            let translations = self.translations.read().await;
            if let Some(data) = translations.get(language) {
                return Ok(data.clone());
            }
        }

        // 2. Cargar el archivo
        let resource_path = format!("resources/i18n/{}.yml", language);

        let content = 'block: {
            // En desarrollo (debug), intentamos leer desde el sistema de archivos para hot-reload
            #[cfg(debug_assertions)]
            {
                let dev_path1 = PathBuf::from(&resource_path);
                if dev_path1.exists() {
                    if let Ok(content) = fs::read_to_string(dev_path1).await {
                        break 'block Ok(content);
                    }
                }
                let dev_path2 = PathBuf::from("application")
                    .join("src-tauri")
                    .join(&resource_path);
                if dev_path2.exists() {
                    if let Ok(content) = fs::read_to_string(dev_path2).await {
                        break 'block Ok(content);
                    }
                }
            }

            // En producción (release) o como fallback en debug, leemos desde los recursos de Tauri
            let file_path = self
                .app_handle
                .path()
                .resolve(&resource_path, BaseDirectory::Resource)?;

            fs::read_to_string(&file_path).await
        }?;

        // 3. Parsear YAML
        let messages: HashMap<String, Value> = serde_yaml::from_str(&content)?;

        let data = I18nData {
            language: language.to_string(),
            messages,
        };

        // 4. Cachear la traducción
        {
            let mut translations = self.translations.write().await;
            translations.insert(language.to_string(), data.clone());
        }

        Ok(data)
    }

    /// Obtiene los datos del idioma actual
    pub async fn get_current_language_data(&self) -> Result<I18nData, I18nError> {
        let current_lang = self.current_language.read().await.clone();
        self.load_language(&current_lang).await
    }

    /// Establece el idioma actual y emite un evento de cambio
    pub async fn set_language(&self, language: &str) -> Result<(), I18nError> {
        // Asegurarse que el idioma existe y está cargado
        let data = self.load_language(language).await?;

        // Actualizar el idioma actual
        {
            let mut current = self.current_language.write().await;
            *current = language.to_string();
        }

        // Emitir evento al frontend usando el app_handle del manager
        let _ = self.app_handle.emit(
            "language-changed",
            json!({
                "language": language,
                "messages": data.messages
            }),
        );

        Ok(())
    }

    /// Reinicia al idioma detectado del sistema
    pub async fn reset_to_system_language(&self) -> Result<(), I18nError> {
        let detected_lang = self.detect_system_language();
        self.set_language(&detected_lang).await
    }

    /// Obtiene el código del idioma actual
    pub async fn get_current_language(&self) -> String {
        self.current_language.read().await.clone()
    }

    /// Obtiene los idiomas disponibles escaneando el directorio i18n
    pub fn get_available_languages(&self) -> Result<Vec<String>, I18nError> {
        let mut languages = Vec::new();

        // Lista de idiomas comunes a verificar
        let common_languages = [
            "en", "es", "es-419", "pt-BR", "fr", "de", "it", "ja", "ko", "zh-CN", "zh-TW",
        ];

        for lang in &common_languages {
            if self.language_file_exists(lang) {
                languages.push(lang.to_string());
            }
        }

        // Asegurarse que "en" esté si existe
        if !languages.contains(&"en".to_string()) && self.language_file_exists("en") {
            languages.push("en".to_string());
        }

        // Ordenar con "en" primero, luego alfabéticamente
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

    /// Obtiene un mensaje traducido con fallback a la clave
    pub async fn get_message(&self, key: &str) -> String {
        if let Ok(data) = self.get_current_language_data().await {
            if let Some(value) = get_nested_value(&data.messages, key) {
                if let Some(s) = value.as_str() {
                    return s.to_string();
                }
            }
        }
        // Fallback a la clave si no se encuentra traducción
        key.to_string()
    }

    /// Obtiene un mensaje traducido con parámetros
    pub async fn get_message_with_params(
        &self,
        key: &str,
        params: HashMap<String, String>,
    ) -> String {
        let mut message = self.get_message(key).await;

        for (param, value) in params {
            message = message.replace(&format!("{{{{{} }}}}", param), &value);
        }

        message
    }

    /// Precarga idiomas comunes durante la inicialización
    pub async fn preload_common_languages(&self) -> Result<(), I18nError> {
        let mut languages_to_preload = vec!["en".to_string()];

        let detected_lang = self.detect_system_language();
        if !languages_to_preload.contains(&detected_lang) {
            languages_to_preload.push(detected_lang);
        }

        // Precargar otros idiomas si están disponibles
        if let Ok(available_langs) = self.get_available_languages() {
            for lang in &["es-419", "pt-BR"] {
                // Añadir otros comunes si se desea
                if available_langs.contains(&lang.to_string())
                    && !languages_to_preload.contains(&lang.to_string())
                {
                    languages_to_preload.push(lang.to_string());
                }
            }
        }

        for lang in languages_to_preload {
            if let Err(e) = self.load_language(&lang).await {
                log::warn!("Fallo al precargar idioma {}: {}", lang, e);
            }
        }

        Ok(())
    }

    /// Detecta el idioma del sistema y devuelve el mejor idioma disponible
    pub fn detect_system_language(&self) -> String {
        let available_languages = self
            .get_available_languages()
            .unwrap_or_else(|_| vec!["en".to_string()]);

        // 1. Usar locale_config para obtener el locale del sistema
        let system_locale = Locale::current();
        let system_lang = system_locale.to_string();

        // 2. Mapear el locale detectado al mejor idioma disponible
        self.map_locale_to_available_language(&system_lang, &available_languages)
    }

    /// Mapea un locale detectado al mejor idioma disponible
    fn map_locale_to_available_language(
        &self,
        system_locale: &str,
        available_languages: &[String],
    ) -> String {
        let lang_str = system_locale.replace('_', "-"); // Normalizar a "es-419"

        // 1. Intento de Coincidencia Exacta
        // Si el sistema pide "es-419" y tenemos "es-419", usarlo.
        if available_languages.contains(&lang_str) {
            return lang_str;
        }

        // 2. Intento de Mapeo (ej. "es-*" -> "es-419")
        let prefix = lang_str.split('-').next().unwrap_or("");

        let mapped_lang = match prefix {
            "es" => "es-419", // Mapear cualquier español a es-419 (Latam)
            "pt" => "pt-BR",  // Mapear cualquier portugués a pt-BR
            "zh" => "zh-CN",  // Mapear cualquier chino a zh-CN (Simplificado)
            _ => "",
        };

        if !mapped_lang.is_empty() && available_languages.contains(&mapped_lang.to_string()) {
            return mapped_lang.to_string();
        }

        // 3. Intento de Prefijo (ej. "es-MX" -> "es")
        if available_languages.contains(&prefix.to_string()) {
            return prefix.to_string();
        }

        // 4. Fallback a inglés
        "en".to_string()
    }

    /// Verifica si un archivo de idioma existe sin cargarlo
    fn language_file_exists(&self, language: &str) -> bool {
        let resource_path = format!("resources/i18n/{}.yml", language);

        // En debug, verificar los paths de desarrollo primero
        #[cfg(debug_assertions)]
        {
            if PathBuf::from(&resource_path).exists() {
                return true;
            }
            if PathBuf::from("application")
                .join("src-tauri")
                .join(&resource_path)
                .exists()
            {
                return true;
            }
        }

        // En producción o como fallback, verificar los recursos compilados
        self.app_handle
            .path()
            .resolve(&resource_path, BaseDirectory::Resource)
            .map_or(false, |path| path.exists())
    }
}

/// Helper para obtener valores anidados de un JSON/YAML
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

// --- Singleton y Comandos de Tauri ---

use once_cell::sync::OnceCell;
static I18N_MANAGER: OnceCell<Arc<I18nManager>> = OnceCell::new();

/// Inicializa el gestor i18n con un AppHandle (eager init opcional)
pub fn init_i18n_manager(app_handle: AppHandle) -> Result<(), I18nError> {
    let _ = I18N_MANAGER.set(Arc::new(I18nManager::new(app_handle)));
    Ok(())
}

pub fn get_i18n_manager() -> Result<&'static Arc<I18nManager>, String> {
    I18N_MANAGER.get_or_try_init(|| {
        let app_handle = GLOBAL_APP_HANDLE
            .lock()
            .map_err(|_| "Failed to lock GLOBAL_APP_HANDLE".to_string())?
            .as_ref()
            .ok_or("GLOBAL_APP_HANDLE not set yet")?
            .clone();
        Ok(Arc::new(I18nManager::new(app_handle)))
    })
    .map_err(|e: String| e)
}

// --- Comandos de Tauri ---
// Nota: Los comandos de Tauri devuelven Result<..., String> para el frontend.
// Hacemos .map_err(|e| e.to_string()) en la frontera.

#[tauri::command]
pub async fn get_current_language() -> Result<String, String> {
    let mgr = get_i18n_manager()?;
    Ok(mgr.get_current_language().await)
}

#[tauri::command]
pub async fn set_language(language: String) -> Result<(), String> {
    let mgr = get_i18n_manager()?;
    mgr.set_language(&language).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_available_languages() -> Result<Vec<String>, String> {
    let mgr = get_i18n_manager()?;
    mgr.get_available_languages().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_translations(language: Option<String>) -> Result<Value, String> {
    let lang = language.unwrap_or_else(|| "en".to_string());
    let mgr = get_i18n_manager()?;
    let data = mgr.load_language(&lang).await.map_err(|e| e.to_string())?;
    Ok(json!({
        "language": data.language,
        "messages": data.messages
    }))
}

#[tauri::command]
pub async fn get_message(key: String) -> Result<String, String> {
    let mgr = get_i18n_manager()?;
    Ok(mgr.get_message(&key).await)
}

#[tauri::command]
pub async fn get_message_with_params(
    key: String,
    params: HashMap<String, String>,
) -> Result<String, String> {
    let mgr = get_i18n_manager()?;
    Ok(mgr.get_message_with_params(&key, params).await)
}

#[tauri::command]
pub async fn get_detected_system_language() -> Result<String, String> {
    let mgr = get_i18n_manager()?;
    Ok(mgr.detect_system_language())
}

#[tauri::command]
pub async fn reset_to_system_language() -> Result<(), String> {
    let mgr = get_i18n_manager()?;
    mgr.reset_to_system_language()
        .await
        .map_err(|e| e.to_string())
}
