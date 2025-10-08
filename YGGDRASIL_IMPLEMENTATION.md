# Yggdrasil AuthServer Implementation

This document describes the implementation of a custom Yggdrasil-compatible authentication server for ModpackStore.

## Overview

The Yggdrasil AuthServer allows ModpackStore users to join Minecraft servers using their ModpackStore account, without needing a Microsoft account. It's fully compatible with the Mojang/Microsoft Yggdrasil authentication protocol.

## Architecture

### Backend (Node.js/TypeORM)

#### Database Schema

**GameSession Entity** (`game_sessions` table)
- `id` (UUID): Primary key
- `userId` (UUID): Foreign key to users table
- `accessToken` (TEXT): Yggdrasil access token
- `clientToken` (TEXT): Yggdrasil client token
- `serverId` (TEXT): Server ID hash (when joining a server)
- `ipAddress` (INET): IP address of the client
- `lastActivity` (TIMESTAMP): Last activity timestamp
- `expiresAt` (TIMESTAMP): Session expiration timestamp
- `createdAt` (TIMESTAMP): Creation timestamp
- `updatedAt` (TIMESTAMP): Update timestamp

#### API Endpoints

All endpoints are mounted under `/yggdrasil`:

1. **POST /authenticate**
   - Authenticates user with ModpackStore JWT token
   - Returns Yggdrasil access/client tokens and profile
   - Request body:
     ```json
     {
       "username": "optional_custom_nickname",
       "password": "jwt_token",
       "clientToken": "optional_client_token"
     }
     ```

2. **POST /refresh**
   - Refreshes an access token
   - Extends session lifetime

3. **POST /validate**
   - Validates an access token
   - Returns 204 if valid, 403 if invalid

4. **POST /invalidate**
   - Invalidates an access token (logout)

5. **POST /signout**
   - Signs out all sessions (not fully implemented)

6. **POST /session/minecraft/join**
   - Called by Minecraft client when joining a server
   - Stores server ID for verification

7. **GET /session/minecraft/hasJoined**
   - Called by Minecraft server to verify player
   - Query params: `username`, `serverId`, `ip` (optional)
   - Returns player profile if valid, 204 if not

8. **GET /session/minecraft/profile/:uuid**
   - Returns player profile by UUID
   - Includes skin/texture data

#### Session Management

- Sessions expire after 24 hours
- Sessions are invalidated after 20 minutes of inactivity
- Automatic cleanup of expired sessions

### Frontend (Rust/Tauri)

#### MinecraftInstance Extension

Added `ms_nickname` field:
```rust
pub struct MinecraftInstance {
    // ... existing fields
    #[serde(default)]
    pub ms_nickname: Option<String>, // Custom nickname for ModpackStore auth
}
```

#### ModpackStoreAuth Service

Located in `application/src-tauri/src/core/modpackstore_auth.rs`

Features:
- Authenticates with Yggdrasil server using JWT token
- Downloads authlib-injector JAR if not present
- Builds authlib-injector JVM arguments

#### Async Launcher

Located in `application/src-tauri/src/core/minecraft/async_launcher.rs`

The async launcher handles the complete authentication flow:

1. Checks if instance has `accountUuid`
   - If yes: Use existing Microsoft/Offline account
   - If no: Use ModpackStore authentication

2. For ModpackStore auth:
   - Retrieves JWT token from auth store
   - Authenticates with `/yggdrasil/authenticate`
   - Receives Yggdrasil access token and profile
   - Downloads authlib-injector if needed
   - Creates temporary MinecraftAccount with Yggdrasil credentials

3. Injects authlib-injector as JVM argument:
   ```
   -javaagent:/path/to/authlib-injector.jar=https://api.modpackstore.com/yggdrasil
   ```

4. Launches Minecraft with proper authentication

#### Tauri Command

New command: `launch_minecraft_async`
```rust
#[tauri::command]
pub async fn launch_minecraft_async(
    instance_id: String,
    app_handle: tauri::AppHandle,
) -> Result<u32, String>
```

## Usage

### For Users

1. Log in to ModpackStore application
2. Create or select an instance
3. Leave `accountUuid` empty (don't select Microsoft/Offline account)
4. Optionally set `ms_nickname` for a custom in-game name
5. Launch the instance
6. Join a Minecraft server with `online-mode=true`

### For Server Administrators

To enable ModpackStore authentication on your server:

1. Set `online-mode=true` in `server.properties`
2. Add authlib-injector to server startup:
   ```bash
   java -javaagent:authlib-injector.jar=https://api.modpackstore.com/yggdrasil -jar server.jar
   ```
3. Players using ModpackStore accounts will be authenticated through the custom server

## Security

- JWT tokens are verified before issuing Yggdrasil tokens
- Sessions have limited lifetime (24 hours)
- Inactivity timeout (20 minutes)
- Server ID verification prevents session hijacking
- Optional IP address validation

## Compatibility

- Compatible with Minecraft 1.7 through 1.20.x
- Works with Forge, Fabric, and Vanilla clients
- No modification to existing Microsoft/Offline accounts
- Fully compatible with authlib-injector standard

## Implementation Details

### Token Generation

- Access tokens: 64-character random hex strings
- Client tokens: 32-character random hex strings
- UUIDs: Generated from user ID, formatted with dashes

### Profile Properties

Profiles include texture properties for skins:
```json
{
  "id": "uuid-with-dashes",
  "name": "username",
  "properties": [
    {
      "name": "textures",
      "value": "base64_encoded_texture_data",
      "signature": "optional_signature"
    }
  ]
}
```

### Session Flow

1. **Client Launch**:
   - Client authenticates with `/yggdrasil/authenticate`
   - Receives `accessToken` and profile

2. **Join Server**:
   - Client calls `/yggdrasil/session/minecraft/join`
   - Stores `serverId` hash in session

3. **Server Verification**:
   - Server calls `/yggdrasil/session/minecraft/hasJoined`
   - Verifies username and serverId match
   - Returns profile if valid

4. **Session Update**:
   - Clear serverId after verification
   - Update last activity timestamp

## Future Enhancements

- [ ] Skin upload and management
- [ ] Cape support
- [ ] Two-factor authentication
- [ ] Rate limiting on authentication endpoints
- [ ] Admin dashboard for session management
- [ ] Webhook notifications for authentication events
- [ ] API key authentication for server administrators

## Testing

### Manual Testing

1. Start backend server
2. Authenticate and get JWT token
3. Test `/yggdrasil/authenticate` endpoint:
   ```bash
   curl -X POST http://localhost:3000/yggdrasil/authenticate \
     -H "Content-Type: application/json" \
     -d '{"password": "your_jwt_token"}'
   ```

4. Launch Minecraft instance without account
5. Join a test server with online-mode enabled

### Unit Tests

Backend service tests should cover:
- Token generation and validation
- Session expiration
- Profile building
- Error handling

Frontend tests should cover:
- Auth service authentication
- authlib-injector download
- JVM argument building

## Troubleshooting

### Common Issues

1. **"Invalid JWT token"**
   - Ensure user is logged in to ModpackStore
   - Check JWT token is not expired
   - Verify API endpoint is correct

2. **"Session expired"**
   - Session has been inactive for >20 minutes
   - Re-launch instance to get new session

3. **"Failed to download authlib-injector"**
   - Check internet connection
   - Verify GitHub releases are accessible
   - Check file permissions in Minecraft directory

4. **"Server rejected connection"**
   - Verify server has authlib-injector configured
   - Check server is pointing to correct Yggdrasil URL
   - Ensure online-mode=true in server.properties

## Credits

- Yggdrasil protocol specification: https://wiki.vg/Protocol_Encryption
- authlib-injector: https://github.com/yushijinhun/authlib-injector

## License

Part of ModpackStore project. All rights reserved.
