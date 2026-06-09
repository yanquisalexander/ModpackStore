import type { Context, Next } from "@hono/hono";
import { verify } from "@hono/hono/jwt";
import {
  APIError,
  UnauthorizedError,
  ForbiddenError,
} from "@/lib/errors/index.ts";
import { memoryStore } from "@/db/memory-store.ts";
import type { StoredUser } from "@/db/memory-store.ts";
import type { JwtPayload } from "@/auth/service.ts";

const JWT_SECRET = Deno.env.get("JWT_SECRET")!;
const AUTH_HEADER = "Authorization";
const AUTH_SCHEME = "Bearer ";

export interface AuthVariables {
  user: StoredUser;
  jwtPayload: JwtPayload;
  userId: string;
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

  const user = memoryStore.findUserById(jwtPayload.sub);
  const session = memoryStore.findSessionById(jwtPayload.sessionId);

  if (!user || !session || session.userId !== user.id) {
    if (failIfMissing) {
      throw new UnauthorizedError("Unauthorized", "INVALID_SESSION");
    }
    return;
  }

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
  const user = c.get("user") as StoredUser | undefined;
  if (!user) {
    throw new APIError(500, "Middleware misconfiguration: user not in context", "USER_NOT_IN_CONTEXT");
  }
  if (user.role !== "admin" && user.role !== "superadmin") {
    throw new ForbiddenError("Forbidden", "INSUFFICIENT_PERMISSIONS");
  }
  await next();
}
