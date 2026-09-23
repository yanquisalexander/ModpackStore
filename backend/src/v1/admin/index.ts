import { Hono } from "@hono/hono";
import { requireAuth, requireAdmin } from "@/auth/middleware.ts";
import adminUsersRouter from "@/v1/admin/users.routes.ts";
import adminBansRouter from "@/v1/admin/bans.routes.ts";
import adminCategoriesRouter from "@/v1/admin/categories.routes.ts";
import adminAdsRoutes from "@/v1/admin/ads.routes.ts";
import adminBackupRoutes from "@/v1/admin/backup.routes.ts";
import adminTosRoutes from "@/v1/admin/tos.routes.ts";

const adminRoutes = new Hono();

adminRoutes.route("/users", adminUsersRouter);
adminRoutes.route("/bans", adminBansRouter);
adminRoutes.route("/categories", adminCategoriesRouter);
adminRoutes.route("/ads", adminAdsRoutes);
adminRoutes.route("/backup", adminBackupRoutes);
adminRoutes.route("/settings", adminTosRoutes);

export default adminRoutes;
