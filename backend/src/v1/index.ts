import { Hono } from "@hono/hono";
import authRoutes from "@/v1/auth.routes.ts";
import creatorRoutes from "@/v1/creators/index.ts";
import adminCreatorRoutes from "@/v1/admin/creators.routes.ts";
import exploreRoutes from "@/v1/explore/index.ts";

const v1Router = new Hono();

v1Router.route("/auth", authRoutes);
v1Router.route("/creators", creatorRoutes);
v1Router.route("/admin/creators", adminCreatorRoutes);
v1Router.route("/explore", exploreRoutes);

v1Router.get("/ping", (c) => c.body(null, 204));

export default v1Router;
