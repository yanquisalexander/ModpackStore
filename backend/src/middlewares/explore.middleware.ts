import { Context, Next } from 'hono';

/**
 * Middleware para validar si el usuario autenticado puede explorar modpacks.
 * Por ahora, permite a cualquier usuario autenticado (puedes agregar lógica de permisos aquí si es necesario).
 */
export async function validateCanExplore(c: Context, next: Next) {
    // Si en el futuro hay lógica de permisos, agregar aquí (por ejemplo, checar roles, flags, etc)
    // const user = c.get('user');
    // if (!user || !user.puedeExplorar) throw ...
    await next();
}
