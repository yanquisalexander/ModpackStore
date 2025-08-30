use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use serde::{Deserialize, Serialize};
use crate::core::minecraft_instance::MinecraftInstance;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ModpackManifest {
    pub modpack: ModpackInfo,
    pub version: ModpackVersionInfo,
    pub files: ModpackFiles,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ModpackInfo {
    pub id: String,
    pub name: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ModpackVersionInfo {
    pub id: String,
    pub version: String,
    #[serde(rename = "mcVersion")]
    pub mc_version: String,
    #[serde(rename = "forgeVersion")]
    pub forge_version: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ModpackFiles {
    pub mods: Vec<ModpackFileInfo>,
    pub resourcepacks: Vec<ModpackFileInfo>,
    pub config: Vec<ModpackFileInfo>,
    pub shaderpacks: Vec<ModpackFileInfo>,
    pub extras: Vec<ModpackFileInfo>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ModpackFileInfo {
    pub hash: String,
    pub path: String,
    pub size: u64,
    #[serde(rename = "downloadUrl")]
    pub download_url: String,
}

/// Cleans up obsolete files in the instance directory based on the manifest
pub fn cleanup_obsolete_files(instance: &MinecraftInstance, manifest: &ModpackManifest) -> Result<Vec<String>, String> {
    let instance_dir = instance.instanceDirectory
        .as_ref()
        .ok_or("Instance directory not set")?;
    
    let minecraft_dir = Path::new(instance_dir).join("minecraft");
    if !minecraft_dir.exists() {
        return Ok(vec![]);
    }

    let mut removed_files = Vec::new();
    let categories = ["mods", "resourcepacks", "config", "shaderpacks", "extras"];

    for category in &categories {
        let category_dir = minecraft_dir.join(category);
        if !category_dir.exists() {
            continue;
        }

        // Get expected files from manifest
        let expected_files = get_expected_files_for_category(manifest, category);
        
        // Recursively find all files in the category directory
        let existing_files = find_files_recursively(&category_dir)?;
        
        // Remove files that are not in the manifest
        for file_path in existing_files {
            let relative_path = file_path
                .strip_prefix(&minecraft_dir)
                .map_err(|_| "Failed to get relative path")?
                .to_string_lossy()
                .replace("\\", "/"); // Normalize path separators

            if !expected_files.contains(&relative_path) {
                if let Err(e) = fs::remove_file(&file_path) {
                    eprintln!("Failed to remove file {}: {}", file_path.display(), e);
                } else {
                    removed_files.push(relative_path);
                }
            }
        }

        // Remove empty directories
        remove_empty_directories(&category_dir)?;
    }

    Ok(removed_files)
}

/// Downloads and installs modpack files, reusing existing files when possible
pub async fn download_and_install_files(
    instance: &MinecraftInstance, 
    manifest: &ModpackManifest
) -> Result<usize, String> {
    let instance_dir = instance.instanceDirectory
        .as_ref()
        .ok_or("Instance directory not set")?;
    
    let minecraft_dir = Path::new(instance_dir).join("minecraft");
    fs::create_dir_all(&minecraft_dir)
        .map_err(|e| format!("Failed to create minecraft directory: {}", e))?;

    let mut files_processed = 0;
    let all_files = [
        &manifest.files.mods,
        &manifest.files.resourcepacks,
        &manifest.files.config,
        &manifest.files.shaderpacks,
        &manifest.files.extras,
    ];

    for file_list in all_files {
        for file_info in file_list {
            let target_path = minecraft_dir.join(&file_info.path);
            
            // Create parent directory if needed
            if let Some(parent) = target_path.parent() {
                fs::create_dir_all(parent)
                    .map_err(|e| format!("Failed to create directory {}: {}", parent.display(), e))?;
            }

            // Check if file already exists and has correct hash
            if file_exists_with_correct_hash(&target_path, &file_info.hash).await {
                files_processed += 1;
                continue; // File already exists and is correct, skip download
            }

            // Download the file
            match download_file(&file_info.download_url, &target_path).await {
                Ok(_) => {
                    files_processed += 1;
                }
                Err(e) => {
                    eprintln!("Failed to download file {}: {}", file_info.path, e);
                    // Continue with other files rather than failing completely
                }
            }
        }
    }

    Ok(files_processed)
}

// Helper functions

fn get_expected_files_for_category(manifest: &ModpackManifest, category: &str) -> HashSet<String> {
    let files = match category {
        "mods" => &manifest.files.mods,
        "resourcepacks" => &manifest.files.resourcepacks,
        "config" => &manifest.files.config,
        "shaderpacks" => &manifest.files.shaderpacks,
        "extras" => &manifest.files.extras,
        _ => return HashSet::new(),
    };

    files.iter().map(|f| f.path.clone()).collect()
}

fn find_files_recursively(dir: &Path) -> Result<Vec<PathBuf>, String> {
    let mut files = Vec::new();
    
    let entries = fs::read_dir(dir)
        .map_err(|e| format!("Failed to read directory {}: {}", dir.display(), e))?;

    for entry in entries {
        let entry = entry
            .map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let path = entry.path();

        if path.is_file() {
            files.push(path);
        } else if path.is_dir() {
            files.extend(find_files_recursively(&path)?);
        }
    }

    Ok(files)
}

fn remove_empty_directories(dir: &Path) -> Result<(), String> {
    let entries = fs::read_dir(dir)
        .map_err(|e| format!("Failed to read directory {}: {}", dir.display(), e))?;

    let mut has_files = false;
    let mut subdirs = Vec::new();

    for entry in entries {
        let entry = entry
            .map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let path = entry.path();

        if path.is_file() {
            has_files = true;
        } else if path.is_dir() {
            subdirs.push(path);
        }
    }

    // Recursively process subdirectories
    for subdir in subdirs {
        remove_empty_directories(&subdir)?;
        
        // Check if subdirectory is now empty
        if is_directory_empty(&subdir)? {
            if let Err(e) = fs::remove_dir(&subdir) {
                eprintln!("Failed to remove empty directory {}: {}", subdir.display(), e);
            }
        } else {
            has_files = true;
        }
    }

    Ok(())
}

fn is_directory_empty(dir: &Path) -> Result<bool, String> {
    let entries = fs::read_dir(dir)
        .map_err(|e| format!("Failed to read directory {}: {}", dir.display(), e))?;

    Ok(entries.count() == 0)
}

async fn file_exists_with_correct_hash(file_path: &Path, expected_hash: &str) -> bool {
    if !file_path.exists() {
        return false;
    }

    // Read file and compute hash
    match fs::read(file_path) {
        Ok(contents) => {
            let computed_hash = compute_file_hash(&contents);
            computed_hash == expected_hash
        }
        Err(_) => false,
    }
}

fn compute_file_hash(contents: &[u8]) -> String {
    use md5::{Md5, Digest};
    let mut hasher = Md5::new();
    hasher.update(contents);
    format!("{:x}", hasher.finalize())
}

async fn download_file(url: &str, target_path: &Path) -> Result<(), String> {
    let client = reqwest::Client::new();
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
        .map_err(|e| format!("Failed to read response body: {}", e))?;

    fs::write(target_path, &bytes)
        .map_err(|e| format!("Failed to write file: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn cleanup_instance_files(instance_id: String) -> Result<Vec<String>, String> {
    let instance = crate::core::minecraft_instance::MinecraftInstance::from_instance_id(&instance_id)
        .ok_or("Instance not found")?;

    // Only cleanup modpack instances
    let modpack_id = instance.modpackId
        .as_ref()
        .ok_or("Instance is not a modpack instance")?;

    let version_id = instance.modpackVersionId
        .as_ref()
        .ok_or("Instance does not have a version ID")?;

    // Fetch current manifest
    let manifest = fetch_modpack_manifest(modpack_id, version_id).await?;
    
    // Cleanup obsolete files
    cleanup_obsolete_files(&instance, &manifest)
}

// Helper function to fetch manifest (re-exported from instance_manager)
async fn fetch_modpack_manifest(modpack_id: &str, version_id: &str) -> Result<ModpackManifest, String> {
    crate::core::instance_manager::fetch_modpack_manifest(modpack_id, version_id).await
}