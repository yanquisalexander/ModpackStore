import type { Context } from "@hono/hono";
import { getConnInfo } from "@hono/hono/deno";
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

/**
 * Snapshot del nombre visible de un usuario para guardarlo en `details`.
 * Es una PK lookup barata y nunca lanza: se usa en el path de escritura
 * (fire-and-forget, fuera de la respuesta) para que la lectura no necesite
 * ningún JOIN extra.
 */
export async function resolveUsernameForAudit(userId: string | null | undefined): Promise<string | null> {
    if (!userId) return null;
    try {
        const [row] = await db.select({ username: users.username })
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);
        return row?.username ?? null;
    } catch {
        return null;
    }
}

/**
 * Wrapper no bloqueante para eventos sobre un usuario (miembro, whitelist...).
 * Resuelve `targetUsername` y escribe el log íntegramente en background:
 * cero queries y cero latencia añadida en la respuesta HTTP.
 */
export function logCreatorEventForUser(
    c: Context<{ Variables: AuthVariables }>,
    creatorId: string,
    action: CreatorAuditAction,
    entityType: CreatorAuditEntityType,
    targetUserId: string,
    extraDetails?: Record<string, unknown>,
    knownUsername?: string | null,
): void {
    // Snapshot síncrono: el request se cierra al responder y en background
    // leer headers lanzaría `TypeError: Request closed`.
    const reqCtx = captureAuditRequestContext(c);
    void (async () => {
        const targetUsername = knownUsername ?? await resolveUsernameForAudit(targetUserId);
        await logCreatorEvent({
            creatorId,
            ...reqCtx,
            action,
            entityType,
            entityId: targetUserId,
            details: { ...extraDetails, targetUsername },
        });
    })();
}

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

/**
 * Lee un header sin lanzar nunca. Importante: Deno cierra el Request al
 * enviar la respuesta, así que leer headers en background lanza
 * `TypeError: Request closed`. Todo acceso a `c.req` debe ocurrir en el
 * handler (síncrono) o pasar por aquí.
 */
function readHeaderSafe(c: Context, name: string): string | null {
    try {
        return c.req.header(name) ?? null;
    } catch {
        return null; // request ya cerrado (uso diferido indebido)
    }
}

/** Best-effort IP extraction (proxy-aware, max 45 chars for varchar). */
function extractIp(c: Context): string | null {
    const headers = [
        "cf-connecting-ip",
        "x-forwarded-for",
        "x-real-ip",
    ];
    for (const h of headers) {
        const v = readHeaderSafe(c, h);
        if (v) {
            const first = v.split(",")[0].trim();
            if (first) return first.slice(0, 45);
        }
    }
    // Fallback: conexión directa sin proxy (Deno.serve). En modo serverless
    // no hay conn info y devuelve null. Lee `c.env`, no el Request, así que
    // es seguro incluso después de responder.
    try {
        const addr = getConnInfo(c as never)?.remote?.address;
        if (typeof addr === "string" && addr) return addr.slice(0, 45);
    } catch {
        // sin conn info disponible
    }
    return null;
}

export interface CapturedAuditRequestContext {
    actorUserId: string | null;
    actorTokenId: string | null;
    ipAddress: string | null;
    userAgent: string | null;
}

/**
 * Snapshot síncrono de todo lo que necesitamos del Request (actor, IP, UA).
 * DEBE llamarse en el handler, con el request abierto. Lo diferido solo
 * puede hacer I/O de BBDD, nunca tocar `c.req`.
 */
export function captureAuditRequestContext(
    c: Context<{ Variables: AuthVariables }>,
): CapturedAuditRequestContext {
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
        actorUserId,
        actorTokenId,
        ipAddress: extractIp(c as unknown as Context),
        userAgent: readHeaderSafe(c as unknown as Context, "user-agent"),
    };
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
        userAgent: overrides.userAgent ?? readHeaderSafe(c as unknown as Context, "user-agent"),
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
