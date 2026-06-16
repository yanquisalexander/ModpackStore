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
} from "@/services/whitelist.service.ts";

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
    return c.json({ data: entry }, 201);
});

// Bulk add users
app.post("/:modpackId/bulk", requireAuth, requireModpackAccess, async (c) => {
    const modpackId = c.req.param("modpackId")!;
    const userId = c.get("userId");
    const body = await c.req.json();
    const result = await bulkAddToWhitelist(modpackId, body.userIds, userId, body.notes);
    return c.json({ data: result });
});

// Remove user from whitelist
app.delete("/:modpackId/user/:userId", requireAuth, requireModpackAccess, async (c) => {
    const modpackId = c.req.param("modpackId")!;
    const targetUserId = c.req.param("userId")!;
    await removeFromWhitelist(modpackId, targetUserId);
    return c.body(null, 204);
});

// Clear whitelist
app.delete("/:modpackId/clear", requireAuth, requireModpackAccess, async (c) => {
    const modpackId = c.req.param("modpackId")!;
    const removedCount = await clearWhitelist(modpackId);
    return c.json({ data: { removedCount } });
});

// Export whitelist
app.get("/:modpackId/export", requireAuth, requireModpackAccess, async (c) => {
    const modpackId = c.req.param("modpackId")!;
    const data = await exportWhitelist(modpackId);
    return c.json({ data });
});

export default app;
