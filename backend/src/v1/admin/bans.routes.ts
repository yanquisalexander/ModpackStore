import { Hono } from "@hono/hono";
import type { Context } from "@hono/hono";
import { requireAuth, requireAdmin } from "@/auth/middleware.ts";
import * as banService from "@/services/admin-bans.service.ts";

const app = new Hono();

app.get("/", requireAuth, requireAdmin, async (c: Context) => {
    const includeInactive = c.req.query("includeInactive") === "true";
    const bans = await banService.getAllBans(includeInactive);
    return c.json({ data: bans });
});

app.post("/", requireAuth, requireAdmin, async (c: Context) => {
    const body = await c.req.json<{ userId?: string; reason?: string }>();

    if (!body.userId) {
        return c.json({ error: "userId is required", code: "MISSING_USER_ID" }, 400);
    }

    const currentUser = c.get("user") as { id: string };

    const ban = await banService.banUser({
        userId: body.userId,
        adminId: currentUser.id,
        reason: body.reason,
    });

    return c.json({
        success: true,
        ban: {
            id: ban.id,
            userId: ban.userId,
            adminId: ban.adminId,
            reason: ban.reason,
            banDate: ban.createdAt,
        },
    }, 201);
});

app.delete("/:userId", requireAuth, requireAdmin, async (c: Context) => {
    const currentUser = c.get("user") as { id: string };
    await banService.unbanUser(c.req.param("userId")!, currentUser.id);
    return c.json({ success: true });
});

app.get("/user/:userId/history", requireAuth, requireAdmin, async (c: Context) => {
    const history = await banService.getUserBanHistory(c.req.param("userId")!);
    return c.json({ history });
});

app.get("/user/:userId/status", requireAuth, requireAdmin, async (c: Context) => {
    const status = await banService.checkUserBanStatus(c.req.param("userId")!);
    return c.json(status);
});

export default app;
