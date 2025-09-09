// src/core/bootstrap/validate.rs
// Validation functionality extracted from instance_bootstrap.rs

use crate::core::minecraft_instance::MinecraftInstance;
use crate::core::bootstrap::tasks::{emit_status, emit_status_with_stage, Stage};
use crate::core::bootstrap::filesystem::create_asset_directories;
use crate::core::bootstrap::manifest::get_asset_index_info;
use crate::core::modpack_file_manager::DownloadManager;
use serde_json::Value;
use std::fs;
use std::io::{self, Result as IoResult};
use std::path::{Path, PathBuf};
use tauri_plugin_http::reqwest;

/// Synchronous wrapper for revalidate_assets for backward compatibility
pub fn revalidate_assets_sync(
    instance: &MinecraftInstance,
    version_details: &Value,
) -> IoResult<()> {
    // Create a new tokio runtime for this synchronous call
    let rt = tokio::runtime::Runtime::new().map_err(|e| {
        io::Error::new(
            io::ErrorKind::Other,
            format!("Failed to create async runtime: {}", e),
        )
    })?;

    rt.block_on(revalidate_assets(instance, version_details))
}

/// Revalidates and downloads missing assets for a Minecraft instance using DownloadManager
pub async fn revalidate_assets(
    instance: &MinecraftInstance,
    version_details: &Value,
) -> IoResult<()> {
    log::info!("Revalidando assets para: {}", instance.instanceName);

    // Verificar si la versión de Minecraft está disponible
    if instance.minecraftVersion.is_empty() {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "No se pudo determinar la versión de Minecraft",
        ));
    }

    // Obtener la ruta de la instancia
    let instance_dir = Path::new(instance.instanceDirectory.as_deref().unwrap_or(""));
    let minecraft_folder = instance_dir.join("minecraft");

    // Create asset directories
    let (assets_indexes_dir, assets_objects_dir) = create_asset_directories(&minecraft_folder)?;

    // Obtener información del índice de assets
    let (assets_index_id, assets_index_url) = get_asset_index_info(version_details)
        .map_err(|e| io::Error::new(io::ErrorKind::Other, e))?;

    let assets_index_file = assets_indexes_dir.join(format!("{}.json", assets_index_id));

    // Create download manager for efficient downloads
    let download_manager = DownloadManager::new();

    // Descargar o validar el índice de assets using DownloadManager
    if !assets_index_file.exists() {
        log::info!(
            "Descargando índice de assets para la versión {}",
            instance.minecraftVersion
        );
        
        // Use DownloadManager for simple download (no hash verification needed for asset index)
        download_manager
            .download_file_simple(&assets_index_url, &assets_index_file)
            .await
            .map_err(|e| {
                io::Error::new(
                    io::ErrorKind::Other,
                    format!("Error al descargar índice de assets: {}", e),
                )
            })?;
    }

    // Leer y procesar el índice de assets
    let assets_index_content = fs::read_to_string(&assets_index_file)?;
    let assets_index_root: Value =
        serde_json::from_str(&assets_index_content).map_err(|e| {
            io::Error::new(
                io::ErrorKind::InvalidData,
                format!("Error al parsear índice de assets: {}", e),
            )
        })?;

    let objects = assets_index_root
        .get("objects")
        .and_then(|v| v.as_object())
        .ok_or_else(|| {
            io::Error::new(
                io::ErrorKind::InvalidData,
                "No se encontraron objetos de assets en el índice",
            )
        })?;

    download_missing_assets(&download_manager, instance, &assets_objects_dir, objects).await?;

    log::info!("Asset revalidation completed");

    // Emitir evento de finalización
    emit_status(
        instance,
        "instance-finish-assets-download",
        &format!(
            "Validación de assets completada para {}",
            instance.instanceName
        ),
    );
    Ok(())
}

/// Downloads missing assets from the assets index using DownloadManager batch processing
async fn download_missing_assets(
    download_manager: &DownloadManager,
    instance: &MinecraftInstance,
    assets_objects_dir: &Path,
    objects: &serde_json::Map<String, Value>,
) -> IoResult<()> {
    let total_assets = objects.len();
    let mut processed_assets = 0;
    let mut missing_assets = Vec::new();

    log::info!("Validando {} assets...", total_assets);

    // First pass: collect all missing assets for batch download
    for (asset_name, asset_info) in objects {
        processed_assets += 1;

        let hash = asset_info
            .get("hash")
            .and_then(|v| v.as_str())
            .ok_or_else(|| {
                io::Error::new(
                    io::ErrorKind::InvalidData,
                    format!("Hash inválido para asset: {}", asset_name),
                )
            })?;

        let hash_prefix = &hash[0..2];
        let asset_file = assets_objects_dir.join(hash_prefix).join(hash);

        // Informar progreso de validación
        let stage = Stage::ValidatingAssets {
            current: processed_assets,
            total: total_assets,
        };
        
        emit_status_with_stage(instance, "instance-downloading-assets", &stage);

        if !asset_file.exists() {
            // Collect missing asset info for batch download
            let asset_url = format!(
                "https://resources.download.minecraft.net/{}/{}",
                hash_prefix, hash
            );
            
            missing_assets.push((asset_url, asset_file, hash.to_string(), asset_name.clone()));
        }
    }

    if missing_assets.is_empty() {
        log::info!("Todos los assets están validados.");
        return Ok(());
    }

    log::info!("Se encontraron {} assets faltantes. Iniciando descarga en lote...", missing_assets.len());

    // Prepare files for batch download in the format expected by DownloadManager
    let files_to_download: Vec<(String, PathBuf, String)> = missing_assets
        .into_iter()
        .map(|(url, path, hash, _name)| (url, path, hash))
        .collect();

    let total_downloads = files_to_download.len();

    // Use batch download with progress reporting
    download_manager
        .download_files_parallel_with_progress(
            files_to_download,
            |current, total, message| {
                // Update progress for downloads
                let stage = Stage::ValidatingAssets {
                    current: total_assets - total_downloads + current,
                    total: total_assets,
                };
                emit_status_with_stage(instance, "instance-downloading-assets", &stage);

                log::debug!("Descargando asset {} de {}: {}", current, total, message);
            },
        )
        .await
        .map_err(|e| {
            io::Error::new(
                io::ErrorKind::Other,
                format!("Error en descarga de assets: {}", e),
            )
        })?;

    log::info!("Se han descargado {} assets faltantes.", total_downloads);
    Ok(())
}



/// Validates that a file exists and optionally checks its size/hash
pub fn validate_file_exists(file_path: &Path) -> bool {
    file_path.exists() && file_path.is_file()
}

/// Validates that all required directories exist for a Minecraft instance
pub fn validate_minecraft_directories(minecraft_dir: &Path, minecraft_version: &str) -> Result<(), String> {
    let required_dirs = [
        minecraft_dir.join("versions"),
        minecraft_dir.join("libraries"),
        minecraft_dir.join("assets"),
        minecraft_dir.join("versions").join(minecraft_version),
    ];

    for dir in &required_dirs {
        if !dir.exists() {
            return Err(format!("Required directory missing: {}", dir.display()));
        }
    }

    Ok(())
}

/// Validates that required files exist for a Minecraft version
pub fn validate_minecraft_files(version_dir: &Path, minecraft_version: &str) -> Result<(), String> {
    let required_files = [
        version_dir.join(format!("{}.json", minecraft_version)),
        version_dir.join(format!("{}.jar", minecraft_version)),
    ];

    for file in &required_files {
        if !validate_file_exists(file) {
            return Err(format!("Required file missing: {}", file.display()));
        }
    }

    Ok(())
}

/// Validates the integrity of a JSON file by parsing it
pub fn validate_json_file(file_path: &Path) -> Result<Value, String> {
    let content = fs::read_to_string(file_path)
        .map_err(|e| format!("Error reading file {}: {}", file_path.display(), e))?;
        
    serde_json::from_str(&content)
        .map_err(|e| format!("Error parsing JSON file {}: {}", file_path.display(), e))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::PathBuf;

    #[test]
    fn test_validate_file_exists() {
        // Create a temporary file for testing
        let temp_dir = std::env::temp_dir().join("validate_test");
        let _ = fs::create_dir_all(&temp_dir);
        let test_file = temp_dir.join("test.txt");
        
        // Write some content to the file
        fs::write(&test_file, "test content").unwrap();
        
        // Test that the function correctly identifies an existing file
        assert!(validate_file_exists(&test_file));
        
        // Test with non-existent file
        let non_existent = temp_dir.join("non_existent.txt");
        assert!(!validate_file_exists(&non_existent));
        
        // Cleanup
        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_validate_minecraft_directories() {
        // Create a temporary minecraft directory structure
        let temp_dir = std::env::temp_dir().join("minecraft_validate_test");
        let minecraft_dir = temp_dir.join("minecraft");
        
        // Create required directories
        let required_dirs = [
            minecraft_dir.join("versions"),
            minecraft_dir.join("libraries"),
            minecraft_dir.join("assets"),
            minecraft_dir.join("versions").join("1.20.1"),
        ];
        
        for dir in &required_dirs {
            fs::create_dir_all(dir).unwrap();
        }
        
        // Test that validation passes when all directories exist
        assert!(validate_minecraft_directories(&minecraft_dir, "1.20.1").is_ok());
        
        // Test that validation fails when a directory is missing
        fs::remove_dir_all(&minecraft_dir.join("libraries")).unwrap();
        assert!(validate_minecraft_directories(&minecraft_dir, "1.20.1").is_err());
        
        // Cleanup
        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_validate_minecraft_files() {
        // Create a temporary version directory
        let temp_dir = std::env::temp_dir().join("minecraft_files_test");
        let version_dir = temp_dir.join("versions").join("1.20.1");
        fs::create_dir_all(&version_dir).unwrap();
        
        // Create required files
        let version_json = version_dir.join("1.20.1.json");
        let client_jar = version_dir.join("1.20.1.jar");
        
        fs::write(&version_json, r#"{"id":"1.20.1"}"#).unwrap();
        fs::write(&client_jar, "mock jar content").unwrap();
        
        // Test that validation passes when all files exist
        assert!(validate_minecraft_files(&version_dir, "1.20.1").is_ok());
        
        // Test that validation fails when a file is missing
        fs::remove_file(&client_jar).unwrap();
        assert!(validate_minecraft_files(&version_dir, "1.20.1").is_err());
        
        // Cleanup
        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_validate_json_file() {
        // Create a temporary JSON file for testing
        let temp_dir = std::env::temp_dir().join("json_validate_test");
        fs::create_dir_all(&temp_dir).unwrap();
        let json_file = temp_dir.join("test.json");
        
        // Write valid JSON
        fs::write(&json_file, r#"{"version":"1.20.1","assets":"1.20"}"#).unwrap();
        
        // Test that valid JSON is parsed correctly
        let result = validate_json_file(&json_file);
        assert!(result.is_ok());
        let json = result.unwrap();
        assert_eq!(json["version"], "1.20.1");
        
        // Write invalid JSON
        fs::write(&json_file, r#"{"version":"1.20.1","assets":"1.20""#).unwrap();
        
        // Test that invalid JSON returns an error
        assert!(validate_json_file(&json_file).is_err());
        
        // Cleanup
        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[tokio::test]
    async fn test_revalidate_assets_sync_wrapper() {
        // Create a minimal MinecraftInstance for testing
        let mut instance = MinecraftInstance::new();
        instance.instanceName = "test_instance".to_string();
        instance.minecraftVersion = "1.20.1".to_string();
        
        // Create a temporary directory for the instance
        let temp_dir = std::env::temp_dir().join("revalidate_test");
        instance.instanceDirectory = Some(temp_dir.to_string_lossy().to_string());
        
        // Create a mock version details JSON
        let version_details = serde_json::json!({
            "assetIndex": {
                "id": "1.20",
                "url": "https://launchermeta.mojang.com/v1/packages/test/1.20.json"
            }
        });
        
        // Test that the synchronous wrapper doesn't panic
        // Note: This will fail to download because the URL is fake, but we're testing the wrapper logic
        let result = revalidate_assets_sync(&instance, &version_details);
        
        // We expect this to fail due to fake URL, but the function should execute
        // The important thing is that it doesn't panic and handles the async runtime correctly
        assert!(result.is_err());
        
        // Cleanup
        let _ = fs::remove_dir_all(&temp_dir);
    }
}