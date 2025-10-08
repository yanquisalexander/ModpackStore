# AuthServer Quick Start Guide

A quick reference for getting the AuthServer up and running.

## TL;DR

ModpackStore now has its own authentication server that lets players use their platform accounts in Minecraft. No Account Manager changes needed - it's transparent!

## Setup (5 minutes)

### Backend

1. **Add environment variables** to `.env`:
```env
AUTH_SERVER_NAME=ModpackStore AuthServer
AUTH_SERVER_URL=https://api.modpackstore.com  # Or your domain
```

2. **Start the server**:
```bash
cd backend
npm install
npm run dev
```

3. **Verify it works**:
```bash
curl http://localhost:3000/v1/authserver
# Should return metadata JSON
```

That's it! TypeORM will auto-create the `game_sessions` table.

### Launcher (Rust)

The launcher code is already integrated. Just rebuild:

```bash
cd application/src-tauri
cargo build
```

## How Users Use It

### Create Instance with ModpackStore Account

1. User creates/edits an instance
2. **Don't select any account** (leave accountUuid empty)
3. Optional: Set a custom nickname in instance settings
4. Launch the instance
5. Launcher automatically:
   - Detects no account selected
   - Uses ModpackStore account
   - Downloads authlib-injector
   - Launches with custom auth

### Example Instance Config

**Using ModpackStore account with nickname:**
```json
{
  "instanceId": "abc123",
  "instanceName": "My Modpack",
  "accountUuid": null,
  "ms_nickname": "Builder",
  "minecraftVersion": "1.20.1"
}
```

**Using Microsoft account:**
```json
{
  "instanceId": "def456",
  "instanceName": "Vanilla",
  "accountUuid": "microsoft-account-uuid",
  "minecraftVersion": "1.20.1"
}
```

## Quick Test

### 1. Test Backend

```bash
# Get your JWT token (from browser DevTools or API)
JWT_TOKEN="your-token-here"

# Create a game session
curl -X POST "http://localhost:3000/v1/authserver/gamesession" \
  -H "Content-Type: application/json" \
  -d "{\"token\": \"$JWT_TOKEN\", \"nickname\": \"TestPlayer\"}"

# Should return:
# {
#   "data": {
#     "accessToken": "...",
#     "clientToken": "...",
#     "username": "TestPlayer",
#     "uuid": "..."
#   }
# }
```

### 2. Test Database

```sql
SELECT * FROM game_sessions WHERE is_active = true;
```

## Common Scenarios

### Scenario 1: Player wants different names per instance

```
Instance "Survival" → ms_nickname = "Survivor"
Instance "Creative" → ms_nickname = "Builder"
Instance "Skyblock" → ms_nickname = null (uses platform username)
```

### Scenario 2: Mixing account types

```
Instance "Microsoft Account" → accountUuid = "ms-uuid"
Instance "ModpackStore"      → accountUuid = null
Instance "Offline"           → accountUuid = "offline-uuid"
```

### Scenario 3: Server with online-mode=false

1. Player launches instance with ModpackStore account
2. Connects to server with `online-mode=false`
3. Server validates with AuthServer
4. Player joins with their ModpackStore identity

## Architecture Overview

```
┌─────────────────┐
│  Minecraft      │
│  Instance       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌──────────────────┐
│  Launcher       │─────▶│  AuthServer      │
│  (Rust)         │      │  Backend         │
└─────────────────┘      │  (Node.js)       │
         │               └─────────┬────────┘
         │                         │
         ▼                         ▼
┌─────────────────┐      ┌──────────────────┐
│  authlib-       │      │  PostgreSQL      │
│  injector       │      │  (game_sessions) │
└─────────────────┘      └──────────────────┘
         │
         ▼
┌─────────────────┐
│  Minecraft      │
│  Client         │
└─────────────────┘
```

## Key Files

### Backend
- `backend/src/entities/GameSession.ts` - Session storage
- `backend/src/services/authserver.service.ts` - Business logic
- `backend/src/controllers/AuthServer.controller.ts` - HTTP handlers
- `backend/src/routes/v1/authserver.routes.ts` - Route definitions

### Rust
- `application/src-tauri/src/core/authserver_client.rs` - Backend API
- `application/src-tauri/src/core/authlib_injector.rs` - JAR management
- `application/src-tauri/src/core/minecraft/launcher.rs` - Integration
- `application/src-tauri/src/core/minecraft_instance.rs` - Instance data

## API Cheat Sheet

### For Launcher (Rust)

```rust
// Get game session
let session = AuthServerClient::get_game_session(
    &jwt_token, 
    Some("Nickname".to_string())
).await?;

// Get authserver URL
let url = AuthServerClient::get_authserver_url()?;

// Get authlib-injector argument
let arg = AuthlibInjector::get_jvm_argument(&url).await?;
// Returns: "-javaagent:/path/to/authlib-injector.jar=https://..."

// Get compatibility flags
let flags = AuthlibInjector::get_compatibility_flags();
// Returns: ["-Dauthlibinjector.mojangNamespace=enabled", ...]
```

### For Direct API Calls

```bash
# Create session
POST /v1/authserver/gamesession
Body: { "token": "JWT", "nickname": "Name" }

# Yggdrasil authenticate
POST /v1/authserver/authenticate
Body: { "token": "JWT", "clientToken": "optional" }

# Validate session
POST /v1/authserver/validate
Body: { "accessToken": "token", "clientToken": "token" }
Response: 204 No Content

# Refresh session
POST /v1/authserver/refresh
Body: { "accessToken": "token", "clientToken": "token" }

# Invalidate session
POST /v1/authserver/invalidate
Body: { "accessToken": "token", "clientToken": "token" }
Response: 204 No Content
```

## Troubleshooting

### Issue: "No access token available"
**Solution:** User needs to log in to ModpackStore

### Issue: "Failed to download authlib-injector"
**Solution:** Check internet connection, verify GitHub access

### Issue: Session expires immediately
**Solution:** Check backend logs, verify token validation

### Issue: Minecraft doesn't start
**Solution:** 
- Check Java version compatibility
- Verify authlib-injector downloaded
- Check launcher logs for JVM errors

## Session Lifecycle

```
1. User launches instance (no account)
   ↓
2. Launcher calls /gamesession
   - Creates session if none exists
   - Returns existing if < 20 min old
   ↓
3. Session is active
   - last_activity_at updated
   ↓
4. Player plays (< 20 min between actions)
   - Session stays active
   ↓
5. After 20 min of inactivity
   - Session marked as expired
   - Next validation fails
   - Launcher creates new session
```

## Database Maintenance

### Clean up expired sessions (optional)

```sql
-- Mark expired sessions as inactive
UPDATE game_sessions 
SET is_active = false 
WHERE last_activity_at < NOW() - INTERVAL '20 minutes' 
  AND is_active = true;

-- Or use the built-in method (in future cleanup job)
SELECT game_sessions.cleanup_expired();
```

### View active sessions

```sql
SELECT 
    u.username,
    gs.created_at,
    gs.last_activity_at,
    NOW() - gs.last_activity_at as inactive_for
FROM game_sessions gs
JOIN users u ON gs.user_id = u.id
WHERE gs.is_active = true
ORDER BY gs.last_activity_at DESC;
```

## Next Steps

1. ✅ **Test basic flow** - Create session, validate it
2. ✅ **Test with nickname** - Verify custom names work
3. ✅ **Test expiration** - Wait 20 min, verify session invalid
4. ⬜ **Test in Minecraft** - Launch actual game client
5. ⬜ **Test with server** - Connect to online-mode=false server
6. ⬜ **Deploy to production** - Set HTTPS, update ENV vars
7. ⬜ **Monitor usage** - Track session creation/cleanup

## Production Checklist

- [ ] Set `AUTH_SERVER_URL` to production domain
- [ ] Ensure HTTPS for all AuthServer endpoints
- [ ] Configure CORS for frontend domain
- [ ] Set up database backups
- [ ] Add monitoring for session table
- [ ] Consider cleanup job for expired sessions
- [ ] Test with real Minecraft versions (1.7-1.20.x)
- [ ] Document for users in help center

## Resources

- **Full Documentation:** `AUTHSERVER_IMPLEMENTATION.md`
- **Testing Guide:** `AUTHSERVER_TESTING.md`
- **Yggdrasil Spec:** https://wiki.vg/Protocol_Encryption
- **authlib-injector:** https://github.com/yushijinhun/authlib-injector

## Support

If something doesn't work:

1. Check backend logs: `npm run dev` output
2. Check launcher logs: Tauri console
3. Check database: Active sessions query
4. Test endpoints: Use curl commands
5. Verify environment variables set correctly

---

**That's it!** You now have a working AuthServer for ModpackStore accounts. 🎉
