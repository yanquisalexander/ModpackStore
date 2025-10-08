# AuthServer Implementation - Modpack Store

## Overview

This document describes the implementation of a custom Yggdrasil-compatible authentication server for Modpack Store accounts, allowing users to join Minecraft servers with their Modpack Store credentials and custom nicknames.

## Architecture

### Backend (Node.js + TypeORM)

#### Entities

**GameSession** (`backend/src/entities/GameSession.ts`)
- Manages temporary game authentication tokens
- Tracks user sessions with 20-minute inactivity timeout
- Supports custom nicknames per session
- Fields:
  - `accessToken`: UUID format game token
  - `clientToken`: Launcher pairing token
  - `customNickname`: Optional per-session nickname
  - `lastActivityAt`: For inactivity tracking
  - `expiresAt`: Absolute expiration (24h max)

#### Controllers

**AuthServerController** (`backend/src/controllers/AuthServer.controller.ts`)
Implements Yggdrasil authentication protocol:

- `GET /authserver` - Discovery metadata
- `POST /authserver/authenticate` - Create game session
- `POST /authserver/refresh` - Refresh tokens
- `POST /authserver/validate` - Validate session
- `POST /authserver/invalidate` - Logout
- `GET /sessionserver/session/minecraft/profile/:uuid` - Get profile
- `POST /sessionserver/session/minecraft/join` - Join server
- `GET /sessionserver/session/minecraft/hasJoined` - Verify join

#### Routes

**authserver.routes.ts** (`backend/src/routes/v1/authserver.routes.ts`)
- Registered at root level for `/authserver` and `/sessionserver` paths
- Requires authentication for `authenticate` endpoint
- Public endpoints for session validation

### Frontend (Rust + Tauri)

#### Core Modules

**AuthlibInjectorManager** (`application/src-tauri/src/core/authlib_injector.rs`)
- Downloads and manages authlib-injector JAR (v1.2.5)
- Generates JVM arguments for injection
- Provides compatibility flags
- Stored in: `~/.config/ModpackStore/authlib-injector/`

**ModpackStoreAuthService** (`application/src-tauri/src/core/modpackstore_auth.rs`)
- HTTP client for AuthServer API
- Methods:
  - `authenticate()` - Get game session token
  - `refresh()` - Refresh token
  - `validate()` - Validate session
  - `invalidate()` - Logout

**GameSessionManager** (`application/src-tauri/src/core/game_session_manager.rs`)
- High-level game session orchestration
- Prepares MS account sessions before launch
- Creates temporary MinecraftAccount from session
- Generates authlib-injector JVM arguments

**MinecraftInstance** (modified)
- Added `ms_nickname: Option<String>` field
- When `accountUuid` is `None`, uses Modpack Store account
- Custom nickname overrides default username

**MinecraftLauncher** (modified)
- Added `override_account` and `additional_jvm_args` fields
- New `with_ms_account()` constructor
- Injects authlib-injector arguments before launch

**InstanceLauncher** (modified)
- Now creates Tokio runtime for async operations
- Detects MS account instances (accountUuid = None)
- Calls GameSessionManager to prepare session
- Passes prepared data to MinecraftLauncher

#### Tauri Commands

**authserver_commands.rs** (`application/src-tauri/src/core/authserver_commands.rs`)
- `check_authlib_injector_status()` - Check if downloaded
- `download_authlib_injector()` - Download JAR
- `instance_uses_ms_account(instance)` - Check if MS account
- `get_authlib_injector_path()` - Get JAR path
- `validate_ms_account_login()` - Check if user logged in

## Flow Diagrams

### Launch Flow with MS Account

```
1. User clicks "Launch" on instance
2. InstanceLauncher checks accountUuid
3. If None:
   a. Create GameSessionManager
   b. Ensure authlib-injector downloaded
   c. Get JWT from storage
   d. Call backend /authserver/authenticate
   e. Receive game session token + profile
   f. Create temporary MinecraftAccount
   g. Generate JVM args: -javaagent:authlib-injector.jar={API_URL}
4. Create MinecraftLauncher with prepared data
5. Launcher injects JVM args before launch
6. Minecraft starts with authlib-injector
7. authlib-injector intercepts authentication calls
8. Redirects auth to Modpack Store AuthServer
9. Server validates via /sessionserver/session/minecraft/hasJoined
10. Player joins with custom nickname
```

### Authentication Flow

```
Client (Launcher)                 Backend (AuthServer)               Minecraft Server
     |                                    |                                |
     |--- POST /authserver/authenticate ->|                                |
     |    (JWT token, custom nickname)    |                                |
     |<-- Game Session Token -------------|                                |
     |    (accessToken, profile)          |                                |
     |                                    |                                |
     |--- Launch Minecraft -------------->|                                |
     |    (with authlib-injector)         |                                |
     |                                    |                                |
     |                                    |<-- GET hasJoined?-------------|
     |                                    |    (username, serverId)        |
     |                                    |--- Profile Data ------------->|
     |                                    |    (UUID, nickname, props)    |
     |                                    |                                |
     |<---------------------------------- Player Joins ------------------->|
```

## Custom Nicknames

### Setting Custom Nickname

The `ms_nickname` field in MinecraftInstance allows per-instance custom names:

```rust
let mut instance = MinecraftInstance::new();
instance.ms_nickname = Some("CustomName".to_string());
instance.save()?;
```

### Validation Rules

- Length: 3-16 characters
- Characters: Alphanumeric + underscore only (a-z, A-Z, 0-9, _)
- Validated on both frontend and backend

### Usage

1. Set `ms_nickname` on instance
2. When launching, nickname passed to backend
3. Backend creates session with custom nickname
4. Minecraft uses custom nickname in-game
5. Servers see custom nickname, not account username

## Token Management

### Session Lifecycle

1. **Creation**: User launches instance
   - Backend creates GameSession with 24h expiry
   - Returns accessToken (UUID format)

2. **Validation**: Periodic checks
   - Frontend can call `/authserver/validate`
   - Backend checks expiry and inactivity

3. **Refresh**: Before expiry
   - Call `/authserver/refresh`
   - Old token invalidated
   - New token generated

4. **Expiration**: 
   - Absolute: 24 hours from creation
   - Inactivity: 20 minutes of no activity
   - `isExpired()` checks both conditions

5. **Invalidation**: Logout
   - Call `/authserver/invalidate`
   - Token marked as invalid

## authlib-injector Integration

### Download & Storage

- Version: 1.2.5
- URL: https://github.com/yushijinhun/authlib-injector/releases/download/v1.2.5/authlib-injector-1.2.5.jar
- Path: `~/.config/ModpackStore/authlib-injector/authlib-injector-1.2.5.jar`
- Auto-downloaded on first MS account launch

### JVM Arguments

Generated by AuthlibInjectorManager:

```bash
-javaagent:/path/to/authlib-injector.jar=https://api.modpackstore.com/v1
-Dauthlibinjector.mojangNamespace=true
-Dauthlibinjector.legacySkinPolyfill=true
-Dauthlibinjector.profileKey=false
-Dauthlibinjector.usernameCheck=false
```

### Compatibility

**Supported Minecraft Versions**: 1.7 - 1.20.x
**Unsupported**: < 1.7, Bedrock Edition

**Java Requirements**:
- Compile authlib-injector: JDK 17+
- Run Minecraft with agent: JRE 8+

## API Reference

### Backend Endpoints

#### POST /authserver/authenticate
Authenticate user and create game session.

**Headers**: `Authorization: Bearer <JWT>`

**Request**:
```json
{
  "username": "CustomNickname" // Optional
}
```

**Response**:
```json
{
  "accessToken": "uuid-format-token",
  "clientToken": "uuid-format-token",
  "availableProfiles": [{
    "id": "user-uuid-nodashes",
    "name": "CustomNickname"
  }],
  "selectedProfile": {
    "id": "user-uuid-nodashes",
    "name": "CustomNickname"
  }
}
```

#### POST /authserver/refresh
Refresh game session token.

**Request**:
```json
{
  "accessToken": "current-token",
  "clientToken": "client-token"
}
```

**Response**: Same as authenticate

#### POST /authserver/validate
Validate session token.

**Request**:
```json
{
  "accessToken": "token-to-validate",
  "clientToken": "client-token"
}
```

**Response**: 204 No Content (valid) or 403 Forbidden (invalid)

#### GET /sessionserver/session/minecraft/hasJoined
Verify player joined server (called by Minecraft server).

**Query Params**:
- `username`: Player name
- `serverId`: Server verification hash

**Response**:
```json
{
  "id": "user-uuid-nodashes",
  "name": "CustomNickname",
  "properties": []
}
```

### Frontend Commands

#### check_authlib_injector_status()
```typescript
const isDownloaded = await invoke('check_authlib_injector_status');
```

#### download_authlib_injector()
```typescript
const path = await invoke('download_authlib_injector');
```

#### instance_uses_ms_account(instance)
```typescript
const usesMsAccount = await invoke('instance_uses_ms_account', { instance });
```

#### validate_ms_account_login()
```typescript
const isLoggedIn = await invoke('validate_ms_account_login');
```

## Configuration

### Environment Variables

**Backend**:
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` - PostgreSQL
- `JWT_SECRET` - For JWT verification
- `NODE_ENV` - `development` or `production`

**Frontend**:
- `VITE_API_ENDPOINT` - AuthServer URL (production)
- Dev mode uses `http://localhost:3000/v1`

## Database Schema

```sql
CREATE TABLE game_sessions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  access_token UUID UNIQUE NOT NULL,
  client_token UUID,
  custom_nickname VARCHAR(16),
  last_activity_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  is_valid BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_game_sessions_user_id ON game_sessions(user_id);
CREATE INDEX idx_game_sessions_access_token ON game_sessions(access_token);
CREATE INDEX idx_game_sessions_last_activity ON game_sessions(last_activity_at);
CREATE INDEX idx_game_sessions_expires_at ON game_sessions(expires_at);
```

## Testing

### Manual Testing

1. **Test MS Account Launch**:
   ```bash
   # Create instance without accountUuid
   # Set ms_nickname if desired
   # Launch instance
   # Check logs for authlib-injector injection
   ```

2. **Test Authentication**:
   ```bash
   curl -X POST https://api.modpackstore.com/v1/authserver/authenticate \
     -H "Authorization: Bearer YOUR_JWT" \
     -H "Content-Type: application/json" \
     -d '{"username": "TestNick"}'
   ```

3. **Test Server Join**:
   - Set up Minecraft server with online-mode=false
   - Launch client with MS account
   - Join server
   - Verify custom nickname appears

### Unit Tests

Backend tests in `AuthServer.controller.ts`:
- Token generation
- Session validation
- Expiry handling
- Custom nickname validation

Frontend tests in `authlib_injector.rs`:
- JAR download
- Path management
- Argument generation

## Troubleshooting

### Common Issues

**authlib-injector not working**:
- Check Java version (JRE 8+ required)
- Verify JAR download completed
- Check JVM arguments in logs

**Authentication failed**:
- Verify user is logged in to Modpack Store
- Check JWT token is valid
- Ensure backend is reachable

**Custom nickname not working**:
- Verify nickname meets validation rules
- Check it's set in instance config
- Review backend logs for errors

**Session expired**:
- Sessions expire after 20 min inactivity or 24h max
- Re-launch to create new session
- Implement refresh logic if needed

### Logs

**Backend**: Check for AuthServer logs
```bash
grep "AuthServer" backend_logs.log
```

**Frontend**: Check Tauri logs
```bash
grep -E "(GameSessionManager|authlib-injector)" ~/.config/ModpackStore/logs/
```

## Security Considerations

1. **JWT Token Storage**: Tokens stored securely in Tauri store
2. **HTTPS Required**: Production must use HTTPS
3. **Token Expiry**: 20-minute inactivity, 24-hour max
4. **Nickname Validation**: Prevents injection attacks
5. **Session Binding**: Client token binds session to launcher

## Future Enhancements

- Skin/cape support with texture properties
- Session refresh on token expiry
- UI for setting ms_nickname
- Multiple sessions per user
- Session management dashboard
- Offline mode caching
- Rate limiting on authentication

## Credits

- authlib-injector: https://github.com/yushijinhun/authlib-injector
- Yggdrasil Protocol: Mojang/Microsoft
- Modpack Store Team

## License

See project LICENSE file.
