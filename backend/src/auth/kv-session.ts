import { kv } from "@/db/kv.ts";

const SESSION_PREFIX = "sessions" as const;
const SESSION_TTL_MS = 15 * 24 * 60 * 60 * 1000; // 15 days (matches refresh token expiry)

export interface SessionCache {
    userId: string;
    createdAt: string;
}

/**
 * Session storage using Deno KV for low-latency reads.
 * Dual-write strategy: PostgreSQL is source of truth, KV is fast cache.
 * On KV miss, falls back to PostgreSQL and repopulates KV.
 */
export const sessionKV = {
    async get(sessionId: string): Promise<SessionCache | null> {
        const result = await kv.get<SessionCache>([SESSION_PREFIX, sessionId]);
        return result.value;
    },

    async set(sessionId: string, userId: string): Promise<void> {
        await kv.set<SessionCache>(
            [SESSION_PREFIX, sessionId],
            { userId, createdAt: new Date().toISOString() },
            { expireIn: SESSION_TTL_MS },
        );
    },

    async delete(sessionId: string): Promise<void> {
        await kv.delete([SESSION_PREFIX, sessionId]);
    },
};
