import { Wallet } from '@/entities/Wallet';
import { WalletTransaction } from '@/entities/WalletTransaction';
import { Publisher } from '@/entities/Publisher';
import { User } from '@/entities/User';
import { TransactionType } from '@/types/enums';
import { APIError } from '@/lib/APIError';

export enum WithdrawalStatus {
    PENDING = 'pending',
    APPROVED = 'approved',
    REJECTED = 'rejected',
    COMPLETED = 'completed'
}

export interface WithdrawalRequest {
    id: string;
    publisherId: string;
    amount: string;
    paypalEmail: string;
    status: WithdrawalStatus;
    requestedAt: Date;
    processedAt?: Date;
    processedByUserId?: string;
    notes?: string;
    transactionId?: string;
}

export class WithdrawalService {
    private static readonly MINIMUM_WITHDRAWAL = parseFloat(process.env.MINIMUM_WITHDRAWAL || '20.00');
    
    // In a real implementation, you'd store withdrawal requests in a database table
    // For now, we'll use WalletTransaction with a special type for withdrawal requests
    
    /**
     * Request withdrawal for publisher
     */
    static async requestWithdrawal(publisherId: string, amount: string, paypalEmail: string): Promise<WalletTransaction> {
        const withdrawalAmount = parseFloat(amount);
        
        // Validate minimum withdrawal amount
        if (withdrawalAmount < this.MINIMUM_WITHDRAWAL) {
            throw new APIError(400, `Minimum withdrawal amount is $${this.MINIMUM_WITHDRAWAL.toFixed(2)}`);
        }

        // Get publisher wallet
        const wallet = await Wallet.findOne({ 
            where: { publisherId },
            relations: ['publisher']
        });

        if (!wallet) {
            throw new APIError(404, 'Publisher wallet not found');
        }

        const currentBalance = parseFloat(wallet.balance);
        if (currentBalance < withdrawalAmount) {
            throw new APIError(400, `Insufficient balance. Available: $${currentBalance.toFixed(2)}`);
        }

        // Check for pending withdrawal requests
        const pendingWithdrawal = await WalletTransaction.findOne({
            where: {
                walletId: wallet.id,
                type: TransactionType.WITHDRAWAL,
                description: { $like: '%PENDING%' } as any
            }
        });

        if (pendingWithdrawal) {
            throw new APIError(400, 'You already have a pending withdrawal request');
        }

        // Create withdrawal request transaction
        const withdrawalRequest = new WalletTransaction();
        withdrawalRequest.walletId = wallet.id;
        withdrawalRequest.type = TransactionType.WITHDRAWAL;
        withdrawalRequest.amount = (-withdrawalAmount).toString(); // Negative for withdrawal
        withdrawalRequest.description = `PENDING: Withdrawal request to ${paypalEmail}`;
        withdrawalRequest.metadata = JSON.stringify({
            status: WithdrawalStatus.PENDING,
            paypalEmail,
            requestedAt: new Date().toISOString()
        });

        return await withdrawalRequest.save();
    }

    /**
     * Get withdrawal requests for admin review
     */
    static async getWithdrawalRequests(status?: WithdrawalStatus, page: number = 1, limit: number = 20): Promise<{
        requests: any[];
        total: number;
        page: number;
        totalPages: number;
    }> {
        const offset = (page - 1) * limit;
        
        const query: any = {
            type: TransactionType.WITHDRAWAL
        };

        if (status) {
            query.description = { $like: `%${status.toUpperCase()}%` } as any;
        }

        const [transactions, total] = await Promise.all([
            WalletTransaction.find({
                where: query,
                relations: ['wallet', 'wallet.publisher'],
                order: { createdAt: 'DESC' },
                skip: offset,
                take: limit
            }),
            WalletTransaction.count({ where: query })
        ]);

        const requests = transactions.map(transaction => {
            const metadata = transaction.metadata ? JSON.parse(transaction.metadata) : {};
            return {
                id: transaction.id,
                publisherId: transaction.wallet?.publisherId,
                publisher: transaction.wallet?.publisher,
                amount: Math.abs(parseFloat(transaction.amount)).toString(),
                paypalEmail: metadata.paypalEmail,
                status: this.extractStatusFromDescription(transaction.description),
                requestedAt: transaction.createdAt,
                processedAt: metadata.processedAt ? new Date(metadata.processedAt) : undefined,
                processedByUserId: metadata.processedByUserId,
                notes: metadata.notes,
                transactionId: transaction.externalTransactionId
            };
        });

        return {
            requests,
            total,
            page,
            totalPages: Math.ceil(total / limit)
        };
    }

    /**
     * Get withdrawal requests for a specific publisher
     */
    static async getPublisherWithdrawals(publisherId: string, page: number = 1, limit: number = 20): Promise<{
        requests: any[];
        total: number;
        page: number;
        totalPages: number;
    }> {
        const wallet = await Wallet.findOne({ where: { publisherId } });
        if (!wallet) {
            return {
                requests: [],
                total: 0,
                page,
                totalPages: 0
            };
        }

        const offset = (page - 1) * limit;

        const [transactions, total] = await Promise.all([
            WalletTransaction.find({
                where: {
                    walletId: wallet.id,
                    type: TransactionType.WITHDRAWAL
                },
                order: { createdAt: 'DESC' },
                skip: offset,
                take: limit
            }),
            WalletTransaction.count({
                where: {
                    walletId: wallet.id,
                    type: TransactionType.WITHDRAWAL
                }
            })
        ]);

        const requests = transactions.map(transaction => {
            const metadata = transaction.metadata ? JSON.parse(transaction.metadata) : {};
            return {
                id: transaction.id,
                amount: Math.abs(parseFloat(transaction.amount)).toString(),
                paypalEmail: metadata.paypalEmail,
                status: this.extractStatusFromDescription(transaction.description),
                requestedAt: transaction.createdAt,
                processedAt: metadata.processedAt ? new Date(metadata.processedAt) : undefined,
                notes: metadata.notes,
                transactionId: transaction.externalTransactionId
            };
        });

        return {
            requests,
            total,
            page,
            totalPages: Math.ceil(total / limit)
        };
    }

    /**
     * Approve withdrawal request (admin action)
     */
    static async approveWithdrawal(withdrawalId: string, adminUserId: string, notes?: string): Promise<WalletTransaction> {
        const withdrawalRequest = await WalletTransaction.findOne({
            where: { id: withdrawalId },
            relations: ['wallet']
        });

        if (!withdrawalRequest) {
            throw new APIError(404, 'Withdrawal request not found');
        }

        if (!withdrawalRequest.description.includes('PENDING')) {
            throw new APIError(400, 'Withdrawal request is not pending');
        }

        // Update the withdrawal request status
        const metadata = withdrawalRequest.metadata ? JSON.parse(withdrawalRequest.metadata) : {};
        metadata.status = WithdrawalStatus.APPROVED;
        metadata.processedAt = new Date().toISOString();
        metadata.processedByUserId = adminUserId;
        if (notes) metadata.notes = notes;

        withdrawalRequest.description = withdrawalRequest.description.replace('PENDING', 'APPROVED');
        withdrawalRequest.metadata = JSON.stringify(metadata);

        // Deduct amount from wallet (the transaction amount is already negative)
        const wallet = withdrawalRequest.wallet;
        const withdrawalAmount = Math.abs(parseFloat(withdrawalRequest.amount));
        wallet.balance = (parseFloat(wallet.balance) - withdrawalAmount).toString();
        
        await Promise.all([
            withdrawalRequest.save(),
            wallet.save()
        ]);

        return withdrawalRequest;
    }

    /**
     * Reject withdrawal request (admin action)
     */
    static async rejectWithdrawal(withdrawalId: string, adminUserId: string, notes: string): Promise<WalletTransaction> {
        const withdrawalRequest = await WalletTransaction.findOne({
            where: { id: withdrawalId }
        });

        if (!withdrawalRequest) {
            throw new APIError(404, 'Withdrawal request not found');
        }

        if (!withdrawalRequest.description.includes('PENDING')) {
            throw new APIError(400, 'Withdrawal request is not pending');
        }

        // Update the withdrawal request status
        const metadata = withdrawalRequest.metadata ? JSON.parse(withdrawalRequest.metadata) : {};
        metadata.status = WithdrawalStatus.REJECTED;
        metadata.processedAt = new Date().toISOString();
        metadata.processedByUserId = adminUserId;
        metadata.notes = notes;

        withdrawalRequest.description = withdrawalRequest.description.replace('PENDING', 'REJECTED');
        withdrawalRequest.metadata = JSON.stringify(metadata);

        return await withdrawalRequest.save();
    }

    /**
     * Mark withdrawal as completed (admin action after external payment)
     */
    static async completeWithdrawal(withdrawalId: string, adminUserId: string, externalTransactionId: string, notes?: string): Promise<WalletTransaction> {
        const withdrawalRequest = await WalletTransaction.findOne({
            where: { id: withdrawalId }
        });

        if (!withdrawalRequest) {
            throw new APIError(404, 'Withdrawal request not found');
        }

        if (!withdrawalRequest.description.includes('APPROVED')) {
            throw new APIError(400, 'Withdrawal request is not approved');
        }

        // Update the withdrawal request status
        const metadata = withdrawalRequest.metadata ? JSON.parse(withdrawalRequest.metadata) : {};
        metadata.status = WithdrawalStatus.COMPLETED;
        metadata.completedAt = new Date().toISOString();
        metadata.completedByUserId = adminUserId;
        if (notes) metadata.notes = (metadata.notes || '') + '\n' + notes;

        withdrawalRequest.description = withdrawalRequest.description.replace('APPROVED', 'COMPLETED');
        withdrawalRequest.metadata = JSON.stringify(metadata);
        withdrawalRequest.externalTransactionId = externalTransactionId;

        return await withdrawalRequest.save();
    }

    /**
     * Get available balance for withdrawal
     */
    static async getAvailableBalance(publisherId: string): Promise<number> {
        const wallet = await Wallet.findOne({ where: { publisherId } });
        return wallet ? parseFloat(wallet.balance) : 0;
    }

    /**
     * Get minimum withdrawal amount
     */
    static getMinimumWithdrawal(): number {
        return this.MINIMUM_WITHDRAWAL;
    }

    /**
     * Extract status from transaction description
     */
    private static extractStatusFromDescription(description: string): WithdrawalStatus {
        if (description.includes('PENDING')) return WithdrawalStatus.PENDING;
        if (description.includes('APPROVED')) return WithdrawalStatus.APPROVED;
        if (description.includes('REJECTED')) return WithdrawalStatus.REJECTED;
        if (description.includes('COMPLETED')) return WithdrawalStatus.COMPLETED;
        return WithdrawalStatus.PENDING;
    }

    /**
     * Get publisher earnings summary
     */
    static async getPublisherEarnings(publisherId: string): Promise<{
        totalEarnings: number;
        availableBalance: number;
        pendingWithdrawals: number;
        totalWithdrawn: number;
    }> {
        const wallet = await Wallet.findOne({ where: { publisherId } });
        
        if (!wallet) {
            return {
                totalEarnings: 0,
                availableBalance: 0,
                pendingWithdrawals: 0,
                totalWithdrawn: 0
            };
        }

        // Get all deposit transactions (earnings)
        const deposits = await WalletTransaction.find({
            where: {
                walletId: wallet.id,
                type: TransactionType.DEPOSIT
            }
        });

        // Get all withdrawal transactions
        const withdrawals = await WalletTransaction.find({
            where: {
                walletId: wallet.id,
                type: TransactionType.WITHDRAWAL
            }
        });

        const totalEarnings = deposits.reduce((sum, tx) => sum + parseFloat(tx.amount), 0);
        const availableBalance = parseFloat(wallet.balance);
        const pendingWithdrawals = withdrawals
            .filter(tx => tx.description.includes('PENDING'))
            .reduce((sum, tx) => sum + Math.abs(parseFloat(tx.amount)), 0);
        const totalWithdrawn = withdrawals
            .filter(tx => tx.description.includes('COMPLETED'))
            .reduce((sum, tx) => sum + Math.abs(parseFloat(tx.amount)), 0);

        return {
            totalEarnings,
            availableBalance,
            pendingWithdrawals,
            totalWithdrawn
        };
    }
}