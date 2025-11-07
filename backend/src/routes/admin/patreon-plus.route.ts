import { Hono } from 'hono';
import { PatreonPlusController } from '@/controllers/AdminPatreonPlus.controller';
import { requireAuth } from '@/middlewares/auth.middleware';

const patreonPlusRoutes = new Hono();

// All routes require admin authentication
patreonPlusRoutes.use('*', requireAuth);

/**
 * @openapi
 * /admin/patreon-plus/tiers:
 *   get:
 *     summary: Get all Patreon tiers with member counts
 *     tags: [Admin - Patreon Plus]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of tiers retrieved successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
patreonPlusRoutes.get('/tiers', PatreonPlusController.getTiers);

/**
 * @openapi
 * /admin/patreon-plus/tiers/{tierId}/members:
 *   get:
 *     summary: Get members for a specific tier
 *     tags: [Admin - Patreon Plus]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tierId
 *         required: true
 *         schema:
 *           type: string
 *         description: The tier ID
 *     responses:
 *       200:
 *         description: Tier members retrieved successfully
 *       404:
 *         description: Tier not found
 *       500:
 *         description: Internal server error
 */
patreonPlusRoutes.get('/tiers/:tierId/members', PatreonPlusController.getTierMembers);

/**
 * @openapi
 * /admin/patreon-plus/tiers/{tierId}/metadata:
 *   patch:
 *     summary: Update tier metadata (benefits configuration)
 *     tags: [Admin - Patreon Plus]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tierId
 *         required: true
 *         schema:
 *           type: string
 *         description: The tier ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               metadata:
 *                 type: object
 *                 description: Benefits metadata for the tier (values must be boolean, number, or string)
 *     responses:
 *       200:
 *         description: Tier metadata updated successfully
 *       400:
 *         description: Invalid metadata format
 *       404:
 *         description: Tier not found
 *       500:
 *         description: Internal server error
 */
patreonPlusRoutes.patch('/tiers/:tierId/metadata', PatreonPlusController.updateTierMetadata);

/**
 * @openapi
 * /admin/patreon-plus/members:
 *   get:
 *     summary: Get all active Patreon members
 *     tags: [Admin - Patreon Plus]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Members retrieved successfully
 *       500:
 *         description: Internal server error
 */
patreonPlusRoutes.get('/members', PatreonPlusController.getAllMembers);

/**
 * @openapi
 * /admin/patreon-plus/sync:
 *   post:
 *     summary: Trigger manual Patreon synchronization
 *     tags: [Admin - Patreon Plus]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Sync completed successfully
 *       500:
 *         description: Sync failed
 */
patreonPlusRoutes.post('/sync', PatreonPlusController.triggerSync);

/**
 * @openapi
 * /admin/patreon-plus/last-sync:
 *   get:
 *     summary: Get last synchronization timestamp
 *     tags: [Admin - Patreon Plus]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Last sync timestamp retrieved
 *       500:
 *         description: Internal server error
 */
patreonPlusRoutes.get('/last-sync', PatreonPlusController.getLastSync);

/**
 * @openapi
 * /admin/patreon-plus/benefits-config:
 *   get:
 *     summary: Get benefits configuration schema
 *     tags: [Admin - Patreon Plus]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Benefits configuration retrieved
 *       500:
 *         description: Internal server error
 */
patreonPlusRoutes.get('/benefits-config', PatreonPlusController.getBenefitsConfig);

/**
 * @openapi
 * /admin/patreon-plus/statistics:
 *   get:
 *     summary: Get Patreon Plus statistics
 *     tags: [Admin - Patreon Plus]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
 *       500:
 *         description: Internal server error
 */
patreonPlusRoutes.get('/statistics', PatreonPlusController.getStatistics);

export default patreonPlusRoutes;
