use crate::config::{get_config_manager};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sysinfo::{System, SystemExt};

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

/// Obtiene el estado del onboarding
#[tauri::command]
pub fn get_onboarding_status() -> Result<OnboardingStatus, String> {
    match get_config_manager().lock() {
        Ok(config_result) => match &*config_result {
            Ok(config) => {
                let first_run_at = config.get("firstRunAt")
                    .and_then(Value::as_str)
                    .map(String::from);
                
                let ram_allocation = config.get("ramAllocation")
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
        Ok(config_result) => match &*config_result {
            Ok(mut config) => {
                // Obtener la fecha actual como timestamp ISO
                let now = chrono::Utc::now().to_rfc3339();
                
                // Guardar firstRunAt y ramAllocation
                config.set("firstRunAt", now).map_err(|e| format!("Error al establecer firstRunAt: {}", e))?;
                config.set("ramAllocation", ram_allocation).map_err(|e| format!("Error al establecer ramAllocation: {}", e))?;
                
                // También guardar en el campo legacy 'memory' para compatibilidad
                config.set("memory", ram_allocation).map_err(|e| format!("Error al establecer memory: {}", e))?;
                
                // Guardar la configuración
                config.save().map_err(|e| format!("Error al guardar configuración: {}", e))?;
                
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