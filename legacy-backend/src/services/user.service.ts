import { User } from "@/entities/User";
import { AppDataSource } from "@/db/data-source";
import { APIError } from "@/lib/APIError";

export interface UserDiscordData {
    discordId: string;
    username: string;
    email?: string;
    avatar?: string;
    provider: "discord";
}

export class UserService {
    /**
     * Find or create user with Discord authentication data using optimized upsert.
     * This function ensures discordId uniqueness and handles both creation and updates.
     */
    static async upsertDiscordUser(data: UserDiscordData): Promise<User> {
        const { discordId, username, email, avatar, provider } = data;

        if (!discordId?.trim()) {
            throw new APIError(400, 'Discord ID is required', 'MISSING_DISCORD_ID');
        }

        if (!username?.trim()) {
            throw new APIError(400, 'Username is required', 'MISSING_USERNAME');
        }

        try {
            const userRepository = AppDataSource.getRepository(User);
            
            // Try to find existing user by discordId
            let user = await userRepository.findOne({ 
                where: { discordId } 
            });

            const now = new Date();
            const avatarUrl = avatar ? `https://cdn.discordapp.com/avatars/${discordId}/${avatar}.png` : null;

            if (user) {
                // User exists - update their data
                console.log(`[UserService] Updating existing user with discordId: ${discordId}`);
                
                user.username = username;
                user.avatarUrl = avatarUrl;
                user.provider = provider;
                user.lastLoginAt = now;
                
                // Only update email if provided and different
                if (email && email !== user.email) {
                    user.email = email;
                }
                
                await user.save();
                
                console.log(`[UserService] Successfully updated user: ${user.id}`);
            } else {
                // User doesn't exist - create new one
                console.log(`[UserService] Creating new user with discordId: ${discordId}`);
                
                if (!email) {
                    throw new APIError(400, 'Email is required for new user creation', 'MISSING_EMAIL');
                }

                user = userRepository.create({
                    discordId,
                    username,
                    email,
                    avatarUrl: avatarUrl || undefined, // Convert null to undefined
                    provider,
                    lastLoginAt: now,
                });

                await user.save();
                
                console.log(`[UserService] Successfully created new user: ${user.id}`);
            }

            return user;
            
        } catch (error) {
            console.error('[UserService] Error in upsertDiscordUser:', error);
            
            // Handle unique constraint violations
            if (error instanceof Error && error.message.includes('duplicate key value violates unique constraint')) {
                if (error.message.includes('discord_id')) {
                    throw new APIError(409, 'Discord account is already linked to another user', 'DISCORD_ID_ALREADY_EXISTS');
                }
                if (error.message.includes('username')) {
                    throw new APIError(409, 'Username is already taken', 'USERNAME_ALREADY_EXISTS');
                }
                if (error.message.includes('email')) {
                    throw new APIError(409, 'Email is already registered', 'EMAIL_ALREADY_EXISTS');
                }
            }
            
            // Re-throw APIErrors as is
            if (error instanceof APIError) {
                throw error;
            }
            
            // Wrap other errors
            throw new APIError(500, 'Failed to create or update user', 'USER_UPSERT_FAILED');
        }
    }

    /**
     * Update Discord authentication tokens for a user
     */
    static async updateDiscordTokens(
        userId: string, 
        accessToken: string, 
        refreshToken: string
    ): Promise<void> {
        try {
            const userRepository = AppDataSource.getRepository(User);
            const user = await userRepository.findOne({ where: { id: userId } });
            
            if (!user) {
                throw new APIError(404, 'User not found', 'USER_NOT_FOUND');
            }

            user.discordAccessToken = accessToken;
            user.discordRefreshToken = refreshToken;
            await user.save();
            
            console.log(`[UserService] Updated Discord tokens for user: ${userId}`);
        } catch (error) {
            console.error('[UserService] Error updating Discord tokens:', error);
            
            if (error instanceof APIError) {
                throw error;
            }
            
            throw new APIError(500, 'Failed to update Discord tokens', 'TOKEN_UPDATE_FAILED');
        }
    }

    /**
     * Find user by Discord ID
     */
    static async findByDiscordId(discordId: string): Promise<User | null> {
        if (!discordId?.trim()) {
            return null;
        }

        try {
            const userRepository = AppDataSource.getRepository(User);
            return await userRepository.findOne({ where: { discordId } });
        } catch (error) {
            console.error(`[UserService] Error finding user by Discord ID ${discordId}:`, error);
            return null;
        }
    }
}