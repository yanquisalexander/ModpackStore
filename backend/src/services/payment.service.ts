import { Modpack } from '@/entities/Modpack';
import { User } from '@/entities/User';
import { WalletTransaction } from '@/entities/WalletTransaction';
import { Wallet } from '@/entities/Wallet';
import { AcquisitionService } from './acquisition.service';
import { TransactionType } from '@/types/enums';
import { APIError } from '@/lib/APIError';

interface PayPalPaymentRequest {
    amount: string;
    currency: string;
    description: string;
    modpackId: string;
    userId: string;
}

interface PayPalPaymentResponse {
    paymentId: string;
    approvalUrl: string;
    qrCodeUrl?: string;
}

interface PayPalWebhookPayload {
    id: string;
    event_type: string;
    resource: {
        id: string;
        state: string;
        amount: {
            total: string;
            currency: string;
        };
        custom?: string; // JSON string with modpackId and userId
    };
}

export class PaymentService {
    private static readonly COMMISSION_RATE = parseFloat(process.env.COMMISSION_RATE || '0.30');
    private static readonly PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
    private static readonly PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
    private static readonly PAYPAL_BASE_URL = process.env.PAYPAL_BASE_URL || 'https://api.sandbox.paypal.com';

    /**
     * Create PayPal payment for modpack purchase using webhook-only flow
     */
    static async createPayment(paymentRequest: PayPalPaymentRequest): Promise<PayPalPaymentResponse> {
        if (!this.PAYPAL_CLIENT_ID || !this.PAYPAL_CLIENT_SECRET) {
            throw new APIError(500, 'PayPal configuration not found');
        }

        try {
            // Get PayPal access token
            const accessToken = await this.getAccessToken();

            // Create payment payload for webhook-only flow (no redirects)
            const payment = {
                intent: 'sale',
                payer: {
                    payment_method: 'paypal'
                },
                transactions: [{
                    amount: {
                        total: paymentRequest.amount,
                        currency: paymentRequest.currency
                    },
                    description: paymentRequest.description,
                    custom: JSON.stringify({
                        modpackId: paymentRequest.modpackId,
                        userId: paymentRequest.userId
                    })
                }]
            };

            // Create payment with PayPal
            const response = await fetch(`${this.PAYPAL_BASE_URL}/v1/payments/payment`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`
                },
                body: JSON.stringify(payment)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new APIError(400, `PayPal payment creation failed: ${error.message}`);
            }

            const paymentData = await response.json();
            
            // For webhook-only flow, we don't need approval URL, but provide payment ID for tracking
            return {
                paymentId: paymentData.id,
                approvalUrl: '', // No longer used in webhook-only flow
                qrCodeUrl: undefined // QR codes not needed without approval URLs
            };
        } catch (error) {
            console.error('PayPal payment creation error:', error);
            throw new APIError(500, 'Failed to create payment');
        }
    }

    /**
     * Handle PayPal webhook for payment completion
     */
    static async handleWebhook(payload: PayPalWebhookPayload): Promise<void> {
        try {
            // Only handle payment completion events
            if (payload.event_type !== 'PAYMENT.SALE.COMPLETED') {
                return;
            }

            const payment = payload.resource;
            if (!payment.custom) {
                throw new Error('Payment custom data not found');
            }

            const customData = JSON.parse(payment.custom);
            const { modpackId, userId } = customData;

            // Find modpack and user
            const [modpack, user] = await Promise.all([
                Modpack.findOne({ where: { id: modpackId } }),
                User.findOne({ where: { id: userId } })
            ]);

            if (!modpack || !user) {
                throw new Error('Modpack or user not found');
            }

            // Create acquisition
            const acquisition = await AcquisitionService.acquireWithPurchase(user, modpack, payment.id);

            // Process payment and commissions
            await this.processPayment(modpack, user, payment.amount.total, payment.id);

            console.log(`Payment processed successfully for modpack ${modpackId} by user ${userId}`);
        } catch (error) {
            console.error('Webhook processing error:', error);
            throw error;
        }
    }

    /**
     * Process payment and handle commissions
     */
    private static async processPayment(modpack: Modpack, user: User, amount: string, transactionId: string): Promise<void> {
        const totalAmount = parseFloat(amount);
        const commissionAmount = totalAmount * this.COMMISSION_RATE;
        const publisherAmount = totalAmount - commissionAmount;

        // Ensure publisher has a wallet
        const publisher = await modpack.publisher;
        let publisherWallet = await Wallet.findOne({ where: { publisherId: publisher.id } });
        
        if (!publisherWallet) {
            publisherWallet = new Wallet();
            publisherWallet.publisherId = publisher.id;
            publisherWallet.balance = '0';
            await publisherWallet.save();
        }

        // Create purchase transaction record
        const purchaseTransaction = new WalletTransaction();
        purchaseTransaction.type = TransactionType.PURCHASE;
        purchaseTransaction.amount = totalAmount.toString();
        purchaseTransaction.description = `Purchase of ${modpack.name}`;
        purchaseTransaction.relatedUserId = user.id;
        purchaseTransaction.relatedModpackId = modpack.id;
        purchaseTransaction.externalTransactionId = transactionId;
        await purchaseTransaction.save();

        // Create commission transaction
        const commissionTransaction = new WalletTransaction();
        commissionTransaction.type = TransactionType.COMMISSION;
        commissionTransaction.amount = (-commissionAmount).toString(); // Negative for platform fee
        commissionTransaction.description = `Commission for ${modpack.name} (${(this.COMMISSION_RATE * 100).toFixed(1)}%)`;
        commissionTransaction.relatedModpackId = modpack.id;
        commissionTransaction.externalTransactionId = transactionId;
        await commissionTransaction.save();

        // Add earnings to publisher wallet
        publisherWallet.balance = (parseFloat(publisherWallet.balance) + publisherAmount).toString();
        await publisherWallet.save();

        // Create earnings transaction for publisher
        const earningsTransaction = new WalletTransaction();
        earningsTransaction.type = TransactionType.DEPOSIT;
        earningsTransaction.amount = publisherAmount.toString();
        earningsTransaction.description = `Earnings from ${modpack.name}`;
        earningsTransaction.walletId = publisherWallet.id;
        earningsTransaction.relatedModpackId = modpack.id;
        earningsTransaction.externalTransactionId = transactionId;
        await earningsTransaction.save();
    }

    /**
     * Get PayPal access token
     */
    private static async getAccessToken(): Promise<string> {
        const auth = Buffer.from(`${this.PAYPAL_CLIENT_ID}:${this.PAYPAL_CLIENT_SECRET}`).toString('base64');

        const response = await fetch(`${this.PAYPAL_BASE_URL}/v1/oauth2/token`, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: 'grant_type=client_credentials'
        });

        if (!response.ok) {
            throw new APIError(500, 'Failed to get PayPal access token');
        }

        const data = await response.json();
        return data.access_token;
    }

    /**
     * Generate QR code URL for mobile payments
     */
    private static generateQRCodeUrl(approvalUrl: string): string {
        // Using QR Server API for simplicity - in production, consider using a dedicated service
        return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(approvalUrl)}`;
    }

    /**
     * Get commission rate for display
     */
    static getCommissionRate(): number {
        return this.COMMISSION_RATE;
    }

    /**
     * Calculate net earnings for a given amount
     */
    static calculateNetEarnings(amount: string): number {
        const total = parseFloat(amount);
        return total * (1 - this.COMMISSION_RATE);
    }

    /**
     * Calculate commission for a given amount
     */
    static calculateCommission(amount: string): number {
        const total = parseFloat(amount);
        return total * this.COMMISSION_RATE;
    }
}