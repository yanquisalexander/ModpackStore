import { type Context } from 'hono';
import { WithdrawalService, WithdrawalStatus } from '@/services/withdrawal.service';
import { serializeError } from "../utils/jsonapi";
import { AuthVariables } from "@/middlewares/auth.middleware";
import { User } from "@/entities/User";

export class AdminWithdrawalsController {
    /**
     * Get all withdrawal requests (admin only)
     */
    static async getWithdrawalRequests(c: Context<{ Variables: AuthVariables }>): Promise<Response> {
        const user = c.get('user');
        const status = c.req.query('status') as WithdrawalStatus;
        const page = parseInt(c.req.query('page') || '1');
        const limit = parseInt(c.req.query('limit') || '20');

        if (!user || !user.isAdmin()) {
            return c.json(serializeError({
                status: '403',
                title: 'Forbidden',
                detail: 'Admin access required.',
            }), 403);
        }

        try {
            const result = await WithdrawalService.getWithdrawalRequests(status, page, limit);

            return c.json({
                data: result.requests,
                meta: {
                    page: result.page,
                    totalPages: result.totalPages,
                    total: result.total
                }
            }, 200);

        } catch (error: any) {
            console.error('[CONTROLLER_ADMIN_WITHDRAWALS] Error getting withdrawal requests:', error);
            const statusCode = error.statusCode || 500;
            return c.json(serializeError({
                status: statusCode.toString(),
                title: error.name || 'Withdrawals Error',
                detail: error.message || "Failed to fetch withdrawal requests."
            }), statusCode);
        }
    }

    /**
     * Approve withdrawal request (admin only)
     */
    static async approveWithdrawal(c: Context<{ Variables: AuthVariables }>): Promise<Response> {
        const user = c.get('user');
        const withdrawalId = c.req.param('withdrawalId');
        const { notes } = await c.req.json();

        if (!user || !user.isAdmin()) {
            return c.json(serializeError({
                status: '403',
                title: 'Forbidden',
                detail: 'Admin access required.',
            }), 403);
        }

        try {
            const withdrawal = await WithdrawalService.approveWithdrawal(
                withdrawalId,
                user.id,
                notes
            );

            return c.json({
                success: true,
                message: 'Withdrawal approved successfully.',
                withdrawal: {
                    id: withdrawal.id,
                    status: 'approved',
                    processedAt: new Date().toISOString(),
                    processedBy: user.username
                }
            }, 200);

        } catch (error: any) {
            console.error('[CONTROLLER_ADMIN_WITHDRAWALS] Error approving withdrawal:', error);
            const statusCode = error.statusCode || 500;
            return c.json(serializeError({
                status: statusCode.toString(),
                title: error.name || 'Approval Error',
                detail: error.message || "Failed to approve withdrawal."
            }), statusCode);
        }
    }

    /**
     * Reject withdrawal request (admin only)
     */
    static async rejectWithdrawal(c: Context<{ Variables: AuthVariables }>): Promise<Response> {
        const user = c.get('user');
        const withdrawalId = c.req.param('withdrawalId');
        const { notes } = await c.req.json();

        if (!user || !user.isAdmin()) {
            return c.json(serializeError({
                status: '403',
                title: 'Forbidden',
                detail: 'Admin access required.',
            }), 403);
        }

        if (!notes) {
            return c.json(serializeError({
                status: '400',
                title: 'Bad Request',
                detail: 'Rejection reason is required.',
            }), 400);
        }

        try {
            const withdrawal = await WithdrawalService.rejectWithdrawal(
                withdrawalId,
                user.id,
                notes
            );

            return c.json({
                success: true,
                message: 'Withdrawal rejected successfully.',
                withdrawal: {
                    id: withdrawal.id,
                    status: 'rejected',
                    processedAt: new Date().toISOString(),
                    processedBy: user.username
                }
            }, 200);

        } catch (error: any) {
            console.error('[CONTROLLER_ADMIN_WITHDRAWALS] Error rejecting withdrawal:', error);
            const statusCode = error.statusCode || 500;
            return c.json(serializeError({
                status: statusCode.toString(),
                title: error.name || 'Rejection Error',
                detail: error.message || "Failed to reject withdrawal."
            }), statusCode);
        }
    }

    /**
     * Mark withdrawal as completed (admin only)
     */
    static async completeWithdrawal(c: Context<{ Variables: AuthVariables }>): Promise<Response> {
        const user = c.get('user');
        const withdrawalId = c.req.param('withdrawalId');
        const { externalTransactionId, notes } = await c.req.json();

        if (!user || !user.isAdmin()) {
            return c.json(serializeError({
                status: '403',
                title: 'Forbidden',
                detail: 'Admin access required.',
            }), 403);
        }

        if (!externalTransactionId) {
            return c.json(serializeError({
                status: '400',
                title: 'Bad Request',
                detail: 'External transaction ID is required.',
            }), 400);
        }

        try {
            const withdrawal = await WithdrawalService.completeWithdrawal(
                withdrawalId,
                user.id,
                externalTransactionId,
                notes
            );

            return c.json({
                success: true,
                message: 'Withdrawal marked as completed successfully.',
                withdrawal: {
                    id: withdrawal.id,
                    status: 'completed',
                    completedAt: new Date().toISOString(),
                    completedBy: user.username,
                    transactionId: externalTransactionId
                }
            }, 200);

        } catch (error: any) {
            console.error('[CONTROLLER_ADMIN_WITHDRAWALS] Error completing withdrawal:', error);
            const statusCode = error.statusCode || 500;
            return c.json(serializeError({
                status: statusCode.toString(),
                title: error.name || 'Completion Error',
                detail: error.message || "Failed to complete withdrawal."
            }), statusCode);
        }
    }
}