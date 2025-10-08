import { Context } from 'hono';
import { GameSession } from '@/entities/GameSession';
import { User } from '@/entities/User';
import { randomBytes } from 'crypto';
import { APIError } from '@/utils/error';

/**
 * Yggdrasil AuthServer Controller
 * Compatible with authlib-injector and standard Minecraft authentication
 */
export class YggdrasilController {
    /**
     * GET /
     * Returns metadata about the authentication server
     */
    static async getMetadata(c: Context) {
        return c.json({
            meta: {
                serverName: "ModpackStore AuthServer",
                implementationName: "ModpackStore Yggdrasil",
                implementationVersion: "1.0.0",
                feature: {
                    non_email_login: true,
                    legacy_skin_api: false,
                    no_mojang_namespace: true
                },
                links: {
                    homepage: process.env.FRONTEND_URL || "https://modpackstore.com",
                    register: `${process.env.FRONTEND_URL || "https://modpackstore.com"}/register`
                }
            },
            skinDomains: [
                process.env.SKIN_DOMAIN || "modpackstore.com"
            ],
            signaturePublickey: null // Optional: Add RSA public key for signature verification
        });
    }

    /**
     * POST /authserver/authenticate
     * Authenticates a user with JWT token and returns game session tokens
     */
    static async authenticate(c: Context) {
        const body = await c.req.json();
        const { token, clientToken, requestUser = true, agent = {} } = body;

        // Validate required fields
        if (!token) {
            throw new APIError(400, "Missing JWT token", {
                error: "ForbiddenOperationException",
                errorMessage: "Invalid credentials. Invalid token."
            });
        }

        // Verify JWT and get user
        let userId: string;
        try {
            const jwtSecret = process.env.JWT_SECRET;
            if (!jwtSecret) {
                throw new Error("JWT_SECRET not configured");
            }

            // Import jsonwebtoken
            const jwt = await import('jsonwebtoken');
            const decoded = jwt.verify(token, jwtSecret) as { sub: string };
            userId = decoded.sub;
        } catch (error) {
            throw new APIError(401, "Invalid token", {
                error: "ForbiddenOperationException",
                errorMessage: "Invalid credentials. Invalid token."
            });
        }

        // Get user
        const user = await User.findOne({ where: { id: userId } });
        if (!user) {
            throw new APIError(401, "User not found", {
                error: "ForbiddenOperationException",
                errorMessage: "Invalid credentials."
            });
        }

        // Generate or use existing clientToken
        const finalClientToken = clientToken || randomBytes(16).toString('hex');
        
        // Generate access token
        const accessToken = randomBytes(32).toString('hex');

        // Create game session
        const gameSession = new GameSession();
        gameSession.userId = user.id;
        gameSession.accessToken = accessToken;
        gameSession.clientToken = finalClientToken;
        gameSession.selectedProfileId = user.id; // Use user ID as profile ID
        gameSession.selectedProfileName = user.username;
        gameSession.lastActivityAt = new Date();
        gameSession.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        await gameSession.save();

        // Build response
        const response: any = {
            accessToken,
            clientToken: finalClientToken
        };

        if (requestUser) {
            response.selectedProfile = {
                id: user.id.replace(/-/g, ''), // Remove hyphens for Minecraft compatibility
                name: user.username
            };
            response.availableProfiles = [
                {
                    id: user.id.replace(/-/g, ''),
                    name: user.username
                }
            ];
            response.user = {
                id: user.id,
                username: user.username,
                properties: []
            };
        }

        return c.json(response);
    }

    /**
     * POST /authserver/refresh
     * Refreshes an access token using a client token
     */
    static async refresh(c: Context) {
        const body = await c.req.json();
        const { accessToken, clientToken, requestUser = true } = body;

        if (!accessToken || !clientToken) {
            throw new APIError(400, "Missing required fields", {
                error: "IllegalArgumentException",
                errorMessage: "Access token and client token are required."
            });
        }

        // Find existing session
        const session = await GameSession.findOne({
            where: { accessToken, clientToken },
            relations: ["user"]
        });

        if (!session) {
            throw new APIError(401, "Invalid token", {
                error: "ForbiddenOperationException",
                errorMessage: "Invalid token."
            });
        }

        // Check if expired or inactive
        if (session.isExpired() || session.isInactive()) {
            await session.remove();
            throw new APIError(401, "Token expired", {
                error: "ForbiddenOperationException",
                errorMessage: "Token expired."
            });
        }

        // Generate new access token
        const newAccessToken = randomBytes(32).toString('hex');
        session.accessToken = newAccessToken;
        session.lastActivityAt = new Date();
        await session.save();

        const response: any = {
            accessToken: newAccessToken,
            clientToken: session.clientToken
        };

        if (requestUser) {
            response.selectedProfile = {
                id: session.user.id.replace(/-/g, ''),
                name: session.selectedProfileName || session.user.username
            };
            response.availableProfiles = [
                {
                    id: session.user.id.replace(/-/g, ''),
                    name: session.selectedProfileName || session.user.username
                }
            ];
            response.user = {
                id: session.user.id,
                username: session.user.username,
                properties: []
            };
        }

        return c.json(response);
    }

    /**
     * POST /authserver/validate
     * Validates an access token
     */
    static async validate(c: Context) {
        const body = await c.req.json();
        const { accessToken, clientToken } = body;

        if (!accessToken) {
            throw new APIError(400, "Missing access token", {
                error: "IllegalArgumentException",
                errorMessage: "Access token is required."
            });
        }

        // Find session
        const session = await GameSession.findOne({
            where: clientToken ? { accessToken, clientToken } : { accessToken }
        });

        if (!session || session.isExpired() || session.isInactive()) {
            throw new APIError(403, "Invalid token", {
                error: "ForbiddenOperationException",
                errorMessage: "Invalid token."
            });
        }

        // Update activity
        session.updateActivity();
        await session.save();

        // Return 204 No Content for valid tokens
        return c.body(null, 204);
    }

    /**
     * POST /authserver/invalidate
     * Invalidates an access token
     */
    static async invalidate(c: Context) {
        const body = await c.req.json();
        const { accessToken, clientToken } = body;

        if (!accessToken || !clientToken) {
            throw new APIError(400, "Missing required fields", {
                error: "IllegalArgumentException",
                errorMessage: "Access token and client token are required."
            });
        }

        // Find and delete session
        const session = await GameSession.findOne({
            where: { accessToken, clientToken }
        });

        if (session) {
            await session.remove();
        }

        // Return 204 No Content
        return c.body(null, 204);
    }

    /**
     * POST /authserver/signout
     * Signs out a user (invalidates all sessions for the user)
     */
    static async signout(c: Context) {
        const body = await c.req.json();
        const { username, password } = body;

        // For ModpackStore, we use JWT tokens, not passwords
        // This endpoint is included for compatibility but will not be actively used
        if (!username) {
            throw new APIError(400, "Missing username", {
                error: "IllegalArgumentException",
                errorMessage: "Username is required."
            });
        }

        // Find user by username
        const user = await User.findOne({ where: { username } });
        if (!user) {
            throw new APIError(401, "Invalid credentials", {
                error: "ForbiddenOperationException",
                errorMessage: "Invalid credentials."
            });
        }

        // Delete all sessions for this user
        await GameSession.createQueryBuilder()
            .delete()
            .where("user_id = :userId", { userId: user.id })
            .execute();

        // Return 204 No Content
        return c.body(null, 204);
    }

    /**
     * GET /sessionserver/session/minecraft/profile/:uuid
     * Returns profile information (for compatibility)
     */
    static async getProfile(c: Context) {
        const uuid = c.req.param('uuid');

        if (!uuid) {
            throw new APIError(400, "Missing UUID");
        }

        // Add hyphens to UUID if needed (Minecraft sends without hyphens)
        const formattedUuid = uuid.length === 32 
            ? `${uuid.substr(0, 8)}-${uuid.substr(8, 4)}-${uuid.substr(12, 4)}-${uuid.substr(16, 4)}-${uuid.substr(20, 12)}`
            : uuid;

        const user = await User.findOne({ where: { id: formattedUuid } });
        if (!user) {
            throw new APIError(404, "Profile not found");
        }

        return c.json({
            id: user.id.replace(/-/g, ''),
            name: user.username,
            properties: [
                // Add skin/cape properties here if needed
            ]
        });
    }

    /**
     * POST /sessionserver/session/minecraft/join
     * Handles join server requests from Minecraft client
     */
    static async joinServer(c: Context) {
        const body = await c.req.json();
        const { accessToken, selectedProfile, serverId } = body;

        if (!accessToken || !selectedProfile || !serverId) {
            throw new APIError(400, "Missing required fields");
        }

        // Validate session
        const session = await GameSession.findByAccessToken(accessToken);
        if (!session || session.isExpired() || session.isInactive()) {
            throw new APIError(403, "Invalid token", {
                error: "ForbiddenOperationException",
                errorMessage: "Invalid token."
            });
        }

        // Update activity
        session.updateActivity();
        
        // Store serverId for verification (you may want to add a serverJoins table)
        // For now, we'll just update the session
        await session.save();

        return c.body(null, 204);
    }

    /**
     * GET /sessionserver/session/minecraft/hasJoined
     * Verifies that a player has joined a server
     */
    static async hasJoined(c: Context) {
        const username = c.req.query('username');
        const serverId = c.req.query('serverId');

        if (!username || !serverId) {
            throw new APIError(400, "Missing required parameters");
        }

        // Find user
        const user = await User.findOne({ where: { username } });
        if (!user) {
            return c.body(null, 204); // No content means not authenticated
        }

        // Check if user has an active session
        const session = await GameSession.findOne({
            where: { userId: user.id }
        });

        if (!session || session.isExpired() || session.isInactive()) {
            return c.body(null, 204);
        }

        // Update activity
        session.updateActivity();
        await session.save();

        return c.json({
            id: user.id.replace(/-/g, ''),
            name: user.username,
            properties: []
        });
    }
}
