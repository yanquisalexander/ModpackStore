import { requireAuth, requireCreatorAccess } from "@/middlewares/auth.middleware";
import { Hono } from "hono";

export const CreatorsRoute = new Hono()

// Mini middleware to check if the user is a creator
CreatorsRoute.use(requireAuth, requireCreatorAccess, async (c, next) => {
    return await next()
})

CreatorsRoute.get("/", async (c) => {
    return c.json({ message: "Hello from the creators route!" })
})