import { Hono } from "@hono/hono";
import type { Context } from "@hono/hono";
import { requireAuth, requireAdmin } from "@/auth/middleware.ts";
import * as userService from "@/services/admin-users.service.ts";

const app = new Hono();

app.get("/", requireAuth, requireAdmin, async (c: Context) => {
    const { page, limit, search, role, sortBy, sortOrder } = c.req.query();

    const result = await userService.getAllUsers({
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 20,
        search,
        role,
        sortBy,
        sortOrder,
    });

    return c.json(result);
});

app.post("/", requireAuth, requireAdmin, async (c: Context) => {
    const body = await c.req.json<{
        username?: string;
        email?: string;
        role?: string;
        avatarUrl?: string;
    }>();

    if (!body.username?.trim()) {
        return c.json({ error: "Username is required", code: "MISSING_USERNAME" }, 400);
    }
    if (!body.email?.trim()) {
        return c.json({ error: "Email is required", code: "MISSING_EMAIL" }, 400);
    }

    const user = await userService.createUser({
        username: body.username,
        email: body.email,
        role: body.role,
        avatarUrl: body.avatarUrl,
    });

    return c.json({ data: user }, 201);
});

app.get("/stats", requireAuth, requireAdmin, async (c: Context) => {
    const stats = await userService.getUserStats();
    return c.json(stats);
});

app.get("/:userId", requireAuth, requireAdmin, async (c: Context) => {
    const user = await userService.getUserById(c.req.param("userId")!);
    if (!user) {
        return c.json({ error: "User not found", code: "USER_NOT_FOUND" }, 404);
    }
    return c.json({ data: user });
});

app.patch("/:userId", requireAuth, requireAdmin, async (c: Context) => {
    const body = await c.req.json<{
        username?: string;
        email?: string;
        role?: string;
        avatarUrl?: string;
    }>();

    const user = await userService.updateUser(c.req.param("userId")!, body);
    return c.json({ data: user });
});

app.delete("/:userId", requireAuth, requireAdmin, async (c: Context) => {
    const userId = c.req.param("userId")!;

    const currentUser = c.get("user") as { id: string };
    if (userId === currentUser.id) {
        return c.json({ error: "Cannot delete your own account", code: "SELF_DELETE" }, 400);
    }

    await userService.deleteUser(userId);
    return c.json({ success: true });
});

export default app;
