// /controllers/AccountsController.ts
import "dotenv/config";
import { Context } from 'hono';
// import { User } from "@/models/User.model"; // May not be directly needed here anymore
// import { Session } from "@/models/Session.model"; // May not be directly needed here anymore
import { AuthService } from "@/services/auth.service";
import { serializeResource, serializeError } from "../utils/jsonapi";
import { APIError } from "../lib/APIError"; // For throwing errors
import { User } from "@/models/User.model";

export class AccountsController {
    static async callbackDiscord(c: Context): Promise<Response> {
        const code = c.req.query('code');

        if (!code) {
            return c.json(serializeError({
                status: '400',
                title: 'Bad Request',
                detail: 'Missing authorization code',
            }), 400);
        }

        try {
            console.log("[CONTROLLER_ACCOUNTS][DISCORD] Callback received, calling AuthService. Code:", code.substring(0, 10) + "...");
            const tokens = await AuthService.handleDiscordCallback(code);
            console.log("[CONTROLLER_ACCOUNTS][DISCORD] Tokens received from service, sending to client.");
            return c.json(serializeResource('token', { ...tokens }), 200);
        } catch (error: any) {
            console.error('[CONTROLLER_ACCOUNTS][DISCORD] Error in callback:', error.message);
            if (error instanceof APIError) {
                throw error;
            }
            throw new APIError(error.statusCode || 500, error.message || 'Internal server error');
        }
    }

    static async getCurrentUser(c: Context) {
        // Hono: El tipo de retorno puede ser Response o void, Hono maneja el response
        const authenticatedUser = c.get('user') as User;

        if (!authenticatedUser || !authenticatedUser.id) {
            throw new APIError(401, 'No valid user session.');
        }

        try {
            console.log(`[CONTROLLER_ACCOUNTS] Getting current user profile for ID: ${authenticatedUser.id}`);
            const userProfile = await AuthService.getAuthenticatedUserProfile(authenticatedUser.id);
            console.log("[CONTROLLER_ACCOUNTS] Profile retrieved from service.");
            return c.json(serializeResource('user', userProfile), 200);
        } catch (error: any) {
            console.error('[CONTROLLER_ACCOUNTS] Error getting current user:', error.message);
            if (error instanceof APIError) {
                throw error;
            }
            throw new APIError(error.statusCode || 500, error.message || 'Internal server error');
        }
    }

    static async refreshTokens(c: Context) {
        const body = await c.req.json();
        const refreshToken = body.refresh_token;

        if (!refreshToken) {
            return c.json(serializeError({
                status: '400',
                title: 'Bad Request',
                detail: 'Missing refresh token',
            }), 400);
        }

        try {
            console.log("[CONTROLLER_ACCOUNTS] Refreshing tokens. Token (partial):", refreshToken.substring(0, 10) + "...");
            const newTokens = await AuthService.refreshAuthTokens(refreshToken);
            console.log("[CONTROLLER_ACCOUNTS] Tokens refreshed successfully by service.");
            return c.json(serializeResource('token', { ...newTokens }), 200);
        } catch (error: any) {
            console.error('[CONTROLLER_ACCOUNTS] Error refreshing tokens:', error.message);
            if (error instanceof APIError) {
                throw error;
            }
            throw new APIError(error.statusCode || 500, error.message || 'Internal server error');
        }
    }
}
