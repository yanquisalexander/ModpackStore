import { getKv } from "@/db/kv.ts";

const TOKEN_PREFIX = "creator_api_tokens" as const;
// Short TTL: tokens are revocable, KV is just a fast path. DB is source of truth.
const TOKEN_TTL_MS = 5 * 60 * 1000; // 5 minutes

export interface ApiTokenCache {
    tokenHash: string;
    creatorId: string;
    scopes: string[];
    modpackIds: string[] | null;
    revokedAt: string | null;
    expiresAt: string | null;
    creatorBanned: boolean;
    creatorStatus: string;
}

/**
 * KV cache for creator API tokens (same dual-write pattern as sessionKV).
 * Keyed by token prefix (public part). Value carries the hash for verification.
 * On KV miss, callers fall back to PostgreSQL and repopulate.
 */
export const apiTokenKV = {
    async get(prefix: string): Promise<ApiTokenCache | null> {
        const kv = await getKv();
        const result = await kv.get<ApiTokenCache>([TOKEN_PREFIX, prefix]);
        return result.value;
    },

    async set(prefix: string, value: ApiTokenCache): Promise<void> {
        const kv = await getKv();
        await kv.set([TOKEN_PREFIX, prefix], value, { expireIn: TOKEN_TTL_MS });
    },

    async delete(prefix: string): Promise<void> {
        const kv = await getKv();
        await kv.delete([TOKEN_PREFIX, prefix]);
    },
};
