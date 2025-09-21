import { Hono } from 'hono';
import { FriendshipController } from '../../controllers/Friendship.controller';
import { requireAuth } from "@/middlewares/auth.middleware";

const friendshipRoutes = new Hono();

/**
 * @openapi
 * /social/friends:
 *   get:
 *     summary: Get user's friends with their status
 *     tags: [Social]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved friends list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     friends:
 *                       type: array
 *                       items:
 *                         type: object
 */
friendshipRoutes.get('/friends', requireAuth, FriendshipController.getFriends);

/**
 * @openapi
 * /social/friends/requests:
 *   get:
 *     summary: Get pending friend requests (sent and received)
 *     tags: [Social]
 *     security:
 *       - bearerAuth: []
 */
friendshipRoutes.get('/friends/requests', requireAuth, FriendshipController.getPendingRequests);

/**
 * @openapi
 * /social/friends/send:
 *   post:
 *     summary: Send a friend request
 *     tags: [Social]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               targetUserId:
 *                 type: string
 *                 description: Target user's UUID
 *               targetUsername:
 *                 type: string
 *                 description: Target user's username
 *               targetDiscordId:
 *                 type: string
 *                 description: Target user's Discord ID
 */
friendshipRoutes.post('/friends/send', requireAuth, FriendshipController.sendFriendRequest);

/**
 * @openapi
 * /social/friends/accept:
 *   post:
 *     summary: Accept a friend request
 *     tags: [Social]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               friendshipId:
 *                 type: string
 *                 required: true
 */
friendshipRoutes.post('/friends/accept', requireAuth, FriendshipController.acceptFriendRequest);

/**
 * @openapi
 * /social/friends/decline:
 *   post:
 *     summary: Decline a friend request
 *     tags: [Social]
 *     security:
 *       - bearerAuth: []
 */
friendshipRoutes.post('/friends/decline', requireAuth, FriendshipController.declineFriendRequest);

/**
 * @openapi
 * /social/friends/remove:
 *   post:
 *     summary: Remove a friend
 *     tags: [Social]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               friendId:
 *                 type: string
 *                 required: true
 */
friendshipRoutes.post('/friends/remove', requireAuth, FriendshipController.removeFriend);

/**
 * @openapi
 * /social/friends/block:
 *   post:
 *     summary: Block a user
 *     tags: [Social]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               targetUserId:
 *                 type: string
 *                 required: true
 */
friendshipRoutes.post('/friends/block', requireAuth, FriendshipController.blockUser);

/**
 * @openapi
 * /social/friends/unblock:
 *   post:
 *     summary: Unblock a user
 *     tags: [Social]
 *     security:
 *       - bearerAuth: []
 */
friendshipRoutes.post('/friends/unblock', requireAuth, FriendshipController.unblockUser);

/**
 * @openapi
 * /social/friends/search:
 *   get:
 *     summary: Search for users to add as friends
 *     tags: [Social]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Search query (username or Discord ID)
 */
friendshipRoutes.get('/friends/search', requireAuth, FriendshipController.searchUsers);

/**
 * @openapi
 * /social/friends/status/{userId}:
 *   get:
 *     summary: Get friendship status with a specific user
 *     tags: [Social]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 */
friendshipRoutes.get('/friends/status/:userId', requireAuth, FriendshipController.getFriendshipStatus);

export { friendshipRoutes };