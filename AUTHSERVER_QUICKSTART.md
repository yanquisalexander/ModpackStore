# AuthServer Quick Start Guide

## For Backend Developers

### Adding AuthServer to Existing Installation

1. **Database Migration**
   ```bash
   # The GameSession entity will be auto-created by TypeORM
   # No manual migration needed (synchronize: true)
   ```

2. **Routes Already Registered**
   The authserver routes are already added to `/backend/src/routes/index.ts`:
   ```typescript
   rootRouter.route('/', authServerRoutes);
   ```

3. **Test Endpoints**
   ```bash
   # Get metadata
   curl https://your-api.com/v1/authserver

   # Authenticate (requires JWT)
   curl -X POST https://your-api.com/v1/authserver/authenticate \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"username": "CustomNick"}'
   ```

## For Frontend Developers

### Using MS Account in Instance

```typescript
// Check if user can use MS account
const isLoggedIn = await invoke('validate_ms_account_login');
if (!isLoggedIn) {
  // Show login prompt
  return;
}

// Create instance without accountUuid
const instance = {
  instanceId: generateId(),
  instanceName: "My Instance",
  accountUuid: null, // This triggers MS account usage
  ms_nickname: "CustomName", // Optional custom nickname
  minecraftVersion: "1.20.1",
  // ... other fields
};

// Check if authlib-injector is ready
const isReady = await invoke('check_authlib_injector_status');
if (!isReady) {
  // Download it
  await invoke('download_authlib_injector');
}

// Launch normally - authentication happens automatically
await invoke('launch_mc_instance', { instanceId: instance.instanceId });
```

### UI Components

**Instance Settings**:
```tsx
function InstanceSettings({ instance }) {
  const usesMsAccount = instance.accountUuid === null;
  
  return (
    <div>
      {usesMsAccount && (
        <div>
          <label>Custom Nickname</label>
          <input
            value={instance.ms_nickname || ''}
            onChange={(e) => updateInstance({
              ...instance,
              ms_nickname: e.target.value
            })}
            placeholder="Leave empty to use account name"
            maxLength={16}
            pattern="[a-zA-Z0-9_]+"
          />
        </div>
      )}
    </div>
  );
}
```

**Account Selector**:
```tsx
function AccountSelector({ instance, onChange }) {
  const [accounts, setAccounts] = useState([]);
  const [msAccountAvailable, setMsAccountAvailable] = useState(false);

  useEffect(() => {
    invoke('get_all_accounts').then(setAccounts);
    invoke('validate_ms_account_login').then(setMsAccountAvailable);
  }, []);

  return (
    <select 
      value={instance.accountUuid || 'modpackstore'}
      onChange={(e) => onChange({
        ...instance,
        accountUuid: e.target.value === 'modpackstore' ? null : e.target.value
      })}
    >
      {msAccountAvailable && (
        <option value="modpackstore">Modpack Store Account</option>
      )}
      {accounts.map(acc => (
        <option key={acc.uuid} value={acc.uuid}>
          {acc.username} ({acc.user_type})
        </option>
      ))}
    </select>
  );
}
```

## For Server Administrators

### Minecraft Server Configuration

1. **Set Online Mode to False**
   ```properties
   # server.properties
   online-mode=false
   ```

2. **No Additional Configuration Needed**
   The Modpack Store AuthServer handles all validation automatically.

3. **Player Authentication Flow**
   - Player launches game with authlib-injector
   - authlib-injector redirects auth to Modpack Store
   - Player joins your server
   - Your server asks Modpack Store: "Did this player authenticate?"
   - Modpack Store responds with player profile
   - Player is allowed to join

4. **Verify It's Working**
   ```bash
   # Check server logs for:
   [User Authenticator #X/INFO]: UUID of player CustomNick is xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
   ```

## Testing Checklist

### Backend Testing
- [ ] `GET /authserver` returns metadata
- [ ] `POST /authserver/authenticate` with valid JWT creates session
- [ ] `POST /authserver/authenticate` with invalid JWT returns 401
- [ ] `POST /authserver/validate` with valid token returns 204
- [ ] `POST /authserver/validate` with invalid token returns 403
- [ ] `GET /sessionserver/session/minecraft/hasJoined` returns profile
- [ ] Custom nickname validation works (3-16 chars, alphanumeric)
- [ ] Sessions expire after 20 minutes inactivity
- [ ] Sessions expire after 24 hours absolute

### Frontend Testing
- [ ] authlib-injector downloads on first use
- [ ] Instance with `accountUuid: null` triggers MS account
- [ ] Custom nickname is passed to backend
- [ ] Launch includes `-javaagent` in JVM args
- [ ] Launch includes compatibility flags
- [ ] Error handling for missing JWT token
- [ ] Error handling for network failures

### Integration Testing
- [ ] Launch instance with MS account
- [ ] Join Minecraft server
- [ ] Custom nickname appears in-game
- [ ] Multiple instances with different nicknames
- [ ] Session persists across launches (within timeout)
- [ ] Session expires and new one is created

## Common Issues

### Issue: authlib-injector Not Found
**Solution**: Call `download_authlib_injector()` before first launch

### Issue: Authentication Failed
**Solution**: Check user is logged in to Modpack Store (`validate_ms_account_login()`)

### Issue: Custom Nickname Not Working
**Causes**:
- Nickname doesn't meet validation (3-16 chars, alphanumeric + _)
- Not set in instance config
- Backend error (check logs)

### Issue: Session Expired
**Solution**: Re-launch to create new session (automatic)

### Issue: Server Says "Failed to Verify Username"
**Causes**:
- Server has `online-mode=true` (must be false)
- AuthServer unreachable from server
- Token expired (re-launch)

## Environment Variables

### Backend (.env)
```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=modpackstore
DB_PASSWORD=your_password
DB_NAME=modpackstore

# JWT
JWT_SECRET=your_secret_key

# Environment
NODE_ENV=production
```

### Frontend (Build Time)
```bash
# API Endpoint (production only, dev uses localhost:3000)
VITE_API_ENDPOINT=https://api.modpackstore.com/v1
```

## API Examples

### Create Session
```bash
curl -X POST https://api.modpackstore.com/v1/authserver/authenticate \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "CustomNick"
  }'
```

Response:
```json
{
  "accessToken": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "clientToken": "x1y2z3a4-b5c6-d7e8-f9g0-h1234567890i",
  "availableProfiles": [{
    "id": "user-uuid-without-dashes",
    "name": "CustomNick"
  }],
  "selectedProfile": {
    "id": "user-uuid-without-dashes",
    "name": "CustomNick"
  }
}
```

### Validate Session
```bash
curl -X POST https://api.modpackstore.com/v1/authserver/validate \
  -H "Content-Type: application/json" \
  -d '{
    "accessToken": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "clientToken": "x1y2z3a4-b5c6-d7e8-f9g0-h1234567890i"
  }'
```

Response: 204 No Content (valid) or 403 Forbidden (invalid)

### Verify Player Join (Called by MC Server)
```bash
curl "https://api.modpackstore.com/v1/sessionserver/session/minecraft/hasJoined?username=CustomNick&serverId=abc123"
```

Response:
```json
{
  "id": "user-uuid-without-dashes",
  "name": "CustomNick",
  "properties": []
}
```

## Architecture Overview

```
┌─────────────────┐
│  Tauri Launcher │
│   (Rust/TS)     │
└────────┬────────┘
         │
         │ 1. Get JWT from storage
         │ 2. Call /authserver/authenticate
         │
         ▼
┌─────────────────┐
│  Backend API    │
│  (Node/TypeORM) │
└────────┬────────┘
         │
         │ 3. Validate JWT
         │ 4. Create GameSession
         │ 5. Return game token
         │
         ▼
┌─────────────────┐
│  Launcher       │
│  Downloads      │
│  authlib-inject │
└────────┬────────┘
         │
         │ 6. Inject JVM args
         │ 7. Launch Minecraft
         │
         ▼
┌─────────────────┐
│   Minecraft     │
│   with authlib  │
└────────┬────────┘
         │
         │ 8. Intercept auth
         │ 9. Redirect to AuthServer
         │
         ▼
┌─────────────────┐
│  MC Server      │
│  Validates via  │
│  hasJoined      │
└─────────────────┘
```

## Next Steps

1. **Test Backend**: Deploy and test endpoints
2. **Test Frontend**: Build and test launcher
3. **Set Up Server**: Configure test MC server
4. **End-to-End Test**: Full authentication flow
5. **UI Enhancement**: Add nickname configuration UI
6. **Documentation**: Update user-facing docs
7. **Release**: Deploy to production

## Support

For issues or questions:
- Check `AUTHSERVER_IMPLEMENTATION.md` for details
- Review logs: `~/.config/ModpackStore/logs/`
- Backend logs: Check your logging system
- GitHub Issues: Open an issue with logs

## Credits

Implementation based on:
- Yggdrasil protocol by Mojang/Microsoft
- authlib-injector by yushijinhun
- Modpack Store platform
