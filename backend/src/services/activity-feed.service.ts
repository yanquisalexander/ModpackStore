import { UserActivity } from "@/entities/UserActivity";
import { User } from "@/entities/User";
import { Modpack } from "@/entities/Modpack";
import { ActivityType } from "@/types/enums";
import { broadcast, sendToUser } from "./realtime.service";
import { FriendshipService } from "./friendship.service";

export interface ActivityFeedItem {
    id: string;
    user: {
        id: string;
        username: string;
        avatarUrl: string | null;
    };
    activityType: ActivityType;
    modpack?: {
        id: string;
        name: string;
        iconUrl: string | null;
    };
    metadata?: Record<string, any>;
    createdAt: Date;
}

export interface UserStatus {
    userId: string;
    username: string;
    avatarUrl: string | null;
    isOnline: boolean;
    currentModpack?: {
        id: string;
        name: string;
        iconUrl: string | null;
    };
    lastActivity?: Date;
}

export class ActivityFeedService {
    /**
     * Create and broadcast a user activity
     */
    static async createActivity(
        userId: string,
        activityType: ActivityType,
        modpackId?: string,
        metadata?: Record<string, any>
    ): Promise<UserActivity> {
        const activity = await UserActivity.createActivity(userId, activityType, modpackId, metadata);
        
        // Get the activity with relations for broadcasting
        const fullActivity = await UserActivity.findOne({
            where: { id: activity.id },
            relations: ["user", "modpack"]
        });

        if (!fullActivity) {
            return activity;
        }

        // Get user's friends to broadcast to
        const user = await User.findOne({ where: { id: userId } });
        if (user) {
            const friends = await user.getFriends();
            const friendIds = friends.map(friend => friend.id);

            // Broadcast activity to friends
            if (friendIds.length > 0) {
                broadcast('activity_update', {
                    activity: this.formatActivityForFeed(fullActivity)
                }, friendIds);
            }
        }

        // If it's a status change, also broadcast user status
        if (this.isStatusActivity(activityType)) {
            await this.broadcastUserStatus(userId);
        }

        return activity;
    }

    /**
     * Get activity feed for a user (their activities + friends' activities)
     */
    static async getActivityFeed(userId: string, limit = 50): Promise<ActivityFeedItem[]> {
        const activities = await UserActivity.getActivityFeedForUser(userId, limit);
        return activities.map(activity => this.formatActivityForFeed(activity));
    }

    /**
     * Get user's friends with their current status
     */
    static async getFriendsStatus(userId: string): Promise<UserStatus[]> {
        const friendsWithStatus = await FriendshipService.getUserFriendsWithStatus(userId);
        
        return friendsWithStatus.map(({ user, status }) => ({
            userId: user.id,
            username: user.username,
            avatarUrl: user.avatarUrl,
            isOnline: status.isOnline,
            currentModpack: status.currentModpack,
            lastActivity: status.lastActivity
        }));
    }

    /**
     * Update user online status
     */
    static async updateUserOnlineStatus(userId: string, isOnline: boolean): Promise<void> {
        const activityType = isOnline ? ActivityType.USER_ONLINE : ActivityType.USER_OFFLINE;
        await this.createActivity(userId, activityType);
    }

    /**
     * Update user playing status
     */
    static async updateUserPlayingStatus(
        userId: string,
        modpackId: string | null,
        isPlaying: boolean
    ): Promise<void> {
        if (isPlaying && modpackId) {
            await this.createActivity(
                userId,
                ActivityType.PLAYING_MODPACK,
                modpackId,
                { action: 'started_playing' }
            );
        } else {
            // Find the last playing activity to get modpack info
            const lastPlayingActivity = await UserActivity.findOne({
                where: {
                    userId,
                    activityType: ActivityType.PLAYING_MODPACK
                },
                order: { createdAt: "DESC" }
            });

            await this.createActivity(
                userId,
                ActivityType.STOPPED_PLAYING,
                lastPlayingActivity?.modpackId,
                { action: 'stopped_playing' }
            );
        }
    }

    /**
     * Log modpack installation/uninstallation
     */
    static async logModpackInstallation(
        userId: string,
        modpackId: string,
        installed: boolean
    ): Promise<void> {
        const activityType = installed 
            ? ActivityType.MODPACK_INSTALLED 
            : ActivityType.MODPACK_UNINSTALLED;
        
        await this.createActivity(userId, activityType, modpackId);
    }

    /**
     * Log achievement unlock
     */
    static async logAchievementUnlock(
        userId: string,
        achievementId: string,
        achievementName: string,
        modpackId?: string
    ): Promise<void> {
        await this.createActivity(
            userId,
            ActivityType.ACHIEVEMENT_UNLOCKED,
            modpackId,
            {
                achievementId,
                achievementName
            }
        );
    }

    /**
     * Get current status of a user
     */
    static async getUserStatus(userId: string): Promise<UserStatus | null> {
        const user = await User.findOne({ where: { id: userId } });
        if (!user) {
            return null;
        }

        const status = await UserActivity.getUserCurrentStatus(userId);
        
        return {
            userId: user.id,
            username: user.username,
            avatarUrl: user.avatarUrl,
            isOnline: status.isOnline,
            currentModpack: status.currentModpack,
            lastActivity: status.lastActivity
        };
    }

    /**
     * Broadcast user status to their friends
     */
    static async broadcastUserStatus(userId: string): Promise<void> {
        const userStatus = await this.getUserStatus(userId);
        if (!userStatus) {
            return;
        }

        const user = await User.findOne({ where: { id: userId } });
        if (user) {
            const friends = await user.getFriends();
            const friendIds = friends.map(friend => friend.id);

            if (friendIds.length > 0) {
                broadcast('user_status_update', {
                    userStatus
                }, friendIds);
            }
        }
    }

    /**
     * Get recent activities for a specific user
     */
    static async getUserActivities(userId: string, limit = 20): Promise<ActivityFeedItem[]> {
        const activities = await UserActivity.find({
            where: { userId, isVisible: true },
            relations: ["user", "modpack"],
            order: { createdAt: "DESC" },
            take: limit
        });

        return activities.map(activity => this.formatActivityForFeed(activity));
    }

    /**
     * Format activity for feed display
     */
    private static formatActivityForFeed(activity: UserActivity): ActivityFeedItem {
        return {
            id: activity.id,
            user: {
                id: activity.user.id,
                username: activity.user.username,
                avatarUrl: activity.user.avatarUrl
            },
            activityType: activity.activityType,
            modpack: activity.modpack ? {
                id: activity.modpack.id,
                name: activity.modpack.name,
                iconUrl: activity.modpack.iconUrl
            } : undefined,
            metadata: activity.metadata,
            createdAt: activity.createdAt
        };
    }

    /**
     * Check if activity type affects user status
     */
    private static isStatusActivity(activityType: ActivityType): boolean {
        return [
            ActivityType.USER_ONLINE,
            ActivityType.USER_OFFLINE,
            ActivityType.PLAYING_MODPACK,
            ActivityType.STOPPED_PLAYING
        ].includes(activityType);
    }

    /**
     * Cleanup old activities (maintenance function)
     */
    static async cleanupOldActivities(): Promise<number> {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const result = await UserActivity.delete({
            createdAt: { $lt: thirtyDaysAgo } as any
        });

        return result.affected || 0;
    }

    /**
     * Hide/unhide an activity
     */
    static async toggleActivityVisibility(
        activityId: string,
        userId: string,
        isVisible: boolean
    ): Promise<void> {
        const activity = await UserActivity.findOne({
            where: { id: activityId, userId }
        });

        if (!activity) {
            throw new Error("Activity not found or not owned by user");
        }

        activity.isVisible = isVisible;
        await activity.save();

        // Broadcast update to friends
        const user = await User.findOne({ where: { id: userId } });
        if (user) {
            const friends = await user.getFriends();
            const friendIds = friends.map(friend => friend.id);

            if (friendIds.length > 0) {
                broadcast('activity_visibility_changed', {
                    activityId,
                    isVisible
                }, friendIds);
            }
        }
    }
}