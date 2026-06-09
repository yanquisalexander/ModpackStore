import { Hono } from 'hono';
import { friendshipRoutes } from './social-friendship.routes';
import { gameInvitationRoutes } from './social-invitations.routes';
import { activityFeedRoutes } from './social-activity.routes';
import { socialProfileRoutes } from './social-profile.routes';

const socialRoutes = new Hono();

/**
 * @openapi
 * tags:
 *   - name: Social
 *     description: Social features including friends, game invitations, activity feed, and enhanced profiles
 */

// Mount all social route modules
socialRoutes.route('/', friendshipRoutes);
socialRoutes.route('/', gameInvitationRoutes);
socialRoutes.route('/', activityFeedRoutes);
socialRoutes.route('/', socialProfileRoutes);

/**
 * @openapi
 * /social/health:
 *   get:
 *     summary: Social system health check
 *     tags: [Social]
 *     responses:
 *       200:
 *         description: Social system is operational
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
 *                     status:
 *                       type: string
 *                     features:
 *                       type: array
 *                       items:
 *                         type: string
 */
socialRoutes.get('/health', (c) => {
    return c.json({
        success: true,
        data: {
            status: 'operational',
            features: [
                'friendship_management',
                'game_invitations',
                'activity_feed',
                'social_profiles',
                'patreon_integration',
                'real_time_notifications'
            ],
            version: '1.0.0'
        }
    });
});

export { socialRoutes };