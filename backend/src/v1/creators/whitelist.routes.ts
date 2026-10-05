import { Hono } from "@hono/hono";
import type { Context } from "@hono/hono";
import { requireAuth, type AuthVariables } from "@/auth/middleware.ts";
import { db } from "@/db/client.ts";
import { modpacksTable, creatorUsersTable, users } from "@/db/schema.ts";
import { eq, and } from "drizzle-orm";
import { NotFoundError, ValidationError } from "@/lib/errors/index.ts";
import {
    addToWhitelist,
    removeFromWhitelist,
    getWhitelistedUsers,
    getWhitelistStats,
    bulkAddToWhitelist,
    clearWhitelist,
    exportWhitelist,
    getWhitelistIngameSettings,
    updateWhitelistIngameSettings,
} from "@/services/whitelist.service.ts";
import { auditContextFromRequest, logCreatorEventAsync } from "@/services/creator-audit.service.ts";

const app = new Hono<{ Variables: AuthVariables }>();

async function requireModpackAccess(c: Context, next: () => Promise<void>) {
    const modpackId = c.req.param("modpackId")!;
    const userId = c.get("userId");

    const [modpack] = await db.select({ creatorId: modpacksTable.creatorId })
        .from(modpacksTable)
        .where(eq(modpacksTable.id, modpackId))
        .limit(1);

    if (!modpack) throw new NotFoundError("Modpack not found", "MODPACK_NOT_FOUND");

    const memberships = await db.select()
        .from(creatorUsersTable)
        .where(and(
            eq(creatorUsersTable.userId, userId),
            eq(creatorUsersTable.creatorId, modpack.creatorId),
        ))
        .limit(1);

    if (memberships.length === 0) throw new NotFoundError("Modpack not found", "MODPACK_NOT_FOUND");

    await next();
}

// List whitelisted users
app.get("/:modpackId", requireAuth, requireModpackAccess, async (c) => {
    const modpackId = c.req.param("modpackId")!;
    const users = await getWhitelistedUsers(modpackId);
    return c.json({ data: users });
});

// Get whitelist stats
app.get("/:modpackId/stats", requireAuth, requireModpackAccess, async (c) => {
    const modpackId = c.req.param("modpackId")!;
    const stats = await getWhitelistStats(modpackId);
    return c.json({ data: stats });
});

// Helper: resolve creatorId for audit scope (whitelist routes are modpack-scoped)
async function getCreatorIdForModpack(modpackId: string): Promise<string | null> {
    const [row] = await db.select({ creatorId: modpacksTable.creatorId })
        .from(modpacksTable)
        .where(eq(modpacksTable.id, modpackId))
        .limit(1);
    return row?.creatorId ?? null;
}

// Add user to whitelist
app.post("/:modpackId", requireAuth, requireModpackAccess, async (c) => {
    const modpackId = c.req.param("modpackId")!;
    const currentUserId = c.get("userId");
    const body = await c.req.json();

    let targetUserId = body.userId;
    if (!targetUserId && body.discordUsername) {
        const [user] = await db.select({ id: users.id })
            .from(users)
            .where(eq(users.username, body.discordUsername))
            .limit(1);
        if (!user) throw new NotFoundError("User not found", "USER_NOT_FOUND");
        targetUserId = user.id;
    }

    if (!targetUserId) throw new ValidationError("userId or discordUsername is required", "MISSING_USER");

    const entry = await addToWhitelist(modpackId, targetUserId, currentUserId, body.notes);
    const creatorId = await getCreatorIdForModpack(modpackId);
    if (creatorId) {
        logCreatorEventAsync({
            ...auditContextFromRequest(c, creatorId, {
                action: "whitelist.added",
                entityType: "whitelist",
                entityId: targetUserId,
                details: { modpackId },
            }),
            action: "whitelist.added",
        });
    }
    return c.json({ data: entry }, 201);
});

// Bulk add users
app.post("/:modpackId/bulk", requireAuth, requireModpackAccess, async (c) => {
    const modpackId = c.req.param("modpackId")!;
    const userId = c.get("userId");
    const body = await c.req.json();
    const result = await bulkAddToWhitelist(modpackId, body.userIds, userId, body.notes);
    const creatorId = await getCreatorIdForModpack(modpackId);
    if (creatorId) {
        logCreatorEventAsync({
            ...auditContextFromRequest(c, creatorId, {
                action: "whitelist.bulk_added",
                entityType: "whitelist",
                entityId: modpackId,
                details: { modpackId, count: (body.userIds ?? []).length },
            }),
            action: "whitelist.bulk_added",
        });
    }
    return c.json({ data: result });
});

// Remove user from whitelist
app.delete("/:modpackId/user/:userId", requireAuth, requireModpackAccess, async (c) => {
    const modpackId = c.req.param("modpackId")!;
    const targetUserId = c.req.param("userId")!;
    await removeFromWhitelist(modpackId, targetUserId);
    const creatorId = await getCreatorIdForModpack(modpackId);
    if (creatorId) {
        logCreatorEventAsync({
            ...auditContextFromRequest(c, creatorId, {
                action: "whitelist.removed",
                entityType: "whitelist",
                entityId: targetUserId,
                details: { modpackId },
            }),
            action: "whitelist.removed",
        });
    }
    return c.body(null, 204);
});

// Clear whitelist
app.delete("/:modpackId/clear", requireAuth, requireModpackAccess, async (c) => {
    const modpackId = c.req.param("modpackId")!;
    const removedCount = await clearWhitelist(modpackId);
    const creatorId = await getCreatorIdForModpack(modpackId);
    if (creatorId) {
        logCreatorEventAsync({
            ...auditContextFromRequest(c, creatorId, {
                action: "whitelist.cleared",
                entityType: "whitelist",
                entityId: modpackId,
                details: { modpackId, removedCount },
            }),
            action: "whitelist.cleared",
        });
    }
    return c.json({ data: { removedCount } });
});

// Export whitelist
app.get("/:modpackId/export", requireAuth, requireModpackAccess, async (c) => {
    const modpackId = c.req.param("modpackId")!;
    const data = await exportWhitelist(modpackId);
    return c.json({ data });
});

// Get ingame (Yggdrasil) whitelist enforcement settings
app.get("/:modpackId/ingame-settings", requireAuth, requireModpackAccess, async (c) => {
    const modpackId = c.req.param("modpackId")!;
    const settings = await getWhitelistIngameSettings(modpackId);
    return c.json({
        data: {
            enforceIngame: settings.whitelistEnforceIngame,
            kickMessage: settings.whitelistKickMessage,
        },
    });
});

// Update ingame (Yggdrasil) whitelist enforcement settings
app.put("/:modpackId/ingame-settings", requireAuth, requireModpackAccess, async (c) => {
    const modpackId = c.req.param("modpackId")!;
    const body = await c.req.json();
    const updated = await updateWhitelistIngameSettings(modpackId, {
        enforceIngame: body.enforceIngame,
        kickMessage: body.kickMessage,
    });
    const creatorId = await getCreatorIdForModpack(modpackId);
    if (creatorId) {
        logCreatorEventAsync({
            ...auditContextFromRequest(c, creatorId, {
                action: "whitelist.settings.updated",
                entityType: "whitelist",
                entityId: modpackId,
                details: { modpackId, enforceIngame: body.enforceIngame ?? null },
            }),
            action: "whitelist.settings.updated",
        });
    }
    return c.json({ data: updated });
});

export default app;
