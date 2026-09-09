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
import { hasAccess as checkWhitelistAccess } from "@/services/whitelist.service.ts";
import { adsService } from "@/services/ads.service.ts";

export async function getModpack(modpackId: string, userId?: string) {
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
    if (row.visibility === ModpackVisibility.PUBLIC) return row;
    if (row.visibility === ModpackVisibility.WHITELIST && userId) {
        const allowed = await checkWhitelistAccess(modpackId, userId);
        if (allowed) return row;
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

    return versions.map(v => ({
        ...v,
        files: (filesByVersion.get(v.id) || []).map(f => ({
            path: f.fileType && f.fileType !== "extras" ? `${f.fileType}/${f.path}` : f.path,
            file: { type: f.fileType },
        })),
    }));
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
    const conditions: SQL[] = [eq(modpackVersionFilesTable.modpackVersionId, versionId)];

    if (target === "client") {
        conditions.push(sql`${modpackVersionFilesTable.side} != 'server'`);
    } else if (target === "server") {
        conditions.push(sql`${modpackVersionFilesTable.side} != 'client'`);
    }

    return db.select({
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
                bannerUrl: modpacksTable.bannerUrl,
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
        bannerUrl: modpacksTable.bannerUrl,
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

    return { categories, featured };
}

export async function searchModpacks(query: string) {
    const pattern = `%${query}%`;
    return db.select({
        id: modpacksTable.id,
        name: modpacksTable.name,
        slug: modpacksTable.slug,
        shortDescription: modpacksTable.shortDescription,
        iconUrl: modpacksTable.iconUrl,
        bannerUrl: modpacksTable.bannerUrl,
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
}
