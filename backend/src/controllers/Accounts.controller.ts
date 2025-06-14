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
import { serializeResource, serializeError } from "../utils/jsonapi"; // Updated import path

export class AccountsController {
    static async callbackDiscord(req: Request, res: Response, next: NextFunction): Promise<void> {
        const code = req.query.code as string;

        if (!code) {
            res.status(400).json(serializeError({
                status: '400',
                title: 'Bad Request',
                detail: 'Missing authorization code',
            }));
            return;
        }

        try {
            console.log("[CONTROLLER_ACCOUNTS][DISCORD] Callback received, calling AuthService. Code:", code.substring(0,10) + "..."); // Log only a portion of code
            const tokens = await AuthService.handleDiscordCallback(code); // Assuming tokens include id, accessToken, refreshToken
            console.log("[CONTROLLER_ACCOUNTS][DISCORD] Tokens received from service, sending to client.");
            // Assuming 'tokens' is an object that can be serialized. It might need an 'id' if it's treated as a resource.
            // For now, let's assume 'tokens' is a simple object not a full resource.
            // If tokens should be a resource (e.g. "auth-token"), it needs an id.
            // A common pattern is to return the user resource along with tokens, or just tokens.
            // Let's assume for now tokens are part of a "token" resource type with a generated/static ID.
            // This part might need adjustment based on how tokens are structured and if they need to be a JSON:API resource.
            // A simpler approach for tokens might be to return them in `meta` or as a non-standard JSON response if they don't fit resource model.
            // However, to strictly follow JSON:API, they should be a resource or part of one.
            // For this example, let's serialize it as a 'token' resource. The 'id' could be the user_id or a generated one.
            // If AuthService.handleDiscordCallback returns { userId, accessToken, refreshToken, ... }
            // We can use userId as id for the token resource.
            res.status(200).json(serializeResource('token', { id: tokens.userId || 'session', ...tokens }));
        } catch (error: any) {
            console.error('[CONTROLLER_ACCOUNTS][DISCORD] Error in callback:', error.message);
            const statusCode = error.statusCode || 500;
            res.status(statusCode).json(serializeError({
                status: statusCode.toString(),
                title: error.name || 'Authentication Error',
                detail: error.message || 'Internal server error',
                code: error.errorCode,
            }));
        }
    }

    static async getCurrentUser(req: Request, res: Response): Promise<void> {
        const authenticatedUser = req.user as { id: string } | undefined;

        if (!authenticatedUser || !authenticatedUser.id) {
            res.status(401).json(serializeError({
                status: '401',
                title: 'Unauthorized',
                detail: 'No valid user session.',
            }));
            return;
        }

        try {
            console.log(`[CONTROLLER_ACCOUNTS] Getting current user profile for ID: ${authenticatedUser.id}`);
            const userProfile = await AuthService.getAuthenticatedUserProfile(authenticatedUser.id); // Assuming this returns a user object with id
            console.log("[CONTROLLER_ACCOUNTS] Profile retrieved from service.");
            res.status(200).json(serializeResource('user', userProfile));
        } catch (error: any) {
            console.error('[CONTROLLER_ACCOUNTS] Error getting current user:', error.message);
            const statusCode = error.statusCode || 500;
            res.status(statusCode).json(serializeError({
                status: statusCode.toString(),
                title: error.name || 'User Profile Error',
                detail: error.message || 'Internal server error',
            }));
        }
    }

    static async refreshTokens(req: Request, res: Response): Promise<void> {
        const { refresh_token: refreshTokenString } = req.body;

        if (!refreshTokenString) {
            res.status(400).json(serializeError({
                status: '400',
                title: 'Bad Request',
                detail: 'Missing refresh token',
            }));
            return;
        }

        try {
            console.log("[CONTROLLER_ACCOUNTS] Refreshing tokens. Token (partial):", refreshTokenString.substring(0,10) + "...");
            const newTokens = await AuthService.refreshAuthTokens(refreshTokenString); // Assume this returns { userId, accessToken, refreshToken, ... }
            console.log("[CONTROLLER_ACCOUNTS] Tokens refreshed successfully by service.");
            // Similar to discord callback, serializing as a 'token' resource.
            res.status(200).json(serializeResource('token', { id: newTokens.userId || 'session-refreshed', ...newTokens }));
        } catch (error: any) {
            console.error('[CONTROLLER_ACCOUNTS] Error refreshing tokens:', error.message);
            const statusCode = error.statusCode || 500;
            res.status(statusCode).json(serializeError({
                status: statusCode.toString(),
                title: error.name || 'Token Refresh Error',
                detail: error.message || 'Internal server error',
                code: error.errorCode,
            }));
        }
    }
}
