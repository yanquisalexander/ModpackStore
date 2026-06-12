import { db } from "@/db/client.ts";
import {
    modpacksTable,
    modpackVersionsTable,
    modpackVersionFilesTable,
    modpackFilesTable,
    ModpackStatus,
    ModLoaderType,
} from "@/db/schema.ts";
import { eq, and, desc, inArray, ne } from "drizzle-orm";
import { NotFoundError, ValidationError } from "@/lib/errors/index.ts";
import { generatePresignedUploadUrl, getTempZipKey } from "@/lib/r2.ts";
import { ProcessModpackFilesQueue } from "@/worker/queues.ts";

export async function createVersion(
    modpackId: string,
    userId: string,
    data: {
        version: string;
        mcVersion: string;
        loaderType?: ModLoaderType;
        loaderVersion?: string;
    },
) {
    if (!data.version?.trim()) {
        throw new ValidationError("Version name is required", "MISSING_VERSION");
    }
    if (!data.mcVersion?.trim()) {
        throw new ValidationError("Minecraft version is required", "MISSING_MC_VERSION");
    }

    const [modpack] = await db.select()
        .from(modpacksTable)
        .where(eq(modpacksTable.id, modpackId))
        .limit(1);

    if (!modpack) throw new NotFoundError("Modpack not found", "MODPACK_NOT_FOUND");

    const [version] = await db.insert(modpackVersionsTable)
        .values({
            modpackId,
            version: data.version,
            mcVersion: data.mcVersion,
            loaderType: data.loaderType ?? ModLoaderType.VANILLA,
            loaderVersion: data.loaderVersion ?? null,
            createdBy: userId,
        })
        .returning();

    return version;
}

export async function getVersions(modpackId: string) {
    return db.select()
        .from(modpackVersionsTable)
        .where(eq(modpackVersionsTable.modpackId, modpackId))
        .orderBy(desc(modpackVersionsTable.createdAt));
}

export async function getVersion(versionId: string) {
    const [version] = await db.select()
        .from(modpackVersionsTable)
        .where(eq(modpackVersionsTable.id, versionId))
        .limit(1);

    if (!version) throw new NotFoundError("Version not found", "VERSION_NOT_FOUND");

    const [modpack] = await db.select({ name: modpacksTable.name })
        .from(modpacksTable)
        .where(eq(modpacksTable.id, version.modpackId))
        .limit(1);

    const files = await db.select({
        fileHash: modpackVersionFilesTable.fileHash,
        path: modpackVersionFilesTable.path,
        fileType: modpackVersionFilesTable.fileType,
        side: modpackVersionFilesTable.side,
        size: modpackFilesTable.size,
        mimeType: modpackFilesTable.mimeType,
        uploadedAt: modpackFilesTable.uploadedAt,
    })
        .from(modpackVersionFilesTable)
        .innerJoin(
            modpackFilesTable,
            eq(modpackFilesTable.hash, modpackVersionFilesTable.fileHash),
        )
        .where(eq(modpackVersionFilesTable.modpackVersionId, versionId));

    return { ...version, modpackName: modpack?.name ?? "", files };
}

export async function updateVersion(versionId: string, data: { changelog?: string }) {
    const [version] = await db.update(modpackVersionsTable)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(modpackVersionsTable.id, versionId))
        .returning();

    if (!version) throw new NotFoundError("Version not found", "VERSION_NOT_FOUND");
    return version;
}

export async function deleteVersion(versionId: string) {
    const [version] = await db.update(modpackVersionsTable)
        .set({ status: ModpackStatus.ARCHIVED, updatedAt: new Date() })
        .where(eq(modpackVersionsTable.id, versionId))
        .returning();

    if (!version) throw new NotFoundError("Version not found", "VERSION_NOT_FOUND");
    return version;
}

export async function publishVersion(versionId: string) {
    const [version] = await db.update(modpackVersionsTable)
        .set({
            status: ModpackStatus.PUBLISHED,
            releaseDate: new Date(),
            updatedAt: new Date(),
        })
        .where(eq(modpackVersionsTable.id, versionId))
        .returning();

    if (!version) throw new NotFoundError("Version not found", "VERSION_NOT_FOUND");
    return version;
}

export async function archiveVersion(versionId: string) {
    const [version] = await db.update(modpackVersionsTable)
        .set({ status: ModpackStatus.ARCHIVED, updatedAt: new Date() })
        .where(eq(modpackVersionsTable.id, versionId))
        .returning();

    if (!version) throw new NotFoundError("Version not found", "VERSION_NOT_FOUND");
    return version;
}

// ── Upload by fileType ─────────────────────────────

export async function getUploadUrl(modpackId: string, versionId: string, fileType: string): Promise<{ uploadUrl: string; expiresIn: number }> {
    const key = getTempZipKey(modpackId, versionId, fileType);
    const expiresIn = 3600;
    const uploadUrl = await generatePresignedUploadUrl(key, expiresIn);
    return { uploadUrl, expiresIn };
}

export async function confirmUpload(modpackId: string, versionId: string, fileType: string): Promise<{ jobId: string }> {
    const [version] = await db.select()
        .from(modpackVersionsTable)
        .where(eq(modpackVersionsTable.id, versionId))
        .limit(1);

    if (!version) throw new NotFoundError("Version not found", "VERSION_NOT_FOUND");

    const jobId = `process-${modpackId}-${versionId}-${fileType}-${Date.now()}`;
    await ProcessModpackFilesQueue.add("process-modpack-files", { versionId, fileType }, { jobId });
    return { jobId };
}

// ── Reuse files from previous versions ────────────

export async function getPreviousFiles(versionId: string, fileType: string) {
    const [currentVersion] = await db.select()
        .from(modpackVersionsTable)
        .where(eq(modpackVersionsTable.id, versionId))
        .limit(1);

    if (!currentVersion) throw new NotFoundError("Version not found", "VERSION_NOT_FOUND");

    const previousVersions = await db.select({ id: modpackVersionsTable.id })
        .from(modpackVersionsTable)
        .where(
            and(
                eq(modpackVersionsTable.modpackId, currentVersion.modpackId),
                ne(modpackVersionsTable.id, versionId),
                eq(modpackVersionsTable.status, ModpackStatus.PUBLISHED),
            ),
        )
        .orderBy(desc(modpackVersionsTable.createdAt));

    if (previousVersions.length === 0) return [];

    const versionIds = previousVersions.map((v) => v.id);

    const files = await db.select({
        fileHash: modpackVersionFilesTable.fileHash,
        path: modpackVersionFilesTable.path,
        fileType: modpackVersionFilesTable.fileType,
        side: modpackVersionFilesTable.side,
        size: modpackFilesTable.size,
        versionId: modpackVersionFilesTable.modpackVersionId,
    })
        .from(modpackVersionFilesTable)
        .innerJoin(modpackFilesTable, eq(modpackFilesTable.hash, modpackVersionFilesTable.fileHash))
        .where(
            and(
                inArray(modpackVersionFilesTable.modpackVersionId, versionIds),
                eq(modpackVersionFilesTable.fileType, fileType),
            ),
        );

    return files;
}

export async function reuseFiles(versionId: string, fileType: string, fileRefs: { versionId: string; fileHash: string }[]) {
    const refHashes = fileRefs.map((r) => r.fileHash);
    const refVersionIds = [...new Set(fileRefs.map((r) => r.versionId))];

    // Look up original paths and sides from the referenced version files
    const originalFiles = await db.select({
        fileHash: modpackVersionFilesTable.fileHash,
        path: modpackVersionFilesTable.path,
        side: modpackVersionFilesTable.side,
        versionId: modpackVersionFilesTable.modpackVersionId,
    })
        .from(modpackVersionFilesTable)
        .where(
            and(
                inArray(modpackVersionFilesTable.modpackVersionId, refVersionIds),
                inArray(modpackVersionFilesTable.fileHash, refHashes),
                eq(modpackVersionFilesTable.fileType, fileType),
            ),
        );

    const lookup = new Map(
        originalFiles.map((f) => [`${f.versionId}-${f.fileHash}`, f]),
    );

    const rows = fileRefs.map((ref) => {
        const orig = lookup.get(`${ref.versionId}-${ref.fileHash}`);
        return {
            fileHash: ref.fileHash,
            modpackVersionId: versionId,
            path: orig?.path ?? "",
            fileType,
            side: (orig?.side ?? "both") as "client" | "server" | "both",
        };
    }).filter((r) => r.path);

    // Remove duplicates already linked to this version
    const existing = await db.select({ fileHash: modpackVersionFilesTable.fileHash })
        .from(modpackVersionFilesTable)
        .where(
            and(
                eq(modpackVersionFilesTable.modpackVersionId, versionId),
                eq(modpackVersionFilesTable.fileType, fileType),
            ),
        );

    const existingHashes = new Set(existing.map((e) => e.fileHash));
    const toInsert = rows.filter((r) => !existingHashes.has(r.fileHash));

    if (toInsert.length > 0) {
        await db.insert(modpackVersionFilesTable).values(toInsert).onConflictDoNothing();
    }

    return toInsert.length;
}

// ── File management ────────────────────────────────

export async function updateFileSide(versionId: string, fileHash: string, side: string) {
    const allowedSides = ["client", "server", "both"];
    if (!allowedSides.includes(side)) {
        throw new ValidationError("Side must be client, server, or both", "INVALID_SIDE");
    }

    const [result] = await db.update(modpackVersionFilesTable)
        .set({ side: side as any })
        .where(
            and(
                eq(modpackVersionFilesTable.modpackVersionId, versionId),
                eq(modpackVersionFilesTable.fileHash, fileHash),
            ),
        )
        .returning();

    if (!result) throw new NotFoundError("File not found in this version", "FILE_NOT_FOUND");
    return result;
}

export async function deleteFileFromVersion(versionId: string, fileHash: string) {
    const [result] = await db.delete(modpackVersionFilesTable)
        .where(
            and(
                eq(modpackVersionFilesTable.modpackVersionId, versionId),
                eq(modpackVersionFilesTable.fileHash, fileHash),
            ),
        )
        .returning();

    if (!result) throw new NotFoundError("File not found in this version", "FILE_NOT_FOUND");
}
