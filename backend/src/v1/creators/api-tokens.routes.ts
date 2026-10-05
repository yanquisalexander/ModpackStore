import { Hono } from "@hono/hono";
import { requireAuth, type AuthVariables } from "@/auth/middleware.ts";
import { requireCreatorAccess, requireCreatorRole } from "@/middlewares/creator.middleware.ts";
import { CreatorRole } from "@/db/schema.ts";
import { creatorTokenService } from "@/services/creator-token.service.ts";
import { apiTokenService } from "@/auth/api-token.ts";
import { auditContextFromRequest, logCreatorEventAsync } from "@/services/creator-audit.service.ts";

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
    const creatorId = c.req.param("creatorId")!;
    const result = await creatorTokenService.create(
        creatorId,
        c.get("userId"),
        {
            name: body.name,
            scopes: body.scopes,
            expiresAt: body.expiresAt ?? null,
            modpackIds: body.modpackIds ?? null,
        },
    );
    logCreatorEventAsync({
        ...auditContextFromRequest(c, creatorId, {
            action: "api_token.created",
            entityType: "api_token",
            entityId: (result as { id: string }).id,
            details: {
                name: body.name,
                prefix: (result as { prefix: string }).prefix,
                scopes: body.scopes,
            },
        }),
        action: "api_token.created",
    });
    return c.json({ data: result }, 201);
});

// ── Revoke token (soft revoke, keeps audit trail) ──
app.delete("/:tokenId", requireAuth, requireCreatorRole(CreatorRole.OWNER, CreatorRole.ADMIN), async (c) => {
    const creatorId = c.req.param("creatorId")!;
    const tokenId = c.req.param("tokenId")!;
    const result = await creatorTokenService.revoke(creatorId, tokenId);
    logCreatorEventAsync({
        ...auditContextFromRequest(c, creatorId, {
            action: "api_token.revoked",
            entityType: "api_token",
            entityId: tokenId,
        }),
        action: "api_token.revoked",
    });
    return c.json({ data: result });
});

export default app;
