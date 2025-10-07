use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use zip::ZipArchive;

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
    let file = fs::File::open(mrpack_path)
        .map_err(|e| format!("Failed to open .mrpack file: {}", e))?;

    let mut archive =
        ZipArchive::new(file).map_err(|e| format!("Invalid .mrpack file: {}", e))?;

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

    if !path
        .extension()
        .map_or(false, |ext| ext == "mrpack")
    {
        return Err("File is not a .mrpack file".to_string());
    }

    read_mrpack_manifest(path)
}

#[tauri::command]
pub fn check_mrpack_compatibility(
    manifest: MrpackManifest,
) -> Result<MrpackCompatibility, String> {
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
            if loader == "fabric" { "Fabric" } else { &loader }
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
    let file = fs::File::open(mrpack_path)
        .map_err(|e| format!("Failed to open .mrpack file: {}", e))?;

    let mut archive =
        ZipArchive::new(file).map_err(|e| format!("Invalid .mrpack file: {}", e))?;

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
async fn download_mod_file(
    mod_file: &MrpackFile,
    mods_dir: &Path,
) -> Result<(), String> {
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
            use sha1::{Sha1, Digest};
            let mut hasher = Sha1::new();
            hasher.update(&existing_content);
            let existing_hash = format!("{:x}", hasher.finalize());
            
            if existing_hash == mod_file.hashes.sha1 {
                log::info!("File {} already exists with correct hash, skipping", file_name);
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
                env.client.as_ref().map_or(true, |c| c == "required" || c == "optional")
            })
        })
        .collect();

    log::info!("Downloading {} mods...", client_mods.len());

    // Download mods sequentially to avoid overwhelming the server
    for (i, mod_file) in client_mods.iter().enumerate() {
        log::info!("Downloading mod {}/{}", i + 1, client_mods.len());

        download_mod_file(mod_file, &mods_dir)
            .await
            .map_err(|e| format!("Failed to download {}: {}", mod_file.path, e))?;
    }

    Ok(())
}
