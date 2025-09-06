import { Context, Next } from 'hono';
import { UserRole } from '../types/enums';

/**
 * Middleware to ensure that the authenticated user has administrative privileges.
 */
export async function ensureAdmin(c: Context, next: Next) {
  const user = c.get('user');
  if (!user || (!user.isAdmin())) {
    return c.json({ error: 'Forbidden', message: 'You do not have administrative privileges.' }, 403);
  }
  await next();
}

/**
 * Middleware to ensure that the authenticated user has super admin privileges.
 */
export async function ensureSuperAdmin(c: Context, next: Next) {
  const user = c.get('user');
  if (!user || !user.isSuperAdmin()) {
    return c.json({ error: 'Forbidden', message: 'You do not have super administrative privileges.' }, 403);
  }
  await next();
}

/**
 * Middleware to ensure that the authenticated user has staff privileges (admin, super admin, or support).
 */
export async function ensureStaff(c: Context, next: Next) {
  const user = c.get('user');
  if (!user || !user.isStaff()) {
    return c.json({ error: 'Forbidden', message: 'You do not have staff privileges.' }, 403);
  }
  await next();
}

/**
 * Middleware to ensure that the authenticated user has specific role or higher.
 */
export function ensureRole(requiredRole: UserRole) {
  return async (c: Context, next: Next) => {
    const user = c.get('user');
    if (!user) {
      return c.json({ error: 'Unauthorized', message: 'Authentication required.' }, 401);
    }

    // Role hierarchy: USER < ADMIN < SUPERADMIN
    const roleHierarchy = {
      [UserRole.USER]: 0,
      [UserRole.ADMIN]: 1,
      [UserRole.SUPERADMIN]: 2
    };

    const userLevel = roleHierarchy[user.role];
    const requiredLevel = roleHierarchy[requiredRole];

    if (userLevel < requiredLevel) {
      return c.json({ error: 'Forbidden', message: 'Insufficient privileges.' }, 403);
    }

    await next();
  };
}
