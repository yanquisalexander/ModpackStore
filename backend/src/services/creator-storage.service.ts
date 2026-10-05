import { db } from "@/db/client.ts";
import { creatorAssetsTable, creatorStorageConfigTable, creatorsTable } from "@/db/schema.ts";
import { eq, and, sum } from "drizzle-orm";
import { NotFoundError, ValidationError, ForbiddenError } from "@/lib/errors/index.ts";
import { uploadObject, deleteObject, getCreatorAssetKey, getCreatorAssetUrl, generatePresignedUploadUrl, getObjectMeta } from "@/lib/r2.ts";
import {
    ALLOWED_MIME_TYPES,
    ALLOWED_EXTENSIONS,
    MAX_FILE_SIZE_BYTES,
    DEFAULT_STORAGE_LIMIT_BYTES,
    VERIFIED_STORAGE_LIMIT_BYTES,
} from "@/lib/storage-constants.ts";

// ── Config ─────────────────────────────────────────

export async function getStorageConfig(creatorId: string) {
    const [creator] = await db.select()
        .from(creatorsTable)
        .where(eq(creatorsTable.id, creatorId))
        .limit(1);

    if (!creator) throw new NotFoundError("Creator not found", "CREATOR_NOT_FOUND");

    const [config] = await db.select()
        .from(creatorStorageConfigTable)
        .where(eq(creatorStorageConfigTable.creatorId, creatorId))
        .limit(1);

    if (config) return config;

    const defaultLimit = (creator.verified || creator.partner)
        ? VERIFIED_STORAGE_LIMIT_BYTES
        : DEFAULT_STORAGE_LIMIT_BYTES;

    const [newConfig] = await db.insert(creatorStorageConfigTable)
        .values({ creatorId, storageLimitBytes: defaultLimit })
        .returning();

    return newConfig;
}

export async function updateStorageConfig(creatorId: string, storageLimitBytes: number) {
    if (
        typeof storageLimitBytes !== "number" ||
        !Number.isFinite(storageLimitBytes) ||
        storageLimitBytes < 0
    ) {
        throw new ValidationError("Storage limit must be positive", "INVALID_STORAGE_LIMIT");
    }
    storageLimitBytes = Math.floor(storageLimitBytes);

    const [creator] = await db.select()
        .from(creatorsTable)
        .where(eq(creatorsTable.id, creatorId))
        .limit(1);

    if (!creator) throw new NotFoundError("Creator not found", "CREATOR_NOT_FOUND");

    const [existing] = await db.select()
        .from(creatorStorageConfigTable)
        .where(eq(creatorStorageConfigTable.creatorId, creatorId))
        .limit(1);

    if (existing) {
        const [updated] = await db.update(creatorStorageConfigTable)
            .set({ storageLimitBytes, updatedAt: new Date() })
            .where(eq(creatorStorageConfigTable.creatorId, creatorId))
            .returning();
        return updated;
    }

    const [newConfig] = await db.insert(creatorStorageConfigTable)
        .values({ creatorId, storageLimitBytes })
        .returning();

    return newConfig;
}

// ── Usage ──────────────────────────────────────────

export async function getStorageUsage(creatorId: string) {
    const config = await getStorageConfig(creatorId);

    const [result] = await db.select({ value: sum(creatorAssetsTable.sizeBytes) })
        .from(creatorAssetsTable)
        .where(eq(creatorAssetsTable.creatorId, creatorId));

    const usedBytes = Number(result.value ?? 0);
    const limitBytes = config.storageLimitBytes;
    const availableBytes = Math.max(0, limitBytes - usedBytes);
    const percentage = limitBytes > 0 ? Math.min(100, (usedBytes / limitBytes) * 100) : 0;

    return {
        usedBytes,
        limitBytes,
        availableBytes,
        percentage: Math.round(percentage * 100) / 100,
    };
}

// ── Assets ─────────────────────────────────────────

export async function listAssets(creatorId: string) {
    const assets = await db.select()
        .from(creatorAssetsTable)
        .where(eq(creatorAssetsTable.creatorId, creatorId));

    return assets.map(asset => ({
        ...asset,
        url: getCreatorAssetUrl(asset.r2Key),
    }));
}

async function getCreatorOrThrow(creatorId: string) {
    const [creator] = await db.select()
        .from(creatorsTable)
        .where(eq(creatorsTable.id, creatorId))
        .limit(1);
    if (!creator) throw new NotFoundError("Creator not found", "CREATOR_NOT_FOUND");
    return creator;
}

function sanitizeFileName(raw: string): string {
    const base = (raw ?? "").split(/[\\/]/).pop() ?? "";
    const cleaned = base.replace(/[^\w.\-]+/g, "_").slice(0, 128);
    return cleaned || "file";
}

function isPrivileged(creator: { verified?: boolean | null; partner?: boolean | null }): boolean {
    return Boolean(creator.verified || creator.partner);
}

async function validateFileMeta(
    creator: { verified?: boolean | null; partner?: boolean | null },
    fileName: string,
    contentType: string,
    fileSize: number,
) {
    if (!Number.isFinite(fileSize) || fileSize < 0) {
        throw new ValidationError("Invalid file size", "INVALID_FILE_SIZE");
    }
    // verified/partner: sin tope por archivo, solo manda la cuota total.
    // resto: tope de 10 MB por archivo.
    if (!isPrivileged(creator) && fileSize > MAX_FILE_SIZE_BYTES) {
        throw new ValidationError("File size exceeds maximum (10 MB)", "FILE_TOO_LARGE");
    }

    const fileExt = fileName.substring(fileName.lastIndexOf(".")).toLowerCase();
    if (!ALLOWED_MIME_TYPES.includes(contentType) && !ALLOWED_EXTENSIONS.includes(fileExt)) {
        throw new ValidationError("File type not allowed", "INVALID_FILE_TYPE");
    }
}

// ── Direct upload (presigned URL, no pasa por la API) ─

export async function requestAssetUploadUrl(
    creatorId: string,
    input: { fileName: string; contentType: string; sizeBytes: number },
) {
    const creator = await getCreatorOrThrow(creatorId);
    const fileName = sanitizeFileName(input.fileName);
    const contentType = input.contentType ?? "";
    const fileSize = Math.floor(Number(input.sizeBytes));

    await validateFileMeta(creator, fileName, contentType, fileSize);

    const usage = await getStorageUsage(creatorId);
    if (usage.usedBytes + fileSize > usage.limitBytes) {
        throw new ValidationError(
            `Storage limit exceeded. Available: ${formatBytes(usage.availableBytes)}, Required: ${formatBytes(fileSize)}`,
            "STORAGE_LIMIT_EXCEEDED",
        );
    }

    // Key única por subida para no sobrescribir assets con mismo nombre.
    const r2Key = getCreatorAssetKey(creatorId, `${Date.now()}-${fileName}`);
    const uploadUrl = await generatePresignedUploadUrl(r2Key, 3600);
    return { uploadUrl, r2Key, fileName, expiresIn: 3600 };
}

export async function confirmAssetUpload(
    creatorId: string,
    input: { fileName: string; r2Key: string; contentType: string; sizeBytes: number },
) {
    const creator = await getCreatorOrThrow(creatorId);
    const expectedPrefix = `creator-assets/${creatorId}/`;
    if (typeof input.r2Key !== "string" || !input.r2Key.startsWith(expectedPrefix)) {
        throw new ValidationError("Invalid r2Key", "INVALID_R2_KEY");
    }

    const fileName = sanitizeFileName(input.fileName);
    const meta = await getObjectMeta(input.r2Key);
    if (!meta) {
        throw new ValidationError("Upload not found in storage. Upload the file first.", "UPLOAD_NOT_FOUND");
    }

    // Tamaño real en R2 manda (evita saltarse la cuota mintiendo el size).
    const fileSize = meta.size;
    const contentType = input.contentType ?? meta.contentType ?? "";

    await validateFileMeta(creator, fileName, contentType, fileSize);

    const usage = await getStorageUsage(creatorId);
    if (usage.usedBytes + fileSize > usage.limitBytes) {
        throw new ValidationError(
            `Storage limit exceeded. Available: ${formatBytes(usage.availableBytes)}, Required: ${formatBytes(fileSize)}`,
            "STORAGE_LIMIT_EXCEEDED",
        );
    }

    const [asset] = await db.insert(creatorAssetsTable)
        .values({
            creatorId,
            fileName,
            r2Key: input.r2Key,
            contentType,
            sizeBytes: fileSize,
        })
        .returning();

    return {
        ...asset,
        url: getCreatorAssetUrl(asset.r2Key),
    };
}

export async function uploadAsset(creatorId: string, file: File) {
    const creator = await getCreatorOrThrow(creatorId);
    const fileName = sanitizeFileName(file.name);
    const contentType = file.type;
    const fileSize = file.size;

    await validateFileMeta(creator, fileName, contentType, fileSize);

    const usage = await getStorageUsage(creatorId);
    if (usage.usedBytes + fileSize > usage.limitBytes) {
        throw new ValidationError(
            `Storage limit exceeded. Available: ${formatBytes(usage.availableBytes)}, Required: ${formatBytes(fileSize)}`,
            "STORAGE_LIMIT_EXCEEDED"
        );
    }

    const r2Key = getCreatorAssetKey(creatorId, `${Date.now()}-${fileName}`);
    const bytes = new Uint8Array(await file.arrayBuffer());
    await uploadObject(r2Key, bytes, contentType);

    const [asset] = await db.insert(creatorAssetsTable)
        .values({
            creatorId,
            fileName,
            r2Key,
            contentType,
            sizeBytes: fileSize,
        })
        .returning();

    return {
        ...asset,
        url: getCreatorAssetUrl(asset.r2Key),
    };
}

export async function deleteAsset(creatorId: string, assetId: string) {
    const [asset] = await db.select()
        .from(creatorAssetsTable)
        .where(and(
            eq(creatorAssetsTable.id, assetId),
            eq(creatorAssetsTable.creatorId, creatorId),
        ))
        .limit(1);

    if (!asset) throw new NotFoundError("Asset not found", "ASSET_NOT_FOUND");

    try {
        await deleteObject(asset.r2Key);
    } catch (err) {
        console.error("Error deleting from R2:", err);
    }

    await db.delete(creatorAssetsTable)
        .where(eq(creatorAssetsTable.id, assetId));
}

// ── Helpers ────────────────────────────────────────

function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
