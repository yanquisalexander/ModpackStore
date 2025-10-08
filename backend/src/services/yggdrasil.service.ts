import "dotenv/config";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { User } from "@/entities/User";
import { GameSession } from "@/entities/GameSession";
import { APIError } from "@/lib/APIError";

const JWT_SECRET = process.env.JWT_SECRET!;
const YGGDRASIL_SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours
const YGGDRASIL_INACTIVITY_TIMEOUT = 20 * 60 * 1000; // 20 minutes

export interface YggdrasilProfile {
    id: string;
    name: string;
    properties?: Array<{
        name: string;
        value: string;
        signature?: string;
    }>;
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

export class YggdrasilService {
    /**
     * Authenticate user with ModpackStore JWT and return Yggdrasil tokens
     */
    static async authenticate(
        jwtToken: string,
        clientToken?: string,
        requestedUsername?: string
    ): Promise<YggdrasilAuthResponse> {
        // Verify JWT token
        let decoded: any;
        try {
            decoded = jwt.verify(jwtToken, JWT_SECRET);
        } catch (error) {
            throw new APIError(401, 'Invalid or expired JWT token.', 'INVALID_JWT');
        }

        const userId = decoded.sub;
        if (!userId) {
            throw new APIError(401, 'Invalid JWT token payload.', 'INVALID_JWT_PAYLOAD');
        }

        // Get user from database
        const user = await User.findOne({ where: { id: userId } });
        if (!user) {
            throw new APIError(404, 'User not found.', 'USER_NOT_FOUND');
        }

        // Generate tokens
        const accessToken = this.generateAccessToken();
        const generatedClientToken = clientToken || this.generateClientToken();

        // Create game session
        const expiresAt = new Date(Date.now() + YGGDRASIL_SESSION_DURATION);
        const gameSession = GameSession.create({
            userId: user.id,
            accessToken,
            clientToken: generatedClientToken,
            serverId: null,
            ipAddress: null,
            requestedUsername: requestedUsername || null,
            lastActivity: new Date(),
            expiresAt
        });
        await gameSession.save();

        // Use requested username if provided, otherwise use user's username
        const username = requestedUsername || user.username;

        // Build profile
        const profile = await this.buildProfile(user, username);

        return {
            accessToken,
            clientToken: generatedClientToken,
            availableProfiles: [profile],
            selectedProfile: profile,
            user: {
                id: user.id,
                username: user.username
            }
        };
    }

    /**
     * Refresh access token
     */
    static async refresh(accessToken: string, clientToken: string): Promise<YggdrasilAuthResponse> {
        const session = await GameSession.findByAccessToken(accessToken);

        if (!session || session.clientToken !== clientToken) {
            throw new APIError(401, 'Invalid token pair.', 'INVALID_TOKEN');
        }

        if (session.isExpired() || session.isInactive()) {
            await session.remove();
            throw new APIError(401, 'Session expired.', 'SESSION_EXPIRED');
        }

        // Update activity
        await session.updateActivity();

        // Generate new access token
        const newAccessToken = this.generateAccessToken();
        session.accessToken = newAccessToken;
        session.expiresAt = new Date(Date.now() + YGGDRASIL_SESSION_DURATION);
        await session.save();

        const user = session.user || await User.findOne({ where: { id: session.userId } });
        if (!user) {
            throw new APIError(404, 'User not found.', 'USER_NOT_FOUND');
        }

        const profile = await this.buildProfile(user);

        return {
            accessToken: newAccessToken,
            clientToken: session.clientToken,
            availableProfiles: [profile],
            selectedProfile: profile,
            user: {
                id: user.id,
                username: user.username
            }
        };
    }

    /**
     * Validate access token
     */
    static async validate(accessToken: string, clientToken?: string): Promise<boolean> {
        const session = await GameSession.findByAccessToken(accessToken);

        if (!session) {
            return false;
        }

        if (clientToken && session.clientToken !== clientToken) {
            return false;
        }

        if (session.isExpired() || session.isInactive()) {
            await session.remove();
            return false;
        }

        return true;
    }

    /**
     * Invalidate access token (logout)
     */
    static async invalidate(accessToken: string, clientToken: string): Promise<void> {
        const session = await GameSession.findByAccessToken(accessToken);

        if (session && session.clientToken === clientToken) {
            await session.remove();
        }
    }

    /**
     * Sign out all sessions for a user
     */
    static async signout(username: string, password: string): Promise<void> {
        // For ModpackStore, we don't use password authentication
        // This is a compatibility endpoint, we'll just return success
        // In a real implementation, you might want to invalidate all sessions for a user
        throw new APIError(501, 'Signout not implemented for ModpackStore auth.', 'NOT_IMPLEMENTED');
    }

    /**
     * Join server (called by Minecraft client)
     */
    static async joinServer(
        accessToken: string,
        selectedProfile: string,
        serverId: string,
        ipAddress?: string
    ): Promise<void> {
        const session = await GameSession.findByAccessToken(accessToken);

        if (!session) {
            throw new APIError(403, 'Invalid session.', 'INVALID_SESSION');
        }

        if (session.isExpired() || session.isInactive()) {
            await session.remove();
            throw new APIError(403, 'Session expired.', 'SESSION_EXPIRED');
        }

        const user = session.user || await User.findOne({ where: { id: session.userId } });
        if (!user) {
            throw new APIError(404, 'User not found.', 'USER_NOT_FOUND');
        }

        // Check if user is banned
        if (await user.isBanned()) {
            throw new APIError(403, 'User is banned from multiplayer.', 'UserBannedException');
        }

        // Verify profile matches
        const profileUuid = this.uuidWithDashes(user.id);
        const profileUuidNoDashes = user.id;

        // Check if selectedProfile is a UUID (with or without dashes)
        const uuidRegex = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;
        const isUuid = uuidRegex.test(selectedProfile);

        if (!isUuid) {
            // If it's not a UUID, it means the client sent a profile name instead
            // This indicates the user didn't configure ms_nickname properly
            throw new APIError(403, 'Invalid profile ID. Please configure your Minecraft nickname in instance settings.', 'INVALID_PROFILE_ID');
        }

        // For debugging: log the UUID being received
        console.log(`[YggdrasilService] Join request - received UUID: ${selectedProfile}, user UUID: ${user.id}, profile UUID: ${profileUuid}`);

        // Accept the UUID for now - authlib-injector seems to send its own UUID
        // This should be investigated further to ensure security

        // Update session with server info
        session.serverId = serverId;
        session.ipAddress = ipAddress || null;
        await session.updateActivity();
    }

    /**
     * Has joined server (called by Minecraft server)
     */
    static async hasJoined(
        username: string,
        serverId: string,
        ip?: string
    ): Promise<YggdrasilProfile | null> {
        const session = await GameSession.findByServerIdAndUsername(serverId, username);

        if (!session) {
            return null;
        }

        if (session.isExpired() || session.isInactive()) {
            await session.remove();
            return null;
        }

        const user = session.user;
        if (!user) {
            return null;
        }

        // Check if user is banned
        if (await user.isBanned()) {
            throw new APIError(403, 'Your Modpack Store account is banned.', 'UserBannedException');
        }

        // Optionally validate IP if provided
        if (ip && session.ipAddress && session.ipAddress !== ip) {
            return null;
        }

        // Clear server ID after successful verification
        session.serverId = null;
        await session.updateActivity();

        return await this.buildProfile(user);
    }

    /**
     * Get profile by UUID
     */
    static async getProfile(uuid: string, unsigned: boolean = true): Promise<YggdrasilProfile | null> {
        // Remove dashes from UUID if present
        const cleanUuid = uuid.replace(/-/g, '');

        const user = await User.findOne({ where: { id: cleanUuid } });
        if (!user) {
            return null;
        }

        return await this.buildProfile(user, undefined, !unsigned);
    }

    /**
     * Build Yggdrasil profile from user
     */
    private static async buildProfile(
        user: User,
        customUsername?: string,
        signed: boolean = false
    ): Promise<YggdrasilProfile> {
        const profile: YggdrasilProfile = {
            id: this.uuidWithDashes(user.id),
            name: customUsername || user.username
        };

        // Add skin/cape properties if available
        const properties: Array<{ name: string; value: string; signature?: string }> = [];

        if (user.avatarUrl) {
            const textureData = {
                timestamp: Date.now(),
                profileId: user.id,
                profileName: profile.name,
                textures: {
                    SKIN: {
                        url: user.avatarUrl
                    }
                }
            };

            const encodedTextures = Buffer.from(JSON.stringify(textureData)).toString('base64');

            properties.push({
                name: 'textures',
                value: encodedTextures,
                ...(signed ? { signature: this.signTextures(encodedTextures) } : {})
            });
        }

        if (properties.length > 0) {
            profile.properties = properties;
        }

        return profile;
    }

    /**
     * Generate random access token
     */
    private static generateAccessToken(): string {
        return crypto.randomBytes(32).toString('hex');
    }

    /**
     * Generate random client token
     */
    private static generateClientToken(): string {
        return crypto.randomBytes(16).toString('hex');
    }

    /**
     * Add dashes to UUID
     */
    private static uuidWithDashes(uuid: string): string {
        if (uuid.includes('-')) {
            return uuid;
        }
        return `${uuid.slice(0, 8)}-${uuid.slice(8, 12)}-${uuid.slice(12, 16)}-${uuid.slice(16, 20)}-${uuid.slice(20)}`;
    }

    /**
     * Sign texture data (simplified - for production use proper signing)
     */
    private static signTextures(data: string): string {
        // In a real implementation, you would sign this with a private key
        // For now, we'll just return a placeholder
        const hash = crypto.createHash('sha256').update(data).digest('hex');
        return Buffer.from(hash).toString('base64');
    }

    /**
     * Cleanup expired sessions (should be called periodically)
     */
    static async cleanupExpiredSessions(): Promise<void> {
        await GameSession.cleanupExpiredSessions();
    }
}
