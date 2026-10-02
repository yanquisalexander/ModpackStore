import { Hono } from "@hono/hono";
import { requireAuth, type AuthVariables } from "@/auth/middleware.ts";
import { requireCreatorAccess, requireCreatorRole } from "@/middlewares/creator.middleware.ts";
import { CreatorRole } from "@/db/schema.ts";
import { creatorTokenService } from "@/services/creator-token.service.ts";
import { apiTokenService } from "@/auth/api-token.ts";

const app = new Hono<{ Variables: AuthVariables }>();

// ── List tokens (metadata only, never secrets) ────
app.get("/", requireAuth, requireCreatorAccess, async (c) => {
    const tokens = await creatorTokenService.list(c.req.param("creatorId")!);
    return c.json({ data: tokens });
});

// ── Allowed scopes (for the UI form) ──────────────
app.get("/scopes", requireAuth, requireCreatorAccess, async (c) => {
    return c.json({ data: apiTokenService.allowedScopes() });
});

// ── Create token (full secret returned exactly once) ──
app.post("/", requireAuth, requireCreatorRole(CreatorRole.OWNER, CreatorRole.ADMIN), async (c) => {
    const body = await c.req.json();
    const result = await creatorTokenService.create(
        c.req.param("creatorId")!,
        c.get("userId"),
        {
            name: body.name,
            scopes: body.scopes,
            expiresAt: body.expiresAt ?? null,
            modpackIds: body.modpackIds ?? null,
        },
    );
    return c.json({ data: result }, 201);
});

// ── Revoke token (soft revoke, keeps audit trail) ──
app.delete("/:tokenId", requireAuth, requireCreatorRole(CreatorRole.OWNER, CreatorRole.ADMIN), async (c) => {
    const result = await creatorTokenService.revoke(
        c.req.param("creatorId")!,
        c.req.param("tokenId")!,
    );
    return c.json({ data: result });
});

export default app;
