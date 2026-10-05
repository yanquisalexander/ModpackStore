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
import { captureAuditRequestContext, logCreatorEvent, resolveUsernameForAudit } from "@/services/creator-audit.service.ts";
import type { CreatorAuditAction } from "@/services/creator-audit.service.ts";

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

// Helper: resolve audit scope + display snapshot (whitelist routes are modpack-scoped).
// Reutiliza una única PK lookup; el nombre es un snapshot para no necesitar JOINs en lectura.
async function getModpackAuditInfo(modpackId: string): Promise<{ creatorId: string; modpackName: string } | null> {
    const [row] = await db.select({ creatorId: modpacksTable.creatorId, name: modpacksTable.name })
        .from(modpacksTable)
        .where(eq(modpacksTable.id, modpackId))
        .limit(1);
    if (!row) return null;
    return { creatorId: row.creatorId, modpackName: row.name };
}

/**
 * Escritura de auditoría en background: el snapshot del request (actor, IP,
 * UA) se captura AQUÍ, en síncrono con el request abierto — leer headers
 * después de responder lanza `TypeError: Request closed`. Solo las queries
 * de BBDD (nombres + INSERT) se difieren. Cero latencia en la respuesta.
 */
function logWhitelistEvent(c: Context<{ Variables: AuthVariables }>, modpackId: string, action: CreatorAuditAction, entityId: string, extraDetails: Record<string, unknown>, targetUserId?: string | null, knownUsername?: string | null): void {
    const reqCtx = captureAuditRequestContext(c);
    void (async () => {
        const info = await getModpackAuditInfo(modpackId);
        if (!info) return;
        const targetUsername = targetUserId
            ? (knownUsername ?? await resolveUsernameForAudit(targetUserId))
            : undefined;
        await logCreatorEvent({
            creatorId: info.creatorId,
            ...reqCtx,
            action,
            entityType: "whitelist",
            entityId,
            details: {
                ...extraDetails,
                modpackId,
                modpackName: info.modpackName,
                ...(targetUsername !== undefined ? { targetUsername } : {}),
            },
        });
    })();
}

// Add user to whitelist
app.post("/:modpackId", requireAuth, requireModpackAccess, async (c) => {
    const modpackId = c.req.param("modpackId")!;
    const currentUserId = c.get("userId");
    const body = await c.req.json();

    let targetUserId = body.userId;
    let targetUsername: string | null = null;
    if (!targetUserId && body.discordUsername) {
        const [user] = await db.select({ id: users.id, username: users.username })
            .from(users)
            .where(eq(users.username, body.discordUsername))
            .limit(1);
        if (!user) throw new NotFoundError("User not found", "USER_NOT_FOUND");
        targetUserId = user.id;
        targetUsername = user.username;
    }

    if (!targetUserId) throw new ValidationError("userId or discordUsername is required", "MISSING_USER");

    const entry = await addToWhitelist(modpackId, targetUserId, currentUserId, body.notes);
    logWhitelistEvent(c, modpackId, "whitelist.added", targetUserId, {}, targetUserId, targetUsername);
    return c.json({ data: entry }, 201);
});

// Bulk add users
app.post("/:modpackId/bulk", requireAuth, requireModpackAccess, async (c) => {
    const modpackId = c.req.param("modpackId")!;
    const userId = c.get("userId");
    const body = await c.req.json();
    const result = await bulkAddToWhitelist(modpackId, body.userIds, userId, body.notes);
    logWhitelistEvent(c, modpackId, "whitelist.bulk_added", modpackId, { count: (body.userIds ?? []).length });
    return c.json({ data: result });
});

// Remove user from whitelist
app.delete("/:modpackId/user/:userId", requireAuth, requireModpackAccess, async (c) => {
    const modpackId = c.req.param("modpackId")!;
    const targetUserId = c.req.param("userId")!;
    await removeFromWhitelist(modpackId, targetUserId);
    logWhitelistEvent(c, modpackId, "whitelist.removed", targetUserId, {}, targetUserId);
    return c.body(null, 204);
});

// Clear whitelist
app.delete("/:modpackId/clear", requireAuth, requireModpackAccess, async (c) => {
    const modpackId = c.req.param("modpackId")!;
    const removedCount = await clearWhitelist(modpackId);
    logWhitelistEvent(c, modpackId, "whitelist.cleared", modpackId, { removedCount });
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
    logWhitelistEvent(c, modpackId, "whitelist.settings.updated", modpackId, { enforceIngame: body.enforceIngame ?? null });
    return c.json({ data: updated });
});

export default app;
