use super::manager::TunnelManager;
use std::path::PathBuf;
use tauri::{command, AppHandle, State};

#[command]
pub async fn install_tunnel_provider(
    app_handle: AppHandle,
    state: State<'_, TunnelManager>,
    provider: String,
) -> Result<(), String> {
    state
        .install_provider(&app_handle, &provider)
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn start_tunnel(
    app_handle: AppHandle,
    state: State<'_, TunnelManager>,
    instance_id: String,
    instance_path: String,
    provider: String,
) -> Result<(), String> {
    let path = PathBuf::from(instance_path);
    state
        .start_tunnel(&app_handle, instance_id, path, provider)
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn stop_tunnel(
    state: State<'_, TunnelManager>,
    instance_id: String,
) -> Result<(), String> {
    state
        .stop_tunnel(&instance_id)
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub fn get_tunnel_status(state: State<'_, TunnelManager>, instance_id: String) -> Option<String> {
    state.get_tunnel_status(&instance_id)
}
