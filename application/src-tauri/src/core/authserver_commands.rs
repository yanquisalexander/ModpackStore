use crate::core::authlib_injector::AuthlibInjectorManager;
use crate::core::game_session_manager::GameSessionManager;
use crate::core::minecraft_instance::MinecraftInstance;

/// Check if authlib-injector is downloaded
#[tauri::command]
pub async fn check_authlib_injector_status() -> Result<bool, String> {
    let manager = AuthlibInjectorManager::new()?;
    Ok(manager.is_downloaded())
}

/// Download authlib-injector if not already present
#[tauri::command]
pub async fn download_authlib_injector() -> Result<String, String> {
    let manager = AuthlibInjectorManager::new()?;
    manager.ensure_downloaded().await?;
    Ok(manager.get_jar_path().to_string_lossy().to_string())
}

/// Check if an instance uses Modpack Store account
#[tauri::command]
pub fn instance_uses_ms_account(instance: MinecraftInstance) -> Result<bool, String> {
    Ok(GameSessionManager::uses_ms_account(&instance))
}

/// Get authlib-injector path
#[tauri::command]
pub fn get_authlib_injector_path() -> Result<String, String> {
    let manager = AuthlibInjectorManager::new()?;
    Ok(manager.get_jar_path().to_string_lossy().to_string())
}

/// Validate that a game session can be created for the current user
#[tauri::command]
pub async fn validate_ms_account_login() -> Result<bool, String> {
    use crate::core::auth::storage;
    use crate::GLOBAL_APP_HANDLE;

    // Check if user is logged in
    let app_handle = {
        let binding = GLOBAL_APP_HANDLE.lock().unwrap();
        binding
            .as_ref()
            .ok_or("AppHandle not initialized")?
            .clone()
    };

    let tokens = storage::load_tokens(&app_handle)
        .await
        .map_err(|e| format!("Failed to load auth tokens: {}", e))?;

    Ok(tokens.is_some())
}
