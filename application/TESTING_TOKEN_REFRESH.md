# Testing Token Refresh Implementation

This guide provides instructions for testing the automatic token refresh functionality.

## Prerequisites

- Application installed and configured
- Valid Discord account for authentication
- Access to browser developer tools (optional)

## Test Scenarios

### 1. Proactive Refresh Test (Modified Timer)

For faster testing, you can temporarily modify the refresh buffer:

**File:** `application/src/stores/AuthContext.tsx`

```typescript
// Change this line (temporarily for testing):
const REFRESH_BUFFER_MS = 5 * 60 * 1000; // 5 minutes

// To this:
const REFRESH_BUFFER_MS = 60 * 1000; // 1 minute
```

**Steps:**
1. Build and run the application
2. Log in with Discord
3. Check browser console for: `[AuthContext] Scheduling token refresh in 239 minutes`
4. Wait 1 minute (with modified buffer) or 3h 55m (original)
5. Observe console log: `[AuthContext] Token refresh timer triggered`
6. Verify: `[AuthContext] Tokens refreshed successfully`
7. Confirm no disruption to UI/functionality

**Expected Result:**
- Token refreshes automatically
- User experience uninterrupted
- No visible changes to the user
- New timer scheduled

---

### 2. Session Expiration Test

**Steps:**
1. Log in to the application
2. Using developer tools, manually clear the refresh token:
   ```javascript
   // Open browser console
   const store = await import('@tauri-apps/plugin-store');
   const s = await store.load('auth_store.json');
   await s.delete('auth_tokens');
   await s.save();
   ```
3. Wait for the next automatic refresh attempt or trigger manually
4. Verify SessionExpiredDialog appears
5. Click "Iniciar Sesión" button
6. Confirm redirect to login screen

**Expected Result:**
- Dialog displays with warning icon
- Clear message: "Tu sesión ha expirado por seguridad"
- Button triggers login flow
- User can re-authenticate successfully

---

### 3. API Request 401 Retry Test

This test requires using the `fetchWithAuth` helper in a service.

**Steps:**
1. Modify a service to use `fetchWithAuth`:
   ```typescript
   import { fetchJson } from '@/lib/fetchWithAuth';
   
   export async function getUser(token: string) {
     return await fetchJson('/auth/me', {
       headers: { 'Authorization': `Bearer ${token}` }
     });
   }
   ```
2. Make an API request with an expired token
3. Check console for:
   - `[fetchWithAuth] Received 401, attempting token refresh...`
   - `[fetchWithAuth] Tokens refreshed, retrying request...`
   - `[fetchWithAuth] Retry completed with status: 200`
4. Verify the request succeeds

**Expected Result:**
- Initial 401 detected
- Automatic token refresh triggered
- Request retried with new token
- Request succeeds transparently

---

### 4. Long Session Test (Production)

**Steps:**
1. Log in to the application
2. Use the app normally for several hours
3. Make periodic API requests (browse modpacks, etc.)
4. Monitor console for refresh events
5. Verify session remains active beyond 4 hours

**Expected Result:**
- Session remains active indefinitely (up to 30 days)
- Multiple automatic refreshes occur
- No user intervention required
- Seamless experience

---

### 5. Offline Refresh Test

**Steps:**
1. Log in to the application
2. Disconnect from internet
3. Wait for token to expire
4. Reconnect to internet
5. Make an API request

**Expected Result:**
- Refresh fails while offline
- After reconnecting, automatic retry may occur
- If refresh token expired during offline period, show SessionExpiredDialog

---

## Debugging Tips

### Enable Verbose Logging

Check browser console for these log patterns:

```
[AuthContext] Scheduling token refresh in X minutes
[AuthContext] Token refresh timer triggered
[AuthContext] Refreshing tokens...
[AuthContext] Tokens refreshed successfully
```

### Verify Token Storage

```javascript
// In browser console
const { load } = await import('@tauri-apps/plugin-store');
const store = await load('auth_store.json');
const tokens = await store.get('auth_tokens');
console.log('Stored tokens:', tokens);
```

### Check Token Expiration

```javascript
import { jwtDecode } from 'jwt-decode';

const token = 'your_access_token_here';
const decoded = jwtDecode(token);
console.log('Token expires at:', new Date(decoded.exp * 1000));
console.log('Time until expiry:', (decoded.exp * 1000 - Date.now()) / 1000 / 60, 'minutes');
```

---

## Common Issues

### Issue: Tokens not refreshing
**Solution:** Check that `refresh_tokens` Tauri command is accessible and backend is running

### Issue: SessionExpiredDialog appears immediately
**Solution:** Refresh token may be invalid. Clear storage and re-login

### Issue: Multiple refresh attempts
**Solution:** Check `isRefreshingRef` is working correctly to prevent concurrent refreshes

### Issue: Timer not scheduling
**Solution:** Verify token expiration calculation is correct

---

## Automated Testing (Future)

Once test infrastructure is in place, consider:

```typescript
// Example test
describe('Token Refresh', () => {
  beforeEach(() => {
    // Setup mock tokens
  });
  
  it('should schedule refresh timer on login', async () => {
    // Verify timer is set
  });
  
  it('should refresh tokens before expiry', async () => {
    // Fast-forward time
    // Verify refresh called
  });
  
  it('should show dialog on refresh failure', async () => {
    // Mock refresh failure
    // Verify dialog appears
  });
});
```

---

## Rollback Procedure

If issues arise, revert these commits:

```bash
git revert <commit-hash>
git push
```

Or temporarily disable auto-refresh by commenting out the timer:

```typescript
// In AuthContext.tsx
// Comment this line:
// scheduleTokenRefresh(tokensWithExpiry);
```

---

## Success Metrics

- ✅ No forced logouts during normal usage
- ✅ Zero user complaints about session expiration
- ✅ Refresh success rate > 99%
- ✅ Average session duration increases
- ✅ Reduced support tickets for "session expired"
