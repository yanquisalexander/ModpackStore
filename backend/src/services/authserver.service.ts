import { v4 as uuidv4 } from 'uuid';
import { User } from '@/entities/User';
import { GameSession } from '@/entities/GameSession';
import { APIError } from '@/lib/APIError';
import { verify } from 'jsonwebtoken';
import { TokenPayload } from './auth.service';

const JWT_SECRET = process.env.JWT_SECRET!;
const AUTH_SERVER_NAME = process.env.AUTH_SERVER_NAME || 'ModpackStore AuthServer';
const AUTH_SERVER_URL = process.env.AUTH_SERVER_URL || 'http://localhost:3000';

/**
 * Yggdrasil Protocol Response Types
 */
interface YggdrasilProfile {
    id: string; // UUID without dashes
    name: string; // Username
}

interface YggdrasilAuthResponse {
    accessToken: string;
    clientToken: string;
    availableProfiles: YggdrasilProfile[];
    selectedProfile: YggdrasilProfile;
    user?: {
        id: string;
        properties: any[];
    };
}

interface YggdrasilRefreshResponse {
    accessToken: string;
    clientToken: string;
    selectedProfile: YggdrasilProfile;
    user?: {
        id: string;
        properties: any[];
    };
}

interface YggdrasilMetadata {
    meta: {
        serverName: string;
        implementationName: string;
        implementationVersion: string;
        'feature.non_email_login': boolean;
    };
    skinDomains: string[];
    signaturePublickey?: string;
}

/**
 * AuthServer Service - Yggdrasil Protocol Implementation
 * 
 * Implements the Yggdrasil authentication protocol used by Minecraft
 * Compatible with authlib-injector for custom authentication servers
 */
export class AuthServerService {
    
    /**
     * Authenticate user with ModpackStore JWT token
     * POST /authserver/authenticate
     * 
     * @param jwtToken - ModpackStore JWT access token
     * @param clientToken - Client-provided token for session consistency
     * @param requestAgentName - Optional agent name (e.g., "Minecraft")
     * @param requestAgentVersion - Optional agent version
     * @returns Yggdrasil authentication response
     */
    static async authenticate(
        jwtToken: string,
        clientToken?: string,
        requestAgentName?: string,
        requestAgentVersion?: number
    ): Promise<YggdrasilAuthResponse> {
        try {
            // Verify JWT token
            const decoded = verify(jwtToken, JWT_SECRET) as TokenPayload;
            
            // Get user from database
            const user = await User.findOne({ where: { id: decoded.sub } });
            if (!user) {
                throw new APIError(403, 'Invalid credentials');
            }

            // Generate or reuse client token
            const finalClientToken = clientToken || uuidv4();

            // Invalidate any existing active sessions for this user
            await GameSession
                .createQueryBuilder()
                .update(GameSession)
                .set({ isActive: false })
                .where("user_id = :userId", { userId: user.id })
                .andWhere("is_active = :isActive", { isActive: true })
                .execute();

            // Create new game session
            const accessToken = uuidv4();
            const gameSession = GameSession.create({
                userId: user.id,
                accessToken,
                clientToken: finalClientToken,
                isActive: true,
                lastActivityAt: new Date()
            });
            await gameSession.save();

            // Build Yggdrasil response
            const profile = this.buildProfile(user);
            
            return {
                accessToken,
                clientToken: finalClientToken,
                availableProfiles: [profile],
                selectedProfile: profile,
                user: {
                    id: user.id,
                    properties: []
                }
            };
        } catch (error) {
            if (error instanceof APIError) {
                throw error;
            }
            console.error('[AuthServer] Authentication error:', error);
            throw new APIError(403, 'Invalid credentials');
        }
    }

    /**
     * Refresh game session token
     * POST /authserver/refresh
     * 
     * @param accessToken - Current access token
     * @param clientToken - Client token for validation
     * @returns Refreshed Yggdrasil response
     */
    static async refresh(
        accessToken: string,
        clientToken: string
    ): Promise<YggdrasilRefreshResponse> {
        // Find the session
        const session = await GameSession.findByAccessToken(accessToken);
        
        if (!session) {
            throw new APIError(403, 'Invalid token');
        }

        // Validate client token
        if (session.clientToken !== clientToken) {
            throw new APIError(403, 'Invalid token');
        }

        // Check if expired
        if (session.isExpired()) {
            await session.invalidate();
            throw new APIError(403, 'Token expired');
        }

        // Update activity
        await session.updateActivity();

        // Generate new access token
        const newAccessToken = uuidv4();
        session.accessToken = newAccessToken;
        await session.save();

        // Build response
        const profile = this.buildProfile(session.user);

        return {
            accessToken: newAccessToken,
            clientToken: session.clientToken,
            selectedProfile: profile,
            user: {
                id: session.user.id,
                properties: []
            }
        };
    }

    /**
     * Validate game session token
     * POST /authserver/validate
     * 
     * @param accessToken - Access token to validate
     * @param clientToken - Optional client token for additional validation
     * @returns true if valid, throws error otherwise
     */
    static async validate(
        accessToken: string,
        clientToken?: string
    ): Promise<boolean> {
        const session = await GameSession.findByAccessToken(accessToken);
        
        if (!session) {
            throw new APIError(403, 'Invalid token');
        }

        // Optional client token validation
        if (clientToken && session.clientToken !== clientToken) {
            throw new APIError(403, 'Invalid token');
        }

        // Check if expired
        if (session.isExpired()) {
            await session.invalidate();
            throw new APIError(403, 'Token expired');
        }

        // Update activity on validation
        await session.updateActivity();

        return true;
    }

    /**
     * Invalidate game session
     * POST /authserver/invalidate
     * 
     * @param accessToken - Access token to invalidate
     * @param clientToken - Client token for validation
     */
    static async invalidate(
        accessToken: string,
        clientToken: string
    ): Promise<void> {
        const session = await GameSession.findByAccessToken(accessToken);
        
        if (!session) {
            // Yggdrasil protocol: invalidate should succeed even if token doesn't exist
            return;
        }

        // Validate client token
        if (session.clientToken !== clientToken) {
            throw new APIError(403, 'Invalid token');
        }

        // Invalidate session
        await session.invalidate();
    }

    /**
     * Sign out all sessions for a user
     * POST /authserver/signout
     * 
     * @param jwtToken - ModpackStore JWT token
     */
    static async signout(jwtToken: string): Promise<void> {
        try {
            // Verify JWT token
            const decoded = verify(jwtToken, JWT_SECRET) as TokenPayload;

            // Invalidate all active sessions for this user
            await GameSession
                .createQueryBuilder()
                .update(GameSession)
                .set({ isActive: false })
                .where("user_id = :userId", { userId: decoded.sub })
                .andWhere("is_active = :isActive", { isActive: true })
                .execute();
        } catch (error) {
            // Silently fail for invalid tokens (Yggdrasil behavior)
            console.error('[AuthServer] Signout error:', error);
        }
    }

    /**
     * Get authlib-injector metadata
     * GET / (root endpoint)
     * 
     * @returns Metadata for authlib-injector compatibility
     */
    static async getMetadata(): Promise<YggdrasilMetadata> {
        return {
            meta: {
                serverName: AUTH_SERVER_NAME,
                implementationName: 'ModpackStore AuthServer',
                implementationVersion: '1.0.0',
                'feature.non_email_login': true
            },
            skinDomains: [
                // Add skin domains if implementing skin/cape support
                // For now, empty means no custom skins
            ],
            // signaturePublickey can be added if implementing message signing
        };
    }

    /**
     * Helper: Build Yggdrasil profile from User
     */
    private static buildProfile(user: User): YggdrasilProfile {
        // Remove dashes from UUID for Yggdrasil format
        const uuidWithoutDashes = user.id.replace(/-/g, '');
        
        return {
            id: uuidWithoutDashes,
            name: user.username
        };
    }

    /**
     * Helper: Get or create game session for user (used by launcher)
     * This is a convenience method for the Rust launcher
     * 
     * @param jwtToken - ModpackStore JWT token
     * @returns Game session access token
     */
    static async getOrCreateGameSession(jwtToken: string, nickname?: string): Promise<{
        accessToken: string;
        clientToken: string;
        username: string;
        uuid: string;
    }> {
        // Verify JWT and get user
        const decoded = verify(jwtToken, JWT_SECRET) as TokenPayload;
        const user = await User.findOne({ where: { id: decoded.sub } });
        
        if (!user) {
            throw new APIError(404, 'User not found');
        }

        // Check for existing active session
        let session = await GameSession.findActiveByUserId(user.id);

        // If session exists and is not expired, return it
        if (session && !session.isExpired()) {
            await session.updateActivity();
            return {
                accessToken: session.accessToken,
                clientToken: session.clientToken,
                username: nickname || user.username,
                uuid: user.id
            };
        }

        // Create new session if none exists or expired
        const authResponse = await this.authenticate(jwtToken);
        
        return {
            accessToken: authResponse.accessToken,
            clientToken: authResponse.clientToken,
            username: nickname || user.username,
            uuid: user.id
        };
    }
}
