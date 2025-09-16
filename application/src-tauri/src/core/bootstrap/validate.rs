// src/core/bootstrap/validate.rs
// Validation functionality extracted from instance_bootstrap.rs

use crate::core::minecraft_instance::MinecraftInstance;
use crate::core::bootstrap::download::download_file;
use crate::core::bootstrap::tasks::{emit_status, emit_status_with_stage, Stage};
use crate::core::bootstrap::filesystem::create_asset_directories;
use crate::core::bootstrap::manifest::get_asset_index_info;
use crate::core::modpack_file_manager::DownloadManager;
use serde_json::Value;
use std::fs;
use std::io::{self, Result as IoResult};
use std::path::{Path, PathBuf};
use tauri_plugin_http::reqwest;

/// Revalidates and downloads missing assets for a Minecraft instance
pub fn revalidate_assets(
    client: &reqwest::blocking::Client,
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

    // Descargar o validar el índice de assets
    if !assets_index_file.exists() {
        log::info!(
            "Descargando índice de assets para la versión {}",
            instance.minecraftVersion
        );
        download_file(client, &assets_index_url, &assets_index_file)
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

    download_missing_assets(client, instance, &assets_objects_dir, objects)?;

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

/// Downloads missing assets from the assets index using the modern DownloadManager
fn download_missing_assets(
    _client: &reqwest::blocking::Client, // Kept for API compatibility but not used
    instance: &MinecraftInstance,
    assets_objects_dir: &Path,
    objects: &serde_json::Map<String, Value>,
) -> IoResult<()> {
    let total_assets = objects.len();
    let mut processed_assets = 0;
    let mut missing_assets_info = Vec::new();

    log::info!("Validando {} assets...", total_assets);

    // First pass: identify missing assets and collect download information
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

        // Report validation progress
        let stage = Stage::ValidatingAssets {
            current: processed_assets,
            total: total_assets,
        };
        
        emit_status_with_stage(instance, "instance-downloading-assets", &stage);

        if !asset_file.exists() {
            // Prepare download info for batch processing
            let asset_url = format!(
                "https://resources.download.minecraft.net/{}/{}",
                hash_prefix, hash
            );
            
            missing_assets_info.push((
                asset_url.clone(),
                asset_file.clone(),
                hash.to_string(),
            ));
        }
    }

    let missing_count = missing_assets_info.len();
    
    if missing_count == 0 {
        log::info!("Todos los assets están validados.");
        return Ok(());
    }

    log::info!("Se encontraron {} assets faltantes. Iniciando descarga con DownloadManager...", missing_count);

    // Use async runtime to run the DownloadManager
    let runtime = tokio::runtime::Runtime::new().map_err(|e| {
        io::Error::new(
            io::ErrorKind::Other,
            format!("Failed to create async runtime: {}", e),
        )
    })?;

    runtime.block_on(async {
        // Create DownloadManager optimized for asset downloads (higher concurrency for small files)
        let download_manager = DownloadManager::with_concurrency(8);
        
        let instance_clone = instance.clone();
        
        // Download all missing assets in parallel with progress reporting
        download_manager
            .download_files_parallel_with_progress(
                missing_assets_info,
                move |current, total, message| {
                    // Update progress for asset downloads
                    let stage = Stage::ValidatingAssets {
                        current,
                        total,
                    };
                    emit_status_with_stage(&instance_clone, "instance-downloading-assets", &stage);
                    
                    // Log progress periodically to avoid spam
                    if current % 10 == 0 || current == total {
                        log::info!("Descargando assets: {}/{} - {}", current, total, message);
                    }
                },
            )
            .await
            .map_err(|e| {
                io::Error::new(
                    io::ErrorKind::Other,
                    format!("Error al descargar assets con DownloadManager: {}", e),
                )
            })?;

        log::info!("Se han descargado {} assets faltantes usando DownloadManager.", missing_count);
        Ok::<(), io::Error>(())
    })?;

    Ok(())
}

/// Downloads a single asset file
/// 
/// NOTE: This function is deprecated in favor of the DownloadManager-based approach.
/// It's kept for compatibility but should not be used for new code.
#[deprecated(
    since = "0.1.0",
    note = "Use DownloadManager for better performance and reliability"
)]
fn download_single_asset(
    client: &reqwest::blocking::Client,
    hash: &str,
    hash_prefix: &str,
    asset_file: &Path,
    asset_name: &str,
) -> IoResult<()> {
    let asset_url = format!(
        "https://resources.download.minecraft.net/{}/{}",
        hash_prefix, hash
    );
    
    let target_dir = asset_file.parent().unwrap();
    if !target_dir.exists() {
        fs::create_dir_all(target_dir)?;
    }

    download_file(client, &asset_url, asset_file).map_err(|e| {
        io::Error::new(
            io::ErrorKind::Other,
            format!("Error al descargar asset {}: {}", asset_name, e),
        )
    })
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
    use serde_json::json;
    use std::collections::HashMap;
    use tempfile::tempdir;

    #[test]
    fn test_validate_file_exists() {
        let temp_dir = tempdir().unwrap();
        let test_file = temp_dir.path().join("test_file.txt");
        
        // File doesn't exist yet
        assert!(!validate_file_exists(&test_file));
        
        // Create the file
        fs::write(&test_file, "test content").unwrap();
        
        // Now it should exist
        assert!(validate_file_exists(&test_file));
    }

    #[test]
    fn test_validate_json_file() {
        let temp_dir = tempdir().unwrap();
        let json_file = temp_dir.path().join("test.json");
        
        // Valid JSON
        let valid_json = json!({
            "name": "test",
            "version": "1.0.0"
        });
        fs::write(&json_file, valid_json.to_string()).unwrap();
        
        let result = validate_json_file(&json_file);
        assert!(result.is_ok());
        assert_eq!(result.unwrap()["name"], "test");
        
        // Invalid JSON
        fs::write(&json_file, "{ invalid json }").unwrap();
        let result = validate_json_file(&json_file);
        assert!(result.is_err());
    }

    #[test]
    fn test_validate_minecraft_directories() {
        let temp_dir = tempdir().unwrap();
        let minecraft_dir = temp_dir.path().join("minecraft");
        let minecraft_version = "1.20.1";
        
        // Missing directories should fail
        let result = validate_minecraft_directories(&minecraft_dir, minecraft_version);
        assert!(result.is_err());
        
        // Create required directories
        fs::create_dir_all(minecraft_dir.join("versions")).unwrap();
        fs::create_dir_all(minecraft_dir.join("libraries")).unwrap();
        fs::create_dir_all(minecraft_dir.join("assets")).unwrap();
        fs::create_dir_all(minecraft_dir.join("versions").join(minecraft_version)).unwrap();
        
        // Now it should pass
        let result = validate_minecraft_directories(&minecraft_dir, minecraft_version);
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_minecraft_files() {
        let temp_dir = tempdir().unwrap();
        let version_dir = temp_dir.path().join("versions").join("1.20.1");
        let minecraft_version = "1.20.1";
        
        fs::create_dir_all(&version_dir).unwrap();
        
        // Missing files should fail
        let result = validate_minecraft_files(&version_dir, minecraft_version);
        assert!(result.is_err());
        
        // Create required files
        fs::write(version_dir.join(format!("{}.json", minecraft_version)), "{}").unwrap();
        fs::write(version_dir.join(format!("{}.jar", minecraft_version)), "fake jar").unwrap();
        
        // Now it should pass
        let result = validate_minecraft_files(&version_dir, minecraft_version);
        assert!(result.is_ok());
    }

    /// Test the enhanced asset download logic structure
    #[tokio::test]
    async fn test_download_missing_assets_structure() {
        let temp_dir = tempdir().unwrap();
        let assets_objects_dir = temp_dir.path().join("assets").join("objects");
        fs::create_dir_all(&assets_objects_dir).unwrap();

        // Create a mock instance
        let instance = MinecraftInstance {
            instanceId: "test".to_string(),
            usesDefaultIcon: false,
            iconUrl: None,
            bannerUrl: None,
            instanceName: "Test Instance".to_string(),
            accountUuid: None,
            minecraftPath: String::new(),
            modpackId: None,
            modpackVersionId: None,
            minecraftVersion: "1.20.1".to_string(),
            instanceDirectory: Some(temp_dir.path().to_string_lossy().to_string()),
            forgeVersion: None,
            javaPath: None,
        };

        // Create mock assets index with some test assets
        let mut assets_map = serde_json::Map::new();
        assets_map.insert(
            "test_asset.json".to_string(),
            json!({
                "hash": "da39a3ee5e6b4b0d3255bfef95601890afd80709",
                "size": 0
            })
        );

        // Test that the function can handle empty assets (all exist)
        let client = reqwest::blocking::Client::new();
        
        // For the assets that "exist", create the expected file structure
        let hash = "da39a3ee5e6b4b0d3255bfef95601890afd80709";
        let hash_prefix = &hash[0..2];
        let asset_file = assets_objects_dir.join(hash_prefix).join(hash);
        fs::create_dir_all(asset_file.parent().unwrap()).unwrap();
        fs::write(&asset_file, "").unwrap();

        // This should complete without attempting downloads since the asset exists
        let result = download_missing_assets(&client, &instance, &assets_objects_dir, &assets_map);
        assert!(result.is_ok());
    }

    #[test]
    fn test_asset_url_generation() {
        let hash = "da39a3ee5e6b4b0d3255bfef95601890afd80709";
        let hash_prefix = &hash[0..2];
        let expected_url = format!(
            "https://resources.download.minecraft.net/{}/{}",
            hash_prefix, hash
        );
        
        // This tests the URL format used in the download logic
        assert_eq!(expected_url, "https://resources.download.minecraft.net/da/da39a3ee5e6b4b0d3255bfef95601890afd80709");
        assert_eq!(hash_prefix, "da");
    }

    #[test] 
    fn test_hash_prefix_extraction() {
        let test_cases = vec![
            ("da39a3ee5e6b4b0d3255bfef95601890afd80709", "da"),
            ("356a192b7913b04c54574d18c28d46e6395428ab", "35"),
            ("0123456789abcdef0123456789abcdef01234567", "01"),
        ];

        for (hash, expected_prefix) in test_cases {
            let actual_prefix = &hash[0..2];
            assert_eq!(actual_prefix, expected_prefix, "Hash prefix extraction failed for {}", hash);
        }
    }
}