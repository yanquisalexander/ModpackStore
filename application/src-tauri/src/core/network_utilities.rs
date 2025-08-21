// src/core/NetworkUtilities.rs

use crate::API_ENDPOINT;
use rayon::prelude::*;
use tauri_plugin_http::reqwest::{self, blocking};

/// Checks if the custom API endpoint is reachable.
#[tauri::command]
pub async fn check_connection() -> bool {
    let api_url = format!("{}/ping", API_ENDPOINT);
    // Performs the request and checks if the result is Ok and the status is a success (2xx).
    reqwest::get(&api_url)
        .await
        .is_ok_and(|resp| resp.status().is_success())
}

/// Checks for a real internet connection by pinging multiple high-availability endpoints in parallel.
/// Returns true as soon as the first successful response is received.
#[tauri::command]
pub fn check_real_connection() -> bool {
    let client = match blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(5)) // A shorter timeout is better for parallel checks.
        .build()
    {
        Ok(c) => c,
        Err(e) => {
            log::error!("[check_real_connection] Failed to build HTTP client: {}", e);
            return false;
        }
    };

    // A curated list of fast and reliable endpoints for connectivity checks.
    let urls = [
        "https://1.1.1.1",    // Cloudflare DNS (very fast and stable)
        "https://dns.google", // Google DNS
        "https://www.cloudflare.com",
        "https://www.google.com/generate_204", // Google's dedicated connectivity check
        "http://detectportal.firefox.com/success.txt", // Mozilla's connectivity check
    ];

    // find_any() processes items in parallel and short-circuits on the first success.
    // This is highly efficient for finding if at least one endpoint is reachable.
    let is_connected = urls.par_iter().find_any(|url| {
        match client.get(**url).send() {
            Ok(resp) if resp.status().is_success() => {
                log::info!("[check_real_connection] Success with URL: {}", url);
                true // Connection found, Rayon will stop other threads.
            }
            Err(e) => {
                log::warn!(
                    "[check_real_connection] Failed for URL {}: {}",
                    url,
                    e.to_string()
                );
                false // This attempt failed, Rayon will continue with others.
            }
            _ => false, // Status was not successful, continue.
        }
    });

    is_connected.is_some()
}
