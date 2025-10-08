import { Context } from "hono";
import { YggdrasilService } from "@/services/yggdrasil.service";
import { APIError } from "@/lib/APIError";

export class YggdrasilController {
    /**
     * POST /yggdrasil/authenticate
     * Authenticate with ModpackStore JWT and get Yggdrasil tokens
     */
    static async authenticate(c: Context) {
        try {
            const body = await c.req.json();
            const { username, password, clientToken, requestUser } = body;

            // In ModpackStore, we expect JWT token in the Authorization header
            // OR in the "password" field for compatibility
            const authHeader = c.req.header('Authorization');
            let jwtToken: string | undefined;

            if (authHeader && authHeader.startsWith('Bearer ')) {
                jwtToken = authHeader.substring(7);
            } else if (password) {
                jwtToken = password; // Password field contains JWT
            }

            if (!jwtToken) {
                throw new APIError(401, 'JWT token is required.', 'MISSING_JWT');
            }

            const response = await YggdrasilService.authenticate(
                jwtToken,
                clientToken,
                username // This is the requested username (ms_nickname)
            );

            return c.json(response, 200);
        } catch (error) {
            if (error instanceof APIError) {
                return c.json({
                    error: error.code,
                    errorMessage: error.message
                }, error.statusCode);
            }
            console.error('[YggdrasilController] Authenticate error:', error);
            return c.json({
                error: 'INTERNAL_ERROR',
                errorMessage: 'An internal error occurred.'
            }, 500);
        }
    }

    /**
     * POST /yggdrasil/refresh
     * Refresh access token
     */
    static async refresh(c: Context) {
        try {
            const body = await c.req.json();
            const { accessToken, clientToken } = body;

            if (!accessToken || !clientToken) {
                throw new APIError(400, 'accessToken and clientToken are required.', 'MISSING_CREDENTIALS');
            }

            const response = await YggdrasilService.refresh(accessToken, clientToken);
            return c.json(response, 200);
        } catch (error) {
            if (error instanceof APIError) {
                return c.json({
                    error: error.code,
                    errorMessage: error.message
                }, error.statusCode);
            }
            console.error('[YggdrasilController] Refresh error:', error);
            return c.json({
                error: 'INTERNAL_ERROR',
                errorMessage: 'An internal error occurred.'
            }, 500);
        }
    }

    /**
     * POST /yggdrasil/validate
     * Validate access token
     */
    static async validate(c: Context) {
        try {
            const body = await c.req.json();
            const { accessToken, clientToken } = body;

            if (!accessToken) {
                throw new APIError(400, 'accessToken is required.', 'MISSING_TOKEN');
            }

            const isValid = await YggdrasilService.validate(accessToken, clientToken);

            if (!isValid) {
                return c.json({
                    error: 'INVALID_TOKEN',
                    errorMessage: 'Invalid or expired token.'
                }, 403);
            }

            // Yggdrasil validate returns 204 No Content on success
            return c.body(null, 204);
        } catch (error) {
            if (error instanceof APIError) {
                return c.json({
                    error: error.code,
                    errorMessage: error.message
                }, error.statusCode);
            }
            console.error('[YggdrasilController] Validate error:', error);
            return c.json({
                error: 'INTERNAL_ERROR',
                errorMessage: 'An internal error occurred.'
            }, 500);
        }
    }

    /**
     * POST /yggdrasil/invalidate
     * Invalidate access token (logout)
     */
    static async invalidate(c: Context) {
        try {
            const body = await c.req.json();
            const { accessToken, clientToken } = body;

            if (!accessToken || !clientToken) {
                throw new APIError(400, 'accessToken and clientToken are required.', 'MISSING_CREDENTIALS');
            }

            await YggdrasilService.invalidate(accessToken, clientToken);

            // Yggdrasil invalidate returns 204 No Content on success
            return c.body(null, 204);
        } catch (error) {
            if (error instanceof APIError) {
                return c.json({
                    error: error.code,
                    errorMessage: error.message
                }, error.statusCode);
            }
            console.error('[YggdrasilController] Invalidate error:', error);
            return c.json({
                error: 'INTERNAL_ERROR',
                errorMessage: 'An internal error occurred.'
            }, 500);
        }
    }

    /**
     * POST /yggdrasil/signout
     * Sign out all sessions
     */
    static async signout(c: Context) {
        try {
            const body = await c.req.json();
            const { username, password } = body;

            if (!username || !password) {
                throw new APIError(400, 'username and password are required.', 'MISSING_CREDENTIALS');
            }

            await YggdrasilService.signout(username, password);

            // Yggdrasil signout returns 204 No Content on success
            return c.body(null, 204);
        } catch (error) {
            if (error instanceof APIError) {
                return c.json({
                    error: error.code,
                    errorMessage: error.message
                }, error.statusCode);
            }
            console.error('[YggdrasilController] Signout error:', error);
            return c.json({
                error: 'INTERNAL_ERROR',
                errorMessage: 'An internal error occurred.'
            }, 500);
        }
    }

    /**
     * POST /yggdrasil/session/minecraft/join
     * Called by Minecraft client when joining a server
     */
    static async joinServer(c: Context) {
        try {
            const body = await c.req.json();
            const { accessToken, selectedProfile, serverId } = body;

            if (!accessToken || !selectedProfile || !serverId) {
                throw new APIError(400, 'accessToken, selectedProfile, and serverId are required.', 'MISSING_CREDENTIALS');
            }

            // Get IP address from request
            const ipAddress = c.req.header('X-Forwarded-For') || c.req.header('X-Real-IP');

            await YggdrasilService.joinServer(accessToken, selectedProfile, serverId, ipAddress);

            // Yggdrasil join returns 204 No Content on success
            return c.body(null, 204);
        } catch (error) {
            if (error instanceof APIError) {
                return c.json({
                    error: error.code,
                    errorMessage: error.message
                }, error.statusCode);
            }
            console.error('[YggdrasilController] Join server error:', error);
            return c.json({
                error: 'INTERNAL_ERROR',
                errorMessage: 'An internal error occurred.'
            }, 500);
        }
    }

    /**
     * GET /yggdrasil/session/minecraft/hasJoined
     * Called by Minecraft server to verify player session
     */
    static async hasJoined(c: Context) {
        try {
            const username = c.req.query('username');
            const serverId = c.req.query('serverId');
            const ip = c.req.query('ip');

            if (!username || !serverId) {
                throw new APIError(400, 'username and serverId are required.', 'MISSING_PARAMETERS');
            }

            const profile = await YggdrasilService.hasJoined(username, serverId, ip);

            if (!profile) {
                // Return 204 No Content if session not found or invalid
                return c.body(null, 204);
            }

            return c.json(profile, 200);
        } catch (error) {
            if (error instanceof APIError) {
                return c.json({
                    error: error.code,
                    errorMessage: error.message
                }, error.statusCode);
            }
            console.error('[YggdrasilController] Has joined error:', error);
            return c.json({
                error: 'INTERNAL_ERROR',
                errorMessage: 'An internal error occurred.'
            }, 500);
        }
    }

    /**
     * GET /yggdrasil/session/minecraft/profile/:uuid
     * Get player profile by UUID
     */
    static async getProfile(c: Context) {
        try {
            const uuid = c.req.param('uuid');
            const unsigned = c.req.query('unsigned') === 'true';

            if (!uuid) {
                throw new APIError(400, 'UUID is required.', 'MISSING_UUID');
            }

            const profile = await YggdrasilService.getProfile(uuid, unsigned);

            if (!profile) {
                return c.json({
                    error: 'PROFILE_NOT_FOUND',
                    errorMessage: 'Profile not found.'
                }, 404);
            }

            return c.json(profile, 200);
        } catch (error) {
            if (error instanceof APIError) {
                return c.json({
                    error: error.code,
                    errorMessage: error.message
                }, error.statusCode);
            }
            console.error('[YggdrasilController] Get profile error:', error);
            return c.json({
                error: 'INTERNAL_ERROR',
                errorMessage: 'An internal error occurred.'
            }, 500);
        }
    }

    /**
     * GET /yggdrasil
     * Return Yggdrasil server metadata
     */
    static async metadata(c: Context) {
        return c.json({
            meta: {
                serverName: "ModpackStore Yggdrasil",
                implementationName: "ModpackStore Yggdrasil",
                implementationVersion: "1.0.0",
                "feature.non_email_login": true
            },
            skinDomains: ["*"],
            signaturePublickey: null
        }, 200);
    }
}
