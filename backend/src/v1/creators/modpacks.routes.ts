import { Hono } from "@hono/hono";
import type { Context } from "@hono/hono";
import { requireAuth, type AuthVariables } from "@/auth/middleware.ts";
import { requireCreatorAccess, requireCreatorRole } from "@/middlewares/creator.middleware.ts";
import { requireCaptcha } from "@/middlewares/requireCaptcha.ts";
import { CreatorRole } from "@/db/schema.ts";
import { db } from "@/db/client.ts";
import { modpacksTable } from "@/db/schema.ts";
import { eq } from "drizzle-orm";
import { NotFoundError } from "@/lib/errors/index.ts";
import { uploadObject, getModpackImageKey, getModpackImageUrl } from "@/lib/r2.ts";
import {
    createModpack,
    getModpacksByCreator,
    updateModpack,
    deleteModpack,
} from "@/services/modpack.service.ts";
import {
    createVersion,
    getVersions,
    getVersion,
    updateVersion,

    publishVersion,
    archiveVersion,
    getUploadUrl,
    confirmUpload,
    getPreviousFiles,
    reuseFiles,
    updateFileSide,
    deleteFileFromVersion,
    getProcessingJobs,
    retryProcessingJob,
} from "@/services/version.service.ts";

const app = new Hono<{ Variables: AuthVariables }>();

// ── Middleware: verify modpack belongs to this creator ──
async function requireModpackAccess(c: Context, next: () => Promise<void>) {
    const modpackId = c.req.param("modpackId") as string;
    const creatorId = c.req.param("creatorId") as string;

    const [modpack] = await db.select()
        .from(modpacksTable)
        .where(eq(modpacksTable.id, modpackId))
        .limit(1);

    if (!modpack || modpack.creatorId !== creatorId) {
        throw new NotFoundError("Modpack not found", "MODPACK_NOT_FOUND");
    }

    // Store modpack in context so handlers can reuse it without re-querying
    c.set("modpack", modpack);

    await next();
}

function requireFileType(c: Context, next: () => Promise<void>) {
    const fileType = c.req.param("fileType");
    if (!fileType || !["mods", "resourcepacks", "config", "shaderpacks", "datapacks", "extras"].includes(fileType)) {
        throw new NotFoundError("Invalid file type", "INVALID_FILE_TYPE");
    }
    return next();
}

// ── Modpack CRUD ─────────────────────────────────────

app.get("/", requireAuth, requireCreatorAccess, async (c) => {
    const creatorId = c.req.param("creatorId")!;
    const modpacks = await getModpacksByCreator(creatorId);
    return c.json(modpacks);
});

app.post("/", requireAuth, requireCreatorRole(CreatorRole.OWNER, CreatorRole.ADMIN), requireCaptcha, async (c) => {
    const userId = c.get("userId");
    const creatorId = c.req.param("creatorId")!;
    const body = await c.req.parseBody();
    const categoryIds = body.categoryIds ? JSON.parse(body.categoryIds as string) : [];
    const modpack = await createModpack(creatorId, userId, {
        name: (body.name as string) ?? "",
        shortDescription: (body.shortDescription as string) ?? "",
        description: body.description as string | undefined,
        visibility: body.visibility as any,
        iconUrl: body.iconUrl as string | undefined,
        bannerUrl: body.bannerUrl as string | undefined,
        acquisitionMethod: body.acquisitionMethod as string | undefined,
        password: body.password as string | undefined,
        categoryIds,
        primaryCategoryId: body.primaryCategoryId as string | undefined,
    });
    return c.json(modpack, 201);
});

app.get("/:modpackId", requireAuth, requireCreatorAccess, requireModpackAccess, async (c) => {
    // Reuse modpack from middleware context (already fetched and validated)
    const modpack = c.get("modpack");
    return c.json(modpack);
});

app.patch("/:modpackId", requireAuth, requireCreatorRole(CreatorRole.OWNER, CreatorRole.ADMIN), requireModpackAccess, async (c) => {
    const modpackId = c.req.param("modpackId")!;
    const currentModpack = c.get("modpack");
    const body = await c.req.parseBody();
    const data: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(body)) {
        if (typeof val === "string") data[key] = val;
    }

    if (body.icon instanceof File) {
        const bytes = new Uint8Array(await body.icon.arrayBuffer());
        await uploadObject(getModpackImageKey(modpackId, 'icon'), bytes, body.icon.type);
        data.iconUrl = getModpackImageUrl(modpackId, 'icon');
    }
    if (body.banner instanceof File) {
        const bytes = new Uint8Array(await body.banner.arrayBuffer());
        await uploadObject(getModpackImageKey(modpackId, 'banner'), bytes, body.banner.type);
        data.bannerUrl = getModpackImageUrl(modpackId, 'banner');
    }

    // Pass current modpack to avoid re-querying
    const modpack = await updateModpack(modpackId, data as any, currentModpack);
    return c.json(modpack);
});

app.delete("/:modpackId", requireAuth, requireCreatorRole(CreatorRole.OWNER, CreatorRole.ADMIN), requireModpackAccess, async (c) => {
    const modpackId = c.req.param("modpackId")!;
    const modpack = await deleteModpack(modpackId);
    return c.json(modpack);
});

// ── Version CRUD ─────────────────────────────────────

app.get("/:modpackId/versions", requireAuth, requireCreatorAccess, requireModpackAccess, async (c) => {
    const modpackId = c.req.param("modpackId")!;
    const versions = await getVersions(modpackId);
    return c.json(versions);
});

app.post("/:modpackId/versions", requireAuth, requireCreatorRole(CreatorRole.OWNER, CreatorRole.ADMIN), requireModpackAccess, async (c) => {
    const userId = c.get("userId");
    const modpackId = c.req.param("modpackId")!;
    const body = await c.req.json();
    const version = await createVersion(modpackId, userId, body);
    return c.json(version, 201);
});

app.get("/:modpackId/versions/:versionId", requireAuth, requireCreatorAccess, requireModpackAccess, async (c) => {
    const versionId = c.req.param("versionId")!;
    const version = await getVersion(versionId);
    return c.json(version);
});

app.patch("/:modpackId/versions/:versionId", requireAuth, requireCreatorRole(CreatorRole.OWNER, CreatorRole.ADMIN), requireModpackAccess, async (c) => {
    const versionId = c.req.param("versionId")!;
    const body = await c.req.json();
    const version = await updateVersion(versionId, body);
    return c.json(version);
});

app.patch("/:modpackId/versions/:versionId/publish", requireAuth, requireCreatorRole(CreatorRole.OWNER, CreatorRole.ADMIN), requireModpackAccess, async (c) => {
    const versionId = c.req.param("versionId")!;
    const version = await publishVersion(versionId);
    return c.json(version);
});

app.patch("/:modpackId/versions/:versionId/archive", requireAuth, requireCreatorRole(CreatorRole.OWNER, CreatorRole.ADMIN), requireModpackAccess, async (c) => {
    const versionId = c.req.param("versionId")!;
    const version = await archiveVersion(versionId);
    return c.json(version);
});

// ── Upload by fileType ──────────────────────────────

app.post("/:modpackId/versions/:versionId/upload-url/:fileType",
    requireAuth,
    requireCreatorRole(CreatorRole.OWNER, CreatorRole.ADMIN),
    requireModpackAccess,
    requireFileType,
    async (c) => {
        const modpackId = c.req.param("modpackId")!;
        const versionId = c.req.param("versionId")!;
        const fileType = c.req.param("fileType")!;
        const result = await getUploadUrl(modpackId, versionId, fileType);
        return c.json(result);
    },
);

app.post("/:modpackId/versions/:versionId/confirm-upload/:fileType",
    requireAuth,
    requireCreatorRole(CreatorRole.OWNER, CreatorRole.ADMIN),
    requireModpackAccess,
    requireFileType,
    async (c) => {
        const modpackId = c.req.param("modpackId")!;
        const versionId = c.req.param("versionId")!;
        const fileType = c.req.param("fileType")!;
        const result = await confirmUpload(modpackId, versionId, fileType);
        return c.json(result);
    },
);

// ── Reuse files ─────────────────────────────────────

app.get("/:modpackId/versions/:versionId/previous-files/:fileType",
    requireAuth,
    requireCreatorRole(CreatorRole.OWNER, CreatorRole.ADMIN),
    requireModpackAccess,
    requireFileType,
    async (c) => {
        const versionId = c.req.param("versionId")!;
        const fileType = c.req.param("fileType")!;
        const files = await getPreviousFiles(versionId, fileType);
        return c.json(files);
    },
);

app.post("/:modpackId/versions/:versionId/reuse-files/:fileType",
    requireAuth,
    requireCreatorRole(CreatorRole.OWNER, CreatorRole.ADMIN),
    requireModpackAccess,
    requireFileType,
    async (c) => {
        const versionId = c.req.param("versionId")!;
        const fileType = c.req.param("fileType")!;
        const { fileRefs } = await c.req.json();
        const count = await reuseFiles(versionId, fileType, fileRefs);
        return c.json({ reused: count });
    },
);

// ── Processing jobs ─────────────────────────────────

app.get("/:modpackId/versions/:versionId/processing-jobs",
    requireAuth,
    requireCreatorAccess,
    requireModpackAccess,
    async (c) => {
        const versionId = c.req.param("versionId")!;
        const jobs = await getProcessingJobs(versionId);
        return c.json(jobs);
    },
);

app.post("/:modpackId/versions/:versionId/processing-jobs/:jobId/retry",
    requireAuth,
    requireCreatorRole(CreatorRole.OWNER, CreatorRole.ADMIN),
    requireModpackAccess,
    async (c) => {
        const jobId = c.req.param("jobId")!;
        await retryProcessingJob(jobId);
        return c.json({ success: true });
    },
);

// ── File management ─────────────────────────────────

app.patch("/:modpackId/versions/:versionId/files/:fileHash/side",
    requireAuth,
    requireCreatorRole(CreatorRole.OWNER, CreatorRole.ADMIN),
    requireModpackAccess,
    async (c) => {
        const versionId = c.req.param("versionId")!;
        const fileHash = c.req.param("fileHash")!;
        const { side } = await c.req.json();
        const result = await updateFileSide(versionId, fileHash, side);
        return c.json(result);
    },
);

app.delete("/:modpackId/versions/:versionId/files/:fileHash",
    requireAuth,
    requireCreatorRole(CreatorRole.OWNER, CreatorRole.ADMIN),
    requireModpackAccess,
    async (c) => {
        const versionId = c.req.param("versionId")!;
        const fileHash = c.req.param("fileHash")!;
        await deleteFileFromVersion(versionId, fileHash);
        return c.body(null, 204);
    },
);

export default app;
