import { Context, Next } from 'hono';
import { verify, JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import { APIError } from '../lib/APIError';
import { User } from "@/entities/User";
import { BanService } from "../services/ban.service";

// --- Startup Configuration ---
// This check runs ONCE when the server starts, not on every request.
if (!process.env.JWT_SECRET) {
    throw new Error('FATAL_ERROR: JWT_SECRET environment variable is not set.');
}
const JWT_SECRET = process.env.JWT_SECRET;

// --- Types & Constants ---
// Define a type for Hono's context variables for full type safety.
// This eliminates the need for type assertions like `as User`.
export type AuthVariables = {
    jwt_payload: { sub: string; sessionId: number; iat: number; exp: number };
    user: User;
    userId: string;
    isBanned?: boolean;
};

// Use constants for keys and headers to avoid typos.
export const JWT_CONTEXT_KEY: keyof AuthVariables = 'jwt_payload';
export const USER_CONTEXT_KEY: keyof AuthVariables = 'user';
const AUTH_HEADER = 'Authorization';
const AUTH_SCHEME = 'Bearer ';


// --- Middleware ---
/**
 * Verifies the JWT from the Authorization header and attaches the corresponding
 * user object to the context.
 * @param allowBanned If true, allows banned users but marks them in the context
 */
export async function requireAuth(c: Context<{ Variables: AuthVariables }>, next: Next, allowBanned: boolean = false) {
    const authHeader = c.req.header(AUTH_HEADER);

    if (!authHeader || !authHeader.startsWith(AUTH_SCHEME)) {
        throw new APIError(401, 'Unauthorized', 'MISSING_OR_MALFORMED_TOKEN');
    }

    const token = authHeader.substring(AUTH_SCHEME.length);

    try {
        const payload = verify(token, JWT_SECRET) as AuthVariables['jwt_payload'];

        const user = await User.findOne({ where: { id: payload.sub }, relations: ['publisherMemberships'] });

        if (!user) {
            throw new APIError(401, 'Unauthorized', 'USER_NOT_FOUND');
        }

        // Check if user is banned
        const isBanned = await BanService.isBanned(user.id);
        if (isBanned && !allowBanned) {
            const activeBan = await BanService.getActiveBanWithDetails(user.id);
            throw new APIError(403, 'User is banned', 'USER_BANNED', {
                banReason: activeBan?.reason || 'No reason provided',
                banDate: activeBan?.banDate
            });
        }

        c.set(USER_CONTEXT_KEY, user);
        c.set(JWT_CONTEXT_KEY, payload);
        c.set('userId', user.id);
        c.set('isBanned', isBanned); // Mark if user is banned

        await next();
    } catch (err) {
        if (err instanceof TokenExpiredError) {
            throw new APIError(401, 'Unauthorized', 'TOKEN_EXPIRED');
        }
        if (err instanceof JsonWebTokenError) {
            // This catches other JWT errors like invalid signature.
            throw new APIError(401, 'Unauthorized', 'INVALID_TOKEN');
        }
        // Re-throw any other unexpected errors (like our own APIError).
        throw err;
    }
}

/**
 * Checks if the user attached by `requireAuth` has admin privileges.
 * This middleware MUST be placed after `requireAuth` in the chain.
 */
export async function requireAdmin(c: Context<{ Variables: AuthVariables }>, next: Next) {
    const user = c.get(USER_CONTEXT_KEY);

    // This check provides a clear error if middleware order is incorrect.
    if (!user) {
        throw new APIError(500, 'Middleware Misconfiguration', 'USER_NOT_IN_CONTEXT');
    }

    if (!(user instanceof User)) {
        throw new APIError(500, 'Middleware Misconfiguration', 'USER_TYPE_INVALID');
    }

    if (!user.isAdmin()) {
        throw new APIError(403, 'Forbidden', 'INSUFFICIENT_PERMISSIONS');
    }

    await next();
}

export async function requireCreatorAccess(c: Context<{ Variables: AuthVariables }>, next: Next) {
    const user = c.get(USER_CONTEXT_KEY);

    if (!user) {
        throw new APIError(500, 'Middleware Misconfiguration', 'USER_NOT_IN_CONTEXT');
    }

    if (!(user instanceof User)) {
        throw new APIError(500, 'Middleware Misconfiguration', 'USER_TYPE_INVALID');
    }

    if (user?.publisherMemberships?.length === 0) {
        throw new APIError(403, 'Forbidden', 'INSUFFICIENT_PERMISSIONS');
    }

    await next();
}

export async function isOrganizationMember(c: Context<{ Variables: AuthVariables }>, next: Next) {
    const user = c.get(USER_CONTEXT_KEY) as User
    const { publisherId } = c.req.param();


    if (!user) {
        throw new APIError(500, 'Middleware Misconfiguration', 'USER_NOT_IN_CONTEXT');
    }

    if (!(user instanceof User)) {
        throw new APIError(500, 'Middleware Misconfiguration', 'USER_TYPE_INVALID');
    }
    const userPublishers = await user.getPublishers();
    const isMember = userPublishers.some(publisher => publisher.id === publisherId);

    if (!isMember) {
        throw new APIError(403, 'Forbidden', 'USER_NOT_IN_PUBLISHER');
    }

    await next();
}

/**
 * Middleware that allows banned users for specific endpoints like /v1/auth/me
 * Banned users can still access their profile but will be marked as banned
 */
export async function requireAuthAllowBanned(c: Context<{ Variables: AuthVariables }>, next: Next) {
    return requireAuth(c, next, true);
}

/**
 * Optional authentication middleware.
 * Attempts to verify JWT and attach user if present, but doesn't fail if token is missing.
 * Useful for endpoints that work for both authenticated and unauthenticated users.
 */
export async function optionalAuth(c: Context<{ Variables: AuthVariables }>, next: Next) {
    const authHeader = c.req.header(AUTH_HEADER);
    console.log('[OPTIONAL_AUTH] Authorization header:', authHeader);

    // If no auth header, just continue without setting user
    if (!authHeader || !authHeader.startsWith(AUTH_SCHEME)) {
        await next();
        return;
    }

    const token = authHeader.substring(AUTH_SCHEME.length);

    try {
        const payload = verify(token, JWT_SECRET) as AuthVariables['jwt_payload'];

        const user = await User.findOne({ where: { id: payload.sub }, relations: ['publisherMemberships'] });

        if (user) {
            // Check if user is banned
            const isBanned = await BanService.isBanned(user.id);

            c.set(USER_CONTEXT_KEY, user);
            c.set(JWT_CONTEXT_KEY, payload);
            c.set('userId', user.id);
            c.set('isBanned', isBanned);

        }
    } catch (err) {
        // Silently ignore invalid tokens for optional auth
        console.log('[OPTIONAL_AUTH] Token verification failed, continuing without authentication');
    }

    await next();
}