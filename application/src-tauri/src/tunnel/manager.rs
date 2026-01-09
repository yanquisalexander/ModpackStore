use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle};
use anyhow::{Result, anyhow};
use tokio::process::Child;

use super::providers::playit::PlayitProvider;

pub struct TunnelHandle {
    pub process: Option<Child>,
    pub provider: String,
}

pub struct TunnelManager {
    tunnels: Mutex<HashMap<String, TunnelHandle>>,
    playit: PlayitProvider,
}

impl TunnelManager {
    pub fn new() -> Self {
        Self {
            tunnels: Mutex::new(HashMap::new()),
            playit: PlayitProvider::new(),
        }
    }

    pub async fn install_provider(&self, app_handle: &AppHandle, provider: &str) -> Result<()> {
        match provider {
            "playit" => {
                self.playit.install(app_handle).await?;
                Ok(())
            },
            _ => Err(anyhow!("Unknown provider: {}", provider)),
        }
    }

    pub async fn start_tunnel(&self, app_handle: &AppHandle, instance_id: String, instance_path: PathBuf, provider: String) -> Result<()> {
        // Scope to check existence to avoid race conditions roughly, but we need to release lock before await
        {
            let tunnels = self.tunnels.lock().unwrap();
            if tunnels.contains_key(&instance_id) {
                return Err(anyhow!("Tunnel already running for instance {}", instance_id));
            }
        }

        let child = match provider.as_str() {
            "playit" => self.playit.start(app_handle, &instance_id, &instance_path).await?,
             _ => return Err(anyhow!("Unknown provider: {}", provider)),
        };

        let mut tunnels = self.tunnels.lock().unwrap();
        tunnels.insert(instance_id, TunnelHandle {
            process: Some(child),
            provider,
        });

        Ok(())
    }

    pub async fn stop_tunnel(&self, instance_id: &str) -> Result<()> {
        let handle_opt = {
            let mut tunnels = self.tunnels.lock().unwrap();
            tunnels.remove(instance_id)
        };

        if let Some(mut handle) = handle_opt {
            if let Some(mut child) = handle.process.take() {
                // Kill the process
                let _ = child.kill().await;
            }
        }
        Ok(())
    }
    
    pub fn get_tunnel_status(&self, instance_id: &str) -> Option<String> {
        let tunnels = self.tunnels.lock().unwrap();
        tunnels.get(instance_id).map(|h| h.provider.clone())
    }
}
