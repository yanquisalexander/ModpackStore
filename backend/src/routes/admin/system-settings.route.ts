import { Hono } from 'hono';
import { SystemSettingsController } from '../../controllers/SystemSettings.controller';
import { requireAdminAuth } from '../../middlewares/adminAuth.middleware';

const systemSettingsRouter = new Hono();

// Apply admin authentication middleware
systemSettingsRouter.use('*', requireAdminAuth);

/**
 * @openapi
 * /admin/settings/tos:
 *   get:
 *     summary: Get Terms and Conditions settings
 *     tags: [Admin]
 *     description: Retrieves the current Terms and Conditions content and status.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: ToS settings retrieved successfully.
 *         content:
 *           application/vnd.api+json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     content:
 *                       type: string
 *                       description: Terms and Conditions content in markdown
 *                     enabled:
 *                       type: boolean
 *                       description: Whether ToS acceptance is required
 *       403:
 *         description: Forbidden - insufficient permissions.
 *       500:
 *         description: Internal Server Error.
 */
systemSettingsRouter.get('/tos', SystemSettingsController.getToSSettings);

/**
 * @openapi
 * /admin/settings/tos:
 *   put:
 *     summary: Update Terms and Conditions settings
 *     tags: [Admin]
 *     description: Updates the Terms and Conditions content and/or enabled status.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               content:
 *                 type: string
 *                 description: Terms and Conditions content in markdown
 *               enabled:
 *                 type: boolean
 *                 description: Whether ToS acceptance is required
 *     responses:
 *       200:
 *         description: ToS settings updated successfully.
 *       400:
 *         description: Bad Request - validation error.
 *       403:
 *         description: Forbidden - insufficient permissions.
 *       500:
 *         description: Internal Server Error.
 */
systemSettingsRouter.put('/tos', SystemSettingsController.updateToSSettings);

/**
 * @openapi
 * /admin/settings/tos/revoke-all:
 *   post:
 *     summary: Revoke all user Terms and Conditions acceptances
 *     tags: [Admin]
 *     description: Sets tosAcceptedAt to null for all users, forcing them to re-accept ToS.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All ToS acceptances revoked successfully.
 *         content:
 *           application/vnd.api+json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     usersUpdated:
 *                       type: number
 *                       description: Number of users whose ToS acceptance was revoked
 *       403:
 *         description: Forbidden - insufficient permissions.
 *       500:
 *         description: Internal Server Error.
 */
systemSettingsRouter.post('/tos/revoke-all', SystemSettingsController.revokeAllToSAcceptances);

export default systemSettingsRouter;