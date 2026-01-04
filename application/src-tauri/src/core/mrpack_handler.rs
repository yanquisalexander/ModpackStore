use serde::{Deserialize, Serialize};
use sha1::{Digest as Sha1Digest, Sha1};
use sha2::{Digest as Sha512Digest, Sha512};
use std::fs;
use std::io::Cursor;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use walkdir::WalkDir;
use zip::write::{FileOptions, ZipWriter};
use zip::ZipArchive;
use crate::core::modpack_file_manager::DownloadManager;
use crate::core::tasks_manager::{update_task, TaskStatus};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct MrpackManifest {
    #[serde(rename = "formatVersion")]
    pub format_version: u32,
    pub game: String,
    #[serde(rename = "versionId")]
    pub version_id: String,
    pub name: String,
    pub summary: Option<String>,
    pub files: Vec<MrpackFile>,
    pub dependencies: MrpackDependencies,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct MrpackFile {
    pub path: String,
    pub hashes: MrpackHashes,
    pub env: Option<MrpackEnv>,
    pub downloads: Vec<String>,
    #[serde(rename = "fileSize")]
    pub file_size: u64,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct MrpackHashes {
    pub sha1: String,
    pub sha512: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct MrpackEnv {
    pub client: Option<String>,
    pub server: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct MrpackDependencies {
    pub minecraft: String,
    pub forge: Option<String>,
    #[serde(rename = "fabric-loader")]
    pub fabric_loader: Option<String>,
    #[serde(rename = "quilt-loader")]
    pub quilt_loader: Option<String>,
    pub neoforge: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct MrpackCompatibility {
    pub is_compatible: bool,
    pub warnings: Vec<String>,
    pub errors: Vec<String>,
    pub loader: String,
    pub minecraft_version: String,
}

pub fn read_mrpack_manifest(mrpack_path: &Path) -> Result<MrpackManifest, String> {
    let file =
        fs::File::open(mrpack_path).map_err(|e| format!("Failed to open .mrpack file: {}", e))?;

    let mut archive = ZipArchive::new(file).map_err(|e| format!("Invalid .mrpack file: {}", e))?;

    let mut manifest_file = archive
        .by_name("modrinth.index.json")
        .map_err(|_| "modrinth.index.json not found in .mrpack".to_string())?;

    let mut manifest_content = String::new();
    manifest_file
        .read_to_string(&mut manifest_content)
        .map_err(|e| format!("Failed to read manifest: {}", e))?;

    let manifest: MrpackManifest = serde_json::from_str(&manifest_content)
        .map_err(|e| format!("Invalid manifest format: {}", e))?;

    Ok(manifest)
}

#[tauri::command]
pub fn validate_mrpack_file(mrpack_path: String) -> Result<MrpackManifest, String> {
    let path = Path::new(&mrpack_path);

    if !path.exists() {
        return Err("File does not exist".to_string());
    }

    if !path.extension().map_or(false, |ext| ext == "mrpack") {
        return Err("File is not a .mrpack file".to_string());
    }

    read_mrpack_manifest(path)
}

#[tauri::command]
pub fn check_mrpack_compatibility(manifest: MrpackManifest) -> Result<MrpackCompatibility, String> {
    let mut warnings = Vec::new();
    let mut errors = Vec::new();

    // Check game type
    if manifest.game != "minecraft" {
        errors.push(format!(
            "Unsupported game type: {}. Only Minecraft is supported.",
            manifest.game
        ));
    }

    // Determine loader
    let loader = if manifest.dependencies.forge.is_some() {
        "forge".to_string()
    } else if manifest.dependencies.fabric_loader.is_some() {
        "fabric".to_string()
    } else if manifest.dependencies.quilt_loader.is_some() {
        "quilt".to_string()
    } else if manifest.dependencies.neoforge.is_some() {
        "neoforge".to_string()
    } else {
        "vanilla".to_string()
    };

    // Check loader compatibility
    if loader != "forge" && loader != "vanilla" {
        errors.push(format!(
            "Solo se admite Forge actualmente. {}, Quilt y NeoForge no están soportados todavía.",
            if loader == "fabric" {
                "Fabric"
            } else {
                &loader
            }
        ));
    }

    // Add warning for optional mods
    let optional_mods: Vec<&MrpackFile> = manifest
        .files
        .iter()
        .filter(|f| {
            f.env.as_ref().map_or(false, |env| {
                env.client.as_ref().map_or(false, |c| c == "optional")
            })
        })
        .collect();

    if !optional_mods.is_empty() {
        warnings.push(format!(
            "Este modpack tiene {} mod(s) opcional(es) que puedes habilitar o deshabilitar durante la instalación.",
            optional_mods.len()
        ));
    }

    let is_compatible = errors.is_empty();

    Ok(MrpackCompatibility {
        is_compatible,
        warnings,
        errors,
        loader,
        minecraft_version: manifest.dependencies.minecraft.clone(),
    })
}

/// Extract overrides from .mrpack to instance directory
pub fn extract_mrpack_overrides(mrpack_path: &Path, instance_dir: &Path) -> Result<(), String> {
    let file =
        fs::File::open(mrpack_path).map_err(|e| format!("Failed to open .mrpack file: {}", e))?;

    let mut archive = ZipArchive::new(file).map_err(|e| format!("Invalid .mrpack file: {}", e))?;

    // Extract to minecraft/ subdirectory to match standard instance structure
    let minecraft_dir = instance_dir.join("minecraft");

    // Extract all files from "overrides/" directory
    for i in 0..archive.len() {
        let mut file = archive
            .by_index(i)
            .map_err(|e| format!("Failed to read file from archive: {}", e))?;

        let file_path = file.name().to_string();

        // Only extract files from overrides/
        if file_path.starts_with("overrides/") {
            // Remove "overrides/" prefix
            let relative_path = file_path.strip_prefix("overrides/").unwrap();

            if relative_path.is_empty() {
                continue;
            }

            let output_path = minecraft_dir.join(relative_path);

            // Create parent directories if needed
            if let Some(parent) = output_path.parent() {
                fs::create_dir_all(parent)
                    .map_err(|e| format!("Failed to create directory: {}", e))?;
            }

            // Extract file
            if file_path.ends_with('/') {
                // It's a directory
                fs::create_dir_all(&output_path)
                    .map_err(|e| format!("Failed to create directory: {}", e))?;
            } else {
                // It's a file
                let mut output_file = fs::File::create(&output_path)
                    .map_err(|e| format!("Failed to create file: {}", e))?;

                std::io::copy(&mut file, &mut output_file)
                    .map_err(|e| format!("Failed to extract file: {}", e))?;
            }
        }
    }

    Ok(())
}

/// Download a single mod file from Modrinth
async fn download_mod_file(mod_file: &MrpackFile, mods_dir: &Path) -> Result<(), String> {
    // Create mods directory if it doesn't exist
    fs::create_dir_all(mods_dir).map_err(|e| format!("Failed to create mods directory: {}", e))?;

    let file_name = Path::new(&mod_file.path)
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or("Invalid file name")?;

    let output_path = mods_dir.join(file_name);

    // Skip if file already exists with correct hash
    if output_path.exists() {
        if let Ok(existing_content) = fs::read(&output_path) {
            use sha1::{Digest, Sha1};
            let mut hasher = Sha1::new();
            hasher.update(&existing_content);
            let existing_hash = format!("{:x}", hasher.finalize());

            if existing_hash == mod_file.hashes.sha1 {
                log::info!(
                    "File {} already exists with correct hash, skipping",
                    file_name
                );
                return Ok(());
            }
        }
    }

    // Try each download URL until one succeeds
    let mut last_error = None;
    for download_url in &mod_file.downloads {
        match download_file_from_url(download_url, &output_path).await {
            Ok(_) => {
                log::info!("Downloaded {} successfully", file_name);
                return Ok(());
            }
            Err(e) => {
                log::warn!("Failed to download from {}: {}", download_url, e);
                last_error = Some(e);
            }
        }
    }

    Err(last_error.unwrap_or_else(|| "All download URLs failed".to_string()))
}

/// Download file from URL
async fn download_file_from_url(url: &str, output_path: &Path) -> Result<(), String> {
    use tauri_plugin_http::reqwest;

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let response = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("Failed to download file: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("HTTP error: {}", response.status()));
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Failed to read response: {}", e))?;

    let mut file =
        fs::File::create(output_path).map_err(|e| format!("Failed to create file: {}", e))?;

    file.write_all(&bytes)
        .map_err(|e| format!("Failed to write file: {}", e))?;

    Ok(())
}

/// Download all mods from manifest
pub async fn download_mrpack_mods(
    manifest: &MrpackManifest,
    instance_dir: &Path,
    task_id: Option<String>,
) -> Result<(), String> {
    // Download to minecraft/mods/ subdirectory to match standard instance structure
    let mods_dir = instance_dir.join("minecraft").join("mods");

    // Filter client-side mods
    let client_mods: Vec<&MrpackFile> = manifest
        .files
        .iter()
        .filter(|f| {
            // Include if:
            // - No env specified (required for both)
            // - client is "required"
            // - client is not "unsupported"
            f.env.as_ref().map_or(true, |env| {
                env.client
                    .as_ref()
                    .map_or(true, |c| c == "required" || c == "optional")
            })
        })
        .collect();

    log::info!("Downloading {} mods...", client_mods.len());

    // Prepare files for DownloadManager
    let mut files_to_download = Vec::new();
    
    for mod_file in &client_mods {
        let file_name = Path::new(&mod_file.path)
            .file_name()
            .and_then(|n| n.to_str())
            .ok_or("Invalid file name")?;
            
        let output_path = mods_dir.join(file_name);
        
        // Use the first download URL available
        if let Some(url) = mod_file.downloads.first() {
            files_to_download.push((
                url.clone(),
                output_path,
                mod_file.hashes.sha1.clone()
            ));
        } else {
            log::warn!("No download URL for mod: {}", mod_file.path);
        }
    }

    if files_to_download.is_empty() {
        return Ok(());
    }

    // Use DownloadManager
    let download_manager = DownloadManager::with_concurrency(4);
    let task_id_clone = task_id.clone();

    download_manager.download_files_parallel_with_progress(
        files_to_download,
        move |current, total, message| {
            if let Some(ref tid) = task_id_clone {
                // Map progress to 20-30% range (approximate)
                let progress = 20.0 + ((current as f32 / total as f32) * 10.0);
                update_task(
                    tid,
                    TaskStatus::Running,
                    progress,
                    &format!("Descargando mods: {} ({}/{})", message, current, total),
                    None,
                );
            }
        }
    ).await.map_err(|e| format!("Failed to download mods: {}", e))?;

    Ok(())
}

/// Calculate SHA1 hash of a file
fn calculate_sha1(path: &Path) -> Result<String, String> {
    let mut file = fs::File::open(path).map_err(|e| format!("Failed to open file: {}", e))?;
    let mut hasher = Sha1::new();
    std::io::copy(&mut file, &mut hasher).map_err(|e| format!("Failed to read file: {}", e))?;
    Ok(format!("{:x}", hasher.finalize()))
}

/// Calculate SHA512 hash of a file
fn calculate_sha512(path: &Path) -> Result<String, String> {
    let mut file = fs::File::open(path).map_err(|e| format!("Failed to open file: {}", e))?;
    let mut hasher = Sha512::new();
    std::io::copy(&mut file, &mut hasher).map_err(|e| format!("Failed to read file: {}", e))?;
    Ok(format!("{:x}", hasher.finalize()))
}

/// Export a local instance to .mrpack format
#[tauri::command]
pub async fn export_instance_to_mrpack(
    instance_id: String,
    output_path: String,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    use crate::core::minecraft_instance::MinecraftInstance;
    use crate::core::tasks_manager;

    log::info!(
        "Starting export of instance {} to {}",
        instance_id,
        output_path
    );

    // Create task for progress tracking
    let task_id = tasks_manager::add_task("Exportando instancia a .mrpack", None);

    // Get instance
    let instance = MinecraftInstance::from_instance_id(&instance_id)
        .ok_or_else(|| "Instance not found".to_string())?;

    // Verify it's a local instance (no modpackId)
    if instance.modpackId.is_some() {
        tasks_manager::update_task(
            &task_id,
            tasks_manager::TaskStatus::Failed,
            0.0,
            "No se pueden exportar instancias de modpacks",
            None,
        );
        return Err("Cannot export modpack instances".to_string());
    }

    tasks_manager::update_task(
        &task_id,
        tasks_manager::TaskStatus::Running,
        10.0,
        "Recopilando información de la instancia...",
        None,
    );

    // Get minecraft directory
    let instance_dir = Path::new(instance.instanceDirectory.as_ref().unwrap());

    // Verify instance directory exists
    if !instance_dir.exists() {
        tasks_manager::update_task(
            &task_id,
            tasks_manager::TaskStatus::Failed,
            0.0,
            "Directorio de instancia no encontrado",
            None,
        );
        return Err(format!(
            "Instance directory does not exist: {}",
            instance_dir.display()
        ));
    }

    let minecraft_dir = instance_dir.join("minecraft");

    if !minecraft_dir.exists() {
        tasks_manager::update_task(
            &task_id,
            tasks_manager::TaskStatus::Failed,
            0.0,
            "Directorio de Minecraft no encontrado",
            None,
        );
        return Err("Minecraft directory not found".to_string());
    }

    tasks_manager::update_task(
        &task_id,
        tasks_manager::TaskStatus::Running,
        20.0,
        "Recorriendo archivos de la instancia...",
        None,
    );

    // Collect all files from the minecraft directory (only essential directories)
    let mut files_to_include = Vec::new();
    let walker = WalkDir::new(&minecraft_dir).into_iter();

    // Essential directories to include
    let essential_dirs = [
        "mods",
        "config",
        "resourcepacks",
        "shaderpacks",
        "datapacks",
        "saves",
    ];

    // Essential files in root minecraft directory
    let essential_root_files = ["options.txt"];

    for entry in walker.filter_map(|e| e.ok()) {
        let path = entry.path();
        if path.is_file() {
            if let Ok(relative_path) = path.strip_prefix(&minecraft_dir) {
                // Check if file is in an essential directory or is an essential root file
                let should_include = if let Some(parent) = relative_path.parent() {
                    let parent_str = parent.to_string_lossy();
                    essential_dirs
                        .iter()
                        .any(|dir| parent_str.starts_with(dir) || parent_str == *dir)
                } else {
                    // Check if it's an essential file in root directory
                    let file_name = relative_path.to_string_lossy();
                    essential_root_files.contains(&file_name.as_ref())
                };

                if should_include {
                    files_to_include.push(relative_path.to_path_buf());
                }
            }
        }
    }

    log::info!("Found {} files to include", files_to_include.len());

    // For local instance export, we don't include files in the manifest's files array
    // since they are stored in overrides/ and copied directamente durante la instalación
    let mrpack_files = Vec::new();

    tasks_manager::update_task(
        &task_id,
        tasks_manager::TaskStatus::Running,
        70.0,
        "Creando manifest...",
        None,
    );

    // Create manifest
    let version_id = format!("local-export-{}", chrono::Utc::now().timestamp());

    let dependencies = MrpackDependencies {
        minecraft: instance.minecraftVersion.clone(),
        forge: instance.forgeVersion.clone(),
        fabric_loader: None,
        quilt_loader: None,
        neoforge: None,
    };

    let manifest = MrpackManifest {
        format_version: 1,
        game: "minecraft".to_string(),
        version_id,
        name: instance.instanceName.clone(),
        summary: Some(format!("Exportado desde ModpackStore")),
        files: mrpack_files,
        dependencies,
    };

    tasks_manager::update_task(
        &task_id,
        tasks_manager::TaskStatus::Running,
        75.0,
        "Creando archivo .mrpack...",
        None,
    );

    // Create ZIP file
    let output = fs::File::create(&output_path)
        .map_err(|e| format!("Failed to create output file: {}", e))?;
    let mut zip = ZipWriter::new(output);
    let options = FileOptions::<()>::default()
        .compression_method(zip::CompressionMethod::Deflated)
        .unix_permissions(0o755);

    // Write manifest
    let manifest_json = serde_json::to_string_pretty(&manifest)
        .map_err(|e| format!("Failed to serialize manifest: {}", e))?;

    zip.start_file("modrinth.index.json", options)
        .map_err(|e| format!("Failed to start manifest file: {}", e))?;
    zip.write_all(manifest_json.as_bytes())
        .map_err(|e| format!("Failed to write manifest: {}", e))?;

    tasks_manager::update_task(
        &task_id,
        tasks_manager::TaskStatus::Running,
        80.0,
        &format!(
            "Agregando {} archivos al paquete...",
            files_to_include.len()
        ),
        None,
    );

    // Add all files to overrides/
    for (index, relative_path) in files_to_include.iter().enumerate() {
        let full_path = minecraft_dir.join(relative_path);
        let zip_path = format!(
            "overrides/{}",
            relative_path.to_string_lossy().replace("\\", "/")
        );

        let progress = 80.0 + ((index as f32 / files_to_include.len() as f32) * 15.0);
        if index % 10 == 0 {
            tasks_manager::update_task(
                &task_id,
                tasks_manager::TaskStatus::Running,
                progress,
                &format!(
                    "Empaquetando archivo {}/{}",
                    index + 1,
                    files_to_include.len()
                ),
                None,
            );
        }

        zip.start_file(&zip_path, options)
            .map_err(|e| format!("Failed to start file in zip: {}", e))?;

        let file_content =
            fs::read(&full_path).map_err(|e| format!("Failed to read file: {}", e))?;
        zip.write_all(&file_content)
            .map_err(|e| format!("Failed to write file to zip: {}", e))?;
    }

    tasks_manager::update_task(
        &task_id,
        tasks_manager::TaskStatus::Running,
        95.0,
        "Finalizando archivo...",
        None,
    );

    zip.finish()
        .map_err(|e| format!("Failed to finish zip: {}", e))?;

    tasks_manager::update_task(
        &task_id,
        tasks_manager::TaskStatus::Completed,
        100.0,
        "Instancia exportada correctamente",
        None,
    );

    log::info!("Successfully exported instance to {}", output_path);

    Ok(())
}
