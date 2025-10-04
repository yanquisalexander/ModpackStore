# Alternative Minecraft Servers - Quick Reference

## For Developers

### Using the Failover in Your Code

#### Frontend (TypeScript/React)

```typescript
import { fetchMinecraftManifestWithFailover } from '@/utils/minecraftManifestFailover';

// Basic usage (uses default settings)
const manifest = await fetchMinecraftManifestWithFailover();

// With custom options
const manifest = await fetchMinecraftManifestWithFailover({
    timeout: 5000,           // 5 seconds per server
    maxRetriesPerServer: 2,  // Try each server up to 2 times
});

// Access version data
const versions = manifest.versions.filter(v => v.type === 'release');
```

#### Backend (Rust)

```rust
use crate::core::bootstrap::manifest_servers::{
    fetch_manifest_with_failover,
    fetch_version_json_with_failover,
    FailoverConfig
};

// Create client
let client = reqwest::blocking::Client::new();

// Basic usage (uses default config)
let config = FailoverConfig::default();
let manifest = fetch_manifest_with_failover(&client, &config)?;

// With custom config
let config = FailoverConfig {
    timeout: Duration::from_secs(5),
    max_retries_per_server: 2,
};
let manifest = fetch_manifest_with_failover(&client, &config)?;

// Fetch specific version JSON
let version_json = fetch_version_json_with_failover(
    &client,
    "https://launchermeta.mojang.com/v1/packages/xxx/1.20.1.json",
    &config
)?;
```

### Adding a New Mirror Server

#### Step 1: Add to Backend
Edit `application/src-tauri/src/core/bootstrap/manifest_servers.rs`:

```rust
pub const MANIFEST_SERVERS: &[&str] = &[
    "https://launchermeta.mojang.com/mc/game/version_manifest.json",
    "https://bmclapi2.bangbang93.com/mc/game/version_manifest.json",
    "https://download.mcbbs.net/mc/game/version_manifest.json",
    "https://your-new-mirror.com/mc/game/version_manifest.json",  // Add here
];
```

If the mirror uses different URL structure, update `convert_to_alternative_urls()`:

```rust
fn convert_to_alternative_urls(mojang_url: &str) -> Vec<String> {
    let mut urls = vec![mojang_url.to_string()];
    
    if mojang_url.starts_with("https://launchermeta.mojang.com/") {
        let path = mojang_url.replace("https://launchermeta.mojang.com/", "");
        
        urls.push(format!("https://bmclapi2.bangbang93.com/{}", path));
        urls.push(format!("https://download.mcbbs.net/{}", path));
        urls.push(format!("https://your-new-mirror.com/{}", path));  // Add here
    }
    
    urls
}
```

#### Step 2: Add to Frontend
Edit `application/src/consts.ts`:

```typescript
export const MINECRAFT_MANIFEST_SERVERS = [
    "https://launchermeta.mojang.com/mc/game/version_manifest.json",
    "https://bmclapi2.bangbang93.com/mc/game/version_manifest.json",
    "https://download.mcbbs.net/mc/game/version_manifest.json",
    "https://your-new-mirror.com/mc/game/version_manifest.json",  // Add here
] as const;
```

If needed, update `application/src/utils/minecraftManifestFailover.ts`:

```typescript
function convertToAlternativeUrls(mojangUrl: string): string[] {
    const urls = [mojangUrl];
    
    if (mojangUrl.startsWith("https://launchermeta.mojang.com/")) {
        const path = mojangUrl.replace("https://launchermeta.mojang.com/", "");
        
        urls.push(`https://bmclapi2.bangbang93.com/${path}`);
        urls.push(`https://download.mcbbs.net/${path}`);
        urls.push(`https://your-new-mirror.com/${path}`);  // Add here
    }
    
    return urls;
}
```

### Testing Failover

#### Simulate Server Failure (Linux/Mac)

```bash
# Block Mojang server
sudo iptables -A OUTPUT -d launchermeta.mojang.com -j DROP

# Run your app and check logs
# You should see failover to BMCLAPI

# Restore connection
sudo iptables -D OUTPUT -d launchermeta.mojang.com -j DROP
```

#### Check Logs

**Rust/Backend logs:**
```bash
# Look for these patterns
tail -f /path/to/app/logs | grep "fetch_manifest_with_failover"
```

**Browser/Frontend console:**
```javascript
// Filter console for failover messages
console.log.apply(console, arguments);  // See all logs
// Look for: [fetchMinecraftManifestWithFailover]
```

### Debugging Common Issues

#### Issue: All servers timing out
**Symptoms:**
- Long wait times (60+ seconds)
- Error: "All manifest servers failed"

**Solutions:**
1. Check internet connection
2. Verify firewall settings
3. Test each server URL manually:
   ```bash
   curl -I https://launchermeta.mojang.com/mc/game/version_manifest.json
   curl -I https://bmclapi2.bangbang93.com/mc/game/version_manifest.json
   curl -I https://download.mcbbs.net/mc/game/version_manifest.json
   ```
4. Check proxy/VPN settings

#### Issue: Slow failover
**Symptoms:**
- Takes 10+ seconds even with working backup server

**Solutions:**
1. Reduce timeout in config:
   ```typescript
   // Frontend
   fetchMinecraftManifestWithFailover({ timeout: 5000 })
   
   // Backend
   FailoverConfig {
       timeout: Duration::from_secs(5),
       max_retries_per_server: 1,
   }
   ```
2. Reorder servers based on your region
3. Remove slow servers from the list

#### Issue: Version JSON not found on mirrors
**Symptoms:**
- Manifest loads but version details fail

**Solutions:**
1. Verify URL conversion is correct
2. Check if mirror actually has the version JSON
3. Add logging to `fetch_version_json_with_failover`
4. Test URL manually:
   ```bash
   curl https://bmclapi2.bangbang93.com/v1/packages/abc123/1.20.1.json
   ```

### Performance Tips

1. **Order servers by speed**: Place fastest servers first
2. **Reduce retries**: Set `maxRetriesPerServer: 0` for faster failover
3. **Lower timeout**: Use 5s instead of 10s if servers are fast
4. **Cache aggressively**: Backend already caches for 1 hour
5. **Monitor logs**: Identify consistently failing servers

### Configuration Examples

#### Fast Failover (Quick response, less resilient)
```typescript
// Frontend
const options = {
    timeout: 3000,           // 3 seconds
    maxRetriesPerServer: 0,  // No retries
};
```

```rust
// Backend
let config = FailoverConfig {
    timeout: Duration::from_secs(3),
    max_retries_per_server: 0,
};
```

**Pros:** Quick response if server is down
**Cons:** Might miss servers that are just slow

#### Resilient Failover (Slower but more thorough)
```typescript
// Frontend
const options = {
    timeout: 15000,          // 15 seconds
    maxRetriesPerServer: 3,  // 3 retries
};
```

```rust
// Backend
let config = FailoverConfig {
    timeout: Duration::from_secs(15),
    max_retries_per_server: 3,
};
```

**Pros:** More likely to succeed with slow/flaky servers
**Cons:** Takes longer if servers are actually down

#### Balanced (Default - Recommended)
```typescript
// Frontend (default)
fetchMinecraftManifestWithFailover();  // 10s timeout, 1 retry
```

```rust
// Backend (default)
FailoverConfig::default();  // 10s timeout, 1 retry
```

**Pros:** Good balance of speed and reliability
**Cons:** None for most use cases

### Related Files

- **Backend:**
  - `application/src-tauri/src/core/bootstrap/manifest_servers.rs` - Failover logic
  - `application/src-tauri/src/core/bootstrap/manifest.rs` - Manifest functions
  - `application/src-tauri/src/core/bootstrap/mod.rs` - Module exports

- **Frontend:**
  - `application/src/consts.ts` - Server list
  - `application/src/utils/minecraftManifestFailover.ts` - Failover utilities
  - `application/src/components/CreateInstanceDialog.tsx` - Usage example
  - `application/src/components/creator/CreateVersionDialog.tsx` - Usage example
  - `application/src/components/creator/dialogs/ModpackVersionsDialog.tsx` - Usage example

- **Documentation:**
  - `ALTERNATIVE_SERVERS.md` - Complete guide
  - `ALTERNATIVE_SERVERS_VISUAL.md` - Visual flow diagrams
  - `IMPLEMENTATION_SUMMARY_ALTERNATIVE_SERVERS.md` - Implementation details

### Need Help?

- Check logs first (both Rust and browser console)
- Test servers manually with `curl` or browser
- Review documentation in `ALTERNATIVE_SERVERS.md`
- Check implementation in `manifest_servers.rs` and `minecraftManifestFailover.ts`
