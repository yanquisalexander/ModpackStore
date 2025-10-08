import { GameSession } from "@/entities/GameSession";
import { User } from "@/entities/User";
import { randomBytes } from "crypto";
import { v4 as uuidv4 } from "uuid";

const GAME_SESSION_TIMEOUT_MS = 20 * 60 * 1000; // 20 minutes

/**
 * Service for managing game authentication sessions (Yggdrasil/authlib-injector)
 */
export class GameSessionService {
    /**
     * Create a new game session for a user
     * @param user The user to create a session for
     * @param clientToken Optional client token provided by the game client
     * @param profileName The username/nickname to use in-game
     * @returns The created game session with access token
     */
    static async createSession(
        user: User,
        clientToken?: string,
        profileName?: string
    ): Promise<GameSession> {
        // Generate a random access token
        const accessToken = randomBytes(32).toString("hex");
        
        // Use provided profile name or default to user's username
        const name = profileName || user.username;
        
        // Validate profile name (Minecraft username rules)
        if (name.length < 3 || name.length > 16) {
            throw new Error("Profile name must be between 3 and 16 characters");
        }
        
        if (!/^[a-zA-Z0-9_]+$/.test(name)) {
            throw new Error("Profile name can only contain letters, numbers, and underscores");
        }

        // Create profile ID (consistent UUID for this user)
        // We use a deterministic UUID based on user ID to maintain consistency
        const profileId = user.id; // Use the user's UUID as their profile ID

        const now = new Date();
        const expiresAt = new Date(now.getTime() + GAME_SESSION_TIMEOUT_MS);

        const session = GameSession.create({
            userId: user.id,
            accessToken,
            clientToken: clientToken || null,
            profileName: name,
            profileId,
            lastActivityAt: now,
            expiresAt,
            invalidated: false
        });

        await session.save();
        
        // Load user relation
        session.user = user;
        
        return session;
    }

    /**
     * Refresh an existing game session
     * @param accessToken Current access token
     * @param clientToken Client token for validation
     * @returns Refreshed game session with new access token
     */
    static async refreshSession(
        accessToken: string,
        clientToken?: string
    ): Promise<GameSession> {
        const session = await GameSession.findByAccessToken(accessToken);
        
        if (!session || session.isExpired()) {
            throw new Error("Invalid or expired access token");
        }

        // Validate client token if provided
        if (clientToken && session.clientToken && session.clientToken !== clientToken) {
            throw new Error("Client token mismatch");
        }

        // Invalidate the old session
        session.invalidated = true;
        await session.save();

        // Create a new session with the same profile
        return await this.createSession(
            session.user,
            session.clientToken || clientToken,
            session.profileName
        );
    }

    /**
     * Validate a game session access token
     * @param accessToken The access token to validate
     * @param clientToken Optional client token for additional validation
     * @returns true if valid, false otherwise
     */
    static async validateSession(
        accessToken: string,
        clientToken?: string
    ): Promise<boolean> {
        const session = await GameSession.findValidByAccessToken(accessToken);
        
        if (!session) {
            return false;
        }

        // Validate client token if provided
        if (clientToken && session.clientToken && session.clientToken !== clientToken) {
            return false;
        }

        // Update activity timestamp
        session.updateActivity();
        await session.save();

        return true;
    }

    /**
     * Invalidate a game session
     * @param accessToken The access token to invalidate
     * @param clientToken Optional client token for validation
     */
    static async invalidateSession(
        accessToken: string,
        clientToken?: string
    ): Promise<void> {
        const session = await GameSession.findByAccessToken(accessToken);
        
        if (!session || session.invalidated) {
            return; // Already invalidated or doesn't exist
        }

        // Validate client token if provided
        if (clientToken && session.clientToken && session.clientToken !== clientToken) {
            throw new Error("Client token mismatch");
        }

        session.invalidated = true;
        await session.save();
    }

    /**
     * Sign out all sessions for a user
     * @param userId The user ID
     */
    static async signOutUser(userId: string): Promise<void> {
        await GameSession.invalidateAllForUser(userId);
    }

    /**
     * Clean up expired sessions (should be run periodically)
     */
    static async cleanupExpiredSessions(): Promise<void> {
        const now = new Date();
        await GameSession.createQueryBuilder()
            .update()
            .set({ invalidated: true })
            .where("expires_at < :now", { now })
            .andWhere("invalidated = :invalidated", { invalidated: false })
            .execute();
    }

    /**
     * Get session info by access token
     * @param accessToken The access token
     * @returns Session info or null if not found/expired
     */
    static async getSessionInfo(accessToken: string): Promise<{
        user: User;
        profileName: string;
        profileId: string;
    } | null> {
        const session = await GameSession.findValidByAccessToken(accessToken);
        
        if (!session) {
            return null;
        }

        // Update activity
        session.updateActivity();
        await session.save();

        return {
            user: session.user,
            profileName: session.profileName,
            profileId: session.profileId
        };
    }
}
