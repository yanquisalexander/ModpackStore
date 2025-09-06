import { Hono } from 'hono';
import { TicketsController } from '../../controllers/Tickets.controller';
import { ensureStaff } from '../../middlewares/adminAuth.middleware';

const ticketsRoute = new Hono();

// All admin ticket routes require staff privileges
ticketsRoute.use('*', ensureStaff);

/**
 * @openapi
 * /admin/tickets:
 *   get:
 *     summary: Get all tickets (staff only)
 *     tags: [Admin, Tickets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         required: false
 *         schema:
 *           type: string
 *           enum: [open, in_review, closed]
 *         description: Filter tickets by status
 *     responses:
 *       200:
 *         description: List of all tickets
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
 *                           user:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: string
 *                               username:
 *                                 type: string
 *                               email:
 *                                 type: string
 *       403:
 *         description: Access denied - staff only
 */
ticketsRoute.get('/', TicketsController.getAllTickets);

/**
 * @openapi
 * /admin/tickets/{id}:
 *   get:
 *     summary: Get ticket details (staff only)
 *     tags: [Admin, Tickets]
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
 *         description: Ticket details with full message history
 *       403:
 *         description: Access denied - staff only
 *       404:
 *         description: Ticket not found
 */
ticketsRoute.get('/:id', TicketsController.getTicket);

/**
 * @openapi
 * /admin/tickets/{id}/messages:
 *   post:
 *     summary: Send message to ticket as staff
 *     tags: [Admin, Tickets]
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
 *         description: Staff message sent successfully
 *       400:
 *         description: Bad Request - missing content
 *       403:
 *         description: Access denied - staff only
 *       404:
 *         description: Ticket not found
 */
ticketsRoute.post('/:id/messages', TicketsController.sendMessage);

/**
 * @openapi
 * /admin/tickets/{id}/status:
 *   patch:
 *     summary: Update ticket status
 *     tags: [Admin, Tickets]
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
ticketsRoute.patch('/:id/status', TicketsController.updateTicketStatus);

/**
 * @openapi
 * /admin/tickets/{id}/mark-read:
 *   patch:
 *     summary: Mark messages as read by staff
 *     tags: [Admin, Tickets]
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
ticketsRoute.patch('/:id/mark-read', TicketsController.markMessagesAsRead);

export default ticketsRoute;