import type { Context } from "@hono/hono";
import { db } from "@/db/client.ts";
import {
    creatorAuditLogsTable,
    users,
    CREATOR_AUDIT_ACTIONS,
    type CreatorAuditAction,
    type CreatorAuditEntityType,
} from "@/db/schema.ts";
import type { AuthVariables } from "@/auth/middleware.ts";
import type { ResolvedApiToken } from "@/auth/api-token.ts";
import { and, count, desc, eq, gte, lte, sql } from "drizzle-orm";

export type { CreatorAuditAction, CreatorAuditEntityType };
export const CREATOR_AUDIT_ACTION_LIST: readonly string[] = CREATOR_AUDIT_ACTIONS;

export interface LogCreatorEventInput {
    creatorId: string;
    actorUserId?: string | null;
    actorTokenId?: string | null;
    action: CreatorAuditAction;
    entityType?: CreatorAuditEntityType | null;
    entityId?: string | null;
    details?: Record<string, unknown> | null;
    ipAddress?: string | null;
    userAgent?: string | null;
}

export interface CreatorAuditQuery {
    page?: number;
    limit?: number;
    action?: string;
    actorUserId?: string;
    entityType?: string;
    startDate?: string;
    endDate?: string;
}

/** Best-effort IP extraction (proxy-aware, max 45 chars for varchar). */
function extractIp(c: Context): string | null {
    const headers = [
        "cf-connecting-ip",
        "x-forwarded-for",
        "x-real-ip",
    ];
    for (const h of headers) {
        const v = c.req.header(h);
        if (v) {
            const first = v.split(",")[0].trim();
            if (first) return first.slice(0, 45);
        }
    }
    return null;
}

/**
 * Builds audit context from the Hono request context.
 * Works for both user sessions (userId) and headless creator API tokens (mps_...).
 */
export function auditContextFromRequest(
    c: Context<{ Variables: AuthVariables }>,
    creatorId: string,
    overrides: Omit<Partial<LogCreatorEventInput>, "action" | "creatorId"> & { action: CreatorAuditAction },
): LogCreatorEventInput & { creatorId: string } {
    let actorUserId: string | null = null;
    let actorTokenId: string | null = null;
    try {
        actorUserId = (c.get("userId") as string | undefined) ?? null;
    } catch { /* not set for api_token auth */ }
    try {
        const token = c.get("apiToken") as ResolvedApiToken | undefined;
        if (token?.id) actorTokenId = token.id;
    } catch { /* no token */ }

    return {
        creatorId,
        actorUserId: overrides.actorUserId ?? actorUserId,
        actorTokenId: overrides.actorTokenId ?? actorTokenId,
        action: overrides.action,
        entityType: overrides.entityType ?? null,
        entityId: overrides.entityId ?? null,
        details: overrides.details ?? null,
        ipAddress: overrides.ipAddress ?? extractIp(c as unknown as Context),
        userAgent: overrides.userAgent ?? (c.req.header("user-agent") ?? null),
    };
}

/**
 * Append-only write. Never throws: audit must not break the main operation.
 */
export async function logCreatorEvent(input: LogCreatorEventInput): Promise<void> {
    try {
        await db.insert(creatorAuditLogsTable).values({
            creatorId: input.creatorId,
            actorUserId: input.actorUserId ?? null,
            actorTokenId: input.actorTokenId || null,
            action: input.action,
            entityType: input.entityType ?? null,
            entityId: input.entityId ?? null,
            details: input.details ?? null,
            ipAddress: input.ipAddress ?? null,
            userAgent: input.userAgent ?? null,
        });
    } catch (err) {
        console.error("[creator-audit] failed to write log:", err);
    }
}

/** Fire-and-forget wrapper for route handlers (does not await callers). */
export function logCreatorEventAsync(input: LogCreatorEventInput): void {
    void logCreatorEvent(input);
}

export interface PaginatedCreatorAuditLogs {
    logs: Array<typeof creatorAuditLogsTable.$inferSelect & {
        actor?: { id: string; username: string; avatarUrl: string | null } | null;
    }>;
    total: number;
    page: number;
    totalPages: number;
}

export async function getCreatorAuditLogs(
    creatorId: string,
    query: CreatorAuditQuery = {},
): Promise<PaginatedCreatorAuditLogs> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const offset = (page - 1) * limit;

    const conditions = [eq(creatorAuditLogsTable.creatorId, creatorId)];
    if (query.action) conditions.push(eq(creatorAuditLogsTable.action, query.action));
    if (query.actorUserId) conditions.push(eq(creatorAuditLogsTable.actorUserId, query.actorUserId));
    if (query.entityType) conditions.push(eq(creatorAuditLogsTable.entityType, query.entityType));
    if (query.startDate) {
        const d = new Date(query.startDate);
        if (!Number.isNaN(d.getTime())) conditions.push(gte(creatorAuditLogsTable.createdAt, d));
    }
    if (query.endDate) {
        const d = new Date(query.endDate);
        if (!Number.isNaN(d.getTime())) conditions.push(lte(creatorAuditLogsTable.createdAt, d));
    }
    const where = and(...conditions);

    const rows = await db.select({
        id: creatorAuditLogsTable.id,
        creatorId: creatorAuditLogsTable.creatorId,
        actorUserId: creatorAuditLogsTable.actorUserId,
        actorTokenId: creatorAuditLogsTable.actorTokenId,
        action: creatorAuditLogsTable.action,
        entityType: creatorAuditLogsTable.entityType,
        entityId: creatorAuditLogsTable.entityId,
        details: creatorAuditLogsTable.details,
        ipAddress: creatorAuditLogsTable.ipAddress,
        userAgent: creatorAuditLogsTable.userAgent,
        createdAt: creatorAuditLogsTable.createdAt,
        actorUsername: users.username,
        actorAvatarUrl: users.avatarUrl,
    })
        .from(creatorAuditLogsTable)
        .leftJoin(users, eq(users.id, creatorAuditLogsTable.actorUserId))
        .where(where)
        .orderBy(desc(creatorAuditLogsTable.createdAt), desc(creatorAuditLogsTable.id))
        .limit(limit)
        .offset(offset);

    const [{ total }] = await db.select({ total: count() })
        .from(creatorAuditLogsTable)
        .where(where);

    const logs = rows.map((r) => ({
        id: r.id,
        creatorId: r.creatorId,
        actorUserId: r.actorUserId,
        actorTokenId: r.actorTokenId,
        action: r.action,
        entityType: r.entityType,
        entityId: r.entityId,
        details: r.details,
        ipAddress: r.ipAddress,
        userAgent: r.userAgent,
        createdAt: r.createdAt,
        actor: r.actorUserId
            ? {
                id: r.actorUserId,
                username: r.actorUsername ?? "unknown",
                avatarUrl: r.actorAvatarUrl ?? null,
            }
            : null,
    }));

    return { logs, total, page, totalPages: Math.ceil(total / limit) };
}

export async function getCreatorAuditActionCounts(creatorId: string): Promise<{ action: string; count: number }[]> {
    const rows = await db.select({
        action: creatorAuditLogsTable.action,
        count: sql<number>`cast(count(*) as int)`,
    })
        .from(creatorAuditLogsTable)
        .where(eq(creatorAuditLogsTable.creatorId, creatorId))
        .groupBy(creatorAuditLogsTable.action);
    return rows;
}
