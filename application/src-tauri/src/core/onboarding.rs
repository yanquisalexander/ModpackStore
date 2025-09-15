use crate::config::get_config_manager;
use crate::core::java_manager::JavaManager;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sysinfo::System;

#[derive(Debug, Serialize, Deserialize)]
pub struct OnboardingStatus {
    pub first_run_at: Option<String>,
    pub ram_allocation: Option<u32>,
}

#[derive(Debug, Serialize)]
pub struct SystemMemoryInfo {
    pub total_mb: u64,
    pub recommended_mb: u32,
    pub min_mb: u32,
    pub max_mb: u32,
}

#[derive(Debug, Serialize)]
pub struct JavaValidationResult {
    pub is_installed: bool,
    pub java_path: Option<String>,
    pub version: Option<String>,
}

/// Obtiene el estado del onboarding
#[tauri::command]
pub fn get_onboarding_status() -> Result<OnboardingStatus, String> {
    match get_config_manager().lock() {
        Ok(config_result) => match &*config_result {
            Ok(config) => {
                let first_run_at = config
                    .get("firstRunAt")
                    .and_then(Value::as_str)
                    .map(String::from);

                let ram_allocation = config
                    .get("ramAllocation")
                    .and_then(Value::as_u64)
                    .map(|v| v as u32);

                Ok(OnboardingStatus {
                    first_run_at,
                    ram_allocation,
                })
            }
            Err(e) => Err(e.clone()),
        },
        Err(_) => Err("Error al obtener el bloqueo del gestor de configuración".to_string()),
    }
}

/// Obtiene información sobre la memoria del sistema
#[tauri::command]
pub fn get_system_memory() -> Result<SystemMemoryInfo, String> {
    let mut sys = System::new_all();
    sys.refresh_memory();

    let total_bytes = sys.total_memory();
    let total_mb = total_bytes / 1024 / 1024;

    // Calcular valores recomendados
    // Recomendado: mínimo de 4GB o 30% de la RAM
    let recommended_mb = std::cmp::min(4096, (total_mb as f64 * 0.3) as u32);

    // Mínimo: 2GB
    let min_mb = 2048;

    // Máximo: mínimo de la mitad de la RAM física o 12GB
    let max_mb = std::cmp::min((total_mb / 2) as u32, 12288);

    Ok(SystemMemoryInfo {
        total_mb,
        recommended_mb: std::cmp::max(recommended_mb, min_mb),
        min_mb,
        max_mb,
    })
}

/// Completa el onboarding guardando la configuración de RAM
#[tauri::command]
pub fn complete_onboarding(ram_allocation: u32) -> Result<(), String> {
    match get_config_manager().lock() {
        Ok(mut config_result) => match &mut *config_result {
            Ok(config) => {
                // Obtener la fecha actual como timestamp ISO
                let now = chrono::Utc::now().to_rfc3339();

                // Guardar firstRunAt y ramAllocation
                config
                    .set("firstRunAt", now)
                    .map_err(|e| format!("Error al establecer firstRunAt: {}", e))?;
                config
                    .set("ramAllocation", ram_allocation)
                    .map_err(|e| format!("Error al establecer ramAllocation: {}", e))?;

                // También guardar en el campo legacy 'memory' para compatibilidad
                config
                    .set("memory", ram_allocation)
                    .map_err(|e| format!("Error al establecer memory: {}", e))?;

                // Guardar la configuración
                config
                    .save()
                    .map_err(|e| format!("Error al guardar configuración: {}", e))?;

                Ok(())
            }
            Err(e) => Err(e.clone()),
        },
        Err(_) => Err("Error al obtener el bloqueo del gestor de configuración".to_string()),
    }
}

/// Omite el onboarding usando valores por defecto
#[tauri::command]
pub fn skip_onboarding() -> Result<(), String> {
    // Obtener los valores recomendados del sistema
    let system_memory = get_system_memory()?;

    // Usar el valor recomendado para completar el onboarding
    complete_onboarding(system_memory.recommended_mb)
}

/// Valida si Java está instalado en el sistema
#[tauri::command]
pub fn validate_java_installation() -> Result<JavaValidationResult, String> {
    let java_manager = JavaManager::new()
        .map_err(|e| format!("Error al inicializar JavaManager: {}", e))?;
    
    match java_manager.validate_system_java() {
        Ok(Some(java_path)) => {
            // Java encontrado, obtener versión si es posible
            let version = match std::env::var("JAVA_HOME") {
                Ok(java_home) => {
                    let java_exe = if cfg!(target_os = "windows") {
                        std::path::PathBuf::from(&java_home).join("bin").join("java.exe")
                    } else {
                        std::path::PathBuf::from(&java_home).join("bin").join("java")
                    };
                    
                    match java_manager.get_java_version(&java_exe) {
                        Ok(version) => Some(version),
                        Err(_) => None,
                    }
                }
                Err(_) => None,
            };
            
            Ok(JavaValidationResult {
                is_installed: true,
                java_path: Some(java_path),
                version,
            })
        }
        Ok(None) => {
            Ok(JavaValidationResult {
                is_installed: false,
                java_path: None,
                version: None,
            })
        }
        Err(e) => Err(format!("Error al validar Java: {}", e)),
    }
}

/// Instala Java 8 automáticamente
#[tauri::command]
pub async fn install_java() -> Result<String, String> {
    let java_manager = JavaManager::new()
        .map_err(|e| format!("Error al inicializar JavaManager: {}", e))?;
    
    // Descargar e instalar Java 8
    let java_path = java_manager.get_java_path("8").await
        .map_err(|e| format!("Error al instalar Java: {}", e))?;
    
    let java_home = java_path.to_string_lossy().to_string();
    
    // Guardar la ruta de Java en la configuración
    match get_config_manager().lock() {
        Ok(mut config_result) => match &mut *config_result {
            Ok(config) => {
                config
                    .set("javaDir", &java_home)
                    .map_err(|e| format!("Error al establecer javaDir: {}", e))?;
                
                config
                    .save()
                    .map_err(|e| format!("Error al guardar configuración: {}", e))?;
                
                Ok(java_home)
            }
            Err(e) => Err(e.clone()),
        },
        Err(_) => Err("Error al obtener el bloqueo del gestor de configuración".to_string()),
    }
}
