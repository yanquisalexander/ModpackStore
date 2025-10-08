import { Context } from 'hono';
import { YggdrasilService, YggdrasilAuthenticateRequest, YggdrasilRefreshRequest, YggdrasilValidateRequest, YggdrasilInvalidateRequest } from '@/services/yggdrasil.service';
import { APIError } from '@/lib/APIError';
import { AuthVariables, USER_CONTEXT_KEY } from "@/middlewares/auth.middleware";

/**
 * Yggdrasil Controller
 * Handles Mojang/Yggdrasil authentication protocol endpoints for authlib-injector compatibility
 */
export class YggdrasilController {
    /**
     * POST /yggdrasil/authenticate
     * Authenticates a user and returns game session tokens
     * Requires ModpackStore JWT authentication
     */
    static async authenticate(c: Context<{ Variables: AuthVariables }>): Promise<Response> {
        const user = c.get(USER_CONTEXT_KEY);
        
        if (!user) {
            throw new APIError(401, 'Authentication required', 'UNAUTHORIZED');
        }

        const body = await c.req.json<YggdrasilAuthenticateRequest>();
        
        // Get profile name from query parameter or use user's username as default
        const profileName = c.req.query('profileName') || user.username;
        
        const response = await YggdrasilService.authenticate(
            user,
            profileName,
            body.clientToken
        );

        return c.json(response);
    }

    /**
     * POST /yggdrasil/refresh
     * Refreshes a game session token
     */
    static async refresh(c: Context): Promise<Response> {
        const body = await c.req.json<YggdrasilRefreshRequest>();

        if (!body.accessToken) {
            throw new APIError(400, 'Access token is required', 'MISSING_ACCESS_TOKEN');
        }

        const response = await YggdrasilService.refresh(
            body.accessToken,
            body.clientToken
        );

        return c.json(response);
    }

    /**
     * POST /yggdrasil/validate
     * Validates a game session token
     */
    static async validate(c: Context): Promise<Response> {
        const body = await c.req.json<YggdrasilValidateRequest>();

        if (!body.accessToken) {
            throw new APIError(400, 'Access token is required', 'MISSING_ACCESS_TOKEN');
        }

        await YggdrasilService.validate(body.accessToken, body.clientToken);

        // Yggdrasil protocol: 204 No Content on success
        return c.body(null, 204);
    }

    /**
     * POST /yggdrasil/invalidate
     * Invalidates a game session token (logout)
     */
    static async invalidate(c: Context): Promise<Response> {
        const body = await c.req.json<YggdrasilInvalidateRequest>();

        if (!body.accessToken) {
            throw new APIError(400, 'Access token is required', 'MISSING_ACCESS_TOKEN');
        }

        await YggdrasilService.invalidate(body.accessToken, body.clientToken);

        // Yggdrasil protocol: 204 No Content on success
        return c.body(null, 204);
    }

    /**
     * GET /yggdrasil/sessionserver/session/minecraft/profile/:uuid
     * Gets player profile for session server verification
     * Used by Minecraft servers to verify players joining
     */
    static async getProfile(c: Context): Promise<Response> {
        const uuid = c.req.param('uuid');

        if (!uuid) {
            throw new APIError(400, 'UUID is required', 'MISSING_UUID');
        }

        // Add dashes to UUID if needed (Mojang format)
        const formattedUuid = uuid.length === 32 ? this.addDashesToUUID(uuid) : uuid;

        const profile = await YggdrasilService.getProfile(formattedUuid);

        if (!profile) {
            return c.body(null, 204); // No Content if profile not found
        }

        return c.json(profile);
    }

    /**
     * GET /
     * Returns authlib-injector metadata
     */
    static async getMetadata(c: Context): Promise<Response> {
        // Get the server URL from environment or request
        const serverUrl = process.env.API_URL || `${c.req.url.split('/yggdrasil')[0]}`;
        
        const metadata = YggdrasilService.getMetadata(serverUrl);

        return c.json(metadata);
    }

    /**
     * Helper method to add dashes to UUID
     */
    private static addDashesToUUID(uuid: string): string {
        if (uuid.length !== 32) {
            return uuid;
        }
        return `${uuid.slice(0, 8)}-${uuid.slice(8, 12)}-${uuid.slice(12, 16)}-${uuid.slice(16, 20)}-${uuid.slice(20)}`;
    }
}
