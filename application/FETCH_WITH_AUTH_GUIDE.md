# API Request Helper - Auto Token Refresh

## Overview

The `fetchWithAuth` utility provides automatic token refresh functionality for API requests that return 401 Unauthorized errors. This ensures a seamless user experience by transparently refreshing expired access tokens without forcing the user to re-login.

## Usage

### Basic Usage with `fetchWithAuth`

```typescript
import { fetchWithAuth } from '@/lib/fetchWithAuth';

// Make an authenticated request
const response = await fetchWithAuth('/social/friends', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  }
});

if (response.ok) {
  const data = await response.json();
  console.log(data);
}
```

### Using `fetchJson` for Typed Responses

```typescript
import { fetchJson } from '@/lib/fetchWithAuth';

interface Friend {
  id: string;
  username: string;
  status: string;
}

// Automatically handles response parsing and type safety
const friends = await fetchJson<Friend[]>('/social/friends', {
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  }
});
```

### POST Request Example

```typescript
import { fetchJson } from '@/lib/fetchWithAuth';

interface FriendRequest {
  friendshipId: string;
  status: string;
  message: string;
}

const result = await fetchJson<FriendRequest>('/social/friends/send', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    targetUserId: 'user-123',
  })
});
```

## How It Works

1. **Initial Request**: Makes the API request with the provided options
2. **401 Detection**: If the response is 401 Unauthorized, it triggers the refresh flow
3. **Token Refresh**: Calls the Rust backend's `refresh_tokens` command
4. **Retry**: If refresh succeeds, retries the original request with the new token
5. **Return**: Returns the final response (either success or error)

## Features

- ✅ **Automatic Retry**: Transparently retries failed requests after token refresh
- ✅ **Type Safety**: `fetchJson` provides full TypeScript type checking
- ✅ **No Infinite Loops**: Prevents retry loops with internal tracking
- ✅ **Backward Compatible**: Can be adopted gradually in existing services
- ✅ **Error Handling**: Properly handles refresh failures

## Migration Guide

### Before (Manual Token Handling)

```typescript
export async function getFriends(token: string): Promise<Friend[]> {
  const response = await fetch(`${API_ENDPOINT}/social/friends`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch friends');
  }
  
  return await response.json();
}
```

### After (With Auto-Refresh)

```typescript
import { fetchJson } from '@/lib/fetchWithAuth';

export async function getFriends(token: string): Promise<Friend[]> {
  return await fetchJson<Friend[]>('/social/friends', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
}
```

## Opt-Out

If you need to disable auto-refresh for a specific request (e.g., for login endpoints):

```typescript
const response = await fetchWithAuth('/auth/login', {
  skipAuthRefresh: true,
  method: 'POST',
  body: JSON.stringify(credentials)
});
```

## Integration with AuthContext

The `fetchWithAuth` utility works seamlessly with the `AuthContext` which:

- Automatically refreshes tokens 5 minutes before expiration (proactive)
- Shows a session expired dialog when refresh tokens expire
- Maintains user session transparently during app usage

Together, these features provide a robust authentication experience.
