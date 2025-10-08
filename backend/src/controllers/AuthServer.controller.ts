import { Context } from 'hono';
import { AuthServerService } from '@/services/authserver.service';
import { APIError } from '@/lib/APIError';

export class AuthServerController {
    /**
     * POST /authserver/authenticate
     * Authenticate a user with username and password (JWT token)
     */
    static async authenticate(c: Context): Promise<Response> {
        const body = await c.req.json();
        const { username, password, clientToken, requestUser } = body;

        if (!username || !password) {
            throw new APIError(400, 'Missing username or password', 'MISSING_CREDENTIALS');
        }

        const response = await AuthServerService.authenticate(
            username,
            password,
            clientToken,
            requestUser
        );

        return c.json(response);
    }

    /**
     * POST /authserver/refresh
     * Refresh an access token
     */
    static async refresh(c: Context): Promise<Response> {
        const body = await c.req.json();
        const { accessToken, clientToken, requestUser } = body;

        if (!accessToken || !clientToken) {
            throw new APIError(400, 'Missing accessToken or clientToken', 'MISSING_TOKEN');
        }

        const response = await AuthServerService.refresh(
            accessToken,
            clientToken,
            requestUser
        );

        return c.json(response);
    }

    /**
     * POST /authserver/validate
     * Validate an access token
     */
    static async validate(c: Context): Promise<Response> {
        const body = await c.req.json();
        const { accessToken, clientToken } = body;

        if (!accessToken) {
            throw new APIError(400, 'Missing accessToken', 'MISSING_TOKEN');
        }

        const isValid = await AuthServerService.validate(accessToken, clientToken);

        if (!isValid) {
            throw new APIError(403, 'Invalid token', 'INVALID_TOKEN');
        }

        // Yggdrasil returns 204 No Content on success
        return c.body(null, 204);
    }

    /**
     * POST /authserver/invalidate
     * Invalidate an access token
     */
    static async invalidate(c: Context): Promise<Response> {
        const body = await c.req.json();
        const { accessToken, clientToken } = body;

        if (!accessToken || !clientToken) {
            throw new APIError(400, 'Missing accessToken or clientToken', 'MISSING_TOKEN');
        }

        await AuthServerService.invalidate(accessToken, clientToken);

        // Yggdrasil returns 204 No Content on success
        return c.body(null, 204);
    }

    /**
     * POST /authserver/signout
     * Sign out all sessions for a user
     */
    static async signout(c: Context): Promise<Response> {
        const body = await c.req.json();
        const { username, password } = body;

        if (!username || !password) {
            throw new APIError(400, 'Missing username or password', 'MISSING_CREDENTIALS');
        }

        await AuthServerService.signout(username, password);

        // Yggdrasil returns 204 No Content on success
        return c.body(null, 204);
    }

    /**
     * GET /authserver/
     * Get authserver metadata for authlib-injector
     */
    static async getMetadata(c: Context): Promise<Response> {
        // Get base URL from request
        const protocol = c.req.header('x-forwarded-proto') || 'http';
        const host = c.req.header('host') || 'localhost';
        const baseUrl = `${protocol}://${host}`;

        const metadata = AuthServerService.getMetadata(baseUrl);
        return c.json(metadata);
    }

    /**
     * GET /sessionserver/session/minecraft/profile/:uuid
     * Get profile by UUID (used by Minecraft servers)
     */
    static async getProfile(c: Context): Promise<Response> {
        const uuid = c.req.param('uuid');

        if (!uuid) {
            throw new APIError(400, 'Missing UUID', 'MISSING_UUID');
        }

        const profile = await AuthServerService.getProfile(uuid);

        if (!profile) {
            return c.body(null, 204); // No content if profile not found
        }

        return c.json(profile);
    }

    /**
     * POST /sessionserver/session/minecraft/join
     * Join a server (session validation)
     */
    static async joinServer(c: Context): Promise<Response> {
        const body = await c.req.json();
        const { accessToken, selectedProfile, serverId } = body;

        if (!accessToken || !selectedProfile || !serverId) {
            throw new APIError(400, 'Missing required fields', 'MISSING_FIELDS');
        }

        // Validate the access token
        const isValid = await AuthServerService.validate(accessToken);

        if (!isValid) {
            throw new APIError(403, 'Invalid token', 'INVALID_TOKEN');
        }

        // In a full implementation, you would store the server join request
        // For now, we just validate the token
        return c.body(null, 204);
    }

    /**
     * GET /sessionserver/session/minecraft/hasJoined
     * Check if a player has joined a server
     */
    static async hasJoined(c: Context): Promise<Response> {
        const username = c.req.query('username');
        const serverId = c.req.query('serverId');

        if (!username || !serverId) {
            throw new APIError(400, 'Missing username or serverId', 'MISSING_FIELDS');
        }

        // In a full implementation, you would check the stored join requests
        // For now, we just return the profile if it exists
        const profile = await AuthServerService.getProfile(username);

        if (!profile) {
            return c.body(null, 204);
        }

        return c.json(profile);
    }
}
