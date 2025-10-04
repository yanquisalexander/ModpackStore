# Token Refresh Flow Diagrams

## 1. Flujo de Autenticación Inicial

```
┌─────────────┐
│   Usuario   │
└──────┬──────┘
       │
       │ Click "Login with Discord"
       ▼
┌─────────────────────┐
│  startDiscordAuth() │
└──────┬──────────────┘
       │
       │ OAuth Flow
       ▼
┌─────────────────────┐
│  Discord Callback   │
└──────┬──────────────┘
       │
       │ Exchange code for tokens
       ▼
┌─────────────────────────────┐
│  Backend: /auth/callback    │
│  - Genera access_token (4h) │
│  - Genera refresh_token (30d)│
└──────┬──────────────────────┘
       │
       │ Return tokens
       ▼
┌─────────────────────────────┐
│  Frontend: AuthContext      │
│  - Guarda tokens en store   │
│  - Decodifica JWT (exp)     │
│  - Programa timer refresh   │
└──────┬──────────────────────┘
       │
       │ auth-status-changed event
       ▼
┌─────────────────────────────┐
│  App: Usuario Autenticado   │
└─────────────────────────────┘
```

## 2. Flujo de Refresh Proactivo (Timer)

```
┌──────────────────────────┐
│  Access Token Activo     │
│  Expira en: 4 horas      │
└────────┬─────────────────┘
         │
         │ Tiempo transcurre...
         │
         │ 3h 55m (5 min antes)
         ▼
┌──────────────────────────┐
│  Timer Trigger           │
│  scheduleTokenRefresh()  │
└────────┬─────────────────┘
         │
         │ Call refreshTokens()
         ▼
┌──────────────────────────┐
│  Frontend: invoke()      │
│  'refresh_tokens'        │
└────────┬─────────────────┘
         │
         │ Rust/Tauri Command
         ▼
┌──────────────────────────┐
│  Backend API Call        │
│  POST /auth/refresh      │
│  { refresh_token }       │
└────────┬─────────────────┘
         │
         │ Valida refresh_token
         ▼
┌──────────────────────────────┐
│  Backend: auth.service       │
│  - Verifica JWT signature    │
│  - Valida session            │
│  - Genera nuevos tokens      │
└────────┬─────────────────────┘
         │
         │ Return new tokens
         ▼
┌──────────────────────────────┐
│  Rust: Guarda en store       │
└────────┬─────────────────────┘
         │
         │ auth-status-changed
         ▼
┌──────────────────────────────┐
│  Frontend: AuthContext       │
│  - Actualiza sessionTokens   │
│  - Programa nuevo timer      │
└────────┬─────────────────────┘
         │
         │ Transparente para usuario
         ▼
┌──────────────────────────────┐
│  Usuario sigue usando app    │
│  Sesión continúa activa      │
└──────────────────────────────┘
```

## 3. Flujo de Retry Reactivo (fetchWithAuth)

```
┌──────────────────────────┐
│  API Request con Token   │
│  fetchWithAuth('/endpoint')│
└────────┬─────────────────┘
         │
         │ Token expirado
         ▼
┌──────────────────────────┐
│  Backend Response        │
│  401 Unauthorized        │
└────────┬─────────────────┘
         │
         │ fetchWithAuth detecta 401
         ▼
┌──────────────────────────┐
│  Attempt Token Refresh   │
│  invoke('refresh_tokens')│
└────────┬─────────────────┘
         │
         ├─── Success ─────┐
         │                 │
         │                 ▼
         │         ┌─────────────────────┐
         │         │  Obtiene new token  │
         │         │  del store          │
         │         └────────┬────────────┘
         │                  │
         │                  │ Actualiza header
         │                  ▼
         │         ┌─────────────────────┐
         │         │  Retry Request      │
         │         │  con nuevo token    │
         │         └────────┬────────────┘
         │                  │
         │                  │ 200 OK
         │                  ▼
         │         ┌─────────────────────┐
         │         │  Return Response    │
         │         │  Request Exitoso    │
         │         └─────────────────────┘
         │
         └─── Failure ────┐
                          │
                          ▼
                  ┌─────────────────────┐
                  │  Show Dialog        │
                  │  Session Expired    │
                  └─────────────────────┘
```

## 4. Flujo de Sesión Expirada

```
┌──────────────────────────┐
│  Refresh Token Attempt   │
└────────┬─────────────────┘
         │
         │ refresh_token expirado/inválido
         ▼
┌──────────────────────────┐
│  Backend: 401 Error      │
│  "Invalid refresh token" │
└────────┬─────────────────┘
         │
         │ Error response
         ▼
┌──────────────────────────┐
│  Frontend: refreshTokens()│
│  catch (err)             │
└────────┬─────────────────┘
         │
         │ Set state
         ▼
┌──────────────────────────┐
│  setShowSessionExpired   │
│  (true)                  │
└────────┬─────────────────┘
         │
         │ Clear tokens/session
         ▼
┌──────────────────────────────┐
│  SessionExpiredDialog        │
│  ┌────────────────────────┐  │
│  │   ⚠️  Sesión Expirada  │  │
│  │                        │  │
│  │  Tu sesión ha expirado │  │
│  │  por seguridad.        │  │
│  │                        │  │
│  │  [Iniciar Sesión]      │  │
│  └────────────────────────┘  │
└────────┬─────────────────────┘
         │
         │ User clicks button
         ▼
┌──────────────────────────┐
│  startDiscordAuth()      │
│  OAuth flow reinicia     │
└──────────────────────────┘
```

## 5. Timeline de Vida de Tokens

```
Hora 0
  │  Login con Discord
  │  ┌─────────────────────────────────────┐
  │  │  Access Token (4h)                  │
  │  └─────────────────────────────────────┘
  │  ┌─────────────────────────────────────────────────────────────────────────────┐
  │  │  Refresh Token (30 días)                                                     │
  │  └─────────────────────────────────────────────────────────────────────────────┘
  │
3h 55m
  │  Timer dispara refresh
  │  ┌─────────────────────────────────────┐
  │  │  New Access Token (4h)              │
  │  └─────────────────────────────────────┘
  │  ┌─────────────────────────────────────────────────────────────────────────────┐
  │  │  New Refresh Token (30 días desde ahora)                                     │
  │  └─────────────────────────────────────────────────────────────────────────────┘
  │
7h 50m
  │  Timer dispara refresh
  │  ┌─────────────────────────────────────┐
  │  │  New Access Token (4h)              │
  │  └─────────────────────────────────────┘
  │  ┌─────────────────────────────────────────────────────────────────────────────┐
  │  │  New Refresh Token (30 días desde ahora)                                     │
  │  └─────────────────────────────────────────────────────────────────────────────┘
  │
  │  Ciclo continúa...
  │  Usuario puede usar app indefinidamente (hasta 30 días sin actividad)
  ▼
```

## 6. Estados del Sistema

```
┌─────────────────────────────────────────────────────┐
│                  Estados Posibles                   │
├─────────────────────────────────────────────────────┤
│                                                     │
│  1. ✅ AUTHENTICATED & TOKEN_VALID                  │
│     - Usuario puede hacer requests                 │
│     - Timer programado                             │
│     - UX normal                                    │
│                                                     │
│  2. ⏰ AUTHENTICATED & TOKEN_EXPIRING_SOON          │
│     - Timer dispara refresh                        │
│     - Transparente para usuario                    │
│     - Transición a estado 1                        │
│                                                     │
│  3. 🔄 REFRESHING                                   │
│     - isRefreshingRef = true                       │
│     - API call a /auth/refresh                     │
│     - Previene refreshes concurrentes              │
│                                                     │
│  4. ⚠️  REFRESH_FAILED                              │
│     - showSessionExpired = true                    │
│     - Dialog visible                               │
│     - Tokens limpiados                             │
│                                                     │
│  5. 🚪 LOGGED_OUT                                   │
│     - session = null                               │
│     - sessionTokens = null                         │
│     - No timer activo                              │
│     - Redirect a login                             │
│                                                     │
└─────────────────────────────────────────────────────┘
```

## 7. Componentes y Responsabilidades

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND                             │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  AuthContext.tsx                                        │
│  ├─ State Management                                    │
│  ├─ JWT Decoding                                        │
│  ├─ Timer Scheduling                                    │
│  ├─ Refresh Logic                                       │
│  └─ Error Handling                                      │
│                                                         │
│  SessionExpiredDialog.tsx                               │
│  ├─ UI Component                                        │
│  └─ Re-auth Trigger                                     │
│                                                         │
│  fetchWithAuth.ts                                       │
│  ├─ HTTP Wrapper                                        │
│  ├─ 401 Detection                                       │
│  └─ Auto Retry                                          │
│                                                         │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                  RUST/TAURI                             │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  auth.rs                                                │
│  ├─ refresh_tokens Command                              │
│  ├─ Token Storage                                       │
│  └─ API Client                                          │
│                                                         │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                   BACKEND API                           │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  auth.service.ts                                        │
│  ├─ refreshAuthTokens()                                 │
│  ├─ JWT Verification                                    │
│  └─ Token Generation                                    │
│                                                         │
│  POST /auth/refresh                                     │
│  ├─ Validates refresh_token                             │
│  ├─ Returns new tokens                                  │
│  └─ 30d refresh expiry                                  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```
