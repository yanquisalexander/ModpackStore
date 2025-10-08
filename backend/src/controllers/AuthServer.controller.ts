import { Context } from "hono";
import { User } from "@/entities/User";
import { GameSessionService } from "@/services/game-session.service";
import { verify } from "jsonwebtoken";
import { TokenPayload } from "@/services/auth.service";
import { APIError } from "@/lib/APIError";

const JWT_SECRET = process.env.JWT_SECRET!;
const AUTH_SERVER_NAME = process.env.AUTH_SERVER_NAME || "Modpack Store Auth Server";
const AUTH_SERVER_URL = process.env.AUTH_SERVER_URL || "http://localhost:3000";

/**
 * AuthServer Controller - Implements Yggdrasil authentication protocol
 * Compatible with authlib-injector for Minecraft authentication
 */
export class AuthServerController {
    /**
     * GET / - AuthServer metadata endpoint for authlib-injector discovery
     */
    static async getMetadata(c: Context) {
        const baseUrl = AUTH_SERVER_URL;
        
        return c.json({
            meta: {
                serverName: AUTH_SERVER_NAME,
                implementationName: "Modpack Store Yggdrasil",
                implementationVersion: "1.0.0",
                "feature.non_email_login": true
            },
            skinDomains: [
                // Add skin domains if you have a skin server
                // "textures.modpackstore.com"
            ],
            signaturePublickey: null, // We don't use signature verification for now
        });
    }

    /**
     * POST /authenticate - Authenticate and get access token
     * 
     * Request body:
     * {
     *   "agent": { "name": "Minecraft", "version": 1 },
     *   "username": "modpackstore_jwt_token",
     *   "password": "not_used",
     *   "clientToken": "client-generated-uuid",
     *   "requestUser": true
     * }
     * 
     * For Modpack Store, the "username" field should contain the JWT access token
     */
    static async authenticate(c: Context) {
        try {
            const body = await c.req.json();
            const { username, password, clientToken, requestUser } = body;

            if (!username) {
                return c.json({
                    error: "ForbiddenOperationException",
                    errorMessage: "Invalid credentials. Username is required."
                }, 403);
            }

            // The username contains the JWT token from Modpack Store
            let userId: string;
            try {
                const decoded = verify(username, JWT_SECRET) as TokenPayload;
                userId = decoded.sub;
            } catch (err) {
                return c.json({
                    error: "ForbiddenOperationException",
                    errorMessage: "Invalid credentials. Invalid token."
                }, 403);
            }

            // Get user
            const user = await User.findOne({ where: { id: userId } });
            if (!user) {
                return c.json({
                    error: "ForbiddenOperationException",
                    errorMessage: "Invalid credentials. User not found."
                }, 403);
            }

            // Extract custom nickname from password field if provided
            // Format: "nickname:custom_nick" or just use username
            let profileName = user.username;
            if (password && password.startsWith("nickname:")) {
                const customNick = password.substring(9);
                if (customNick && customNick.length >= 3 && customNick.length <= 16) {
                    profileName = customNick;
                }
            }

            // Create game session
            const session = await GameSessionService.createSession(
                user,
                clientToken,
                profileName
            );

            const response: any = {
                accessToken: session.accessToken,
                clientToken: session.clientToken || clientToken,
                availableProfiles: [
                    {
                        id: session.profileId,
                        name: session.profileName
                    }
                ],
                selectedProfile: {
                    id: session.profileId,
                    name: session.profileName
                }
            };

            if (requestUser) {
                response.user = {
                    id: user.id,
                    properties: []
                };
            }

            return c.json(response);
        } catch (error) {
            console.error("[AuthServer] Authenticate error:", error);
            return c.json({
                error: "ForbiddenOperationException",
                errorMessage: error instanceof Error ? error.message : "Authentication failed"
            }, 403);
        }
    }

    /**
     * POST /refresh - Refresh access token
     * 
     * Request body:
     * {
     *   "accessToken": "current-access-token",
     *   "clientToken": "client-uuid",
     *   "requestUser": true
     * }
     */
    static async refresh(c: Context) {
        try {
            const body = await c.req.json();
            const { accessToken, clientToken, requestUser } = body;

            if (!accessToken) {
                return c.json({
                    error: "IllegalArgumentException",
                    errorMessage: "Access token is required"
                }, 400);
            }

            // Refresh the session
            const newSession = await GameSessionService.refreshSession(
                accessToken,
                clientToken
            );

            const response: any = {
                accessToken: newSession.accessToken,
                clientToken: newSession.clientToken || clientToken,
                selectedProfile: {
                    id: newSession.profileId,
                    name: newSession.profileName
                }
            };

            if (requestUser) {
                response.user = {
                    id: newSession.userId,
                    properties: []
                };
            }

            return c.json(response);
        } catch (error) {
            console.error("[AuthServer] Refresh error:", error);
            return c.json({
                error: "ForbiddenOperationException",
                errorMessage: error instanceof Error ? error.message : "Token refresh failed"
            }, 403);
        }
    }

    /**
     * POST /validate - Validate access token
     * 
     * Request body:
     * {
     *   "accessToken": "token-to-validate",
     *   "clientToken": "client-uuid"
     * }
     */
    static async validate(c: Context) {
        try {
            const body = await c.req.json();
            const { accessToken, clientToken } = body;

            if (!accessToken) {
                return c.json({
                    error: "IllegalArgumentException",
                    errorMessage: "Access token is required"
                }, 400);
            }

            const isValid = await GameSessionService.validateSession(
                accessToken,
                clientToken
            );

            if (!isValid) {
                return c.json({
                    error: "ForbiddenOperationException",
                    errorMessage: "Invalid token"
                }, 403);
            }

            // Valid tokens return 204 No Content
            return c.body(null, 204);
        } catch (error) {
            console.error("[AuthServer] Validate error:", error);
            return c.json({
                error: "ForbiddenOperationException",
                errorMessage: "Token validation failed"
            }, 403);
        }
    }

    /**
     * POST /invalidate - Invalidate access token
     * 
     * Request body:
     * {
     *   "accessToken": "token-to-invalidate",
     *   "clientToken": "client-uuid"
     * }
     */
    static async invalidate(c: Context) {
        try {
            const body = await c.req.json();
            const { accessToken, clientToken } = body;

            if (!accessToken) {
                return c.body(null, 204); // No token provided, nothing to invalidate
            }

            await GameSessionService.invalidateSession(accessToken, clientToken);
            return c.body(null, 204);
        } catch (error) {
            console.error("[AuthServer] Invalidate error:", error);
            // Even on error, return 204 for invalidate
            return c.body(null, 204);
        }
    }

    /**
     * POST /signout - Sign out user (invalidate all sessions)
     * 
     * Request body:
     * {
     *   "username": "jwt-token",
     *   "password": "not_used"
     * }
     */
    static async signout(c: Context) {
        try {
            const body = await c.req.json();
            const { username } = body;

            if (!username) {
                return c.body(null, 204);
            }

            // Username contains JWT token
            try {
                const decoded = verify(username, JWT_SECRET) as TokenPayload;
                await GameSessionService.signOutUser(decoded.sub);
            } catch (err) {
                // Invalid token, but still return success
            }

            return c.body(null, 204);
        } catch (error) {
            console.error("[AuthServer] Signout error:", error);
            return c.body(null, 204);
        }
    }
}
