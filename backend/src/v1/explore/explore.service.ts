import { db } from "@/db/client.ts";
import {
    modpacksTable,
    modpackVersionsTable,
    modpackVersionFilesTable,
    modpackFilesTable,
    ModpackVisibility,
    ModpackStatus,
} from "@/db/schema.ts";
import { eq, and, desc, sql, type SQL } from "drizzle-orm";
import { NotFoundError } from "@/lib/errors/index.ts";

export async function getModpack(modpackId: string) {
    const [modpack] = await db.select({
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
        prelaunchAppearance: modpacksTable.prelaunchAppearance,
        isPaid: modpacksTable.isPaid,
        price: modpacksTable.price,
        createdAt: modpacksTable.createdAt,
        updatedAt: modpacksTable.updatedAt,
    })
        .from(modpacksTable)
        .where(and(
            eq(modpacksTable.id, modpackId),
            eq(modpacksTable.visibility, ModpackVisibility.PUBLIC),
        ))
        .limit(1);

    return modpack ?? null;
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
    return db.select({
        id: modpackVersionsTable.id,
        version: modpackVersionsTable.version,
        mcVersion: modpackVersionsTable.mcVersion,
        loaderType: modpackVersionsTable.loaderType,
        loaderVersion: modpackVersionsTable.loaderVersion,
        changelog: modpackVersionsTable.changelog,
        releaseDate: modpackVersionsTable.releaseDate,
        status: modpackVersionsTable.status,
        createdAt: modpackVersionsTable.createdAt,
    })
        .from(modpackVersionsTable)
        .where(and(
            eq(modpackVersionsTable.modpackId, modpackId),
            eq(modpackVersionsTable.status, ModpackStatus.PUBLISHED),
        ))
        .orderBy(desc(modpackVersionsTable.releaseDate));
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

export function validatePassword(password: string, hashedPassword: string | null): boolean {
    if (!hashedPassword) return true;
    return password === hashedPassword;
}

export async function getModpackBasicInfo(modpackId: string) {
    const [modpack] = await db.select({
        id: modpacksTable.id,
        name: modpacksTable.name,
    })
        .from(modpacksTable)
        .where(and(
            eq(modpacksTable.id, modpackId),
            eq(modpacksTable.visibility, ModpackVisibility.PUBLIC),
        ))
        .limit(1);

    return modpack ?? null;
}
