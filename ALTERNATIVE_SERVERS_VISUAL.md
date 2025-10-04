# Alternative Minecraft Servers - Visual Flow Diagram

## Failover Flow

```
┌─────────────────────────────────────────────────────────────┐
│          User Action: Create/Open Minecraft Instance         │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│         Frontend: fetchMinecraftManifestWithFailover()       │
│                    (or Backend equivalent)                   │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
        ┌─────────────────────────────┐
        │  Try Server #1 (Mojang)     │
        │  Timeout: 10s               │
        └──┬──────────────────────────┘
           │
           ├─── Success? ──────────────────┐
           │                               │
           └─── Timeout/Error              │
                      │                    │
                      ▼                    │
        ┌─────────────────────────────┐   │
        │  Retry Server #1            │   │
        │  (if maxRetries > 0)        │   │
        └──┬──────────────────────────┘   │
           │                               │
           ├─── Success? ──────────────────┤
           │                               │
           └─── Still Failing              │
                      │                    │
                      ▼                    │
        ┌─────────────────────────────┐   │
        │  Try Server #2 (BMCLAPI)    │   │
        │  Timeout: 10s               │   │
        └──┬──────────────────────────┘   │
           │                               │
           ├─── Success? ──────────────────┤
           │                               │
           └─── Timeout/Error              │
                      │                    │
                      ▼                    │
        ┌─────────────────────────────┐   │
        │  Retry Server #2            │   │
        │  (if maxRetries > 0)        │   │
        └──┬──────────────────────────┘   │
           │                               │
           ├─── Success? ──────────────────┤
           │                               │
           └─── Still Failing              │
                      │                    │
                      ▼                    │
        ┌─────────────────────────────┐   │
        │  Try Server #3 (MCBBS)      │   │
        │  Timeout: 10s               │   │
        └──┬──────────────────────────┘   │
           │                               │
           ├─── Success? ──────────────────┤
           │                               │
           └─── Timeout/Error              │
                      │                    │
                      ▼                    │
        ┌─────────────────────────────┐   │
        │  Retry Server #3            │   │
        │  (if maxRetries > 0)        │   │
        └──┬──────────────────────────┘   │
           │                               │
           ├─── Success? ──────────────────┤
           │                               │
           └─── All Servers Failed         │
                      │                    │
                      ▼                    ▼
           ┌──────────────────┐   ┌──────────────────┐
           │  Show Error      │   │  Return Manifest │
           │  Toast to User   │   │  Data to Caller  │
           └──────────────────┘   └──────────────────┘
```

## Server List Priority

```
Priority 1: ┌──────────────────────────────────────────────┐
            │  https://launchermeta.mojang.com             │
            │  - Official Mojang server                    │
            │  - Best for most regions                     │
            │  - Primary source of truth                   │
            └──────────────────────────────────────────────┘

Priority 2: ┌──────────────────────────────────────────────┐
            │  https://bmclapi2.bangbang93.com             │
            │  - BMCLAPI mirror                            │
            │  - Fast in Asia/China                        │
            │  - Maintained by community                   │
            └──────────────────────────────────────────────┘

Priority 3: ┌──────────────────────────────────────────────┐
            │  https://download.mcbbs.net                  │
            │  - MCBBS mirror                              │
            │  - Alternative China mirror                  │
            │  - Additional redundancy                     │
            └──────────────────────────────────────────────┘
```

## Configuration Options

### Backend (Rust)

```rust
pub struct FailoverConfig {
    timeout: Duration,              // Default: 10 seconds
    max_retries_per_server: usize,  // Default: 1 retry
}
```

### Frontend (TypeScript)

```typescript
interface FetchWithFailoverOptions {
    timeout?: number;              // Default: 10000ms
    maxRetriesPerServer?: number;  // Default: 1
}
```

## Logging Examples

### Successful Case
```
[INFO] [fetch_manifest_with_failover] Trying server: https://launchermeta.mojang.com/...
[INFO] [fetch_manifest_with_failover] Successfully fetched manifest from: https://launchermeta.mojang.com/...
```

### Failover Case
```
[INFO] [fetch_manifest_with_failover] Trying server: https://launchermeta.mojang.com/...
[WARN] [fetch_manifest_with_failover] Server https://launchermeta.mojang.com/... failed: timeout
[WARN] [fetch_manifest_with_failover] Retry attempt 1 for server: https://launchermeta.mojang.com/...
[WARN] [fetch_manifest_with_failover] Server https://launchermeta.mojang.com/... failed: timeout
[INFO] [fetch_manifest_with_failover] Trying server: https://bmclapi2.bangbang93.com/...
[INFO] [fetch_manifest_with_failover] Successfully fetched manifest from: https://bmclapi2.bangbang93.com/...
```

### Complete Failure Case
```
[INFO] [fetch_manifest_with_failover] Trying server: https://launchermeta.mojang.com/...
[WARN] [fetch_manifest_with_failover] Server https://launchermeta.mojang.com/... failed: timeout
[INFO] [fetch_manifest_with_failover] Trying server: https://bmclapi2.bangbang93.com/...
[WARN] [fetch_manifest_with_failover] Server https://bmclapi2.bangbang93.com/... failed: connection refused
[INFO] [fetch_manifest_with_failover] Trying server: https://download.mcbbs.net/...
[WARN] [fetch_manifest_with_failover] Server https://download.mcbbs.net/... failed: timeout
[ERROR] [get_version_manifest] Failed to fetch manifest: All manifest servers failed
```

## Performance Characteristics

### Best Case (Primary Server Working)
- **Time**: ~1-2 seconds
- **Servers Tried**: 1
- **User Impact**: None - transparent

### Failover Case (Primary Down, Secondary Working)
- **Time**: ~11-12 seconds
  - Primary timeout: 10s
  - Secondary success: 1-2s
- **Servers Tried**: 2
- **User Impact**: Minimal - slightly longer load time

### Worst Case (All Servers Down)
- **Time**: ~60-66 seconds
  - Server 1: 10s timeout + 10s retry
  - Server 2: 10s timeout + 10s retry
  - Server 3: 10s timeout + 10s retry
- **Servers Tried**: 3 (with retries)
- **User Impact**: Error message shown, operation fails

## Components Updated

1. **CreateInstanceDialog.tsx**
   - Used when: Creating new Minecraft instances
   - Change: Now uses `fetchMinecraftManifestWithFailover()`

2. **CreateVersionDialog.tsx**
   - Used when: Creating new modpack versions
   - Change: Now uses `fetchMinecraftManifestWithFailover()`

3. **ModpackVersionsDialog.tsx**
   - Used when: Managing modpack versions
   - Change: Now uses `fetchMinecraftManifestWithFailover()`

## Benefits Summary

✅ **Reliability**: No single point of failure
✅ **Performance**: Faster access from different regions
✅ **Transparency**: Automatic failover without user interaction
✅ **Monitoring**: Comprehensive logging for debugging
✅ **Extensibility**: Easy to add more mirror servers
