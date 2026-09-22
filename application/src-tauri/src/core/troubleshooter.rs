use crate::config::get_config_manager;
use crate::core::accounts_manager::get_accounts_manager;
use crate::core::instance_manager::get_all_instances;
use crate::core::java_manager::JavaManager;
use crate::core::network_utilities::check_real_connection;
use crate::GLOBAL_APP_HANDLE;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use tauri::Emitter;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct TroubleshooterResult {
    pub checks: Vec<CheckResult>,
    pub timestamp: String,
    pub app_version: String,
    pub os: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CheckResult {
    pub id: String,
    pub name: String,
    pub description: String,
    pub status: CheckStatus,
    pub detail: Option<String>,
    pub technical: Option<String>,
    pub fixable: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum CheckStatus {
    Pass,
    Warn,
    Fail,
    Running,
}

fn emit_check_update(check: &CheckResult) {
    if let Ok(guard) = GLOBAL_APP_HANDLE.lock() {
        if let Some(app_handle) = guard.as_ref() {
            let _ = app_handle.emit("troubleshooter_check_complete", check);
        }
    }
}

fn emit_finished() {
    if let Ok(guard) = GLOBAL_APP_HANDLE.lock() {
        if let Some(app_handle) = guard.as_ref() {
            let _ = app_handle.emit("troubleshooter_finished", ());
        }
    }
}

#[tauri::command]
pub async fn run_troubleshooter() -> Result<TroubleshooterResult, String> {
    let mut checks: Vec<CheckResult> = Vec::new();

    let c = check_java_configured();
    emit_check_update(&c);
    checks.push(c);
    tokio::time::sleep(std::time::Duration::from_millis(80)).await;

    let c = check_java_not_system();
    emit_check_update(&c);
    checks.push(c);
    tokio::time::sleep(std::time::Duration::from_millis(80)).await;

    // macOS-specific: Check Java permissions
    #[cfg(target_os = "macos")]
    {
        let c = check_macos_java_permissions();
        emit_check_update(&c);
        checks.push(c);
        tokio::time::sleep(std::time::Duration::from_millis(80)).await;
    }

    let c = check_instances_dir();
    emit_check_update(&c);
    checks.push(c);
    tokio::time::sleep(std::time::Duration::from_millis(80)).await;

    let c = check_orphan_accounts();
    emit_check_update(&c);
    checks.push(c);
    tokio::time::sleep(std::time::Duration::from_millis(80)).await;

    let c = check_broken_bootstrap();
    emit_check_update(&c);
    checks.push(c);
    tokio::time::sleep(std::time::Duration::from_millis(80)).await;

    let c = check_disk_space();
    emit_check_update(&c);
    checks.push(c);
    tokio::time::sleep(std::time::Duration::from_millis(80)).await;

    let c = check_connectivity().await;
    emit_check_update(&c);
    checks.push(c);

    let c = check_jvm_memory_config();
    emit_check_update(&c);
    checks.push(c);
    tokio::time::sleep(std::time::Duration::from_millis(80)).await;

    let c = check_recent_jvm_crashes();
    emit_check_update(&c);
    checks.push(c);
    tokio::time::sleep(std::time::Duration::from_millis(80)).await;

    let c = check_java_version_compatibility();
    emit_check_update(&c);
    checks.push(c);

    let result = TroubleshooterResult {
        checks,
        timestamp: chrono::Utc::now().format("%Y-%m-%d %H:%M:%S UTC").to_string(),
        app_version: option_env!("CARGO_PKG_VERSION").unwrap_or("unknown").to_string(),
        os: std::env::consts::OS.to_string(),
    };

    emit_finished();
    Ok(result)
}

#[tauri::command]
pub async fn apply_troubleshooter_fix(fix_id: String) -> Result<String, String> {
    match fix_id.as_str() {
        "fix_java" => {
            let java_manager = JavaManager::new()
                .map_err(|e| format!("Error al inicializar JavaManager: {}", e))?;

            // Primero: reutilizar Java de la app si ya existe (con auto-sanación)
            if let Some(app_java) = java_manager.find_existing_app_java() {
                let mut config = get_config_manager()
                    .lock()
                    .map_err(|_| "Failed to lock config manager".to_string())?;
                let cfg = config.as_mut().map_err(|e| e.clone())?;
                cfg.set("javaDir", &app_java)
                    .map_err(|e| format!("Error al establecer javaDir: {}", e))?;
                cfg.save()
                    .map_err(|e| format!("Error al guardar configuración: {}", e))?;
                return Ok(app_java);
            }

            // Segundo: buscar Java del sistema
            if let Ok(Some(local_java_path)) = java_manager.scan_local_java_installations() {
                let mut config = get_config_manager()
                    .lock()
                    .map_err(|_| "Failed to lock config manager".to_string())?;
                let cfg = config.as_mut().map_err(|e| e.clone())?;
                cfg.set("javaDir", &local_java_path)
                    .map_err(|e| format!("Error al establecer javaDir: {}", e))?;
                cfg.save()
                    .map_err(|e| format!("Error al guardar configuración: {}", e))?;
                return Ok(local_java_path);
            }

            // Tercero: descargar Java 17 automáticamente
            let java_path = java_manager
                .get_java_path("17")
                .await
                .map_err(|e| format!("Error al descargar Java 17: {}", e))?;
            let java_path_str = java_path.to_string_lossy().to_string();
            let mut config = get_config_manager()
                .lock()
                .map_err(|_| "Failed to lock config manager".to_string())?;
            let cfg = config.as_mut().map_err(|e| e.clone())?;
            cfg.set("javaDir", &java_path_str)
                .map_err(|e| format!("Error al establecer javaDir: {}", e))?;
            cfg.save()
                .map_err(|e| format!("Error al guardar configuración: {}", e))?;
            Ok(java_path_str)
        }
        "fix_java_config" => {
            let java_manager = JavaManager::new()
                .map_err(|e| format!("Error al inicializar JavaManager: {}", e))?;

            // Primero: reutilizar Java de la app si ya existe
            if let Some(app_java) = java_manager.find_existing_app_java() {
                let mut config = get_config_manager()
                    .lock()
                    .map_err(|_| "Failed to lock config manager".to_string())?;
                let cfg = config.as_mut().map_err(|e| e.clone())?;
                cfg.set("javaDir", &app_java)
                    .map_err(|e| format!("Error al establecer javaDir: {}", e))?;
                cfg.save()
                    .map_err(|e| format!("Error al guardar configuración: {}", e))?;
                return Ok(app_java);
            }

            // Si no hay ninguno, descargar Java 17
            let java_path = java_manager
                .get_java_path("17")
                .await
                .map_err(|e| format!("Error al descargar Java 17: {}", e))?;
            let java_path_str = java_path.to_string_lossy().to_string();
            let mut config = get_config_manager()
                .lock()
                .map_err(|_| "Failed to lock config manager".to_string())?;
            let cfg = config.as_mut().map_err(|e| e.clone())?;
            cfg.set("javaDir", &java_path_str)
                .map_err(|e| format!("Error al establecer javaDir: {}", e))?;
            cfg.save()
                .map_err(|e| format!("Error al guardar configuración: {}", e))?;
            Ok(java_path_str)
        }
        "fix_instances_dir" => {
            let instances_dir = {
                let config = get_config_manager()
                    .lock()
                    .map_err(|_| "Failed to lock config manager".to_string())?;
                let cfg = config.as_ref().map_err(|e| e.clone())?;
                cfg.get_instances_dir()
            };
            if !instances_dir.exists() {
                std::fs::create_dir_all(&instances_dir)
                    .map_err(|e| format!("Error al crear directorio de instancias: {}", e))?;
            }
            Ok(instances_dir.to_string_lossy().to_string())
        }
        "fix_orphan_accounts" => {
            let instances = get_all_instances()?;
            let account_uuids: Vec<String> = {
                let accounts_manager = get_accounts_manager();
                let manager_guard = accounts_manager
                    .lock()
                    .map_err(|_| "Failed to lock accounts manager".to_string())?;
                manager_guard.get_all_accounts().iter().map(|a| a.uuid().to_string()).collect()
            };
            let mut fixed_count = 0;
            for mut instance in instances {
                if let Some(ref uuid) = instance.accountUuid {
                    if !account_uuids.contains(uuid) {
                        instance.accountUuid = None;
                        let _ = instance.save();
                        fixed_count += 1;
                    }
                }
            }
            Ok(format!("Se limpiaron {} instancia(s) con cuentas huérfanas", fixed_count))
        }
        "recheck_connection" => {
            let connected = check_real_connection().await;
            if connected {
                Ok("Conexión restaurada".to_string())
            } else {
                Err("Sin conexión a internet".to_string())
            }
        }
        "fix_jvm_memory" => {
            // Set a safe default RAM allocation based on available system memory.
            // We target 50% of physical RAM, clamped between 2048 MB and 8192 MB.
            let mut sys = sysinfo::System::new();
            sys.refresh_memory();
            let total_mb = (sys.total_memory() / (1024 * 1024)) as u32;
            let recommended = (total_mb / 2).clamp(2048, 8192);

            let mut config = get_config_manager()
                .lock()
                .map_err(|_| "Failed to lock config manager".to_string())?;
            let cfg = config.as_mut().map_err(|e| e.clone())?;
            cfg.set("ramAllocation", recommended)
                .map_err(|e| format!("Error al establecer ramAllocation: {}", e))?;
            cfg.save()
                .map_err(|e| format!("Error al guardar configuración: {}", e))?;

            Ok(format!(
                "RAM configurada a {}MB (sistema: {}MB totales)",
                recommended, total_mb
            ))
        }
        #[cfg(target_os = "macos")]
        "fix_macos_java_permissions" => {
            crate::core::macos_permissions::check_and_fix_java_permissions()
                .await
                .map(|_| "Permisos de Java reparados correctamente".to_string())
                .map_err(|e| format!("Error al reparar permisos: {}", e))
        }
        _ => Err(format!("Fix desconocido: {}", fix_id)),
    }
}

// ── Checks ─────────────────────────────────────────

fn check_java_configured() -> CheckResult {
    let mut result = CheckResult {
        id: "java_configured".to_string(),
        name: "Java instalado".to_string(),
        description: "Comprueba que tengas Java instalado y configurado correctamente.".to_string(),
        status: CheckStatus::Running,
        detail: None,
        technical: None,
        fixable: true,
    };

    let config = match get_config_manager().lock() {
        Ok(guard) => guard,
        Err(_) => {
            result.status = CheckStatus::Fail;
            result.detail = Some("No se pudo leer la configuración".to_string());
            result.technical = Some("config::lock_failed".to_string());
            return result;
        }
    };

    let cfg = match config.as_ref() {
        Ok(c) => c,
        Err(e) => {
            result.status = CheckStatus::Fail;
            result.detail = Some("La configuración está corrupta".to_string());
            result.technical = Some(format!("config::corrupt: {}", e));
            return result;
        }
    };

    let java_dir = cfg.get_java_dir();

    match java_dir {
        Some(path) => {
            let java_exe = get_java_executable(&path);
            if java_exe.exists() {
                let java_manager = JavaManager::new();
                let version = java_manager
                    .ok()
                    .and_then(|jm| jm.get_java_version(&java_exe).ok());

                result.status = CheckStatus::Pass;
                result.detail = Some(match &version {
                    Some(v) => format!("Java {} funcionando", v),
                    None => "Java detectado".to_string(),
                });
                result.technical = Some(format!(
                    "javaDir={}\njava_exe={}\nversion={}",
                    path.display(),
                    java_exe.display(),
                    version.as_deref().unwrap_or("unknown")
                ));
            } else {
                result.status = CheckStatus::Fail;
                result.detail = Some("Java configurado pero no se encuentra el ejecutable".to_string());
                result.technical = Some(format!(
                    "javaDir={}\nexpected_exe={}\nexists=false",
                    path.display(),
                    java_exe.display()
                ));
            }
        }
        None => {
            result.status = CheckStatus::Fail;
            result.detail = Some("No hay Java configurado".to_string());
            result.technical = Some("javaDir=null".to_string());
        }
    }

    result
}

fn check_java_not_system() -> CheckResult {
    let mut result = CheckResult {
        id: "java_not_system".to_string(),
        name: "Java gestionado por la app".to_string(),
        description: "Usar el Java que descarga la app evita problemas de compatibilidad.".to_string(),
        status: CheckStatus::Running,
        detail: None,
        technical: None,
        fixable: true,
    };

    let config = match get_config_manager().lock() {
        Ok(guard) => guard,
        Err(_) => {
            result.status = CheckStatus::Warn;
            result.detail = Some("No se pudo leer la configuración".to_string());
            return result;
        }
    };

    let cfg = match config.as_ref() {
        Ok(c) => c,
        Err(_) => {
            result.status = CheckStatus::Warn;
            result.detail = Some("Error de configuración".to_string());
            return result;
        }
    };

    let java_dir = match cfg.get_java_dir() {
        Some(p) => p,
        None => {
            result.status = CheckStatus::Fail;
            result.detail = Some("No hay Java configurado".to_string());
            return result;
        }
    };

    let is_app_java = java_dir.to_string_lossy().contains("_java_versions");

    if is_app_java {
        // Aunque esté en _java_versions, verificar que el ejecutable exista
        let java_exe = get_java_executable(&java_dir);
        if java_exe.exists() {
            result.status = CheckStatus::Pass;
            result.detail = Some("Usando el Java de la app".to_string());
            result.technical = Some(format!("source=app_managed\npath={}", java_dir.display()));
        } else {
            result.status = CheckStatus::Fail;
            result.detail = Some("La ruta del Java de la app es incorrecta".to_string());
            result.technical = Some(format!(
                "source=app_managed_broken\npath={}\nexpected_exe={}\nexists=false",
                java_dir.display(),
                java_exe.display()
            ));
        }
    } else {
        let is_java_home = std::env::var("JAVA_HOME")
            .map(|jh| java_dir.to_string_lossy().starts_with(&jh))
            .unwrap_or(false);

        result.status = CheckStatus::Warn;
        if is_java_home {
            result.detail = Some("Estás usando el Java del sistema (JAVA_HOME)".to_string());
            result.technical = Some(format!("source=system_java_home\nJAVA_HOME={}\npath={}",
                std::env::var("JAVA_HOME").unwrap_or_default(),
                java_dir.display()
            ));
        } else {
            result.detail = Some("Estás usando un Java externo, no el de la app".to_string());
            result.technical = Some(format!("source=external\npath={}", java_dir.display()));
        }
    }

    result
}

fn check_instances_dir() -> CheckResult {
    let mut result = CheckResult {
        id: "instances_dir".to_string(),
        name: "Carpeta de modpacks".to_string(),
        description: "Comprueba que la carpeta donde se guardan los modpacks exista y se pueda escribir.".to_string(),
        status: CheckStatus::Running,
        detail: None,
        technical: None,
        fixable: true,
    };

    let instances_dir = {
        let config = match get_config_manager().lock() {
            Ok(guard) => guard,
            Err(_) => {
                result.status = CheckStatus::Fail;
                result.detail = Some("No se pudo leer la configuración".to_string());
                return result;
            }
        };
        match config.as_ref() {
            Ok(c) => c.get_instances_dir(),
            Err(_) => {
                result.status = CheckStatus::Fail;
                result.detail = Some("Error de configuración".to_string());
                return result;
            }
        }
    };

    result.technical = Some(format!("instancesDir={}", instances_dir.display()));

    if !instances_dir.exists() {
        result.status = CheckStatus::Fail;
        result.detail = Some("La carpeta de modpacks no existe".to_string());
        return result;
    }

    let test_file = instances_dir.join(".troubleshooter_test");
    match std::fs::write(&test_file, b"test") {
        Ok(_) => {
            let _ = std::fs::remove_file(&test_file);
            result.status = CheckStatus::Pass;
            result.detail = Some("Carpeta accesible".to_string());
        }
        Err(e) => {
            result.status = CheckStatus::Fail;
            result.detail = Some("No se puede escribir en la carpeta de modpacks".to_string());
            result.technical = Some(format!("write_test=failed\nerror={}", e));
        }
    }

    result
}

fn check_orphan_accounts() -> CheckResult {
    let mut result = CheckResult {
        id: "orphan_accounts".to_string(),
        name: "Cuentas sin vincular".to_string(),
        description: "Detecta modpacks que tienen una cuenta asignada que ya no existe.".to_string(),
        status: CheckStatus::Running,
        detail: None,
        technical: None,
        fixable: true,
    };

    let instances = match get_all_instances() {
        Ok(i) => i,
        Err(e) => {
            result.status = CheckStatus::Warn;
            result.detail = Some("No se pudieron cargar los modpacks".to_string());
            result.technical = Some(format!("get_all_instances: {}", e));
            return result;
        }
    };

    let account_uuids: Vec<String> = {
        let accounts_manager = get_accounts_manager();
        let lock_result = accounts_manager.lock();
        match lock_result {
            Ok(manager_guard) => manager_guard.get_all_accounts().iter().map(|a| a.uuid().to_string()).collect(),
            Err(_) => {
                result.status = CheckStatus::Warn;
                result.detail = Some("No se pudieron cargar las cuentas".to_string());
                return result;
            }
        }
    };

    let orphans: Vec<String> = instances
        .iter()
        .filter(|i| {
            if let Some(ref uuid) = i.accountUuid {
                !account_uuids.contains(uuid)
            } else {
                false
            }
        })
        .map(|i| i.instanceName.clone())
        .collect();

    result.technical = Some(format!(
        "total_instances={}\nregistered_accounts={}\norphan_count={}",
        instances.len(),
        account_uuids.len(),
        orphans.len()
    ));

    if orphans.is_empty() {
        result.status = CheckStatus::Pass;
        result.detail = Some("Todas las cuentas están correctas".to_string());
    } else {
        result.status = CheckStatus::Fail;
        result.detail = Some(format!("{} modpack(s) con cuenta(s) perdida(s)", orphans.len()));
        result.technical = Some(format!(
            "{}\norphan_instances=[{}]",
            result.detail.as_deref().unwrap_or(""),
            orphans.join(", ")
        ));
    }

    result
}

fn check_broken_bootstrap() -> CheckResult {
    let mut result = CheckResult {
        id: "broken_bootstrap".to_string(),
        name: "Modpacks con errores".to_string(),
        description: "Detecta modpacks que no terminaron de instalar o tienen errores.".to_string(),
        status: CheckStatus::Running,
        detail: None,
        technical: None,
        fixable: false,
    };

    let instances = match get_all_instances() {
        Ok(i) => i,
        Err(e) => {
            result.status = CheckStatus::Warn;
            result.detail = Some("No se pudieron cargar los modpacks".to_string());
            result.technical = Some(format!("get_all_instances: {}", e));
            return result;
        }
    };

    // A modpack is considered "broken" only if:
    // 1. bootstrap_complete == Some(false) AND bootstrap_error is non-empty
    //    (bootstrap was attempted but failed with an error)
    //
    // We do NOT consider it broken if:
    // - bootstrap_complete is None (old instance, not tracked)
    // - bootstrap_complete is Some(true) (bootstrap succeeded)
    // - bootstrap_error is empty or None (no error recorded)
    let broken: Vec<(&str, Option<&str>)> = instances
        .iter()
        .filter(|i| {
            i.bootstrap_complete == Some(false)
                && i.bootstrap_error.as_ref().map_or(false, |e| !e.is_empty())
        })
        .map(|i| (i.instanceName.as_str(), i.bootstrap_error.as_deref()))
        .collect();

    // Also count "in progress" instances (bootstrap started but no error yet)
    let in_progress: Vec<&str> = instances
        .iter()
        .filter(|i| {
            i.bootstrap_complete == Some(false) && i.bootstrap_error.as_ref().map_or(true, |e| e.is_empty())
        })
        .map(|i| i.instanceName.as_str())
        .collect();

    result.technical = Some(format!(
        "total={}\nbroken={}\nin_progress={}\nbroken_list=[{}]\nin_progress_list=[{}]",
        instances.len(),
        broken.len(),
        in_progress.len(),
        broken.iter().map(|(name, _)| *name).collect::<Vec<_>>().join(", "),
        in_progress.join(", ")
    ));

    if broken.is_empty() && in_progress.is_empty() {
        result.status = CheckStatus::Pass;
        result.detail = Some("Todos los modpacks están instalados correctamente".to_string());
    } else if broken.is_empty() && !in_progress.is_empty() {
        result.status = CheckStatus::Warn;
        result.detail = Some(format!("{} modpack(s) en proceso de instalación", in_progress.len()));
    } else if !broken.is_empty() {
        result.status = CheckStatus::Fail;
        let error_summary = broken.first().and_then(|(_, err)| *err).unwrap_or("Error desconocido");
        result.detail = Some(format!(
            "{} modpack(s) con errores (ej: {})",
            broken.len(),
            if error_summary.len() > 50 {
                format!("{}...", &error_summary[..47])
            } else {
                error_summary.to_string()
            }
        ));
    }

    result
}

fn check_disk_space() -> CheckResult {
    let mut result = CheckResult {
        id: "disk_space".to_string(),
        name: "Espacio en disco".to_string(),
        description: "Comprueba que tengas suficiente espacio para instalar modpacks.".to_string(),
        status: CheckStatus::Running,
        detail: None,
        technical: None,
        fixable: false,
    };

    let instances_dir = {
        let config = match get_config_manager().lock() {
            Ok(guard) => guard,
            Err(_) => {
                result.status = CheckStatus::Warn;
                result.detail = Some("No se pudo leer la configuración".to_string());
                return result;
            }
        };
        match config.as_ref() {
            Ok(c) => c.get_instances_dir(),
            Err(_) => {
                result.status = CheckStatus::Warn;
                result.detail = Some("Error de configuración".to_string());
                return result;
            }
        }
    };

    match disk_free_space(&instances_dir) {
        Some(free_bytes) => {
            let free_mb = free_bytes / (1024 * 1024);
            result.technical = Some(format!("free_bytes={}\nfree_mb={}", free_bytes, free_mb));

            if free_mb >= 500 {
                result.status = CheckStatus::Pass;
                result.detail = Some(format!("{}MB libres", free_mb));
            } else if free_mb >= 100 {
                result.status = CheckStatus::Warn;
                result.detail = Some(format!("{}MB libres (poco espacio)", free_mb));
            } else {
                result.status = CheckStatus::Fail;
                result.detail = Some(format!("{}MB libres (muy poco)", free_mb));
            }
        }
        None => {
            result.status = CheckStatus::Warn;
            result.detail = Some("No se pudo verificar el espacio".to_string());
            result.technical = Some("disk_space=query_failed".to_string());
        }
    }

    result
}

async fn check_connectivity() -> CheckResult {
    let mut result = CheckResult {
        id: "connectivity".to_string(),
        name: "Conexión a internet".to_string(),
        description: "Comprueba que puedas conectarte a los servidores de ModpackStore.".to_string(),
        status: CheckStatus::Running,
        detail: None,
        technical: None,
        fixable: true,
    };

    let connected = check_real_connection().await;

    result.technical = Some(format!("internet={}", if connected { "ok" } else { "failed" }));

    if connected {
        result.status = CheckStatus::Pass;
        result.detail = Some("Conectado".to_string());
    } else {
        result.status = CheckStatus::Fail;
        result.detail = Some("Sin conexión a internet".to_string());
    }

    result
}

/// macOS-specific: Check Java permissions (quarantine attributes, execute permissions)
#[cfg(target_os = "macos")]
fn check_macos_java_permissions() -> CheckResult {
    let mut result = CheckResult {
        id: "macos_java_permissions".to_string(),
        name: "Permisos de Java (macOS)".to_string(),
        description: "Verifica que los binarios de Java tengan los permisos correctos en macOS.".to_string(),
        status: CheckStatus::Running,
        detail: None,
        technical: None,
        fixable: true,
    };

    let java_manager = match JavaManager::new() {
        Ok(jm) => jm,
        Err(e) => {
            result.status = CheckStatus::Warn;
            result.detail = Some("No se pudo verificar Java".to_string());
            result.technical = Some(format!("JavaManager init failed: {}", e));
            return result;
        }
    };

    let base_path = java_manager.base_path();
    if !base_path.exists() {
        result.status = CheckStatus::Pass;
        result.detail = Some("No hay Java instalado por la app".to_string());
        result.technical = Some("base_path=not_exists".to_string());
        return result;
    }

    let mut issues: Vec<String> = Vec::new();
    let mut checked = 0;

    for version in &["8", "17", "21"] {
        let version_dir = base_path.join(format!("java{}", version));
        if !version_dir.exists() {
            continue;
        }

        // Auto-sanar directorio si tiene estructura anidada o Contents/Home
        let _ = JavaManager::heal_java_directory(&version_dir);

        if !version_dir.exists() {
            continue;
        }

        checked += 1;

        let java_exe = get_java_executable(&version_dir);
        if !java_exe.exists() {
            issues.push(format!("Java {}: ejecutable no encontrado", version));
            continue;
        }

        // Check for quarantine attribute
        if let Ok(output) = std::process::Command::new("xattr")
            .args(["-l", "com.apple.quarantine"])
            .arg(&java_exe)
            .output()
        {
            let stdout = String::from_utf8_lossy(&output.stdout);
            if stdout.contains("com.apple.quarantine") {
                issues.push(format!("Java {}: tiene attribute de cuarentena", version));
            }
        }

        // Check execute permissions
        if let Ok(metadata) = std::fs::metadata(&java_exe) {
            use std::os::unix::fs::PermissionsExt;
            let mode = metadata.permissions().mode();
            if mode & 0o100 == 0 {
                issues.push(format!("Java {}: sin permisos de ejecución", version));
            }
        }
    }

    result.technical = Some(format!(
        "checked_versions={}\nissues={}\n[{}]",
        checked,
        issues.len(),
        issues.join(", ")
    ));

    if issues.is_empty() {
        result.status = CheckStatus::Pass;
        result.detail = Some(format!("{} instalación(es) verificada(s)", checked));
    } else {
        result.status = CheckStatus::Fail;
        result.detail = Some(format!("{} problema(s) encontrado(s) en permisos de Java", issues.len()));
    }

    result
}

// ── JVM Crash Checks ───────────────────────────────

/// Verifica que la RAM asignada a Minecraft sea razonable.
/// Una configuración demasiado baja (<512 MB) o mayor que la RAM del sistema
/// son causas directas de JVM crash al iniciar.
fn check_jvm_memory_config() -> CheckResult {
    let mut result = CheckResult {
        id: "jvm_memory_config".to_string(),
        name: "Configuración de RAM para Minecraft".to_string(),
        description: "Comprueba que la RAM asignada sea suficiente y no supere la disponible en el sistema.".to_string(),
        status: CheckStatus::Running,
        detail: None,
        technical: None,
        fixable: true,
    };

    let allocated_mb = {
        let config = match get_config_manager().lock() {
            Ok(guard) => guard,
            Err(_) => {
                result.status = CheckStatus::Warn;
                result.detail = Some("No se pudo leer la configuración".to_string());
                return result;
            }
        };
        match config.as_ref() {
            Ok(c) => c.get_minecraft_memory().unwrap_or(2048),
            Err(_) => {
                result.status = CheckStatus::Warn;
                result.detail = Some("Error de configuración".to_string());
                return result;
            }
        }
    };

    // Get total system RAM
    let mut sys = sysinfo::System::new();
    sys.refresh_memory();
    let total_ram_mb = (sys.total_memory() / (1024 * 1024)) as u32;
    // Leave at least 1 GB for the OS + other processes
    let recommended_max_mb = total_ram_mb.saturating_sub(1024);

    let xmx = allocated_mb;
    let xms = (xmx / 2).max(256).min(xmx);

    result.technical = Some(format!(
        "allocated_mb={}\nxmx={}M\nxms={}M\ntotal_ram_mb={}\nrecommended_max_mb={}",
        allocated_mb, xmx, xms, total_ram_mb, recommended_max_mb
    ));

    if allocated_mb < 512 {
        result.status = CheckStatus::Fail;
        result.detail = Some(format!(
            "{}MB es demasiado poco. El mínimo recomendado es 512MB. La JVM crasheará al iniciar.",
            allocated_mb
        ));
    } else if allocated_mb > recommended_max_mb && recommended_max_mb > 0 {
        result.status = CheckStatus::Warn;
        result.detail = Some(format!(
            "{}MB asignados pero el sistema solo tiene {}MB libres estimados (de {}MB totales). Puede causar crash por OOM del sistema.",
            allocated_mb, recommended_max_mb, total_ram_mb
        ));
    } else if allocated_mb < 1024 {
        result.status = CheckStatus::Warn;
        result.detail = Some(format!(
            "{}MB puede ser insuficiente para modpacks pesados. Se recomienda al menos 2048MB.",
            allocated_mb
        ));
    } else {
        result.status = CheckStatus::Pass;
        result.detail = Some(format!(
            "{}MB asignados (Xms={}M, Xmx={}M). OK.",
            allocated_mb, xms, xmx
        ));
    }

    result
}

/// Busca archivos hs_err_pid*.log recientes en los directorios de instancias.
/// Si encuentra alguno de menos de 24 horas, significa que hubo un JVM crash reciente.
fn check_recent_jvm_crashes() -> CheckResult {
    let mut result = CheckResult {
        id: "recent_jvm_crashes".to_string(),
        name: "Crashes de JVM recientes".to_string(),
        description: "Detecta crashes nativos de la JVM (hs_err_pid) en los directorios de las instancias.".to_string(),
        status: CheckStatus::Running,
        detail: None,
        technical: None,
        fixable: false,
    };

    let instances_dir = {
        let config = match get_config_manager().lock() {
            Ok(guard) => guard,
            Err(_) => {
                result.status = CheckStatus::Warn;
                result.detail = Some("No se pudo leer la configuración".to_string());
                return result;
            }
        };
        match config.as_ref() {
            Ok(c) => c.get_instances_dir(),
            Err(_) => {
                result.status = CheckStatus::Warn;
                result.detail = Some("Error de configuración".to_string());
                return result;
            }
        }
    };

    if !instances_dir.exists() {
        result.status = CheckStatus::Pass;
        result.detail = Some("No hay instancias instaladas".to_string());
        result.technical = Some("instances_dir=not_exists".to_string());
        return result;
    }

    // Walk up to 3 levels deep looking for hs_err_pid*.log files modified in the last 24h
    let cutoff_secs = 24 * 60 * 60u64;
    let mut found_crashes: Vec<String> = Vec::new();

    fn scan_for_hs_err(dir: &std::path::Path, depth: u8, cutoff_secs: u64, found: &mut Vec<String>) {
        if depth == 0 {
            return;
        }
        let entries = match std::fs::read_dir(dir) {
            Ok(e) => e,
            Err(_) => return,
        };
        for entry in entries.filter_map(Result::ok) {
            let path = entry.path();
            if path.is_dir() {
                scan_for_hs_err(&path, depth - 1, cutoff_secs, found);
            } else if path
                .file_name()
                .map(|n| n.to_string_lossy().starts_with("hs_err_pid"))
                .unwrap_or(false)
            {
                if let Ok(meta) = std::fs::metadata(&path) {
                    let age = meta
                        .modified()
                        .unwrap_or(std::time::SystemTime::UNIX_EPOCH)
                        .elapsed()
                        .unwrap_or_default()
                        .as_secs();
                    if age < cutoff_secs {
                        found.push(path.to_string_lossy().to_string());
                    }
                }
            }
        }
    }

    scan_for_hs_err(&instances_dir, 3, cutoff_secs, &mut found_crashes);

    result.technical = Some(format!(
        "searched_in={}\ncrashes_found={}\nfiles=[{}]",
        instances_dir.display(),
        found_crashes.len(),
        found_crashes.join(", ")
    ));

    if found_crashes.is_empty() {
        result.status = CheckStatus::Pass;
        result.detail = Some("No se encontraron crashes de JVM en las últimas 24 horas".to_string());
    } else {
        result.status = CheckStatus::Fail;
        result.detail = Some(format!(
            "{} crash(es) de JVM encontrado(s) en las últimas 24h. Revisa los archivos hs_err_pid*.log para más detalles.",
            found_crashes.len()
        ));
    }

    result
}

/// Verifica que la versión de Java configurada sea compatible con las instancias instaladas.
/// Java 8 no puede correr MC 1.17+, Java 17+ no puede correr algunos Forge viejos, etc.
fn check_java_version_compatibility() -> CheckResult {
    let mut result = CheckResult {
        id: "java_version_compatibility".to_string(),
        name: "Compatibilidad Java ↔ Minecraft".to_string(),
        description: "Comprueba que la versión de Java sea compatible con las instancias instaladas.".to_string(),
        status: CheckStatus::Running,
        detail: None,
        technical: None,
        fixable: true,
    };

    // Get configured Java
    let (java_dir, java_version_str) = {
        let config = match get_config_manager().lock() {
            Ok(guard) => guard,
            Err(_) => {
                result.status = CheckStatus::Warn;
                result.detail = Some("No se pudo leer la configuración".to_string());
                return result;
            }
        };
        let cfg = match config.as_ref() {
            Ok(c) => c,
            Err(_) => {
                result.status = CheckStatus::Warn;
                result.detail = Some("Error de configuración".to_string());
                return result;
            }
        };
        let dir = match cfg.get_java_dir() {
            Some(d) => d,
            None => {
                result.status = CheckStatus::Warn;
                result.detail = Some("No hay Java configurado".to_string());
                return result;
            }
        };
        let java_exe = get_java_executable(&dir);
        let version = JavaManager::new()
            .ok()
            .and_then(|jm| jm.get_java_version(&java_exe).ok());
        (dir, version)
    };

    let java_major: Option<u32> = java_version_str.as_deref().and_then(|v| {
        // Supports "1.8.0_xxx" (Java 8) and "17.0.x", "21.0.x" formats
        let first = v.split('.').next()?;
        let n: u32 = first.parse().ok()?;
        // Normalize: "1" means Java 8 in old versioning
        Some(if n == 1 { 8 } else { n })
    });

    // Get all instances to check their MC versions
    let instances = match crate::core::instance_manager::get_all_instances() {
        Ok(i) => i,
        Err(_) => {
            result.status = CheckStatus::Warn;
            result.detail = Some("No se pudieron cargar las instancias".to_string());
            return result;
        }
    };

    if instances.is_empty() {
        result.status = CheckStatus::Pass;
        result.detail = Some("No hay instancias instaladas".to_string());
        result.technical = Some("instances=0".to_string());
        return result;
    }

    let java_major_val = match java_major {
        Some(v) => v,
        None => {
            result.status = CheckStatus::Warn;
            result.detail = Some("No se pudo determinar la versión de Java".to_string());
            result.technical = Some(format!("java_dir={}\nraw_version={:?}", java_dir.display(), java_version_str));
            return result;
        }
    };

    // Check each instance for compatibility
    // Rules:
    //   MC 1.17+  requires Java 16+  (officially 17)
    //   MC 1.20.5+ requires Java 21+
    //   MC < 1.17  works best with Java 8 or 11; Java 21 may break some Forge versions
    let mut incompatible: Vec<String> = Vec::new();
    let mut warnings: Vec<String> = Vec::new();

    for instance in &instances {
        let mc_ver = &instance.minecraftVersion;
        if mc_ver.is_empty() {
            continue;
        }

        // Parse major.minor from "1.X.Y" or "1.X"
        let parts: Vec<u32> = mc_ver
            .split('.')
            .filter_map(|p| p.parse().ok())
            .collect();

        if parts.len() < 2 {
            continue;
        }

        let minor = parts[1]; // e.g. 17, 20, 21
        let patch = parts.get(2).copied().unwrap_or(0);

        if minor >= 20 && patch >= 5 {
            // MC 1.20.5+ requires Java 21+
            if java_major_val < 21 {
                incompatible.push(format!(
                    "{} (MC {}) necesita Java 21+, tienes Java {}",
                    instance.instanceName, mc_ver, java_major_val
                ));
            }
        } else if minor >= 17 {
            // MC 1.17+ requires Java 17+
            if java_major_val < 17 {
                incompatible.push(format!(
                    "{} (MC {}) necesita Java 17+, tienes Java {}",
                    instance.instanceName, mc_ver, java_major_val
                ));
            }
        } else {
            // MC < 1.17: warn if Java > 17 (can break some old Forge/mods)
            if java_major_val > 17 {
                warnings.push(format!(
                    "{} (MC {}) puede tener problemas con Java {} (recomendado: Java 8 u 11)",
                    instance.instanceName, mc_ver, java_major_val
                ));
            }
        }
    }

    result.technical = Some(format!(
        "java_major={}\njava_version={}\ninstances={}\nincompatible={}\nwarnings={}",
        java_major_val,
        java_version_str.as_deref().unwrap_or("unknown"),
        instances.len(),
        incompatible.len(),
        warnings.len()
    ));

    if !incompatible.is_empty() {
        result.status = CheckStatus::Fail;
        result.detail = Some(format!(
            "{} instancia(s) incompatible(s) con Java {}: {}",
            incompatible.len(),
            java_major_val,
            incompatible.first().map(|s| s.as_str()).unwrap_or("")
        ));
    } else if !warnings.is_empty() {
        result.status = CheckStatus::Warn;
        result.detail = Some(format!(
            "Java {} puede causar problemas en {} instancia(s) antigua(s)",
            java_major_val,
            warnings.len()
        ));
    } else {
        result.status = CheckStatus::Pass;
        result.detail = Some(format!(
            "Java {} es compatible con todas las instancias instaladas",
            java_major_val
        ));
    }

    result
}

// ── Helpers ────────────────────────────────────────

fn get_java_executable(java_dir: &Path) -> PathBuf {
    if cfg!(target_os = "windows") {
        let exe = java_dir.join("bin").join("java.exe");
        if exe.exists() {
            return exe;
        }
        let exe2 = java_dir.join("bin").join("javaw.exe");
        if exe2.exists() {
            return exe2;
        }
        exe
    } else {
        let exe = java_dir.join("bin").join("java");
        if exe.exists() {
            return exe;
        }
        let bundle_exe = java_dir.join("Contents").join("Home").join("bin").join("java");
        if bundle_exe.exists() {
            return bundle_exe;
        }
        exe
    }
}

#[cfg(target_os = "windows")]
fn disk_free_space(path: &Path) -> Option<u64> {
    use std::os::windows::ffi::OsStrExt;

    let wide: Vec<u16> = path
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();

    extern "system" {
        fn GetDiskFreeSpaceExW(
            lpDirectoryName: *const u16,
            lpFreeBytesAvailableToCaller: *mut u64,
            lpTotalNumberOfBytes: *mut u64,
            lpTotalNumberOfFreeBytes: *mut u64,
        ) -> i32;
    }

    let mut free_bytes: u64 = 0;
    let mut total_bytes: u64 = 0;
    let mut total_free: u64 = 0;

    let success = unsafe {
        GetDiskFreeSpaceExW(
            wide.as_ptr(),
            &mut free_bytes,
            &mut total_bytes,
            &mut total_free,
        )
    };

    if success != 0 {
        Some(free_bytes)
    } else {
        None
    }
}

#[cfg(not(target_os = "windows"))]
fn disk_free_space(_path: &Path) -> Option<u64> {
    None
}
