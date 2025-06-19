import { Context, Next } from 'hono';

/**
 * Middleware to ensure that the authenticated user has administrative privileges.
 */
export async function ensureAdmin(c: Context, next: Next) {
  const user = c.get('user');
  if (!user || user.admin !== true) {
    return c.json({ error: 'Forbidden', message: 'You do not have administrative privileges.' }, 403);
  }
  await next();
}
