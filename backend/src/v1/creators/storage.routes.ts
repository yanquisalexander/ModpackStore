import { Hono } from "@hono/hono";
import type { Context } from "@hono/hono";
import { requireAuth, type AuthVariables } from "@/auth/middleware.ts";
import { requireCreatorAccess, requireCreatorRole } from "@/middlewares/creator.middleware.ts";
import { auditContextFromRequest, logCreatorEventAsync } from "@/services/creator-audit.service.ts";
import { CreatorRole } from "@/db/schema.ts";
import {
    getStorageConfig,
    updateStorageConfig,
    getStorageUsage,
    listAssets,
    uploadAsset,
    requestAssetUploadUrl,
    confirmAssetUpload,
    deleteAsset,
} from "@/services/creator-storage.service.ts";

const app = new Hono();

// ── Storage Config ─────────────────────────────────

app.get(
    "/:creatorId/storage/config",
    requireAuth,
    requireCreatorAccess,
    async (c: Context<{ Variables: AuthVariables }>) => {
        const config = await getStorageConfig(c.req.param("creatorId")!);
        return c.json({ data: config });
    },
);

app.put(
    "/:creatorId/storage/config",
    requireAuth,
    requireCreatorRole(CreatorRole.OWNER, CreatorRole.ADMIN),
    async (c: Context<{ Variables: AuthVariables }>) => {
        const { storageLimitBytes } = await c.req.json();
        const creatorId = c.req.param("creatorId")!;
        const config = await updateStorageConfig(creatorId, storageLimitBytes);
        logCreatorEventAsync({
            ...auditContextFromRequest(c, creatorId, {
                action: "storage.config.updated",
                entityType: "storage",
                entityId: creatorId,
                details: { storageLimitBytes },
            }),
            action: "storage.config.updated",
        });
        return c.json({ data: config });
    },
);

// ── Storage Usage ──────────────────────────────────

app.get(
    "/:creatorId/storage/usage",
    requireAuth,
    requireCreatorAccess,
    async (c: Context<{ Variables: AuthVariables }>) => {
        const usage = await getStorageUsage(c.req.param("creatorId")!);
        return c.json({ data: usage });
    },
);

// ── Assets ─────────────────────────────────────────

app.get(
    "/:creatorId/assets",
    requireAuth,
    requireCreatorAccess,
    async (c: Context<{ Variables: AuthVariables }>) => {
        const assets = await listAssets(c.req.param("creatorId")!);
        return c.json({ data: assets });
    },
);

// ── Direct upload: 1) pedir URL presignada (valida tipo + tope + cuota) ──

app.post(
    "/:creatorId/assets/upload-url",
    requireAuth,
    requireCreatorAccess,
    async (c: Context<{ Variables: AuthVariables }>) => {
        const body = await c.req.json<{
            fileName?: string;
            contentType?: string;
            sizeBytes?: number;
        }>();
        if (!body.fileName || typeof body.sizeBytes !== "number") {
            return c.json({ errors: [{ status: "400", title: "Bad Request", detail: "fileName and sizeBytes are required." }] }, 400);
        }
        const result = await requestAssetUploadUrl(c.req.param("creatorId")!, {
            fileName: body.fileName,
            contentType: body.contentType ?? "",
            sizeBytes: body.sizeBytes,
        });
        return c.json({ data: result });
    },
);

// ── Direct upload: 2) confirmar tras subir directo a R2 (revalida + registra en DB) ──

app.post(
    "/:creatorId/assets/confirm",
    requireAuth,
    requireCreatorAccess,
    async (c: Context<{ Variables: AuthVariables }>) => {
        const body = await c.req.json<{
            fileName?: string;
            r2Key?: string;
            contentType?: string;
            sizeBytes?: number;
        }>();
        if (!body.fileName || !body.r2Key || typeof body.sizeBytes !== "number") {
            return c.json({ errors: [{ status: "400", title: "Bad Request", detail: "fileName, r2Key and sizeBytes are required." }] }, 400);
        }
        const creatorId = c.req.param("creatorId")!;
        const asset = await confirmAssetUpload(creatorId, {
            fileName: body.fileName,
            r2Key: body.r2Key,
            contentType: body.contentType ?? "",
            sizeBytes: body.sizeBytes,
        });
        logCreatorEventAsync({
            ...auditContextFromRequest(c, creatorId, {
                action: "asset.uploaded",
                entityType: "asset",
                entityId: (asset as { id: string }).id,
                details: { fileName: body.fileName, sizeBytes: body.sizeBytes },
            }),
            action: "asset.uploaded",
        });
        return c.json({ data: asset }, 201);
    },
);

// Legacy: subida proxied por la API (se mantiene por compatibilidad).
// El flujo recomendado es upload-url -> PUT directo a R2 -> confirm.

app.post(
    "/:creatorId/assets",
    requireAuth,
    requireCreatorAccess,
    async (c: Context<{ Variables: AuthVariables }>) => {
        const body = await c.req.parseBody();
        const file = body.file as File;

        if (!file || !(file instanceof File)) {
            return c.json({ errors: [{ status: "400", title: "Bad Request", detail: "File is required." }] }, 400);
        }

        const creatorId = c.req.param("creatorId")!;
        const asset = await uploadAsset(creatorId, file);
        logCreatorEventAsync({
            ...auditContextFromRequest(c, creatorId, {
                action: "asset.uploaded",
                entityType: "asset",
                entityId: (asset as { id: string }).id,
                details: { fileName: file.name, sizeBytes: file.size },
            }),
            action: "asset.uploaded",
        });
        return c.json({ data: asset }, 201);
    },
);

app.delete(
    "/:creatorId/assets/:assetId",
    requireAuth,
    requireCreatorAccess,
    async (c: Context<{ Variables: AuthVariables }>) => {
        const creatorId = c.req.param("creatorId")!;
        const assetId = c.req.param("assetId")!;
        await deleteAsset(creatorId, assetId);
        logCreatorEventAsync({
            ...auditContextFromRequest(c, creatorId, {
                action: "asset.deleted",
                entityType: "asset",
                entityId: assetId,
            }),
            action: "asset.deleted",
        });
        return c.body(null, 204);
    },
);

export default app;
