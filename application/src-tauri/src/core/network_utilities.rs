// src/core/NetworkUtilities.rs

use crate::API_ENDPOINT;
use futures::future::join_all;
use once_cell::sync::Lazy;
use reqwest::Client;
use std::time::Duration;

static HTTP_CLIENT: Lazy<Client> = Lazy::new(|| {
    Client::builder()
        .timeout(Duration::from_secs(5))
        .build()
        .expect("Failed to create HTTP client")
});

static BLOCKING_CLIENT: Lazy<reqwest::blocking::Client> = Lazy::new(|| {
    reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(5))
        .build()
        .expect("Failed to create blocking HTTP client")
});

const CHECK_URLS: &[&str] = &[
    "https://1.1.1.1",
    "https://dns.google",
    "https://www.cloudflare.com",
    "https://www.google.com/generate_204",
    "http://detectportal.firefox.com/success.txt",
];

#[tauri::command]
pub async fn check_connection() -> bool {
    let api_url = format!("{}/ping", *API_ENDPOINT);
    HTTP_CLIENT
        .get(&api_url)
        .send()
        .await
        .is_ok_and(|resp| resp.status().is_success())
}

#[tauri::command]
pub async fn check_real_connection() -> bool {
    let futures: Vec<_> = CHECK_URLS
        .iter()
        .map(|url| {
            let url = *url;
            async move {
                match HTTP_CLIENT.get(url).send().await {
                    Ok(resp) if resp.status().is_success() => {
                        log::info!("[check_real_connection] Success with URL: {}", url);
                        true
                    }
                    Err(e) => {
                        log::warn!("[check_real_connection] Failed for URL {}: {}", url, e);
                        false
                    }
                    _ => false,
                }
            }
        })
        .collect();

    join_all(futures).await.into_iter().any(|r| r)
}

pub fn check_real_connection_sync() -> bool {
    use rayon::prelude::*;

    CHECK_URLS.par_iter().any(|url| {
        match BLOCKING_CLIENT.get(*url).send() {
            Ok(resp) if resp.status().is_success() => {
                log::info!("[check_real_connection] Success with URL: {}", url);
                true
            }
            Err(e) => {
                log::warn!("[check_real_connection] Failed for URL {}: {}", url, e);
                false
            }
            _ => false,
        }
    })
}
