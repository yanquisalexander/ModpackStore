use anyhow::Result;
use std::path::PathBuf;
use tauri::AppHandle;

/// Contrato para proveedores de túneles (Playit, Cloudflared, etc.)
pub trait TunnelProvider {
    /// Obtiene el nombre del proveedor
    fn name(&self) -> &str;

    /// Obtiene la ruta al binario
    fn get_binary_path(&self, app_handle: &AppHandle) -> Result<PathBuf>;

    /// Instala el binario si no existe
    async fn install(&self, app_handle: &AppHandle) -> Result<PathBuf>;

    /// Inicia el túnel para una instancia
    async fn start(
        &self,
        app_handle: &AppHandle,
        instance_id: &str,
        instance_path: &PathBuf,
    ) -> Result<tokio::process::Child>;
}
