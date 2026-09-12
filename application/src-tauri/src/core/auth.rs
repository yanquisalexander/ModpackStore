// Imports optimizados y reorganizados
use crate::{API_ENDPOINT, GLOBAL_APP_HANDLE};
use hyper::{
    header::{HeaderValue, CONTENT_TYPE},
    server::Server,
    service::{make_service_fn, service_fn},
    Body, Request, Response, StatusCode as HyperStatusCode,
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::{convert::Infallible, net::SocketAddr, sync::Arc, time::Duration};
use tauri::{Emitter, Listener, Manager, State};
use tauri_plugin_http::reqwest::{Client, StatusCode};
use tauri_plugin_opener;
use tauri_plugin_store::StoreExt;
use tokio::sync::{oneshot, Mutex};

// --- OAuth server registry: ensures only one server per port at a time ---
lazy_static::lazy_static! {
    static ref OAUTH_SERVERS: Mutex<std::collections::HashMap<u16, oneshot::Sender<()>>> =
        Mutex::new(std::collections::HashMap::new());
}

// Constantes centralizadas
// Current changelog version ID - increment this when updating changelog content
const CHANGELOG_ID: u32 = 1;

// Determine storage path based on environment
const STORAGE_PATH: &str = if cfg!(debug_assertions) {
    "auth_store.dev.json"
} else {
    "auth_store.json"
};

const STORAGE_KEY_TOKENS: &str = "auth_tokens";
const CLIENT_ID: &str = "943184136976334879";
const REDIRECT_URI: &str = "http://localhost:1957/callback";

// Twitch OAuth constants
const TWITCH_CLIENT_ID: &str = "c8q2u0v3rqfks639ub8ybx54o623u0"; // This should be set from environment
const TWITCH_REDIRECT_URI: &str = "http://localhost:1958/callback"; // Different port for Twitch

// Patreon OAuth constants
// TODO: These should be loaded from environment variables or configuration
const PATREON_CLIENT_ID: &str = "SS11fubTxRKD1nONqu3ttDJeN6wqMyB8Y1Gzxi1gNYfOs5ukeNFlD9iyujEAnrr7"; // This should be set from environment
const PATREON_REDIRECT_URI: &str = "http://localhost:1959/callback"; // Different port for Patreon

const USE_SCHEMA_FOR_CALLBACK: bool = false;
const SCHEMA_REDIRECT_URI: &str = "modpackstore://oauth-callback";

const CALLBACK_TIMEOUT_SECS: u64 = 120;
const POLL_INTERVAL_SECS: u64 = 1;
const SERVER_ADDR: ([u8; 4], u16) = ([127, 0, 0, 1], 1957);
const TWITCH_SERVER_ADDR: ([u8; 4], u16) = ([127, 0, 0, 1], 1958);
const PATREON_SERVER_ADDR: ([u8; 4], u16) = ([127, 0, 0, 1], 1959);

fn extract_code_from_url(url_str: &str) -> Option<String> {
    let parsed = url::Url::parse(url_str).ok()?;
    parsed.query_pairs()
        .find(|(key, _)| key == "code")
        .map(|(_, value)| value.into_owned())
}

// --- Tipos y Estructuras ---
type AuthResult<T> = Result<T, String>;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UserSession {
    #[serde(flatten)]
    pub extra: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TokenResponse {
    pub access_token: String,
    pub refresh_token: String,
    pub expires_in: u64,
    pub token_type: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "kebab-case")]
pub enum AuthStep {
    StartingAuth,
    WaitingCallback,
    ProcessingCallback,
    RequestingSession,
}

#[derive(Debug)]
pub struct AuthState {
    pub session: Mutex<Option<UserSession>>,
    pub auth_code: Mutex<Option<String>>,
}

impl Default for AuthState {
    fn default() -> Self {
        Self::new()
    }
}

impl AuthState {
    pub fn new() -> Self {
        Self {
            session: Mutex::new(None),
            auth_code: Mutex::new(None),
        }
    }

    // Helper para limpiar todo el estado
    async fn clear_all(&self) {
        let mut session_guard = self.session.lock().await;
        *session_guard = None;
        drop(session_guard);

        let mut code_guard = self.auth_code.lock().await;
        *code_guard = None;
    }
}

// --- Storage helpers optimizados ---
pub mod storage {
    use super::*;

    pub async fn save_tokens(
        app_handle: &tauri::AppHandle,
        tokens: &TokenResponse,
    ) -> AuthResult<()> {
        let store = app_handle.store(STORAGE_PATH).map_err(|e| e.to_string())?;
        store.set(STORAGE_KEY_TOKENS.to_string(), json!(tokens));
        let result = store.save().map_err(|e| e.to_string());
        store.close_resource();
        result
    }

    pub async fn load_tokens(app_handle: &tauri::AppHandle) -> AuthResult<Option<TokenResponse>> {
        let store = app_handle.store(STORAGE_PATH).map_err(|e| e.to_string())?;

        let result = if store.has(STORAGE_KEY_TOKENS) {
            let tokens_value = store
                .get(STORAGE_KEY_TOKENS)
                .ok_or_else(|| "Tokens no encontrados en el store".to_string())?;

            serde_json::from_value::<TokenResponse>(tokens_value.clone())
                .map(Some)
                .map_err(|e| format!("Error al deserializar tokens: {}", e))
        } else {
            Ok(None)
        };

        store.close_resource();
        result
    }

    pub async fn remove_tokens(app_handle: &tauri::AppHandle) -> AuthResult<()> {
        let store = app_handle.store(STORAGE_PATH).map_err(|e| e.to_string())?;
        if store.has(STORAGE_KEY_TOKENS) {
            store.delete(STORAGE_KEY_TOKENS.to_string());
        }
        let result = store.save().map_err(|e| e.to_string());
        store.close_resource();
        result
    }
}

// --- Event helpers optimizados ---
mod events {
    use super::*;

    pub fn emit_event<T: Serialize + Clone>(event: &str, payload: Option<T>) -> AuthResult<()> {
        let binding = GLOBAL_APP_HANDLE
            .lock()
            .map_err(|e| format!("Lock poisoned: {}", e))?;
        let app = binding.as_ref().ok_or("AppHandle no inicializado")?;
        let main_window = app
            .get_webview_window("main")
            .ok_or("Ventana principal no encontrada")?;
        main_window.emit(event, payload).map_err(|e| e.to_string())
    }

    pub fn emit_auth_error<T: Serialize + Clone>(payload: T) {
        if let Ok(payload_str) = serde_json::to_string(&payload) {
            log::debug!("Emitting auth-error with payload: {}", payload_str);
        }
        let _ = emit_event("auth-error", Some(payload));
    }

    pub fn emit_auth_status_changed(session: Option<UserSession>, tokens: Option<TokenResponse>) {
        #[derive(Serialize, Clone)]
        struct AuthStatusPayload {
            session: Option<UserSession>,
            tokens: Option<TokenResponse>,
        }
        let payload = AuthStatusPayload { session, tokens };
        let _ = emit_event("auth-status-changed", Some(payload));
    }

    pub fn emit_auth_step_changed(step: AuthStep) {
        let _ = emit_event("auth-step-changed", Some(step));
    }
}

// --- API helpers ---
mod api {
    use super::*;

    use std::sync::OnceLock;

    fn shared_client() -> &'static Client {
        static CLIENT: OnceLock<Client> = OnceLock::new();
        CLIENT.get_or_init(|| {
            Client::builder()
                .timeout(Duration::from_secs(15))
                .build()
                .unwrap_or_else(|_| Client::new())
        })
    }

    pub struct ApiClient {
        client: &'static Client,
    }

    impl ApiClient {
        pub fn new() -> Self {
            Self {
                client: shared_client(),
            }
        }

        pub async fn get_session(&self, access_token: &str) -> AuthResult<UserSession> {
            let session_endpoint = format!("{}/auth/me", *API_ENDPOINT);

            let mut retries = 0;
            let max_retries = 1; // Max 1 retry to avoid long delays

            loop {
                let response_result = self
                    .client
                    .get(&session_endpoint)
                    .bearer_auth(access_token)
                    .send()
                    .await;

                match response_result {
                    Ok(response) => {
                        if response.status().is_success() {
                            return response
                                .json::<UserSession>()
                                .await
                                .map_err(|e| format!("Error al parsear sesión: {}", e));
                        }

                        let status = response.status();

                        // Si es 401 o 403, el token no sirve
                        if status == StatusCode::UNAUTHORIZED || status == StatusCode::FORBIDDEN {
                            return Err("AUTH_EXPIRED".to_string());
                        }

                        // Si es error de servidor y tenemos reintentos
                        if (status.is_server_error() || status == StatusCode::TOO_MANY_REQUESTS)
                            && retries < max_retries
                        {
                            retries += 1;
                            let delay = 2 * retries;
                            log::warn!(
                                "Server error {}. Retrying in {}s...",
                                status, delay
                            );
                            tokio::time::sleep(Duration::from_secs(delay)).await;
                            continue;
                        }

                        return Err(format!("API_ERROR_{}", status));
                    }
                    Err(e) => {
                        if retries < max_retries {
                            retries += 1;
                            let delay = 2 * retries;
                            log::warn!("Network error {}. Retrying in {}s...", e, delay);
                            tokio::time::sleep(Duration::from_secs(delay)).await;
                            continue;
                        }
                        return Err(format!("NETWORK_ERROR: {}", e));
                    }
                }
            }
        }

        pub async fn refresh_tokens(&self, refresh_token: &str) -> AuthResult<TokenResponse> {
            let refresh_endpoint = format!("{}/auth/refresh", *API_ENDPOINT);

            let mut retries = 0;
            let max_retries = 1;

            loop {
                let response_result = self
                    .client
                    .post(&refresh_endpoint)
                    .json(&json!({ "refresh_token": refresh_token }))
                    .send()
                    .await;

                match response_result {
                    Ok(response) => {
                        if response.status().is_success() {
                            return response
                                .json::<TokenResponse>()
                                .await
                                .map_err(|e| format!("Error al parsear tokens: {}", e));
                        }

                        let status = response.status();

                        if status == StatusCode::UNAUTHORIZED || status == StatusCode::FORBIDDEN {
                            return Err("REFRESH_TOKEN_EXPIRED".to_string());
                        }

                        if (status.is_server_error() || status == StatusCode::TOO_MANY_REQUESTS)
                            && retries < max_retries
                        {
                            retries += 1;
                            let delay = 2 * retries;
                            tokio::time::sleep(Duration::from_secs(delay)).await;
                            continue;
                        }

                        return Err(format!("REFRESH_API_ERROR_{}", status));
                    }
                    Err(e) => {
                        if retries < max_retries {
                            retries += 1;
                            let delay = 2 * retries;
                            tokio::time::sleep(Duration::from_secs(delay)).await;
                            continue;
                        }
                        return Err(format!("REFRESH_NETWORK_ERROR: {}", e));
                    }
                }
            }
        }

        pub async fn exchange_code_for_tokens(&self, code: &str, redirect_uri: Option<&str>) -> AuthResult<TokenResponse> {
            let mut token_endpoint = format!("{}/auth/discord/callback?code={}", *API_ENDPOINT, code);
            if let Some(uri) = redirect_uri {
                token_endpoint = format!("{}&redirect_uri={}", token_endpoint, urlencoding::encode(uri));
            }

            let response = self
                .client
                .get(&token_endpoint)
                .send()
                .await
                .map_err(|e| format!("Error al contactar API: {}", e))?;

            if !response.status().is_success() {
                // Print the raw response body

                let raw_body = response
                    .text()
                    .await
                    .unwrap_or_else(|_| "Could not get response body".into());
                log::error!("Response body: {}", raw_body);

                let error_body = serde_json::from_str::<serde_json::Value>(&raw_body)
                    .unwrap_or_else(
                        |_| json!({ "error": "No se pudo parsear el cuerpo de la respuesta" }),
                    );
                events::emit_auth_error(&error_body); // Emitir directamente el JSON
                return Err(format!("{}", &error_body));
            }

            response
                .json::<TokenResponse>()
                .await
                .map_err(|e| format!("Error al parsear tokens: {}", e))
        }

        pub async fn logout(&self, access_token: &str) -> AuthResult<()> {
            let logout_endpoint = format!("{}/logout", *API_ENDPOINT);

            let response = self
                .client
                .post(&logout_endpoint)
                .bearer_auth(access_token)
                .send()
                .await
                .map_err(|e| format!("Error al contactar API: {}", e))?;

            if response.status().is_success() {
                log::info!("Backend logout successful");
            } else {
                log::warn!("Backend logout failed: status {}", response.status());
            }

            Ok(())
        }

        pub async fn link_twitch_account(&self, code: &str, redirect_uri: Option<&str>) -> AuthResult<()> {
            // First, get current auth tokens to authenticate the request
            // Clone the AppHandle out of the global mutex first so the MutexGuard
            // is dropped before we hit any .await (avoids holding a non-Send guard
            // across awaits).
            let app_handle = {
                let binding = GLOBAL_APP_HANDLE
                    .lock()
                    .map_err(|e| format!("Lock poisoned: {}", e))?;
                binding.as_ref().ok_or("AppHandle no inicializado")?.clone()
            };

            let tokens = storage::load_tokens(&app_handle)
                .await
                .map_err(|e| format!("Error loading auth tokens: {}", e))?
                .ok_or("No authentication tokens found")?;

            let mut twitch_endpoint = format!("{}/auth/twitch/callback?code={}", *API_ENDPOINT, code);
            if let Some(uri) = redirect_uri {
                twitch_endpoint = format!("{}&redirect_uri={}", twitch_endpoint, urlencoding::encode(uri));
            }

            let response = self
                .client
                .get(&twitch_endpoint)
                .bearer_auth(&tokens.access_token)
                .send()
                .await
                .map_err(|e| format!("Error contacting API: {}", e))?;

            if !response.status().is_success() {
                let raw_body = response
                    .text()
                    .await
                    .unwrap_or_else(|_| "Could not get response body".into());
                log::error!("Twitch linking error response: {}", raw_body);

                return Err(format!("Failed to link Twitch account: {}", raw_body));
            }

            Ok(())
        }

        pub async fn link_patreon_account(&self, code: &str, redirect_uri: Option<&str>) -> AuthResult<()> {
            // First, get current auth tokens to authenticate the request
            let app_handle = {
                let binding = GLOBAL_APP_HANDLE
                    .lock()
                    .map_err(|e| format!("Lock poisoned: {}", e))?;
                binding.as_ref().ok_or("AppHandle no inicializado")?.clone()
            };

            let tokens = storage::load_tokens(&app_handle)
                .await
                .map_err(|e| format!("Error loading auth tokens: {}", e))?
                .ok_or("No authentication tokens found")?;

            // Get current user session to extract user ID
            let me_endpoint = format!("{}/auth/me", *API_ENDPOINT);
            let me_response = self
                .client
                .get(&me_endpoint)
                .bearer_auth(&tokens.access_token)
                .send()
                .await
                .map_err(|e| format!("Error fetching user session: {}", e))?;

            if !me_response.status().is_success() {
                return Err("Failed to get current user session".to_string());
            }

            let user_session: serde_json::Value = me_response
                .json()
                .await
                .map_err(|e| format!("Error parsing user session: {}", e))?;

            let user_id = user_session
                .get("id")
                .and_then(|id| id.as_str())
                .ok_or("User ID not found in session")?;

            // Send code to backend for processing
            let patreon_endpoint = format!("{}/auth/patreon/callback", *API_ENDPOINT);

            let mut payload = serde_json::json!({
                "code": code,
                "state": "patreon_auth", // You might want to implement proper state handling
                "userId": user_id
            });
            if let Some(uri) = redirect_uri {
                payload["redirect_uri"] = serde_json::Value::String(uri.to_string());
            }

            let response = self
                .client
                .post(&patreon_endpoint)
                .json(&payload)
                .send()
                .await
                .map_err(|e| format!("Error contacting API: {}", e))?;

            if !response.status().is_success() {
                let raw_body = response
                    .text()
                    .await
                    .unwrap_or_else(|_| "Could not get response body".into());
                log::error!("Patreon linking error response: {}", raw_body);

                return Err(format!("Failed to link Patreon account: {}", raw_body));
            }

            Ok(())
        }
    }
}

// --- Session management ---
mod session {
    use super::*;

    pub async fn try_restore_session(
        app_handle: &tauri::AppHandle,
        auth_state: &Arc<AuthState>,
        api_client: &api::ApiClient,
    ) -> AuthResult<Option<UserSession>> {
        let tokens = match storage::load_tokens(app_handle).await? {
            Some(tokens) => tokens,
            None => {
                log::info!("No saved tokens found");
                events::emit_auth_status_changed(None, None);
                return Ok(None);
            }
        };

        log::info!("Tokens found, verifying session...");

        // Intentar obtener sesión con tokens actuales
        match api_client.get_session(&tokens.access_token).await {
            Ok(user) => {
                log::info!("Session restored successfully");
                save_session_and_notify(auth_state, user.clone(), tokens.clone()).await;
                return Ok(Some(user));
            }
            Err(e) if e == "AUTH_EXPIRED" => {
                log::info!("Tokens expired, attempting refresh...");
            }
            Err(e) => {
                log::warn!(
                    "Server or network error restoring session: {}. Keeping local session.",
                    e
                );
                return Err(e);
            }
        }

        // Intentar renovar tokens
        match api_client.refresh_tokens(&tokens.refresh_token).await {
            Ok(new_tokens) => {
                if let Err(e) = storage::save_tokens(app_handle, &new_tokens).await {
                    log::error!("Failed to save refreshed tokens: {}", e);
                    events::emit_auth_status_changed(None, None);
                    return Err(e);
                }
                log::info!("Tokens refreshed successfully");

                // Obtener sesión con nuevos tokens
                match api_client.get_session(&new_tokens.access_token).await {
                    Ok(user) => {
                        log::info!("Session restored after token refresh");
                        save_session_and_notify(auth_state, user.clone(), new_tokens.clone()).await;
                        Ok(Some(user))
                    }
                    Err(e) if e == "AUTH_EXPIRED" => {
                        log::error!("Auth error after token refresh: {}", e);
                        let _ = storage::remove_tokens(app_handle).await;
                        events::emit_auth_status_changed(None, None);
                        Ok(None)
                    }
                    Err(e) => {
                        log::error!("Server error after token refresh: {}", e);
                        events::emit_auth_status_changed(None, None);
                        Err(e)
                    }
                }
            }
            Err(e) if e == "REFRESH_TOKEN_EXPIRED" => {
                log::error!("Refresh token expired: {}", e);
                let _ = storage::remove_tokens(app_handle).await;
                events::emit_auth_status_changed(None, None);
                Ok(None)
            }
            Err(e) => {
                log::warn!(
                    "Server or network error refreshing tokens: {}. Keeping credentials.",
                    e
                );
                Err(e)
            }
        }
    }

    async fn save_session_and_notify(
        auth_state: &Arc<AuthState>,
        user: UserSession,
        tokens: TokenResponse,
    ) {
        let mut session_guard = auth_state.session.lock().await;
        *session_guard = Some(user.clone());
        drop(session_guard);

        events::emit_auth_status_changed(Some(user), Some(tokens));
    }
}

// --- OAuth Server ---
struct AppState {
    auth_state: Arc<AuthState>,
    server_tx: Option<oneshot::Sender<()>>,
}

type BoxError = Box<dyn std::error::Error + Send + Sync>;

async fn start_oauth_server_generic<F, P>(
    addr: ([u8; 4], u16),
    auth_state: Arc<AuthState>,
    handler: F,
    poll_fn: P,
    label: &'static str,
) -> AuthResult<()>
where
    F: Fn(Request<Body>, Arc<Mutex<AppState>>) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<Response<Body>, Infallible>> + Send>> + Clone + Send + Sync + 'static,
    P: FnOnce(Arc<AuthState>, Arc<Mutex<AppState>>) -> std::pin::Pin<Box<dyn std::future::Future<Output = ()> + Send>> + Send + 'static,
{
    let port = addr.1;

    // Ensure any previous server on this port is fully stopped
    {
        let mut servers = OAUTH_SERVERS.lock().await;
        if let Some(old_tx) = servers.remove(&port) {
            log::info!("{} shutting down previous server on port {}", label, port);
            let _ = old_tx.send(());
            // Give the old server time to release the socket
            tokio::time::sleep(Duration::from_millis(100)).await;
        }
    }

    let (shutdown_tx, shutdown_rx) = oneshot::channel::<()>();

    // Register this server's shutdown sender
    {
        let mut servers = OAUTH_SERVERS.lock().await;
        servers.insert(port, shutdown_tx);
    }

    let app_state_mutex = Arc::new(Mutex::new(AppState {
        auth_state: Arc::clone(&auth_state),
        server_tx: None, // shutdown is now managed by OAUTH_SERVERS registry
    }));

    let socket_addr = SocketAddr::from(addr);
    let app_state_clone = app_state_mutex.clone();

    let make_svc = make_service_fn(move |_conn| {
        let app_state = app_state_clone.clone();
        let handler = handler.clone();
        async move {
            Ok::<_, Infallible>(service_fn(move |req| {
                handler(req, app_state.clone())
            }))
        }
    });

    let server = Server::bind(&socket_addr)
        .serve(make_svc)
        .with_graceful_shutdown(async move {
            shutdown_rx.await.ok();
            log::info!("{} callback server shutting down.", label);
        });

    tokio::spawn(async move {
        log::info!("{} callback server listening on http://{}", label, socket_addr);
        if let Err(e) = server.await {
            log::error!("{} server error: {}", label, e);
            events::emit_auth_error(format!("{} server error: {}", label, e));
        }
        // Unregister from the registry when the server finishes
        let mut servers = OAUTH_SERVERS.lock().await;
        servers.remove(&port);
        log::info!("{} server on port {} fully stopped", label, port);
    });

    let auth_state_clone = Arc::clone(&auth_state);
    tokio::spawn(async move {
        poll_fn(auth_state_clone, app_state_mutex).await;
    });

    Ok(())
}

/// Generic polling function that waits for an auth code and processes it.
/// `process_fn` receives (code, auth_state, redirect_uri) when a code is received.
/// `success_event` is emitted on success (e.g., "twitch-auth-success"). Pass None for Discord.
/// `port` is the port number of the OAuth server to shut down on completion/timeout.
async fn poll_for_auth_code_generic<F, Fut>(
    auth_state: Arc<AuthState>,
    _app_state_mutex: Option<Arc<Mutex<AppState>>>,
    redirect_uri: Option<String>,
    mut process_fn: F,
    success_event: Option<&str>,
    label: &str,
    port: u16,
) where
    F: FnMut(String, Arc<AuthState>, Option<String>) -> Fut + Send,
    Fut: std::future::Future<Output = AuthResult<()>> + Send,
{
    for i in 0..CALLBACK_TIMEOUT_SECS {
        let code_option = {
            let auth_code_guard = auth_state.auth_code.lock().await;
            auth_code_guard.clone()
        };

        if let Some(code) = code_option {
            log::info!("{} authorization code received", label);
            events::emit_auth_step_changed(AuthStep::ProcessingCallback);

            match process_fn(code, Arc::clone(&auth_state), redirect_uri).await {
                Ok(()) => {
                    if let Some(event) = success_event {
                        log::info!("{} account linked successfully", label);
                        let _ = events::emit_event(event, Some(json!({"success": true})));
                    }
                    if let Ok(binding) = GLOBAL_APP_HANDLE.lock() {
                        if let Some(app_handle) = binding.as_ref() {
                            if let Some(main_window) = app_handle.get_webview_window("main") {
                                let _ = main_window.set_focus();
                            }
                        }
                    }
                }
                Err(e) => {
                    log::error!("Error processing {} auth code: {}", label, e);
                    events::emit_auth_error(format!("Error linking {} account: {}", label, e));
                }
            }

            // Shut down the server after processing the code
            if port != 0 {
                let mut servers = OAUTH_SERVERS.lock().await;
                if let Some(tx) = servers.remove(&port) {
                    let _ = tx.send(());
                }
            }

            return;
        }

        if i % 10 == 0 && i > 0 {
            log::debug!("Waiting for {} code... ({}s / {}s)", label, i, CALLBACK_TIMEOUT_SECS);
        }

        tokio::time::sleep(Duration::from_secs(POLL_INTERVAL_SECS)).await;
    }

    log::error!("Timeout waiting for {} authorization code", label);
    events::emit_auth_error(format!("Timeout waiting for {} authorization", label));

    // Shut down the server via the registry
    let mut servers = OAUTH_SERVERS.lock().await;
    if let Some(tx) = servers.remove(&port) {
        let _ = tx.send(());
    }
}

async fn process_auth_code(code: String, auth_state: Arc<AuthState>, redirect_uri: Option<String>) -> AuthResult<()> {
    let api_client = api::ApiClient::new();

    let app_handle = {
        let binding = GLOBAL_APP_HANDLE
            .lock()
            .map_err(|e| format!("Lock poisoned: {}", e))?;
        binding.as_ref().ok_or("AppHandle no inicializado")?.clone()
    };

    if let Some(main_window) = app_handle.get_webview_window("main") {
        let _ = main_window.set_focus();
    }

    let tokens = api_client.exchange_code_for_tokens(&code, redirect_uri.as_deref()).await?;

    storage::save_tokens(&app_handle, &tokens).await?;

    events::emit_auth_step_changed(AuthStep::RequestingSession);
    let user = api_client.get_session(&tokens.access_token).await?;

    let mut session_guard = auth_state.session.lock().await;
    *session_guard = Some(user.clone());
    drop(session_guard);

    events::emit_auth_status_changed(Some(user), Some(tokens));
    log::info!("Authentication completed successfully");

    Ok(())
}

// --- Comandos de Tauri optimizados ---

#[tauri::command]
pub async fn init_session(
    app_handle: tauri::AppHandle,
    auth_state: State<'_, Arc<AuthState>>,
) -> AuthResult<Option<UserSession>> {
    let api_client = api::ApiClient::new();
    session::try_restore_session(&app_handle, auth_state.inner(), &api_client).await
}

#[tauri::command]
pub async fn get_current_session(
    auth_state: State<'_, Arc<AuthState>>,
) -> AuthResult<Option<UserSession>> {
    let session_guard = auth_state.session.lock().await;
    Ok(session_guard.clone())
}

#[tauri::command]
pub async fn start_discord_auth(
    app_handle: tauri::AppHandle,
    auth_state: State<'_, Arc<AuthState>>,
) -> AuthResult<()> {
    events::emit_auth_step_changed(AuthStep::StartingAuth);
    auth_state.clear_all().await;

    if USE_SCHEMA_FOR_CALLBACK {
        let auth_state_clone = Arc::clone(auth_state.inner());
        app_handle.listen("deep-link://new-url", move |event: tauri::Event| {
            let payload = event.payload();
            let url_str = serde_json::from_str::<String>(payload).unwrap_or_else(|_| payload.to_string());
            if let Some(code) = extract_code_from_url(&url_str) {
                let auth_state = auth_state_clone.clone();
                tauri::async_runtime::spawn(async move {
                    let mut code_guard = auth_state.auth_code.lock().await;
                    *code_guard = Some(code);
                });
            }
        });

        let auth_state_clone2 = Arc::clone(auth_state.inner());
        tokio::spawn(async move {
            poll_for_auth_code_generic(
                auth_state_clone2,
                None,
                Some(SCHEMA_REDIRECT_URI.to_string()),
                process_auth_code,
                None,
                "Discord",
                0, // no server in deep-link mode
            ).await;
        });

        let discord_url = format!(
            "https://discord.com/api/oauth2/authorize?client_id={}&response_type=code&scope=identify%20email%20guilds&redirect_uri={}",
            CLIENT_ID, SCHEMA_REDIRECT_URI
        );
        log::info!("Opening auth URL: {}", discord_url);
        std::thread::spawn(move || {
            if let Err(e) = tauri_plugin_opener::open_url(discord_url, None::<String>) {
                log::error!("Error opening URL: {}", e);
                events::emit_auth_error("Error opening auth URL".to_string());
            }
        });
    } else {
        let auth_state_for_server = Arc::clone(auth_state.inner());

        start_oauth_server_generic(
            SERVER_ADDR,
            auth_state_for_server,
            |req, app_state_mutex| {
                Box::pin(handle_oauth_callback(req, app_state_mutex, SUCCESS_HTML, "Discord"))
            },
            |auth_state, app_state_mutex| {
                Box::pin(async move {
                    poll_for_auth_code_generic(
                        auth_state,
                        Some(app_state_mutex),
                        None,
                        process_auth_code,
                        None,
                        "Discord",
                        SERVER_ADDR.1,
                    ).await;
                })
            },
            "Discord",
        ).await?;

        let discord_url = format!(
            "https://discord.com/api/oauth2/authorize?client_id={}&response_type=code&scope=identify%20email%20guilds&redirect_uri={}",
            CLIENT_ID, REDIRECT_URI
        );
        log::info!("Opening auth URL: {}", discord_url);
        std::thread::spawn(move || {
            if let Err(e) = tauri_plugin_opener::open_url(discord_url, None::<String>) {
                log::error!("Error opening URL: {}", e);
                events::emit_auth_error("Error opening auth URL".to_string());
            }
        });
    }

    events::emit_auth_step_changed(AuthStep::WaitingCallback);
    Ok(())
}

#[tauri::command]
pub async fn start_twitch_auth(
    app_handle: tauri::AppHandle,
    auth_state: State<'_, Arc<AuthState>>,
) -> AuthResult<()> {
    events::emit_auth_step_changed(AuthStep::StartingAuth);
    auth_state.clear_all().await;

    if USE_SCHEMA_FOR_CALLBACK {
        let auth_state_clone = Arc::clone(auth_state.inner());
        app_handle.listen("deep-link://new-url", move |event: tauri::Event| {
            let payload = event.payload();
            let url_str = serde_json::from_str::<String>(payload).unwrap_or_else(|_| payload.to_string());
            if let Some(code) = extract_code_from_url(&url_str) {
                let auth_state = auth_state_clone.clone();
                tauri::async_runtime::spawn(async move {
                    let mut code_guard = auth_state.auth_code.lock().await;
                    *code_guard = Some(code);
                });
            }
        });

        let auth_state_clone2 = Arc::clone(auth_state.inner());
        tokio::spawn(async move {
            poll_for_auth_code_generic(
                auth_state_clone2,
                None,
                Some(SCHEMA_REDIRECT_URI.to_string()),
                |code, _auth_state, redirect_uri| async move {
                    let api_client = api::ApiClient::new();
                    let redirect_uri_clone = redirect_uri.clone();
                    process_link_account_code(
                        &code,
                        redirect_uri_clone,
                        api_client.link_twitch_account(&code, redirect_uri.as_deref()),
                        "Twitch",
                    ).await
                },
                Some("twitch-auth-success"),
                "Twitch",
                0, // no server in deep-link mode
            ).await;
        });

        let twitch_url = format!(
            "https://id.twitch.tv/oauth2/authorize?client_id={}&response_type=code&scope=user:read:subscriptions&redirect_uri={}",
            TWITCH_CLIENT_ID, SCHEMA_REDIRECT_URI
        );
        log::info!("Opening Twitch authorization URL: {}", twitch_url);
        std::thread::spawn(move || {
            if let Err(e) = tauri_plugin_opener::open_url(twitch_url, None::<String>) {
                log::error!("Error opening Twitch URL: {}", e);
                events::emit_auth_error("Error opening Twitch authorization URL".to_string());
            }
        });
    } else {
        let auth_state_for_server = Arc::clone(auth_state.inner());

        start_oauth_server_generic(
            TWITCH_SERVER_ADDR,
            auth_state_for_server,
            |req, app_state_mutex| {
                Box::pin(handle_oauth_callback(req, app_state_mutex, TWITCH_SUCCESS_HTML, "Twitch"))
            },
            |auth_state, app_state_mutex| {
                Box::pin(async move {
                    poll_for_auth_code_generic(
                        auth_state,
                        Some(app_state_mutex),
                        None,
                        |code, _auth_state, redirect_uri| async move {
                            let api_client = api::ApiClient::new();
                            let redirect_uri_clone = redirect_uri.clone();
                            process_link_account_code(
                                &code,
                                redirect_uri_clone,
                                api_client.link_twitch_account(&code, redirect_uri.as_deref()),
                                "Twitch",
                            ).await
                        },
                        Some("twitch-auth-success"),
                        "Twitch",
                        TWITCH_SERVER_ADDR.1,
                    ).await;
                })
            },
            "Twitch",
        ).await?;

        let twitch_url = format!(
            "https://id.twitch.tv/oauth2/authorize?client_id={}&response_type=code&scope=user:read:subscriptions&redirect_uri={}",
            TWITCH_CLIENT_ID, TWITCH_REDIRECT_URI
        );
        log::info!("Opening Twitch authorization URL: {}", twitch_url);
        std::thread::spawn(move || {
            if let Err(e) = tauri_plugin_opener::open_url(twitch_url, None::<String>) {
                log::error!("Error opening Twitch URL: {}", e);
                events::emit_auth_error("Error opening Twitch authorization URL".to_string());
            }
        });
    }

    events::emit_auth_step_changed(AuthStep::WaitingCallback);
    Ok(())
}

#[tauri::command]
pub async fn start_patreon_auth(
    app_handle: tauri::AppHandle,
    auth_state: State<'_, Arc<AuthState>>,
) -> AuthResult<()> {
    events::emit_auth_step_changed(AuthStep::StartingAuth);
    auth_state.clear_all().await;

    if USE_SCHEMA_FOR_CALLBACK {
        let auth_state_clone = Arc::clone(auth_state.inner());
        app_handle.listen("deep-link://new-url", move |event: tauri::Event| {
            let payload = event.payload();
            let url_str = serde_json::from_str::<String>(payload).unwrap_or_else(|_| payload.to_string());
            if let Some(code) = extract_code_from_url(&url_str) {
                let auth_state = auth_state_clone.clone();
                tauri::async_runtime::spawn(async move {
                    let mut code_guard = auth_state.auth_code.lock().await;
                    *code_guard = Some(code);
                });
            }
        });

        let auth_state_clone2 = Arc::clone(auth_state.inner());
        tokio::spawn(async move {
            poll_for_auth_code_generic(
                auth_state_clone2,
                None,
                Some(SCHEMA_REDIRECT_URI.to_string()),
                |code, _auth_state, redirect_uri| async move {
                    let api_client = api::ApiClient::new();
                    let redirect_uri_clone = redirect_uri.clone();
                    process_link_account_code(
                        &code,
                        redirect_uri_clone,
                        api_client.link_patreon_account(&code, redirect_uri.as_deref()),
                        "Patreon",
                    ).await
                },
                Some("patreon-auth-success"),
                "Patreon",
                0, // no server in deep-link mode
            ).await;
        });

        let patreon_url = format!(
            "https://www.patreon.com/oauth2/authorize?response_type=code&client_id={}&redirect_uri={}&scope=identity%20identity.memberships",
            PATREON_CLIENT_ID, SCHEMA_REDIRECT_URI
        );
        log::info!("Opening Patreon authorization URL: {}", patreon_url);
        std::thread::spawn(move || {
            if let Err(e) = tauri_plugin_opener::open_url(patreon_url, None::<String>) {
                log::error!("Error opening Patreon URL: {}", e);
                events::emit_auth_error("Error opening Patreon authorization URL".to_string());
            }
        });
    } else {
        let auth_state_for_server = Arc::clone(auth_state.inner());

        start_oauth_server_generic(
            PATREON_SERVER_ADDR,
            auth_state_for_server,
            |req, app_state_mutex| {
                Box::pin(handle_oauth_callback(req, app_state_mutex, PATREON_SUCCESS_HTML, "Patreon"))
            },
            |auth_state, app_state_mutex| {
                Box::pin(async move {
                    poll_for_auth_code_generic(
                        auth_state,
                        Some(app_state_mutex),
                        None,
                        |code, _auth_state, redirect_uri| async move {
                            let api_client = api::ApiClient::new();
                            let redirect_uri_clone = redirect_uri.clone();
                            process_link_account_code(
                                &code,
                                redirect_uri_clone,
                                api_client.link_patreon_account(&code, redirect_uri.as_deref()),
                                "Patreon",
                            ).await
                        },
                        Some("patreon-auth-success"),
                        "Patreon",
                        PATREON_SERVER_ADDR.1,
                    ).await;
                })
            },
            "Patreon",
        ).await?;

        let patreon_url = format!(
            "https://www.patreon.com/oauth2/authorize?response_type=code&client_id={}&redirect_uri={}&scope=identity%20identity.memberships",
            PATREON_CLIENT_ID, PATREON_REDIRECT_URI
        );
        log::info!("Opening Patreon authorization URL: {}", patreon_url);
        std::thread::spawn(move || {
            if let Err(e) = tauri_plugin_opener::open_url(patreon_url, None::<String>) {
                log::error!("Error opening Patreon URL: {}", e);
                events::emit_auth_error("Error opening Patreon authorization URL".to_string());
            }
        });
    }

    events::emit_auth_step_changed(AuthStep::WaitingCallback);
    Ok(())
}

#[tauri::command]
pub async fn poll_session(
    auth_state: State<'_, Arc<AuthState>>,
) -> AuthResult<Option<UserSession>> {
    get_current_session(auth_state).await
}

#[tauri::command]
pub async fn logout(
    app_handle: tauri::AppHandle,
    auth_state: State<'_, Arc<AuthState>>,
) -> AuthResult<()> {
    log::info!("Logout requested");

    // Obtener tokens para revocarlos
    let tokens_to_revoke = storage::load_tokens(&app_handle).await.ok().flatten();

    // Limpiar estado local
    auth_state.clear_all().await;
    storage::remove_tokens(&app_handle).await?;

    // Revocar tokens en backend si existen
    if let Some(tokens) = tokens_to_revoke {
        let api_client = api::ApiClient::new();
        if let Err(e) = api_client.logout(&tokens.access_token).await {
            log::error!("Backend logout error: {}", e);
        }
    }

    events::emit_auth_status_changed(None, None);
    log::info!("Logout complete");
    Ok(())
}

#[tauri::command]
pub async fn refresh_tokens(
    app_handle: tauri::AppHandle,
    auth_state: State<'_, Arc<AuthState>>,
) -> AuthResult<bool> {
    let current_tokens = match storage::load_tokens(&app_handle).await? {
        Some(tokens) => tokens,
        None => return Ok(false),
    };

    let api_client = api::ApiClient::new();

    match api_client
        .refresh_tokens(&current_tokens.refresh_token)
        .await
    {
        Ok(new_tokens) => {
            storage::save_tokens(&app_handle, &new_tokens).await?;
            log::info!("Tokens refreshed successfully");
            // Actualizar sesión de usuario
            match api_client.get_session(&new_tokens.access_token).await {
                Ok(user) => {
                    let mut session_guard = auth_state.session.lock().await;
                    *session_guard = Some(user.clone());
                    drop(session_guard);
                    events::emit_auth_status_changed(Some(user), Some(new_tokens.clone()));
                }
                Err(e) if e == "AUTH_EXPIRED" => {
                    log::error!(
                        "Auth error after token refresh (expired): {}",
                        e
                    );
                    storage::remove_tokens(&app_handle).await?;
                    auth_state.clear_all().await;
                    events::emit_auth_status_changed(None, None);
                    return Ok(false);
                }
                Err(e) => {
                    log::error!("Server error after token refresh: {}", e);
                    // No borramos tokens si es error de servidor/red
                    return Err(e);
                }
            }
            Ok(true)
        }
        Err(e) => {
            if e == "REFRESH_TOKEN_EXPIRED" {
                log::error!("Refresh token expired");
                storage::remove_tokens(&app_handle).await?;
                auth_state.clear_all().await;
                events::emit_auth_status_changed(None, None);
                return Ok(false);
            }

            // Propagar error de servidor/red sin limpiar tokens
            log::warn!(
                "Server or network error refreshing tokens: {}. Keeping credentials.",
                e
            );
            Err(e)
        }
    }
}

#[tauri::command]
pub async fn get_access_token(app_handle: tauri::AppHandle) -> Result<Option<String>, String> {
    match storage::load_tokens(&app_handle).await {
        Ok(Some(tokens)) => Ok(Some(tokens.access_token)),
        Ok(None) => Ok(None),
        Err(e) => Err(format!("Error loading tokens: {}", e)),
    }
}

// --- Setup function ---
pub fn setup_auth(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    app.manage(Arc::new(AuthState::new()));
    log::info!("Auth state initialized");
    Ok(())
}

// --- HTTP callback handler ---
async fn handle_oauth_callback(
    req: Request<Body>,
    app_state_mutex: Arc<Mutex<AppState>>,
    success_html: &'static str,
    label: &str,
) -> Result<Response<Body>, Infallible> {
    let uri = req.uri();

    if uri.path() != "/callback" {
        let mut response = Response::new(Body::from("Not Found"));
        *response.status_mut() = HyperStatusCode::NOT_FOUND;
        return Ok(response);
    }

    // Extract authorization code from query string
    let code = uri.query().unwrap_or("").split('&').find_map(|pair| {
        let mut parts = pair.splitn(2, '=');
        if parts.next() == Some("code") {
            parts.next().map(|v| v.to_string())
        } else {
            None
        }
    });

    match code {
        Some(code_str) => {
            // Store code - the polling function will process it and shut down the server
            {
                let state = app_state_mutex.lock().await;
                let mut auth_code_guard = state.auth_state.auth_code.lock().await;
                *auth_code_guard = Some(code_str);
            }

            let mut response = Response::new(Body::from(success_html));
            response.headers_mut().insert(
                CONTENT_TYPE,
                HeaderValue::from_static("text/html; charset=utf-8"),
            );
            Ok(response)
        }
        None => {
            log::error!("{} OAuth Callback Error: No code received", label);
            let mut response =
                Response::new(Body::from("Error: No authorization code received"));
            *response.status_mut() = HyperStatusCode::BAD_REQUEST;
            Ok(response)
        }
    }
}

async fn process_link_account_code(
    code: &str,
    redirect_uri: Option<String>,
    link_fn: impl std::future::Future<Output = AuthResult<()>>,
    label: &str,
) -> AuthResult<()> {
    link_fn.await.map_err(|e| {
        log::error!("Error linking {} account: {}", label, e);
        format!("Failed to link {} account: {}", label, e)
    })?;

    log::info!("{} account linked successfully via backend", label);
    Ok(())
}

// Twitch success HTML page
const TWITCH_SUCCESS_HTML: &str = r#"
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8" />
    <title>Modpack Store - Twitch Linked</title>
    <style>
        @import url(https://fonts.googleapis.com/css2?family=Montserrat&display=swap);
        body {
            margin: 3em;
            max-width: 600px;
            background-color: #f9f9f9;
            color: #333;
            font-family: Montserrat, sans-serif;
        }
        .container {
            background-color: #fff;
            padding: 2em;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        h1 { color: #9146ff; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Twitch Account Linked Successfully!</h1>
        <p>You can now close this window and go back to the Modpack Store Launcher.</p>
        <p>Your Twitch account has been linked and you can now access Twitch subscriber-only content.</p>
    </div>
</body>
</html>
"#;

// Patreon success HTML page
const PATREON_SUCCESS_HTML: &str = r#"
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8" />
    <title>Modpack Store - Patreon Connected</title>
    <style>
        @import url(https://fonts.googleapis.com/css2?family=Montserrat&display=swap);
        body {
            margin: 3em;
            max-width: 600px;
            background-color: #f9f9f9;
            color: #333;
            font-family: Montserrat, sans-serif;
        }
        .container {
            background-color: #fff;
            padding: 2em;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        h1 { color: #ff424d; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Patreon Account Connected Successfully!</h1>
        <p>You can now close this window and go back to the Modpack Store Launcher.</p>
        <p>Your Patreon account has been connected and your supporter benefits are now active.</p>
    </div>
</body>
</html>
"#;

// Success HTML page (sin cambios)
const SUCCESS_HTML: &str = r#"
<!DOCTYPE html>
<html>

<head>
    <meta charset=\"UTF-8\" />
    <title>Modpack Store</title>
    <style>
        @import url(https://fonts.googleapis.com/css2?family=Montserrat&display=swap);

        body {
            margin: 3em;
            max-width: 600px;
            background-color: #f9f9f9;
            color: #333;
        }

        h1,
        p {
            font-family: Montserrat, sans-serif;
            margin-bottom: 20px;
        }

        h1 {
            color: #4CAF50;
        }

        .container {
            padding: 20px;
            background: #fff;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
    </style>
</head>

<body>
    <div class=\"container\">
        <h1>Login Successful</h1>

        <p>You can now close this window and go back to the Modpack Store Launcher.</p>
        <p>Ahora puedes cerrar esta ventana y volver al Launcher de Modpack Store.</p>
        <p>Pode agora fechar esta janela e voltar para o lançador Modpack Store.</p>
        <p>Tu peux maintenant fermer cette fenêtre et retourner au lanceur de Modpack Store.</p>
        <p>Sie können dieses Fenster nun schließen und zum Modpack Store Launcher zurückkehren.</p>
    </div>
</body>

</html>
"#;
