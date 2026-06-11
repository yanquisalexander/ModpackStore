use once_cell::sync::Lazy;
use tauri_plugin_http::reqwest;

pub static HTTP_CLIENT: Lazy<reqwest::Client> = Lazy::new(|| {
    reqwest::Client::builder()
        .user_agent("ModpackStore/1.0")
        .build()
        .expect("Failed to create HTTP client")
});

pub static BLOCKING_CLIENT: Lazy<reqwest::blocking::Client> = Lazy::new(|| {
    reqwest::blocking::Client::builder()
        .user_agent("ModpackStore/1.0")
        .build()
        .expect("Failed to create blocking HTTP client")
});
