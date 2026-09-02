import { Hono } from "@hono/hono";
import { requireAuth, requireAdmin } from "@/auth/middleware.ts";
import adminUsersRouter from "@/v1/admin/users.routes.ts";
import adminBansRouter from "@/v1/admin/bans.routes.ts";
import adminCategoriesRouter from "@/v1/admin/categories.routes.ts";

const adminRoutes = new Hono();

adminRoutes.route("/users", adminUsersRouter);
adminRoutes.route("/bans", adminBansRouter);
adminRoutes.route("/categories", adminCategoriesRouter);

export default adminRoutes;
