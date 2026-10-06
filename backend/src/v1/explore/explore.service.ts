import { db } from "@/db/client.ts";
import {
    modpacksTable,
    modpackVersionsTable,
    modpackVersionFilesTable,
    modpackFilesTable,
    creatorsTable,
    categoriesTable,
    modpackCategoriesTable,
    ModpackVisibility,
    ModpackStatus,
} from "@/db/schema.ts";
import { eq, and, or, desc, ilike, inArray, sql, type SQL, asc } from "drizzle-orm";
import { NotFoundError } from "@/lib/errors/index.ts";
import { ForbiddenError } from "@/lib/errors/index.ts";
import { hasAccess as checkWhitelistAccess } from "@/services/whitelist.service.ts";
import { adsService } from "@/services/ads.service.ts";
import {
    getCachedHomepage,
    setCachedHomepage,
    getCachedSearch,
    setCachedSearch,
    getCachedModpack,
    setCachedModpack,
    getCachedVersions,
    setCachedVersions,
    getCachedVersionFiles,
    setCachedVersionFiles,
} from "@/services/kv-explore.ts";

export async function getModpack(modpackId: string, userId?: string) {
    const cached = await getCachedModpack(modpackId);
    if (cached) {
        // Public modpacks are immutable; cache hit is safe.
        if (cached.visibility === ModpackVisibility.PUBLIC) return cached;
        if (cached.visibility === ModpackVisibility.WHITELIST && userId) {
            const allowed = await checkWhitelistAccess(modpackId, userId);
            if (allowed) return cached;
        }
        return null;
    }

    const [row] = await db.select({
        id: modpacksTable.id,
        name: modpacksTable.name,
        slug: modpacksTable.slug,
        shortDescription: modpacksTable.shortDescription,
        description: modpacksTable.description,
        iconUrl: modpacksTable.iconUrl,
        bannerUrl: modpacksTable.bannerUrl,
        trailerUrl: modpacksTable.trailerUrl,
        visibility: modpacksTable.visibility,
        status: modpacksTable.status,
        showUserAsPublisher: modpacksTable.showUserAsPublisher,
        prelaunchAppearance: modpacksTable.prelaunchAppearance,
        acquisitionMethod: modpacksTable.acquisitionMethod,
        requiresTwitchSubscription: modpacksTable.requiresTwitchSubscription,
        twitchCreatorIds: modpacksTable.twitchCreatorIds,
        twitchChannels: modpacksTable.twitchChannels,
        createdAt: modpacksTable.createdAt,
        updatedAt: modpacksTable.updatedAt,
        creator: {
            id: creatorsTable.id,
            name: creatorsTable.displayName,
            slug: creatorsTable.slug,
            verified: creatorsTable.verified,
            logoUrl: creatorsTable.logoUrl,
            partner: creatorsTable.partner,
            hostingPartner: creatorsTable.hostingPartner,
        },
    })
        .from(modpacksTable)
        .leftJoin(creatorsTable, eq(modpacksTable.creatorId, creatorsTable.id))
        .where(eq(modpacksTable.id, modpackId))
        .limit(1);

    if (!row) return null;
    if (row.visibility === ModpackVisibility.PUBLIC) {
        await setCachedModpack(modpackId, row);
        return row;
    }
    if (row.visibility === ModpackVisibility.WHITELIST && userId) {
        const allowed = await checkWhitelistAccess(modpackId, userId);
        if (allowed) {
            await setCachedModpack(modpackId, row);
            return row;
        }
    }

    return null;
}

export async function getPrelaunchAppearance(modpackId: string) {
    const [modpack] = await db.select({
        prelaunchAppearance: modpacksTable.prelaunchAppearance,
    })
        .from(modpacksTable)
        .where(eq(modpacksTable.id, modpackId))
        .limit(1);

    return modpack?.prelaunchAppearance ?? null;
}

export async function getPublishedVersions(modpackId: string) {
    const cached = await getCachedVersions(modpackId);
    if (cached) return cached;

    const versions = await db.select({
        id: modpackVersionsTable.id,
        version: modpackVersionsTable.version,
        mcVersion: modpackVersionsTable.mcVersion,
        loaderType: modpackVersionsTable.loaderType,
        loaderVersion: modpackVersionsTable.loaderVersion,
        changelog: modpackVersionsTable.changelog,
        releaseDate: modpackVersionsTable.releaseDate,
        status: modpackVersionsTable.status,
        createdAt: modpackVersionsTable.createdAt,
        updatedAt: modpackVersionsTable.updatedAt,
    })
        .from(modpackVersionsTable)
        .where(and(
            eq(modpackVersionsTable.modpackId, modpackId),
            eq(modpackVersionsTable.status, ModpackStatus.PUBLISHED),
        ))
        .orderBy(desc(modpackVersionsTable.releaseDate));

    if (versions.length === 0) return [];

    const versionIds = versions.map(v => v.id);
    const allFiles = await db.select({
        versionId: modpackVersionFilesTable.modpackVersionId,
        path: modpackVersionFilesTable.path,
        fileType: modpackVersionFilesTable.fileType,
    })
        .from(modpackVersionFilesTable)
        .where(inArray(modpackVersionFilesTable.modpackVersionId, versionIds));

    const filesByVersion = new Map<string, typeof allFiles>();
    for (const f of allFiles) {
        const list = filesByVersion.get(f.versionId);
        if (list) list.push(f);
        else filesByVersion.set(f.versionId, [f]);
    }

    const result = versions.map(v => ({
        ...v,
        files: (filesByVersion.get(v.id) || []).map(f => ({
            path: f.fileType && f.fileType !== "extras" ? `${f.fileType}/${f.path}` : f.path,
            file: { type: f.fileType },
        })),
    }));
    void setCachedVersions(modpackId, result);
    return result;
}

export async function getVersion(versionId: string, modpackId: string) {
    const [version] = await db.select({
        id: modpackVersionsTable.id,
        modpackId: modpackVersionsTable.modpackId,
        version: modpackVersionsTable.version,
        mcVersion: modpackVersionsTable.mcVersion,
        loaderType: modpackVersionsTable.loaderType,
        loaderVersion: modpackVersionsTable.loaderVersion,
        changelog: modpackVersionsTable.changelog,
        releaseDate: modpackVersionsTable.releaseDate,
        status: modpackVersionsTable.status,
    })
        .from(modpackVersionsTable)
        .where(and(
            eq(modpackVersionsTable.id, versionId),
            eq(modpackVersionsTable.modpackId, modpackId),
        ))
        .limit(1);

    if (!version) throw new NotFoundError("Version not found", "VERSION_NOT_FOUND");
    return version;
}

export async function getLatestPublishedVersion(modpackId: string) {
    const [version] = await db.select({
        id: modpackVersionsTable.id,
        version: modpackVersionsTable.version,
        mcVersion: modpackVersionsTable.mcVersion,
        loaderType: modpackVersionsTable.loaderType,
        loaderVersion: modpackVersionsTable.loaderVersion,
        changelog: modpackVersionsTable.changelog,
        releaseDate: modpackVersionsTable.releaseDate,
        status: modpackVersionsTable.status,
    })
        .from(modpackVersionsTable)
        .where(and(
            eq(modpackVersionsTable.modpackId, modpackId),
            eq(modpackVersionsTable.status, ModpackStatus.PUBLISHED),
        ))
        .orderBy(desc(modpackVersionsTable.releaseDate))
        .limit(1);

    if (!version) throw new NotFoundError("No published version found", "NO_PUBLISHED_VERSION");
    return version;
}

export async function getVersionFiles(versionId: string, target: "client" | "server" | "both") {
    const cached = await getCachedVersionFiles(versionId, target);
    if (cached) return cached;

    const conditions: SQL[] = [eq(modpackVersionFilesTable.modpackVersionId, versionId)];

    if (target === "client") {
        conditions.push(sql`${modpackVersionFilesTable.side} != 'server'`);
    } else if (target === "server") {
        conditions.push(sql`${modpackVersionFilesTable.side} != 'client'`);
    }

    const rows = await db.select({
        fileHash: modpackVersionFilesTable.fileHash,
        path: modpackVersionFilesTable.path,
        fileType: modpackVersionFilesTable.fileType,
        side: modpackVersionFilesTable.side,
        size: modpackFilesTable.size,
        mimeType: modpackFilesTable.mimeType,
    })
        .from(modpackVersionFilesTable)
        .innerJoin(
            modpackFilesTable,
            eq(modpackFilesTable.hash, modpackVersionFilesTable.fileHash),
        )
        .where(and(...conditions));
    void setCachedVersionFiles(versionId, target, rows);
    return rows;
}

export async function getModpackBasicInfo(modpackId: string) {
    const [modpack] = await db.select({
        id: modpacksTable.id,
        name: modpacksTable.name,
    })
        .from(modpacksTable)
        .where(eq(modpacksTable.id, modpackId))
        .limit(1);

    return modpack ?? null;
}

export async function getModpackPassword(modpackId: string) {
    const [result] = await db.select({
        password: modpacksTable.password,
    })
        .from(modpacksTable)
        .where(eq(modpacksTable.id, modpackId))
        .limit(1);

    return result?.password ?? null;
}

export async function getExploreHomepage(userId?: string) {
    const cached = await getCachedHomepage();
    if (cached) return cached;

    const allCategories = await db.select()
        .from(categoriesTable)
        .where(eq(categoriesTable.isAdminOnly, false))
        .orderBy(asc(categoriesTable.displayOrder));

    const categoryResults = await Promise.all(
        allCategories.map(async (cat) => {
            const modpackRows = await db.select({
                id: modpacksTable.id,
                name: modpacksTable.name,
                slug: modpacksTable.slug,
                shortDescription: modpacksTable.shortDescription,
                description: modpacksTable.description,
                iconUrl: modpacksTable.iconUrl,
                iconUrlResized: modpacksTable.iconUrlResized,
                bannerUrl: modpacksTable.bannerUrl,
                bannerUrlResized: modpacksTable.bannerUrlResized,
                trailerUrl: modpacksTable.trailerUrl,
                acquisitionMethod: modpacksTable.acquisitionMethod,
                createdAt: modpacksTable.createdAt,
                updatedAt: modpacksTable.updatedAt,
                creator: {
                    id: creatorsTable.id,
                    name: creatorsTable.displayName,
                    slug: creatorsTable.slug,
                    verified: creatorsTable.verified,
                    logoUrl: creatorsTable.logoUrl,
                },
            })
                .from(modpacksTable)
                .innerJoin(modpackCategoriesTable, eq(modpacksTable.id, modpackCategoriesTable.modpackId))
                .leftJoin(creatorsTable, eq(modpacksTable.creatorId, creatorsTable.id))
                .where(and(
                    eq(modpacksTable.visibility, ModpackVisibility.PUBLIC),
                    eq(modpacksTable.status, ModpackStatus.PUBLISHED),
                    eq(modpackCategoriesTable.categoryId, cat.id),
                ))
                .orderBy(desc(modpacksTable.updatedAt))
                .limit(20);

            return {
                id: cat.id,
                name: cat.name,
                displayOrder: cat.displayOrder,
                modpacks: modpackRows,
            };
        })
    );

    const uncategorized = await db.select({
        id: modpacksTable.id,
        name: modpacksTable.name,
        slug: modpacksTable.slug,
        shortDescription: modpacksTable.shortDescription,
        description: modpacksTable.description,
        iconUrl: modpacksTable.iconUrl,
        iconUrlResized: modpacksTable.iconUrlResized,
        bannerUrl: modpacksTable.bannerUrl,
        bannerUrlResized: modpacksTable.bannerUrlResized,
        trailerUrl: modpacksTable.trailerUrl,
        acquisitionMethod: modpacksTable.acquisitionMethod,
        createdAt: modpacksTable.createdAt,
        updatedAt: modpacksTable.updatedAt,
        creator: {
            id: creatorsTable.id,
            name: creatorsTable.displayName,
            slug: creatorsTable.slug,
            verified: creatorsTable.verified,
            logoUrl: creatorsTable.logoUrl,
        },
    })
        .from(modpacksTable)
        .leftJoin(creatorsTable, eq(modpacksTable.creatorId, creatorsTable.id))
        .where(and(
            eq(modpacksTable.visibility, ModpackVisibility.PUBLIC),
            eq(modpacksTable.status, ModpackStatus.PUBLISHED),
            sql`NOT EXISTS (SELECT 1 FROM ${modpackCategoriesTable} WHERE ${modpackCategoriesTable.modpackId} = ${modpacksTable.id})`,
        ))
        .orderBy(desc(modpacksTable.updatedAt))
        .limit(20);

    const categories = [
        ...categoryResults.filter(c => c.modpacks.length > 0),
        ...(uncategorized.length > 0 ? [{
            id: "uncategorized",
            name: "Uncategorized",
            displayOrder: 999,
            modpacks: uncategorized,
        }] : []),
    ];

    const featured = await adsService.getFeaturedSlides(userId);

    const result = { categories, featured };

    void setCachedHomepage(result);
    return result;
}

export async function searchModpacks(query: string) {
    const cached = await getCachedSearch(query);
    if (cached) return cached;

    const pattern = `%${query}%`;
    const results = await db.select({
        id: modpacksTable.id,
        name: modpacksTable.name,
        slug: modpacksTable.slug,
        shortDescription: modpacksTable.shortDescription,
        iconUrl: modpacksTable.iconUrl,
        iconUrlResized: modpacksTable.iconUrlResized,
        bannerUrl: modpacksTable.bannerUrl,
        bannerUrlResized: modpacksTable.bannerUrlResized,
        visibility: modpacksTable.visibility,
        status: modpacksTable.status,
        acquisitionMethod: modpacksTable.acquisitionMethod,
        createdAt: modpacksTable.createdAt,
        updatedAt: modpacksTable.updatedAt,
        creator: {
            id: creatorsTable.id,
            name: creatorsTable.displayName,
            slug: creatorsTable.slug,
            verified: creatorsTable.verified,
            logoUrl: creatorsTable.logoUrl,
        },
    })
        .from(modpacksTable)
        .leftJoin(creatorsTable, eq(modpacksTable.creatorId, creatorsTable.id))
        .where(and(
            or(
                ilike(modpacksTable.name, pattern),
                ilike(modpacksTable.slug, pattern),
            ),
            eq(modpacksTable.visibility, ModpackVisibility.PUBLIC),
            eq(modpacksTable.status, ModpackStatus.PUBLISHED),
        ))
        .orderBy(modpacksTable.name)
        .limit(20);
    void setCachedSearch(query, results);
    return results;
}

/**
 * Mezcla equitativa de resultados locales + Modrinth (round-robin ponderado).
 *
 * Pesos configurables: con 1:1 la lista alterna store, modrinth, store…
 * (la Store abre para dar un leve impulso al contenido propio sin enterrar
 * a Modrinth). Se deduplica por nombre normalizado quedándose con la
 * primera aparición (Store gana empates).
 */
export const BLEND_WEIGHTS = { store: 1, modrinth: 1 } as const;
export const BLEND_LIMIT = 30;

function normalizeName(name: unknown): string {
    return String(name ?? "")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "");
}

export function blendSearchResults(
    local: any[],
    remote: any[],
    weights: { store: number; modrinth: number } = BLEND_WEIGHTS,
    limit: number = BLEND_LIMIT,
): any[] {
    const queues: { items: any[]; weight: number; taken: number }[] = [
        { items: [...local], weight: Math.max(1, weights.store), taken: 0 },
        { items: [...remote], weight: Math.max(1, weights.modrinth), taken: 0 },
    ];
    const seen = new Set<string>();
    const out: any[] = [];

    const pushUnique = (item: any): boolean => {
        const key = normalizeName(item?.name ?? item?.slug ?? item?.id);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        out.push(item);
        return true;
    };

    // Round-robin ponderado: en cada ronda se toman hasta `weight` items
    // de cada fuente (saltando duplicados sin contarlos como consumidos).
    while (out.length < limit && queues.some((q) => q.items.length > 0)) {
        let progressed = false;
        for (const q of queues) {
            let takes = 0;
            while (takes < q.weight && q.items.length > 0 && out.length < limit) {
                const item = q.items.shift()!;
                q.taken++;
                takes++;
                if (pushUnique(item)) progressed = true;
            }
        }
        if (!progressed) break; // solo quedaban duplicados
    }
    return out;
}

/**
 * Validates that a creator API token may access a modpack (server-sync use case).
 * The token must belong to the creator that owns the modpack, carry the
 * `server:sync` scope, and — when restricted — include the modpack in `modpackIds`.
 * Throws ForbiddenError otherwise. User sessions must use checkAccess() instead.
 */
export async function assertTokenModpackAccess(
    token: { creatorId: string; scopes: string[]; modpackIds: string[] | null } | undefined,
    modpackId: string,
): Promise<void> {
    if (!token) {
        throw new ForbiddenError("Invalid API token", "INVALID_API_TOKEN");
    }
    if (!token.scopes.includes("server:sync")) {
        throw new ForbiddenError("Token lacks required scope", "INSUFFICIENT_SCOPE");
    }
    if (token.modpackIds !== null && !token.modpackIds.includes(modpackId)) {
        throw new ForbiddenError("Token is not scoped to this modpack", "TOKEN_MODPACK_NOT_ALLOWED");
    }
    const [modpack] = await db.select({ creatorId: modpacksTable.creatorId })
        .from(modpacksTable)
        .where(eq(modpacksTable.id, modpackId))
        .limit(1);
    if (!modpack || modpack.creatorId !== token.creatorId) {
        throw new ForbiddenError("Token does not belong to this modpack's creator", "TOKEN_CREATOR_MISMATCH");
    }
}
