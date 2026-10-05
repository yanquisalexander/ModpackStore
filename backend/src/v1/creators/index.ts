import { Hono } from "@hono/hono";
import type { Context } from "@hono/hono";
import { requireAuth, type AuthVariables } from "@/auth/middleware.ts";
import { requireCreatorAccess, requireCreatorRole } from "@/middlewares/creator.middleware.ts";
import { requireCaptcha } from "@/middlewares/requireCaptcha.ts";
import {
    createCreator,
    getCreatorsByUser,
    getCreatorById,
    updateCreator,
    getCreatorMembers,
    addMember,
    updateMemberRole,
    removeMember,
    getCreatorProfile,
    updateCreatorProfile,
    getPublicCreatorProfile,
    uploadCreatorImage,
} from "@/services/creator.service.ts";
import { CreatorRole } from "@/db/schema.ts";
import { getMemberPermissions, setMemberPermission } from "@/services/permission.service.ts";
import { auditContextFromRequest, logCreatorEventAsync } from "@/services/creator-audit.service.ts";
import modpackRoutes from "./modpacks.routes.ts";
import apiTokenRoutes from "./api-tokens.routes.ts";
import storageRoutes from "./storage.routes.ts";
import creatorAdsRoutes from "./ads.routes.ts";
import auditRoutes from "./audit.routes.ts";

const app = new Hono();
app.route("/:creatorId/modpacks", modpackRoutes);
app.route("/:creatorId/api-tokens", apiTokenRoutes);
app.route("/:creatorId/ads", creatorAdsRoutes);
app.route("/:creatorId/audit-logs", auditRoutes);
app.route("/", storageRoutes);

// ── Creator CRUD ──────────────────────────────────

app.post("/", requireAuth, requireCaptcha, async (c: Context<{ Variables: AuthVariables }>) => {
    const userId = c.get("userId");
    const body = await c.req.json();
    const creator = await createCreator(userId, body);
    return c.json(creator, 201);
});

app.get("/", requireAuth, async (c: Context<{ Variables: AuthVariables }>) => {
    const userId = c.get("userId");
    const creators = await getCreatorsByUser(userId);
    return c.json(creators);
});

app.get("/:creatorId", requireAuth, async (c: Context<{ Variables: AuthVariables }>) => {
    const userId = c.get("userId");
    const creator = await getCreatorById(c.req.param("creatorId")!, userId);
    return c.json(creator);
});

app.patch(
    "/:creatorId",
    requireAuth,
    requireCreatorRole(CreatorRole.OWNER, CreatorRole.ADMIN),
    async (c: Context<{ Variables: AuthVariables }>) => {
        const body = await c.req.json();
        const creatorId = c.req.param("creatorId")!;
        const creator = await updateCreator(creatorId, body);
        logCreatorEventAsync({
            ...auditContextFromRequest(c, creatorId, {
                action: "creator.updated",
                entityType: "creator",
                entityId: creatorId,
                details: { updated: Object.keys(body ?? {}) },
            }),
            action: "creator.updated",
        });
        return c.json(creator);
    },
);

// ── Profile ───────────────────────────────────────

app.get(
    "/:creatorId/profile",
    requireAuth,
    requireCreatorAccess,
    async (c: Context<{ Variables: AuthVariables }>) => {
        const profile = await getCreatorProfile(c.req.param("creatorId")!);
        return c.json({ data: profile });
    },
);

app.put(
    "/:creatorId/profile",
    requireAuth,
    requireCreatorRole(CreatorRole.OWNER, CreatorRole.ADMIN),
    async (c: Context<{ Variables: AuthVariables }>) => {
        const body = await c.req.json();
        const creatorId = c.req.param("creatorId")!;
        const profile = await updateCreatorProfile(creatorId, body);
        logCreatorEventAsync({
            ...auditContextFromRequest(c, creatorId, {
                action: "creator.profile.updated",
                entityType: "creator",
                entityId: creatorId,
            }),
            action: "creator.profile.updated",
        });
        return c.json({ data: profile });
    },
);

app.post(
    "/:creatorId/upload/:type",
    requireAuth,
    requireCreatorRole(CreatorRole.OWNER, CreatorRole.ADMIN),
    async (c: Context<{ Variables: AuthVariables }>) => {
        const body = await c.req.parseBody();
        const file = body.file as File;
        if (!file) {
            return c.json({ errors: [{ status: "400", title: "Bad Request", detail: "File is required." }] }, 400);
        }
        const type = c.req.param("type") as 'logo' | 'banner';
        if (type !== 'logo' && type !== 'banner') {
            return c.json({ errors: [{ status: "400", title: "Bad Request", detail: "Type must be 'logo' or 'banner'." }] }, 400);
        }
        const creatorId = c.req.param("creatorId")!;
        const url = await uploadCreatorImage(creatorId, type, file);
        await updateCreator(creatorId, type === 'logo' ? { logoUrl: url } : { bannerUrl: url });
        logCreatorEventAsync({
            ...auditContextFromRequest(c, creatorId, {
                action: "creator.image.uploaded",
                entityType: "creator",
                entityId: creatorId,
                details: { type },
            }),
            action: "creator.image.uploaded",
        });
        return c.json({ data: { url } });
    },
);

// ── Public Profile (by slug) ──────────────────────

app.get("/slug/:slug", async (c) => {
    const profile = await getPublicCreatorProfile(c.req.param("slug")!);
    return c.json({ data: profile });
});

// ── Members ───────────────────────────────────────

app.get(
    "/:creatorId/members",
    requireAuth,
    requireCreatorAccess,
    async (c: Context<{ Variables: AuthVariables }>) => {
        const members = await getCreatorMembers(c.req.param("creatorId")!);
        return c.json(members);
    },
);

app.post(
    "/:creatorId/members",
    requireAuth,
    requireCreatorRole(CreatorRole.OWNER, CreatorRole.ADMIN),
    async (c: Context<{ Variables: AuthVariables }>) => {
        const { userId, role } = await c.req.json();
        const creatorId = c.req.param("creatorId")!;
        const membership = await addMember(creatorId, userId, role ?? CreatorRole.MEMBER);
        logCreatorEventAsync({
            ...auditContextFromRequest(c, creatorId, {
                action: "member.added",
                entityType: "member",
                entityId: userId,
                details: { role: role ?? CreatorRole.MEMBER },
            }),
            action: "member.added",
        });
        return c.json(membership, 201);
    },
);

app.patch(
    "/:creatorId/members/:userId",
    requireAuth,
    requireCreatorRole(CreatorRole.OWNER, CreatorRole.ADMIN),
    async (c: Context<{ Variables: AuthVariables }>) => {
        const { role } = await c.req.json();
        const creatorId = c.req.param("creatorId")!;
        const targetUserId = c.req.param("userId")!;
        const membership = await updateMemberRole(creatorId, targetUserId, role);
        logCreatorEventAsync({
            ...auditContextFromRequest(c, creatorId, {
                action: "member.role.updated",
                entityType: "member",
                entityId: targetUserId,
                details: { role },
            }),
            action: "member.role.updated",
        });
        return c.json(membership);
    },
);

app.delete(
    "/:creatorId/members/:userId",
    requireAuth,
    requireCreatorRole(CreatorRole.OWNER, CreatorRole.ADMIN),
    async (c: Context<{ Variables: AuthVariables }>) => {
        const creatorId = c.req.param("creatorId")!;
        const targetUserId = c.req.param("userId")!;
        await removeMember(creatorId, targetUserId);
        logCreatorEventAsync({
            ...auditContextFromRequest(c, creatorId, {
                action: "member.removed",
                entityType: "member",
                entityId: targetUserId,
            }),
            action: "member.removed",
        });
        return c.body(null, 204);
    },
);

// ── Permissions ────────────────────────────────────

app.get(
    "/:creatorId/members/:userId/permissions",
    requireAuth,
    requireCreatorAccess,
    async (c: Context<{ Variables: AuthVariables }>) => {
        const scopes = await getMemberPermissions(
            c.req.param("creatorId")!,
            c.req.param("userId")!,
        );
        return c.json({ data: scopes });
    },
);

app.post(
    "/:creatorId/permissions",
    requireAuth,
    requireCreatorRole(CreatorRole.OWNER, CreatorRole.ADMIN),
    async (c: Context<{ Variables: AuthVariables }>) => {
        const { userId, permission, enabled, modpackId } = await c.req.json();
        const creatorId = c.req.param("creatorId")!;
        const result = await setMemberPermission(
            creatorId,
            userId,
            permission,
            enabled,
            modpackId,
        );
        if (result.ok) {
            logCreatorEventAsync({
                ...auditContextFromRequest(c, creatorId, {
                    action: "permission.updated",
                    entityType: "permission",
                    entityId: userId,
                    details: { permission, enabled: !!enabled, modpackId: modpackId ?? null },
                }),
                action: "permission.updated",
            });
            return c.json({ data: { ok: true } });
        }
        return c.json({ errors: [{ status: "400", title: "Bad Request", detail: result.reason }] }, 400);
    },
);

export default app;
