import { requireAuth } from "@/middlewares/auth.middleware";
import { Hono } from "hono";

export const CreatorsRoute = new Hono()

CreatorsRoute.use(requireAuth, async (c, next) => {

    return await next()
})
