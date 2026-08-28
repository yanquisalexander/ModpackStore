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

export interface AuthVariables {
    user: typeof users.$inferSelect;
    jwtPayload: JwtPayload;
    userId: string;
    modpack?: typeof modpacksTable.$inferSelect;
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
        // KV hit: verify userId matches, then just fetch user
        if (sessionCache.userId !== jwtPayload.sub) {
            if (failIfMissing) {
                throw new UnauthorizedError("Unauthorized", "INVALID_SESSION");
            }
            return;
        }

        const [user] = await db.select().from(users).where(eq(users.id, jwtPayload.sub)).limit(1);
        if (!user) {
            if (failIfMissing) {
                throw new UnauthorizedError("Unauthorized", "INVALID_SESSION");
            }
            return;
        }

        c.set("user", user);
        c.set("jwtPayload", jwtPayload);
        c.set("userId", user.id);
        return;
    }

    // KV miss: fallback to PostgreSQL + repopulate KV
    const [user] = await db.select().from(users).where(eq(users.id, jwtPayload.sub)).limit(1);
    const [session] = await db.select().from(sessions).where(eq(sessions.id, jwtPayload.sessionId)).limit(1);

    if (!user || !session || session.userId !== user.id) {
        if (failIfMissing) {
            throw new UnauthorizedError("Unauthorized", "INVALID_SESSION");
        }
        return;
    }

    // Repopulate KV for next request
    await sessionKV.set(session.id, user.id);

    c.set("user", user);
    c.set("jwtPayload", jwtPayload);
    c.set("userId", user.id);
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
