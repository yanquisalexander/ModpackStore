import { ApiClient } from '@twurple/api';
import { APIError } from '@/lib/APIError';
import { User } from '@/entities/User';

interface TwitchOAuthTokens {
    access_token: string;
    refresh_token: string;
    token_type: string;
    expires_in: number;
}

interface TwitchUserData {
    id: string;
    login: string;
    display_name: string;
    type: string;
    broadcaster_type: string;
    description: string;
    profile_image_url: string;
    offline_image_url: string;
    view_count: number;
    email?: string;
    created_at: string;
}

export class TwitchService {
    private static clientId = process.env.TWITCH_CLIENT_ID;
    private static clientSecret = process.env.TWITCH_CLIENT_SECRET;
    private static redirectUri = process.env.TWITCH_REDIRECT_URI || 'http://localhost:1958/callback';

    /**
     * Exchange authorization code for access tokens
     */
    static async exchangeCodeForToken(code: string): Promise<TwitchOAuthTokens> {
        if (!this.clientId || !this.clientSecret) {
            throw new APIError(500, 'Twitch OAuth credentials not configured');
        }

        const params = new URLSearchParams({
            client_id: this.clientId,
            client_secret: this.clientSecret,
            code,
            grant_type: 'authorization_code',
            redirect_uri: this.redirectUri,
        });

        try {
            const response = await fetch('https://id.twitch.tv/oauth2/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: params,
            });

            if (!response.ok) {
                const errorData = await response.text();
                throw new APIError(400, `Twitch OAuth error: ${errorData}`);
            }

            const tokenData = await response.json();
            return tokenData;
        } catch (error) {
            console.error('Error exchanging Twitch code for token:', error);
            throw new APIError(500, 'Failed to exchange authorization code for token');
        }
    }

    /**
     * Get Twitch user data using access token
     */
    static async getTwitchUser(accessToken: string): Promise<TwitchUserData> {
        if (!this.clientId) {
            throw new APIError(500, 'Twitch client ID not configured');
        }

        try {
            const response = await fetch('https://api.twitch.tv/helix/users', {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Client-Id': this.clientId,
                },
            });

            if (!response.ok) {
                const errorData = await response.text();
                throw new APIError(400, `Twitch API error: ${errorData}`);
            }

            const userData = await response.json();
            if (!userData.data || userData.data.length === 0) {
                throw new APIError(404, 'Twitch user not found');
            }

            return userData.data[0];
        } catch (error) {
            console.error('Error fetching Twitch user:', error);
            throw new APIError(500, 'Failed to fetch Twitch user data');
        }
    }

    /**
     * Refresh Twitch access token
     */
    static async refreshTwitchToken(refreshToken: string): Promise<TwitchOAuthTokens> {
        if (!this.clientId || !this.clientSecret) {
            throw new APIError(500, 'Twitch OAuth credentials not configured');
        }

        const params = new URLSearchParams({
            client_id: this.clientId,
            client_secret: this.clientSecret,
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
        });

        try {
            const response = await fetch('https://id.twitch.tv/oauth2/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: params,
            });

            if (!response.ok) {
                const errorData = await response.text();
                throw new APIError(400, `Twitch token refresh error: ${errorData}`);
            }

            const tokenData = await response.json();
            return tokenData;
        } catch (error) {
            console.error('Error refreshing Twitch token:', error);
            throw new APIError(500, 'Failed to refresh Twitch token');
        }
    }

    /**
     * Check if user is subscribed to any of the specified channels
     * For now, we'll use the Twitch API directly without Twurple for subscriptions
     */
    static async checkUserSubscriptions(
        userAccessToken: string,
        userId: string,
        channelIds: string[]
    ): Promise<boolean> {
        if (!this.clientId || !this.clientSecret) {
            throw new APIError(500, 'Twitch OAuth credentials not configured');
        }

        try {
            // Check subscriptions to each channel using Twitch API directly
            for (const channelId of channelIds) {
                try {
                    // Check if user is subscribed to this channel
                    const response = await fetch(`https://api.twitch.tv/helix/subscriptions?broadcaster_id=${channelId}&user_id=${userId}`, {
                        headers: {
                            'Authorization': `Bearer ${userAccessToken}`,
                            'Client-Id': this.clientId,
                        },
                    });

                    if (response.ok) {
                        const data = await response.json();
                        if (data.data && data.data.length > 0) {
                            return true; // User is subscribed to at least one channel
                        }
                    }
                } catch (subscriptionError) {
                    // If there's an error (like 404 for no subscription), continue to next channel
                    console.log(`No subscription found for user ${userId} to channel ${channelId}`);
                    continue;
                }
            }

            return false; // User is not subscribed to any of the channels
        } catch (error) {
            console.error('Error checking Twitch subscriptions:', error);
            throw new APIError(500, 'Failed to verify Twitch subscriptions');
        }
    }

    /**
     * Validate access token with Twitch
     */
    static async validateAccessToken(accessToken: string): Promise<boolean> {
        try {
            const response = await fetch('https://id.twitch.tv/oauth2/validate', {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            });

            return response.ok;
        } catch (error) {
            console.error('Error validating Twitch access token:', error);
            return false;
        }
    }

    /**
     * Link Twitch account to user
     */
    static async linkTwitchToUser(user: User, code: string): Promise<void> {
        try {
            // Exchange code for tokens
            const tokens = await this.exchangeCodeForToken(code);
            
            // Get user data from Twitch
            const twitchUser = await this.getTwitchUser(tokens.access_token);

            // Check if Twitch ID is already linked to another user
            const existingUser = await User.findOne({ where: { twitchId: twitchUser.id } });
            if (existingUser && existingUser.id !== user.id) {
                throw new APIError(400, 'This Twitch account is already linked to another user');
            }

            // Update user with Twitch data
            user.twitchId = twitchUser.id;
            user.twitchAccessToken = tokens.access_token;
            user.twitchRefreshToken = tokens.refresh_token;

            await user.save();
        } catch (error) {
            console.error('Error linking Twitch to user:', error);
            if (error instanceof APIError) {
                throw error;
            }
            throw new APIError(500, 'Failed to link Twitch account');
        }
    }

    /**
     * Unlink Twitch account from user
     */
    static async unlinkTwitchFromUser(user: User): Promise<void> {
        try {
            user.twitchId = null;
            user.twitchAccessToken = null;
            user.twitchRefreshToken = null;

            await user.save();
        } catch (error) {
            console.error('Error unlinking Twitch from user:', error);
            throw new APIError(500, 'Failed to unlink Twitch account');
        }
    }

    /**
     * Check if user can access a Twitch-protected modpack
     */
    static async canUserAccessModpack(
        user: User,
        requiredChannelIds: string[]
    ): Promise<boolean> {
        if (!user.hasTwitchLinked()) {
            return false;
        }

        try {
            // Validate and potentially refresh user's Twitch token
            const isValid = await this.validateAccessToken(user.twitchAccessToken!);
            if (!isValid && user.twitchRefreshToken) {
                // Try to refresh the token
                const newTokens = await this.refreshTwitchToken(user.twitchRefreshToken);
                user.twitchAccessToken = newTokens.access_token;
                user.twitchRefreshToken = newTokens.refresh_token;
                await user.save();
            } else if (!isValid) {
                // Token is invalid and no refresh token available
                return false;
            }

            // Check subscriptions
            return await this.checkUserSubscriptions(
                user.twitchAccessToken!,
                user.twitchId!,
                requiredChannelIds
            );
        } catch (error) {
            console.error('Error checking user access to modpack:', error);
            return false;
        }
    }
}