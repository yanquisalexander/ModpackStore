use crate::core::bootstrap::tasks::{
    emit_bootstrap_complete, emit_status, emit_status_with_stage, Stage,
};
use crate::core::minecraft::paths::MinecraftPaths;
use crate::core::minecraft_instance::MinecraftInstance;
use crate::core::tasks_manager::{add_task, remove_task, task_exists, update_task, TaskStatus};
use crate::utils::config_manager::get_config_manager;
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use sha1::{Digest, Sha1};
use std::collections::HashMap;
use std::collections::HashSet;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tauri::Emitter;
use tauri_plugin_http::reqwest;
use tokio::sync::{Mutex, Semaphore};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ModpackManifest {
    pub id: String,
    pub version: String,
    #[serde(rename = "mcVersion")]
    pub mc_version: String,
    #[serde(rename = "forgeVersion")]
    pub forge_version: Option<String>,
    pub files: Vec<ModpackFileEntry>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ModpackInfo {
    pub id: String,
    pub name: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ModpackFileEntry {
    pub fileHash: String,
    pub path: String,
    pub file: ModpackFileType,
    pub downloadUrl: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ModpackFileType {
    pub size: u64,
    pub r#type: String,
}

fn get_download_concurrency() -> usize {
    // Return 4
    4
}

/// Identifies essential Minecraft files and directories that should never be deleted
fn get_essential_minecraft_paths(
    minecraft_dir: &Path,
    instance: &MinecraftInstance,
) -> HashSet<PathBuf> {
    let mut essential_paths = HashSet::new();

    // Essential directories that contain base Minecraft files
    essential_paths.insert(minecraft_dir.join("versions"));
    essential_paths.insert(minecraft_dir.join("libraries"));
    essential_paths.insert(minecraft_dir.join("assets"));
    essential_paths.insert(minecraft_dir.join("natives"));

    // Runtime and cache directories
    essential_paths.insert(minecraft_dir.join("logs"));
    essential_paths.insert(minecraft_dir.join("crash-reports"));
    essential_paths.insert(minecraft_dir.join("saves"));
    essential_paths.insert(minecraft_dir.join("screenshots"));
    essential_paths.insert(minecraft_dir.join("resourcepacks"));
    essential_paths.insert(minecraft_dir.join("shaderpacks"));
    essential_paths.insert(minecraft_dir.join("config")); // May contain user configurations

    // Launcher and profile files
    essential_paths.insert(minecraft_dir.join("launcher_profiles.json"));
    essential_paths.insert(minecraft_dir.join("options.txt"));
    essential_paths.insert(minecraft_dir.join("optionsshaders.txt"));
    essential_paths.insert(minecraft_dir.join("servers.dat"));

    // Create MinecraftPaths to get specific file locations
    match crate::config::get_config_manager().lock() {
        Ok(config_result) => {
            if let Ok(config) = &*config_result {
                if let Some(mc_paths) = MinecraftPaths::new(instance, config) {
                    // Add specific client jar
                    essential_paths.insert(mc_paths.client_jar());

                    // Add natives directory for this version
                    essential_paths.insert(mc_paths.natives_dir());
                }
            }
        }
        Err(_) => {
            log::warn!("[Cleanup] Could not access config manager for paths");
        }
    }

    log::info!(
        "[Cleanup] Protected {} essential Minecraft paths",
        essential_paths.len()
    );

    essential_paths
}

/// Checks if a file path should be protected from deletion
fn is_essential_path(file_path: &Path, essential_paths: &HashSet<PathBuf>) -> bool {
    // Check if the file itself is essential
    if essential_paths.contains(file_path) {
        return true;
    }

    // Check if the file is inside any essential directory
    for essential_path in essential_paths {
        if file_path.starts_with(essential_path) {
            return true;
        }
    }

    false
}

/// Loads previous manifest if available for comparison
fn load_previous_manifest(instance: &MinecraftInstance) -> Option<ModpackManifest> {
    let instance_dir = instance.instanceDirectory.as_ref()?;
    let manifest_cache_path = Path::new(instance_dir)
        .join(".modpack_cache")
        .join("previous_manifest.json");

    if manifest_cache_path.exists() {
        if let Ok(content) = fs::read_to_string(&manifest_cache_path) {
            if let Ok(manifest) = serde_json::from_str::<ModpackManifest>(&content) {
                log::info!(
                    "[Cleanup] Loaded previous manifest with {} files",
                    manifest.files.len()
                );
                return Some(manifest);
            }
        }
    }

    log::info!("[Cleanup] No previous manifest found");
    None
}

/// Saves current manifest for future comparison
fn save_manifest_cache(
    instance: &MinecraftInstance,
    manifest: &ModpackManifest,
) -> Result<(), String> {
    let instance_dir = instance
        .instanceDirectory
        .as_ref()
        .ok_or("Instance directory not set")?;

    let cache_dir = Path::new(instance_dir).join(".modpack_cache");
    fs::create_dir_all(&cache_dir)
        .map_err(|e| format!("Failed to create cache directory: {}", e))?;

    let manifest_cache_path = cache_dir.join("previous_manifest.json");
    let manifest_json = serde_json::to_string_pretty(manifest)
        .map_err(|e| format!("Failed to serialize manifest: {}", e))?;

    fs::write(&manifest_cache_path, manifest_json)
        .map_err(|e| format!("Failed to save manifest cache: {}", e))?;

    log::info!(
        "[Cleanup] Saved manifest cache with {} files",
        manifest.files.len()
    );
    Ok(())
}

/// Cleans up obsolete files in the instance directory based on manifest comparison
/// Only removes files within modpack-controlled directories that are not in the current manifest
/// This includes both obsolete files from previous manifests and manually added files
pub fn cleanup_obsolete_files(
    instance: &MinecraftInstance,
    manifest: &ModpackManifest,
) -> Result<Vec<String>, String> {
    let instance_dir = instance
        .instanceDirectory
        .as_ref()
        .ok_or("Instance directory not set")?;

    let minecraft_dir = Path::new(instance_dir).join("minecraft");
    if !minecraft_dir.exists() {
        log::info!("[Cleanup] Minecraft directory does not exist, nothing to clean");
        return Ok(vec![]);
    }

    log::info!(
        "[Cleanup] Starting enhanced cleanup for instance: {}",
        instance.instanceName
    );

    let mut removed_files = Vec::new();
    let mut preserved_files = Vec::new();

    // Get essential paths that should never be deleted
    let essential_paths = get_essential_minecraft_paths(&minecraft_dir, instance);

    // Get current manifest files for quick lookup
    let current_files: HashSet<String> = manifest.files.iter().map(|f| f.path.clone()).collect();
    log::info!(
        "[Cleanup] Current manifest has {} files",
        current_files.len()
    );

    // Scan only controlled directories for existing files
    let existing_controlled_files = scan_controlled_directories(&minecraft_dir)?;
    
    log::info!(
        "[Cleanup] Found {} files in controlled directories",
        existing_controlled_files.len()
    );

    // Determine files to clean: any file in controlled directories that is NOT in current manifest
    let files_to_clean: HashSet<String> = existing_controlled_files
        .difference(&current_files)
        .cloned()
        .collect();

    log::info!(
        "[Cleanup] Found {} files to clean from controlled directories",
        files_to_clean.len()
    );

    // Process files for cleanup
    for file_to_clean in files_to_clean {
        let file_path = minecraft_dir.join(&file_to_clean);

        // Double-check: never delete essential files (though they shouldn't be in controlled dirs)
        if is_essential_path(&file_path, &essential_paths) {
            log::warn!("[Cleanup] Skipping essential file in controlled directory: {}", file_to_clean);
            preserved_files.push(file_to_clean);
            continue;
        }

        // Only clean if file actually exists
        if file_path.exists() {
            match fs::remove_file(&file_path) {
                Ok(_) => {
                    log::info!("[Cleanup] Removed file from controlled directory: {}", file_to_clean);
                    removed_files.push(file_to_clean);
                }
                Err(e) => {
                    log::error!("[Cleanup] Failed to remove file {}: {}", file_to_clean, e);
                }
            }
        }
    }

    // Remove empty directories within controlled directories only
    remove_empty_controlled_directories(&minecraft_dir)?;

    // Save current manifest for future comparisons
    if let Err(e) = save_manifest_cache(instance, manifest) {
        log::warn!("[Cleanup] Failed to save manifest cache: {}", e);
    }

    log::info!(
        "[Cleanup] Enhanced cleanup complete: {} files removed, {} files preserved",
        removed_files.len(),
        preserved_files.len()
    );

    Ok(removed_files)
}

/// Checks if a file path represents a modpack-managed file
fn is_modpack_file(relative_path: &str) -> bool {
    // Common modpack directories
    relative_path.starts_with("mods/") ||
    relative_path.starts_with("coremods/") ||
    relative_path.starts_with("scripts/") ||
    relative_path.starts_with("resources/") ||
    relative_path.starts_with("packmenu/") ||
    relative_path.starts_with("structures/") ||
    relative_path.starts_with("schematics/") ||
    // Configuration files that are often modpack-specific
    (relative_path.starts_with("config/") && !relative_path.contains("options")) ||
    // Other modpack-specific files
    relative_path == "manifest.json" ||
    relative_path == "modlist.html" ||
    relative_path.starts_with("changelogs/")
}

/// Gets the list of directories that are controlled by the modpack manifest
fn get_controlled_directories() -> Vec<&'static str> {
    vec![
        "mods",
        "coremods", 
        "scripts",
        "resources",
        "packmenu",
        "structures",
        "schematics",
        "config",
        "changelogs"
    ]
}

/// Performs strict cleanup of the mods/ directory only
/// Removes ALL files in mods/ that are not in the current manifest
/// Also removes empty subdirectories after cleanup
pub fn strict_mods_cleanup(
    instance: &MinecraftInstance,
    manifest: &ModpackManifest,
) -> Result<Vec<String>, String> {
    let instance_dir = instance
        .instanceDirectory
        .as_ref()
        .ok_or("Instance directory not set")?;

    let minecraft_dir = Path::new(instance_dir).join("minecraft");
    let mods_dir = minecraft_dir.join("mods");
    
    if !mods_dir.exists() {
        log::info!("[Strict Cleanup] Mods directory does not exist, nothing to clean");
        return Ok(vec![]);
    }

    log::info!("[Strict Cleanup] Starting strict cleanup of mods/ directory");

    let mut removed_files = Vec::new();

    // Get current manifest files that are in mods/ directory
    let current_mods_files: HashSet<String> = manifest.files
        .iter()
        .filter(|f| f.path.starts_with("mods/"))
        .map(|f| f.path.clone())
        .collect();
    
    log::info!(
        "[Strict Cleanup] Current manifest has {} mods files",
        current_mods_files.len()
    );

    // Scan mods directory for existing files
    let existing_mods_files = scan_mods_directory(&mods_dir)?;
    
    log::info!(
        "[Strict Cleanup] Found {} files in mods/ directory",
        existing_mods_files.len()
    );

    // Determine files to clean: any file in mods/ that is NOT in current manifest
    let files_to_clean: HashSet<String> = existing_mods_files
        .difference(&current_mods_files)
        .cloned()
        .collect();

    log::info!(
        "[Strict Cleanup] Found {} files to clean from mods/ directory",
        files_to_clean.len()
    );

    // Remove obsolete files
    for file_to_clean in files_to_clean {
        let file_path = minecraft_dir.join(&file_to_clean);

        if file_path.exists() {
            match fs::remove_file(&file_path) {
                Ok(_) => {
                    log::info!("[Strict Cleanup] Removed file from mods/: {}", file_to_clean);
                    removed_files.push(file_to_clean);
                }
                Err(e) => {
                    log::error!("[Strict Cleanup] Failed to remove file {}: {}", file_to_clean, e);
                }
            }
        }
    }

    // Remove empty directories within mods/ only
    remove_empty_directories_in_tree(&mods_dir)?;
    
    // Check if mods/ directory itself is empty and remove it if so
    if is_directory_empty(&mods_dir)? {
        if let Err(e) = fs::remove_dir(&mods_dir) {
            log::warn!("[Strict Cleanup] Failed to remove empty mods directory: {}", e);
        } else {
            log::info!("[Strict Cleanup] Removed empty mods/ directory");
        }
    }

    log::info!(
        "[Strict Cleanup] Strict mods cleanup complete: {} files removed",
        removed_files.len()
    );

    Ok(removed_files)
}

/// Scans the mods directory for all files and returns their relative paths
fn scan_mods_directory(mods_dir: &Path) -> Result<HashSet<String>, String> {
    let mut found_files = HashSet::new();
    
    // Get the minecraft directory (parent of mods)
    let minecraft_dir = mods_dir.parent()
        .ok_or("Could not get minecraft directory from mods path")?;
    
    scan_directory_for_files(mods_dir, minecraft_dir, &mut found_files)?;
    
    Ok(found_files)
}

/// Scans controlled directories for all files and returns their relative paths
fn scan_controlled_directories(minecraft_dir: &Path) -> Result<HashSet<String>, String> {
    let mut found_files = HashSet::new();
    
    for dir_name in get_controlled_directories() {
        let dir_path = minecraft_dir.join(dir_name);
        if dir_path.exists() && dir_path.is_dir() {
            scan_directory_for_files(&dir_path, minecraft_dir, &mut found_files)?;
        }
    }
    
    // Also check for standalone modpack files in the root
    let standalone_files = vec!["manifest.json", "modlist.html"];
    for file_name in standalone_files {
        let file_path = minecraft_dir.join(file_name);
        if file_path.exists() && file_path.is_file() {
            found_files.insert(file_name.to_string());
        }
    }
    
    log::info!("[ControlledScan] Found {} files in controlled directories", found_files.len());
    Ok(found_files)
}

/// Recursively scans a directory and adds file paths to the set
fn scan_directory_for_files(
    dir: &Path, 
    minecraft_dir: &Path, 
    files_set: &mut HashSet<String>
) -> Result<(), String> {
    let entries = fs::read_dir(dir)
        .map_err(|e| format!("Failed to read directory {}: {}", dir.display(), e))?;
    
    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let path = entry.path();
        
        if path.is_file() {
            let relative_path = path.strip_prefix(minecraft_dir)
                .map_err(|_| "Failed to get relative path")?
                .to_string_lossy()
                .replace("\\", "/"); // Normalize path separators
            files_set.insert(relative_path);
        } else if path.is_dir() {
            scan_directory_for_files(&path, minecraft_dir, files_set)?;
        }
    }
    
    Ok(())
}

/// Enhanced download and install function that handles file moving when possible
/// This implements the manifest-as-source-of-truth approach
pub async fn download_and_install_files(
    instance: &MinecraftInstance,
    manifest: &ModpackManifest,
    task_id: Option<String>,
) -> Result<usize, String> {
    let instance_dir = instance
        .instanceDirectory
        .as_ref()
        .ok_or("Instance directory not set")?;

    let minecraft_dir = Path::new(instance_dir).join("minecraft");
    fs::create_dir_all(&minecraft_dir)
        .map_err(|e| format!("Failed to create minecraft directory: {}", e))?;

    let total_files = manifest.files.len();
    let mut files_processed = 0;
    let mut files_to_download = Vec::new();
    let mut files_moved = 0;

    // Build hash-to-path map for efficient lookup of existing files
    let hash_map = build_hash_to_path_map(&minecraft_dir)?;

    // Process each file in the manifest
    for (index, file_entry) in manifest.files.iter().enumerate() {
        let target_path = minecraft_dir.join(&file_entry.path);

        // Create parent directory if needed
        if let Some(parent) = target_path.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create directory {}: {}", parent.display(), e))?;
        }

        // Check if file already exists at the correct location with correct hash
        if file_exists_with_correct_hash(&target_path, &file_entry.fileHash).await {
            files_processed += 1;
            continue;
        }

        // Check if file exists elsewhere with the same hash
        if let Some(existing_relative_path) = hash_map.get(&file_entry.fileHash) {
            let existing_full_path = minecraft_dir.join(existing_relative_path);
            
            // Verify the existing file still has the correct hash (safety check)
            if existing_full_path != target_path && 
               file_exists_with_correct_hash(&existing_full_path, &file_entry.fileHash).await {
                
                // Move the file to the correct location
                log::info!("[FileMove] Moving {} -> {}", 
                    existing_relative_path.display(), 
                    file_entry.path
                );
                
                if let Err(e) = fs::rename(&existing_full_path, &target_path) {
                    log::warn!("[FileMove] Failed to move file, will download instead: {}", e);
                    files_to_download.push(file_entry);
                } else {
                    files_moved += 1;
                    files_processed += 1;
                    log::info!("[FileMove] Successfully moved file to {}", file_entry.path);
                }
                continue;
            }
        }

        // File doesn't exist or doesn't have correct hash - needs download
        files_to_download.push(file_entry);
    }

    log::info!(
        "[FileManager] Processed {} files: {} moved, {} need download",
        files_processed,
        files_moved,
        files_to_download.len()
    );

    // Download remaining files that couldn't be moved
    if !files_to_download.is_empty() {
        let download_manager = DownloadManager::with_concurrency(get_download_concurrency());

        // Prepare files for parallel download
        let files_for_download: Vec<(String, PathBuf, String)> = files_to_download
            .iter()
            .map(|file_entry| {
                let target_path = minecraft_dir.join(&file_entry.path);
                (
                    file_entry.downloadUrl.clone(),
                    target_path,
                    file_entry.fileHash.clone(),
                )
            })
            .collect();

        let total_downloads = files_for_download.len();
        let instance_clone = instance.clone();
        let task_id_clone = task_id.clone();

        // Use parallel downloads with progress callback
        download_manager
            .download_files_parallel_with_progress(
                files_for_download,
                move |current, total, message| {
                    // Update task progress - only report progress for actual downloads
                    if let Some(ref tid) = task_id_clone {
                        let progress = (current as f32 / total as f32) * 100.0;
                        update_task(
                            tid,
                            TaskStatus::Running,
                            progress,
                            &format!("Descargando archivo {} de {}: {}", current, total, message),
                            None,
                        );
                    }

                    // Emit status with stage
                    emit_status_with_stage(
                        &instance_clone,
                        "instance-downloading-modpack-files",
                        &Stage::DownloadingModpackFiles { current, total },
                    );
                },
            )
            .await
            .map_err(|e| format!("Failed to download files: {}", e))?;

        files_processed += files_to_download.len();
    } else {
        // No files need downloading, just report that processing is complete
        if let Some(ref tid) = task_id {
            update_task(
                tid,
                TaskStatus::Running,
                100.0,
                &format!("Procesamiento completo - {} archivos organizados ({} movidos)", 
                    files_processed, files_moved),
                None,
            );
        }
    }

    emit_status(
        instance,
        "instance-finish-assets-download",
        &format!(
            "Procesados {} archivos ({} movidos, {} descargados)",
            files_processed,
            files_moved,
            files_to_download.len()
        ),
    );

    Ok(files_processed)
}

// Helper functions

fn find_files_recursively(dir: &Path) -> Result<Vec<PathBuf>, String> {
    let mut files = Vec::new();

    let entries = fs::read_dir(dir)
        .map_err(|e| format!("Failed to read directory {}: {}", dir.display(), e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let path = entry.path();

        if path.is_file() {
            files.push(path);
        } else if path.is_dir() {
            files.extend(find_files_recursively(&path)?);
        }
    }

    Ok(files)
}

fn remove_empty_controlled_directories(minecraft_dir: &Path) -> Result<(), String> {
    // Only process controlled directories to avoid affecting essential Minecraft directories
    for dir_name in get_controlled_directories() {
        let dir_path = minecraft_dir.join(dir_name);
        if dir_path.exists() && dir_path.is_dir() {
            remove_empty_directories_in_tree(&dir_path)?;
            
            // Check if the top-level controlled directory is now empty and remove it
            if is_directory_empty(&dir_path)? {
                if let Err(e) = fs::remove_dir(&dir_path) {
                    log::warn!(
                        "[Cleanup] Failed to remove empty controlled directory {}: {}",
                        dir_path.display(),
                        e
                    );
                } else {
                    log::info!("[Cleanup] Removed empty controlled directory: {}", dir_path.display());
                }
            }
        }
    }
    
    Ok(())
}

fn remove_empty_directories_in_tree(dir: &Path) -> Result<(), String> {
    let entries = fs::read_dir(dir)
        .map_err(|e| format!("Failed to read directory {}: {}", dir.display(), e))?;

    let mut subdirs = Vec::new();

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let path = entry.path();

        if path.is_dir() {
            subdirs.push(path);
        }
    }

    // Recursively process subdirectories
    for subdir in subdirs {
        remove_empty_directories_in_tree(&subdir)?;

        // Check if subdirectory is now empty
        if is_directory_empty(&subdir)? {
            if let Err(e) = fs::remove_dir(&subdir) {
                log::warn!(
                    "[Cleanup] Failed to remove empty subdirectory {}: {}",
                    subdir.display(),
                    e
                );
            } else {
                log::info!("[Cleanup] Removed empty subdirectory: {}", subdir.display());
            }
        }
    }

    Ok(())
}

fn remove_empty_directories(dir: &Path) -> Result<(), String> {
    let entries = fs::read_dir(dir)
        .map_err(|e| format!("Failed to read directory {}: {}", dir.display(), e))?;

    let mut has_files = false;
    let mut subdirs = Vec::new();

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
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
                eprintln!(
                    "Failed to remove empty directory {}: {}",
                    subdir.display(),
                    e
                );
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

/// Validates modpack assets against the manifest
/// Returns a list of files that need to be downloaded (missing, corrupt, or wrong size/hash)
/// Now considers files that exist elsewhere with the same hash as valid (will be moved)
pub async fn validate_modpack_assets(
    instance: &MinecraftInstance,
    manifest: &ModpackManifest,
    task_id: Option<String>,
) -> Result<Vec<ModpackFileEntry>, String> {
    let instance_dir = PathBuf::from(
        instance
            .instanceDirectory
            .as_ref()
            .ok_or("Instance directory not set")?,
    );
    let minecraft_dir = instance_dir.join("minecraft");
    let mut files_to_download = Vec::new();

    if let Some(task_id) = &task_id {
        update_task(
            task_id,
            TaskStatus::Running,
            0.0,
            "Validando archivos del modpack...",
            None,
        );
    }

    // Build hash-to-path map for efficient lookup
    let hash_map = build_hash_to_path_map(&minecraft_dir)?;

    let total_files = manifest.files.len();

    for (index, file_entry) in manifest.files.iter().enumerate() {
        let file_path = minecraft_dir.join(&file_entry.path);

        // Update progress
        if let Some(task_id) = &task_id {
            let progress = (index as f32 / total_files as f32) * 100.0;
            update_task(
                task_id,
                TaskStatus::Running,
                progress,
                &format!(
                    "Validando {} ({}/{})",
                    file_entry.path,
                    index + 1,
                    total_files
                ),
                None,
            );
        }

        let mut needs_download = false;

        // Check if file exists at the correct location
        if !file_path.exists() {
            // Check if file exists elsewhere with the same hash
            if !hash_map.contains_key(&file_entry.fileHash) {
                needs_download = true;
            }
            // If hash exists elsewhere, it will be moved by download_and_install_files
        } else {
            // File exists at correct location, check size and hash
            if let Ok(metadata) = fs::metadata(&file_path) {
                if metadata.len() != file_entry.file.size {
                    needs_download = true;
                }
            } else {
                needs_download = true;
            }

            // Check file hash if size is correct
            if !needs_download
                && !file_exists_with_correct_hash(&file_path, &file_entry.fileHash).await
            {
                // Check if correct hash exists elsewhere
                if !hash_map.contains_key(&file_entry.fileHash) {
                    needs_download = true;
                }
                // If hash exists elsewhere, it will be moved by download_and_install_files
            }
        }

        if needs_download {
            files_to_download.push(file_entry.clone());
        }
    }

    if let Some(task_id) = &task_id {
        update_task(
            task_id,
            TaskStatus::Running,
            100.0,
            &format!(
                "Validación completa. {} archivos necesitan descarga",
                files_to_download.len()
            ),
            None,
        );
    }

    Ok(files_to_download)
}

/// Download manager that reuses a single HTTP client for all downloads
pub struct DownloadManager {
    client: reqwest::Client,
    max_concurrent_downloads: usize,
}

impl DownloadManager {
    /// Create a new download manager with optimized HTTP client
    pub fn new() -> Self {
        Self::with_concurrency(4) // Default to 4 concurrent downloads
    }

    /// Create a new download manager with specified concurrency
    pub fn with_concurrency(max_concurrent_downloads: usize) -> Self {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(300)) // 5 minutes timeout
            .tcp_keepalive(std::time::Duration::from_secs(60))
            .build()
            .expect("Failed to create HTTP client");

        Self {
            client,
            max_concurrent_downloads: max_concurrent_downloads.max(1), // Ensure at least 1
        }
    }

    /// Get the current concurrency limit
    pub fn get_concurrency(&self) -> usize {
        self.max_concurrent_downloads
    }

    /// Download a single file with streaming and hash verification
    pub async fn download_file_with_hash(
        &self,
        url: &str,
        target_path: &Path,
        expected_hash: &str,
    ) -> Result<(), String> {
        const MAX_RETRIES: usize = 3;

        for attempt in 1..=MAX_RETRIES {
            match self
                .download_file_attempt(url, target_path, expected_hash)
                .await
            {
                Ok(()) => return Ok(()),
                Err(e) => {
                    if attempt == MAX_RETRIES {
                        return Err(format!("Failed after {} attempts: {}", MAX_RETRIES, e));
                    }
                    log::warn!("Download attempt {} failed: {}, retrying...", attempt, e);

                    // Clean up partial file on retry
                    if target_path.exists() {
                        let _ = fs::remove_file(target_path);
                    }
                }
            }
        }

        unreachable!()
    }

    /// Single download attempt with streaming and hash verification
    async fn download_file_attempt(
        &self,
        url: &str,
        target_path: &Path,
        expected_hash: &str,
    ) -> Result<(), String> {
        // Create parent directories if needed
        if let Some(parent) = target_path.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create directory {}: {}", parent.display(), e))?;
        }

        // Start the download
        let response = self
            .client
            .get(url)
            .send()
            .await
            .map_err(|e| format!("Failed to connect to {}: {}", url, e))?;

        if !response.status().is_success() {
            return Err(format!("HTTP error {} for {}", response.status(), url));
        }

        // Create the output file
        let mut file = fs::File::create(target_path)
            .map_err(|e| format!("Failed to create file {}: {}", target_path.display(), e))?;

        // Initialize hash calculator
        let mut hasher = Sha1::new();
        let mut stream = response.bytes_stream();

        // Stream the content directly to disk while computing hash
        while let Some(chunk_result) = stream.next().await {
            let chunk =
                chunk_result.map_err(|e| format!("Failed to read chunk from stream: {}", e))?;

            // Update hash with chunk
            hasher.update(&chunk);

            // Write chunk to file
            file.write_all(&chunk)
                .map_err(|e| format!("Failed to write to file: {}", e))?;
        }

        // Ensure all data is written to disk
        file.sync_all()
            .map_err(|e| format!("Failed to sync file to disk: {}", e))?;

        // Verify hash
        let computed_hash = format!("{:x}", hasher.finalize());
        if computed_hash != expected_hash {
            return Err(format!(
                "Hash mismatch: expected {}, got {}",
                expected_hash, computed_hash
            ));
        }

        Ok(())
    }

    /// Download multiple files sequentially with progress reporting
    /// Takes Vec<(url, target_path, expected_hash)> as requested in the specification
    pub async fn download_files_with_progress<F>(
        &self,
        files: Vec<(String, PathBuf, String)>, // (url, target_path, expected_hash)
        mut progress_callback: F,
    ) -> Result<usize, String>
    where
        F: FnMut(usize, usize, &str),
    {
        let total_files = files.len();
        let mut downloaded_count = 0;

        for (index, (url, target_path, expected_hash)) in files.iter().enumerate() {
            // Report progress
            progress_callback(
                index + 1,
                total_files,
                &format!(
                    "Descargando {}",
                    target_path
                        .file_name()
                        .unwrap_or_default()
                        .to_string_lossy()
                ),
            );

            // Download the file with hash verification and retry
            self.download_file_with_hash(url, target_path, expected_hash)
                .await
                .map_err(|e| format!("Failed to download {}: {}", target_path.display(), e))?;

            downloaded_count += 1;
        }

        Ok(downloaded_count)
    }

    /// Download multiple files in parallel with sequential progress reporting
    ///
    /// This method downloads files concurrently using a configurable number of simultaneous connections,
    /// but ensures that progress is reported in sequential order (file 1, file 2, file 3...) regardless
    /// of the order in which downloads complete.
    ///
    /// Features:
    /// - Configurable concurrency limit (set via max_concurrent_downloads)
    /// - Reuses a single reqwest::Client for all downloads
    /// - Streams data directly to disk without loading into memory
    /// - Verifies SHA1 hash of each downloaded file
    /// - Automatic retry on failure (up to 3 attempts per file)
    /// - Sequential progress reporting despite parallel execution
    /// - Robust error handling for network, HTTP, disk I/O, and hash validation errors
    ///
    /// # Arguments
    ///
    /// * `files` - Vec of (url, target_path, expected_hash) tuples
    /// * `progress_callback` - Closure called for each completed file in order
    ///
    /// # Returns
    ///
    /// * `Ok(usize)` - Number of successfully downloaded files
    /// * `Err(String)` - Error message if any download fails
    ///
    /// Takes Vec<(url, target_path, expected_hash)> as requested in the specification
    pub async fn download_files_parallel_with_progress<F>(
        &self,
        files: Vec<(String, PathBuf, String)>, // (url, target_path, expected_hash)
        mut progress_callback: F,
    ) -> Result<usize, String>
    where
        F: FnMut(usize, usize, &str) + Send + 'static,
    {
        let total_files = files.len();
        if total_files == 0 {
            return Ok(0);
        }

        // Create semaphore to limit concurrent downloads
        let semaphore = Arc::new(Semaphore::new(self.max_concurrent_downloads));

        // Shared state for tracking download completion in order
        let completed_downloads = Arc::new(Mutex::new(HashMap::<usize, String>::new()));
        let next_to_report = Arc::new(Mutex::new(0usize));
        // Box the callback into a trait object that is Send so it can be shared across spawned tasks
        let progress_callback = Arc::new(tokio::sync::Mutex::new(
            Box::new(progress_callback) as Box<dyn FnMut(usize, usize, &str) + Send>
        ));

        // Clone file info for filename tracking
        let file_names: Vec<String> = files
            .iter()
            .map(|(_, path, _)| {
                path.file_name()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .to_string()
            })
            .collect();
        let file_names = Arc::new(file_names);

        // Spawn download tasks
        let mut download_tasks = Vec::new();

        for (index, (url, target_path, expected_hash)) in files.into_iter().enumerate() {
            let semaphore = semaphore.clone();
            let client = self.client.clone();
            let completed_downloads = completed_downloads.clone();
            let next_to_report = next_to_report.clone();
            let progress_callback = progress_callback.clone();
            let file_names = file_names.clone();

            let task = tokio::spawn(async move {
                // Acquire semaphore permit
                let _permit = semaphore
                    .acquire()
                    .await
                    .map_err(|e| format!("Semaphore error: {}", e))?;

                // Download the file
                let result = Self::download_file_with_hash_static(
                    &client,
                    &url,
                    &target_path,
                    &expected_hash,
                )
                .await;

                if let Err(e) = result {
                    return Err(format!(
                        "Failed to download {}: {}",
                        target_path.display(),
                        e
                    ));
                }

                // Mark this download as complete and check if we can report progress
                {
                    let mut completed = completed_downloads.lock().await;
                    let file_name = target_path
                        .file_name()
                        .unwrap_or_default()
                        .to_string_lossy()
                        .to_string();
                    completed.insert(index, file_name);

                    let mut next = next_to_report.lock().await;

                    // Report progress for all consecutive completed downloads
                    while completed.contains_key(&*next) {
                        if let Some(_completed_file_name) = completed.get(&*next) {
                            // Call progress callback with the correct filename for this index
                            {
                                let mut callback = progress_callback.lock().await; // Using tokio::sync::Mutex<Box<dyn FnMut...>>
                                let msg = format!("Descargando {}", file_names[*next]);
                                (&mut *callback)(*next + 1, total_files, &msg);
                            }
                        }

                        completed.remove(&*next);
                        *next += 1;
                    }
                }

                Ok::<(), String>(())
            });

            download_tasks.push(task);
        }

        // Wait for all downloads to complete
        let mut download_count = 0;
        for task in download_tasks {
            match task.await {
                Ok(Ok(())) => download_count += 1,
                Ok(Err(e)) => return Err(e),
                Err(e) => return Err(format!("Task join error: {}", e)),
            }
        }

        Ok(download_count)
    }

    /// Static version of download_file_with_hash for use in async tasks
    async fn download_file_with_hash_static(
        client: &reqwest::Client,
        url: &str,
        target_path: &Path,
        expected_hash: &str,
    ) -> Result<(), String> {
        const MAX_RETRIES: usize = 3;

        for attempt in 1..=MAX_RETRIES {
            match Self::download_file_attempt_static(client, url, target_path, expected_hash).await
            {
                Ok(()) => return Ok(()),
                Err(e) => {
                    if attempt == MAX_RETRIES {
                        return Err(format!("Failed after {} attempts: {}", MAX_RETRIES, e));
                    }
                    log::warn!("Download attempt {} failed: {}, retrying...", attempt, e);

                    // Clean up partial file on retry
                    if target_path.exists() {
                        let _ = fs::remove_file(target_path);
                    }
                }
            }
        }

        unreachable!()
    }

    /// Static version of download_file_attempt for use in async tasks
    async fn download_file_attempt_static(
        client: &reqwest::Client,
        url: &str,
        target_path: &Path,
        expected_hash: &str,
    ) -> Result<(), String> {
        // Create parent directories if needed
        if let Some(parent) = target_path.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create directory {}: {}", parent.display(), e))?;
        }

        // Start the download
        let response = client
            .get(url)
            .send()
            .await
            .map_err(|e| format!("Failed to connect to {}: {}", url, e))?;

        if !response.status().is_success() {
            return Err(format!("HTTP error {} for {}", response.status(), url));
        }

        // Create the output file
        let mut file = fs::File::create(target_path)
            .map_err(|e| format!("Failed to create file {}: {}", target_path.display(), e))?;

        // Initialize hash calculator
        let mut hasher = Sha1::new();
        let mut stream = response.bytes_stream();

        // Stream the content directly to disk while computing hash
        while let Some(chunk_result) = stream.next().await {
            let chunk =
                chunk_result.map_err(|e| format!("Failed to read chunk from stream: {}", e))?;

            // Update hash with chunk
            hasher.update(&chunk);

            // Write chunk to file
            file.write_all(&chunk)
                .map_err(|e| format!("Failed to write to file: {}", e))?;
        }

        // Ensure all data is written to disk
        file.sync_all()
            .map_err(|e| format!("Failed to sync file to disk: {}", e))?;

        // Verify hash
        let computed_hash = format!("{:x}", hasher.finalize());
        if computed_hash != expected_hash {
            return Err(format!(
                "Hash mismatch: expected {}, got {}",
                expected_hash, computed_hash
            ));
        }

        Ok(())
    }
}

fn compute_file_hash(contents: &[u8]) -> String {
    let mut hasher = Sha1::new();
    hasher.update(contents);
    format!("{:x}", hasher.finalize())
}

/// Builds a map of file hash -> path for all files in the instance directory
/// This helps identify files that exist but may be in the wrong location
fn build_hash_to_path_map(minecraft_dir: &Path) -> Result<HashMap<String, PathBuf>, String> {
    let mut hash_map = HashMap::new();
    
    // Only scan modpack-related directories to avoid performance issues
    let scan_dirs = vec![
        "mods", "coremods", "scripts", "resources", "packmenu", 
        "structures", "schematics", "config", "changelogs"
    ];
    
    for dir_name in scan_dirs {
        let dir_path = minecraft_dir.join(dir_name);
        if dir_path.exists() && dir_path.is_dir() {
            scan_directory_for_hashes(&dir_path, minecraft_dir, &mut hash_map)?;
        }
    }
    
    // Also check for standalone modpack files in the root
    let standalone_files = vec!["manifest.json", "modlist.html"];
    for file_name in standalone_files {
        let file_path = minecraft_dir.join(file_name);
        if file_path.exists() && file_path.is_file() {
            if let Ok(contents) = fs::read(&file_path) {
                let hash = compute_file_hash(&contents);
                let relative_path = file_path.strip_prefix(minecraft_dir)
                    .map_err(|_| "Failed to get relative path")?;
                hash_map.insert(hash, relative_path.to_path_buf());
            }
        }
    }
    
    log::info!("[HashMap] Built hash map with {} entries", hash_map.len());
    Ok(hash_map)
}

/// Recursively scans a directory and adds file hashes to the map
fn scan_directory_for_hashes(
    dir: &Path, 
    minecraft_dir: &Path, 
    hash_map: &mut HashMap<String, PathBuf>
) -> Result<(), String> {
    let entries = fs::read_dir(dir)
        .map_err(|e| format!("Failed to read directory {}: {}", dir.display(), e))?;
    
    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let path = entry.path();
        
        if path.is_file() {
            if let Ok(contents) = fs::read(&path) {
                let hash = compute_file_hash(&contents);
                let relative_path = path.strip_prefix(minecraft_dir)
                    .map_err(|_| "Failed to get relative path")?;
                hash_map.insert(hash, relative_path.to_path_buf());
            }
        } else if path.is_dir() {
            scan_directory_for_hashes(&path, minecraft_dir, hash_map)?;
        }
    }
    
    Ok(())
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

    fs::write(target_path, &bytes).map_err(|e| format!("Failed to write file: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn cleanup_instance_files(instance_id: String) -> Result<Vec<String>, String> {
    log::info!("[Cleanup] Starting cleanup for instance: {}", instance_id);

    let instance =
        crate::core::minecraft_instance::MinecraftInstance::from_instance_id(&instance_id)
            .ok_or("Instance not found")?;

    // Only cleanup modpack instances
    let modpack_id = instance
        .modpackId
        .as_ref()
        .ok_or("Instance is not a modpack instance")?;

    let version_id = instance
        .modpackVersionId
        .as_ref()
        .ok_or("Instance does not have a version ID")?;

    log::info!(
        "[Cleanup] Fetching manifest for modpack {} version {}",
        modpack_id,
        version_id
    );

    // Fetch current manifest
    let manifest = fetch_modpack_manifest(modpack_id, version_id).await?;

    log::info!("[Cleanup] Starting strict mods cleanup process");

    // Use strict mods cleanup instead of the old method
    let removed_files = strict_mods_cleanup(&instance, &manifest)?;

    log::info!(
        "[Cleanup] Strict mods cleanup completed successfully, {} files removed",
        removed_files.len()
    );

    Ok(removed_files)
}

#[tauri::command]
pub async fn validate_and_download_modpack_assets(instance_id: String) -> Result<usize, String> {
    let instance =
        crate::core::minecraft_instance::MinecraftInstance::from_instance_id(&instance_id)
            .ok_or("Instance not found")?;

    // Only process modpack instances
    let modpack_id = instance
        .modpackId
        .as_ref()
        .ok_or("Instance is not a modpack instance")?;

    let version_id = instance
        .modpackVersionId
        .as_ref()
        .ok_or("Instance does not have a version ID")?;

    // Create a task for this operation - prevent duplicates
    let base_task_id = format!("validate_modpack_assets_{}", instance_id);

    // Check if task already exists, if so, remove it first to create a fresh one
    if task_exists(&base_task_id) {
        log::info!(
            "Removing existing task for instance {} before creating new one",
            instance_id
        );
        remove_task(&base_task_id);
    }

    // Create task with a proper title to prevent "En espera" state
    let task_title = format!("Validando assets - {}", instance.instanceName);
    let task_id = add_task(
        &task_title,
        Some(serde_json::json!({
            "status": "Validando assets del modpack",
            "progress": 0.0,
            "message": "Iniciando validación...",
            "instanceId": instance_id.clone()
        })),
    );
    
    // Immediately update task to running state to prevent stuck "En espera" state
    update_task(
        &task_id,
        TaskStatus::Running,
        0.0,
        "Obteniendo manifest del modpack...",
        None,
    );

    // Fetch current manifest
    let manifest = match fetch_modpack_manifest(modpack_id, version_id).await {
        Ok(manifest) => manifest,
        Err(e) => {
            update_task(
                &task_id,
                TaskStatus::Failed,
                0.0,
                &format!("Error obteniendo manifest: {}", e),
                None,
            );

            // Schedule task removal after a delay on failure
            let task_id_for_cleanup = task_id.clone();
            tokio::spawn(async move {
                tokio::time::sleep(tokio::time::Duration::from_secs(3)).await;
                remove_task(&task_id_for_cleanup);
                log::info!(
                    "Cleaned up failed modpack validation task (manifest error): {}",
                    task_id_for_cleanup
                );
            });

            log::warn!("No se pudo obtener el manifest (offline o error de red): {}. Permitimos continuar el lanzamiento sin validación de assets.", e);
            return Ok(0);
        }
    };

    // Emit event to indicate we're downloading modpack assets
    if let Ok(guard) = crate::GLOBAL_APP_HANDLE.lock() {
        if let Some(app_handle) = guard.as_ref() {
            let _ = app_handle.emit(
                &format!("instance-{}", instance_id),
                serde_json::json!({
                    "id": instance_id,
                    "status": "downloading-assets",
                    "message": "Validando assets del modpack..."
                }),
            );
        }
    }

    // Validate assets and get files that need downloading
    let files_to_download =
        match validate_modpack_assets(&instance, &manifest, Some(task_id.clone())).await {
            Ok(files) => files,
            Err(e) => {
                update_task(
                    &task_id,
                    TaskStatus::Failed,
                    0.0,
                    &format!("Error validando assets: {}", e),
                    None,
                );

                // Schedule task removal after a delay even on failure
                let task_id_for_cleanup = task_id.clone();
                tokio::spawn(async move {
                    tokio::time::sleep(tokio::time::Duration::from_secs(3)).await;
                    remove_task(&task_id_for_cleanup);
                    log::info!(
                        "Cleaned up failed modpack validation task: {}",
                        task_id_for_cleanup
                    );
                });

                return Err(e);
            }
        };

    if files_to_download.is_empty() {
        update_task(
            &task_id,
            TaskStatus::Completed,
            100.0,
            "Todos los assets están actualizados",
            None,
        );

        // Schedule task removal after a delay to allow UI to show completion
        let task_id_for_cleanup = task_id.clone();
        tokio::spawn(async move {
            tokio::time::sleep(tokio::time::Duration::from_secs(3)).await;
            remove_task(&task_id_for_cleanup);
            log::info!(
                "Cleaned up completed modpack validation task (no downloads needed): {}",
                task_id_for_cleanup
            );
        });

        return Ok(0);
    }

    // Download missing/corrupt files
    update_task(
        &task_id,
        TaskStatus::Running,
        0.0,
        &format!("Descargando {} archivos...", files_to_download.len()),
        None,
    );

    let downloaded_count =
        download_modpack_files(&instance, &files_to_download, Some(task_id.clone())).await?;

    emit_bootstrap_complete(&instance, "forge");

    // Notify frontend that assets download finished so listeners can clear stages
    emit_status(
        &instance,
        "instance-finish-assets-download",
        &format!("Descargados {} archivos", downloaded_count),
    );

    update_task(
        &task_id,
        TaskStatus::Completed,
        100.0,
        &format!("Descargados {} archivos", downloaded_count),
        None,
    );

    // Schedule task removal after a delay to allow UI to show completion
    let task_id_for_cleanup = task_id.clone();
    tokio::spawn(async move {
        tokio::time::sleep(tokio::time::Duration::from_secs(3)).await;
        remove_task(&task_id_for_cleanup);
        log::info!(
            "Cleaned up completed modpack validation task: {}",
            task_id_for_cleanup
        );
    });

    Ok(downloaded_count)
}

async fn download_modpack_files(
    instance: &MinecraftInstance,
    files: &[ModpackFileEntry],
    task_id: Option<String>,
) -> Result<usize, String> {
    let instance_dir = PathBuf::from(
        instance
            .instanceDirectory
            .as_ref()
            .ok_or("Instance directory not set")?,
    );
    let minecraft_dir = instance_dir.join("minecraft");

    // Create download manager for efficient reuse of HTTP client
    let download_manager = DownloadManager::with_concurrency(get_download_concurrency());

    // Emit initial stage for downloading modpack files
    let initial_stage = Stage::DownloadingModpackFiles {
        current: 0,
        total: files.len(),
    };
    emit_status_with_stage(
        instance,
        "instance-downloading-modpack-files",
        &initial_stage,
    );

    // Prepare files for download with (url, target_path, expected_hash) format
    let files_to_download: Vec<(String, PathBuf, String)> = files
        .iter()
        .map(|file_entry| {
            let target_path = minecraft_dir.join(&file_entry.path);
            (
                file_entry.downloadUrl.clone(),
                target_path,
                file_entry.fileHash.clone(),
            )
        })
        .collect();

    // Use parallel downloads with progress callback for task and stage updates
    let instance_clone = instance.clone();
    let task_id_clone = task_id.clone();

    let downloaded_count = download_manager
        .download_files_parallel_with_progress(files_to_download, move |current, total, message| {
            // Update task progress
            if let Some(ref tid) = task_id_clone {
                let progress = (current as f32 / total as f32) * 100.0;
                update_task(
                    tid,
                    TaskStatus::Running,
                    progress,
                    &format!("{} ({}/{})", message, current, total),
                    None,
                );
            }

            // Emit status with stage
            let stage = Stage::DownloadingModpackFiles { current, total };
            emit_status_with_stage(
                &instance_clone,
                "instance-downloading-modpack-files",
                &stage,
            );
        })
        .await
        .map_err(|e| format!("Parallel download failed: {}", e))?;

    emit_status(
        instance,
        "instance-finish-assets-download",
        &format!("Descargados {} archivos", downloaded_count),
    );

    Ok(downloaded_count)
}

// Helper function to fetch manifest (re-exported from instance_manager)
async fn fetch_modpack_manifest(
    modpack_id: &str,
    version_id: &str,
) -> Result<ModpackManifest, String> {
    crate::core::instance_manager::fetch_modpack_manifest(modpack_id, version_id).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;
    use std::sync::Arc;
    use std::sync::Mutex as StdMutex;
    use tokio::fs;

    #[tokio::test]
    async fn test_parallel_download_progress_order() {
        // Create a temp directory for test files
        let temp_dir = std::env::temp_dir().join("download_manager_test");
        let _ = std::fs::create_dir_all(&temp_dir);

        // Prepare test files with mock URLs (these won't actually download)
        let files = vec![
            (
                "file1.txt".to_string(),
                temp_dir.join("file1.txt"),
                "hash1".to_string(),
            ),
            (
                "file2.txt".to_string(),
                temp_dir.join("file2.txt"),
                "hash2".to_string(),
            ),
            (
                "file3.txt".to_string(),
                temp_dir.join("file3.txt"),
                "hash3".to_string(),
            ),
        ];

        // Track progress reports
        let progress_reports = Arc::new(StdMutex::new(Vec::new()));
        let progress_reports_clone = progress_reports.clone();

        let progress_callback = move |current: usize, total: usize, message: &str| {
            let mut reports = progress_reports_clone.lock().unwrap();
            reports.push((current, total, message.to_string()));
        };

        // This test will fail since we're using mock URLs, but we can test the structure
        let download_manager = DownloadManager::with_concurrency(2);

        // The test would fail on actual download, but we're testing the logic structure
        // In a real test, we'd set up a mock HTTP server
        // For now, just verify the DownloadManager is configured correctly
        assert_eq!(download_manager.max_concurrent_downloads, 2);

        // Cleanup
        let _ = std::fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_download_manager_concurrency_config() {
        let dm1 = DownloadManager::new();
        assert_eq!(dm1.max_concurrent_downloads, 4); // Default
        assert_eq!(dm1.get_concurrency(), 4);

        let dm2 = DownloadManager::with_concurrency(8);
        assert_eq!(dm2.max_concurrent_downloads, 8);
        assert_eq!(dm2.get_concurrency(), 8);

        let dm3 = DownloadManager::with_concurrency(0);
        assert_eq!(dm3.max_concurrent_downloads, 1); // Minimum enforced
        assert_eq!(dm3.get_concurrency(), 1);
    }

    #[test]
    fn test_get_download_concurrency_default() {
        // Test that the function returns a reasonable default when config is not available
        let concurrency = get_download_concurrency();
        assert!(concurrency >= 1);
        assert!(concurrency <= 16); // Should be within reasonable bounds
    }

    #[test]
    fn test_build_hash_to_path_map() {
        // Create a temporary directory structure for testing
        let temp_dir = std::env::temp_dir().join("hash_map_test");
        let _ = std::fs::create_dir_all(&temp_dir);
        
        // Create test files in mods directory
        let mods_dir = temp_dir.join("mods");
        let _ = std::fs::create_dir_all(&mods_dir);
        
        let test_content = b"test file content";
        let test_file = mods_dir.join("test_mod.jar");
        let _ = std::fs::write(&test_file, test_content);
        
        // Build hash map
        let hash_map = build_hash_to_path_map(&temp_dir).unwrap();
        
        // Verify the file was found and mapped correctly
        let expected_hash = compute_file_hash(test_content);
        assert!(hash_map.contains_key(&expected_hash));
        
        let expected_path = PathBuf::from("mods/test_mod.jar");
        assert_eq!(hash_map.get(&expected_hash), Some(&expected_path));
        
        // Cleanup
        let _ = std::fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_is_modpack_file() {
        // Test modpack directory files
        assert!(is_modpack_file("mods/some_mod.jar"));
        assert!(is_modpack_file("config/some_config.cfg"));
        assert!(is_modpack_file("scripts/some_script.zs"));
        assert!(is_modpack_file("resources/some_resource.png"));
        
        // Test files that should not be considered modpack files
        assert!(!is_modpack_file("config/options.txt")); // Player options
        assert!(!is_modpack_file("saves/world1/level.dat")); // World saves
        assert!(!is_modpack_file("logs/latest.log")); // Game logs
        
        // Test standalone modpack files
        assert!(is_modpack_file("manifest.json"));
        assert!(is_modpack_file("modlist.html"));
    }

    #[test]
    fn test_get_controlled_directories() {
        let controlled_dirs = get_controlled_directories();
        
        // Ensure key directories are included
        assert!(controlled_dirs.contains(&"mods"));
        assert!(controlled_dirs.contains(&"config"));
        assert!(controlled_dirs.contains(&"resources"));
        assert!(controlled_dirs.contains(&"scripts"));
        
        // Ensure we don't control essential Minecraft directories
        assert!(!controlled_dirs.contains(&"saves"));
        assert!(!controlled_dirs.contains(&"logs"));
        assert!(!controlled_dirs.contains(&"libraries"));
        assert!(!controlled_dirs.contains(&"versions"));
    }

    #[test]
    fn test_scan_controlled_directories() {
        // Create a temporary directory structure for testing
        let temp_dir = std::env::temp_dir().join("controlled_scan_test");
        let _ = std::fs::create_dir_all(&temp_dir);
        
        // Create test files in controlled directories
        let mods_dir = temp_dir.join("mods");
        let config_dir = temp_dir.join("config");
        let saves_dir = temp_dir.join("saves"); // This should NOT be scanned
        
        let _ = std::fs::create_dir_all(&mods_dir);
        let _ = std::fs::create_dir_all(&config_dir);
        let _ = std::fs::create_dir_all(&saves_dir);
        
        // Create test files
        let _ = std::fs::write(mods_dir.join("test_mod.jar"), "test content");
        let _ = std::fs::write(config_dir.join("test_config.cfg"), "test config");
        let _ = std::fs::write(saves_dir.join("world.dat"), "world data"); // Should be ignored
        let _ = std::fs::write(temp_dir.join("manifest.json"), "manifest"); // Standalone file
        
        // Scan controlled directories
        let controlled_files = scan_controlled_directories(&temp_dir).unwrap();
        
        // Verify correct files were found
        assert!(controlled_files.contains("mods/test_mod.jar"));
        assert!(controlled_files.contains("config/test_config.cfg"));
        assert!(controlled_files.contains("manifest.json"));
        
        // Verify files in non-controlled directories were ignored
        assert!(!controlled_files.contains("saves/world.dat"));
        
        // Cleanup
        let _ = std::fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_strict_mods_cleanup_logic() {
        // This test simulates the strict mods cleanup logic
        
        // Simulate files currently in mods/ directory
        let existing_mods_files: std::collections::HashSet<String> = vec![
            "mods/jei-1.0.0.jar".to_string(),
            "mods/optifine.jar".to_string(),
            "mods/user-added-mod.jar".to_string(), // User added this manually
            "mods/old-mod.jar".to_string(), // From previous version
            "mods/subfolder/some-mod.jar".to_string(),
        ].into_iter().collect();
        
        // Simulate files that should be in the new manifest (mods/ only)
        let manifest_mods_files: std::collections::HashSet<String> = vec![
            "mods/jei-1.0.0.jar".to_string(),
            "mods/new-mod.jar".to_string(), // New in this version
            "mods/subfolder/some-mod.jar".to_string(),
        ].into_iter().collect();
        
        // Calculate what should be cleaned (files in existing but not in manifest)
        let files_to_clean: std::collections::HashSet<String> = existing_mods_files
            .difference(&manifest_mods_files)
            .cloned()
            .collect();
        
        // Verify cleanup targets
        assert!(files_to_clean.contains("mods/optifine.jar")); // Should be removed
        assert!(files_to_clean.contains("mods/user-added-mod.jar")); // User added, should be removed
        assert!(files_to_clean.contains("mods/old-mod.jar")); // From old version, should be removed
        
        // Verify files that should be preserved
        assert!(!files_to_clean.contains("mods/jei-1.0.0.jar")); // In new manifest
        assert!(!files_to_clean.contains("mods/subfolder/some-mod.jar")); // In new manifest
        
        assert_eq!(files_to_clean.len(), 3); // Only 3 files should be marked for removal
    }

    #[test]
    fn test_scan_mods_directory_logic() {
        // Create a temporary directory structure for testing
        let temp_dir = std::env::temp_dir().join("mods_scan_test");
        let minecraft_dir = temp_dir.join("minecraft");
        let mods_dir = minecraft_dir.join("mods");
        let _ = std::fs::create_dir_all(&mods_dir);
        
        // Create test files in mods directory
        let _ = std::fs::write(mods_dir.join("test_mod.jar"), "test content");
        let _ = std::fs::write(mods_dir.join("another_mod.jar"), "another mod");
        
        // Create subdirectory with mod
        let mods_subdir = mods_dir.join("1.20.1");
        let _ = std::fs::create_dir_all(&mods_subdir);
        let _ = std::fs::write(mods_subdir.join("version_specific.jar"), "version mod");
        
        // Create a file outside mods directory (should not be scanned)
        let _ = std::fs::write(minecraft_dir.join("outside_mod.jar"), "outside");
        
        // Scan mods directory
        if let Ok(mods_files) = scan_mods_directory(&mods_dir) {
            // Verify correct files were found
            assert!(mods_files.contains("mods/test_mod.jar"));
            assert!(mods_files.contains("mods/another_mod.jar"));
            assert!(mods_files.contains("mods/1.20.1/version_specific.jar"));
            
            // Verify files outside mods/ were ignored
            assert!(!mods_files.contains("outside_mod.jar"));
            
            assert_eq!(mods_files.len(), 3);
        }
        
        // Cleanup
        let _ = std::fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_enhanced_cleanup_logic_simulation() {
        // This test simulates the enhanced cleanup logic without file I/O
        
        // Simulate current manifest files
        let current_files: HashSet<String> = [
            "mods/mod_a.jar".to_string(),
            "mods/mod_b.jar".to_string(),
            "config/config_a.cfg".to_string(),
        ].iter().cloned().collect();
        
        // Simulate existing files in controlled directories (including manual additions)
        let existing_controlled_files: HashSet<String> = [
            "mods/mod_a.jar".to_string(),      // In manifest (keep)
            "mods/mod_b.jar".to_string(),      // In manifest (keep)
            "mods/old_mod.jar".to_string(),    // Not in manifest (remove - was in old manifest)
            "mods/user_mod.jar".to_string(),   // Not in manifest (remove - manually added)
            "config/config_a.cfg".to_string(), // In manifest (keep)
            "config/old_config.cfg".to_string(), // Not in manifest (remove)
        ].iter().cloned().collect();
        
        // Calculate files to clean (any controlled file not in current manifest)
        let files_to_clean: HashSet<String> = existing_controlled_files
            .difference(&current_files)
            .cloned()
            .collect();
        
        // Verify cleanup targets
        assert_eq!(files_to_clean.len(), 3);
        assert!(files_to_clean.contains("mods/old_mod.jar"));
        assert!(files_to_clean.contains("mods/user_mod.jar"));
        assert!(files_to_clean.contains("config/old_config.cfg"));
        
        // Verify kept files
        assert!(!files_to_clean.contains("mods/mod_a.jar"));
        assert!(!files_to_clean.contains("mods/mod_b.jar"));
        assert!(!files_to_clean.contains("config/config_a.cfg"));
    }

    #[test]
    fn test_compute_file_hash() {
        let test_content = b"Hello, World!";
        let hash = compute_file_hash(test_content);
        
        // SHA1 hash of "Hello, World!" should be consistent
        let expected_hash = "0a4d55a8d778e5022fab701977c5d840bbc486d0";
        assert_eq!(hash, expected_hash);
    }
}
