import { Hono } from 'hono';
import { PublisherWithdrawalsController } from '@/controllers/PublisherWithdrawals.controller';
import { requireAuth } from '@/middlewares/auth.middleware';

const app = new Hono();

/**
 * @openapi
 * /creators/publishers/{publisherId}/earnings:
 *   get:
 *     summary: Get publisher earnings summary
 *     tags: [Publishers, Withdrawals]
 *     description: Gets earnings summary for a publisher including available balance and withdrawal history.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: publisherId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Publisher ID
 *     responses:
 *       200:
 *         description: Earnings summary retrieved successfully
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Publisher not found
 */
app.get('/publishers/:publisherId/earnings', requireAuth, PublisherWithdrawalsController.getEarningsSummary);

/**
 * @openapi
 * /creators/publishers/{publisherId}/withdrawals:
 *   get:
 *     summary: Get publisher withdrawal history
 *     tags: [Publishers, Withdrawals]
 *     description: Gets the withdrawal history for a publisher.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: publisherId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Publisher ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Items per page
 *     responses:
 *       200:
 *         description: Withdrawal history retrieved successfully
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Publisher not found
 *   post:
 *     summary: Request withdrawal
 *     tags: [Publishers, Withdrawals]
 *     description: Request a withdrawal for the publisher's earnings.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: publisherId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Publisher ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               amount:
 *                 type: string
 *                 description: Amount to withdraw (must be >= minimum withdrawal amount)
 *               paypalEmail:
 *                 type: string
 *                 format: email
 *                 description: PayPal email address for payment
 *             required:
 *               - amount
 *               - paypalEmail
 *     responses:
 *       201:
 *         description: Withdrawal request created successfully
 *       400:
 *         description: Invalid request (insufficient balance, below minimum, etc.)
 *       403:
 *         description: Insufficient permissions
 */
app.get('/publishers/:publisherId/withdrawals', requireAuth, PublisherWithdrawalsController.getPublisherWithdrawals);
app.post('/publishers/:publisherId/withdrawals', requireAuth, PublisherWithdrawalsController.requestWithdrawal);

/**
 * @openapi
 * /creators/publishers/{publisherId}/sales:
 *   get:
 *     summary: Get publisher sales history
 *     tags: [Publishers, Sales]
 *     description: Gets the detailed sales history for a publisher including modpack sales, earnings, and commission breakdown.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: publisherId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Publisher ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Items per page
 *     responses:
 *       200:
 *         description: Sales history retrieved successfully
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Publisher not found
 */
app.get('/publishers/:publisherId/sales', requireAuth, PublisherWithdrawalsController.getSalesHistory);

export { app as WithdrawalsRoute };