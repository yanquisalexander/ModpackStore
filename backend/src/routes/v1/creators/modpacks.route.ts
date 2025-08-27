import { isOrganizationMember, requireAuth, requireCreatorAccess } from "@/middlewares/auth.middleware";
import { Modpack } from "@/models/Modpack.model";
import { Hono } from "hono";

export const ModpackCreatorsRoute = new Hono();



ModpackCreatorsRoute.use(requireAuth, requireCreatorAccess, isOrganizationMember, async (c, next) => {
    return await next()
})

ModpackCreatorsRoute.get("/teams/:teamId/modpacks", async (c) => {
    const { teamId } = c.req.param();

    const modpacks = await Modpack.findByPublisher(teamId);
    return c.json({ modpacks });
});
