use crate::core::minecraft_instance::MinecraftInstance;
use crate::core::tasks_manager::{add_task, update_task, TaskStatus};
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

/// Cleans up obsolete files in the instance directory based on the manifest
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
        return Ok(vec![]);
    }

    let mut removed_files = Vec::new();

    // Get all expected files from manifest
    let expected_files: HashSet<String> = manifest.files.iter().map(|f| f.path.clone()).collect();

    // Find all files in minecraft directory recursively
    let existing_files = find_files_recursively(&minecraft_dir)?;

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
    remove_empty_directories(&minecraft_dir)?;

    Ok(removed_files)
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
        let file_path = instance_dir.join(&file_entry.path);

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

    // Fetch current manifest
    let manifest = fetch_modpack_manifest(modpack_id, version_id).await?;

    // Cleanup obsolete files
    cleanup_obsolete_files(&instance, &manifest)
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

    // Create a task for this operation
    let task_id = format!("validate_modpack_assets_{}", instance_id);
    add_task(
        &task_id.clone(),
        Some(serde_json::json!({
            "status": "Validando assets del modpack",
            "progress": 0.0,
            "message": "Iniciando validación..."
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

    update_task(
        &task_id,
        TaskStatus::Completed,
        100.0,
        &format!("Descargados {} archivos", downloaded_count),
        None,
    );

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
    let mut downloaded_count = 0;

    for (index, file_entry) in files.iter().enumerate() {
        let file_path = instance_dir.join(&file_entry.path);

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
    }

    Ok(downloaded_count)
}

// Helper function to fetch manifest (re-exported from instance_manager)
async fn fetch_modpack_manifest(
    modpack_id: &str,
    version_id: &str,
) -> Result<ModpackManifest, String> {
    crate::core::instance_manager::fetch_modpack_manifest(modpack_id, version_id).await
}
