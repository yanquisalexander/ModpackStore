import type { Context, Next } from "@hono/hono";
import { verify } from "@hono/hono/jwt";
import {
    APIError,
    UnauthorizedError,
    ForbiddenError,
} from "@/lib/errors/index.ts";
import { db } from "@/db/client.ts";
import { users, sessions, modpacksTable } from "@/db/schema.ts";
import { eq } from "drizzle-orm";
import type { JwtPayload } from "@/auth/service.ts";
import { sessionKV } from "@/auth/kv-session.ts";

const JWT_SECRET = Deno.env.get("JWT_SECRET")!;
const AUTH_HEADER = "Authorization";
const AUTH_SCHEME = "Bearer ";

import type { ResolvedApiToken } from "@/auth/api-token.ts";

export interface AuthVariables {
    user: typeof users.$inferSelect;
    jwtPayload: JwtPayload;
    userId: string;
    modpack?: typeof modpacksTable.$inferSelect;
    authType?: "user" | "api_token";
    apiToken?: ResolvedApiToken;
    tokenCreatorId?: string;
}

async function authenticate(c: Context, failIfMissing: boolean): Promise<void> {
    const authHeader = c.req.header(AUTH_HEADER);

    if (!authHeader || !authHeader.startsWith(AUTH_SCHEME)) {
        if (failIfMissing) {
            throw new UnauthorizedError("Unauthorized", "MISSING_OR_MALFORMED_TOKEN");
        }
        return;
    }

    const token = authHeader.substring(AUTH_SCHEME.length);

    // Creator API token branch (mps_...): headless auth on behalf of a creator.
    // Never impersonates a user: sets apiToken/tokenCreatorId instead of user/userId.
    if (token.startsWith("mps_")) {
        const { apiTokenService } = await import("@/auth/api-token.ts");
        const resolved = await apiTokenService.resolve(token);
        if (!resolved) {
            if (failIfMissing) {
                throw new UnauthorizedError("Unauthorized", "INVALID_API_TOKEN");
            }
            return;
        }
        c.set("authType", "api_token");
        c.set("apiToken", resolved);
        c.set("tokenCreatorId", resolved.creatorId);
        apiTokenService.touchLastUsed(resolved.prefix);
        return;
    }

    let jwtPayload: JwtPayload;
    try {
        jwtPayload = await verify(token, JWT_SECRET, "HS256") as unknown as JwtPayload;
    } catch {
        if (failIfMissing) {
            throw new UnauthorizedError("Unauthorized", "INVALID_TOKEN");
        }
        return;
    }

    // KV-first session lookup (fast path)
    const sessionCache = await sessionKV.get(jwtPayload.sessionId);

    if (sessionCache) {
        // KV hit: verify userId matches
        if (sessionCache.userId !== jwtPayload.sub) {
            if (failIfMissing) {
                throw new UnauthorizedError("Unauthorized", "INVALID_SESSION");
            }
            return;
        }

        // Si tenemos snapshot en KV, usarlo directamente (sin SELECT a DB)
        let user = sessionCache.user;
        if (!user) {
            const [u] = await db.select().from(users).where(eq(users.id, jwtPayload.sub)).limit(1);
            if (!u) {
                if (failIfMissing) {
                    throw new UnauthorizedError("Unauthorized", "INVALID_SESSION");
                }
                return;
            }
            user = { id: u.id, role: u.role, username: u.username, avatarUrl: u.avatarUrl, isPlus: u.isPlus, adFree: u.adFree };
            // Repoblar snapshot en KV para próxima request (ignorar errores para no bloquear)
            void sessionKV.set(jwtPayload.sessionId, jwtPayload.sub, user).catch(() => {});
        }

        c.set("user", user as typeof users.$inferSelect);
        c.set("jwtPayload", jwtPayload);
        c.set("userId", user.id);
        c.set("authType", "user");
        return;
    }

    // KV miss: fallback a PostgreSQL + repoblar KV
    const [user] = await db.select().from(users).where(eq(users.id, jwtPayload.sub)).limit(1);
    const [session] = await db.select().from(sessions).where(eq(sessions.id, jwtPayload.sessionId)).limit(1);

    if (!user || !session || session.userId !== user.id) {
        if (failIfMissing) {
            throw new UnauthorizedError("Unauthorized", "INVALID_SESSION");
        }
        return;
    }

    const userSnapshot = { id: user.id, role: user.role, username: user.username, avatarUrl: user.avatarUrl, isPlus: user.isPlus, adFree: user.adFree };
    // Repoblar KV para próximas requests (async, ignora fallos)
    void sessionKV.set(session.id, user.id, userSnapshot).catch(() => {});

    c.set("user", user);
    c.set("jwtPayload", jwtPayload);
    c.set("userId", user.id);
    c.set("authType", "user");
}

export async function requireAuth(c: Context, next: Next): Promise<void> {
    await authenticate(c, true);
    await next();
}

export async function optionalAuth(c: Context, next: Next): Promise<void> {
    await authenticate(c, false);
    await next();
}

export async function requireAdmin(c: Context, next: Next): Promise<void> {
    const user = c.get("user") as typeof users.$inferSelect | undefined;
    if (!user) {
        throw new APIError(500, "Middleware misconfiguration: user not in context", "USER_NOT_IN_CONTEXT");
    }
    if (user.role !== "admin" && user.role !== "super_admin") {
        throw new ForbiddenError("Forbidden", "INSUFFICIENT_PERMISSIONS");
    }
    await next();
}

/**
 * Accepts either a user JWT session or a creator API token (`mps_...`).
 * After this middleware, exactly one of `userId` / `tokenCreatorId` is set.
 */
export async function requireAuthOrToken(c: Context, next: Next): Promise<void> {
    await authenticate(c, true);
    await next();
}

/**
 * Requires the current creator API token to carry a given scope.
 * Must run after requireAuthOrToken. User sessions bypass scope checks
 * (their permissions are enforced by the existing creator-role middlewares).
 */
export function requireScope(scope: string) {
    return async (c: Context, next: Next): Promise<void> => {
        if (c.get("authType") === "api_token") {
            const token = c.get("apiToken") as ResolvedApiToken | undefined;
            if (!token || !token.scopes.includes(scope)) {
                throw new ForbiddenError("Token lacks required scope", "INSUFFICIENT_SCOPE");
            }
        } else if (!c.get("user")) {
            throw new UnauthorizedError("Unauthorized", "MISSING_OR_MALFORMED_TOKEN");
        }
        await next();
    };
}
