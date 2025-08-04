import { Context, Next } from 'hono';
import { verify } from 'jsonwebtoken';
import { User } from '@/models/User.model';
import { APIError } from '../lib/APIError';

const JWT_SECRET = process.env.JWT_SECRET;

export const JWT_CONTEXT_KEY = 'jwt_payload';
export const USER_CONTEXT_KEY = 'user';
export const AUTH_HEADER = 'Authorization';

export async function requireAuth(c: Context, next: Next) {
    const authHeader = c.req.header(AUTH_HEADER);
    console.log(`[AUTH_MIDDLEWARE] Authorization header: ${authHeader}`);
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new APIError(401, 'Unauthorized', 'NO_AUTH_HEADER');
    }
    const token = authHeader.replace('Bearer ', '');
    if (!JWT_SECRET) {
        throw new APIError(500, 'Server misconfiguration', 'NO_JWT_SECRET');
    }
    try {
        const payload = verify(token, JWT_SECRET) as { sub: string };
        const user = await User.findById(payload.sub);
        if (!user) {
            throw new APIError(401, 'Unauthorized', 'USER_NOT_FOUND');
        }
        c.set(JWT_CONTEXT_KEY, payload);
        c.set(USER_CONTEXT_KEY, user);
        await next();
    } catch (err: any) {
        throw new APIError(401, 'Unauthorized', err.message || 'INVALID_TOKEN');
    }
}

export async function requireAdmin(c: Context, next: Next) {
    const user = c.get(USER_CONTEXT_KEY) as User;
    if (!user || !user.admin) {
        throw new APIError(403, 'Forbidden', 'NOT_ADMIN');
    }
    await next();
}
