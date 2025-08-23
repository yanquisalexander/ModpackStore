import { AuthVariables, requireAuth, requireCreatorAccess, USER_CONTEXT_KEY } from "@/middlewares/auth.middleware";
import { Publisher } from "@/models/Publisher.model";
import { User } from "@/models/User.model";
import { Context, Hono } from "hono";

export const CreatorsRoute = new Hono()

// Mini middleware to check if the user is a creator
CreatorsRoute.use(requireAuth, requireCreatorAccess, async (c, next) => {
    return await next()
})

CreatorsRoute.get("/teams", async (c: Context<{ Variables: AuthVariables }>) => {
    const user = c.get(USER_CONTEXT_KEY) as User;
    const userTeams = await user.getTeams();

    return c.json({
        teams: userTeams
    })
})

CreatorsRoute.get("/teams/:orgId/modpacks", async (c: Context<{ Variables: AuthVariables }>) => {
    const user = c.get(USER_CONTEXT_KEY) as User;
    const { orgId } = c.req.param();

    const userTeams = await user.getTeams();
    const isMember = userTeams.some(team => team.id === orgId);

    if (!isMember) {
        return c.json({ message: "Forbidden" });
    }

    const publisher = await Publisher.findById(orgId);

    if (!publisher) {
        return c.json({ message: "Publisher not found" });
    }

    const modpacks = await publisher.getModpacks();
    return c.json({ modpacks });
})