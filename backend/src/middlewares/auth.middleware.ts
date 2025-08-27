import { Context, Next } from 'hono';
import { verify, JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import { User } from '@/models/User.model';
import { APIError } from '../lib/APIError';

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
    jwt_payload: { sub: string; iat: number; exp: number };
    user: User;
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
 */
export async function requireAuth(c: Context<{ Variables: AuthVariables }>, next: Next) {
    const authHeader = c.req.header(AUTH_HEADER);

    if (!authHeader || !authHeader.startsWith(AUTH_SCHEME)) {
        throw new APIError(401, 'Unauthorized', 'MISSING_OR_MALFORMED_TOKEN');
    }

    const token = authHeader.substring(AUTH_SCHEME.length);

    try {
        const payload = verify(token, JWT_SECRET) as AuthVariables['jwt_payload'];

        // Use .lean() for a significant performance boost if you only need a plain
        // JavaScript object and not a full Mongoose document instance.
        const user = await User.findById(payload.sub)

        if (!user) {
            throw new APIError(401, 'Unauthorized', 'USER_NOT_FOUND');
        }

        c.set(USER_CONTEXT_KEY, user);
        c.set(JWT_CONTEXT_KEY, payload);

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

    if (!user.admin) {
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
    const completeUser = await User.getCompleteUser(user.id)

    if (completeUser?.publisherMemberships.length === 0) {
        throw new APIError(403, 'Forbidden', 'INSUFFICIENT_PERMISSIONS');
    }

    await next();
}

export async function isOrganizationMember(c: Context<{ Variables: AuthVariables }>, next: Next) {
    const user = c.get(USER_CONTEXT_KEY) as User
    const { teamId } = c.req.param();


    if (!user) {
        throw new APIError(500, 'Middleware Misconfiguration', 'USER_NOT_IN_CONTEXT');
    }

    if (!(user instanceof User)) {
        throw new APIError(500, 'Middleware Misconfiguration', 'USER_TYPE_INVALID');
    }
    const userTeams = await user.getTeams();
    const isMember = userTeams.some(team => team.id === teamId);

    if (!isMember) {
        throw new APIError(403, 'Forbidden', 'USER_NOT_IN_ORGANIZATION');
    }

    await next();
}