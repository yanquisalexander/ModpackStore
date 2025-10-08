# Yggdrasil Authentication Flow Diagram

## System Architecture

```
┌─────────────────┐
│ ModpackStore    │
│ Frontend (Tauri)│
└────────┬────────┘
         │
         │ 1. User launches instance
         │    without accountUuid
         ▼
┌─────────────────────────┐
│ AsyncMinecraftLauncher  │
│ ┌─────────────────────┐ │
│ │ 1. Get JWT token    │ │
│ │ 2. Authenticate     │ │
│ │ 3. Download authlib │ │
│ │ 4. Launch Minecraft │ │
│ └─────────────────────┘ │
└────────┬────────────────┘
         │
         │ 2. POST /yggdrasil/authenticate
         │    { password: jwt_token }
         ▼
┌─────────────────────────┐
│ ModpackStore Backend    │
│ ┌─────────────────────┐ │
│ │ YggdrasilService    │ │
│ │ ┌─────────────────┐ │ │
│ │ │ Verify JWT      │ │ │
│ │ │ Create session  │ │ │
│ │ │ Generate tokens │ │ │
│ │ └─────────────────┘ │ │
│ └─────────────────────┘ │
└────────┬────────────────┘
         │
         │ 3. Return accessToken,
         │    clientToken, profile
         ▼
┌─────────────────────────┐
│ Minecraft Client        │
│ (with authlib-injector) │
└────────┬────────────────┘
         │
         │ 4. Join server
         │    (automatic)
         ▼
┌─────────────────────────┐
│ POST /session/minecraft/│
│      join               │
│ ┌─────────────────────┐ │
│ │ Store serverId      │ │
│ │ Update activity     │ │
│ └─────────────────────┘ │
└────────┬────────────────┘
         │
         │ 5. Server verification
         ▼
┌─────────────────────────┐
│ Minecraft Server        │
│ (with authlib-injector) │
└────────┬────────────────┘
         │
         │ 6. GET /session/minecraft/
         │    hasJoined?username=X&serverId=Y
         ▼
┌─────────────────────────┐
│ Backend Verification    │
│ ┌─────────────────────┐ │
│ │ Find session        │ │
│ │ Validate serverId   │ │
│ │ Return profile      │ │
│ └─────────────────────┘ │
└────────┬────────────────┘
         │
         │ 7. Profile with textures
         ▼
┌─────────────────────────┐
│ Server allows join      │
│ Player authenticated ✓  │
└─────────────────────────┘
```

## Sequence Diagram

```
User        Frontend       Backend       Minecraft     Server
 │             │              │             │            │
 │ Launch      │              │             │            │
 │ instance    │              │             │            │
 ├────────────>│              │             │            │
 │             │ Authenticate │             │            │
 │             │  (JWT token) │             │            │
 │             ├─────────────>│             │            │
 │             │              │ Verify JWT  │            │
 │             │              │ Create      │            │
 │             │              │ GameSession │            │
 │             │              │             │            │
 │             │<─────────────┤             │            │
 │             │ accessToken  │             │            │
 │             │ profile      │             │            │
 │             │              │             │            │
 │             │ Launch MC    │             │            │
 │             │ + authlib    │             │            │
 │             ├─────────────────────────>│             │
 │             │              │             │            │
 │             │              │             │ Join       │
 │             │              │             │ server     │
 │             │              │             ├───────────>│
 │             │              │             │            │
 │             │              │             │ Notify     │
 │             │              │             │ join       │
 │             │              │<────────────┼────────────┤
 │             │              │ (serverId)  │            │
 │             │              │             │            │
 │             │              │             │ Verify     │
 │             │              │             │ player     │
 │             │              │<─────────────────────────┤
 │             │              │ (username,  │            │
 │             │              │  serverId)  │            │
 │             │              │             │            │
 │             │              │ Validate    │            │
 │             │              │ session     │            │
 │             │              │             │            │
 │             │              │─────────────────────────>│
 │             │              │ Profile     │            │
 │             │              │             │            │
 │             │              │             │ Allow join │
 │             │              │             │<───────────┤
 │             │              │             │            │
 │ Playing     │              │             │            │
 │<────────────┼──────────────┼─────────────┤            │
 │             │              │             │            │
```

## Session Lifecycle

```
┌──────────────┐
│ Create       │
│ Session      │
└──────┬───────┘
       │
       │ expiresAt = now + 24h
       │ lastActivity = now
       ▼
┌──────────────┐
│ Active       │◄──────┐
│ Session      │       │
└──────┬───────┘       │
       │               │
       │ Activity      │
       ├───────────────┘
       │
       │ No activity > 20min
       │ OR expiresAt < now
       ▼
┌──────────────┐
│ Expired      │
│ Session      │
└──────┬───────┘
       │
       │ Cleanup
       ▼
┌──────────────┐
│ Deleted      │
└──────────────┘
```

## Token Types

```
┌─────────────────────────────────────┐
│ JWT Token (ModpackStore)            │
│ ┌─────────────────────────────────┐ │
│ │ Header: { alg, typ }            │ │
│ │ Payload: { sub, sessionId, ... }│ │
│ │ Signature: HMACSHA256           │ │
│ └─────────────────────────────────┘ │
└───────────────┬─────────────────────┘
                │
                │ Exchange
                ▼
┌─────────────────────────────────────┐
│ Yggdrasil Tokens                    │
│ ┌─────────────────────────────────┐ │
│ │ accessToken: 64-char hex        │ │
│ │ clientToken: 32-char hex        │ │
│ │ profile: { id, name, props }    │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

## Account Types Comparison

```
┌──────────────┬──────────────┬──────────────┬──────────────┐
│ Feature      │ Microsoft    │ Offline      │ ModpackStore │
├──────────────┼──────────────┼──────────────┼──────────────┤
│ Online mode  │ ✓            │ ✗            │ ✓            │
│ Server auth  │ ✓            │ ✗            │ ✓            │
│ Custom nick  │ ✗            │ ✓            │ ✓            │
│ Skin support │ ✓            │ ✗            │ ✓            │
│ Requires MS  │ ✓            │ ✗            │ ✗            │
│ accountUuid  │ Required     │ Required     │ None         │
└──────────────┴──────────────┴──────────────┴──────────────┘
```

## File Structure

```
ModpackStore/
├── backend/
│   ├── src/
│   │   ├── entities/
│   │   │   └── GameSession.ts          # Database entity
│   │   ├── services/
│   │   │   └── yggdrasil.service.ts    # Business logic
│   │   ├── controllers/
│   │   │   └── Yggdrasil.controller.ts # HTTP handlers
│   │   └── routes/
│   │       └── v1/
│   │           └── yggdrasil.routes.ts # Route definitions
│   └── ...
└── application/
    └── src-tauri/
        └── src/
            └── core/
                ├── modpackstore_auth.rs      # Auth service
                ├── minecraft_instance.rs      # + ms_nickname field
                └── minecraft/
                    └── async_launcher.rs      # Async launcher
```
