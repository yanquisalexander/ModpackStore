import { Hono } from "@hono/hono";
import type { Context } from "@hono/hono";
import { requireAuth, type AuthVariables } from "@/auth/middleware.ts";
import { requireCreatorAccess, requireCreatorRole } from "@/middlewares/creator.middleware.ts";
import { CreatorRole } from "@/db/schema.ts";
import {
    getStorageConfig,
    updateStorageConfig,
    getStorageUsage,
    listAssets,
    uploadAsset,
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
        const config = await updateStorageConfig(c.req.param("creatorId")!, storageLimitBytes);
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

        const asset = await uploadAsset(c.req.param("creatorId")!, file);
        return c.json({ data: asset }, 201);
    },
);

app.delete(
    "/:creatorId/assets/:assetId",
    requireAuth,
    requireCreatorAccess,
    async (c: Context<{ Variables: AuthVariables }>) => {
        await deleteAsset(c.req.param("creatorId")!, c.req.param("assetId")!);
        return c.body(null, 204);
    },
);

export default app;
