import { Hono } from "@hono/hono";
import authRoutes from "@/v1/auth.routes.ts";

const v1Router = new Hono();

v1Router.route("/auth", authRoutes);

v1Router.get("/ping", (c) => c.body(null, 204));

export default v1Router;
