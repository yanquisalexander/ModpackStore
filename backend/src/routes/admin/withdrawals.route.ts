import { Hono } from 'hono';
import { AdminWithdrawalsController } from '@/controllers/AdminWithdrawals.controller';
import { requireAuth } from '@/middlewares/auth.middleware';

const app = new Hono();

/**
 * @openapi
 * /admin/withdrawals:
 *   get:
 *     summary: Get all withdrawal requests (Admin only)
 *     tags: [Admin, Withdrawals]
 *     description: Gets all withdrawal requests with filtering and pagination. Admin access required.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, approved, rejected, completed]
 *         description: Filter by withdrawal status
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
 *         description: Withdrawal requests retrieved successfully
 *       403:
 *         description: Admin access required
 */
app.get('/', requireAuth, AdminWithdrawalsController.getWithdrawalRequests);

/**
 * @openapi
 * /admin/withdrawals/{withdrawalId}/approve:
 *   post:
 *     summary: Approve withdrawal request (Admin only)
 *     tags: [Admin, Withdrawals]
 *     description: Approves a pending withdrawal request. Admin access required.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: withdrawalId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Withdrawal request ID
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notes:
 *                 type: string
 *                 description: Optional notes for the approval
 *     responses:
 *       200:
 *         description: Withdrawal approved successfully
 *       400:
 *         description: Invalid request
 *       403:
 *         description: Admin access required
 *       404:
 *         description: Withdrawal request not found
 */
app.post('/:withdrawalId/approve', requireAuth, AdminWithdrawalsController.approveWithdrawal);

/**
 * @openapi
 * /admin/withdrawals/{withdrawalId}/reject:
 *   post:
 *     summary: Reject withdrawal request (Admin only)
 *     tags: [Admin, Withdrawals]
 *     description: Rejects a pending withdrawal request. Admin access required.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: withdrawalId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Withdrawal request ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notes:
 *                 type: string
 *                 description: Reason for rejection (required)
 *             required:
 *               - notes
 *     responses:
 *       200:
 *         description: Withdrawal rejected successfully
 *       400:
 *         description: Invalid request or missing rejection reason
 *       403:
 *         description: Admin access required
 *       404:
 *         description: Withdrawal request not found
 */
app.post('/:withdrawalId/reject', requireAuth, AdminWithdrawalsController.rejectWithdrawal);

/**
 * @openapi
 * /admin/withdrawals/{withdrawalId}/complete:
 *   post:
 *     summary: Mark withdrawal as completed (Admin only)
 *     tags: [Admin, Withdrawals]
 *     description: Marks an approved withdrawal as completed after external payment processing. Admin access required.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: withdrawalId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Withdrawal request ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               externalTransactionId:
 *                 type: string
 *                 description: External payment transaction ID (required)
 *               notes:
 *                 type: string
 *                 description: Optional completion notes
 *             required:
 *               - externalTransactionId
 *     responses:
 *       200:
 *         description: Withdrawal marked as completed successfully
 *       400:
 *         description: Invalid request or missing transaction ID
 *       403:
 *         description: Admin access required
 *       404:
 *         description: Withdrawal request not found
 */
app.post('/:withdrawalId/complete', requireAuth, AdminWithdrawalsController.completeWithdrawal);

export default app;