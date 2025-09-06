use futures_util::StreamExt;
use reqwest::Client;
use sha2::{Digest, Sha256};
use std::fs::File;
use std::io::Write;
use std::path::Path;
use std::time::Duration;
use tokio::fs;

/// Configuration for download behavior
pub struct DownloadConfig {
    /// Maximum number of retry attempts on hash mismatch
    pub max_retries: usize,
    /// Timeout for individual HTTP requests
    pub request_timeout: Duration,
    /// Size of chunks to write to disk
    pub chunk_size: usize,
}

impl Default for DownloadConfig {
    fn default() -> Self {
        Self {
            max_retries: 3,
            request_timeout: Duration::from_secs(30),
            chunk_size: 8192, // 8KB chunks
        }
    }
}

/// Information about a file to download
#[derive(Debug, Clone)]
pub struct DownloadItem {
    pub url: String,
    pub target_path: String,
    pub expected_hash: String,
}

/// Result of a download operation
#[derive(Debug)]
pub enum DownloadResult {
    Success,
    Failed { error: String, retry_count: usize },
}

/// Error types for download operations
#[derive(Debug, thiserror::Error)]
pub enum DownloadError {
    #[error("Network error: {0}")]
    Network(#[from] reqwest::Error),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Hash verification failed. Expected: {expected}, Got: {actual}")]
    HashMismatch { expected: String, actual: String },
    #[error("HTTP error: {status}")]
    HttpError { status: reqwest::StatusCode },
    #[error("Parent directory creation failed: {0}")]
    DirectoryCreation(String),
}

/// Optimized downloader with shared client and streaming capabilities
pub struct OptimizedDownloader {
    client: Client,
    config: DownloadConfig,
}

impl OptimizedDownloader {
    /// Create a new optimized downloader with default configuration
    pub fn new() -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(60))
            .connect_timeout(Duration::from_secs(10))
            .tcp_keepalive(Some(Duration::from_secs(60)))
            .http2_prior_knowledge()
            .build()
            .expect("Failed to create HTTP client");

        Self {
            client,
            config: DownloadConfig::default(),
        }
    }

    /// Create a new optimized downloader with custom configuration
    pub fn with_config(config: DownloadConfig) -> Self {
        let client = Client::builder()
            .timeout(config.request_timeout)
            .connect_timeout(Duration::from_secs(10))
            .tcp_keepalive(Some(Duration::from_secs(60)))
            .http2_prior_knowledge()
            .build()
            .expect("Failed to create HTTP client");

        Self { client, config }
    }

    /// Download files sequentially with progress reporting
    pub async fn download_files<F>(
        &self,
        files: Vec<DownloadItem>,
        mut progress_callback: F,
    ) -> Result<Vec<DownloadResult>, DownloadError>
    where
        F: FnMut(usize, usize, &str), // (current, total, message)
    {
        let total_files = files.len();
        let mut results = Vec::with_capacity(total_files);

        for (index, item) in files.into_iter().enumerate() {
            let current = index + 1;
            progress_callback(current, total_files, &format!("Descargando archivo {}/{}", current, total_files));

            let result = self.download_file_with_retry(&item).await;
            
            match &result {
                Ok(_) => {
                    results.push(DownloadResult::Success);
                    progress_callback(current, total_files, &format!("Completado {}/{}: {}", current, total_files, item.target_path));
                }
                Err(e) => {
                    results.push(DownloadResult::Failed {
                        error: e.to_string(),
                        retry_count: self.config.max_retries,
                    });
                    progress_callback(current, total_files, &format!("Error {}/{}: {}", current, total_files, e));
                }
            }
        }

        Ok(results)
    }

    /// Download a single file with retry on hash mismatch
    async fn download_file_with_retry(&self, item: &DownloadItem) -> Result<(), DownloadError> {
        let mut retry_count = 0;
        
        loop {
            match self.download_file_streaming(&item.url, &item.target_path, &item.expected_hash).await {
                Ok(_) => return Ok(()),
                Err(DownloadError::HashMismatch { expected, actual }) if retry_count < self.config.max_retries => {
                    retry_count += 1;
                    log::warn!(
                        "Hash mismatch for {}, attempt {}/{}: expected {}, got {}. Retrying...",
                        item.target_path,
                        retry_count,
                        self.config.max_retries,
                        expected,
                        actual
                    );
                    
                    // Delete the corrupted file before retrying
                    if let Err(e) = fs::remove_file(&item.target_path).await {
                        log::warn!("Failed to remove corrupted file {}: {}", item.target_path, e);
                    }
                    
                    continue;
                }
                Err(e) => return Err(e),
            }
        }
    }

    /// Download a single file with streaming and hash verification
    async fn download_file_streaming(
        &self,
        url: &str,
        target_path: &str,
        expected_hash: &str,
    ) -> Result<(), DownloadError> {
        // Create parent directories if needed
        let path = Path::new(target_path);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).await.map_err(|e| {
                DownloadError::DirectoryCreation(format!("Failed to create directory {}: {}", parent.display(), e))
            })?;
        }

        // Start the download
        let response = self.client.get(url).send().await?;

        // Check HTTP status
        if !response.status().is_success() {
            return Err(DownloadError::HttpError {
                status: response.status(),
            });
        }

        // Create file and hasher
        let mut file = File::create(target_path)?;
        let mut hasher = Sha256::new();
        let mut stream = response.bytes_stream();

        // Stream download with hash calculation
        while let Some(chunk_result) = stream.next().await {
            let chunk = chunk_result?;
            
            // Write to file
            file.write_all(&chunk)?;
            
            // Update hash
            hasher.update(&chunk);
        }

        // Ensure all data is written to disk
        file.flush()?;
        drop(file);

        // Verify hash
        let computed_hash = format!("{:x}", hasher.finalize());
        if computed_hash.to_lowercase() != expected_hash.to_lowercase() {
            return Err(DownloadError::HashMismatch {
                expected: expected_hash.to_string(),
                actual: computed_hash,
            });
        }

        Ok(())
    }

    /// Download a single file (legacy interface for compatibility)
    pub async fn download_file(
        &self,
        url: &str,
        target_path: &Path,
    ) -> Result<(), String> {
        // Create parent directories if needed
        if let Some(parent) = target_path.parent() {
            fs::create_dir_all(parent).await.map_err(|e| {
                format!("Failed to create directory {}: {}", parent.display(), e)
            })?;
        }

        // Start the download
        let response = self.client.get(url).send().await
            .map_err(|e| format!("Failed to download file: {}", e))?;

        // Check HTTP status
        if !response.status().is_success() {
            return Err(format!("HTTP error: {}", response.status()));
        }

        // Create file and stream download
        let mut file = File::create(target_path)
            .map_err(|e| format!("Failed to create file: {}", e))?;
        let mut stream = response.bytes_stream();

        // Stream download
        while let Some(chunk_result) = stream.next().await {
            let chunk = chunk_result
                .map_err(|e| format!("Failed to read response chunk: {}", e))?;
            
            file.write_all(&chunk)
                .map_err(|e| format!("Failed to write to file: {}", e))?;
        }

        file.flush()
            .map_err(|e| format!("Failed to flush file: {}", e))?;

        Ok(())
    }
}

/// Compute SHA256 hash of file contents
pub fn compute_sha256_hash(contents: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(contents);
    format!("{:x}", hasher.finalize())
}

/// Verify SHA256 hash of a file
pub async fn verify_file_hash(file_path: &Path, expected_hash: &str) -> Result<bool, std::io::Error> {
    let contents = fs::read(file_path).await?;
    let computed_hash = compute_sha256_hash(&contents);
    Ok(computed_hash.to_lowercase() == expected_hash.to_lowercase())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[tokio::test]
    async fn test_sha256_hash_computation() {
        let test_data = b"Hello, World!";
        let expected_hash = "dffd6021bb2bd5b0af676290809ec3a53191dd81c7f70a4b28688a362182986f";
        let computed_hash = compute_sha256_hash(test_data);
        assert_eq!(computed_hash.to_lowercase(), expected_hash);
    }

    #[tokio::test]
    async fn test_file_hash_verification() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("test.txt");
        let test_data = b"Hello, World!";
        let expected_hash = "dffd6021bb2bd5b0af676290809ec3a53191dd81c7f70a4b28688a362182986f";

        fs::write(&file_path, test_data).await.unwrap();
        
        let is_valid = verify_file_hash(&file_path, expected_hash).await.unwrap();
        assert!(is_valid);

        let is_invalid = verify_file_hash(&file_path, "invalid_hash").await.unwrap();
        assert!(!is_invalid);
    }
    
    #[test]
    fn test_downloader_creation() {
        let downloader = OptimizedDownloader::new();
        // Just test that we can create the downloader without panicking
        assert!(true);
    }
}