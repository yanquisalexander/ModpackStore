# AuthServer Quick Start Guide

This guide helps you quickly get started with the ModpackStore AuthServer implementation.

## For Users

### Playing with ModpackStore Account

1. **Login to ModpackStore**
   - Open the launcher
   - Click "Login" and authenticate with Discord
   - You're now ready to use ModpackStore accounts

2. **Launch Instance without Account**
   - Create or select a modpack instance
   - Don't assign any Microsoft or Offline account
   - Leave `accountUuid` as `null` in instance settings
   - Launch the instance
   - The launcher will automatically:
     - Request a game session from ModpackStore
     - Download authlib-injector if needed
     - Launch Minecraft with your ModpackStore credentials

3. **Custom Nickname (Optional)**
   - Edit instance settings
   - Set `ms_nickname` field (3-16 chars, alphanumeric + underscore)
   - Your in-game name will be this custom nickname
   - Different instances can have different nicknames

4. **Join Minecraft Servers**
   - Server must have `online-mode=false`
   - Your ModpackStore account will be validated
   - You'll appear with your username or custom nickname

## For Server Owners

### Setting Up Your Server

1. **Configure server.properties**
   ```properties
   online-mode=false
   ```

2. **No Additional Setup Required**
   - Players using ModpackStore accounts will be validated automatically
   - The authlib-injector client handles authentication
   - Player UUIDs are consistent across sessions

3. **Player Identification**
   - Players appear with their ModpackStore username or custom nickname
   - UUIDs are based on ModpackStore user ID
   - Skins are loaded from user's avatar (if set)

## For Developers

### Testing the Implementation

#### Backend Setup
```bash
cd backend
npm install
npm run dev
```

#### Test Endpoints
```bash
# Get authlib-injector metadata
curl http://localhost:3000/v1/yggdrasil/

# Authenticate (requires JWT)
curl -X POST http://localhost:3000/v1/yggdrasil/authenticate?profileName=TestPlayer \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'

# Validate token
curl -X POST http://localhost:3000/v1/yggdrasil/validate \
  -H "Content-Type: application/json" \
  -d '{"accessToken": "YOUR_ACCESS_TOKEN"}'
```

#### Launcher Testing
```bash
cd application
npm run tauri dev
```

Test flow:
1. Login to ModpackStore
2. Create instance without account
3. Set `ms_nickname` (optional)
4. Launch instance
5. Verify logs show:
   - "Using ModpackStore account"
   - "authlib-injector downloaded"
   - Correct JVM arguments with `-javaagent`

### Database Migration

Run the migration to create the `game_sessions` table:

```bash
# Using TypeORM with synchronize (development)
# Table will be created automatically

# For production, run the SQL manually:
psql -U postgres -d modpackstore < backend/migrations/001_add_game_sessions_table.sql
```

### Monitoring

#### Check Active Sessions
```sql
SELECT 
    gs.profile_name,
    u.username,
    gs.created_at,
    gs.expires_at,
    gs.last_activity_at
FROM game_sessions gs
JOIN users u ON u.id = gs.user_id
WHERE gs.expires_at > NOW()
ORDER BY gs.created_at DESC;
```

#### Cleanup Expired Sessions
```sql
SELECT cleanup_expired_game_sessions();
```

## Configuration

### Environment Variables

#### Backend (.env)
```env
# Required
API_URL=https://api.modpackstore.net
JWT_SECRET=your-secret-key

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=password
DB_NAME=modpackstore
```

#### Launcher
No additional configuration needed. Uses existing `API_ENDPOINT` environment variable.

### authlib-injector Configuration

The launcher automatically manages authlib-injector with these defaults:
- Version: 1.2.5
- Download URL: GitHub releases
- Install location: `~/.config/dev.alexitoo.modpackstore/authlib-injector/`
- JVM argument: `-javaagent:/path/to/authlib-injector.jar=https://api.modpackstore.net/v1/yggdrasil`

## Troubleshooting

### Common Issues

#### 1. "No authentication tokens found"
**Solution**: Login to ModpackStore first
```bash
# Check if logged in
ls ~/.config/dev.alexitoo.modpackstore/auth_store.json
```

#### 2. "Failed to download authlib-injector"
**Solution**: Check internet connection and GitHub accessibility
```bash
# Test connectivity
curl -I https://github.com/yushijinhun/authlib-injector/releases/download/v1.2.5/authlib-injector-1.2.5.jar
```

#### 3. "Invalid profile name"
**Solution**: Ensure nickname follows Minecraft rules
- 3-16 characters
- Only alphanumeric and underscores
- No spaces or special characters

#### 4. "Session expired"
**Solution**: Relaunch the instance
- Game sessions last 20 minutes
- New session created on each launch

### Debug Logs

Enable detailed logging:

#### Backend
```typescript
// In backend/src/index.ts
logging: true  // Enable TypeORM logging
```

#### Launcher
```rust
// Logs automatically written to application logs
// Check: ~/.local/share/dev.alexitoo.modpackstore/logs/
```

## API Reference

See [AUTHSERVER_IMPLEMENTATION.md](./AUTHSERVER_IMPLEMENTATION.md) for detailed API documentation.

### Quick Reference

| Endpoint | Method | Auth Required | Description |
|----------|--------|---------------|-------------|
| `/v1/yggdrasil/` | GET | No | Get metadata |
| `/v1/yggdrasil/authenticate` | POST | Yes (JWT) | Create session |
| `/v1/yggdrasil/refresh` | POST | No | Refresh token |
| `/v1/yggdrasil/validate` | POST | No | Validate token |
| `/v1/yggdrasil/invalidate` | POST | No | Logout |
| `/v1/yggdrasil/sessionserver/session/minecraft/profile/:uuid` | GET | No | Get profile |

## Support

For issues or questions:
1. Check [AUTHSERVER_IMPLEMENTATION.md](./AUTHSERVER_IMPLEMENTATION.md)
2. Review server/launcher logs
3. Test with sample instance
4. Open GitHub issue with:
   - Launcher logs
   - Backend logs (if running locally)
   - Steps to reproduce

## Next Steps

1. **UI Integration** - Add nickname editor in instance settings
2. **Skin Management** - Allow custom skin uploads
3. **Session Analytics** - Track usage statistics
4. **Advanced Features** - Capes, signatures, multi-profile support

See the full implementation documentation for details on these enhancements.
