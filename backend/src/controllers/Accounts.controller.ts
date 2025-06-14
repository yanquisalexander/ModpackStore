// /controllers/AccountsController.ts
import "dotenv/config";
import { type NextFunction, type Request, type Response } from 'express'
// import { exchangeCodeForToken, getDiscordUser } from '@/services/discord' // Now used by AuthService
import { User } from "@/models/User.model"; // May not be directly needed here anymore
import { Session } from "@/models/Session.model"; // May not be directly needed here anymore
// import { DISCORD_GUILD_ID, IS_BETA_PROGRAM } from "@/consts"; // Now used by AuthService
// import axios from "axios"; // Now used by AuthService
// const DISCORD_GUILDS_URL = "https://discord.com/api/users/@me/guilds"; // Now used by AuthService
import { AuthService } from "@/services/auth.service";


export class AccountsController {
    static async callbackDiscord(req: Request, res: Response, next: NextFunction): Promise<void> {
        const code = req.query.code as string;

        if (!code) {
            res.status(400).json({ error: 'Missing authorization code' });
            return;
        }

        try {
            console.log("[CONTROLLER_ACCOUNTS][DISCORD] Callback received, calling AuthService. Code:", code.substring(0,10) + "..."); // Log only a portion of code
            const tokens = await AuthService.handleDiscordCallback(code);
            console.log("[CONTROLLER_ACCOUNTS][DISCORD] Tokens received from service, sending to client.");
            res.status(200).json(tokens);
        } catch (error: any) {
            console.error('[CONTROLLER_ACCOUNTS][DISCORD] Error in callback:', error.message);
            // Use status code from service error if available, otherwise default to 500
            const statusCode = error.statusCode || 500;
            const responseError = {
                error: error.message || 'Internal server error',
                ...(error.errorCode && { error_code: error.errorCode }),
            };
            res.status(statusCode).json(responseError);
        }
    }

    static async getCurrentUser(req: Request, res: Response): Promise<void> {
        // Assume 'req.user' is populated by a preceding authentication middleware
        // and contains at least the user's ID.
        const authenticatedUser = req.user as { id: string } | undefined; // Cast for clarity

        if (!authenticatedUser || !authenticatedUser.id) {
            // This case should ideally be handled by the authentication middleware itself.
            // If it reaches here, it means auth middleware might not be set up correctly or failed silently.
            res.status(401).json({ error: 'Unauthorized: No valid user session.' });
            return;
        }

        try {
            console.log(`[CONTROLLER_ACCOUNTS] Getting current user profile for ID: ${authenticatedUser.id}`);
            const userProfile = await AuthService.getAuthenticatedUserProfile(authenticatedUser.id);
            console.log("[CONTROLLER_ACCOUNTS] Profile retrieved from service.");
            res.status(200).json(userProfile);
        } catch (error: any) {
            console.error('[CONTROLLER_ACCOUNTS] Error getting current user:', error.message);
            const statusCode = error.statusCode || 500;
            res.status(statusCode).json({ error: error.message || 'Internal server error' });
        }
    }

    static async refreshTokens(req: Request, res: Response): Promise<void> {
        const { refresh_token: refreshTokenString } = req.body;

        if (!refreshTokenString) {
            res.status(400).json({ error: 'Missing refresh token' });
            return;
        }

        try {
            console.log("[CONTROLLER_ACCOUNTS] Refreshing tokens. Token (partial):", refreshTokenString.substring(0,10) + "...");
            const newTokens = await AuthService.refreshAuthTokens(refreshTokenString);
            console.log("[CONTROLLER_ACCOUNTS] Tokens refreshed successfully by service.");
            res.status(200).json(newTokens);
        } catch (error: any) {
            console.error('[CONTROLLER_ACCOUNTS] Error refreshing tokens:', error.message);
            const statusCode = error.statusCode || 500;
            res.status(statusCode).json({ error: error.message || 'Internal server error' });
        }
    }
}
