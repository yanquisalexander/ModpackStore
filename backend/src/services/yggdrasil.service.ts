import { GameSession } from "@/entities/GameSession";
import { User } from "@/entities/User";
import { randomBytes } from "crypto";
import { APIError } from "@/lib/APIError";

/**
 * Yggdrasil Authentication Service
 * Implements Mojang/Yggdrasil authentication protocol for authlib-injector compatibility
 */

// Game session TTL: 20 minutes of inactivity
const GAME_SESSION_TTL_MINUTES = 20;

export interface YggdrasilAuthenticateRequest {
    username?: string; // Not used, we use JWT from ModpackStore
    password?: string; // Not used
    clientToken?: string;
    requestUser?: boolean;
    agent?: {
        name: string;
        version: number;
    };
}

export interface YggdrasilAuthenticateResponse {
    accessToken: string;
    clientToken: string;
    availableProfiles: YggdrasilProfile[];
    selectedProfile: YggdrasilProfile;
    user?: {
        id: string;
        properties: any[];
    };
}

export interface YggdrasilProfile {
    id: string;
    name: string;
    properties?: YggdrasilProperty[];
}

export interface YggdrasilProperty {
    name: string;
    value: string;
    signature?: string;
}

export interface YggdrasilRefreshRequest {
    accessToken: string;
    clientToken?: string;
    requestUser?: boolean;
}

export interface YggdrasilValidateRequest {
    accessToken: string;
    clientToken?: string;
}

export interface YggdrasilInvalidateRequest {
    accessToken: string;
    clientToken?: string;
}

export class YggdrasilService {
    /**
     * Generate a new game session token for authenticated user
     * @param user - The ModpackStore user
     * @param profileName - The Minecraft username/nickname to use (from ms_nickname or user.username)
     * @param clientToken - Optional client token from the request
     */
    static async authenticate(
        user: User,
        profileName: string,
        clientToken?: string
    ): Promise<YggdrasilAuthenticateResponse> {
        // Validate profile name (Minecraft username rules)
        if (!this.isValidMinecraftUsername(profileName)) {
            throw new APIError(
                400,
                "Invalid profile name. Must be 3-16 characters, alphanumeric and underscores only.",
                "INVALID_PROFILE_NAME"
            );
        }

        // Generate access token (cryptographically secure)
        const accessToken = this.generateAccessToken();
        const finalClientToken = clientToken || this.generateClientToken();

        // Calculate expiration (20 minutes from now)
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + GAME_SESSION_TTL_MINUTES);

        // Create game session
        const gameSession = GameSession.create({
            userId: user.id,
            accessToken,
            clientToken: finalClientToken,
            profileName,
            expiresAt,
            lastActivityAt: new Date(),
        });

        await gameSession.save();

        // Build response
        const profile: YggdrasilProfile = {
            id: this.formatUUID(user.id),
            name: profileName,
        };

        return {
            accessToken,
            clientToken: finalClientToken,
            availableProfiles: [profile],
            selectedProfile: profile,
            user: {
                id: user.id,
                properties: [],
            },
        };
    }

    /**
     * Refresh an existing game session
     */
    static async refresh(
        accessToken: string,
        clientToken?: string
    ): Promise<YggdrasilAuthenticateResponse> {
        const gameSession = await GameSession.findValidByAccessToken(accessToken);

        if (!gameSession) {
            throw new APIError(403, "Invalid or expired access token", "INVALID_TOKEN");
        }

        // Optionally validate client token match
        if (clientToken && gameSession.clientToken !== clientToken) {
            throw new APIError(403, "Client token mismatch", "INVALID_CLIENT_TOKEN");
        }

        // Generate new access token
        const newAccessToken = this.generateAccessToken();

        // Update session
        gameSession.accessToken = newAccessToken;
        gameSession.expiresAt = new Date();
        gameSession.expiresAt.setMinutes(
            gameSession.expiresAt.getMinutes() + GAME_SESSION_TTL_MINUTES
        );
        gameSession.lastActivityAt = new Date();

        await gameSession.save();

        // Load user for response
        const user = await User.findOne({ where: { id: gameSession.userId } });
        if (!user) {
            throw new APIError(404, "User not found", "USER_NOT_FOUND");
        }

        const profile: YggdrasilProfile = {
            id: this.formatUUID(user.id),
            name: gameSession.profileName,
        };

        return {
            accessToken: newAccessToken,
            clientToken: gameSession.clientToken || "",
            availableProfiles: [profile],
            selectedProfile: profile,
            user: {
                id: user.id,
                properties: [],
            },
        };
    }

    /**
     * Validate a game session token
     */
    static async validate(accessToken: string, clientToken?: string): Promise<void> {
        const gameSession = await GameSession.findValidByAccessToken(accessToken);

        if (!gameSession) {
            throw new APIError(403, "Invalid or expired access token", "INVALID_TOKEN");
        }

        // Optionally validate client token match
        if (clientToken && gameSession.clientToken !== clientToken) {
            throw new APIError(403, "Client token mismatch", "INVALID_CLIENT_TOKEN");
        }

        // Update last activity
        await gameSession.updateActivity();
    }

    /**
     * Invalidate a game session
     */
    static async invalidate(accessToken: string, clientToken?: string): Promise<void> {
        const gameSession = await GameSession.findOne({
            where: { accessToken },
        });

        if (!gameSession) {
            // Yggdrasil protocol: no error if token doesn't exist
            return;
        }

        // Optionally validate client token match
        if (clientToken && gameSession.clientToken !== clientToken) {
            throw new APIError(403, "Client token mismatch", "INVALID_CLIENT_TOKEN");
        }

        await gameSession.remove();
    }

    /**
     * Get player profile for session server (used by Minecraft servers to verify players)
     */
    static async getProfile(uuid: string): Promise<YggdrasilProfile | null> {
        // Find user by UUID
        const user = await User.findOne({ where: { id: uuid } });
        
        if (!user) {
            return null;
        }

        // Find active game session for this user
        const gameSession = await GameSession.createQueryBuilder("gs")
            .where("gs.user_id = :userId", { userId: uuid })
            .andWhere("gs.expires_at > :now", { now: new Date() })
            .orderBy("gs.created_at", "DESC")
            .getOne();

        if (!gameSession) {
            return null;
        }

        // Return profile with skin properties
        return {
            id: this.formatUUID(user.id),
            name: gameSession.profileName,
            properties: this.getPlayerProperties(user),
        };
    }

    /**
     * Get player properties (skin, cape, etc.)
     */
    private static getPlayerProperties(user: User): YggdrasilProperty[] {
        const properties: YggdrasilProperty[] = [];

        // Build textures object
        const textures: any = {
            timestamp: Date.now(),
            profileId: this.formatUUID(user.id),
            profileName: user.username,
            textures: {} as any,
        };

        // Add skin if user has avatar
        if (user.avatarUrl) {
            textures.textures.SKIN = {
                url: user.avatarUrl,
            };
        }

        // Encode textures as base64
        const texturesBase64 = Buffer.from(JSON.stringify(textures)).toString("base64");

        properties.push({
            name: "textures",
            value: texturesBase64,
            // Note: signature would require private key signing, not implemented for now
        });

        return properties;
    }

    /**
     * Generate a secure random access token
     */
    private static generateAccessToken(): string {
        return randomBytes(32).toString("hex");
    }

    /**
     * Generate a client token
     */
    private static generateClientToken(): string {
        return randomBytes(16).toString("hex");
    }

    /**
     * Format UUID to Mojang format (without dashes)
     */
    private static formatUUID(uuid: string): string {
        return uuid.replace(/-/g, "");
    }

    /**
     * Validate Minecraft username rules
     */
    private static isValidMinecraftUsername(username: string): boolean {
        if (!username || username.length < 3 || username.length > 16) {
            return false;
        }
        return /^[a-zA-Z0-9_]+$/.test(username);
    }

    /**
     * Get authlib-injector metadata
     */
    static getMetadata(serverUrl: string) {
        return {
            meta: {
                serverName: "ModpackStore AuthServer",
                implementationName: "ModpackStore",
                implementationVersion: "1.0.0",
                "feature.non_email_login": true,
            },
            skinDomains: [
                "modpackstore.net",
                ".modpackstore.net",
            ],
            signaturePublickey: null, // We don't sign responses yet
        };
    }
}
