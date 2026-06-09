import { Context } from 'hono';
import { FriendshipService } from '@/services/friendship.service';
import { APIError } from '@/lib/APIError';
import { AuthVariables } from "@/middlewares/auth.middleware";

type FriendRequestPayload = {
    targetUserId?: string;
    targetUsername?: string;
    targetDiscordId?: string;
};

type FriendActionPayload = {
    friendshipId: string;
};

export class FriendshipController {
    /**
     * Send a friend request
     */
    static async sendFriendRequest(c: Context<{ Variables: AuthVariables }>): Promise<Response> {
        const userId = c.get('userId');
        const body = await c.req.json() as FriendRequestPayload;

        let targetUserId: string;

        // Find target user by ID, username, or Discord ID
        if (body.targetUserId) {
            targetUserId = body.targetUserId;
        } else if (body.targetUsername || body.targetDiscordId) {
            const searchQuery = body.targetUsername || body.targetDiscordId || '';
            const users = await FriendshipService.searchUsers(searchQuery, userId);

            if (users.length === 0) {
                throw new APIError(404, 'User not found', 'USER_NOT_FOUND');
            }

            // Find exact match
            let targetUser = users.find(user =>
                user.username === body.targetUsername ||
                user.discordId === body.targetDiscordId
            );

            if (!targetUser) {
                targetUser = users[0]; // Use first result if no exact match
            }

            targetUserId = targetUser.id;
        } else {
            throw new APIError(400, 'Target user identifier is required', 'MISSING_TARGET');
        }

        const friendship = await FriendshipService.sendFriendRequest(userId, targetUserId);

        return c.json({
            success: true,
            data: {
                friendshipId: friendship.id,
                status: friendship.status,
                message: 'Friend request sent successfully'
            }
        });
    }

    /**
     * Accept a friend request
     */
    static async acceptFriendRequest(c: Context<{ Variables: AuthVariables }>): Promise<Response> {
        const userId = c.get('userId');
        const body = await c.req.json() as FriendActionPayload;

        if (!body.friendshipId) {
            throw new APIError(400, 'Friendship ID is required', 'MISSING_FRIENDSHIP_ID');
        }

        const friendship = await FriendshipService.acceptFriendRequest(body.friendshipId, userId);

        return c.json({
            success: true,
            data: {
                friendshipId: friendship.id,
                status: friendship.status,
                message: 'Friend request accepted'
            }
        });
    }

    /**
     * Decline a friend request
     */
    static async declineFriendRequest(c: Context<{ Variables: AuthVariables }>): Promise<Response> {
        const userId = c.get('userId');
        const body = await c.req.json() as FriendActionPayload;

        if (!body.friendshipId) {
            throw new APIError(400, 'Friendship ID is required', 'MISSING_FRIENDSHIP_ID');
        }

        await FriendshipService.declineFriendRequest(body.friendshipId, userId);

        return c.json({
            success: true,
            data: {
                message: 'Friend request declined'
            }
        });
    }

    /**
     * Block a user
     */
    static async blockUser(c: Context<{ Variables: AuthVariables }>): Promise<Response> {
        const userId = c.get('userId');
        const body = await c.req.json() as { targetUserId: string };

        if (!body.targetUserId) {
            throw new APIError(400, 'Target user ID is required', 'MISSING_TARGET_USER_ID');
        }

        const friendship = await FriendshipService.blockUser(userId, body.targetUserId);

        return c.json({
            success: true,
            data: {
                friendshipId: friendship.id,
                message: 'User blocked successfully'
            }
        });
    }

    /**
     * Unblock a user
     */
    static async unblockUser(c: Context<{ Variables: AuthVariables }>): Promise<Response> {
        const userId = c.get('userId');
        const body = await c.req.json() as { targetUserId: string };

        if (!body.targetUserId) {
            throw new APIError(400, 'Target user ID is required', 'MISSING_TARGET_USER_ID');
        }

        await FriendshipService.unblockUser(userId, body.targetUserId);

        return c.json({
            success: true,
            data: {
                message: 'User unblocked successfully'
            }
        });
    }

    /**
     * Remove a friend
     */
    static async removeFriend(c: Context<{ Variables: AuthVariables }>): Promise<Response> {
        const userId = c.get('userId');
        const body = await c.req.json() as { friendId: string };

        if (!body.friendId) {
            throw new APIError(400, 'Friend ID is required', 'MISSING_FRIEND_ID');
        }

        await FriendshipService.removeFriend(userId, body.friendId);

        return c.json({
            success: true,
            data: {
                message: 'Friend removed successfully'
            }
        });
    }

    /**
     * Get user's friends with their status
     */
    static async getFriends(c: Context<{ Variables: AuthVariables }>): Promise<Response> {
        const userId = c.get('userId');

        const friendsWithStatus = await FriendshipService.getUserFriendsWithStatus(userId);

        return c.json({
            success: true,
            data: {
                friends: friendsWithStatus
            }
        });
    }

    /**
     * Get pending friend requests
     */
    static async getPendingRequests(c: Context<{ Variables: AuthVariables }>): Promise<Response> {
        const userId = c.get('userId');
        const user = await require('@/entities/User').User.findOne({ where: { id: userId } });

        if (!user) {
            throw new APIError(404, 'User not found', 'USER_NOT_FOUND');
        }

        const pendingRequests = await user.getPendingFriendRequests();
        const sentRequests = await user.getSentFriendRequests();

        return c.json({
            success: true,
            data: {
                received: pendingRequests
                    .filter((req: any) => req.requester) // Filter out requests with null requester
                    .map((req: any) => ({
                        id: req.id,
                        requester: req.requester!.toPublicJson(),
                        createdAt: req.createdAt
                    })),
                sent: sentRequests
                    .filter((req: any) => req.addressee) // Filter out requests with null addressee
                    .map((req: any) => ({
                        id: req.id,
                        addressee: req.addressee!.toPublicJson(),
                        createdAt: req.createdAt
                    }))
            }
        });
    }

    /**
     * Search for users to add as friends
     */
    static async searchUsers(c: Context<{ Variables: AuthVariables }>): Promise<Response> {
        const userId = c.get('userId');
        const query = c.req.query('q');

        if (!query || query.trim().length < 2) {
            throw new APIError(400, 'Search query must be at least 2 characters', 'INVALID_QUERY');
        }

        const users = await FriendshipService.searchUsers(query, userId);

        // Get friendship status for each user
        const usersWithStatus = await Promise.all(
            users.map(async (user) => {
                const status = await FriendshipService.getFriendshipStatus(userId, user.id);
                return {
                    ...user.toPublicJson(),
                    friendshipStatus: status
                };
            })
        );

        return c.json({
            success: true,
            data: {
                users: usersWithStatus
            }
        });
    }

    /**
     * Get friendship status with a specific user
     */
    static async getFriendshipStatus(c: Context<{ Variables: AuthVariables }>): Promise<Response> {
        const userId = c.get('userId');
        const targetUserId = c.req.param('userId');

        if (!targetUserId) {
            throw new APIError(400, 'Target user ID is required', 'MISSING_TARGET_USER_ID');
        }

        const status = await FriendshipService.getFriendshipStatus(userId, targetUserId);

        return c.json({
            success: true,
            data: status
        });
    }
}