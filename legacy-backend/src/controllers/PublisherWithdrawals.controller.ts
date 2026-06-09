import { type Context } from 'hono';
import { WithdrawalService } from '@/services/withdrawal.service';
import { PaymentService } from '@/services/payment.service';
import { serializeError } from "../utils/jsonapi";
import { AuthVariables } from "@/middlewares/auth.middleware";
import { User } from "@/entities/User";
import { PublisherMember } from "@/entities/PublisherMember";

export class PublisherWithdrawalsController {
    /**
     * Request withdrawal for publisher
     */
    static async requestWithdrawal(c: Context<{ Variables: AuthVariables }>): Promise<Response> {
        const publisherId = c.req.param('publisherId');
        const user = c.get('user');
        const { amount, paypalEmail } = await c.req.json();

        if (!user) {
            return c.json(serializeError({
                status: '401',
                title: 'Unauthorized',
                detail: 'Authentication required.',
            }), 401);
        }

        if (!amount || !paypalEmail) {
            return c.json(serializeError({
                status: '400',
                title: 'Bad Request',
                detail: 'Amount and PayPal email are required.',
            }), 400);
        }

        try {
            // Check if user has permission to manage this publisher
            const membership = await PublisherMember.findOne({
                where: {
                    userId: user.id,
                    publisherId: publisherId
                }
            });

            if (!membership || !['owner', 'admin'].includes(membership.role)) {
                return c.json(serializeError({
                    status: '403',
                    title: 'Forbidden',
                    detail: 'Insufficient permissions to request withdrawals for this publisher.',
                }), 403);
            }

            const withdrawalRequest = await WithdrawalService.requestWithdrawal(
                publisherId,
                amount,
                paypalEmail
            );

            return c.json({
                success: true,
                message: 'Withdrawal request submitted successfully.',
                withdrawal: {
                    id: withdrawalRequest.id,
                    amount: Math.abs(parseFloat(withdrawalRequest.amount)),
                    status: 'pending',
                    requestedAt: withdrawalRequest.createdAt
                }
            }, 201);

        } catch (error: any) {
            console.error('[CONTROLLER_WITHDRAWALS] Error requesting withdrawal:', error);
            const statusCode = error.statusCode || 500;
            return c.json(serializeError({
                status: statusCode.toString(),
                title: error.name || 'Withdrawal Error',
                detail: error.message || "Failed to request withdrawal."
            }), statusCode);
        }
    }

    /**
     * Get publisher withdrawal history
     */
    static async getPublisherWithdrawals(c: Context<{ Variables: AuthVariables }>): Promise<Response> {
        const publisherId = c.req.param('publisherId');
        const user = c.get('user');
        const page = parseInt(c.req.query('page') || '1');
        const limit = parseInt(c.req.query('limit') || '20');

        if (!user) {
            return c.json(serializeError({
                status: '401',
                title: 'Unauthorized',
                detail: 'Authentication required.',
            }), 401);
        }

        try {
            // Check if user has permission to view this publisher's data
            const membership = await PublisherMember.findOne({
                where: {
                    userId: user.id,
                    publisherId: publisherId
                }
            });

            if (!membership) {
                return c.json(serializeError({
                    status: '403',
                    title: 'Forbidden',
                    detail: 'No access to this publisher.',
                }), 403);
            }

            const result = await WithdrawalService.getPublisherWithdrawals(publisherId, page, limit);

            return c.json({
                data: result.requests,
                meta: {
                    page: result.page,
                    totalPages: result.totalPages,
                    total: result.total
                }
            }, 200);

        } catch (error: any) {
            console.error('[CONTROLLER_WITHDRAWALS] Error getting withdrawals:', error);
            const statusCode = error.statusCode || 500;
            return c.json(serializeError({
                status: statusCode.toString(),
                title: error.name || 'Withdrawals Error',
                detail: error.message || "Failed to fetch withdrawals."
            }), statusCode);
        }
    }

    /**
     * Get publisher earnings summary
     */
    static async getEarningsSummary(c: Context<{ Variables: AuthVariables }>): Promise<Response> {
        const publisherId = c.req.param('publisherId');
        const user = c.get('user');

        if (!user) {
            return c.json(serializeError({
                status: '401',
                title: 'Unauthorized',
                detail: 'Authentication required.',
            }), 401);
        }

        try {
            // Check if user has permission to view this publisher's data
            const membership = await PublisherMember.findOne({
                where: {
                    userId: user.id,
                    publisherId: publisherId
                }
            });

            if (!membership) {
                return c.json(serializeError({
                    status: '403',
                    title: 'Forbidden',
                    detail: 'No access to this publisher.',
                }), 403);
            }

            const earnings = await WithdrawalService.getPublisherEarnings(publisherId);
            const commissionRate = PaymentService.getCommissionRate();
            const minimumWithdrawal = WithdrawalService.getMinimumWithdrawal();

            return c.json({
                earnings: {
                    totalEarnings: earnings.totalEarnings,
                    availableBalance: earnings.availableBalance,
                    pendingWithdrawals: earnings.pendingWithdrawals,
                    totalWithdrawn: earnings.totalWithdrawn
                },
                settings: {
                    commissionRate: commissionRate,
                    minimumWithdrawal: minimumWithdrawal
                },
                canWithdraw: earnings.availableBalance >= minimumWithdrawal
            }, 200);

        } catch (error: any) {
            console.error('[CONTROLLER_WITHDRAWALS] Error getting earnings:', error);
            const statusCode = error.statusCode || 500;
            return c.json(serializeError({
                status: statusCode.toString(),
                title: error.name || 'Earnings Error',
                detail: error.message || "Failed to fetch earnings."
            }), statusCode);
        }
    }

    /**
     * Get publisher sales history
     */
    static async getSalesHistory(c: Context<{ Variables: AuthVariables }>): Promise<Response> {
        const publisherId = c.req.param('publisherId');
        const user = c.get('user');
        const page = parseInt(c.req.query('page') || '1');
        const limit = parseInt(c.req.query('limit') || '20');

        if (!user) {
            return c.json(serializeError({
                status: '401',
                title: 'Unauthorized',
                detail: 'Authentication required.',
            }), 401);
        }

        try {
            // Check if user has permission to view this publisher's data
            const membership = await PublisherMember.findOne({
                where: {
                    userId: user.id,
                    publisherId: publisherId
                }
            });

            if (!membership) {
                return c.json(serializeError({
                    status: '403',
                    title: 'Forbidden',
                    detail: 'No access to this publisher.',
                }), 403);
            }

            const result = await WithdrawalService.getPublisherSalesHistory(publisherId, page, limit);

            return c.json({
                data: result.sales,
                meta: {
                    page: result.page,
                    totalPages: result.totalPages,
                    total: result.total
                }
            }, 200);

        } catch (error: any) {
            console.error('[CONTROLLER_WITHDRAWALS] Error getting sales history:', error);
            const statusCode = error.statusCode || 500;
            return c.json(serializeError({
                status: statusCode.toString(),
                title: error.name || 'Sales History Error',
                detail: error.message || "Failed to fetch sales history."
            }), statusCode);
        }
    }
}