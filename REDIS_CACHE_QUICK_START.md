# Redis Cache - Quick Reference

## Quick Start

### 1. Install and Start Redis

```bash
# Using Docker (recommended)
docker run -d --name modpack-redis -p 6379:6379 redis:latest

# Or using local Redis installation
redis-server
```

### 2. Configure Environment

Add to your `.env` file:

```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
```

### 3. Start the Backend

```bash
cd backend
npm install
npm run dev
```

The system will automatically connect to Redis on startup. If Redis is unavailable, the system will log a warning and continue without caching.

## Cached Endpoints

| Endpoint | Cache Behavior | TTL |
|----------|----------------|-----|
| `GET /v1/explore/modpacks/:id/versions/:versionId` | Full cache | Indefinite |
| `GET /v1/explore/modpacks/:id/versions/latest` | DB query for ID, then cached manifest | Indefinite |

## HTTP Headers

### Response Headers (Cached)

```http
Cache-Control: public, max-age=31536000, immutable
ETag: "md5-hash"
```

### Request Headers (Conditional)

```http
If-None-Match: "md5-hash"
```

**Result:** Returns `304 Not Modified` if ETag matches, saving bandwidth.

## Cache Flow

### Specific Version Request

```
1. Client requests /modpacks/{id}/versions/{version}
2. Check Redis cache
3. If found:
   - Validate user permissions
   - Check If-None-Match header
   - Return 304 (if ETag matches) or 200 (cached data)
4. If not found:
   - Query database
   - Validate permissions
   - Generate manifest
   - Cache in Redis (no expiration)
   - Return 200
```

### Latest Version Request

```
1. Client requests /modpacks/{id}/versions/latest
2. Query DB to find latest published version ID
3. Use that ID to check Redis cache
4. Follow same flow as specific version request
```

## Key Features

✅ **Immutable Caching** - Manifests never expire (only archived versions invalidated)

✅ **Permission Validation** - Always checks access before serving cached data

✅ **ETag Support** - Enables `304 Not Modified` responses to save bandwidth

✅ **Graceful Degradation** - Works without Redis (falls back to DB queries)

✅ **/latest Optimization** - DB lookup for latest ID, then cached manifest

## Monitoring

### Check Cache Stats

```typescript
import { ManifestCacheService } from '@/lib/redis';

const stats = await ManifestCacheService.getStats();
console.log(`Hits: ${stats.hits}, Misses: ${stats.misses}`);
```

### Check Redis Keys

```bash
redis-cli KEYS "modpack:*"
```

### View Cached Manifest

```bash
redis-cli GET "modpack:{id}:manifest:{version}"
```

## Testing

### Test Cache Miss (First Request)

```bash
curl -v http://localhost:3000/v1/explore/modpacks/{id}/versions/{version} \
  -H "Authorization: Bearer TOKEN"

# Check logs for: "[Redis] Cache MISS"
```

### Test Cache Hit (Second Request)

```bash
curl -v http://localhost:3000/v1/explore/modpacks/{id}/versions/{version} \
  -H "Authorization: Bearer TOKEN"

# Check logs for: "[Redis] Cache HIT"
```

### Test 304 Not Modified

```bash
# First, get the ETag from a request
ETAG=$(curl -s -H "Authorization: Bearer TOKEN" \
  http://localhost:3000/v1/explore/modpacks/{id}/versions/{version} \
  -I | grep -i etag | cut -d' ' -f2)

# Then use it in If-None-Match
curl -v http://localhost:3000/v1/explore/modpacks/{id}/versions/{version} \
  -H "Authorization: Bearer TOKEN" \
  -H "If-None-Match: $ETAG"

# Should return: HTTP/1.1 304 Not Modified
```

## Cache Invalidation

When a version is archived or unpublished:

```typescript
import { ManifestCacheService } from '@/lib/redis';

await ManifestCacheService.invalidate(modpackId, versionId);
```

**Note:** Automatic invalidation is not yet implemented. This should be added to version update/archive endpoints.

## Troubleshooting

### Redis Not Connecting

**Check:**
1. Redis is running: `redis-cli ping` → should return `PONG`
2. Port is correct: Default is 6379
3. Check logs for: `[Redis] Connected successfully`

**System continues to work** - Just without caching

### Cache Not Working

**Check:**
1. Redis connected: Look for `[Redis] Connected successfully` in logs
2. Keys exist: `redis-cli KEYS "modpack:*"`
3. Logs show cache operations: `[Redis] Cache HIT` or `[Redis] Cache MISS`

### Performance Not Improved

**Possible causes:**
1. Cold cache - First requests always hit DB
2. Redis not connected - Check logs
3. Every request uses `latest` - First query always hits DB to resolve latest ID

## Performance Impact

| Metric | Before Cache | With Cache | Improvement |
|--------|-------------|------------|-------------|
| Manifest Generation | ~100-500ms | ~5-10ms | **90-95% faster** |
| Database Load | Every request | First request only | **Dramatically reduced** |
| Bandwidth | Full JSON | 304 status (if ETag matches) | **Reduced** |

## Security Notes

⚠️ **Important:** Cache does NOT bypass permission checks!

Every cached response validates:
- User authentication
- Modpack access permissions
- Acquisition requirements (free, paid, password, Twitch)

Unauthorized users receive `403 Forbidden` even if manifest is cached.

## Related Documentation

- [Full Implementation Guide](./REDIS_CACHE_IMPLEMENTATION.md)
- [API Documentation](./backend/src/config/swaggerConfig.ts)

## Support

For issues or questions:
1. Check logs for Redis connection status
2. Verify .env configuration
3. Test with Redis disabled (system should still work)
4. Check [Full Documentation](./REDIS_CACHE_IMPLEMENTATION.md)
