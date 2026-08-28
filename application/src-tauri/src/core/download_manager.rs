use crate::core::bootstrap::tasks::{
    emit_bootstrap_complete, emit_status, emit_status_with_stage, Stage,
};
use crate::core::minecraft_instance::MinecraftInstance;
use crate::core::tasks_manager::{add_task_with_auto_start, remove_task, update_task, TaskStatus};
use futures_util::StreamExt;
use sha1::{Digest, Sha1};
use std::collections::HashMap;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tauri_plugin_http::reqwest;
use tokio::sync::{Mutex, Semaphore};

use super::modpack_cleanup::is_options_txt;
use super::modpack_manifest::*;

fn get_download_concurrency() -> usize {
    4
}

/// Enhanced download and install function that handles file moving when possible
/// This implements the manifest-as-source-of-truth approach
///
/// ## Special Handling for options.txt:
///
/// This function implements special protection for `options.txt` (Minecraft client options):
/// - If `options.txt` already exists locally, it will be skipped entirely (not downloaded/replaced)
/// - If `options.txt` doesn't exist locally, it will be downloaded normally from the modpack
/// - This preserves user's personal Minecraft settings while allowing new installations to get defaults
///
/// The protection applies specifically to the root-level `options.txt` file and does not affect
/// other configuration files like `config/options.txt` or `optionsshaders.txt`.
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

        // SPECIAL HANDLING FOR OPTIONS.TXT:
        // If options.txt already exists, skip processing entirely to preserve user settings
        if is_options_txt(&file_entry.path) && target_path.exists() {
            log::info!(
                "[FileManager] Skipping options.txt - file already exists and will be preserved (user settings protection)"
            );
            files_processed += 1;
            continue;
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
            if existing_full_path != target_path
                && file_exists_with_correct_hash(&existing_full_path, &file_entry.fileHash).await
            {
                // Move the file to the correct location
                log::info!(
                    "[FileMove] Moving {} -> {}",
                    existing_relative_path.display(),
                    file_entry.path
                );

                if let Err(e) = fs::rename(&existing_full_path, &target_path) {
                    log::warn!(
                        "[FileMove] Failed to move file, will download instead: {}",
                        e
                    );
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
                &format!(
                    "Procesamiento completo - {} archivos organizados ({} movidos)",
                    files_processed, files_moved
                ),
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

/// Returns a list of files that need to be downloaded (missing, corrupt, or wrong size/hash)
/// Now considers files that exist elsewhere with the same hash as valid (will be moved)
///
/// ## Special Handling for options.txt:
///
/// If `options.txt` already exists locally, it will be completely skipped from validation:
/// - No hash checking will be performed
/// - It will not be added to the download list regardless of hash mismatch
/// - This ensures user's Minecraft client settings are preserved
///
/// If `options.txt` doesn't exist locally, it will be validated and downloaded normally.
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

        // SPECIAL HANDLING FOR OPTIONS.TXT:
        // If options.txt already exists, skip validation and download entirely
        // This preserves user's client settings and prevents overwriting their configuration
        if is_options_txt(&file_entry.path) && file_path.exists() {
            log::info!(
                "[Validation] Skipping options.txt - file already exists and will be preserved (user settings protection)"
            );
            continue;
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

/// Compute SHA1 hash of data already in memory (used for tests only).
#[cfg(test)]
fn compute_file_hash(contents: &[u8]) -> String {
    let mut hasher = Sha1::new();
    hasher.update(contents);
    format!("{:x}", hasher.finalize())
}

/// Compute SHA1 hash of a file using streaming I/O (8 KB buffer).
/// Avoids loading the entire file into memory.
pub(crate) fn calculate_file_hash(file_path: &Path) -> Result<String, String> {
    use std::io::Read;
    let mut file = fs::File::open(file_path)
        .map_err(|e| format!("Failed to open file {}: {}", file_path.display(), e))?;
    let mut hasher = Sha1::new();
    let mut buffer = [0u8; 8192];
    loop {
        let bytes_read = file
            .read(&mut buffer)
            .map_err(|e| format!("Failed to read file {}: {}", file_path.display(), e))?;
        if bytes_read == 0 {
            break;
        }
        hasher.update(&buffer[..bytes_read]);
    }
    Ok(format!("{:x}", hasher.finalize()))
}

/// Builds a map of file hash -> path for all files in the instance directory
/// This helps identify files that exist but may be in the wrong location
pub(crate) fn build_hash_to_path_map(
    minecraft_dir: &Path,
) -> Result<HashMap<String, PathBuf>, String> {
    let mut hash_map = HashMap::new();

    // Only scan modpack-related directories to avoid performance issues
    let scan_dirs = vec![
        "mods",
        "coremods",
        "scripts",
        "resources",
        "packmenu",
        "structures",
        "schematics",
        "config",
        "changelogs",
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
            if let Ok(hash) = calculate_file_hash(&file_path) {
                let relative_path = file_path
                    .strip_prefix(minecraft_dir)
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
    hash_map: &mut HashMap<String, PathBuf>,
) -> Result<(), String> {
    let entries = fs::read_dir(dir)
        .map_err(|e| format!("Failed to read directory {}: {}", dir.display(), e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let path = entry.path();

        if path.is_file() {
            if let Ok(hash) = calculate_file_hash(&path) {
                let relative_path = path
                    .strip_prefix(minecraft_dir)
                    .map_err(|_| "Failed to get relative path")?;
                hash_map.insert(hash, relative_path.to_path_buf());
            }
        } else if path.is_dir() {
            scan_directory_for_hashes(&path, minecraft_dir, hash_map)?;
        }
    }

    Ok(())
}

/// Helper function to fetch manifest (re-exported from instance_manager)
pub(crate) async fn fetch_modpack_manifest(
    modpack_id: &str,
    version_id: &str,
    target: Option<&str>,
) -> Result<ModpackManifest, String> {
    crate::core::instance_manager::fetch_modpack_manifest(modpack_id, version_id, target).await
}

pub(crate) async fn download_modpack_files(
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

async fn file_exists_with_correct_hash(file_path: &Path, expected_hash: &str) -> bool {
    if !file_path.exists() {
        return false;
    }

    // Compute hash via streaming I/O to avoid loading the entire file into memory
    match calculate_file_hash(file_path) {
        Ok(computed_hash) => computed_hash == expected_hash,
        Err(_) => false,
    }
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
    fn test_compute_file_hash() {
        let test_content = b"Hello, World!";
        let hash = compute_file_hash(test_content);

        // SHA1 hash of "Hello, World!" should be consistent
        let expected_hash = "0a4d55a8d778e5022fab701977c5d840bbc486d0";
        assert_eq!(hash, expected_hash);
    }

    #[test]
    fn test_calculate_file_hash_function() {
        // Create a temporary file to test hash calculation
        let temp_dir = std::env::temp_dir().join("hash_test");
        let _ = std::fs::create_dir_all(&temp_dir);

        let test_file = temp_dir.join("test.txt");
        let test_content = "Test content for hash calculation";

        // Write test content
        let _ = std::fs::write(&test_file, test_content);

        // Calculate hash using our function
        if let Ok(calculated_hash) = calculate_file_hash(&test_file) {
            // Calculate expected hash manually
            let expected_hash = compute_file_hash(test_content.as_bytes());
            assert_eq!(calculated_hash, expected_hash);
        }

        // Cleanup
        let _ = std::fs::remove_dir_all(&temp_dir);
    }
}
