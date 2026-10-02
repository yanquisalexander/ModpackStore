import { db } from "@/db/client.ts";
import { creatorApiTokensTable, creatorsTable, CREATOR_TOKEN_SCOPES } from "@/db/schema.ts";
import { eq } from "drizzle-orm";
import { apiTokenKV } from "@/auth/kv-apitoken.ts";

export const TOKEN_PREFIX_SCHEME = "mps_";

export interface ResolvedApiToken {
    id: string;
    creatorId: string;
    name: string;
    prefix: string;
    scopes: string[];
    modpackIds: string[] | null;
}

function randomUrlSafe(bytes: number): string {
    const buf = new Uint8Array(bytes);
    crypto.getRandomValues(buf);
    let binary = "";
    for (const b of buf) binary += String.fromCharCode(b);
    // base64url without padding
    return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

async function sha256Hex(input: string): Promise<string> {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time string comparison to avoid timing leaks on the secret hash. */
function timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
}

export const apiTokenService = {
    /** Scopes allowed for creator tokens. `server:sync` is the grouped scope for server-agent. */
    allowedScopes(): string[] {
        return [...CREATOR_TOKEN_SCOPES];
    },

    /** Generates a new `mps_<prefix>_<secret>` token. Only the hash is stored; the full value is returned once. */
    async generate(): Promise<{ full: string; prefix: string; hash: string }> {
        const prefix = randomUrlSafe(6); // 8 chars base64url
        const secret = randomUrlSafe(32); // ~43 chars (~256 bits)
        const full = `${TOKEN_PREFIX_SCHEME}${prefix}_${secret}`;
        const hash = await sha256Hex(full);
        return { full, prefix, hash };
    },

    hashOf(full: string): Promise<string> {
        return sha256Hex(full);
    },

    /**
     * Resolves a `mps_...` bearer value to its token row.
     * KV-first (by prefix), PostgreSQL fallback + repopulate.
     * Returns null for unknown/revoked/expired/banned tokens (callers map to 401).
     */
    async resolve(bearer: string): Promise<ResolvedApiToken | null> {
        if (!bearer.startsWith(TOKEN_PREFIX_SCHEME)) return null;
        const rest = bearer.slice(TOKEN_PREFIX_SCHEME.length);
        const sep = rest.indexOf("_");
        if (sep <= 0) return null;
        const prefix = rest.slice(0, sep);
        if (!prefix || rest.length - sep - 1 < 16) return null;

        const candidateHash = await sha256Hex(bearer);

        // Fast path: KV
        const cached = await apiTokenKV.get(prefix);
        if (cached) {
            if (
                timingSafeEqual(cached.tokenHash, candidateHash) &&
                !cached.revokedAt &&
                (!cached.expiresAt || new Date(cached.expiresAt).getTime() > Date.now()) &&
                !cached.creatorBanned &&
                cached.creatorStatus === "approved"
            ) {
                return {
                    id: "",
                    creatorId: cached.creatorId,
                    name: "",
                    prefix,
                    scopes: cached.scopes,
                    modpackIds: cached.modpackIds,
                };
            }
            if (cached.revokedAt) return null; // respect cached revocation within TTL
            // Any other mismatch/expiry falls through to DB (source of truth)
        }

        const [row] = await db.select()
            .from(creatorApiTokensTable)
            .where(eq(creatorApiTokensTable.prefix, prefix))
            .limit(1);
        if (!row) return null;
        if (!timingSafeEqual(row.tokenHash, candidateHash)) return null;
        if (row.revokedAt) {
            await apiTokenKV.delete(prefix);
            return null;
        }
        if (row.expiresAt && new Date(row.expiresAt).getTime() <= Date.now()) return null;

        const [creator] = await db.select({
            status: creatorsTable.status,
            banned: creatorsTable.banned,
        })
            .from(creatorsTable)
            .where(eq(creatorsTable.id, row.creatorId))
            .limit(1);
        if (!creator || creator.banned || creator.status !== "approved") return null;

        await apiTokenKV.set(prefix, {
            tokenHash: row.tokenHash,
            creatorId: row.creatorId,
            scopes: row.scopes,
            modpackIds: row.modpackIds,
            revokedAt: row.revokedAt ? new Date(row.revokedAt).toISOString() : null,
            expiresAt: row.expiresAt ? new Date(row.expiresAt).toISOString() : null,
            creatorBanned: creator.banned,
            creatorStatus: creator.status,
        });

        return {
            id: row.id,
            creatorId: row.creatorId,
            name: row.name,
            prefix: row.prefix,
            scopes: row.scopes,
            modpackIds: row.modpackIds,
        };
    },

    /** Fire-and-forget last-used bookkeeping (never blocks the response). */
    touchLastUsed(prefix: string): void {
        (async () => {
            try {
                await db.update(creatorApiTokensTable)
                    .set({ lastUsedAt: new Date() })
                    .where(eq(creatorApiTokensTable.prefix, prefix));
            } catch {
                // best effort
            }
        })();
    },

    invalidate(prefix: string): Promise<void> {
        return apiTokenKV.delete(prefix);
    },
};
