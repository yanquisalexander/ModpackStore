import { Context } from 'hono';
import { ActivityFeedService } from '@/services/activity-feed.service';
import { APIError } from '@/lib/APIError';
import { AuthVariables } from "@/middlewares/auth.middleware";
import { ActivityType } from '@/types/enums';

type StatusUpdatePayload = {
    isOnline?: boolean;
    modpackId?: string;
    isPlaying?: boolean;
};

type ActivityVisibilityPayload = {
    activityId: string;
    isVisible: boolean;
};

export class ActivityFeedController {
    /**
     * Get the user's activity feed
     */
    static async getActivityFeed(c: Context<{ Variables: AuthVariables }>): Promise<Response> {
        const userId = c.get('userId');
        const limit = parseInt(c.req.query('limit') || '50');

        if (limit > 100) {
            throw new APIError(400, 'Limit cannot exceed 100', 'LIMIT_TOO_HIGH');
        }

        const activities = await ActivityFeedService.getActivityFeed(userId, limit);

        return c.json({
            success: true,
            data: {
                activities,
                total: activities.length
            }
        });
    }

    /**
     * Get friends' status (online, playing, etc.)
     */
    static async getFriendsStatus(c: Context<{ Variables: AuthVariables }>): Promise<Response> {
        const userId = c.get('userId');

        const friendsStatus = await ActivityFeedService.getFriendsStatus(userId);

        return c.json({
            success: true,
            data: {
                friends: friendsStatus
            }
        });
    }

    /**
     * Update user's online status
     */
    static async updateOnlineStatus(c: Context<{ Variables: AuthVariables }>): Promise<Response> {
        const userId = c.get('userId');
        const body = await c.req.json() as StatusUpdatePayload;

        if (typeof body.isOnline !== 'boolean') {
            throw new APIError(400, 'isOnline must be a boolean', 'INVALID_STATUS');
        }

        await ActivityFeedService.updateUserOnlineStatus(userId, body.isOnline);

        return c.json({
            success: true,
            data: {
                message: `Status updated to ${body.isOnline ? 'online' : 'offline'}`,
                status: body.isOnline ? 'online' : 'offline'
            }
        });
    }

    /**
     * Update user's playing status
     */
    static async updatePlayingStatus(c: Context<{ Variables: AuthVariables }>): Promise<Response> {
        const userId = c.get('userId');
        const body = await c.req.json() as StatusUpdatePayload;

        if (typeof body.isPlaying !== 'boolean') {
            throw new APIError(400, 'isPlaying must be a boolean', 'INVALID_STATUS');
        }

        if (body.isPlaying && !body.modpackId) {
            throw new APIError(400, 'modpackId is required when isPlaying is true', 'MISSING_MODPACK_ID');
        }

        await ActivityFeedService.updateUserPlayingStatus(
            userId,
            body.modpackId || null,
            body.isPlaying
        );

        return c.json({
            success: true,
            data: {
                message: body.isPlaying 
                    ? `Now playing ${body.modpackId}` 
                    : 'Stopped playing',
                isPlaying: body.isPlaying,
                modpackId: body.modpackId
            }
        });
    }

    /**
     * Log modpack installation/uninstallation
     */
    static async logModpackAction(c: Context<{ Variables: AuthVariables }>): Promise<Response> {
        const userId = c.get('userId');
        const modpackId = c.req.param('modpackId');
        const action = c.req.query('action'); // 'install' or 'uninstall'

        if (!modpackId) {
            throw new APIError(400, 'Modpack ID is required', 'MISSING_MODPACK_ID');
        }

        if (!action || !['install', 'uninstall'].includes(action)) {
            throw new APIError(400, 'Action must be "install" or "uninstall"', 'INVALID_ACTION');
        }

        await ActivityFeedService.logModpackInstallation(
            userId,
            modpackId,
            action === 'install'
        );

        return c.json({
            success: true,
            data: {
                message: `Modpack ${action} logged successfully`,
                action,
                modpackId
            }
        });
    }

    /**
     * Log achievement unlock
     */
    static async logAchievement(c: Context<{ Variables: AuthVariables }>): Promise<Response> {
        const userId = c.get('userId');
        const body = await c.req.json() as {
            achievementId: string;
            achievementName: string;
            modpackId?: string;
        };

        if (!body.achievementId || !body.achievementName) {
            throw new APIError(400, 'Achievement ID and name are required', 'MISSING_ACHIEVEMENT_DATA');
        }

        await ActivityFeedService.logAchievementUnlock(
            userId,
            body.achievementId,
            body.achievementName,
            body.modpackId
        );

        return c.json({
            success: true,
            data: {
                message: 'Achievement logged successfully',
                achievement: {
                    id: body.achievementId,
                    name: body.achievementName
                }
            }
        });
    }

    /**
     * Get current status of a specific user
     */
    static async getUserStatus(c: Context<{ Variables: AuthVariables }>): Promise<Response> {
        const targetUserId = c.req.param('userId');
        const currentUserId = c.get('userId');

        if (!targetUserId) {
            throw new APIError(400, 'User ID is required', 'MISSING_USER_ID');
        }

        // Check if users are friends (privacy consideration)
        const { FriendshipService } = await import('@/services/friendship.service');
        const friendshipStatus = await FriendshipService.getFriendshipStatus(currentUserId, targetUserId);
        
        if (!friendshipStatus.areFriends && targetUserId !== currentUserId) {
            throw new APIError(403, 'Can only view status of friends', 'NOT_FRIENDS');
        }

        const userStatus = await ActivityFeedService.getUserStatus(targetUserId);

        if (!userStatus) {
            throw new APIError(404, 'User not found', 'USER_NOT_FOUND');
        }

        return c.json({
            success: true,
            data: userStatus
        });
    }

    /**
     * Get user's own activities
     */
    static async getUserActivities(c: Context<{ Variables: AuthVariables }>): Promise<Response> {
        const userId = c.get('userId');
        const limit = parseInt(c.req.query('limit') || '20');

        if (limit > 50) {
            throw new APIError(400, 'Limit cannot exceed 50 for user activities', 'LIMIT_TOO_HIGH');
        }

        const activities = await ActivityFeedService.getUserActivities(userId, limit);

        return c.json({
            success: true,
            data: {
                activities,
                total: activities.length
            }
        });
    }

    /**
     * Toggle activity visibility
     */
    static async toggleActivityVisibility(c: Context<{ Variables: AuthVariables }>): Promise<Response> {
        const userId = c.get('userId');
        const body = await c.req.json() as ActivityVisibilityPayload;

        if (!body.activityId) {
            throw new APIError(400, 'Activity ID is required', 'MISSING_ACTIVITY_ID');
        }

        if (typeof body.isVisible !== 'boolean') {
            throw new APIError(400, 'isVisible must be a boolean', 'INVALID_VISIBILITY');
        }

        await ActivityFeedService.toggleActivityVisibility(
            body.activityId,
            userId,
            body.isVisible
        );

        return c.json({
            success: true,
            data: {
                message: `Activity ${body.isVisible ? 'shown' : 'hidden'}`,
                activityId: body.activityId,
                isVisible: body.isVisible
            }
        });
    }

    /**
     * Create a custom activity (for testing or special events)
     */
    static async createCustomActivity(c: Context<{ Variables: AuthVariables }>): Promise<Response> {
        const userId = c.get('userId');
        const body = await c.req.json() as {
            activityType: ActivityType;
            modpackId?: string;
            metadata?: Record<string, any>;
        };

        if (!body.activityType) {
            throw new APIError(400, 'Activity type is required', 'MISSING_ACTIVITY_TYPE');
        }

        const activity = await ActivityFeedService.createActivity(
            userId,
            body.activityType,
            body.modpackId,
            body.metadata
        );

        return c.json({
            success: true,
            data: {
                message: 'Custom activity created successfully',
                activity: {
                    id: activity.id,
                    activityType: activity.activityType,
                    createdAt: activity.createdAt
                }
            }
        });
    }

    /**
     * Get activity feed statistics
     */
    static async getActivityStats(c: Context<{ Variables: AuthVariables }>): Promise<Response> {
        const userId = c.get('userId');
        
        const [activities, friendsStatus] = await Promise.all([
            ActivityFeedService.getUserActivities(userId, 10),
            ActivityFeedService.getFriendsStatus(userId)
        ]);

        const onlineFriends = friendsStatus.filter(friend => friend.isOnline);
        const playingFriends = friendsStatus.filter(friend => friend.currentModpack);

        const stats = {
            recentActivities: activities.length,
            totalFriends: friendsStatus.length,
            onlineFriends: onlineFriends.length,
            playingFriends: playingFriends.length,
            currentlyPlaying: playingFriends.map(friend => ({
                username: friend.username,
                modpack: friend.currentModpack?.name
            }))
        };

        return c.json({
            success: true,
            data: stats
        });
    }
}