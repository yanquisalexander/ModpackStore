# Alternative Minecraft Launcher Meta Servers

## Overview

The ModpackStore launcher implements automatic failover to alternative Minecraft launcher meta servers. This ensures the launcher remains functional even if the official Mojang server is slow or unavailable.

## Supported Servers

The following servers are used in order of priority:

1. **Official Mojang Server** (Primary)
   - URL: `https://launchermeta.mojang.com/mc/game/version_manifest.json`
   - The official Minecraft launcher meta server from Mojang

2. **BMCLAPI** (Fallback #1)
   - URL: `https://bmclapi2.bangbang93.com/mc/game/version_manifest.json`
   - A reliable mirror server, particularly fast in Asia regions

3. **MCBBS** (Fallback #2)
   - URL: `https://download.mcbbs.net/mc/game/version_manifest.json`
   - Another reliable mirror server with good availability

## How It Works

### Backend (Rust)

The backend implementation uses a failover mechanism that:

1. **Tries each server in sequence** until one succeeds
2. **Implements automatic retries** with configurable retry count per server
3. **Logs all attempts** for debugging and monitoring
4. **Handles timeouts gracefully** with configurable timeout values
5. **Converts URLs automatically** to use alternative mirrors for version-specific JSON files

Key files:
- `application/src-tauri/src/core/bootstrap/manifest_servers.rs` - Alternative server configuration and failover logic
- `application/src-tauri/src/core/bootstrap/manifest.rs` - Updated to use failover mechanism

### Frontend (TypeScript)

The frontend implementation provides:

1. **Centralized server list** in `application/src/consts.ts`
2. **Utility functions** for fetching with automatic failover
3. **Consistent error handling** across all components
4. **Transparent operation** - users don't need to manually select servers

Key files:
- `application/src/consts.ts` - Server list constant
- `application/src/utils/minecraftManifestFailover.ts` - Failover utility functions

## Configuration

### Backend Configuration

Default configuration in `manifest_servers.rs`:

```rust
pub struct FailoverConfig {
    /// Timeout for each server request (default: 10 seconds)
    pub timeout: Duration,
    /// Maximum number of retries per server (default: 1)
    pub max_retries_per_server: usize,
}
```

### Frontend Configuration

Default configuration in `minecraftManifestFailover.ts`:

```typescript
export interface FetchWithFailoverOptions {
    timeout?: number;              // Default: 10000ms (10 seconds)
    maxRetriesPerServer?: number;  // Default: 1
}
```

## Adding New Alternative Servers

### Backend (Rust)

Edit `application/src-tauri/src/core/bootstrap/manifest_servers.rs`:

```rust
pub const MANIFEST_SERVERS: &[&str] = &[
    "https://launchermeta.mojang.com/mc/game/version_manifest.json",
    "https://bmclapi2.bangbang93.com/mc/game/version_manifest.json",
    "https://download.mcbbs.net/mc/game/version_manifest.json",
    // Add your new server here
    "https://your-mirror.example.com/mc/game/version_manifest.json",
];
```

If the new server uses a different base URL structure, also update the `convert_to_alternative_urls` function to handle URL conversion for version-specific JSON files.

### Frontend (TypeScript)

Edit `application/src/consts.ts`:

```typescript
export const MINECRAFT_MANIFEST_SERVERS = [
    "https://launchermeta.mojang.com/mc/game/version_manifest.json",
    "https://bmclapi2.bangbang93.com/mc/game/version_manifest.json",
    "https://download.mcbbs.net/mc/game/version_manifest.json",
    // Add your new server here
    "https://your-mirror.example.com/mc/game/version_manifest.json",
] as const;
```

If the new server uses a different URL structure, update the `convertToAlternativeUrls` function in `application/src/utils/minecraftManifestFailover.ts`.

## Usage Examples

### Backend (Rust)

```rust
use crate::core::bootstrap::manifest_servers::{fetch_manifest_with_failover, FailoverConfig};

let client = reqwest::blocking::Client::new();
let config = FailoverConfig::default();

// Fetch manifest with automatic failover
let manifest = fetch_manifest_with_failover(&client, &config)?;

// Fetch version JSON with automatic failover
let version_json = fetch_version_json_with_failover(
    &client,
    "https://launchermeta.mojang.com/v1/packages/xxx/1.20.1.json",
    &config
)?;
```

### Frontend (TypeScript)

```typescript
import { fetchMinecraftManifestWithFailover } from '@/utils/minecraftManifestFailover';

// Fetch manifest with default configuration
const manifest = await fetchMinecraftManifestWithFailover();

// Fetch with custom configuration
const manifest = await fetchMinecraftManifestWithFailover({
    timeout: 5000,           // 5 seconds per server
    maxRetriesPerServer: 2,  // Try each server twice
});
```

## Monitoring and Debugging

### Logs

The implementation includes comprehensive logging:

**Backend logs:**
```
[fetch_manifest_with_failover] Trying server: https://launchermeta.mojang.com/...
[fetch_manifest_with_failover] Successfully fetched manifest from: https://launchermeta.mojang.com/...
```

Or in case of failure:
```
[fetch_manifest_with_failover] Server https://launchermeta.mojang.com/... failed: timeout
[fetch_manifest_with_failover] Retry attempt 1 for server: https://bmclapi2.bangbang93.com/...
```

**Frontend logs:**
```
[fetchMinecraftManifestWithFailover] Trying server: https://launchermeta.mojang.com/...
[fetchMinecraftManifestWithFailover] Successfully fetched manifest from: https://launchermeta.mojang.com/...
```

### Error Handling

If all servers fail:
- **Backend**: Returns a descriptive error with the last failure reason
- **Frontend**: Throws an error with details about the failure, which is caught and displayed as a toast notification to the user

## Benefits

1. **Improved Reliability**: Single point of failure eliminated
2. **Better Global Performance**: Users in different regions can benefit from geographically closer mirrors
3. **Transparent Failover**: No user intervention required
4. **Comprehensive Logging**: Easy to debug and monitor
5. **Extensible**: Easy to add more mirror servers in the future

## Testing

To test the failover functionality:

1. **Simulate primary server failure**:
   - Block the primary server at the network level
   - Observe automatic failover to backup servers in logs

2. **Simulate all server failures**:
   - Block all servers at the network level
   - Verify proper error handling and user notification

3. **Test performance**:
   - Monitor which server responds fastest in different regions
   - Adjust server priority order if needed

## Future Improvements

Potential enhancements that could be implemented:

1. **Dynamic Priority**: Track server response times and automatically adjust priority
2. **Health Checks**: Periodic background checks of server availability
3. **Metrics Collection**: Gather statistics on server performance and failures
4. **User Configuration**: Allow users to select preferred servers or add custom mirrors
5. **Parallel Requests**: Request from multiple servers simultaneously and use the fastest response
