import { Hono } from "@hono/hono";
import type { Context } from "@hono/hono";
import { requireAuth, type AuthVariables } from "@/auth/middleware.ts";
import { requireCreatorAccess, requireCreatorRole } from "@/middlewares/creator.middleware.ts";
import { CreatorRole } from "@/db/schema.ts";
import { db } from "@/db/client.ts";
import { modpacksTable } from "@/db/schema.ts";
import { eq } from "drizzle-orm";
import { NotFoundError } from "@/lib/errors/index.ts";
import {
    createModpack,
    getModpacksByCreator,
    getModpackById,
    updateModpack,
    deleteModpack,
} from "@/services/modpack.service.ts";
import {
    createVersion,
    getVersions,
    getVersion,
    updateVersion,
    deleteVersion,
    publishVersion,
    archiveVersion,
    getUploadUrl,
    confirmUpload,
    getPreviousFiles,
    reuseFiles,
    updateFileSide,
    deleteFileFromVersion,
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

app.post("/", requireAuth, requireCreatorRole(CreatorRole.OWNER, CreatorRole.ADMIN), async (c) => {
    const userId = c.get("userId");
    const creatorId = c.req.param("creatorId")!;
    const body = await c.req.parseBody();
    const modpack = await createModpack(creatorId, userId, {
        name: (body.name as string) ?? "",
        shortDescription: (body.shortDescription as string) ?? "",
        description: body.description as string | undefined,
        visibility: body.visibility as any,
    });
    return c.json(modpack, 201);
});

app.get("/:modpackId", requireAuth, requireCreatorAccess, requireModpackAccess, async (c) => {
    const modpackId = c.req.param("modpackId")!;
    const modpack = await getModpackById(modpackId);
    return c.json(modpack);
});

app.patch("/:modpackId", requireAuth, requireCreatorRole(CreatorRole.OWNER, CreatorRole.ADMIN), requireModpackAccess, async (c) => {
    const modpackId = c.req.param("modpackId")!;
    const body = await c.req.parseBody();
    const data: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(body)) {
        if (typeof val === "string") data[key] = val;
    }
    const modpack = await updateModpack(modpackId, data as any);
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

app.delete("/:modpackId/versions/:versionId", requireAuth, requireCreatorRole(CreatorRole.OWNER, CreatorRole.ADMIN), requireModpackAccess, async (c) => {
    const versionId = c.req.param("versionId")!;
    const version = await deleteVersion(versionId);
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
