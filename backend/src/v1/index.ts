import { Hono } from "@hono/hono";
import authRoutes from "@/v1/auth.routes.ts";
import creatorRoutes from "@/v1/creators/index.ts";
import adminCreatorRoutes from "@/v1/admin/creators.routes.ts";
import adminRoutes from "@/v1/admin/index.ts";
import exploreRoutes from "@/v1/explore/index.ts";
import purchaseRoutes from "@/v1/explore/purchase.routes.ts";
import whitelistRoutes from "@/v1/creators/whitelist.routes.ts";
import whitelistAccessRoutes from "@/v1/whitelist-access.routes.ts";
import categoriesRoutes from "@/v1/categories.routes.ts";

const v1Router = new Hono();

v1Router.route("/auth", authRoutes);
v1Router.route("/creators", creatorRoutes);
v1Router.route("/admin/creators", adminCreatorRoutes);
v1Router.route("/admin", adminRoutes);
v1Router.route("/explore", exploreRoutes);
v1Router.route("/explore", purchaseRoutes);
v1Router.route("/creators/whitelist", whitelistRoutes);
v1Router.route("/whitelist-access", whitelistAccessRoutes);
v1Router.route("/categories", categoriesRoutes);

v1Router.get("/ping", (c) => c.body(null, 204));

export default v1Router;
