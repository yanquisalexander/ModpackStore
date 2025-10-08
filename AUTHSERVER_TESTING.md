# AuthServer Test Guide

This guide provides manual testing steps for the AuthServer implementation.

## Prerequisites

1. Backend server running
2. PostgreSQL database initialized
3. User account created and logged in
4. Valid JWT access token

## Getting a JWT Token

### Option 1: From Browser DevTools
1. Open ModpackStore application
2. Log in with Discord
3. Open DevTools (F12)
4. Go to Application > Local Storage
5. Find the auth store and copy the `access_token`

### Option 2: Using the Auth API
```bash
# After Discord OAuth callback, the token is returned
curl -X GET "http://localhost:3000/v1/auth/me" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Test 1: Metadata Endpoint

This endpoint provides authlib-injector discovery information.

```bash
curl -X GET "http://localhost:3000/v1/authserver" \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "meta": {
    "serverName": "ModpackStore AuthServer",
    "implementationName": "ModpackStore AuthServer",
    "implementationVersion": "1.0.0",
    "feature.non_email_login": true
  },
  "skinDomains": []
}
```

## Test 2: Get Game Session (Custom Endpoint)

This is the endpoint the Rust launcher will use.

```bash
curl -X POST "http://localhost:3000/v1/authserver/gamesession" \
  -H "Content-Type: application/json" \
  -d '{
    "token": "YOUR_JWT_TOKEN_HERE",
    "nickname": "TestPlayer"
  }'
```

**Expected Response:**
```json
{
  "data": {
    "accessToken": "uuid-v4-format",
    "clientToken": "uuid-v4-format",
    "username": "TestPlayer",
    "uuid": "user-uuid"
  }
}
```

## Test 3: Authenticate (Yggdrasil Standard)

```bash
curl -X POST "http://localhost:3000/v1/authserver/authenticate" \
  -H "Content-Type: application/json" \
  -d '{
    "token": "YOUR_JWT_TOKEN_HERE",
    "agent": {
      "name": "Minecraft",
      "version": 1
    }
  }'
```

**Expected Response:**
```json
{
  "accessToken": "uuid-format",
  "clientToken": "uuid-format",
  "availableProfiles": [
    {
      "id": "uuid-without-dashes",
      "name": "username"
    }
  ],
  "selectedProfile": {
    "id": "uuid-without-dashes",
    "name": "username"
  }
}
```

Save the `accessToken` and `clientToken` for subsequent tests.

## Test 4: Validate Session

```bash
curl -X POST "http://localhost:3000/v1/authserver/validate" \
  -H "Content-Type: application/json" \
  -d '{
    "accessToken": "ACCESS_TOKEN_FROM_TEST_3",
    "clientToken": "CLIENT_TOKEN_FROM_TEST_3"
  }'
```

**Expected Response:**
- HTTP Status: 204 No Content
- Empty body

**If invalid:**
- HTTP Status: 403
- Error response

## Test 5: Refresh Session

```bash
curl -X POST "http://localhost:3000/v1/authserver/refresh" \
  -H "Content-Type: application/json" \
  -d '{
    "accessToken": "ACCESS_TOKEN_FROM_TEST_3",
    "clientToken": "CLIENT_TOKEN_FROM_TEST_3"
  }'
```

**Expected Response:**
```json
{
  "accessToken": "new-uuid-format",
  "clientToken": "same-client-token",
  "selectedProfile": {
    "id": "uuid-without-dashes",
    "name": "username"
  }
}
```

## Test 6: Invalidate Session

```bash
curl -X POST "http://localhost:3000/v1/authserver/invalidate" \
  -H "Content-Type: application/json" \
  -d '{
    "accessToken": "ACCESS_TOKEN_FROM_TEST_5",
    "clientToken": "CLIENT_TOKEN_FROM_TEST_5"
  }'
```

**Expected Response:**
- HTTP Status: 204 No Content
- Empty body

## Test 7: Sign Out All Sessions

```bash
curl -X POST "http://localhost:3000/v1/authserver/signout" \
  -H "Content-Type: application/json" \
  -d '{
    "token": "YOUR_JWT_TOKEN_HERE"
  }'
```

**Expected Response:**
- HTTP Status: 204 No Content
- Empty body

## Test 8: Session Expiration

1. Create a session using Test 2 or Test 3
2. Wait 20 minutes (or modify the code to reduce timeout)
3. Try to validate (Test 4)
4. Should return 403 Forbidden

## Test 9: Database Verification

Connect to PostgreSQL and check:

```sql
-- View all active sessions
SELECT 
    id, 
    user_id, 
    access_token, 
    is_active, 
    last_activity_at,
    created_at
FROM game_sessions
WHERE is_active = true;

-- View expired sessions (inactive > 20 minutes)
SELECT 
    id, 
    user_id, 
    is_active,
    NOW() - last_activity_at as inactive_duration
FROM game_sessions
WHERE NOW() - last_activity_at > INTERVAL '20 minutes';
```

## Test 10: Error Cases

### Invalid JWT Token
```bash
curl -X POST "http://localhost:3000/v1/authserver/gamesession" \
  -H "Content-Type: application/json" \
  -d '{
    "token": "invalid-token"
  }'
```
**Expected:** HTTP 403 with error message

### Missing Token
```bash
curl -X POST "http://localhost:3000/v1/authserver/authenticate" \
  -H "Content-Type: application/json" \
  -d '{}'
```
**Expected:** HTTP 400 with "Token is required"

### Mismatched Client Token
```bash
curl -X POST "http://localhost:3000/v1/authserver/refresh" \
  -H "Content-Type: application/json" \
  -d '{
    "accessToken": "VALID_ACCESS_TOKEN",
    "clientToken": "wrong-client-token"
  }'
```
**Expected:** HTTP 403 with "Invalid token"

## Automated Testing Script

Create a file `test-authserver.sh`:

```bash
#!/bin/bash

# Configuration
API_URL="http://localhost:3000/v1/authserver"
JWT_TOKEN="YOUR_JWT_TOKEN_HERE"

echo "Testing ModpackStore AuthServer..."

# Test 1: Metadata
echo -e "\n1. Testing metadata endpoint..."
curl -s -X GET "$API_URL" | jq .

# Test 2: Get Game Session
echo -e "\n2. Testing game session creation..."
RESPONSE=$(curl -s -X POST "$API_URL/gamesession" \
  -H "Content-Type: application/json" \
  -d "{\"token\": \"$JWT_TOKEN\", \"nickname\": \"TestPlayer\"}")
echo $RESPONSE | jq .
ACCESS_TOKEN=$(echo $RESPONSE | jq -r '.data.accessToken')
CLIENT_TOKEN=$(echo $RESPONSE | jq -r '.data.clientToken')

# Test 3: Validate
echo -e "\n3. Testing validate..."
curl -s -X POST "$API_URL/validate" \
  -H "Content-Type: application/json" \
  -d "{\"accessToken\": \"$ACCESS_TOKEN\", \"clientToken\": \"$CLIENT_TOKEN\"}" \
  -w "\nHTTP Status: %{http_code}\n"

# Test 4: Refresh
echo -e "\n4. Testing refresh..."
REFRESH_RESPONSE=$(curl -s -X POST "$API_URL/refresh" \
  -H "Content-Type: application/json" \
  -d "{\"accessToken\": \"$ACCESS_TOKEN\", \"clientToken\": \"$CLIENT_TOKEN\"}")
echo $REFRESH_RESPONSE | jq .
NEW_ACCESS_TOKEN=$(echo $REFRESH_RESPONSE | jq -r '.accessToken')

# Test 5: Invalidate
echo -e "\n5. Testing invalidate..."
curl -s -X POST "$API_URL/invalidate" \
  -H "Content-Type: application/json" \
  -d "{\"accessToken\": \"$NEW_ACCESS_TOKEN\", \"clientToken\": \"$CLIENT_TOKEN\"}" \
  -w "\nHTTP Status: %{http_code}\n"

echo -e "\nAll tests completed!"
```

Make it executable and run:
```bash
chmod +x test-authserver.sh
./test-authserver.sh
```

## Integration Test with authlib-injector

To test with actual Minecraft:

1. Download authlib-injector:
```bash
wget https://github.com/yushijinhun/authlib-injector/releases/download/v1.2.5/authlib-injector-1.2.5.jar
```

2. Get a game session token:
```bash
TOKEN=$(curl -s -X POST "http://localhost:3000/v1/authserver/gamesession" \
  -H "Content-Type: application/json" \
  -d "{\"token\": \"$JWT_TOKEN\", \"nickname\": \"TestPlayer\"}" \
  | jq -r '.data.accessToken')
```

3. Launch Minecraft with authlib-injector:
```bash
java -javaagent:authlib-injector-1.2.5.jar=http://localhost:3000/v1/authserver \
  -Dauthlibinjector.mojangNamespace=enabled \
  -Dauthlibinjector.legacySkinPolyfill=enabled \
  -Dauthlibinjector.profileKey=disabled \
  -Dauthlibinjector.usernameCheck=disabled \
  -jar minecraft.jar \
  --accessToken $TOKEN \
  --username TestPlayer \
  --uuid USER_UUID
```

## Success Criteria

All tests should pass with:
- ✅ Metadata returns server information
- ✅ Game session creation works with JWT
- ✅ Nickname is properly set
- ✅ Session validation returns 204
- ✅ Session refresh generates new token
- ✅ Session invalidation works
- ✅ Sign out clears all sessions
- ✅ Expired sessions are rejected
- ✅ Error cases return proper status codes
- ✅ Database shows correct session states

## Troubleshooting

### "User not found" error
- Ensure you're using a valid JWT token
- Check that the user exists in the database

### Session not expiring
- Check `last_activity_at` timestamp in database
- Verify 20-minute calculation in GameSession.isExpired()

### authlib-injector fails
- Check that metadata endpoint is accessible
- Verify CORS is properly configured
- Check Java version compatibility

### Database connection errors
- Verify PostgreSQL is running
- Check DB credentials in .env
- Ensure game_sessions table exists
