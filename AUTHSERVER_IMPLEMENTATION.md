# AuthServer Implementation for ModpackStore

This document describes the implementation of the ModpackStore AuthServer, which provides Yggdrasil-compatible authentication for Minecraft using authlib-injector.

## Overview

The AuthServer allows users to play on Minecraft servers with `online-mode=false` using their ModpackStore accounts. It implements the Mojang/Yggdrasil authentication protocol and is compatible with standard authlib-injector clients.

## Architecture

### Backend Components

#### 1. GameSession Entity (`backend/src/entities/GameSession.ts`)
- Stores temporary game session tokens (20-minute TTL)
- Linked to ModpackStore users
- Automatically expires inactive sessions
- Includes player profile name and token metadata

#### 2. YggdrasilService (`backend/src/services/yggdrasil.service.ts`)
- Implements Mojang/Yggdrasil authentication protocol
- Generates cryptographically secure access tokens
- Validates and refreshes game sessions
- Provides player profiles for Minecraft servers
- Supports custom profile names (nicknames)

#### 3. YggdrasilController (`backend/src/controllers/Yggdrasil.controller.ts`)
Handles HTTP endpoints:
- `POST /v1/yggdrasil/authenticate` - Create game session
- `POST /v1/yggdrasil/refresh` - Refresh game session
- `POST /v1/yggdrasil/validate` - Validate token
- `POST /v1/yggdrasil/invalidate` - Logout/invalidate session
- `GET /v1/yggdrasil/sessionserver/session/minecraft/profile/:uuid` - Get player profile
- `GET /v1/yggdrasil/` - Get authlib-injector metadata

### Launcher Components

#### 1. ModpackStore Auth Module (`application/src-tauri/src/core/modpackstore_auth.rs`)
- Requests game session tokens from AuthServer
- Uses user's JWT for authentication
- Validates Minecraft usernames (3-16 chars, alphanumeric + underscore)
- Formats UUIDs for Minecraft compatibility

#### 2. Authlib-Injector Manager (`application/src-tauri/src/core/authlib_injector.rs`)
- Downloads authlib-injector JAR (v1.2.5)
- Stores in user config directory
- Manages versioning and updates
- Provides path for JVM arguments

#### 3. Minecraft Launcher Integration (`application/src-tauri/src/core/minecraft/launcher.rs`)
Enhanced launcher logic:
- Checks instance `accountUuid` field
  - If set: Uses account from AccountsManager (Microsoft/Offline)
  - If null: Uses ModpackStore account
- For ModpackStore accounts:
  - Requests game session token from AuthServer
  - Downloads authlib-injector if needed
  - Adds `-javaagent` parameter to JVM arguments
  - Uses `ms_nickname` if set, otherwise user's username

#### 4. MinecraftInstance Structure
Added `ms_nickname` field:
```rust
pub struct MinecraftInstance {
    // ... existing fields ...
    #[serde(default)]
    pub ms_nickname: Option<String>, // Custom nickname for ModpackStore account
}
```

## Usage Flow

### 1. User Launches Instance without Account

When a user launches an instance where `accountUuid` is `null`:

1. Launcher detects no account is assigned
2. Checks if user is logged into ModpackStore
3. Requests game session token from `/v1/yggdrasil/authenticate`
   - Uses JWT for authentication
   - Sends `ms_nickname` if set, otherwise uses user's username
4. Receives `accessToken` and player profile (UUID, name)
5. Downloads authlib-injector if not present
6. Adds `-javaagent:/path/to/authlib-injector.jar=https://api.modpackstore.net/v1/yggdrasil`
7. Launches Minecraft with game session token

### 2. Minecraft Connects to Server

1. Minecraft client uses authlib-injector
2. Client sends authentication request to ModpackStore AuthServer
3. Server validates token with `/v1/yggdrasil/sessionserver/session/minecraft/profile/:uuid`
4. Server receives player profile with skin data
5. Player joins with custom nickname

### 3. Session Expiration

- Game sessions expire after 20 minutes of inactivity
- Sessions can be refreshed using `/v1/yggdrasil/refresh`
- Expired sessions are automatically cleaned up

## Configuration

### Environment Variables

Backend:
```env
API_URL=https://api.modpackstore.net  # Base URL for AuthServer
JWT_SECRET=your-secret-key            # For signing JWTs
```

Launcher:
```rust
// Automatically uses API_ENDPOINT from environment or defaults
const AUTHLIB_INJECTOR_VERSION: &str = "1.2.5";
```

### Instance Configuration

To use a custom nickname, set `ms_nickname` in instance.json:
```json
{
  "instanceId": "...",
  "instanceName": "My Modpack",
  "accountUuid": null,  // null = use ModpackStore account
  "ms_nickname": "CustomNick123",  // Optional custom nickname
  ...
}
```

## Security Considerations

1. **Token Expiration**: Game sessions expire after 20 minutes of inactivity
2. **JWT Authentication**: Only authenticated ModpackStore users can create game sessions
3. **Username Validation**: Nicknames must follow Minecraft rules (3-16 chars, alphanumeric + underscore)
4. **Token Generation**: Uses cryptographically secure random tokens
5. **Per-Instance Nicknames**: Users can have different nicknames per instance

## Compatibility

### Minecraft Versions
- Recommended: Minecraft Java Edition 1.7 - 1.20.x
- Requires: authlib-injector v1.2.5+
- Not compatible: Minecraft Bedrock Edition

### Java Requirements
- Compilation: JDK 17+
- Runtime: JRE 8+ (depends on Minecraft version)

### Server Requirements
- Server must have `online-mode=false` in server.properties
- Server will validate players through ModpackStore AuthServer
- Players appear with their custom nicknames

## API Examples

### Request Game Session

```bash
curl -X POST https://api.modpackstore.net/v1/yggdrasil/authenticate?profileName=MyNick \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Response:
```json
{
  "accessToken": "a1b2c3d4e5f6...",
  "clientToken": "x1y2z3...",
  "availableProfiles": [
    {
      "id": "550e8400e29b41d4a716446655440000",
      "name": "MyNick"
    }
  ],
  "selectedProfile": {
    "id": "550e8400e29b41d4a716446655440000",
    "name": "MyNick"
  }
}
```

### Validate Token

```bash
curl -X POST https://api.modpackstore.net/v1/yggdrasil/validate \
  -H "Content-Type: application/json" \
  -d '{"accessToken": "a1b2c3d4e5f6..."}'
```

Response: `204 No Content` (valid) or `403 Forbidden` (invalid)

### Get Player Profile

```bash
curl https://api.modpackstore.net/v1/yggdrasil/sessionserver/session/minecraft/profile/550e8400e29b41d4a716446655440000
```

Response:
```json
{
  "id": "550e8400e29b41d4a716446655440000",
  "name": "MyNick",
  "properties": [
    {
      "name": "textures",
      "value": "eyJ0aW1lc3RhbXAiOjE...",
      "signature": null
    }
  ]
}
```

## Future Enhancements

1. **Signature Support**: Add private key signing for property verification
2. **Skin Management**: Allow users to upload custom skins
3. **Cape Support**: Add cape textures
4. **Multi-Profile**: Support multiple profiles per user
5. **UI Integration**: Add nickname editor in instance settings
6. **Session Analytics**: Track session usage and statistics

## Testing

### Backend Tests
```bash
cd backend
npm test  # Test GameSession entity and YggdrasilService
```

### Launcher Tests
```bash
cd application/src-tauri
cargo test  # Test ModpackStoreAuth and AuthlibInjectorManager
```

### Integration Testing
1. Start backend: `cd backend && npm run dev`
2. Build launcher: `cd application && npm run tauri dev`
3. Create instance without account assignment
4. Launch instance and verify:
   - authlib-injector downloads
   - Game session token is requested
   - Minecraft launches with correct nickname
5. Join a server with `online-mode=false`
6. Verify player appears with custom nickname

## Troubleshooting

### "No authentication tokens found"
- User must be logged into ModpackStore
- Check auth token storage in `auth_store.json`

### "Failed to download authlib-injector"
- Check internet connection
- Verify GitHub is accessible
- Check config directory permissions

### "Invalid profile name"
- Nicknames must be 3-16 characters
- Only alphanumeric and underscores allowed
- Check `ms_nickname` in instance.json

### "Invalid or expired access token"
- Game sessions expire after 20 minutes
- Relaunch instance to get new token
- Check server time synchronization

## References

- [authlib-injector GitHub](https://github.com/yushijinhun/authlib-injector)
- [Yggdrasil Protocol](https://wiki.vg/Protocol_Encryption#Authentication)
- [Minecraft Authentication](https://wiki.vg/Authentication)
