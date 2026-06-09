import { Context, Next } from 'hono';
import { APIError } from '../lib/APIError';
import { User } from "@/entities/User";
import { UserRole } from '@/types/enums';
import { AuthVariables, USER_CONTEXT_KEY } from './auth.middleware';

/**
 * Middleware to require specific user role(s)
 * Must be used after requireAuth middleware
 */
export function requireRole(allowedRoles: UserRole[]) {
    return async (c: Context<{ Variables: AuthVariables }>, next: Next) => {
        const user = c.get(USER_CONTEXT_KEY);

        // This check provides a clear error if middleware order is incorrect
        if (!user) {
            throw new APIError(500, 'Middleware Misconfiguration', 'USER_NOT_IN_CONTEXT');
        }

        if (!(user instanceof User)) {
            throw new APIError(500, 'Middleware Misconfiguration', 'USER_TYPE_INVALID');
        }

        // Check if user has any of the allowed roles
        if (!allowedRoles.includes(user.role)) {
            throw new APIError(403, 'Forbidden', 'INSUFFICIENT_PERMISSIONS');
        }

        await next();
    };
}

/**
 * Middleware to require admin role (ADMIN or SUPERADMIN)
 * Shorthand for requireRole([UserRole.ADMIN, UserRole.SUPERADMIN])
 */
export function requireAdminRole() {
    return requireRole([UserRole.ADMIN, UserRole.SUPERADMIN]);
}

/**
 * Middleware to require superadmin role only
 */
export function requireSuperAdminRole() {
    return requireRole([UserRole.SUPERADMIN]);
}

/**
 * Middleware to require support role
 */
export function requireSupportRole() {
    return requireRole([UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.SUPPORT]);
}
