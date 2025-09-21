import { Hono } from 'hono';
import { GameInvitationController } from '../../controllers/GameInvitation.controller';
import { requireAuth } from "@/middlewares/auth.middleware";

const gameInvitationRoutes = new Hono();

/**
 * @openapi
 * /social/invitations/send:
 *   post:
 *     summary: Send a game invitation to a friend
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
 *               receiverId:
 *                 type: string
 *                 required: true
 *                 description: Friend's user ID
 *               modpackId:
 *                 type: string
 *                 required: true
 *                 description: Modpack to invite to
 *               message:
 *                 type: string
 *                 description: Optional invitation message
 */
gameInvitationRoutes.post('/invitations/send', requireAuth, GameInvitationController.sendInvitation);

/**
 * @openapi
 * /social/invitations/respond:
 *   post:
 *     summary: Respond to a game invitation
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
 *               invitationId:
 *                 type: string
 *                 required: true
 *               action:
 *                 type: string
 *                 enum: [accept, decline]
 *                 required: true
 */
gameInvitationRoutes.post('/invitations/respond', requireAuth, GameInvitationController.respondToInvitation);

/**
 * @openapi
 * /social/invitations/pending:
 *   get:
 *     summary: Get pending game invitations
 *     tags: [Social]
 *     security:
 *       - bearerAuth: []
 */
gameInvitationRoutes.get('/invitations/pending', requireAuth, GameInvitationController.getPendingInvitations);

/**
 * @openapi
 * /social/invitations/sent:
 *   get:
 *     summary: Get sent game invitations
 *     tags: [Social]
 *     security:
 *       - bearerAuth: []
 */
gameInvitationRoutes.get('/invitations/sent', requireAuth, GameInvitationController.getSentInvitations);

/**
 * @openapi
 * /social/invitations/{invitationId}/cancel:
 *   delete:
 *     summary: Cancel a sent invitation
 *     tags: [Social]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: invitationId
 *         required: true
 *         schema:
 *           type: string
 */
gameInvitationRoutes.delete('/invitations/:invitationId/cancel', requireAuth, GameInvitationController.cancelInvitation);

/**
 * @openapi
 * /social/invitations/modpack/{modpackId}/status:
 *   get:
 *     summary: Check modpack installation status for invitation handling
 *     tags: [Social]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: modpackId
 *         required: true
 *         schema:
 *           type: string
 */
gameInvitationRoutes.get('/invitations/modpack/:modpackId/status', requireAuth, GameInvitationController.checkModpackStatus);

/**
 * @openapi
 * /social/invitations/stats:
 *   get:
 *     summary: Get invitation statistics
 *     tags: [Social]
 *     security:
 *       - bearerAuth: []
 */
gameInvitationRoutes.get('/invitations/stats', requireAuth, GameInvitationController.getInvitationStats);

/**
 * @openapi
 * /social/invitations/cleanup:
 *   post:
 *     summary: Cleanup expired invitations (maintenance)
 *     tags: [Social]
 *     security:
 *       - bearerAuth: []
 */
gameInvitationRoutes.post('/invitations/cleanup', requireAuth, GameInvitationController.cleanupExpiredInvitations);

export { gameInvitationRoutes };