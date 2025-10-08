import { Context } from "hono";
import { YggdrasilService } from "@/services/yggdrasil.service";
import { APIError } from "@/lib/APIError";

export class YggdrasilController {
    /**
     * POST /yggdrasil/authenticate
     * Authenticates a user and returns session tokens
     */
    static async authenticate(c: Context) {
        try {
            const body = await c.req.json();
            const { userId, clientToken, username } = body;

            if (!userId) {
                throw new APIError(400, "Missing userId", "MISSING_USER_ID");
            }

            const result = await YggdrasilService.authenticate(userId, clientToken, username);

            return c.json(result);
        } catch (error) {
            if (error instanceof APIError) {
                return c.json({
                    error: error.code,
                    errorMessage: error.message
                }, error.statusCode);
            }

            return c.json({
                error: "INTERNAL_ERROR",
                errorMessage: "Internal server error"
            }, 500);
        }
    }

    /**
     * POST /yggdrasil/refresh
     * Refreshes an access token
     */
    static async refresh(c: Context) {
        try {
            const body = await c.req.json();
            const { accessToken, clientToken } = body;

            if (!accessToken || !clientToken) {
                throw new APIError(400, "Missing accessToken or clientToken", "MISSING_TOKENS");
            }

            const result = await YggdrasilService.refresh(accessToken, clientToken);

            return c.json(result);
        } catch (error) {
            if (error instanceof APIError) {
                return c.json({
                    error: error.code,
                    errorMessage: error.message
                }, error.statusCode);
            }

            return c.json({
                error: "INTERNAL_ERROR",
                errorMessage: "Internal server error"
            }, 500);
        }
    }

    /**
     * POST /yggdrasil/validate
     * Validates an access token
     */
    static async validate(c: Context) {
        try {
            const body = await c.req.json();
            const { accessToken, clientToken } = body;

            if (!accessToken) {
                throw new APIError(400, "Missing accessToken", "MISSING_ACCESS_TOKEN");
            }

            const isValid = await YggdrasilService.validate(accessToken, clientToken);

            if (!isValid) {
                return c.json({
                    error: "INVALID_TOKEN",
                    errorMessage: "Token is invalid or expired"
                }, 403);
            }

            return c.body(null, 204);
        } catch (error) {
            if (error instanceof APIError) {
                return c.json({
                    error: error.code,
                    errorMessage: error.message
                }, error.statusCode);
            }

            return c.json({
                error: "INTERNAL_ERROR",
                errorMessage: "Internal server error"
            }, 500);
        }
    }

    /**
     * POST /yggdrasil/invalidate
     * Invalidates an access token
     */
    static async invalidate(c: Context) {
        try {
            const body = await c.req.json();
            const { accessToken, clientToken } = body;

            if (!accessToken || !clientToken) {
                throw new APIError(400, "Missing accessToken or clientToken", "MISSING_TOKENS");
            }

            await YggdrasilService.invalidate(accessToken, clientToken);

            return c.body(null, 204);
        } catch (error) {
            if (error instanceof APIError) {
                return c.json({
                    error: error.code,
                    errorMessage: error.message
                }, error.statusCode);
            }

            return c.json({
                error: "INTERNAL_ERROR",
                errorMessage: "Internal server error"
            }, 500);
        }
    }

    /**
     * POST /yggdrasil/signout
     * Signs out all sessions for a user
     */
    static async signout(c: Context) {
        try {
            const body = await c.req.json();
            const { username, password } = body;

            if (!username || !password) {
                throw new APIError(400, "Missing username or password", "MISSING_CREDENTIALS");
            }

            await YggdrasilService.signout(username, password);

            return c.body(null, 204);
        } catch (error) {
            if (error instanceof APIError) {
                return c.json({
                    error: error.code,
                    errorMessage: error.message
                }, error.statusCode);
            }

            return c.json({
                error: "INTERNAL_ERROR",
                errorMessage: "Internal server error"
            }, 500);
        }
    }

    /**
     * POST /yggdrasil/session/minecraft/join
     * Called when a client joins a server
     */
    static async joinServer(c: Context) {
        try {
            const body = await c.req.json();
            const { accessToken, selectedProfile, serverId } = body;

            if (!accessToken || !selectedProfile || !serverId) {
                throw new APIError(400, "Missing required parameters", "MISSING_PARAMETERS");
            }

            await YggdrasilService.joinServer(accessToken, selectedProfile, serverId);

            return c.body(null, 204);
        } catch (error) {
            if (error instanceof APIError) {
                return c.json({
                    error: error.code,
                    errorMessage: error.message
                }, error.statusCode);
            }

            return c.json({
                error: "INTERNAL_ERROR",
                errorMessage: "Internal server error"
            }, 500);
        }
    }

    /**
     * GET /yggdrasil/session/minecraft/hasJoined
     * Called by server to verify a client
     */
    static async hasJoined(c: Context) {
        try {
            const username = c.req.query('username');
            const serverId = c.req.query('serverId');
            const ip = c.req.query('ip');

            if (!username || !serverId) {
                throw new APIError(400, "Missing username or serverId", "MISSING_PARAMETERS");
            }

            const profile = await YggdrasilService.hasJoined(username, serverId, ip);

            if (!profile) {
                return c.body(null, 204);
            }

            return c.json(profile);
        } catch (error) {
            if (error instanceof APIError) {
                return c.json({
                    error: error.code,
                    errorMessage: error.message
                }, error.statusCode);
            }

            return c.json({
                error: "INTERNAL_ERROR",
                errorMessage: "Internal server error"
            }, 500);
        }
    }

    /**
     * GET /yggdrasil/profile/:uuid
     * Gets a user profile by UUID
     */
    static async getProfile(c: Context) {
        try {
            const uuid = c.req.param('uuid');

            if (!uuid) {
                throw new APIError(400, "Missing UUID", "MISSING_UUID");
            }

            const profile = await YggdrasilService.getProfile(uuid);

            if (!profile) {
                return c.body(null, 204);
            }

            return c.json(profile);
        } catch (error) {
            if (error instanceof APIError) {
                return c.json({
                    error: error.code,
                    errorMessage: error.message
                }, error.statusCode);
            }

            return c.json({
                error: "INTERNAL_ERROR",
                errorMessage: "Internal server error"
            }, 500);
        }
    }

    /**
     * GET /yggdrasil/
     * Metadata endpoint for authlib-injector
     */
    static async metadata(c: Context) {
        const baseUrl = `${c.req.url.split('/yggdrasil')[0]}/yggdrasil`;
        
        return c.json({
            meta: {
                serverName: "ModpackStore Yggdrasil",
                implementationName: "ModpackStore",
                implementationVersion: "1.0.0",
                links: {
                    homepage: "https://modpackstore.com",
                    register: "https://modpackstore.com/auth"
                },
                "feature.non_email_login": true
            },
            skinDomains: [
                "modpackstore.com",
                ".modpackstore.com"
            ],
            signaturePublickey: null
        });
    }
}
