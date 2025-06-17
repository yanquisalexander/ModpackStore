import "dotenv/config";
import axios from "axios";
import jwt from "jsonwebtoken"; // Import jsonwebtoken
import { User, TokenPayload } from "@/models/User.model"; // Assuming TokenPayload is exported or defined here
import { Session } from "@/models/Session.model";
import { exchangeCodeForToken, getDiscordUser } from '@/services/discord';
import { DISCORD_GUILD_ID, IS_BETA_PROGRAM } from "@/consts";

const DISCORD_GUILDS_URL = "https://discord.com/api/users/@me/guilds";

// TODO: Replace console.log with a dedicated logger solution throughout the service.

export interface AuthTokens {
    token_type: 'bearer';
    expires_in: number; // Typically 3600 for 1 hour
    access_token: string;
    refresh_token: string;
}

export class AuthService {
    /**
     * Handles the Discord OAuth callback process.
     * @param code The authorization code from Discord.
     * @returns AuthTokens containing access and refresh tokens.
     * @throws Error if any step fails (e.g., code exchange, user fetching, guild check, DB operations).
     */
    static async handleDiscordCallback(code: string): Promise<AuthTokens> {
        console.log("[SERVICE_AUTH][DISCORD] Processing callback for code:", code);

        const discordToken = await exchangeCodeForToken(code);
        console.log("[SERVICE_AUTH][DISCORD] Token received from Discord:", discordToken);

        const discordApiUser = await getDiscordUser(discordToken.access_token);
        console.log("[SERVICE_AUTH][DISCORD] User data from Discord API:", discordApiUser);

        if (IS_BETA_PROGRAM && DISCORD_GUILD_ID) {
            console.log("[SERVICE_AUTH][DISCORD] Beta program active, checking guild membership.");
            try {
                const guildResponse = await axios.get(DISCORD_GUILDS_URL, {
                    headers: { Authorization: `Bearer ${discordToken.access_token}` },
                    timeout: 15000, // Adjusted timeout
                });
                const guilds = guildResponse.data as { id: string }[];
                const isMember = guilds.some(guild => guild.id === DISCORD_GUILD_ID);
                if (!isMember) {
                    console.warn(`[SERVICE_AUTH][DISCORD] User ${discordApiUser.id} not in required guild ${DISCORD_GUILD_ID}.`);
                    // Throw a specific error type that can be caught by the controller
                    const error = new Error('User is not a member of the required guild.');
                    (error as any).statusCode = 403;
                    (error as any).errorCode = 'NOT_IN_GUILD';
                    throw error;
                }
                console.log("[SERVICE_AUTH][DISCORD] User is member of the guild.");
            } catch (guildError: any) {
                console.error("[SERVICE_AUTH][DISCORD] Error checking guild membership:", guildError.message);
                if (axios.isAxiosError(guildError) && guildError.response?.status === 401) {
                    const error = new Error('Invalid Discord token when checking guilds.');
                    (error as any).statusCode = 401; // Unauthorized or token issue
                    throw error;
                }
                // Re-throw original error or a generic one if not Axios related
                throw new Error('Failed to verify guild membership.');
            }
        }

        let user = await User.findByDiscordId(discordApiUser.id);
        const userAvatarUrl = discordApiUser.avatar ? `https://cdn.discordapp.com/avatars/${discordApiUser.id}/${discordApiUser.avatar}.png` : null;

        if (!user) {
            console.log(`[SERVICE_AUTH][DISCORD] User ${discordApiUser.id} not found. Creating new user.`);
            user = await User.create({
                discordId: discordApiUser.id,
                username: discordApiUser.username, // Consider handling username conflicts/uniqueness if necessary
                email: discordApiUser.email, // Ensure email is verified if used for critical functions
                avatarUrl: userAvatarUrl ?? undefined,
                discordAccessToken: discordToken.access_token,
                discordRefreshToken: discordToken.refresh_token,
                admin: false,
            });
        } else {
            console.log(`[SERVICE_AUTH][DISCORD] User ${discordApiUser.id} found. Updating tokens and avatar.`);
            // Use the static User.update method for specific field updates
            user = await User.update(user.id, {
                discordAccessToken: discordToken.access_token,
                discordRefreshToken: discordToken.refresh_token,
                avatarUrl: userAvatarUrl,
                // Ensure other fields are not unintentionally wiped if User.update replaces the whole document
                // The User.model.ts's userUpdateSchema should handle partial updates correctly.
            });
            // The 'user' variable now holds a new User instance returned by User.update.
        }

        // Create a new session for the user
        // Assuming deviceInfo and locationInfo can be empty objects or collected differently
        const session = await Session.create({ userId: user.id, deviceInfo: {}, locationInfo: {} });
        console.log(`[SERVICE_AUTH] Session created for user ${user.id}: ${session.id}`);

        const jwtTokens = await user.generateTokens(session); // generateTokens should be an instance method on User

        return {
            token_type: 'bearer',
            expires_in: 3600, // Standard expiry for access tokens (1 hour)
            access_token: jwtTokens.accessToken,
            refresh_token: jwtTokens.refreshToken,
        };
    }

    /**
     * Refreshes authentication tokens using a refresh token.
     * @param refreshTokenString The refresh token string.
     * @returns New AuthTokens.
     * @throws Error if refresh token is invalid, user/session not found, or token generation fails.
     */
    static async refreshAuthTokens(refreshTokenString: string): Promise<AuthTokens> {
        console.log("[SERVICE_AUTH] Attempting to refresh tokens.");

        if (!refreshTokenString) {
            const error = new Error('Missing refresh token.');
            (error as any).statusCode = 400;
            throw error;
        }

        let decodedPayload: TokenPayload; // Use TokenPayload from User model
        try {
            // Verify the refresh token using the JWT_SECRET
            const secret = process.env.JWT_SECRET;
            if (!secret) {
                console.error("[SERVICE_AUTH] JWT_SECRET is not configured.");
                throw new Error("Internal configuration error: JWT secret missing."); // This error will be caught by the outer try-catch
            }
            // This will throw an error if the token is invalid, expired, or signature doesn't match
            decodedPayload = jwt.verify(refreshTokenString, secret) as TokenPayload;

        } catch (e: any) {
            console.error("[SERVICE_AUTH] Invalid or expired refresh token:", e.message);
            const error = new Error('Invalid or expired refresh token.');
            (error as any).statusCode = 401;
            throw error;
        }

        const userId = decodedPayload.sub;
        const sessionId = decodedPayload.sessionId;

        // No longer need this specific check as jwt.verify would fail if sub or sessionId are not in the payload type TokenPayload
        // if (!userId || !sessionId) { ... }

        console.log(`[SERVICE_AUTH] Refresh token verified & decoded. UserID: ${userId}, SessionID: ${sessionId}`);

        const user = await User.findById(userId);
        if (!user) {
            console.warn(`[SERVICE_AUTH] User ${userId} not found for refresh token.`);
            const error = new Error('User not found.');
            (error as any).statusCode = 401;
            throw error;
        }

        const session = await Session.findById(sessionId);
        if (!session) {
            console.warn(`[SERVICE_AUTH] Session ${sessionId} not found for refresh token.`);
            // Optionally, revoke all user sessions or mark user if a compromised/old session is used.
            const error = new Error('Session not found or has been revoked.');
            (error as any).statusCode = 401;
            throw error;
        }

        // Verify that the session belongs to the user specified in the refresh token
        if (session.userId !== user.id) {
            console.error(`[SERVICE_AUTH] Session user ID ${session.userId} does not match token user ID ${user.id}.`);
            const error = new Error('Session-user mismatch.'); // Security risk, handle carefully
            (error as any).statusCode = 401;
            throw error;
        }

        console.log(`[SERVICE_AUTH] User ${userId} and Session ${sessionId} validated. Generating new tokens.`);
        const newJwtTokens = await user.generateTokens(session); // generateTokens is an instance method

        return {
            token_type: 'bearer',
            expires_in: 3600,
            access_token: newJwtTokens.accessToken,
            refresh_token: newJwtTokens.refreshToken, // Potentially issue a new refresh token (depends on strategy)
        };
    }

    /**
     * Retrieves the public profile for an authenticated user.
     * @param userId The ID of the user.
     * @returns A public representation of the user.
     * @throws Error if the user is not found.
     */
    static async getAuthenticatedUserProfile(userId: string): Promise<any> { // Return type 'any' for now, should be UserPublicProfile
        console.log(`[SERVICE_AUTH] Fetching complete profile for user ${userId}`);
        if (!userId) {
            const error = new Error('User ID not provided.');
            (error as any).statusCode = 400; // Or 401 if this implies an unauthenticated state
            throw error;
        }

        // DEBUG: Log before DB call
        console.log('[SERVICE_AUTH] Calling User.getCompleteUser with:', userId);
        const userWithRelations = await User.getCompleteUser(userId);
        console.log('[SERVICE_AUTH] getCompleteUser result:', userWithRelations);

        if (!userWithRelations) {
            console.warn(`[SERVICE_AUTH] User ${userId} not found when fetching complete profile.`);
            const error = new Error('User not found.');
            (error as any).statusCode = 404;
            throw error;
        }

        // Create a User instance for its methods, but use the rich data from getCompleteUser
        const userInstance = new User(userWithRelations); // User constructor takes UserType
        const publicUserProfile = userInstance.toPublicJson();

        // Combine public user data with any additional relations that are safe to return
        // For example, publisherMemberships. Ensure no sensitive details from memberships are leaked.
        // This example assumes publisherMemberships from getCompleteUser is an array of appropriate objects.
        return {
            ...publicUserProfile,
            publisherMemberships: userWithRelations.publisherMemberships || [],
            // Add other relations here if needed, after ensuring they are safe for client exposure
        };
    }
}
