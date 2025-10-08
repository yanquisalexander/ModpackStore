import crypto from "crypto";
import { User } from "@/entities/User";
import { YggdrasilSession } from "@/entities/YggdrasilSession";
import { YggdrasilProfile } from "@/entities/YggdrasilProfile";
import { APIError } from "@/lib/APIError";
import { v4 as uuidv4 } from "uuid";

export class YggdrasilService {
    /**
     * Authenticate a user and generate Yggdrasil session tokens
     * This is called when launching Minecraft with a ModpackStore account
     */
    static async authenticate(userId: string, clientToken?: string, username?: string): Promise<{
        accessToken: string;
        clientToken: string;
        selectedProfile: {
            id: string;
            name: string;
        };
    }> {
        const user = await User.findOne({ where: { id: userId } });
        if (!user) {
            throw new APIError(404, "User not found", "USER_NOT_FOUND");
        }

        // Get or create Yggdrasil profile for this user
        let profile = await YggdrasilProfile.findOne({ where: { userId } });
        
        if (!profile) {
            // Create a new profile
            const minecraftUuid = this.generateMinecraftUUID(userId);
            const minecraftUsername = username || user.username;

            profile = YggdrasilProfile.create({
                userId,
                minecraftUuid,
                minecraftUsername,
                skinUrl: user.avatarUrl || null,
                skinModel: "classic"
            });
            await profile.save();
        } else if (username && profile.minecraftUsername !== username) {
            // Update username if a custom ms_nickname is provided
            profile.minecraftUsername = username;
            await profile.save();
        }

        // Generate new session tokens
        const accessToken = this.generateToken();
        const newClientToken = clientToken || this.generateToken();

        // Create or update session
        let session = await YggdrasilSession.findOne({ 
            where: { userId, clientToken: newClientToken } 
        });

        if (session) {
            session.accessToken = accessToken;
            session.lastActivity = new Date();
        } else {
            session = YggdrasilSession.create({
                userId,
                accessToken,
                clientToken: newClientToken,
                lastActivity: new Date()
            });
        }
        await session.save();

        return {
            accessToken,
            clientToken: newClientToken,
            selectedProfile: {
                id: profile.minecraftUuid.replace(/-/g, ''),
                name: profile.minecraftUsername
            }
        };
    }

    /**
     * Refresh an existing access token
     */
    static async refresh(accessToken: string, clientToken: string): Promise<{
        accessToken: string;
        clientToken: string;
        selectedProfile: {
            id: string;
            name: string;
        };
    }> {
        const session = await YggdrasilSession.findOne({ 
            where: { accessToken, clientToken } 
        });

        if (!session || session.isExpired()) {
            throw new APIError(403, "Invalid token", "INVALID_TOKEN");
        }

        const profile = await YggdrasilProfile.findOne({ where: { userId: session.userId } });
        if (!profile) {
            throw new APIError(404, "Profile not found", "PROFILE_NOT_FOUND");
        }

        // Generate new access token
        const newAccessToken = this.generateToken();
        session.accessToken = newAccessToken;
        session.lastActivity = new Date();
        await session.save();

        return {
            accessToken: newAccessToken,
            clientToken,
            selectedProfile: {
                id: profile.minecraftUuid.replace(/-/g, ''),
                name: profile.minecraftUsername
            }
        };
    }

    /**
     * Validate an access token
     */
    static async validate(accessToken: string, clientToken?: string): Promise<boolean> {
        const where: any = { accessToken };
        if (clientToken) {
            where.clientToken = clientToken;
        }

        const session = await YggdrasilSession.findOne({ where });
        
        if (!session) {
            return false;
        }

        // Check if expired
        if (session.isExpired()) {
            await session.remove();
            return false;
        }

        return true;
    }

    /**
     * Invalidate an access token (logout)
     */
    static async invalidate(accessToken: string, clientToken: string): Promise<void> {
        const session = await YggdrasilSession.findOne({ 
            where: { accessToken, clientToken } 
        });

        if (session) {
            await session.remove();
        }
    }

    /**
     * Sign out all sessions for a user (invalidate all tokens)
     */
    static async signout(username: string, password: string): Promise<void> {
        // For ModpackStore accounts, we don't use password authentication
        // This is mainly for Yggdrasil compatibility
        throw new APIError(501, "Not implemented for ModpackStore accounts", "NOT_IMPLEMENTED");
    }

    /**
     * Join a server - called by the client when joining
     */
    static async joinServer(
        accessToken: string,
        selectedProfile: string,
        serverId: string
    ): Promise<void> {
        const session = await YggdrasilSession.findOne({ where: { accessToken } });

        if (!session || session.isExpired()) {
            throw new APIError(403, "Invalid session", "INVALID_SESSION");
        }

        const profile = await YggdrasilProfile.findOne({ where: { userId: session.userId } });
        if (!profile) {
            throw new APIError(404, "Profile not found", "PROFILE_NOT_FOUND");
        }

        // Verify the profile UUID matches
        const normalizedUuid = profile.minecraftUuid.replace(/-/g, '');
        if (normalizedUuid !== selectedProfile) {
            throw new APIError(403, "Profile mismatch", "PROFILE_MISMATCH");
        }

        // Store the server ID for validation
        session.serverId = serverId;
        await session.updateActivity();
    }

    /**
     * Has joined - called by the server to verify the client
     */
    static async hasJoined(
        username: string,
        serverId: string,
        ip?: string
    ): Promise<{
        id: string;
        name: string;
        properties: any[];
    } | null> {
        // Find profile by username
        const profile = await YggdrasilProfile.findOne({ 
            where: { minecraftUsername: username } 
        });

        if (!profile) {
            return null;
        }

        // Find active session with matching server ID
        const session = await YggdrasilSession.findOne({
            where: { userId: profile.userId, serverId }
        });

        if (!session || session.isExpired()) {
            return null;
        }

        // Clear the server ID (one-time use)
        session.serverId = null;
        await session.updateActivity();

        return profile.toYggdrasilFormat();
    }

    /**
     * Get profile by UUID
     */
    static async getProfile(uuid: string): Promise<{
        id: string;
        name: string;
        properties: any[];
    } | null> {
        // Normalize UUID (remove dashes)
        const normalizedUuid = uuid.replace(/-/g, '');
        
        // Find profile by minecraft UUID
        const profile = await YggdrasilProfile.findOne({
            where: { minecraftUuid: normalizedUuid }
        });

        if (!profile) {
            // Try with dashes
            const uuidWithDashes = this.addDashesToUuid(normalizedUuid);
            const profileWithDashes = await YggdrasilProfile.findOne({
                where: { minecraftUuid: uuidWithDashes }
            });
            
            if (profileWithDashes) {
                return profileWithDashes.toYggdrasilFormat();
            }
            
            return null;
        }

        return profile.toYggdrasilFormat();
    }

    /**
     * Generate a random session token
     */
    private static generateToken(): string {
        return crypto.randomBytes(32).toString('hex');
    }

    /**
     * Generate a deterministic Minecraft UUID from user ID
     */
    private static generateMinecraftUUID(userId: string): string {
        // Create a deterministic UUID based on user ID
        const hash = crypto.createHash('md5').update(`modpackstore:${userId}`).digest('hex');
        
        // Format as UUID (8-4-4-4-12)
        return `${hash.substring(0, 8)}-${hash.substring(8, 12)}-${hash.substring(12, 16)}-${hash.substring(16, 20)}-${hash.substring(20, 32)}`;
    }

    /**
     * Add dashes to a UUID string
     */
    private static addDashesToUuid(uuid: string): string {
        if (uuid.length !== 32) {
            return uuid;
        }
        return `${uuid.substring(0, 8)}-${uuid.substring(8, 12)}-${uuid.substring(12, 16)}-${uuid.substring(16, 20)}-${uuid.substring(20, 32)}`;
    }

    /**
     * Clean up expired sessions
     */
    static async cleanupExpiredSessions(): Promise<void> {
        const sessions = await YggdrasilSession.find();
        const expiredSessions = sessions.filter(s => s.isExpired());
        
        for (const session of expiredSessions) {
            await session.remove();
        }
    }
}
