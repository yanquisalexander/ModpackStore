import { Modpack } from '@/entities/Modpack';
import { User } from '@/entities/User';
import { WalletTransaction } from '@/entities/WalletTransaction';
import { Wallet } from '@/entities/Wallet';
import { AcquisitionService } from './acquisition.service';
import { TransactionType } from '@/types/enums';
import { APIError } from '@/lib/APIError';
import { paymentGatewayManager, PaymentRequest, PaymentResponse, WebhookPayload, PaymentGatewayType } from './payment-gateways';
import { wsManager } from './websocket.service';

interface PaymentCreationRequest {
    amount: string;
    currency: string;
    description: string;
    modpackId: string;
    userId: string;
    gatewayType?: string;
    countryCode?: string;
    includeModpackDetails?: boolean; // New flag to include detailed modpack info
}

interface PaymentCreationResponse {
    paymentId: string;
    approvalUrl?: string;
    qrCode?: string;
    qrCodeUrl?: string;
    gatewayType: string;
    status: string;
    metadata?: Record<string, any>;
}

export class PaymentService {
    private static readonly COMMISSION_RATE = parseFloat(process.env.COMMISSION_RATE || '0.30');

    /**
     * Create payment using the best available gateway for the user's region
     */
    static async createPayment(paymentRequest: PaymentCreationRequest): Promise<PaymentCreationResponse> {
        try {
            // Determine which gateway to use
            let gateway;
            if (paymentRequest.gatewayType) {
                // Use specified gateway
                gateway = paymentGatewayManager.getGateway(paymentRequest.gatewayType);
            } else {
                // Use preferred gateway based on country
                gateway = paymentGatewayManager.getPreferredGateway(paymentRequest.countryCode);
            }

            // Get modpack details if requested
            let modpackDetails;
            if (paymentRequest.includeModpackDetails) {
                const modpack = await Modpack.findOne({
                    where: { id: paymentRequest.modpackId },
                    relations: ['publisher', 'versions']
                });
                if (modpack) {
                    // Get the latest version
                    const latestVersion = modpack.versions?.sort((a, b) =>
                        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                    )[0];

                    modpackDetails = {
                        name: modpack.name,
                        version: latestVersion?.version || 'Latest',
                        author: modpack.publisher?.publisherName || 'Unknown Author',
                        description: modpack.description || modpack.shortDescription
                    };
                }
            }

            const request: PaymentRequest = {
                amount: paymentRequest.amount,
                currency: paymentRequest.currency,
                description: paymentRequest.description,
                modpackId: paymentRequest.modpackId,
                userId: paymentRequest.userId,
                modpackDetails,
                metadata: {
                    countryCode: paymentRequest.countryCode
                }
            };

            const response = await paymentGatewayManager.createPayment(gateway.gatewayType, request);

            return {
                paymentId: response.paymentId,
                approvalUrl: response.approvalUrl,
                qrCode: response.qrCode,
                qrCodeUrl: response.qrCodeUrl,
                gatewayType: gateway.gatewayType,
                status: response.status,
                metadata: response.metadata
            };
        } catch (error) {
            console.error('Payment creation error:', error);
            throw error instanceof APIError ? error : new APIError(500, 'Failed to create payment');
        }
    }

    /**
     * Capture an approved payment
     */
    static async capturePayment(gatewayType: string, paymentId: string): Promise<PaymentCreationResponse> {
        try {
            const response = await paymentGatewayManager.capturePayment(gatewayType, paymentId);

            return {
                paymentId: response.paymentId,
                qrCode: response.qrCode,
                qrCodeUrl: response.qrCodeUrl,
                gatewayType,
                status: response.status,
                metadata: response.metadata
            };
        } catch (error) {
            console.error('Payment capture error:', error);
            throw error instanceof APIError ? error : new APIError(500, 'Failed to capture payment');
        }
    }

    /**
     * Handle webhook from any payment gateway
     */
    static async handleWebhook(gatewayType: string, payload: any): Promise<void> {
        const startTime = Date.now();
        const logContext = {
            gatewayType,
            timestamp: new Date().toISOString(),
            webhookId: payload.id || 'unknown'
        };

        console.log('[PAYMENT_WEBHOOK] Processing webhook:', logContext);

        try {
            const webhookPayload = await paymentGatewayManager.processWebhook(gatewayType, payload);

            console.log('[PAYMENT_WEBHOOK] Webhook parsed:', {
                ...logContext,
                eventType: webhookPayload.eventType,
                paymentId: webhookPayload.paymentId,
                status: webhookPayload.status,
                amount: webhookPayload.amount
            });

            // Extract modpack and user info from metadata FIRST
            const { modpackId, userId, skipPaymentProcessing } = webhookPayload.metadata || {};

            // Skip processing for events that shouldn't trigger payment completion
            if (skipPaymentProcessing || webhookPayload.eventType === 'merchant_order.pending') {
                console.log('[PAYMENT_WEBHOOK] Skipping payment processing for event:', webhookPayload.eventType);
                return; // Exit early without processing
            }

            // For PAYMENT.CAPTURE.COMPLETED events without metadata, check if payment was already processed
            if (!modpackId || !userId) {
                if (webhookPayload.eventType === 'PAYMENT.CAPTURE.COMPLETED') {
                    console.log('[PAYMENT_WEBHOOK] PAYMENT.CAPTURE.COMPLETED webhook without metadata - payment may already be processed');
                    return; // Skip processing as payment was likely already handled
                }
                throw new Error('Payment metadata missing modpackId or userId');
            }

            console.log('[PAYMENT_WEBHOOK] Processing payment for:', {
                ...logContext,
                modpackId,
                userId,
                paymentId: webhookPayload.paymentId
            });

            // Only handle completed payments or approved orders that need capture
            if (webhookPayload.status !== 'completed' && webhookPayload.status !== 'approved') {
                console.log(`[PAYMENT_WEBHOOK] Ignoring webhook for payment ${webhookPayload.paymentId} with status: ${webhookPayload.status}`);
                return;
            }

            // Handle approved orders - capture the payment
            if (webhookPayload.status === 'approved' && webhookPayload.eventType === 'CHECKOUT.ORDER.APPROVED') {
                console.log(`[PAYMENT_WEBHOOK] Capturing approved order: ${webhookPayload.paymentId}`);

                // Notify user that payment is being processed
                wsManager.sendToUser(userId, 'payment_processing', {
                    paymentId: webhookPayload.paymentId,
                    modpackId,
                    status: 'processing',
                    message: 'Procesando pago...'
                });

                try {
                    await paymentGatewayManager.capturePayment(gatewayType, webhookPayload.paymentId);
                    console.log(`[PAYMENT_WEBHOOK] Payment captured successfully: ${webhookPayload.paymentId}`);

                    // Update status to completed for further processing
                    webhookPayload.status = 'completed';
                } catch (captureError) {
                    console.error(`[PAYMENT_WEBHOOK] Failed to capture payment ${webhookPayload.paymentId}:`, captureError);

                    // Notify user of capture failure
                    wsManager.sendToUser(userId, 'payment_failed', {
                        paymentId: webhookPayload.paymentId,
                        modpackId,
                        status: 'failed',
                        message: 'Error al procesar el pago'
                    });

                    return;
                }
            }

            // Find modpack and user
            const [modpack, user] = await Promise.all([
                Modpack.findOne({
                    where: { id: modpackId },
                    relations: ['publisher'] // Load publisher relation
                }),
                User.findOne({ where: { id: userId } })
            ]);

            if (!modpack || !user) {
                throw new Error(`Modpack or user not found: modpack=${!!modpack}, user=${!!user}`);
            }

            // Create acquisition
            const acquisition = await AcquisitionService.acquireWithPurchase(user, modpack, webhookPayload.paymentId);

            // Process payment and commissions
            await this.processPayment(
                modpack,
                user,
                webhookPayload.amount?.total || '0',
                webhookPayload.paymentId,
                gatewayType
            );

            const processingTime = Date.now() - startTime;
            console.log('[PAYMENT_WEBHOOK] Payment processed successfully:', {
                ...logContext,
                modpackId,
                userId,
                paymentId: webhookPayload.paymentId,
                acquisitionId: acquisition.id,
                processingTimeMs: processingTime
            });

            // Notify user of successful payment and acquisition
            wsManager.sendToUser(userId, 'payment_completed', {
                paymentId: webhookPayload.paymentId,
                modpackId,
                acquisitionId: acquisition.id,
                modpackName: modpack.name,
                status: 'completed',
                message: `¡Pago completado! Has adquirido ${modpack.name}`,
                amount: webhookPayload.amount,
                processingTimeMs: processingTime
            });
        } catch (error) {
            const processingTime = Date.now() - startTime;
            console.error('[PAYMENT_WEBHOOK] Webhook processing error:', {
                ...logContext,
                error: error instanceof Error ? error.message : 'Unknown error',
                processingTimeMs: processingTime,
                stack: error instanceof Error ? error.stack : undefined
            });
            throw error;
        }
    }

    /**
     * Get available payment gateways
     */
    static getAvailableGateways(): string[] {
        return paymentGatewayManager.getAvailableGateways();
    }

    /**
     * Get gateway status information
     */
    static getGatewayStatus(): Record<string, { available: boolean; configured: boolean }> {
        return paymentGatewayManager.getGatewayStatus();
    }

    /**
     * Process payment and handle commissions
     */
    private static async processPayment(
        modpack: Modpack,
        user: User,
        amount: string,
        transactionId: string,
        gatewayType: string
    ): Promise<void> {
        const totalAmount = parseFloat(amount);
        const commissionAmount = totalAmount * this.COMMISSION_RATE;
        const publisherAmount = totalAmount - commissionAmount;

        // Ensure publisher has a wallet
        const publisher = modpack.publisher;
        if (!publisher) {
            throw new Error(`Modpack ${modpack.id} does not have a publisher assigned`);
        }

        let publisherWallet = await Wallet.findOne({ where: { publisherId: publisher.id } });

        if (!publisherWallet) {
            publisherWallet = new Wallet();
            publisherWallet.publisherId = publisher.id;
            publisherWallet.balance = '0';
            await publisherWallet.save();
        }

        // Create purchase transaction record
        const purchaseTransaction = new WalletTransaction();
        purchaseTransaction.walletId = publisherWallet.id; // ← Asignar walletId
        purchaseTransaction.type = TransactionType.PURCHASE;
        purchaseTransaction.amount = totalAmount.toString();
        purchaseTransaction.description = `Purchase of ${modpack.name} via ${gatewayType}`;
        purchaseTransaction.relatedUserId = user.id;
        purchaseTransaction.relatedModpackId = modpack.id;
        purchaseTransaction.externalTransactionId = transactionId;
        await purchaseTransaction.save();

        // Create commission transaction (platform wallet)
        // For now, we'll skip commission transactions until we have a platform wallet system
        // const commissionTransaction = new WalletTransaction();
        // commissionTransaction.walletId = platformWallet.id; // ← Would need platform wallet
        // commissionTransaction.type = TransactionType.COMMISSION;
        // commissionTransaction.amount = (-commissionAmount).toString();
        // commissionTransaction.description = `Commission for ${modpack.name} (${(this.COMMISSION_RATE * 100).toFixed(1)}%)`;
        // commissionTransaction.relatedUserId = user.id;
        // commissionTransaction.relatedModpackId = modpack.id;
        // commissionTransaction.externalTransactionId = transactionId;
        // await commissionTransaction.save();

        // Add earnings to publisher wallet
        publisherWallet.balance = (parseFloat(publisherWallet.balance) + publisherAmount).toString();
        await publisherWallet.save();

        // Create earnings transaction for publisher
        const earningsTransaction = new WalletTransaction();
        earningsTransaction.type = TransactionType.DEPOSIT;
        earningsTransaction.amount = publisherAmount.toString();
        earningsTransaction.description = `Earnings from ${modpack.name} via ${gatewayType}`;
        earningsTransaction.walletId = publisherWallet.id;
        earningsTransaction.relatedModpackId = modpack.id;
        earningsTransaction.externalTransactionId = transactionId;
        await earningsTransaction.save();
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