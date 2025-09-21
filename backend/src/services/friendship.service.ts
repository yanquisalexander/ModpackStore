import { Friendship } from "@/entities/Friendship";
import { User } from "@/entities/User";
import { UserActivity } from "@/entities/UserActivity";
import { FriendshipStatus, ActivityType } from "@/types/enums";
import { broadcast, sendToUser } from "./realtime.service";

export class FriendshipService {
    /**
     * Send a friend request from one user to another
     */
    static async sendFriendRequest(requesterId: string, addresseeId: string): Promise<Friendship> {
        // Check if users exist
        const requester = await User.findOne({ where: { id: requesterId } });
        const addressee = await User.findOne({ where: { id: addresseeId } });
        
        if (!requester || !addressee) {
            throw new Error("User not found");
        }

        if (requesterId === addresseeId) {
            throw new Error("Cannot send friend request to yourself");
        }

        // Check if friendship already exists
        const existingFriendship = await Friendship.findFriendship(requesterId, addresseeId);
        if (existingFriendship) {
            if (existingFriendship.status === FriendshipStatus.BLOCKED) {
                throw new Error("Cannot send friend request - user is blocked");
            }
            if (existingFriendship.status === FriendshipStatus.PENDING) {
                throw new Error("Friend request already pending");
            }
            if (existingFriendship.status === FriendshipStatus.ACCEPTED) {
                throw new Error("Users are already friends");
            }
        }

        // Create new friendship request
        const friendship = Friendship.create({
            requesterId,
            addresseeId,
            status: FriendshipStatus.PENDING
        });

        await friendship.save();

        // Send real-time notification to addressee
        sendToUser(addresseeId, 'friend_request_received', {
            friendshipId: friendship.id,
            requester: requester.toPublicJson()
        });

        return friendship;
    }

    /**
     * Accept a friend request
     */
    static async acceptFriendRequest(friendshipId: string, userId: string): Promise<Friendship> {
        const friendship = await Friendship.findOne({ 
            where: { id: friendshipId },
            relations: ["requester", "addressee"]
        });

        if (!friendship) {
            throw new Error("Friendship request not found");
        }

        if (friendship.addresseeId !== userId) {
            throw new Error("Only the addressee can accept this request");
        }

        if (friendship.status !== FriendshipStatus.PENDING) {
            throw new Error("Friend request is not pending");
        }

        friendship.status = FriendshipStatus.ACCEPTED;
        await friendship.save();

        // Create activity for both users
        await UserActivity.createActivity(
            friendship.requesterId,
            ActivityType.FRIENDSHIP_CREATED,
            undefined,
            { friendId: friendship.addresseeId, friendUsername: friendship.addressee.username }
        );

        await UserActivity.createActivity(
            friendship.addresseeId,
            ActivityType.FRIENDSHIP_CREATED,
            undefined,
            { friendId: friendship.requesterId, friendUsername: friendship.requester.username }
        );

        // Send real-time notifications
        sendToUser(friendship.requesterId, 'friend_request_accepted', {
            friendshipId: friendship.id,
            friend: friendship.addressee.toPublicJson()
        });

        sendToUser(friendship.addresseeId, 'friendship_established', {
            friendshipId: friendship.id,
            friend: friendship.requester.toPublicJson()
        });

        return friendship;
    }

    /**
     * Decline a friend request
     */
    static async declineFriendRequest(friendshipId: string, userId: string): Promise<void> {
        const friendship = await Friendship.findOne({ 
            where: { id: friendshipId },
            relations: ["requester"]
        });

        if (!friendship) {
            throw new Error("Friendship request not found");
        }

        if (friendship.addresseeId !== userId) {
            throw new Error("Only the addressee can decline this request");
        }

        if (friendship.status !== FriendshipStatus.PENDING) {
            throw new Error("Friend request is not pending");
        }

        await friendship.remove();

        // Optionally notify the requester (less intrusive)
        sendToUser(friendship.requesterId, 'friend_request_declined', {
            friendshipId: friendship.id
        });
    }

    /**
     * Block a user
     */
    static async blockUser(blockerId: string, blockedId: string): Promise<Friendship> {
        if (blockerId === blockedId) {
            throw new Error("Cannot block yourself");
        }

        // Check if friendship exists
        let friendship = await Friendship.findFriendship(blockerId, blockedId);
        
        if (friendship) {
            friendship.status = FriendshipStatus.BLOCKED;
            // Ensure the blocker is the requester in the relationship
            if (friendship.addresseeId === blockerId) {
                const tempId = friendship.requesterId;
                friendship.requesterId = blockerId;
                friendship.addresseeId = tempId;
            }
        } else {
            friendship = Friendship.create({
                requesterId: blockerId,
                addresseeId: blockedId,
                status: FriendshipStatus.BLOCKED
            });
        }

        await friendship.save();

        // Notify blocked user (they should be removed from friends list)
        sendToUser(blockedId, 'user_blocked', {
            blockerId: blockerId
        });

        return friendship;
    }

    /**
     * Unblock a user
     */
    static async unblockUser(blockerId: string, blockedId: string): Promise<void> {
        const friendship = await Friendship.findOne({
            where: {
                requesterId: blockerId,
                addresseeId: blockedId,
                status: FriendshipStatus.BLOCKED
            }
        });

        if (!friendship) {
            throw new Error("User is not blocked");
        }

        await friendship.remove();
    }

    /**
     * Remove a friend
     */
    static async removeFriend(userId: string, friendId: string): Promise<void> {
        const friendship = await Friendship.findFriendship(userId, friendId);

        if (!friendship || friendship.status !== FriendshipStatus.ACCEPTED) {
            throw new Error("Friendship not found");
        }

        await friendship.remove();

        // Notify both users
        sendToUser(friendId, 'friendship_removed', {
            removedByUserId: userId
        });

        sendToUser(userId, 'friendship_removed', {
            removedFriendId: friendId
        });
    }

    /**
     * Get user's friends with their online status
     */
    static async getUserFriendsWithStatus(userId: string): Promise<Array<{
        user: any;
        status: {
            isOnline: boolean;
            currentModpack?: { id: string; name: string };
            lastActivity?: Date;
        };
    }>> {
        const user = await User.findOne({ where: { id: userId } });
        if (!user) {
            throw new Error("User not found");
        }

        const friends = await user.getFriends();
        const friendsWithStatus = await Promise.all(
            friends.map(async (friend) => {
                const status = await UserActivity.getUserCurrentStatus(friend.id);
                return {
                    user: friend.toPublicJson(),
                    status
                };
            })
        );

        return friendsWithStatus;
    }

    /**
     * Search for users to add as friends
     */
    static async searchUsers(query: string, currentUserId: string): Promise<User[]> {
        return await User.searchForFriends(query, currentUserId);
    }

    /**
     * Get friendship status between two users
     */
    static async getFriendshipStatus(userId1: string, userId2: string): Promise<{
        areFriends: boolean;
        isBlocked: boolean;
        pendingRequest?: {
            id: string;
            requesterId: string;
            addresseeId: string;
        };
    }> {
        const friendship = await Friendship.findFriendship(userId1, userId2);
        
        if (!friendship) {
            return { areFriends: false, isBlocked: false };
        }

        return {
            areFriends: friendship.status === FriendshipStatus.ACCEPTED,
            isBlocked: friendship.status === FriendshipStatus.BLOCKED,
            pendingRequest: friendship.status === FriendshipStatus.PENDING ? {
                id: friendship.id,
                requesterId: friendship.requesterId,
                addresseeId: friendship.addresseeId
            } : undefined
        };
    }
}