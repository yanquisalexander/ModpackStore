import { ApiClient } from '@twurple/api';
import { AppTokenAuthProvider } from '@twurple/auth';
import { RefreshingAuthProvider } from '@twurple/auth';
import { StaticAuthProvider } from '@twurple/auth';
import { AccessToken, RefreshingAuthProviderConfig } from '@twurple/auth';
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
    email?: string;
    created_at: string;
}

export class TwitchService {
    private static clientId = process.env.TWITCH_CLIENT_ID;
    private static clientSecret = process.env.TWITCH_CLIENT_SECRET;
    private static redirectUri = process.env.TWITCH_REDIRECT_URI || 'http://localhost:1958/callback';

    // Cache for API clients
    private static appApiClient: ApiClient | null = null;
    private static userApiClients: Map<string, ApiClient> = new Map();

    /**
     * Get App Access Token API Client (for operations that don't require user authentication)
     */
    static async getAppApiClient(): Promise<ApiClient> {
        if (!this.clientId || !this.clientSecret) {
            throw new APIError(500, 'Twitch OAuth credentials not configured');
        }

        if (!this.appApiClient) {
            const authProvider = new AppTokenAuthProvider(this.clientId, this.clientSecret);
            this.appApiClient = new ApiClient({ authProvider });
        }

        return this.appApiClient;
    }

    /**
     * Get User Access Token API Client (for user-specific operations)
     */
    static async getUserApiClient(userId: string, accessToken: string, refreshToken?: string): Promise<ApiClient> {
        if (!this.clientId || !this.clientSecret) {
            throw new APIError(500, 'Twitch OAuth credentials not configured');
        }

        // Check if we already have a client for this user
        if (this.userApiClients.has(userId)) {
            return this.userApiClients.get(userId)!;
        }

        let authProvider;

        if (refreshToken) {
            // Use RefreshingAuthProvider for automatic token refresh
            authProvider = new RefreshingAuthProvider({
                clientId: this.clientId,
                clientSecret: this.clientSecret,
            });

            await authProvider.addUserForToken({
                accessToken,
                refreshToken,
                expiresIn: 0, // Will be determined automatically
                obtainmentTimestamp: Date.now()
            }, ['user:read:email']);
        } else if (accessToken) {
            // Use StaticAuthProvider with user's access token
            authProvider = new StaticAuthProvider(this.clientId, accessToken, ['user:read:email']);
        } else {
            // Fallback to AppTokenAuthProvider when no user tokens available
            authProvider = new AppTokenAuthProvider(this.clientId, this.clientSecret);
        }

        const apiClient = new ApiClient({ authProvider });

        // Cache the client
        this.userApiClients.set(userId, apiClient);

        return apiClient;
    }

    /**
     * Clear cached API client for a user (useful when tokens are invalidated)
     */
    static clearUserApiClient(userId: string): void {
        this.userApiClients.delete(userId);
    }

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
     * Get Twitch user data using access token (legacy method for compatibility)
     */
    static async getTwitchUser(accessToken: string): Promise<TwitchUserData> {
        try {
            const apiClient = await this.getUserApiClient('temp', accessToken);
            // For user API client, we need to get the authenticated user's ID first
            const tokenInfo = await this.validateAndGetUserId(accessToken);
            const user = await apiClient.users.getUserById(tokenInfo.userId);

            if (!user) {
                throw new APIError(404, 'User not found');
            }

            return {
                id: user.id,
                login: user.name,
                display_name: user.displayName,
                type: user.type || '',
                broadcaster_type: user.broadcasterType || '',
                description: user.description || '',
                profile_image_url: user.profilePictureUrl || '',
                offline_image_url: user.offlinePlaceholderUrl || '',
                created_at: user.creationDate.toISOString()
            };
        } catch (error) {
            console.error('Error fetching Twitch user with Twurple:', error);
            throw new APIError(500, 'Failed to fetch Twitch user data');
        }
    }

    /**
     * Validate token and get user ID (helper method)
     */
    private static async validateAndGetUserId(accessToken: string): Promise<{ userId: string }> {
        try {
            const response = await fetch('https://id.twitch.tv/oauth2/validate', {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            });

            if (!response.ok) {
                throw new Error('Invalid token');
            }

            const data = await response.json();
            return { userId: data.user_id };
        } catch (error) {
            throw new APIError(401, 'Invalid access token');
        }
    }

    /**
     * Get Twitch user by ID using App API Client
     */
    static async getUserById(userId: string) {
        try {
            const apiClient = await this.getAppApiClient();
            return await apiClient.users.getUserById(userId);
        } catch (error) {
            console.error('Error fetching Twitch user by ID:', error);
            throw new APIError(500, 'Failed to fetch Twitch user');
        }
    }

    /**
     * Get Twitch user by username using App API Client
     */
    static async getUserByName(username: string) {
        try {
            const apiClient = await this.getAppApiClient();
            return await apiClient.users.getUserByName(username);
        } catch (error) {
            console.error('Error fetching Twitch user by name:', error);
            throw new APIError(500, 'Failed to fetch Twitch user');
        }
    }

    /**
     * Get stream information using App API Client
     */
    static async getStreamByUserId(userId: string) {
        try {
            const apiClient = await this.getAppApiClient();
            return await apiClient.streams.getStreamByUserId(userId);
        } catch (error) {
            console.error('Error fetching Twitch stream:', error);
            throw new APIError(500, 'Failed to fetch stream information');
        }
    }

    /**
     * Get channel information using App API Client
     */
    static async getChannelInfo(userId: string) {
        try {
            const apiClient = await this.getAppApiClient();
            return await apiClient.channels.getChannelInfoById(userId);
        } catch (error) {
            console.error('Error fetching Twitch channel info:', error);
            throw new APIError(500, 'Failed to fetch channel information');
        }
    }

    /**
     * Check if user is subscribed to any of the specified channels using User API Client
     */
    static async checkUserSubscriptions(
        userId: string,
        userAccessToken: string,
        channelIds: string[],
        refreshToken?: string
    ): Promise<boolean> {
        try {
            const apiClient = await this.getUserApiClient(userId, userAccessToken, refreshToken);

            const helixUser = await apiClient.users.getUserById(userId);

            for (const channelId of channelIds) {
                try {
                    // getSubscriptionTo devuelve la suscripción si existe
                    const subscription = await helixUser?.getSubscriptionTo(channelId);
                    return Boolean(subscription);
                } catch (err) {
                    console.log(`Error usando helixUser.getSubscriptionTo para canal ${channelId}:`, err);
                    // Fallback a la llamada directa a la API de suscripciones
                    try {
                        const subscription = await apiClient.subscriptions.getSubscriptionForUser(channelId, userId);
                        if (subscription) {
                            return true;
                        }
                    } catch (err2) {
                        console.log(`No subscription found for user ${userId} to channel ${channelId}`);
                        continue;
                    }
                }
            }

            return false; // No está suscrito a ninguno de los canales




        } catch (error) {
            console.error('Error checking Twitch subscriptions with Twurple:', error);
            throw new APIError(500, 'Failed to verify Twitch subscriptions');
        }
    }



    /**
     * Get user's subscriptions using User API Client
     */
    static async getUserSubscriptions(userId: string, userAccessToken: string, limit: number = 20) {
        try {
            const apiClient = await this.getUserApiClient(userId, userAccessToken);
            return await apiClient.subscriptions.getSubscriptions(userId);
        } catch (error) {
            console.error('Error fetching user subscriptions:', error);
            throw new APIError(500, 'Failed to fetch user subscriptions');
        }
    }

    /**
     * Refresh Twitch access token (legacy method for compatibility)
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
     * Validate access token with Twitch (legacy method for compatibility)
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

            // Get user data from Twitch using Twurple
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

            // Clear any cached API client for this user
            this.clearUserApiClient(user.id);
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

            // Clear cached API client
            this.clearUserApiClient(user.id);
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
            // Get user's API client (will handle token refresh automatically if refresh token is available)
            const apiClient = await this.getUserApiClient(
                user.twitchId!,
                user.twitchAccessToken!,
                user.twitchRefreshToken || undefined
            );

            // Check subscriptions using Twurple
            return await this.checkUserSubscriptions(
                user.twitchId!,
                user.twitchAccessToken!,
                requiredChannelIds,
                user.twitchRefreshToken || undefined
            );
        } catch (error) {
            console.error('Error checking user access to modpack:', error);
            return false;
        }
    }

    /**
     * Get user's Twitch profile information
     */
    static async getUserProfile(userId: string, userAccessToken: string) {
        try {
            const apiClient = await this.getUserApiClient(userId, userAccessToken);
            return await apiClient.users.getUserById(userId);
        } catch (error) {
            console.error('Error fetching user profile:', error);
            throw new APIError(500, 'Failed to fetch user profile');
        }
    }

    /**
     * Get user's stream information (if currently streaming)
     */
    static async getUserStream(userId: string, userAccessToken: string) {
        try {
            const apiClient = await this.getUserApiClient(userId, userAccessToken);
            return await apiClient.streams.getStreamByUserId(userId);
        } catch (error) {
            console.error('Error fetching user stream:', error);
            throw new APIError(500, 'Failed to fetch stream information');
        }
    }
}