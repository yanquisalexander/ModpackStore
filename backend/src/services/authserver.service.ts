import { v4 as uuidv4 } from 'uuid';
import { GameSession } from '@/entities/GameSession';
import { User } from '@/entities/User';
import { APIError } from '@/lib/APIError';
import crypto from 'crypto';

export interface YggdrasilProfile {
    id: string;
    name: string;
}

export interface YggdrasilAuthResponse {
    accessToken: string;
    clientToken: string;
    availableProfiles: YggdrasilProfile[];
    selectedProfile: YggdrasilProfile;
    user?: {
        id: string;
        username: string;
    };
}

export interface YggdrasilRefreshResponse {
    accessToken: string;
    clientToken: string;
    selectedProfile: YggdrasilProfile;
    user?: {
        id: string;
        username: string;
    };
}

export class AuthServerService {
    /**
     * Generate a Minecraft player UUID from the ModpackStore user UUID
     * This ensures the UUID remains consistent across sessions
     */
    static generatePlayerUuid(userId: string): string {
        // Use the user's UUID directly as the player UUID
        // This maintains consistency between sessions
        return userId;
    }

    /**
     * Generate a secure access token for game sessions
     */
    static generateAccessToken(): string {
        return crypto.randomBytes(32).toString('hex');
    }

    /**
     * Authenticate a user and create a game session
     * This implements the Yggdrasil /authenticate endpoint
     */
    static async authenticate(
        username: string,
        password: string, // In this case, this will be the JWT token
        clientToken?: string,
        requestUser?: boolean
    ): Promise<YggdrasilAuthResponse> {
        // Validate JWT token (password parameter contains the JWT)
        const user = await this.validateJWT(password);
        if (!user) {
            throw new APIError(403, 'Invalid credentials', 'INVALID_CREDENTIALS');
        }

        // Generate or use provided client token
        const actualClientToken = clientToken || uuidv4();
        const accessToken = this.generateAccessToken();
        const playerUuid = this.generatePlayerUuid(user.id);

        // Create game session
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now
        const gameSession = GameSession.create({
            userId: user.id,
            accessToken,
            clientToken: actualClientToken,
            username: username,
            playerUuid,
            expiresAt,
            lastActivityAt: new Date()
        });

        await gameSession.save();

        const profile: YggdrasilProfile = {
            id: playerUuid.replace(/-/g, ''), // Minecraft uses UUIDs without dashes
            name: username
        };

        const response: YggdrasilAuthResponse = {
            accessToken,
            clientToken: actualClientToken,
            availableProfiles: [profile],
            selectedProfile: profile
        };

        if (requestUser) {
            response.user = {
                id: user.id,
                username: user.username
            };
        }

        return response;
    }

    /**
     * Refresh an existing game session
     * This implements the Yggdrasil /refresh endpoint
     */
    static async refresh(
        accessToken: string,
        clientToken: string,
        requestUser?: boolean
    ): Promise<YggdrasilRefreshResponse> {
        // Find existing session
        const session = await GameSession.findOne({
            where: { accessToken, clientToken },
            relations: ['user']
        });

        if (!session) {
            throw new APIError(403, 'Invalid token', 'INVALID_TOKEN');
        }

        if (session.isExpired() || session.isInactive()) {
            await session.remove();
            throw new APIError(403, 'Token expired', 'TOKEN_EXPIRED');
        }

        // Generate new access token
        const newAccessToken = this.generateAccessToken();
        session.accessToken = newAccessToken;
        session.lastActivityAt = new Date();
        session.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await session.save();

        const profile: YggdrasilProfile = {
            id: session.playerUuid.replace(/-/g, ''),
            name: session.username
        };

        const response: YggdrasilRefreshResponse = {
            accessToken: newAccessToken,
            clientToken: session.clientToken,
            selectedProfile: profile
        };

        if (requestUser) {
            response.user = {
                id: session.user.id,
                username: session.user.username
            };
        }

        return response;
    }

    /**
     * Validate an access token
     * This implements the Yggdrasil /validate endpoint
     */
    static async validate(accessToken: string, clientToken?: string): Promise<boolean> {
        const query: any = { accessToken };
        if (clientToken) {
            query.clientToken = clientToken;
        }

        const session = await GameSession.findOne({ where: query });
        
        if (!session) {
            return false;
        }

        if (session.isExpired() || session.isInactive()) {
            await session.remove();
            return false;
        }

        // Update activity
        session.updateActivity();
        await session.save();

        return true;
    }

    /**
     * Invalidate an access token
     * This implements the Yggdrasil /invalidate endpoint
     */
    static async invalidate(accessToken: string, clientToken: string): Promise<void> {
        const session = await GameSession.findOne({
            where: { accessToken, clientToken }
        });

        if (session) {
            await session.remove();
        }
        // Yggdrasil doesn't return error if token doesn't exist
    }

    /**
     * Sign out all sessions for a client token
     * This implements the Yggdrasil /signout endpoint
     */
    static async signout(username: string, password: string): Promise<void> {
        // Validate credentials (password is JWT token)
        const user = await this.validateJWT(password);
        if (!user) {
            throw new APIError(403, 'Invalid credentials', 'INVALID_CREDENTIALS');
        }

        // Remove all game sessions for this user
        await GameSession.delete({ userId: user.id });
    }

    /**
     * Get profile information by UUID
     * Used by Minecraft servers to get player information
     */
    static async getProfile(uuid: string): Promise<YggdrasilProfile | null> {
        // Remove dashes from UUID if present
        const normalizedUuid = uuid.replace(/-/g, '');
        
        // Find a game session with this player UUID
        const session = await GameSession.findOne({
            where: { playerUuid: normalizedUuid.toLowerCase() }
        });

        if (!session) {
            return null;
        }

        return {
            id: normalizedUuid,
            name: session.username
        };
    }

    /**
     * Validate JWT token and return user
     */
    private static async validateJWT(token: string): Promise<User | null> {
        try {
            const jwt = require('jsonwebtoken');
            const secret = process.env.JWT_SECRET;
            
            if (!secret) {
                throw new Error('JWT_SECRET is not configured');
            }

            const decoded = jwt.verify(token, secret) as { sub: string };
            const user = await User.findOne({ where: { id: decoded.sub } });
            
            return user;
        } catch (error) {
            console.error('JWT validation error:', error);
            return null;
        }
    }

    /**
     * Get authserver metadata for authlib-injector
     */
    static getMetadata(baseUrl: string) {
        return {
            meta: {
                serverName: 'ModpackStore Auth',
                implementationName: 'ModpackStore',
                implementationVersion: '1.0.0',
                'feature.non_email_login': true
            },
            skinDomains: [
                baseUrl.replace(/^https?:\/\//, '') // Remove protocol from base URL
            ],
            signaturePublickey: '' // Optional: Add RSA public key for skin signature verification
        };
    }
}
