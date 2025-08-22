// /controllers/AccountsController.ts
import { Context } from 'hono';
import { AuthService } from '@/services/auth.service';
import { APIError } from '@/lib/APIError';
import { AuthVariables } from "@/middlewares/auth.middleware";

// Define un tipo para el cuerpo de la petición de refresh para mayor seguridad
type RefreshTokenPayload = {
    refresh_token?: string;
};

export class AccountsController {
    /**
     * Maneja el callback de la autenticación de Discord.
     */
    static async callbackDiscord(c: Context): Promise<Response> {
        const code = c.req.query('code');

        // 2. Lanza un error estandarizado en lugar de retornar una respuesta manual
        if (!code) {
            throw new APIError(400, 'Authorization code is required.', 'MISSING_CODE');
        }

        // 3. Se elimina el try/catch. El manejador de errores global se encargará.
        console.log(`[ACCOUNTS] Processing Discord callback...`);
        const tokens = await AuthService.handleDiscordCallback(code);

        return c.json(tokens);
    }

    /**
     * Obtiene el perfil del usuario actualmente autenticado.
     * Esta ruta debe estar protegida por el middleware `requireAuth`.
     */
    static async getCurrentUser(c: Context<{ Variables: AuthVariables }>) {
        // 4. El contexto ya está tipado, no se necesita `as User`.
        const authenticatedUser = c.get('user');

        // Esta comprobación es una capa extra de seguridad, aunque `requireAuth` ya lo garantiza.
        if (!authenticatedUser) {
            throw new APIError(401, 'No valid user found in context.', 'USER_NOT_IN_CONTEXT');
        }

        console.log(`[ACCOUNTS] Getting profile for user ID: ${authenticatedUser.id}`);
        const userProfile = await AuthService.getAuthenticatedUserProfile(authenticatedUser.id);

        return c.json(userProfile);
    }

    /**
     * Refresca los tokens de autenticación usando un refresh token.
     */
    static async refreshTokens(c: Context) {
        // 5. Se aplica el tipo al cuerpo de la petición para obtener autocompletado y seguridad.
        const body = await c.req.json<RefreshTokenPayload>();
        const { refresh_token } = body;

        if (!refresh_token) {
            throw new APIError(400, 'Refresh token is required.', 'MISSING_REFRESH_TOKEN');
        }

        console.log(`[ACCOUNTS] Refreshing tokens...`);
        const newTokens = await AuthService.refreshAuthTokens(refresh_token);

        return c.json(newTokens);
    }
}