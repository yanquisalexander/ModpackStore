use once_cell::sync::OnceCell;
use serde::Deserialize;
use std::fs::read_to_string;
use std::sync::OnceLock;

static OVERRIDES: OnceLock<SystemOverrides> = OnceLock::new();

#[derive(Debug, Clone, Deserialize, Default)]
pub struct SystemOverrides {
    #[serde(default)]
    pub api_endpoint: Option<String>,
}

/// Carga los system overrides desde system_overrides.yml en el directorio de configuración.
/// Si el archivo no existe o tiene errores, retorna valores por defecto (sinoverrides).
pub fn load_system_overrides() -> SystemOverrides {
    let config_dir = match dirs::config_dir() {
        Some(dir) => dir,
        None => {
            log::warn!("No se pudo obtener el directorio de configuración para system_overrides");
            return SystemOverrides::default();
        }
    };

    let overrides_path = config_dir
        .join("dev.alexitoo.modpackstore")
        .join("system_overrides.yml");

    if !overrides_path.exists() {
        log::info!(
            "No se encontró system_overrides.yml en {}, usando valores por defecto",
            overrides_path.display()
        );
        return SystemOverrides::default();
    }

    match read_to_string(&overrides_path) {
        Ok(content) => match serde_yaml::from_str::<SystemOverrides>(&content) {
            Ok(overrides) => {
                log::info!(
                    "System overrides cargados correctamente desde {}",
                    overrides_path.display()
                );
                if let Some(ref endpoint) = overrides.api_endpoint {
                    log::info!("API endpoint override: {}", endpoint);
                }
                overrides
            }
            Err(e) => {
                log::error!(
                    "Error al parsear system_overrides.yml: {}. Usando valores por defecto",
                    e
                );
                SystemOverrides::default()
            }
        },
        Err(e) => {
            log::error!(
                "Error al leer system_overrides.yml: {}. Usando valores por defecto",
                e
            );
            SystemOverrides::default()
        }
    }
}

/// Inicializa los system overrides globalmente. Debe llamarse una vez al inicio de la app.
pub fn init_system_overrides() {
    let overrides = load_system_overrides();
    let _ = OVERRIDES.set(overrides);
}

/// Obtiene una referencia a los system overrides.
pub fn get_system_overrides() -> &'static SystemOverrides {
    OVERRIDES.get_or_init(|| {
        log::warn!("System overrides no inicializados, cargando ahora");
        load_system_overrides()
    })
}

#[tauri::command]
pub fn get_api_endpoint() -> Result<Option<String>, String> {
    Ok(get_system_overrides().api_endpoint.clone())
}
