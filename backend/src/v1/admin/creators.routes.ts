import { Hono } from "@hono/hono";
import type { Context } from "@hono/hono";
import { requireAuth, requireAdmin } from "@/auth/middleware.ts";
import { getPendingCreators, approveCreator, rejectCreator } from "@/services/creator-admin.service.ts";

const app = new Hono();

app.get("/pending", requireAuth, requireAdmin, async (c: Context) => {
    const creators = await getPendingCreators();
    return c.json(creators);
});

app.patch("/:creatorId/approve", requireAuth, requireAdmin, async (c: Context) => {
    const creator = await approveCreator(c.req.param("creatorId")!);
    return c.json(creator);
});

app.patch("/:creatorId/reject", requireAuth, requireAdmin, async (c: Context) => {
    const creator = await rejectCreator(c.req.param("creatorId")!);
    return c.json(creator);
});

export default app;
