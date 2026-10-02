import { Redis } from "ioredis";

const redisUrl = Deno.env.get("REDIS_URL") || "redis://localhost:6379";

let _redis: Redis | null = null;

/**
 * Lazy singleton: no abre conexión en import (clave en serverless Free Tier).
 * Cada isolate solo conecta cuando realmente encola un job.
 */
export function getRedisConnection(): Redis {
    if (!_redis) {
        _redis = new Redis(redisUrl, {
            maxRetriesPerRequest: null,
            lazyConnect: true,
            enableReadyCheck: false,
            retryStrategy: (times) => Math.min(times * 200, 2000),
        });
    }
    return _redis;
}

/**
 * Compat: acceso lazy vía Proxy para no romper `worker.tsx`.
 * El `new Redis()` real solo ocurre en el primer uso.
 */
export const redisConnection: Redis = new Proxy({} as Redis, {
    get(_t, prop) {
        const conn = getRedisConnection() as unknown as Record<string | symbol, unknown>;
        const v = conn[prop as string];
        return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(conn) : v;
    },
});