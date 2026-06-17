import { Hono } from "@hono/hono";
import { requireAuth, requireAdmin } from "@/auth/middleware.ts";
import adminUsersRouter from "@/v1/admin/users.routes.ts";
import adminBansRouter from "@/v1/admin/bans.routes.ts";

const adminRoutes = new Hono();

adminRoutes.route("/users", adminUsersRouter);
adminRoutes.route("/bans", adminBansRouter);

export default adminRoutes;
