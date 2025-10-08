# AuthServer Implementation for ModpackStore

This document describes the implementation of a custom AuthServer compatible with authlib-injector for ModpackStore accounts.

## Overview

The AuthServer enables players to use their ModpackStore accounts to authenticate with Minecraft servers, even when running in offline mode (`online-mode=false`). This is achieved through the Yggdrasil authentication protocol, compatible with `authlib-injector`.

## Architecture

### Backend Components

#### 1. GameSession Entity (`backend/src/entities/GameSession.ts`)
- Manages temporary game session tokens
- Tokens expire after 20 minutes of inactivity
- Tracks session metadata (IP, user agent, etc.)
- Automatically invalidates on expiry

**Database Schema:**
```sql
CREATE TABLE game_sessions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    access_token TEXT UNIQUE NOT NULL,
    client_token TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 2. AuthServer Service (`backend/src/services/authserver.service.ts`)
Implements the Yggdrasil protocol:

- **`authenticate(jwtToken, clientToken?)`** - Create game session from ModpackStore JWT
- **`refresh(accessToken, clientToken)`** - Refresh game session token
- **`validate(accessToken, clientToken?)`** - Validate game session
- **`invalidate(accessToken, clientToken)`** - Logout from game session
- **`signout(jwtToken)`** - Logout all sessions for a user
- **`getMetadata()`** - Return authlib-injector metadata
- **`getOrCreateGameSession(jwtToken, nickname?)`** - Convenience method for launcher

#### 3. AuthServer Endpoints (`backend/src/routes/v1/authserver.routes.ts`)

Standard Yggdrasil endpoints:
- `GET /v1/authserver` - Metadata for authlib-injector
- `POST /v1/authserver/authenticate` - Create session
- `POST /v1/authserver/refresh` - Refresh session
- `POST /v1/authserver/validate` - Validate session (returns 204)
- `POST /v1/authserver/invalidate` - Invalidate session (returns 204)
- `POST /v1/authserver/signout` - Sign out all sessions (returns 204)

Custom endpoint:
- `POST /v1/authserver/gamesession` - Get/create session for launcher

### Frontend (Rust) Components

#### 1. Instance Nickname Support
**File:** `application/src-tauri/src/core/minecraft_instance.rs`

Added `ms_nickname` field to `MinecraftInstance`:
```rust
pub struct MinecraftInstance {
    // ... other fields ...
    #[serde(default)]
    pub ms_nickname: Option<String>, // Custom nickname for ModpackStore account
}
```

This allows users to set different nicknames per instance when using ModpackStore accounts.

#### 2. AuthServer Client (`application/src-tauri/src/core/authserver_client.rs`)
Handles communication with the backend AuthServer:

- `get_game_session(jwt_token, nickname?)` - Get or create game session
- `get_authserver_url()` - Get the authserver URL for authlib-injector

#### 3. Authlib-Injector Manager (`application/src-tauri/src/core/authlib_injector.rs`)
Manages authlib-injector JAR file:

- `ensure_downloaded()` - Downloads authlib-injector v1.2.5 if not present
- `get_jvm_argument(authserver_url)` - Returns `-javaagent:...` argument
- `get_compatibility_flags()` - Returns compatibility flags for Minecraft 1.7-1.20.x

**Compatibility Flags:**
```
-Dauthlibinjector.mojangNamespace=enabled
-Dauthlibinjector.legacySkinPolyfill=enabled
-Dauthlibinjector.profileKey=disabled
-Dauthlibinjector.usernameCheck=disabled
```

#### 4. Minecraft Launcher Integration
**File:** `application/src-tauri/src/core/minecraft/launcher.rs`

The launcher now detects when to use ModpackStore account:

**Logic:**
1. If `instance.accountUuid` is `None` → Use ModpackStore account
2. If `instance.accountUuid` is set → Use that account (Microsoft/Offline)

**For ModpackStore accounts:**
1. Get JWT token from auth store
2. Call backend to get/create game session (with optional nickname)
3. Download authlib-injector if needed
4. Add `-javaagent` and compatibility flags to JVM arguments
5. Launch Minecraft with ModpackStore authentication

## Usage Guide

### For Users

#### Using ModpackStore Account in Instances

1. **Create an instance** without selecting an account (leave accountUuid empty)
2. **Set custom nickname** (optional):
   - Edit instance settings
   - Set `ms_nickname` to your desired in-game name
   - If not set, your ModpackStore username will be used

3. **Launch the instance**:
   - Launcher automatically detects no account is selected
   - Uses your ModpackStore account
   - Downloads authlib-injector if needed
   - Launches with your nickname

#### Switching Between Account Types

You can mix account types across instances:
- Instance A: Use ModpackStore account (no accountUuid)
- Instance B: Use Microsoft account (accountUuid set)
- Instance C: Use Offline account (accountUuid set)
- Instance D: Use ModpackStore with nickname "Builder" (no accountUuid, ms_nickname="Builder")

### For Developers

#### Backend Setup

1. **Environment Variables:**
```env
AUTH_SERVER_NAME=ModpackStore AuthServer
AUTH_SERVER_URL=https://api.modpackstore.com
JWT_SECRET=your-secret-key
```

2. **Database Migration:**
The `GameSession` entity will be automatically created by TypeORM when the server starts (synchronize: true).

#### Frontend Integration

**Get game session for instance:**
```rust
use crate::core::authserver_client::AuthServerClient;

let jwt_token = get_jwt_token()?;
let nickname = instance.ms_nickname.clone();

let session = AuthServerClient::get_game_session(&jwt_token, nickname).await?;
// session contains: access_token, client_token, username, uuid
```

**Add authlib-injector to JVM arguments:**
```rust
use crate::core::authlib_injector::AuthlibInjector;

let authserver_url = AuthServerClient::get_authserver_url()?;
let authlib_arg = AuthlibInjector::get_jvm_argument(&authserver_url).await?;
// authlib_arg = "-javaagent:/path/to/authlib-injector.jar=https://..."

jvm_args.insert(0, authlib_arg);

// Add compatibility flags
let compat_flags = AuthlibInjector::get_compatibility_flags();
for flag in compat_flags {
    jvm_args.push(flag);
}
```

## API Reference

### POST /v1/authserver/authenticate

**Request:**
```json
{
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "clientToken": "optional-client-token",
    "agent": {
        "name": "Minecraft",
        "version": 1
    }
}
```

**Response:**
```json
{
    "accessToken": "d5e00b62-8d7b-4e6a-9f7c-1a2b3c4d5e6f",
    "clientToken": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "availableProfiles": [
        {
            "id": "a1b2c3d4e5f67890abcdef1234567890",
            "name": "PlayerName"
        }
    ],
    "selectedProfile": {
        "id": "a1b2c3d4e5f67890abcdef1234567890",
        "name": "PlayerName"
    }
}
```

### POST /v1/authserver/gamesession (Custom)

**Request:**
```json
{
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "nickname": "CustomNickname"
}
```

**Response:**
```json
{
    "data": {
        "accessToken": "d5e00b62-8d7b-4e6a-9f7c-1a2b3c4d5e6f",
        "clientToken": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "username": "CustomNickname",
        "uuid": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
    }
}
```

## Security Considerations

1. **Token Expiration:** Game sessions expire after 20 minutes of inactivity
2. **JWT Validation:** All requests validate the ModpackStore JWT token
3. **Client Token Validation:** Refresh/invalidate operations require matching client tokens
4. **Session Isolation:** Each user can only access their own sessions
5. **HTTPS Required:** AuthServer should only be accessed over HTTPS in production

## Compatibility

### Supported Minecraft Versions
- **Recommended:** Minecraft Java Edition 1.7 - 1.20.x
- **Not Supported:** Minecraft Bedrock Edition
- **Not Tested:** Versions < 1.7 or future releases

### Java Requirements
- **For authlib-injector compilation:** JDK 17+
- **For Minecraft execution:** JRE 8+ (depends on Minecraft version)

### authlib-injector Version
- **Current:** v1.2.5
- **Source:** https://github.com/yushijinhun/authlib-injector
- **License:** AGPL-3.0

## Troubleshooting

### "Invalid credentials" error
- Check that user is logged into ModpackStore
- Verify JWT token is not expired
- Check backend logs for authentication errors

### "Failed to download authlib-injector"
- Check internet connection
- Verify GitHub is accessible
- Check `libraries/authlib-injector/` directory permissions

### Minecraft fails to launch with ModpackStore account
- Check Java version compatibility
- Verify authlib-injector was downloaded
- Check launcher logs for JVM argument errors
- Try with compatibility flags disabled

### Session expires too quickly
- Sessions expire after 20 minutes of inactivity
- Activity is updated on validate/refresh calls
- Consider implementing auto-refresh in launcher

## Future Enhancements

1. **Skin/Cape Support:** Add custom skin server integration
2. **Message Signing:** Implement profile key signing for 1.19+
3. **Multi-Device Sessions:** Allow multiple concurrent sessions
4. **Session Management UI:** Frontend to view/revoke active sessions
5. **Analytics:** Track session usage and authentication metrics

## References

- [Yggdrasil Protocol Specification](https://wiki.vg/Protocol_Encryption#Authentication)
- [authlib-injector Documentation](https://github.com/yushijinhun/authlib-injector)
- [Minecraft Authentication](https://wiki.vg/Authentication)
