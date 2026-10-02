import { db } from "@/db/client.ts";
import { creatorApiTokensTable, modpacksTable } from "@/db/schema.ts";
import { eq, and, desc, inArray } from "drizzle-orm";
import { apiTokenService } from "@/auth/api-token.ts";
import { ValidationError, NotFoundError } from "@/lib/errors/index.ts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface CreateTokenInput {
    name: string;
    scopes: string[];
    expiresAt?: string | null;
    modpackIds?: string[] | null;
}

export const creatorTokenService = {
    async list(creatorId: string) {
        const rows = await db.select({
            id: creatorApiTokensTable.id,
            name: creatorApiTokensTable.name,
            prefix: creatorApiTokensTable.prefix,
            scopes: creatorApiTokensTable.scopes,
            modpackIds: creatorApiTokensTable.modpackIds,
            expiresAt: creatorApiTokensTable.expiresAt,
            lastUsedAt: creatorApiTokensTable.lastUsedAt,
            revokedAt: creatorApiTokensTable.revokedAt,
            createdBy: creatorApiTokensTable.createdBy,
            createdAt: creatorApiTokensTable.createdAt,
        })
            .from(creatorApiTokensTable)
            .where(eq(creatorApiTokensTable.creatorId, creatorId))
            .orderBy(desc(creatorApiTokensTable.createdAt));
        return rows;
    },

    async create(creatorId: string, createdBy: string, input: CreateTokenInput) {
        const name = input.name?.trim();
        if (!name || name.length > 64) {
            throw new ValidationError("Token name is required (max 64 chars)", "INVALID_NAME");
        }

        const allowed = apiTokenService.allowedScopes();
        const scopes = input.scopes ?? [];
        if (!Array.isArray(scopes) || scopes.length === 0) {
            throw new ValidationError("At least one scope is required", "INVALID_SCOPES");
        }
        for (const s of scopes) {
            if (!allowed.includes(s)) {
                throw new ValidationError(`Unknown scope: ${s}`, "INVALID_SCOPES");
            }
        }

        let expiresAt: Date | null = null;
        if (input.expiresAt) {
            expiresAt = new Date(input.expiresAt);
            if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
                throw new ValidationError("expiresAt must be a future date", "INVALID_EXPIRES_AT");
            }
        }

        // modpackIds: null/undefined = all modpacks of the creator; otherwise must belong to creator
        let modpackIds: string[] | null = null;
        if (input.modpackIds !== undefined && input.modpackIds !== null) {
            if (!Array.isArray(input.modpackIds)) {
                throw new ValidationError("modpackIds must be an array or null", "INVALID_MODPACK_IDS");
            }
            for (const id of input.modpackIds) {
                if (!UUID_RE.test(id)) {
                    throw new ValidationError(`Invalid modpack ID: ${id}`, "INVALID_MODPACK_IDS");
                }
            }
            if (input.modpackIds.length > 0) {
                const owned = await db.select({ id: modpacksTable.id, creatorId: modpacksTable.creatorId })
                    .from(modpacksTable)
                    .where(inArray(modpacksTable.id, input.modpackIds));
                const ownedIds = new Set(
                    owned.filter((r) => r.creatorId === creatorId).map((r) => r.id),
                );
                for (const id of input.modpackIds) {
                    if (!ownedIds.has(id)) {
                        throw new ValidationError(`Modpack does not belong to this creator: ${id}`, "INVALID_MODPACK_IDS");
                    }
                }
                modpackIds = [...input.modpackIds];
            } else {
                modpackIds = null;
            }
        }

        const { full, prefix, hash } = await apiTokenService.generate();
        await db.insert(creatorApiTokensTable)
            .values({
                creatorId,
                name,
                prefix,
                tokenHash: hash,
                scopes,
                modpackIds,
                expiresAt,
                createdBy,
            });
        const [row] = await db.select({
            id: creatorApiTokensTable.id,
            name: creatorApiTokensTable.name,
            prefix: creatorApiTokensTable.prefix,
            scopes: creatorApiTokensTable.scopes,
            modpackIds: creatorApiTokensTable.modpackIds,
            expiresAt: creatorApiTokensTable.expiresAt,
            createdAt: creatorApiTokensTable.createdAt,
        })
            .from(creatorApiTokensTable)
            .where(eq(creatorApiTokensTable.prefix, prefix))
            .limit(1);

        // Full secret is returned exactly once; never stored in clear.
        return { ...row, token: full };
    },

    async revoke(creatorId: string, tokenId: string) {
        if (!UUID_RE.test(tokenId)) {
            throw new ValidationError("Invalid token ID", "INVALID_TOKEN_ID");
        }
        const [row] = await db.select()
            .from(creatorApiTokensTable)
            .where(and(
                eq(creatorApiTokensTable.id, tokenId),
                eq(creatorApiTokensTable.creatorId, creatorId),
            ))
            .limit(1);
        if (!row) throw new NotFoundError("Token not found", "TOKEN_NOT_FOUND");
        if (!row.revokedAt) {
            await db.update(creatorApiTokensTable)
                .set({ revokedAt: new Date(), updatedAt: new Date() })
                .where(eq(creatorApiTokensTable.id, tokenId));
            await apiTokenService.invalidate(row.prefix);
        }
        return { ok: true };
    },
};
