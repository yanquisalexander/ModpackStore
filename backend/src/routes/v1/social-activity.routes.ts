import { Hono } from 'hono';
import { ActivityFeedController } from '../../controllers/ActivityFeed.controller';
import { requireAuth } from "@/middlewares/auth.middleware";

const activityFeedRoutes = new Hono();

/**
 * @openapi
 * /social/feed:
 *   get:
 *     summary: Get user's activity feed
 *     tags: [Social]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           maximum: 100
 *           default: 50
 *         description: Number of activities to retrieve
 */
activityFeedRoutes.get('/feed', requireAuth, ActivityFeedController.getActivityFeed);

/**
 * @openapi
 * /social/feed/friends-status:
 *   get:
 *     summary: Get friends' current status (online, playing, etc.)
 *     tags: [Social]
 *     security:
 *       - bearerAuth: []
 */
activityFeedRoutes.get('/feed/friends-status', requireAuth, ActivityFeedController.getFriendsStatus);

/**
 * @openapi
 * /social/status/online:
 *   post:
 *     summary: Update user's online status
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
 *               isOnline:
 *                 type: boolean
 *                 required: true
 */
activityFeedRoutes.post('/status/online', requireAuth, ActivityFeedController.updateOnlineStatus);

/**
 * @openapi
 * /social/status/playing:
 *   post:
 *     summary: Update user's playing status
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
 *               isPlaying:
 *                 type: boolean
 *                 required: true
 *               modpackId:
 *                 type: string
 *                 description: Required when isPlaying is true
 */
activityFeedRoutes.post('/status/playing', requireAuth, ActivityFeedController.updatePlayingStatus);

/**
 * @openapi
 * /social/activities/modpack/{modpackId}:
 *   post:
 *     summary: Log modpack installation/uninstallation
 *     tags: [Social]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: modpackId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: action
 *         required: true
 *         schema:
 *           type: string
 *           enum: [install, uninstall]
 */
activityFeedRoutes.post('/activities/modpack/:modpackId', requireAuth, ActivityFeedController.logModpackAction);

/**
 * @openapi
 * /social/activities/achievement:
 *   post:
 *     summary: Log achievement unlock
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
 *               achievementId:
 *                 type: string
 *                 required: true
 *               achievementName:
 *                 type: string
 *                 required: true
 *               modpackId:
 *                 type: string
 *                 description: Optional modpack association
 */
activityFeedRoutes.post('/activities/achievement', requireAuth, ActivityFeedController.logAchievement);

/**
 * @openapi
 * /social/status/{userId}:
 *   get:
 *     summary: Get current status of a specific user
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
activityFeedRoutes.get('/status/:userId', requireAuth, ActivityFeedController.getUserStatus);

/**
 * @openapi
 * /social/activities/my:
 *   get:
 *     summary: Get user's own activities
 *     tags: [Social]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           maximum: 50
 *           default: 20
 */
activityFeedRoutes.get('/activities/my', requireAuth, ActivityFeedController.getUserActivities);

/**
 * @openapi
 * /social/activities/visibility:
 *   post:
 *     summary: Toggle activity visibility
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
 *               activityId:
 *                 type: string
 *                 required: true
 *               isVisible:
 *                 type: boolean
 *                 required: true
 */
activityFeedRoutes.post('/activities/visibility', requireAuth, ActivityFeedController.toggleActivityVisibility);

/**
 * @openapi
 * /social/activities/custom:
 *   post:
 *     summary: Create a custom activity
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
 *               activityType:
 *                 type: string
 *                 required: true
 *               modpackId:
 *                 type: string
 *               metadata:
 *                 type: object
 */
activityFeedRoutes.post('/activities/custom', requireAuth, ActivityFeedController.createCustomActivity);

/**
 * @openapi
 * /social/feed/stats:
 *   get:
 *     summary: Get activity feed statistics
 *     tags: [Social]
 *     security:
 *       - bearerAuth: []
 */
activityFeedRoutes.get('/feed/stats', requireAuth, ActivityFeedController.getActivityStats);

export { activityFeedRoutes };