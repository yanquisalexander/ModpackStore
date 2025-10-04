import Redis from 'ioredis';

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379');
const REDIS_PASSWORD = process.env.REDIS_PASSWORD;
const REDIS_DB = parseInt(process.env.REDIS_DB || '0');

let redis: Redis | null = null;
let isRedisAvailable = false;

/**
 * Initialize Redis connection
 * If Redis is not available, the system will continue without caching
 */
export function initRedis(): void {
    try {
        redis = new Redis({
            host: REDIS_HOST,
            port: REDIS_PORT,
            password: REDIS_PASSWORD,
            db: REDIS_DB,
            lazyConnect: true,
            retryStrategy: (times) => {
                if (times > 3) {
                    console.warn('[Redis] Max retries reached. Operating without cache.');
                    return null;
                }
                return Math.min(times * 50, 2000);
            },
            maxRetriesPerRequest: 3,
        });

        redis.on('connect', () => {
            console.log('[Redis] Connected successfully');
            isRedisAvailable = true;
        });

        redis.on('error', (err) => {
            console.error('[Redis] Connection error:', err.message);
            isRedisAvailable = false;
        });

        redis.on('close', () => {
            console.warn('[Redis] Connection closed');
            isRedisAvailable = false;
        });

        // Attempt to connect
        redis.connect().catch((err) => {
            console.error('[Redis] Failed to connect:', err.message);
            console.warn('[Redis] System will operate without cache');
            isRedisAvailable = false;
        });
    } catch (error) {
        console.error('[Redis] Initialization error:', error);
        console.warn('[Redis] System will operate without cache');
        isRedisAvailable = false;
    }
}

/**
 * Get the Redis client instance
 */
export function getRedisClient(): Redis | null {
    return redis;
}

/**
 * Check if Redis is available
 */
export function isRedisConnected(): boolean {
    return isRedisAvailable && redis !== null && redis.status === 'ready';
}

/**
 * Cache service for modpack version manifests
 */
export class ManifestCacheService {
    private static readonly KEY_PREFIX = 'modpack';
    private static readonly TTL_INDEFINITE = 0; // Never expire

    /**
     * Generate cache key for a version manifest
     */
    static getCacheKey(modpackId: string, versionId: string): string {
        return `${this.KEY_PREFIX}:${modpackId}:manifest:${versionId}`;
    }

    /**
     * Get cached manifest
     */
    static async get(modpackId: string, versionId: string): Promise<any | null> {
        if (!isRedisConnected() || !redis) {
            return null;
        }

        try {
            const key = this.getCacheKey(modpackId, versionId);
            const cached = await redis.get(key);
            
            if (cached) {
                console.log(`[Redis] Cache HIT for ${key}`);
                return JSON.parse(cached);
            }

            console.log(`[Redis] Cache MISS for ${key}`);
            return null;
        } catch (error) {
            console.error('[Redis] Error getting cached manifest:', error);
            return null;
        }
    }

    /**
     * Set cached manifest (indefinite TTL)
     */
    static async set(modpackId: string, versionId: string, manifest: any): Promise<void> {
        if (!isRedisConnected() || !redis) {
            return;
        }

        try {
            const key = this.getCacheKey(modpackId, versionId);
            const value = JSON.stringify(manifest);
            
            // No TTL - manifests never expire (immutable once published)
            await redis.set(key, value);
            
            console.log(`[Redis] Cached manifest: ${key}`);
        } catch (error) {
            console.error('[Redis] Error setting cached manifest:', error);
        }
    }

    /**
     * Invalidate cached manifest (for archiving scenarios)
     */
    static async invalidate(modpackId: string, versionId: string): Promise<void> {
        if (!isRedisConnected() || !redis) {
            return;
        }

        try {
            const key = this.getCacheKey(modpackId, versionId);
            await redis.del(key);
            console.log(`[Redis] Invalidated cache: ${key}`);
        } catch (error) {
            console.error('[Redis] Error invalidating cache:', error);
        }
    }

    /**
     * Get cache statistics
     */
    static async getStats(): Promise<{ hits: number; misses: number } | null> {
        if (!isRedisConnected() || !redis) {
            return null;
        }

        try {
            const info = await redis.info('stats');
            const hitsMatch = info.match(/keyspace_hits:(\d+)/);
            const missesMatch = info.match(/keyspace_misses:(\d+)/);

            return {
                hits: hitsMatch ? parseInt(hitsMatch[1]) : 0,
                misses: missesMatch ? parseInt(missesMatch[1]) : 0,
            };
        } catch (error) {
            console.error('[Redis] Error getting stats:', error);
            return null;
        }
    }
}

/**
 * Close Redis connection gracefully
 */
export async function closeRedis(): Promise<void> {
    if (redis) {
        await redis.quit();
        redis = null;
        isRedisAvailable = false;
        console.log('[Redis] Connection closed');
    }
}
