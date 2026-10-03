import { getKv } from "@/db/kv.ts";

const SESSION_PREFIX = "sessions" as const;
const SESSION_TTL_MS = 15 * 24 * 60 * 60 * 1000; // 15 days (matches refresh token expiry)
const USER_SNAPSHOT_TTL_MS = 5 * 60 * 1000; // 5 min – avoids a DB select per request

export interface SessionCache {
    userId: string;
    createdAt: string;
    // Snapshot del usuario para evitar db.select(users) en cada request autenticado.
    // Se actualiza desde el source of truth (DB) cuando se crea/expira la sessi�n.
    user?: {
        id: string;
        role: string;
        username: string;
        avatarUrl: string | null;
        isPlus?: boolean;
        adFree?: boolean;
    };
}

/**
 * Session storage using Deno KV for low-latency reads.
 * Dual-write strategy: PostgreSQL is source of truth, KV is fast cache.
 * On KV miss, falls back to PostgreSQL and repopulates KV.
 */
export const sessionKV = {
    async get(sessionId: string): Promise<SessionCache | null> {
        const kv = await getKv();
        const result = await kv.get<SessionCache>([SESSION_PREFIX, sessionId]);
        return result.value;
    },

    async set(sessionId: string, userId: string, user?: SessionCache["user"]): Promise<void> {
        const kv = await getKv();
        const value: SessionCache = { userId, createdAt: new Date().toISOString(), user };
        await kv.set(
            [SESSION_PREFIX, sessionId],
            value,
            { expireIn: SESSION_TTL_MS },
        );
    },

    async delete(sessionId: string): Promise<void> {
        const kv = await getKv();
        await kv.delete([SESSION_PREFIX, sessionId]);
    },
};
