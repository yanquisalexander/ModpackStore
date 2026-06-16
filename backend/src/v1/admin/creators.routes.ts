import { Hono } from "@hono/hono";
import type { Context } from "@hono/hono";
import { requireAuth, requireAdmin } from "@/auth/middleware.ts";
import * as adminService from "@/services/creator-admin.service.ts";
import { CreatorRole } from "@/db/schema.ts";

const app = new Hono();

// ── Pending creators ──────────────────────────────

app.get("/pending", requireAuth, requireAdmin, async (c: Context) => {
    const creators = await adminService.getPendingCreators();
    return c.json({ data: creators });
});

app.patch("/:creatorId/approve", requireAuth, requireAdmin, async (c: Context) => {
    const creator = await adminService.approveCreator(c.req.param("creatorId")!);
    return c.json({ data: creator });
});

app.patch("/:creatorId/reject", requireAuth, requireAdmin, async (c: Context) => {
    const creator = await adminService.rejectCreator(c.req.param("creatorId")!);
    return c.json({ data: creator });
});

// ── List creators (paginated) ─────────────────────

app.get("/", requireAuth, requireAdmin, async (c: Context) => {
    const { page, limit, search, verified, partnered, status, banned, sortBy, sortOrder } = c.req.query();

    const result = await adminService.listCreators({
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 20,
        search,
        verified: verified !== undefined ? verified === "true" : undefined,
        partnered: partnered !== undefined ? partnered === "true" : undefined,
        status,
        banned: banned !== undefined ? banned === "true" : undefined,
        sortBy,
        sortOrder,
    });

    return c.json(result);
});

// ── Get single creator ────────────────────────────

app.get("/:creatorId", requireAuth, requireAdmin, async (c: Context) => {
    const creator = await adminService.getCreatorDetail(c.req.param("creatorId")!);
    return c.json({ data: creator });
});

// ── Create creator ────────────────────────────────

app.post("/", requireAuth, requireAdmin, async (c: Context) => {
    const body = await c.req.json<{
        displayName?: string;
        description?: string;
        bannerUrl?: string;
        logoUrl?: string;
        discordUrl?: string;
    }>();

    if (!body.displayName?.trim()) {
        return c.json({ error: "Display name is required", code: "MISSING_DISPLAY_NAME" }, 400);
    }

    const creator = await adminService.createCreatorAdmin({
        displayName: body.displayName,
        description: body.description,
        bannerUrl: body.bannerUrl,
        logoUrl: body.logoUrl,
        discordUrl: body.discordUrl,
    });

    return c.json({ data: creator }, 201);
});

// ── Update creator ────────────────────────────────

app.patch("/:creatorId", requireAuth, requireAdmin, async (c: Context) => {
    const body = await c.req.json<{
        displayName?: string;
        description?: string | null;
        bannerUrl?: string | null;
        logoUrl?: string | null;
        discordUrl?: string | null;
        status?: string;
        verified?: boolean;
        partner?: boolean;
        hostingPartner?: boolean;
        banned?: boolean;
    }>();

    const creator = await adminService.updateCreatorAdmin(c.req.param("creatorId")!, body);
    return c.json({ data: creator });
});

// ── Delete creator (soft-delete) ──────────────────

app.delete("/:creatorId", requireAuth, requireAdmin, async (c: Context) => {
    await adminService.deleteCreatorAdmin(c.req.param("creatorId")!);
    return c.json({ success: true });
});

// ── Members ───────────────────────────────────────

app.get("/:creatorId/members", requireAuth, requireAdmin, async (c: Context) => {
    const members = await adminService.getCreatorMembers(c.req.param("creatorId")!);
    return c.json({ data: members });
});

app.post("/:creatorId/members", requireAuth, requireAdmin, async (c: Context) => {
    const { userId, role } = await c.req.json<{ userId: string; role: string }>();

    if (!userId) {
        return c.json({ error: "userId is required", code: "MISSING_USER_ID" }, 400);
    }

    const validRole = Object.values(CreatorRole).includes(role as CreatorRole) ? role as CreatorRole : CreatorRole.MEMBER;

    const membership = await adminService.addMember(c.req.param("creatorId")!, userId, validRole);
    return c.json({ data: membership }, 201);
});

app.patch("/:creatorId/members/:userId", requireAuth, requireAdmin, async (c: Context) => {
    const { role } = await c.req.json<{ role: string }>();
    const creatorId = c.req.param("creatorId")!;
    const targetUserId = c.req.param("userId")!;

    const validRole = Object.values(CreatorRole).includes(role as CreatorRole) ? role as CreatorRole : CreatorRole.MEMBER;

    const membership = await adminService.updateMemberRole(creatorId, targetUserId, validRole);
    return c.json({ data: membership });
});

app.delete("/:creatorId/members/:userId", requireAuth, requireAdmin, async (c: Context) => {
    const creatorId = c.req.param("creatorId")!;
    const targetUserId = c.req.param("userId")!;

    await adminService.removeMember(creatorId, targetUserId);
    return c.json({ success: true });
});

export default app;
