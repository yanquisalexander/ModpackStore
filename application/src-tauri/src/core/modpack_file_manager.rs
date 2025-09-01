use crate::core::bootstrap::tasks::{
    emit_bootstrap_complete, emit_status, emit_status_with_stage, Stage,
};
use crate::core::minecraft_instance::MinecraftInstance;
use crate::core::minecraft::paths::MinecraftPaths;
use crate::core::tasks_manager::{add_task, update_task, TaskStatus, task_exists, remove_task};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::Emitter;

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

/// Identifies essential Minecraft files and directories that should never be deleted
fn get_essential_minecraft_paths(minecraft_dir: &Path, instance: &MinecraftInstance) -> HashSet<PathBuf> {
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
    
    log::info!("[Cleanup] Protected {} essential Minecraft paths", essential_paths.len());
    
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
    let manifest_cache_path = Path::new(instance_dir).join(".modpack_cache").join("previous_manifest.json");
    
    if manifest_cache_path.exists() {
        if let Ok(content) = fs::read_to_string(&manifest_cache_path) {
            if let Ok(manifest) = serde_json::from_str::<ModpackManifest>(&content) {
                log::info!("[Cleanup] Loaded previous manifest with {} files", manifest.files.len());
                return Some(manifest);
            }
        }
    }
    
    log::info!("[Cleanup] No previous manifest found");
    None
}

/// Saves current manifest for future comparison
fn save_manifest_cache(instance: &MinecraftInstance, manifest: &ModpackManifest) -> Result<(), String> {
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
    
    log::info!("[Cleanup] Saved manifest cache with {} files", manifest.files.len());
    Ok(())
}

/// Cleans up obsolete files in the instance directory based on manifest comparison
/// Only removes files that were previously managed by the launcher and are no longer needed
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

    log::info!("[Cleanup] Starting cleanup for instance: {}", instance.instanceName);

    let mut removed_files = Vec::new();
    let mut preserved_files = Vec::new();

    // Get essential paths that should never be deleted
    let essential_paths = get_essential_minecraft_paths(&minecraft_dir, instance);

    // Get current manifest files
    let current_files: HashSet<String> = manifest.files.iter().map(|f| f.path.clone()).collect();
    log::info!("[Cleanup] Current manifest has {} files", current_files.len());

    // Load previous manifest for comparison
    let previous_manifest = load_previous_manifest(instance);
    
    // Determine files to clean based on manifest comparison
    let files_to_clean = if let Some(prev_manifest) = previous_manifest {
        let previous_files: HashSet<String> = prev_manifest.files.iter().map(|f| f.path.clone()).collect();
        log::info!("[Cleanup] Previous manifest had {} files", previous_files.len());
        
        // Only clean files that were in the previous manifest but not in current manifest
        let obsolete_files: HashSet<String> = previous_files.difference(&current_files).cloned().collect();
        log::info!("[Cleanup] Found {} obsolete files to clean", obsolete_files.len());
        
        obsolete_files
    } else {
        // If no previous manifest, be more conservative - only clean files in specific modpack directories
        log::warn!("[Cleanup] No previous manifest found, using conservative cleanup");
        
        // Find files in modpack-specific directories that aren't in current manifest
        let existing_files = find_files_recursively(&minecraft_dir)?;
        let mut files_to_clean = HashSet::new();
        
        for file_path in existing_files {
            let relative_path = file_path
                .strip_prefix(&minecraft_dir)
                .map_err(|_| "Failed to get relative path")?
                .to_string_lossy()
                .replace("\\", "/"); // Normalize path separators
            
            // Only consider files in known modpack directories for conservative cleanup
            if is_modpack_file(&relative_path) && !current_files.contains(&relative_path) {
                files_to_clean.insert(relative_path);
            }
        }
        
        log::info!("[Cleanup] Conservative cleanup will process {} files", files_to_clean.len());
        files_to_clean
    };

    // Process files for cleanup
    for file_to_clean in files_to_clean {
        let file_path = minecraft_dir.join(&file_to_clean);
        
        // Double-check: never delete essential files
        if is_essential_path(&file_path, &essential_paths) {
            log::warn!("[Cleanup] Skipping essential file: {}", file_to_clean);
            preserved_files.push(file_to_clean);
            continue;
        }
        
        // Only clean if file actually exists
        if file_path.exists() {
            match fs::remove_file(&file_path) {
                Ok(_) => {
                    log::info!("[Cleanup] Removed obsolete file: {}", file_to_clean);
                    removed_files.push(file_to_clean);
                }
                Err(e) => {
                    log::error!("[Cleanup] Failed to remove file {}: {}", file_to_clean, e);
                }
            }
        }
    }

    // Remove empty directories (but not essential ones)
    remove_empty_directories_safe(&minecraft_dir, &essential_paths)?;

    // Save current manifest for future comparisons
    if let Err(e) = save_manifest_cache(instance, manifest) {
        log::warn!("[Cleanup] Failed to save manifest cache: {}", e);
    }

    log::info!(
        "[Cleanup] Cleanup complete: {} files removed, {} files preserved",
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

/// Downloads and installs modpack files, reusing existing files when possible
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

    for (index, file_entry) in manifest.files.iter().enumerate() {
        let target_path = minecraft_dir.join(&file_entry.path);

        // Create parent directory if needed
        if let Some(parent) = target_path.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create directory {}: {}", parent.display(), e))?;
        }

        // Check if file already exists and has correct hash
        if file_exists_with_correct_hash(&target_path, &file_entry.fileHash).await {
            files_processed += 1;
            // Update progress for existing files too
            if let Some(ref tid) = task_id {
                let progress: f32 =
                    (((85.0 + (index as f64 / total_files as f64) * 30.0) * 10.0).round() / 10.0)
                        .clamp(0.0, 100.0) as f32;
                update_task(
                    tid,
                    TaskStatus::Running,
                    progress,
                    &format!(
                        "Verificando archivo {} de {}: {}",
                        index + 1,
                        total_files,
                        file_entry.path
                    ),
                    None,
                );
            }
            emit_status_with_stage(
                instance,
                "instance-downloading-modpack-files",
                &Stage::DownloadingModpackFiles {
                    current: index + 1,
                    total: total_files,
                },
            );
            continue; // File already exists and is correct, skip download
        }

        // Update progress before downloading
        if let Some(ref tid) = task_id {
            let progress = (60.0 + (index as f64 / total_files as f64) * 30.0) as f32;
            update_task(
                tid,
                TaskStatus::Running,
                progress,
                &format!(
                    "Descargando archivo {} de {}: {}",
                    index + 1,
                    total_files,
                    file_entry.path
                ),
                None,
            );
        }
        emit_status_with_stage(
            instance,
            "instance-downloading-modpack-files",
            &Stage::DownloadingModpackFiles {
                current: index + 1,
                total: total_files,
            },
        );

        // Download the file
        match download_file(&file_entry.downloadUrl, &target_path).await {
            Ok(_) => {
                files_processed += 1;
            }
            Err(e) => {
                eprintln!("Failed to download file {}: {}", file_entry.path, e);
                // Continue with other files rather than failing completely
            }
        }
    }

    emit_status(
        instance,
        "instance-finish-assets-download",
        &format!("Descargados {} archivos", files_processed),
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

fn remove_empty_directories_safe(dir: &Path, essential_paths: &HashSet<PathBuf>) -> Result<(), String> {
    // Don't remove essential directories
    if is_essential_path(dir, essential_paths) {
        return Ok(());
    }

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
        remove_empty_directories_safe(&subdir, essential_paths)?;

        // Check if subdirectory is now empty and not essential
        if !is_essential_path(&subdir, essential_paths) && is_directory_empty(&subdir)? {
            if let Err(e) = fs::remove_dir(&subdir) {
                log::warn!(
                    "[Cleanup] Failed to remove empty directory {}: {}",
                    subdir.display(),
                    e
                );
            } else {
                log::info!("[Cleanup] Removed empty directory: {}", subdir.display());
            }
        } else {
            has_files = true;
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

        // Check if file exists
        if !file_path.exists() {
            needs_download = true;
        } else {
            // Check file size
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
                needs_download = true;
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

fn compute_file_hash(contents: &[u8]) -> String {
    use sha1::{Digest, Sha1};
    let mut hasher = Sha1::new();
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

    log::info!("[Cleanup] Fetching manifest for modpack {} version {}", modpack_id, version_id);

    // Fetch current manifest
    let manifest = fetch_modpack_manifest(modpack_id, version_id).await?;

    log::info!("[Cleanup] Starting safe cleanup process");

    // Cleanup obsolete files using improved method
    let removed_files = cleanup_obsolete_files(&instance, &manifest)?;
    
    log::info!("[Cleanup] Cleanup completed successfully, {} files removed", removed_files.len());
    
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
        log::info!("Removing existing task for instance {} before creating new one", instance_id);
        remove_task(&base_task_id);
    }
    
    let task_id = base_task_id;
    add_task(
        &task_id.clone(),
        Some(serde_json::json!({
            "status": "Validando assets del modpack",
            "progress": 0.0,
            "message": "Iniciando validación...",
            "instanceId": instance_id.clone()
        })),
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
                log::info!("Cleaned up failed modpack validation task (manifest error): {}", task_id_for_cleanup);
            });
            
            return Err(e);
        }
    };

    // Emit event to indicate we're downloading modpack assets
    if let Ok(guard) = crate::GLOBAL_APP_HANDLE.lock() {
        if let Some(app_handle) = guard.as_ref() {
            let _ = app_handle.emit(
                &format!("instance-{}", instance_id),
                serde_json::json!({
                    "id": instance_id,
                    "status": "downloading-modpack-assets",
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
                    log::info!("Cleaned up failed modpack validation task: {}", task_id_for_cleanup);
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
            log::info!("Cleaned up completed modpack validation task (no downloads needed): {}", task_id_for_cleanup);
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
        log::info!("Cleaned up completed modpack validation task: {}", task_id_for_cleanup);
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
    let mut downloaded_count = 0;

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

    for (index, file_entry) in files.iter().enumerate() {
        let file_path = minecraft_dir.join(&file_entry.path);

        // Update progress
        if let Some(task_id) = &task_id {
            let progress = (index as f32 / files.len() as f32) * 100.0;
            update_task(
                task_id,
                TaskStatus::Running,
                progress,
                &format!(
                    "Descargando {} ({}/{})",
                    file_entry.path,
                    index + 1,
                    files.len()
                ),
                None,
            );
        }

        // Create parent directories if they don't exist
        if let Some(parent) = file_path.parent() {
            if let Err(e) = fs::create_dir_all(parent) {
                return Err(format!(
                    "Failed to create directory {}: {}",
                    parent.display(),
                    e
                ));
            }
        }

        // Download the file
        if let Err(e) = download_file(&file_entry.downloadUrl, &file_path).await {
            return Err(format!("Failed to download {}: {}", file_entry.path, e));
        }

        downloaded_count += 1;

        let stage = Stage::DownloadingModpackFiles {
            current: downloaded_count,
            total: files.len(),
        };
        emit_status_with_stage(instance, "instance-downloading-modpack-files", &stage);
    }

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
