import { Context } from 'hono';
import { GameSession } from '@/entities/GameSession';
import { User } from '@/entities/User';
import { APIError } from '@/lib/APIError';
import { v4 as uuidv4 } from 'uuid';
import { AuthVariables, USER_CONTEXT_KEY } from '@/middlewares/auth.middleware';

/**
 * Yggdrasil-compatible authentication server controller
 * Implements the authentication protocol used by authlib-injector
 */
export class AuthServerController {
    /**
     * GET /authserver - Metadata endpoint for authlib-injector discovery
     */
    static async getMetadata(c: Context): Promise<Response> {
        const baseUrl = c.req.url.replace(/\/authserver.*$/, '');
        
        return c.json({
            meta: {
                serverName: "Modpack Store AuthServer",
                implementationName: "modpackstore-yggdrasil",
                implementationVersion: "1.0.0",
                feature: {
                    "non_email_login": true,
                    "legacy_skin_api": false,
                    "no_mojang_namespace": true
                }
            },
            skinDomains: [
                "modpackstore.com",
                `.${new URL(baseUrl).hostname}`
            ],
            signaturePublickey: "" // Not implementing signature verification for now
        });
    }

    /**
     * POST /authserver/authenticate - Generate game session token
     * Takes JWT access token and returns Yggdrasil-compatible response
     */
    static async authenticate(c: Context<{ Variables: AuthVariables }>): Promise<Response> {
        const user = c.get(USER_CONTEXT_KEY) as User;
        
        if (!user) {
            throw new APIError(401, 'Unauthorized', 'UNAUTHORIZED');
        }

        const body = await c.req.json().catch(() => ({}));
        const clientToken = body.clientToken || uuidv4();
        const customNickname = body.username || null; // Allow custom nickname via username field

        // Validate custom nickname if provided
        if (customNickname) {
            if (customNickname.length < 3 || customNickname.length > 16) {
                throw new APIError(400, 'Invalid username length (must be 3-16 characters)', 'INVALID_USERNAME');
            }
            if (!/^[a-zA-Z0-9_]+$/.test(customNickname)) {
                throw new APIError(400, 'Invalid username format (only alphanumeric and underscore)', 'INVALID_USERNAME');
            }
        }

        // Create new game session
        const accessToken = uuidv4();
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours max

        const gameSession = GameSession.create({
            userId: user.id,
            accessToken,
            clientToken,
            customNickname,
            expiresAt,
            isValid: true,
            lastActivityAt: new Date()
        });

        await gameSession.save();

        // Return Yggdrasil-compatible response
        return c.json({
            accessToken,
            clientToken,
            availableProfiles: [
                {
                    id: user.id.replace(/-/g, ''), // UUID without dashes
                    name: customNickname || user.username
                }
            ],
            selectedProfile: {
                id: user.id.replace(/-/g, ''),
                name: customNickname || user.username
            },
            user: {
                id: user.id.replace(/-/g, ''),
                properties: []
            }
        });
    }

    /**
     * POST /authserver/refresh - Refresh game session token
     */
    static async refresh(c: Context): Promise<Response> {
        const body = await c.req.json().catch(() => ({}));
        const { accessToken, clientToken } = body;

        if (!accessToken) {
            throw new APIError(400, 'Access token is required', 'MISSING_ACCESS_TOKEN');
        }

        const gameSession = await GameSession.findOne({
            where: { accessToken, isValid: true },
            relations: ['user']
        });

        if (!gameSession || gameSession.isExpired()) {
            throw new APIError(401, 'Invalid or expired session', 'INVALID_SESSION');
        }

        // Optionally verify client token if provided
        if (clientToken && gameSession.clientToken !== clientToken) {
            throw new APIError(403, 'Client token mismatch', 'CLIENT_TOKEN_MISMATCH');
        }

        // Generate new access token
        const newAccessToken = uuidv4();
        const oldSession = gameSession;
        
        // Invalidate old session
        oldSession.isValid = false;
        await oldSession.save();

        // Create new session
        const newSession = GameSession.create({
            userId: gameSession.userId,
            accessToken: newAccessToken,
            clientToken: gameSession.clientToken,
            customNickname: gameSession.customNickname,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            isValid: true,
            lastActivityAt: new Date()
        });

        await newSession.save();

        // Return refreshed tokens
        return c.json({
            accessToken: newAccessToken,
            clientToken: newSession.clientToken,
            selectedProfile: {
                id: gameSession.user.id.replace(/-/g, ''),
                name: gameSession.customNickname || gameSession.user.username
            },
            user: {
                id: gameSession.user.id.replace(/-/g, ''),
                properties: []
            }
        });
    }

    /**
     * POST /authserver/validate - Validate game session token
     */
    static async validate(c: Context): Promise<Response> {
        const body = await c.req.json().catch(() => ({}));
        const { accessToken, clientToken } = body;

        if (!accessToken) {
            throw new APIError(400, 'Access token is required', 'MISSING_ACCESS_TOKEN');
        }

        const gameSession = await GameSession.findOne({
            where: { accessToken, isValid: true }
        });

        if (!gameSession || gameSession.isExpired()) {
            throw new APIError(403, 'Invalid or expired session', 'INVALID_SESSION');
        }

        // Optionally verify client token
        if (clientToken && gameSession.clientToken !== clientToken) {
            throw new APIError(403, 'Client token mismatch', 'CLIENT_TOKEN_MISMATCH');
        }

        // Update activity
        gameSession.updateActivity();
        await gameSession.save();

        // Return 204 No Content for valid session (Yggdrasil spec)
        return c.body(null, 204);
    }

    /**
     * POST /authserver/invalidate - Invalidate a game session (logout)
     */
    static async invalidate(c: Context): Promise<Response> {
        const body = await c.req.json().catch(() => ({}));
        const { accessToken, clientToken } = body;

        if (!accessToken) {
            throw new APIError(400, 'Access token is required', 'MISSING_ACCESS_TOKEN');
        }

        const gameSession = await GameSession.findOne({
            where: { accessToken, isValid: true }
        });

        if (gameSession) {
            // Optionally verify client token
            if (clientToken && gameSession.clientToken !== clientToken) {
                throw new APIError(403, 'Client token mismatch', 'CLIENT_TOKEN_MISMATCH');
            }

            gameSession.isValid = false;
            await gameSession.save();
        }

        // Return 204 No Content (Yggdrasil spec)
        return c.body(null, 204);
    }

    /**
     * POST /authserver/signout - Sign out from all sessions
     */
    static async signout(c: Context): Promise<Response> {
        const body = await c.req.json().catch(() => ({}));
        const { username, password } = body;

        // For now, we don't use password auth, so we'll require a valid JWT in header
        // This is a deviation from standard Yggdrasil but necessary for our architecture
        throw new APIError(501, 'Signout not implemented - use invalidate instead', 'NOT_IMPLEMENTED');
    }

    /**
     * GET /sessionserver/session/minecraft/profile/:uuid - Get game profile
     * Used by Minecraft servers to validate player sessions
     */
    static async getProfile(c: Context): Promise<Response> {
        const uuid = c.req.param('uuid');
        
        if (!uuid) {
            throw new APIError(400, 'UUID is required', 'MISSING_UUID');
        }

        // Add dashes back to UUID if needed
        const formattedUuid = uuid.length === 32
            ? `${uuid.slice(0, 8)}-${uuid.slice(8, 12)}-${uuid.slice(12, 16)}-${uuid.slice(16, 20)}-${uuid.slice(20)}`
            : uuid;

        const user = await User.findOne({ where: { id: formattedUuid } });

        if (!user) {
            return c.body(null, 204); // No content if user not found
        }

        // Find active session for this user (if any) to get custom nickname
        const activeSession = await GameSession.findOne({
            where: { userId: user.id, isValid: true },
            order: { lastActivityAt: 'DESC' }
        });

        return c.json({
            id: user.id.replace(/-/g, ''),
            name: activeSession?.customNickname || user.username,
            properties: [
                // Add skin/cape properties here if needed
            ]
        });
    }

    /**
     * POST /sessionserver/session/minecraft/join - Join server (server-side validation)
     */
    static async joinServer(c: Context): Promise<Response> {
        const body = await c.req.json().catch(() => ({}));
        const { accessToken, selectedProfile, serverId } = body;

        if (!accessToken || !selectedProfile || !serverId) {
            throw new APIError(400, 'Missing required parameters', 'MISSING_PARAMETERS');
        }

        const gameSession = await GameSession.findOne({
            where: { accessToken, isValid: true },
            relations: ['user']
        });

        if (!gameSession || gameSession.isExpired()) {
            throw new APIError(403, 'Invalid or expired session', 'INVALID_SESSION');
        }

        // Verify profile matches
        if (selectedProfile !== gameSession.user.id.replace(/-/g, '')) {
            throw new APIError(403, 'Profile mismatch', 'PROFILE_MISMATCH');
        }

        // Update activity
        gameSession.updateActivity();
        
        // Store server join request temporarily (can add a field to GameSession if needed)
        // For now, just update activity
        await gameSession.save();

        // Return 204 No Content on success
        return c.body(null, 204);
    }

    /**
     * GET /sessionserver/session/minecraft/hasJoined - Verify player joined (server-side check)
     */
    static async hasJoined(c: Context): Promise<Response> {
        const username = c.req.query('username');
        const serverId = c.req.query('serverId');

        if (!username || !serverId) {
            throw new APIError(400, 'Missing required parameters', 'MISSING_PARAMETERS');
        }

        // Find active session with matching username or custom nickname
        const gameSession = await GameSession.findOne({
            where: { isValid: true },
            relations: ['user'],
            order: { lastActivityAt: 'DESC' }
        });

        // Check all active sessions for a match
        const sessions = await GameSession.find({
            where: { isValid: true },
            relations: ['user']
        });

        const matchingSession = sessions.find(session => 
            !session.isExpired() && 
            (session.customNickname === username || session.user.username === username)
        );

        if (!matchingSession) {
            return c.body(null, 204); // No content if not found
        }

        // Update activity
        matchingSession.updateActivity();
        await matchingSession.save();

        return c.json({
            id: matchingSession.user.id.replace(/-/g, ''),
            name: matchingSession.customNickname || matchingSession.user.username,
            properties: []
        });
    }
}
