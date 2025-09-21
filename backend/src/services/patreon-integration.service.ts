import { User } from "@/entities/User";

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

export enum PatreonTier {
    NONE = 'none',
    BASIC = 'basic',
    PREMIUM = 'premium',
    ELITE = 'elite'
}

export class PatreonIntegrationService {
    private static readonly PATREON_API_BASE = 'https://www.patreon.com/api/oauth2/v2';
    
    // Tier thresholds in cents (configure these based on your Patreon tiers)
    private static readonly TIER_THRESHOLDS = {
        [PatreonTier.BASIC]: 300, // $3
        [PatreonTier.PREMIUM]: 500, // $5
        [PatreonTier.ELITE]: 1000 // $10
    };

    /**
     * Verify if a user is a Patreon supporter and get their tier
     */
    static async verifyPatreonStatus(userId: string): Promise<{
        isPatron: boolean;
        tier: PatreonTier;
        entitledAmount: number;
        isActive: boolean;
    }> {
        const user = await User.findOne({ where: { id: userId } });
        
        if (!user || !user.patreonId || !user.patreonAccessToken) {
            return {
                isPatron: false,
                tier: PatreonTier.NONE,
                entitledAmount: 0,
                isActive: false
            };
        }

        try {
            const member = await this.getPatreonMemberInfo(user.patreonAccessToken);
            
            if (!member) {
                return {
                    isPatron: false,
                    tier: PatreonTier.NONE,
                    entitledAmount: 0,
                    isActive: false
                };
            }

            const entitledAmount = member.attributes.currently_entitled_amount_cents;
            const isActive = member.attributes.patron_status === 'active_patron' && 
                           member.attributes.last_charge_status === 'Paid';
            
            const tier = this.determineTier(entitledAmount);

            return {
                isPatron: isActive && entitledAmount > 0,
                tier: isActive ? tier : PatreonTier.NONE,
                entitledAmount,
                isActive
            };
        } catch (error) {
            console.error('Error verifying Patreon status:', error);
            return {
                isPatron: false,
                tier: PatreonTier.NONE,
                entitledAmount: 0,
                isActive: false
            };
        }
    }

    /**
     * Check if user can access premium features
     */
    static async canAccessPremiumFeatures(userId: string): Promise<boolean> {
        const status = await this.verifyPatreonStatus(userId);
        return status.isPatron && status.isActive;
    }

    /**
     * Check if user can upload custom cover image
     */
    static async canUploadCoverImage(userId: string): Promise<boolean> {
        const status = await this.verifyPatreonStatus(userId);
        return status.isPatron && status.isActive && status.tier !== PatreonTier.NONE;
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
     * Determine Patreon tier based on entitled amount
     */
    private static determineTier(entitledAmountCents: number): PatreonTier {
        if (entitledAmountCents >= this.TIER_THRESHOLDS[PatreonTier.ELITE]) {
            return PatreonTier.ELITE;
        } else if (entitledAmountCents >= this.TIER_THRESHOLDS[PatreonTier.PREMIUM]) {
            return PatreonTier.PREMIUM;
        } else if (entitledAmountCents >= this.TIER_THRESHOLDS[PatreonTier.BASIC]) {
            return PatreonTier.BASIC;
        }
        return PatreonTier.NONE;
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
     * Handle Patreon OAuth callback
     */
    static async handlePatreonCallback(
        code: string,
        userId: string
    ): Promise<{ success: boolean; error?: string }> {
        try {
            // Exchange code for access token
            const tokenResponse = await this.exchangeCodeForToken(code);
            
            if (!tokenResponse.access_token) {
                return { success: false, error: 'Failed to get access token' };
            }

            // Get user info from Patreon
            const userInfo = await this.getPatreonUserInfo(tokenResponse.access_token);
            
            if (!userInfo) {
                return { success: false, error: 'Failed to get user info' };
            }

            // Update user with Patreon data
            const user = await User.findOne({ where: { id: userId } });
            if (!user) {
                return { success: false, error: 'User not found' };
            }

            user.patreonId = userInfo.id;
            user.patreonAccessToken = tokenResponse.access_token;
            user.patreonRefreshToken = tokenResponse.refresh_token;
            await user.save();

            return { success: true };
        } catch (error) {
            console.error('Error handling Patreon callback:', error);
            return { success: false, error: 'Internal server error' };
        }
    }

    /**
     * Exchange authorization code for access token
     */
    private static async exchangeCodeForToken(code: string): Promise<any> {
        const clientId = process.env.PATREON_CLIENT_ID;
        const clientSecret = process.env.PATREON_CLIENT_SECRET;
        const redirectUri = process.env.PATREON_REDIRECT_URI;

        const response = await fetch('https://www.patreon.com/api/oauth2/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                code,
                grant_type: 'authorization_code',
                client_id: clientId!,
                client_secret: clientSecret!,
                redirect_uri: redirectUri!
            })
        });

        return await response.json();
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
     * Get premium features available for user's tier
     */
    static getPremiumFeaturesForTier(tier: PatreonTier): string[] {
        const features: Record<PatreonTier, string[]> = {
            [PatreonTier.NONE]: [],
            [PatreonTier.BASIC]: [
                'custom_cover_image',
                'priority_support'
            ],
            [PatreonTier.PREMIUM]: [
                'custom_cover_image',
                'priority_support',
                'early_access',
                'exclusive_modpacks'
            ],
            [PatreonTier.ELITE]: [
                'custom_cover_image',
                'priority_support',
                'early_access',
                'exclusive_modpacks',
                'custom_badges',
                'beta_features'
            ]
        };

        return features[tier] || [];
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
        const user = await User.findOne({ where: { patreonId: patronId } });
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
        const user = await User.findOne({ where: { patreonId: patronId } });
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
            user.patreonId = null;
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
    static async handleOAuthCallback(code: string, state: string): Promise<{ success: boolean; error?: string }> {
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
                patreonId: userInfo.id,
                email: userInfo.attributes.email
            });

            return { 
                success: true, 
                data: {
                    patreonId: userInfo.id,
                    tokens: {
                        access_token: tokenResponse.access_token,
                        refresh_token: tokenResponse.refresh_token
                    },
                    userInfo: userInfo.attributes
                }
            };
        } catch (error) {
            console.error('[PATREON_OAUTH] Error handling OAuth callback:', error);
            return { success: false, error: 'Internal server error' };
        }
    }
}