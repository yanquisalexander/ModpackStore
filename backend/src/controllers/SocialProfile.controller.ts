import { Context } from 'hono';
import { User } from '@/entities/User';
import { PatreonIntegrationService } from '@/services/patreon-integration.service';
import { APIError } from '@/lib/APIError';
import { AuthVariables, USER_CONTEXT_KEY } from "@/middlewares/auth.middleware";

type ProfileUpdatePayload = {
    coverImageUrl?: string;
};

export class SocialProfileController {
    /**
     * Get user's social profile
     */
    static async getProfile(c: Context<{ Variables: AuthVariables }>): Promise<Response> {
        const currentUser = c.get(USER_CONTEXT_KEY) as User;
        const userId = c.req.param('userId') || currentUser.id;
        const currentUserId = currentUser.id;

        let user: User | null;

        if (userId === currentUserId) {
            // Es el perfil del usuario actual
            user = currentUser;
        } else {
            // Es el perfil de otro usuario
            user = await User.findOne({ where: { id: userId } });

            if (!user) {
                throw new APIError(404, 'User not found', 'USER_NOT_FOUND');
            }
        }

        // Check if user can view this profile (privacy considerations)
        let canViewFullProfile = userId === currentUserId;

        if (!canViewFullProfile) {
            // Check if they are friends
            const { FriendshipService } = await import('@/services/friendship.service');
            const friendshipStatus = await FriendshipService.getFriendshipStatus(currentUserId, userId);
            canViewFullProfile = friendshipStatus.areFriends;
        }

        // Get additional profile data
        const [friends, patreonStatus] = await Promise.all([
            canViewFullProfile ? user.getFriends() : [],
            PatreonIntegrationService.verifyPatreonStatus(userId)
        ]);

        const profile = {
            ...user.toPublicJson(),
            // Only show these to friends or the user themselves
            friendsCount: canViewFullProfile ? friends.length : null,
            isPatron: patreonStatus.isPatron,
            patronTier: patreonStatus.tier,
            canViewFullProfile
        };

        return c.json({
            success: true,
            data: {
                profile
            }
        });
    }

    /**
     * Update user's cover image (Patreon feature)
     */
    static async updateCoverImage(c: Context<{ Variables: AuthVariables }>): Promise<Response> {
        const userId = c.get('userId');
        const body = await c.req.json() as ProfileUpdatePayload;

        if (!body.coverImageUrl) {
            throw new APIError(400, 'Cover image URL is required', 'MISSING_COVER_IMAGE_URL');
        }

        // Verify user can upload cover image (Patreon feature)
        const canUpload = await PatreonIntegrationService.canUploadCoverImage(userId);

        if (!canUpload) {
            throw new APIError(403, 'Cover image upload is a Patreon-only feature', 'PATREON_REQUIRED');
        }

        // Validate image URL (basic validation)
        if (!this.isValidImageUrl(body.coverImageUrl)) {
            throw new APIError(400, 'Invalid image URL', 'INVALID_IMAGE_URL');
        }

        const user = await User.findOne({ where: { id: userId } });

        if (!user) {
            throw new APIError(404, 'User not found', 'USER_NOT_FOUND');
        }

        user.coverImageUrl = body.coverImageUrl;
        await user.save();

        return c.json({
            success: true,
            data: {
                message: 'Cover image updated successfully',
                coverImageUrl: user.coverImageUrl
            }
        });
    }

    /**
     * Remove user's cover image
     */
    static async removeCoverImage(c: Context<{ Variables: AuthVariables }>): Promise<Response> {
        const userId = c.get('userId');

        const user = await User.findOne({ where: { id: userId } });

        if (!user) {
            throw new APIError(404, 'User not found', 'USER_NOT_FOUND');
        }

        user.coverImageUrl = null;
        await user.save();

        return c.json({
            success: true,
            data: {
                message: 'Cover image removed successfully'
            }
        });
    }

    /**
     * Get user's Patreon status and available features
     */
    static async getPatreonStatus(c: Context<{ Variables: AuthVariables }>): Promise<Response> {
        const userId = c.get('userId');

        const patreonStatus = await PatreonIntegrationService.verifyPatreonStatus(userId);
        const availableFeatures = PatreonIntegrationService.getPremiumFeaturesForTier(patreonStatus.tier);

        return c.json({
            success: true,
            data: {
                isPatron: patreonStatus.isPatron,
                tier: patreonStatus.tier,
                isActive: patreonStatus.isActive,
                entitledAmount: patreonStatus.entitledAmount,
                availableFeatures,
                canUploadCoverImage: patreonStatus.isPatron && patreonStatus.isActive
            }
        });
    }

    /**
     * Link Patreon account
     */
    static async linkPatreon(c: Context<{ Variables: AuthVariables }>): Promise<Response> {
        const userId = c.get('userId');
        const body = await c.req.json() as { code: string };

        if (!body.code) {
            throw new APIError(400, 'Authorization code is required', 'MISSING_CODE');
        }

        const result = await PatreonIntegrationService.handlePatreonCallback(body.code, userId);

        if (!result.success) {
            throw new APIError(400, result.error || 'Failed to link Patreon account', 'PATREON_LINK_FAILED');
        }

        return c.json({
            success: true,
            data: {
                message: 'Patreon account linked successfully'
            }
        });
    }

    /**
     * Unlink Patreon account
     */
    static async unlinkPatreon(c: Context<{ Variables: AuthVariables }>): Promise<Response> {
        const userId = c.get('userId');

        const user = await User.findOne({ where: { id: userId } });

        if (!user) {
            throw new APIError(404, 'User not found', 'USER_NOT_FOUND');
        }

        // Remove Patreon data
        user.patreonId = null;
        user.patreonAccessToken = null;
        user.patreonRefreshToken = null;

        // Remove cover image if user had one (since they lose premium access)
        if (user.coverImageUrl) {
            user.coverImageUrl = null;
        }

        await user.save();

        return c.json({
            success: true,
            data: {
                message: 'Patreon account unlinked successfully. Premium features have been disabled.'
            }
        });
    }

    /**
     * Get social statistics for user
     */
    static async getSocialStats(c: Context<{ Variables: AuthVariables }>): Promise<Response> {
        const userId = c.req.param('userId') || c.get('userId');
        const currentUserId = c.get('userId');

        const user = await User.findOne({ where: { id: userId } });

        if (!user) {
            throw new APIError(404, 'User not found', 'USER_NOT_FOUND');
        }

        // Check if user can view stats
        let canViewStats = userId === currentUserId;

        if (!canViewStats) {
            const { FriendshipService } = await import('@/services/friendship.service');
            const friendshipStatus = await FriendshipService.getFriendshipStatus(currentUserId, userId);
            canViewStats = friendshipStatus.areFriends;
        }

        if (!canViewStats) {
            throw new APIError(403, 'Can only view stats of friends', 'NOT_AUTHORIZED');
        }

        const [friends, sentRequests, receivedRequests] = await Promise.all([
            user.getFriends(),
            user.getSentFriendRequests(),
            user.getPendingFriendRequests()
        ]);

        const stats = {
            friendsCount: friends.length,
            pendingRequestsCount: receivedRequests.length,
            sentRequestsCount: sentRequests.length,
            joinDate: user.createdAt,
            isPatron: user.isPatron()
        };

        return c.json({
            success: true,
            data: stats
        });
    }

    /**
     * Upload cover image file (if implementing file upload)
     */
    static async uploadCoverImage(c: Context<{ Variables: AuthVariables }>): Promise<Response> {
        const userId = c.get('userId');

        // Verify user can upload cover image
        const canUpload = await PatreonIntegrationService.canUploadCoverImage(userId);

        if (!canUpload) {
            throw new APIError(403, 'Cover image upload is a Patreon-only feature', 'PATREON_REQUIRED');
        }

        // This would handle file upload logic
        // For now, we'll return a placeholder response
        return c.json({
            success: true,
            data: {
                message: 'File upload endpoint - implement with your preferred file storage solution',
                uploadUrl: 'placeholder_upload_url'
            }
        });
    }

    /**
     * Validate image URL format
     */
    private static isValidImageUrl(url: string): boolean {
        try {
            const parsedUrl = new URL(url);
            const validHosts = ['i.imgur.com', 'cdn.discordapp.com', 'your-cdn-domain.com'];
            const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

            const isValidHost = validHosts.some(host => parsedUrl.hostname === host);
            const isValidExtension = validExtensions.some(ext =>
                parsedUrl.pathname.toLowerCase().endsWith(ext)
            );

            return isValidHost && isValidExtension;
        } catch {
            return false;
        }
    }
}