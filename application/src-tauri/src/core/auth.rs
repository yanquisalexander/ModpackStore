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
use tauri::{Emitter, Manager, State};
use tauri_plugin_http::reqwest::{Client, StatusCode};
use tauri_plugin_opener;
use tauri_plugin_store::StoreExt;
use tokio::sync::{oneshot, Mutex};

// Constantes centralizadas
const STORAGE_PATH: &str = "auth_store.json";
const STORAGE_KEY_TOKENS: &str = "auth_tokens";
const CLIENT_ID: &str = "943184136976334879";
const REDIRECT_URI: &str = "http://localhost:1957/callback";
const CALLBACK_TIMEOUT_SECS: u64 = 120;
const POLL_INTERVAL_SECS: u64 = 1;
const SERVER_ADDR: ([u8; 4], u16) = ([127, 0, 0, 1], 1957);

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
mod storage {
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
        let binding = GLOBAL_APP_HANDLE.lock().unwrap();
        let app = binding.as_ref().ok_or("AppHandle no inicializado")?;
        let main_window = app
            .get_webview_window("main")
            .ok_or("Ventana principal no encontrada")?;
        main_window.emit(event, payload).map_err(|e| e.to_string())
    }

    pub fn emit_auth_error<T: Serialize + Clone>(payload: T) {
        match serde_json::to_string(&payload) {
            Ok(payload_str) => println!("Emitiendo auth-error con payload: {}", payload_str),
            Err(_) => println!("Emitiendo auth-error con payload (no serializable)"),
        }
        let _ = emit_event("auth-error", Some(payload));
    }

    pub fn emit_auth_status_changed(session: Option<UserSession>) {
        let _ = emit_event("auth-status-changed", session);
    }

    pub fn emit_auth_step_changed(step: AuthStep) {
        let _ = emit_event("auth-step-changed", Some(step));
    }
}

// --- API helpers ---
mod api {
    use super::*;

    pub struct ApiClient {
        client: Client,
    }

    impl ApiClient {
        pub fn new() -> Self {
            Self {
                client: Client::new(),
            }
        }

        pub async fn get_session(&self, access_token: &str) -> AuthResult<UserSession> {
            let session_endpoint = format!("{}/auth/me", API_ENDPOINT);

            let response = self
                .client
                .get(&session_endpoint)
                .bearer_auth(access_token)
                .send()
                .await
                .map_err(|e| format!("Error al contactar API: {}", e))?;

            if !response.status().is_success() {
                return Err(format!("Error de API: {}", response.status()));
            }

            response
                .json::<UserSession>()
                .await
                .map_err(|e| format!("Error al parsear sesión: {}", e))
        }

        pub async fn refresh_tokens(&self, refresh_token: &str) -> AuthResult<TokenResponse> {
            let refresh_endpoint = format!("{}/auth/refresh", API_ENDPOINT);

            let response = self
                .client
                .post(&refresh_endpoint)
                .json(&json!({ "refresh_token": refresh_token }))
                .send()
                .await
                .map_err(|e| format!("Error al contactar API: {}", e))?;

            if !response.status().is_success() {
                return Err(format!("Error al renovar tokens: {}", response.status()));
            }

            response
                .json::<TokenResponse>()
                .await
                .map_err(|e| format!("Error al parsear tokens: {}", e))
        }

        pub async fn exchange_code_for_tokens(&self, code: &str) -> AuthResult<TokenResponse> {
            let token_endpoint = format!("{}/auth/discord/callback?code={}", API_ENDPOINT, code);

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
                    .unwrap_or_else(|_| "No se pudo obtener el cuerpo de la respuesta".into());
                eprintln!("Cuerpo de la respuesta: {}", raw_body);

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
            let logout_endpoint = format!("{}/logout", API_ENDPOINT);

            let response = self
                .client
                .post(&logout_endpoint)
                .bearer_auth(access_token)
                .send()
                .await
                .map_err(|e| format!("Error al contactar API: {}", e))?;

            if response.status().is_success() {
                println!("Logout en backend exitoso");
            } else {
                eprintln!("Logout en backend falló: Estado {}", response.status());
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
                println!("No hay tokens guardados");
                return Ok(None);
            }
        };

        println!("Tokens encontrados, verificando sesión...");

        // Intentar obtener sesión con tokens actuales
        match api_client.get_session(&tokens.access_token).await {
            Ok(user) => {
                println!("Sesión recuperada con éxito");
                save_session_and_notify(auth_state, user.clone()).await;
                return Ok(Some(user));
            }
            Err(_) => {
                println!("Tokens expirados, intentando renovar...");
            }
        }

        // Intentar renovar tokens
        match api_client.refresh_tokens(&tokens.refresh_token).await {
            Ok(new_tokens) => {
                storage::save_tokens(app_handle, &new_tokens).await?;
                println!("Tokens renovados con éxito");

                // Obtener sesión con nuevos tokens
                match api_client.get_session(&new_tokens.access_token).await {
                    Ok(user) => {
                        println!("Sesión recuperada tras renovar tokens");
                        save_session_and_notify(auth_state, user.clone()).await;
                        Ok(Some(user))
                    }
                    Err(e) => {
                        eprintln!("Error tras renovar tokens: {}", e);
                        storage::remove_tokens(app_handle).await?;
                        events::emit_auth_status_changed(None);
                        Ok(None)
                    }
                }
            }
            Err(e) => {
                eprintln!("Error al renovar tokens: {}", e);
                if !e.contains("530") {
                    storage::remove_tokens(app_handle).await?;
                }
                events::emit_auth_status_changed(None);
                Ok(None)
            }
        }
    }

    async fn save_session_and_notify(auth_state: &Arc<AuthState>, user: UserSession) {
        let mut session_guard = auth_state.session.lock().await;
        *session_guard = Some(user.clone());
        drop(session_guard);

        events::emit_auth_status_changed(Some(user));
    }
}

// --- OAuth Server ---
struct AppState {
    auth_state: Arc<AuthState>,
    server_tx: Option<oneshot::Sender<()>>,
}

async fn start_oauth_server(auth_state: Arc<AuthState>) -> AuthResult<()> {
    let (shutdown_tx, shutdown_rx) = oneshot::channel::<()>();

    let app_state_mutex = Arc::new(Mutex::new(AppState {
        auth_state: Arc::clone(&auth_state),
        server_tx: Some(shutdown_tx),
    }));

    let addr = SocketAddr::from(SERVER_ADDR);
    let app_state_clone = app_state_mutex.clone();

    let make_svc = make_service_fn(move |_conn| {
        let app_state = app_state_clone.clone();
        async move {
            Ok::<_, Infallible>(service_fn(move |req| {
                handle_callback(req, app_state.clone())
            }))
        }
    });

    let server = Server::bind(&addr)
        .serve(make_svc)
        .with_graceful_shutdown(async {
            shutdown_rx.await.ok();
            println!("Servidor de callback apagándose.");
        });

    tokio::spawn(async move {
        println!("Servidor de callback escuchando en http://{}", addr);
        if let Err(e) = server.await {
            eprintln!("Error del servidor: {}", e);
            events::emit_auth_error(format!("Error del servidor: {}", e));
        }
    });

    // Iniciar tarea de polling para procesar el código
    let auth_state_clone = Arc::clone(&auth_state);
    tokio::spawn(async move {
        poll_for_auth_code(auth_state_clone, app_state_mutex).await;
    });

    Ok(())
}

async fn poll_for_auth_code(auth_state: Arc<AuthState>, app_state_mutex: Arc<Mutex<AppState>>) {
    for i in 0..CALLBACK_TIMEOUT_SECS {
        let code_option = {
            let auth_code_guard = auth_state.auth_code.lock().await;
            auth_code_guard.clone()
        };

        if let Some(code) = code_option {
            println!("Código de autenticación recibido");
            events::emit_auth_step_changed(AuthStep::ProcessingCallback);

            // Procesar el código
            if let Err(e) = process_auth_code(&code, &auth_state).await {
                events::emit_auth_error(e);
            }
            return;
        }

        if i % 10 == 0 && i > 0 {
            println!("Esperando código... ({}s / {}s)", i, CALLBACK_TIMEOUT_SECS);
        }

        tokio::time::sleep(Duration::from_secs(POLL_INTERVAL_SECS)).await;
    }

    // Timeout
    eprintln!("Timeout de autenticación");
    events::emit_auth_error("Timeout de autenticación".to_string());

    let mut state = app_state_mutex.lock().await;
    if let Some(tx) = state.server_tx.take() {
        let _ = tx.send(());
    }
}

async fn process_auth_code(code: &str, auth_state: &Arc<AuthState>) -> AuthResult<()> {
    let api_client = api::ApiClient::new();

    // Obtener handle de la app
    let app_handle = {
        let binding = GLOBAL_APP_HANDLE.lock().unwrap();
        binding.as_ref().ok_or("AppHandle no inicializado")?.clone()
    };

    // Enfocar ventana principal
    if let Some(main_window) = app_handle.get_webview_window("main") {
        let _ = main_window.set_focus();
    }

    // Intercambiar código por tokens
    let tokens = api_client.exchange_code_for_tokens(code).await?;

    // Guardar tokens
    storage::save_tokens(&app_handle, &tokens).await?;

    // Obtener sesión de usuario
    events::emit_auth_step_changed(AuthStep::RequestingSession);
    let user = api_client.get_session(&tokens.access_token).await?;

    // Guardar sesión y notificar
    let mut session_guard = auth_state.session.lock().await;
    *session_guard = Some(user.clone());
    drop(session_guard);

    events::emit_auth_status_changed(Some(user));
    println!("Autenticación completada exitosamente");

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
pub async fn start_discord_auth(auth_state: State<'_, Arc<AuthState>>) -> AuthResult<()> {
    events::emit_auth_step_changed(AuthStep::StartingAuth);

    // Limpiar estado previo
    auth_state.clear_all().await;

    // Iniciar servidor OAuth
    start_oauth_server(Arc::clone(auth_state.inner())).await?;

    // Abrir URL de autenticación
    let discord_url = format!(
        "https://discord.com/api/oauth2/authorize?client_id={}&response_type=code&scope=identify%20email%20guilds&redirect_uri={}",
        CLIENT_ID, REDIRECT_URI
    );

    println!("Abriendo URL de autenticación: {}", discord_url);
    std::thread::spawn(move || {
        if let Err(e) = tauri_plugin_opener::open_url(discord_url, None::<String>) {
            eprintln!("Error al abrir URL: {}", e);
            events::emit_auth_error("Error al abrir URL de autenticación".to_string());
        }
    });

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
    println!("Logout solicitado");

    // Obtener tokens para revocarlos
    let tokens_to_revoke = storage::load_tokens(&app_handle).await.ok().flatten();

    // Limpiar estado local
    auth_state.clear_all().await;
    storage::remove_tokens(&app_handle).await?;

    // Revocar tokens en backend si existen
    if let Some(tokens) = tokens_to_revoke {
        let api_client = api::ApiClient::new();
        if let Err(e) = api_client.logout(&tokens.access_token).await {
            eprintln!("Error en logout de backend: {}", e);
        }
    }

    events::emit_auth_status_changed(None);
    println!("Logout completo");
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
            println!("Tokens renovados exitosamente");
            Ok(true)
        }
        Err(e) => {
            // Limpiar tokens inválidos
            storage::remove_tokens(&app_handle).await?;
            auth_state.clear_all().await;
            events::emit_auth_status_changed(None);
            Err(e)
        }
    }
}

// --- Setup function ---
pub fn setup_auth(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    app.manage(Arc::new(AuthState::new()));
    println!("Estado de autenticación inicializado");
    Ok(())
}

// --- HTTP callback handler ---
async fn handle_callback(
    req: Request<Body>,
    app_state_mutex: Arc<Mutex<AppState>>,
) -> Result<Response<Body>, Infallible> {
    let uri = req.uri();

    if uri.path() != "/callback" {
        let mut response = Response::new(Body::from("Not Found"));
        *response.status_mut() = HyperStatusCode::NOT_FOUND;
        return Ok(response);
    }

    // Extraer código de autorización
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
            // Guardar código y apagar servidor
            let mut state = app_state_mutex.lock().await;
            let mut auth_code_guard = state.auth_state.auth_code.lock().await;
            *auth_code_guard = Some(code_str);
            drop(auth_code_guard);

            if let Some(tx) = state.server_tx.take() {
                let _ = tx.send(());
            }

            // Respuesta de éxito
            let mut response = Response::new(Body::from(SUCCESS_HTML));
            response.headers_mut().insert(
                CONTENT_TYPE,
                HeaderValue::from_static("text/html; charset=utf-8"),
            );
            Ok(response)
        }
        None => {
            eprintln!("OAuth Callback Error: No se recibió código");
            let mut response =
                Response::new(Body::from("Error: No se recibió código de autorización"));
            *response.status_mut() = HyperStatusCode::BAD_REQUEST;
            Ok(response)
        }
    }
}

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
