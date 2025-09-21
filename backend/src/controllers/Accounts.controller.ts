// /controllers/AccountsController.ts
import { Context } from 'hono';
import { AuthService } from '@/services/auth.service';
import { TwitchService } from '@/services/twitch.service';
import { PatreonIntegrationService } from '@/services/patreon-integration.service';
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

    /**
     * Handles Twitch OAuth callback and links account to user
     */
    static async callbackTwitch(c: Context<{ Variables: AuthVariables }>): Promise<Response> {
        const code = c.req.query('code');
        const authenticatedUser = c.get('user');

        if (!code) {
            throw new APIError(400, 'Authorization code is required.', 'MISSING_CODE');
        }

        if (!authenticatedUser) {
            throw new APIError(401, 'User must be authenticated to link Twitch account.', 'USER_NOT_AUTHENTICATED');
        }

        console.log(`[ACCOUNTS] Linking Twitch account for user ID: ${authenticatedUser.id}`);
        await TwitchService.linkTwitchToUser(authenticatedUser, code);

        return c.json({
            success: true,
            message: 'Twitch account linked successfully'
        });
    }

    /**
     * Unlink Twitch account from user
     */
    static async unlinkTwitch(c: Context<{ Variables: AuthVariables }>): Promise<Response> {
        const authenticatedUser = c.get('user');

        if (!authenticatedUser) {
            throw new APIError(401, 'User must be authenticated.', 'USER_NOT_AUTHENTICATED');
        }

        if (!authenticatedUser.hasTwitchLinked()) {
            throw new APIError(400, 'No Twitch account is linked to this user.', 'TWITCH_NOT_LINKED');
        }

        console.log(`[ACCOUNTS] Unlinking Twitch account for user ID: ${authenticatedUser.id}`);
        await TwitchService.unlinkTwitchFromUser(authenticatedUser);

        return c.json({
            success: true,
            message: 'Twitch account unlinked successfully'
        });
    }

    /**
     * Get Twitch link status for current user
     */
    static async getTwitchStatus(c: Context<{ Variables: AuthVariables }>): Promise<Response> {
        const authenticatedUser = c.get('user');

        if (!authenticatedUser) {
            throw new APIError(401, 'User must be authenticated.', 'USER_NOT_AUTHENTICATED');
        }

        return c.json({
            linked: authenticatedUser.hasTwitchLinked(),
            twitchId: authenticatedUser.twitchId,
            twitchUsername: await authenticatedUser.getTwitchUserInfo().then(info => info?.username || 'unknown'),
        });
    }

    /**
     * Handle Patreon OAuth callback from Rust module
     */
    static async callbackPatreon(c: Context): Promise<Response> {
        try {
            const body = await c.req.json();
            const { code, state, userId } = body;

            if (!code || !userId) {
                throw new APIError(400, 'Authorization code and user ID are required.', 'MISSING_PARAMETERS');
            }

            console.log(`[ACCOUNTS] Processing Patreon OAuth callback for user ID: ${userId}`);
            
            // Process OAuth callback
            const result = await PatreonIntegrationService.handleOAuthCallback(code, state);
            
            if (!result.success) {
                throw new APIError(400, result.error || 'Failed to process Patreon OAuth', 'PATREON_OAUTH_FAILED');
            }

            // Link Patreon account to user
            const linkResult = await PatreonIntegrationService.handlePatreonCallback(code, userId);
            
            if (!linkResult.success) {
                throw new APIError(400, linkResult.error || 'Failed to link Patreon account', 'PATREON_LINK_FAILED');
            }

            return c.json({
                success: true,
                message: 'Patreon account linked successfully'
            });
        } catch (error: any) {
            console.error('[ACCOUNTS] Patreon OAuth callback error:', error);
            
            if (error instanceof APIError) {
                throw error;
            }
            
            throw new APIError(500, 'Internal server error during Patreon OAuth', 'INTERNAL_ERROR');
        }
    }

    /**
     * Accept Terms and Conditions for the current user
     */
    static async acceptTermsAndConditions(c: Context<{ Variables: AuthVariables }>): Promise<Response> {
        const authenticatedUser = c.get('user');

        if (!authenticatedUser) {
            throw new APIError(401, 'User must be authenticated.', 'USER_NOT_AUTHENTICATED');
        }

        console.log(`[ACCOUNTS] User ${authenticatedUser.id} accepting Terms and Conditions`);
        
        // Update the user's tosAcceptedAt timestamp
        authenticatedUser.tosAcceptedAt = new Date();
        await authenticatedUser.save();

        return c.json({
            data: {
                tosAcceptedAt: authenticatedUser.tosAcceptedAt
            }
        });
    }
}