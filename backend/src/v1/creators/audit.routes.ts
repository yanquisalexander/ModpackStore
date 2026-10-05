import { Hono } from "@hono/hono";
import type { Context } from "@hono/hono";
import { requireAuth, type AuthVariables } from "@/auth/middleware.ts";
import { requireCreatorRole } from "@/middlewares/creator.middleware.ts";
import { CreatorRole } from "@/db/schema.ts";
import {
    getCreatorAuditLogs,
    CREATOR_AUDIT_ACTION_LIST,
} from "@/services/creator-audit.service.ts";

const app = new Hono<{ Variables: AuthVariables }>();

// ── List audit logs (OWNER/ADMIN only) ──────────────
// Mounted at /:creatorId/audit-logs -> full path /creators/:creatorId/audit-logs
app.get(
    "/",
    requireAuth,
    requireCreatorRole(CreatorRole.OWNER, CreatorRole.ADMIN),
    async (c: Context<{ Variables: AuthVariables }>) => {
        const creatorId = c.req.param("creatorId")!;
        const result = await getCreatorAuditLogs(creatorId, {
            page: Number(c.req.query("page") ?? 1),
            limit: Number(c.req.query("limit") ?? 20),
            action: c.req.query("action"),
            actorUserId: c.req.query("actorUserId") ?? c.req.query("userId"),
            entityType: c.req.query("entityType"),
            startDate: c.req.query("startDate"),
            endDate: c.req.query("endDate"),
        });
        return c.json(result);
    },
);

// ── Available actions (for UI filter) ───────────────
app.get(
    "/actions",
    requireAuth,
    requireCreatorRole(CreatorRole.OWNER, CreatorRole.ADMIN),
    (c) => c.json({ data: CREATOR_AUDIT_ACTION_LIST }),
);

export default app;
