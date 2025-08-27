import { AuthVariables, requireAuth, requireCreatorAccess, USER_CONTEXT_KEY } from "@/middlewares/auth.middleware";
import { Publisher } from "@/models/Publisher.model";
import { User } from "@/models/User.model";
import { Context, Hono } from "hono";
import { ModpackCreatorsRoute } from "./modpacks.route";

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


CreatorsRoute.route('/', ModpackCreatorsRoute)