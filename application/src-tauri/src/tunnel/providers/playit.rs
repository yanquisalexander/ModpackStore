use anyhow::{anyhow, Result};
use std::path::PathBuf;
use std::process::Stdio;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

pub struct PlayitProvider;

impl PlayitProvider {
    pub fn new() -> Self {
        Self
    }

    pub fn get_binary_path(&self, app_handle: &AppHandle) -> Result<PathBuf> {
        let resource_name = if cfg!(windows) {
            "playit.exe"
        } else {
            "playit"
        };

        let path = app_handle
            .path()
            .app_data_dir()?
            .join("tunnels")
            .join(resource_name);
        Ok(path)
    }

    pub async fn install(&self, app_handle: &AppHandle) -> Result<PathBuf> {
        let binary_path = self.get_binary_path(app_handle)?;

        if binary_path.exists() {
            return Ok(binary_path);
        }

        if let Some(parent) = binary_path.parent() {
            tokio::fs::create_dir_all(parent).await?;
        }

        // URL for Windows (x86_64) - Hardcoded for now, can be improved to fetch latest
        let url = "https://github.com/playit-cloud/playit-agent/releases/latest/download/playit-windows-x86_64.exe";

        // Use reqwest to download
        let response = reqwest::get(url).await?;
        if !response.status().is_success() {
            return Err(anyhow!("Failed to download playit: {}", response.status()));
        }

        let bytes = response.bytes().await?;
        tokio::fs::write(&binary_path, bytes).await?;

        // On non-windows, we need to make the binary executable
        #[cfg(not(target_os = "windows"))]
        {
            use std::os::unix::fs::PermissionsExt;
            let mut perms = std::fs::metadata(&binary_path)?.permissions();
            perms.set_mode(0o755);
            std::fs::set_permissions(&binary_path, perms)?;
        }

        Ok(binary_path)
    }

    pub async fn start(
        &self,
        app_handle: &AppHandle,
        instance_id: &str,
        instance_path: &PathBuf,
    ) -> Result<tokio::process::Child> {
        let binary_path = self.get_binary_path(app_handle)?;

        if !binary_path.exists() {
            log::info!("Playit binary not found, attempting to install...");
            self.install(app_handle).await?;
        }

        let mut child = Command::new(&binary_path)
            .current_dir(instance_path) // Run in instance dir so playit.toml is local to the server
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            //.creation_flags(0x08000000) // CREATE_NO_WINDOW on Windows?
            .spawn()?;

        // Spawn handlers to forward logs
        let stdout = child.stdout.take().expect("Failed to open stdout");
        let stderr = child.stderr.take().expect("Failed to open stderr");

        let app_handle_clone = app_handle.clone();
        let instance_id_clone = instance_id.to_string();

        tokio::spawn(async move {
            let mut reader = BufReader::new(stdout).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                // Parse important info?
                // For now just forward to frontend
                let _ = app_handle_clone.emit(
                    "tunnel-log",
                    serde_json::json!({
                        "instanceId": instance_id_clone,
                        "line": line,
                        "source": "stdout"
                    }),
                );
            }
        });

        let app_handle_clone2 = app_handle.clone();
        let instance_id_clone2 = instance_id.to_string();

        tokio::spawn(async move {
            let mut reader = BufReader::new(stderr).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                let _ = app_handle_clone2.emit(
                    "tunnel-log",
                    serde_json::json!({
                        "instanceId": instance_id_clone2,
                        "line": line,
                        "source": "stderr"
                    }),
                );
            }
        });

        Ok(child)
    }
}
