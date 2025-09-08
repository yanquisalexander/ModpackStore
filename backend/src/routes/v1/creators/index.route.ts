import { AuthVariables, requireAuth, requireCreatorAccess, USER_CONTEXT_KEY } from "@/middlewares/auth.middleware";
import { Publisher } from "@/models/Publisher.model";
import { Context, Hono } from "hono";
import { ModpackCreatorsRoute } from "./modpacks.route";
import { WithdrawalsRoute } from "./withdrawals.route";
import { User } from "@/entities/User";

export const CreatorsRoute = new Hono()

// Mini middleware to check if the user is a creator
CreatorsRoute.use(requireAuth, requireCreatorAccess, async (c, next) => {
    return await next()
})

CreatorsRoute.get("/publishers", async (c: Context<{ Variables: AuthVariables }>) => {
    const user = c.get(USER_CONTEXT_KEY) as User;
    const publishers = await user.getPublishers();

    return c.json({
        teams: publishers
    })
})


CreatorsRoute.route('/', ModpackCreatorsRoute)
CreatorsRoute.route('/', WithdrawalsRoute)