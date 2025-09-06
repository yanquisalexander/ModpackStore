import { Hono } from 'hono';
import { TicketsController } from '../../controllers/Tickets.controller';
import { requireAuth } from "@/middlewares/auth.middleware";

const ticketRoutes = new Hono();

/**
 * @openapi
 * /tickets:
 *   post:
 *     summary: Create a new support ticket
 *     tags: [Tickets]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - subject
 *               - content
 *             properties:
 *               subject:
 *                 type: string
 *                 description: The ticket subject/title
 *               content:
 *                 type: string
 *                 description: The initial message content
 *     responses:
 *       201:
 *         description: Ticket created successfully
 *         content:
 *           application/vnd.api+json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     type:
 *                       type: string
 *                       example: ticket
 *                     attributes:
 *                       type: object
 *                       properties:
 *                         subject:
 *                           type: string
 *                         status:
 *                           type: string
 *                           enum: [open, in_review, closed]
 *                         ticketNumber:
 *                           type: string
 *                           example: "#001"
 *                         createdAt:
 *                           type: string
 *                           format: date-time
 *                         messages:
 *                           type: array
 *                           items:
 *                             type: object
 *       400:
 *         description: Bad Request - missing required fields
 *       401:
 *         description: Authentication required
 */
ticketRoutes.post('/', requireAuth, TicketsController.createTicket);

/**
 * @openapi
 * /tickets:
 *   get:
 *     summary: Get user's tickets
 *     tags: [Tickets]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of user's tickets
 *         content:
 *           application/vnd.api+json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       type:
 *                         type: string
 *                         example: ticket
 *                       attributes:
 *                         type: object
 *                         properties:
 *                           subject:
 *                             type: string
 *                           status:
 *                             type: string
 *                           ticketNumber:
 *                             type: string
 *                           messageCount:
 *                             type: number
 *       401:
 *         description: Authentication required
 */
ticketRoutes.get('/', requireAuth, TicketsController.getUserTickets);

/**
 * @openapi
 * /tickets/{id}:
 *   get:
 *     summary: Get ticket by ID with messages
 *     tags: [Tickets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Ticket ID
 *     responses:
 *       200:
 *         description: Ticket details with messages
 *       403:
 *         description: Access denied
 *       404:
 *         description: Ticket not found
 */
ticketRoutes.get('/:id', requireAuth, TicketsController.getTicket);

/**
 * @openapi
 * /tickets/{id}/messages:
 *   post:
 *     summary: Send message to ticket
 *     tags: [Tickets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Ticket ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 description: Message content
 *     responses:
 *       201:
 *         description: Message sent successfully
 *       400:
 *         description: Bad Request - missing content
 *       403:
 *         description: Access denied
 *       404:
 *         description: Ticket not found
 */
ticketRoutes.post('/:id/messages', requireAuth, TicketsController.sendMessage);

/**
 * @openapi
 * /tickets/{id}/status:
 *   patch:
 *     summary: Update ticket status (staff only)
 *     tags: [Tickets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Ticket ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [open, in_review, closed]
 *     responses:
 *       200:
 *         description: Status updated successfully
 *       400:
 *         description: Invalid status
 *       403:
 *         description: Access denied - staff only
 *       404:
 *         description: Ticket not found
 */
ticketRoutes.patch('/:id/status', requireAuth, TicketsController.updateTicketStatus);

/**
 * @openapi
 * /tickets/{id}/mark-read:
 *   patch:
 *     summary: Mark messages as read by staff (staff only)
 *     tags: [Tickets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Ticket ID
 *     responses:
 *       200:
 *         description: Messages marked as read
 *       403:
 *         description: Access denied - staff only
 */
ticketRoutes.patch('/:id/mark-read', requireAuth, TicketsController.markMessagesAsRead);

export default ticketRoutes;