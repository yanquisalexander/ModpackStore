import { Hono } from "@hono/hono";
import type { Context } from "@hono/hono";
import { requireAuth, optionalAuth, type AuthVariables } from "@/auth/middleware.ts";
import { hasAccess, getUserWhitelistedModpacks } from "@/services/whitelist.service.ts";
import { db } from "@/db/client.ts";
import { modpackWhitelistsTable } from "@/db/schema.ts";
import { eq, count } from "drizzle-orm";

const app = new Hono<{ Variables: AuthVariables }>();

// Check if user has access to a specific modpack
app.get("/modpack/:modpackId", optionalAuth, async (c) => {
    const modpackId = c.req.param("modpackId")!;
    const userId = c.get("userId");
    const userHasAccess = await hasAccess(modpackId, userId);
    return c.json({ data: { hasAccess: userHasAccess, modpackId, userId: userId ?? null } });
});

// Get all modpacks the authenticated user has whitelist access to
app.get("/my-whitelists", requireAuth, async (c) => {
    const userId = c.get("userId");
    const modpacks = await getUserWhitelistedModpacks(userId);
    return c.json({ data: modpacks });
});

// Check if user has any whitelist entries
app.get("/has-any", requireAuth, async (c) => {
    const userId = c.get("userId");
    const [result] = await db.select({ value: count() })
        .from(modpackWhitelistsTable)
        .where(eq(modpackWhitelistsTable.userId, userId));

    const total = Number(result?.value ?? 0);
    return c.json({ data: { hasWhitelists: total > 0, count: total } });
});

export default app;
