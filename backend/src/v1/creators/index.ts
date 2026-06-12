import { Hono } from "@hono/hono";
import type { Context } from "@hono/hono";
import { requireAuth, type AuthVariables } from "@/auth/middleware.ts";
import { requireCreatorAccess, requireCreatorRole } from "@/middlewares/creator.middleware.ts";
import {
    createCreator,
    getCreatorsByUser,
    getCreatorById,
    updateCreator,
    getCreatorMembers,
    addMember,
    updateMemberRole,
    removeMember,
} from "@/services/creator.service.ts";
import { CreatorRole } from "@/db/schema.ts";
import modpackRoutes from "./modpacks.routes.ts";

const app = new Hono();
app.route("/:creatorId/modpacks", modpackRoutes);

// ── Creator CRUD ──────────────────────────────────

app.post("/", requireAuth, async (c: Context<{ Variables: AuthVariables }>) => {
    const userId = c.get("userId");
    const body = await c.req.json();
    const creator = await createCreator(userId, body);
    return c.json(creator, 201);
});

app.get("/", requireAuth, async (c: Context<{ Variables: AuthVariables }>) => {
    const userId = c.get("userId");
    const creators = await getCreatorsByUser(userId);
    return c.json(creators);
});

app.get("/:creatorId", requireAuth, async (c: Context<{ Variables: AuthVariables }>) => {
    const userId = c.get("userId");
    const creator = await getCreatorById(c.req.param("creatorId")!, userId);
    return c.json(creator);
});

app.patch(
    "/:creatorId",
    requireAuth,
    requireCreatorRole(CreatorRole.OWNER, CreatorRole.ADMIN),
    async (c: Context<{ Variables: AuthVariables }>) => {
        const body = await c.req.json();
        const creator = await updateCreator(c.req.param("creatorId")!, body);
        return c.json(creator);
    },
);

// ── Members ───────────────────────────────────────

app.get(
    "/:creatorId/members",
    requireAuth,
    requireCreatorAccess,
    async (c: Context<{ Variables: AuthVariables }>) => {
        const members = await getCreatorMembers(c.req.param("creatorId")!);
        return c.json(members);
    },
);

app.post(
    "/:creatorId/members",
    requireAuth,
    requireCreatorRole(CreatorRole.OWNER, CreatorRole.ADMIN),
    async (c: Context<{ Variables: AuthVariables }>) => {
        const { userId, role } = await c.req.json();
        const membership = await addMember(c.req.param("creatorId")!, userId, role ?? CreatorRole.MEMBER);
        return c.json(membership, 201);
    },
);

app.patch(
    "/:creatorId/members/:userId",
    requireAuth,
    requireCreatorRole(CreatorRole.OWNER, CreatorRole.ADMIN),
    async (c: Context<{ Variables: AuthVariables }>) => {
        const { role } = await c.req.json();
        const membership = await updateMemberRole(c.req.param("creatorId")!, c.req.param("userId")!, role);
        return c.json(membership);
    },
);

app.delete(
    "/:creatorId/members/:userId",
    requireAuth,
    requireCreatorRole(CreatorRole.OWNER, CreatorRole.ADMIN),
    async (c: Context<{ Variables: AuthVariables }>) => {
        await removeMember(c.req.param("creatorId")!, c.req.param("userId")!);
        return c.body(null, 204);
    },
);

export default app;
