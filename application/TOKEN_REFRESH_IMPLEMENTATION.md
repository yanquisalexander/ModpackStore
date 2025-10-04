# Automatic Token Refresh Implementation

## Overview

This implementation adds automatic token refresh functionality to the ModpackStore application, ensuring users maintain active sessions without manual intervention as long as their refresh token is valid.

## Architecture

### Frontend Components

1. **AuthContext.tsx** - Core authentication state management
   - Decodes JWT tokens to extract expiration time
   - Schedules automatic refresh 5 minutes before token expiration
   - Manages refresh timer lifecycle
   - Handles refresh failures gracefully

2. **SessionExpiredDialog.tsx** - User notification component
   - Displays when refresh token expires or is invalid
   - Prompts user to re-authenticate
   - Consistent with existing dialog patterns (e.g., Changelog)

3. **fetchWithAuth.ts** - Optional API request helper (NEW)
   - Automatically retries failed requests after token refresh
   - Provides type-safe API request handling
   - Can be gradually adopted in existing services

### Backend Components

- **auth.service.ts** - Token generation and validation
  - Access token: 4 hours expiration
  - Refresh token: 30 days expiration
  - Endpoint: `POST /auth/refresh`

- **auth.rs** (Rust/Tauri) - Native backend integration
  - `refresh_tokens` command already implemented
  - Handles token storage and retrieval

## User Experience Flow

### Normal Operation (Proactive Refresh)

```
User logs in
    ↓
Access token valid for 4 hours
    ↓
Timer scheduled for 3h 55m (5 min before expiry)
    ↓
Timer triggers → Call refresh_tokens
    ↓
New tokens obtained and stored
    ↓
New timer scheduled → Cycle continues
```

### Token Expiration During Runtime

```
User makes API request
    ↓
Token expired (401 response)
    ↓
fetchWithAuth detects 401
    ↓
Attempts token refresh
    ↓
If successful: Retry request with new token
If failed: Show SessionExpiredDialog
```

### Refresh Token Expiration

```
Refresh token expires (after 30 days)
    ↓
Refresh attempt fails
    ↓
SessionExpiredDialog shown
    ↓
User must re-authenticate
```

## Implementation Details

### Token Expiration Calculation

```typescript
// Extract expiration from JWT
const decoded = jwtDecode<{ exp?: number }>(token);
const expiresAt = decoded.exp * 1000; // Convert to milliseconds

// Schedule refresh 5 minutes before expiration
const REFRESH_BUFFER_MS = 5 * 60 * 1000;
const refreshIn = expiresAt - Date.now() - REFRESH_BUFFER_MS;

setTimeout(() => refreshTokens(), refreshIn);
```

### Preventing Concurrent Refreshes

```typescript
const isRefreshingRef = useRef<boolean>(false);

const refreshTokens = async () => {
  if (isRefreshingRef.current) return;
  
  try {
    isRefreshingRef.current = true;
    await invoke<boolean>('refresh_tokens');
  } finally {
    isRefreshingRef.current = false;
  }
};
```

## Security Considerations

1. **Token Storage**: Tokens stored in Tauri's secure plugin-store
2. **HTTPS Only**: Production API requires HTTPS
3. **JWT Validation**: Backend validates all tokens on each request
4. **Session Binding**: Refresh tokens are tied to specific sessions
5. **Automatic Cleanup**: Expired/invalid tokens automatically removed

## Testing Strategy

### Manual Testing

1. **Proactive Refresh Test**
   - Log in to the application
   - Wait ~3h 55min (or modify timer for faster testing)
   - Verify token refreshes automatically
   - Confirm no disruption to user experience

2. **401 Retry Test**
   - Make API request with expired token
   - Verify automatic refresh and retry
   - Confirm request succeeds after refresh

3. **Expired Refresh Token Test**
   - Invalidate refresh token (or wait 30 days)
   - Verify SessionExpiredDialog appears
   - Confirm user can re-authenticate

### Automated Testing (Future)

```typescript
describe('Token Refresh', () => {
  it('should schedule refresh before token expiry', () => {
    // Test timer scheduling logic
  });
  
  it('should handle 401 with auto-retry', () => {
    // Test fetchWithAuth behavior
  });
  
  it('should show dialog on refresh failure', () => {
    // Test SessionExpiredDialog trigger
  });
});
```

## Migration Path

### Existing Services (Optional)

Services can optionally adopt `fetchWithAuth` for improved UX:

**Before:**
```typescript
const response = await fetch(`${API_ENDPOINT}/endpoint`, {
  headers: { 'Authorization': `Bearer ${token}` }
});
```

**After:**
```typescript
import { fetchJson } from '@/lib/fetchWithAuth';

const data = await fetchJson<ResponseType>('/endpoint', {
  headers: { 'Authorization': `Bearer ${token}` }
});
```

The proactive refresh in AuthContext works independently, so migration is optional.

## Monitoring and Debugging

### Console Logs

The implementation includes detailed logging:

```
[AuthContext] Scheduling token refresh in 235 minutes
[AuthContext] Token refresh timer triggered
[AuthContext] Refreshing tokens...
[AuthContext] Tokens refreshed successfully
```

### Error Scenarios

| Scenario | Behavior | User Experience |
|----------|----------|-----------------|
| Access token expired | Auto-refresh | Seamless |
| Refresh token expired | Show dialog | Must re-login |
| Network error during refresh | Show dialog | Must re-login |
| Invalid session | Clear tokens, show dialog | Must re-login |

## Dependencies Added

- `jwt-decode` (^4.0.0) - JWT token decoding

## Files Modified

1. `/application/src/stores/AuthContext.tsx` - Core refresh logic
2. `/application/src/App.tsx` - Dialog integration
3. `/application/package.json` - New dependency

## Files Created

1. `/application/src/components/SessionExpiredDialog.tsx` - Expiration UI
2. `/application/src/lib/fetchWithAuth.ts` - API helper
3. `/application/FETCH_WITH_AUTH_GUIDE.md` - Usage documentation
4. `/application/TOKEN_REFRESH_IMPLEMENTATION.md` - This file

## Acceptance Criteria

✅ While refresh token is valid, user can maintain session without restarting
✅ If access_token expires during runtime, app refreshes automatically
✅ If refresh_token expires/invalid, show session expired dialog and redirect to login
✅ Proactive refresh 5 minutes before expiration
✅ Graceful handling of refresh failures
✅ No breaking changes to existing functionality

## Future Enhancements

1. **Retry Strategy**: Exponential backoff for refresh failures
2. **Analytics**: Track refresh success/failure rates
3. **User Notification**: Toast notification before session expires (1 min warning)
4. **Background Refresh**: Refresh in background even when app is idle
5. **Multi-tab Sync**: Coordinate refresh across multiple app instances
