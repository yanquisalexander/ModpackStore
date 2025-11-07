import { User } from "@/entities/User";
import { UserRole } from "@/types/enums";
import { PatreonSyncService } from "./patreon-sync.service";
import { PatreonTier as PatreonTierEntity } from "@/entities/PatreonTier";

export interface PatreonUser {
    id: string;
    attributes: {
        email: string;
        full_name: string;
        image_url: string;
        is_email_verified: boolean;
        patron_status: string;
    };
}

export interface PatreonMember {
    id: string;
    attributes: {
        patron_status: string;
        currently_entitled_amount_cents: number;
        lifetime_support_cents: number;
        last_charge_status: string;
        pledge_relationship_start: string;
    };
}

export class PatreonIntegrationService {
    private static readonly PATREON_API_BASE = 'https://www.patreon.com/api/oauth2/v2';

    /**
     * Get the highest tier by amount
     */
    private static async getHighestTier(): Promise<{ id: string; name: string; amountCents: number; description?: string } | null> {
        try {
            const highestTier = await PatreonTierEntity.findOne({
                where: { active: true },
                order: { amountCents: 'DESC' }
            });

            if (highestTier) {
                return {
                    id: highestTier.id,
                    name: highestTier.name,
                    amountCents: highestTier.amountCents,
                    description: highestTier.description || undefined
                };
            }
            return null;
        } catch (error) {
            console.error('Error getting highest tier:', error);
            return null;
        }
    }

    /**
     * Verify if a user is a Patreon supporter and get their tier
     */
    static async verifyPatreonStatus(userId: string): Promise<{
        isPatron: boolean;
        tier: string;
        tierId: string | null;
        entitledAmount: number;
        isActive: boolean;
        isConnected: boolean;
    }> {
        const user = await User.findOne({ where: { id: userId } });

        if (!user) {
            return {
                isPatron: false,
                tier: 'free',
                tierId: null,
                entitledAmount: 0,
                isActive: false,
                isConnected: false
            };
        }

        // For admin and superadmin users, always give them the highest tier
        if (user.role === UserRole.ADMIN || user.role === UserRole.SUPERADMIN) {
            const highestTier = await this.getHighestTier();
            if (highestTier) {
                return {
                    isPatron: true,
                    tier: highestTier.name,
                    tierId: highestTier.id,
                    entitledAmount: highestTier.amountCents,
                    isActive: true,
                    isConnected: true
                };
            }
        }

        if (!user.patreonUserId) {
            return {
                isPatron: false,
                tier: 'free',
                tierId: null,
                entitledAmount: 0,
                isActive: false,
                isConnected: false
            };
        }

        // Use synchronized data from PatreonSyncService
        try {
            // Get the tier information from the synchronized data
            let tier = 'free';
            let tierId: string | null = null;
            if (user.patreonTierId) {
                const patreonTier = await PatreonTierEntity.findOne({ where: { id: user.patreonTierId } });
                if (patreonTier) {
                    tier = patreonTier.name.toLowerCase().replace(/\s+/g, '-'); // Convert to slug format
                    tierId = patreonTier.id;
                }
            }

            const isActive = user.patreonIsActive === true;
            const entitledAmount = user.patreonEntitledAmount || 0;
            const isPatron = isActive && entitledAmount > 0;

            return {
                isPatron,
                tier: isActive ? tier : 'free',
                tierId,
                entitledAmount,
                isActive,
                isConnected: true
            };
        } catch (error) {
            console.error('Error verifying Patreon status from sync data:', error);
            // Fallback to no patron status if sync data is unavailable
            return {
                isPatron: false,
                tier: 'free',
                tierId: null,
                entitledAmount: 0,
                isActive: false,
                isConnected: true // Connected but error reading sync data
            };
        }
    }

    /**
     * Check if user can access premium features
     */
    static async canAccessPremiumFeatures(userId: string): Promise<boolean> {
        const user = await User.findOne({ where: { id: userId } });

        // Admins and superadmins always have access to premium features
        if (user && (user.role === UserRole.ADMIN || user.role === UserRole.SUPERADMIN)) {
            return true;
        }

        const status = await this.verifyPatreonStatus(userId);
        return status.isPatron && status.isActive;
    }

    /**
     * Check if user can upload custom cover image
     */
    static async canUploadCoverImage(userId: string): Promise<boolean> {
        const user = await User.findOne({ where: { id: userId } });

        // Admins and superadmins always have access to premium features
        if (user && (user.role === UserRole.ADMIN || user.role === UserRole.SUPERADMIN)) {
            return true;
        }

        const status = await this.verifyPatreonStatus(userId);
        return status.isPatron && status.isActive && status.tier !== 'free';
    }

    /**
     * Get Patreon member information
     */
    private static async getPatreonMemberInfo(accessToken: string): Promise<PatreonMember | null> {
        try {
            const response = await fetch(`${this.PATREON_API_BASE}/identity?include=memberships&fields%5Bmember%5D=patron_status,currently_entitled_amount_cents,lifetime_support_cents,last_charge_status,pledge_relationship_start`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Patreon API error: ${response.status}`);
            }

            const data = await response.json();

            // Find the membership for our campaign
            const membership = data.included?.find((item: any) => item.type === 'member');

            return membership || null;
        } catch (error) {
            console.error('Error fetching Patreon member info:', error);
            return null;
        }
    }

    /**
     * Update user's Patreon status in database
     */
    static async updateUserPatreonStatus(userId: string): Promise<void> {
        const status = await this.verifyPatreonStatus(userId);

        // Here you could update additional fields in the user record
        // to cache the Patreon status for faster access
        const user = await User.findOne({ where: { id: userId } });
        if (user) {
            // You could add fields like patronTier, patronStatus, etc.
            // For now, the verification is done on-demand
            await user.save();
        }
    }

    /**
     * Handle Patreon OAuth callback (legacy method for manual code entry)
     * Note: OAuth codes can only be used once, so this may not work reliably
     * The OAuth callback flow now uses handleOAuthCallback + linkPatreonAccount
     */
    static async handlePatreonCallback(
        code: string,
        userId: string
    ): Promise<{ success: boolean; error?: string }> {
        try {
            const user = await User.findOne({ where: { id: userId } });

            if (!user) {
                return { success: false, error: 'User not found' };
            }

            // Exchange code for tokens
            const tokenData = await this.exchangeCodeForToken(code);

            if (!tokenData.access_token) {
                return { success: false, error: 'Failed to get access token' };
            }

            // Get user info from Patreon
            const patreonUser = await this.getPatreonUserInfo(tokenData.access_token);

            if (!patreonUser) {
                return { success: false, error: 'Failed to get Patreon user info' };
            }

            // Save Patreon data to user
            user.patreonUserId = patreonUser.id;
            user.patreonAccessToken = tokenData.access_token;
            user.patreonRefreshToken = tokenData.refresh_token || null;

            // Clear any cached Patreon data to force refresh
            user.patreonTier = 'free';
            user.patreonStatus = null;
            user.patreonEntitledAmount = 0;
            user.patreonIsActive = false;
            user.patreonLastVerified = new Date();

            await user.save();

            return { success: true };
        } catch (error) {
            console.error('Error handling Patreon callback:', error);
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    }

    /**
     * Exchange authorization code for access token
     */
    private static async exchangeCodeForToken(code: string): Promise<any> {
        const clientId = process.env.PATREON_CLIENT_ID;
        const clientSecret = process.env.PATREON_CLIENT_SECRET;
        const redirectUri = process.env.PATREON_REDIRECT_URI;

        if (!clientId || !clientSecret || !redirectUri) {
            throw new Error('Missing Patreon OAuth configuration');
        }

        const response = await fetch('https://www.patreon.com/api/oauth2/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                code,
                grant_type: 'authorization_code',
                client_id: clientId,
                client_secret: clientSecret,
                redirect_uri: redirectUri
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('[PATREON_OAUTH] Token exchange failed:', data);
            throw new Error(`Patreon token exchange failed: ${data.error_description || data.error || 'Unknown error'}`);
        }

        return data;
    }

    /**
     * Get Patreon user information
     */
    private static async getPatreonUserInfo(accessToken: string): Promise<PatreonUser | null> {
        try {
            const response = await fetch(`${this.PATREON_API_BASE}/identity?fields%5Buser%5D=email,full_name,image_url,is_email_verified`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Patreon API error: ${response.status}`);
            }

            const data = await response.json();
            return data.data;
        } catch (error) {
            console.error('Error fetching Patreon user info:', error);
            return null;
        }
    }

    /**
     * Get tier description for a Patreon tier
     */
    static async getTierDescription(tierId: string, userId?: string): Promise<string> {
        try {
            // Check if user is admin/superadmin first
            if (userId) {
                const user = await User.findOne({ where: { id: userId } });
                if (user && (user.role === UserRole.ADMIN || user.role === UserRole.SUPERADMIN)) {
                    const highestTier = await this.getHighestTier();
                    if (highestTier) {
                        return highestTier.description || `Plan ${highestTier.name} - Nivel más alto disponible`;
                    }
                }
            }

            // Special case for free tier - return generic description
            if (tierId === 'free' || !tierId) {
                return 'Usuario gratuito - Sin beneficios';
            }

            // Find the tier by ID
            const tier = await PatreonTierEntity.findOne({
                where: {
                    id: tierId,
                    active: true
                }
            });

            if (!tier) {
                return 'Plan desconocido'; // Default for unknown tiers
            }

            // Return the description from PatreonTier
            return tier.description || 'Sin descripción disponible';
        } catch (error) {
            console.error('Error getting tier description:', error);
            return 'Error al cargar la descripción del plan';
        }
    }

    /**
     * Refresh Patreon access token
     */
    static async refreshPatreonToken(userId: string): Promise<boolean> {
        const user = await User.findOne({ where: { id: userId } });

        if (!user || !user.patreonRefreshToken) {
            return false;
        }

        try {
            const clientId = process.env.PATREON_CLIENT_ID;
            const clientSecret = process.env.PATREON_CLIENT_SECRET;

            const response = await fetch('https://www.patreon.com/api/oauth2/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams({
                    grant_type: 'refresh_token',
                    refresh_token: user.patreonRefreshToken,
                    client_id: clientId!,
                    client_secret: clientSecret!
                })
            });

            const data = await response.json();

            if (data.access_token) {
                user.patreonAccessToken = data.access_token;
                if (data.refresh_token) {
                    user.patreonRefreshToken = data.refresh_token;
                }
                await user.save();
                return true;
            }
        } catch (error) {
            console.error('Error refreshing Patreon token:', error);
        }

        return false;
    }

    /**
     * Handle Patreon webhook events
     */
    static async handleWebhook(payload: any): Promise<void> {
        try {
            const eventType = payload.data?.type;
            const attributes = payload.data?.attributes;
            const relationships = payload.data?.relationships;

            console.log('[PATREON_WEBHOOK] Processing event:', {
                eventType,
                userId: relationships?.patron?.data?.id,
                pledgeAmount: attributes?.currently_entitled_amount_cents
            });

            switch (eventType) {
                case 'members:pledge:create':
                case 'members:pledge:update':
                case 'members:pledge:delete':
                    await this.handleMembershipEvent(payload);
                    break;

                case 'members:create':
                case 'members:update':
                case 'members:delete':
                    await this.handleMemberEvent(payload);
                    break;

                default:
                    console.log('[PATREON_WEBHOOK] Unhandled event type:', eventType);
            }
        } catch (error) {
            console.error('[PATREON_WEBHOOK] Error processing webhook:', error);
            throw error;
        }
    }

    /**
     * Handle membership-related webhook events
     */
    private static async handleMembershipEvent(payload: any): Promise<void> {
        const patronId = payload.data?.relationships?.patron?.data?.id;
        const pledgeAmountCents = payload.data?.attributes?.currently_entitled_amount_cents || 0;
        const patronStatus = payload.data?.attributes?.patron_status;
        const lastChargeStatus = payload.data?.attributes?.last_charge_status;

        if (!patronId) {
            console.warn('[PATREON_WEBHOOK] No patron ID in membership event');
            return;
        }

        // Find user by Patreon ID
        const user = await User.findOne({ where: { patreonUserId: patronId } });
        if (!user) {
            console.warn('[PATREON_WEBHOOK] User not found for Patreon ID:', patronId);
            return;
        }

        console.log('[PATREON_WEBHOOK] Updating user Patreon status:', {
            userId: user.id,
            patronId,
            pledgeAmountCents,
            patronStatus,
            lastChargeStatus
        });

        // Update user's Patreon status
        await this.updateUserPatreonStatus(user.id);
    }

    /**
     * Handle member-related webhook events
     */
    private static async handleMemberEvent(payload: any): Promise<void> {
        const patronId = payload.data?.id;
        const attributes = payload.data?.attributes;

        if (!patronId) {
            console.warn('[PATREON_WEBHOOK] No patron ID in member event');
            return;
        }

        // Find user by Patreon ID
        const user = await User.findOne({ where: { patreonUserId: patronId } });
        if (!user) {
            console.warn('[PATREON_WEBHOOK] User not found for Patreon ID:', patronId);
            return;
        }

        console.log('[PATREON_WEBHOOK] Processing member event for user:', {
            userId: user.id,
            patronId,
            eventType: payload.data?.type,
            patronStatus: attributes?.patron_status
        });

        // For member deletion, clear Patreon data
        if (payload.data?.type === 'members:delete') {
            user.patreonUserId = null;
            user.patreonAccessToken = null;
            user.patreonRefreshToken = null;
            user.coverImageUrl = null; // Remove premium features
            await user.save();
            console.log('[PATREON_WEBHOOK] Cleared Patreon data for deleted member:', user.id);
        } else {
            // Update user's Patreon status
            await this.updateUserPatreonStatus(user.id);
        }
    }

    /**
     * Create a new backend endpoint to receive OAuth code from Rust module
     */
    static async handleOAuthCallback(code: string, state: string): Promise<{ success: boolean; error?: string; data?: any }> {
        try {
            // Validate state parameter for CSRF protection
            // You might want to implement state validation here

            // Exchange code for tokens
            const tokenResponse = await this.exchangeCodeForToken(code);

            if (!tokenResponse.access_token) {
                return { success: false, error: 'Failed to get access token' };
            }

            // Get user info from Patreon
            const userInfo = await this.getPatreonUserInfo(tokenResponse.access_token);

            if (!userInfo) {
                return { success: false, error: 'Failed to get user info' };
            }

            console.log('[PATREON_OAUTH] Successfully processed OAuth callback:', {
                patreonUserId: userInfo.id,
                email: userInfo.attributes.email
            });

            return {
                success: true,
                data: {
                    patreonUserId: userInfo.id,
                    tokens: {
                        access_token: tokenResponse.access_token,
                        refresh_token: tokenResponse.refresh_token
                    },
                    userInfo: userInfo.attributes
                }
            };
        } catch (error: any) {
            console.error('[PATREON_OAUTH] OAuth callback error:', error.message);
            return { success: false, error: error.message || 'Failed to process Patreon OAuth' };
        }
    }

    /**
     * Link Patreon account to user using OAuth data
     */
    static async linkPatreonAccount(
        userId: string,
        oauthData: { patreonUserId: string; tokens: { access_token: string; refresh_token: string }; userInfo: any }
    ): Promise<{ success: boolean; error?: string }> {
        try {
            // Update user with Patreon data
            const user = await User.findOne({ where: { id: userId } });
            if (!user) {
                return { success: false, error: 'User not found' };
            }

            user.patreonUserId = oauthData.patreonUserId; // Save patreon_user_id for sync
            user.patreonAccessToken = oauthData.tokens.access_token;
            user.patreonRefreshToken = oauthData.tokens.refresh_token;

            // Initialize cached Patreon status (will be updated on first verification)
            user.patreonTier = 'free';
            user.patreonStatus = null;
            user.patreonEntitledAmount = 0;
            user.patreonIsActive = false;
            user.patreonLastVerified = null; // Force immediate verification

            await user.save();

            // Sync this specific user's Patreon data
            try {
                await this.syncUserPatreonData(user.id);
                console.log(`[PATREON_LINK] Successfully synced Patreon data for user ${userId}`);
            } catch (syncError) {
                console.warn(`[PATREON_LINK] Failed to sync Patreon data for user ${userId}:`, syncError);
                // Don't fail the linking process if sync fails
            }

            console.log(`[PATREON_LINK] Successfully linked Patreon account for user ${userId}:`, {
                patreonId: oauthData.patreonUserId,
                patreonUserId: oauthData.patreonUserId,
                email: oauthData.userInfo.email
            });

            return { success: true };
        } catch (error) {
            console.error('Error linking Patreon account:', error);
            return { success: false, error: 'Internal server error' };
        }
    }

    /**
     * Sync Patreon data for a specific user
     */
    private static async syncUserPatreonData(userId: string): Promise<void> {
        const user = await User.findOne({ where: { id: userId } });
        if (!user || !user.patreonUserId) {
            return;
        }

        try {
            // Fetch member data from Patreon API for this specific user
            const creatorAccessToken = process.env.PATREON_CREATOR_ACCESS_TOKEN;
            if (!creatorAccessToken) {
                throw new Error('Missing Patreon creator access token');
            }

            const response = await fetch(
                `${this.PATREON_API_BASE}/members/${user.patreonUserId}?include=currently_entitled_tiers&fields%5Bmember%5D=patron_status,currently_entitled_amount_cents,last_charge_status&fields%5Btier%5D=amount_cents`,
                {
                    headers: {
                        'Authorization': `Bearer ${creatorAccessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (!response.ok) {
                throw new Error(`Patreon API error: ${response.status} - ${response.statusText}`);
            }

            const data = await response.json();
            const memberData = data.data;
            const entitledTiers = memberData.relationships?.currently_entitled_tiers?.data || [];

            // Get the highest entitled tier
            let highestTier: PatreonTierEntity | null = null;
            let highestAmount = 0;

            for (const tierRef of entitledTiers) {
                const tier = await PatreonTierEntity.findOne({ where: { id: tierRef.id } });
                if (tier && tier.amountCents > highestAmount) {
                    highestTier = tier;
                    highestAmount = tier.amountCents;
                }
            }

            // Update user's Patreon data
            const isActive = memberData.attributes.patron_status === 'active_patron' &&
                memberData.attributes.last_charge_status === 'Paid';

            user.patreonTierId = highestTier?.id || null;
            user.patreonStatus = memberData.attributes.patron_status;
            user.patreonEntitledAmount = memberData.attributes.currently_entitled_amount_cents;
            user.patreonIsActive = isActive;
            user.patreonLastVerified = new Date();

            await user.save();

            console.log(`[PATREON_SYNC_USER] Updated user ${user.username}: tier=${highestTier?.name || 'None'}, isActive=${isActive}`);
        } catch (error) {
            console.error(`[PATREON_SYNC_USER] Error syncing user ${userId}:`, error);
            throw error;
        }
    }
}

