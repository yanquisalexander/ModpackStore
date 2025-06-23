// src/core/NetworkUtilities.rs
use tauri_plugin_http::reqwest::{self, blocking};

use crate::API_ENDPOINT;
#[tauri::command]
pub async fn check_connection() -> bool {
    // Usando tokio para el retardo asíncrono
    tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;

    // Attempt to ping the API endpoint using async reqwest
    let api_url = format!("{}/ping", API_ENDPOINT);

    match reqwest::get(&api_url).await {
        Ok(resp) => resp.status().is_success(),
        Err(_) => false,
    }
}

#[tauri::command]
pub fn check_real_connection() -> bool {
    let client = blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(8))
        .build();

    let urls = [
        "https://www.google.com",
        "https://1.1.1.1", // Cloudflare DNS (HTTPS)
        "http://1.1.1.1",  // Cloudflare DNS (HTTP)
        "https://8.8.8.8", // Google DNS (HTTPS, puede fallar)
        "http://8.8.8.8",  // Google DNS (HTTP, puede fallar)
        "https://www.cloudflare.com",
        "https://www.bing.com",
        "https://example.com",
        "https://dns.google/",
        "https://cloudflare-dns.com/",
    ];

    if let Ok(client) = client {
        for url in urls.iter() {
            let response = client.get(*url).send();
            match response {
                Ok(resp) => {
                    log::info!("[check_real_connection] {} => {}", url, resp.status());
                    if resp.status().is_success() {
                        return true;
                    }
                }
                Err(e) => {
                    log::warn!("[check_real_connection] {} => error: {:?}", url, e);
                }
            }
        }
    }
    false
}
