import { PaymentGateway, PaymentRequest, PaymentResponse, WebhookPayload, PaymentGatewayType } from './interfaces';
import { APIError } from '@/lib/APIError';
import crypto from 'crypto';

interface MercadoPagoPreferenceRequest {
    items: Array<{
        title: string;
        quantity: number;
        unit_price: number;
        currency_id: string;
    }>;
    external_reference: string;
    notification_url?: string;
    metadata?: Record<string, any>;
}

interface MercadoPagoPreferenceResponse {
    id: string;
    init_point: string;
    sandbox_init_point: string;
}

interface MercadoPagoWebhookEvent {
    id: number;
    live_mode: boolean;
    type: string;
    date_created: string;
    application_id: number;
    user_id: number;
    version: number;
    api_version: string;
    action: string;
    data: {
        id: string;
    };
}

interface MercadoPagoPayment {
    id: number;
    status: string;
    status_detail: string;
    external_reference: string;
    transaction_amount: number;
    currency_id: string;
    metadata?: Record<string, any>;
}

export class MercadoPagoGateway implements PaymentGateway {
    readonly gatewayType = PaymentGatewayType.MERCADOPAGO;

    private readonly accessToken: string;
    private readonly baseUrl: string;
    private readonly webhookSecret: string;

    constructor() {
        this.accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN || '';
        this.baseUrl = process.env.MERCADOPAGO_BASE_URL || 'https://api.mercadopago.com';
        this.webhookSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET || '';
    }

    isConfigured(): boolean {
        return !!this.accessToken;
    }

    async createPayment(request: PaymentRequest): Promise<PaymentResponse> {
        if (!this.isConfigured()) {
            throw new APIError(500, 'MercadoPago configuration not found');
        }

        try {
            const preference: MercadoPagoPreferenceRequest = {
                items: [{
                    title: request.description,
                    quantity: 1,
                    unit_price: parseFloat(request.amount),
                    currency_id: request.currency
                }],
                external_reference: JSON.stringify({
                    modpackId: request.modpackId,
                    userId: request.userId,
                    ...request.metadata
                }),
                notification_url: process.env.MERCADOPAGO_WEBHOOK_URL,
                metadata: {
                    modpack_id: request.modpackId,
                    user_id: request.userId,
                    ...request.metadata
                }
            };

            const response = await fetch(`${this.baseUrl}/checkout/preferences`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.accessToken}`
                },
                body: JSON.stringify(preference)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new APIError(400, `MercadoPago preference creation failed: ${error.message}`);
            }

            const preferenceData: MercadoPagoPreferenceResponse = await response.json();

            // Use sandbox URL if in development/sandbox mode
            const isSandbox = this.baseUrl.includes('sandbox') || !process.env.NODE_ENV || process.env.NODE_ENV === 'development';
            const approvalUrl = isSandbox ? preferenceData.sandbox_init_point : preferenceData.init_point;

            return {
                paymentId: preferenceData.id,
                approvalUrl,
                status: 'pending',
                metadata: {
                    mercadopagoPreferenceId: preferenceData.id,
                    approvalUrl
                }
            };
        } catch (error) {
            console.error('MercadoPago payment creation error:', error);
            throw new APIError(500, 'Failed to create MercadoPago payment');
        }
    }

    private async createPreapprovalPlan(request: {
        amount: string;
        currency: string;
        description: string;
        backUrl: string;
    }) {
        const plan = {
            reason: request.description,
            auto_recurring: {
                frequency: 1,
                frequency_type: 'months',
                transaction_amount: parseFloat(request.amount),
                currency_id: request.currency,
            },
            back_url: request.backUrl,
        };

        const response = await fetch(`${this.baseUrl}/preapproval_plan`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.accessToken}`,
            },
            body: JSON.stringify(plan),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new APIError(400, `MercadoPago preapproval plan creation failed: ${error.message || JSON.stringify(error)}`);
        }

        return response.json();
    }

    async createSubscription(request: {
        amount: string;
        currency: string;
        description: string;
        publisherId: string;
        tier: string;
        payerEmail: string;
        backUrl: string;
    }): Promise<PaymentResponse> {
        if (!this.isConfigured()) {
            throw new APIError(500, 'MercadoPago configuration not found');
        }

        try {
            // Create (or reuse) a preapproval plan and return its id to the frontend.
            // The frontend must redirect the user to MercadoPago to complete the approval flow.
            const plan = await this.createPreapprovalPlan({
                amount: request.amount,
                currency: request.currency,
                description: request.description,
                backUrl: request.backUrl,
            });

            // Some MP responses may include an init_point for the plan; include if available
            const approvalUrl = (plan && (plan.init_point || plan.sandbox_init_point)) || null;

            return {
                paymentId: plan.id,
                approvalUrl,
                status: 'pending',
                metadata: {
                    mercadopagoPreapprovalPlanId: plan.id,
                    approvalUrl
                }
            };
        } catch (error) {
            console.error('MercadoPago subscription creation error:', error);
            throw new APIError(500, 'Failed to create MercadoPago subscription');
        }
    }

    async processWebhook(payload: any): Promise<WebhookPayload> {
        const webhookEvent = payload as MercadoPagoWebhookEvent;

        // Handle different webhook types
        if (webhookEvent.type === 'payment') {
            // Process payment webhook directly
            const payment = await this.getPayment(webhookEvent.data.id);

            // Extract metadata from external reference
            let metadata: Record<string, any> = {};
            if (payment.external_reference) {
                try {
                    metadata = JSON.parse(payment.external_reference);
                } catch (error) {
                    console.warn('Failed to parse MercadoPago external reference:', error);
                }
            }

            return {
                gatewayType: this.gatewayType,
                eventType: `payment.${payment.status}`,
                paymentId: payment.id.toString(),
                status: this.mapMercadoPagoStatus(payment.status),
                amount: {
                    total: payment.transaction_amount.toString(),
                    currency: payment.currency_id
                },
                metadata,
                rawPayload: payload
            };
        } else if (webhookEvent.type === 'merchant_order') {
            // Handle merchant order webhook - check if it has completed payments
            const merchantOrder = await this.getMerchantOrder(webhookEvent.data.id);

            // Check if merchant order has approved payments
            const approvedPayments = merchantOrder.payments?.filter((payment: any) =>
                payment.status === 'approved'
            ) || [];

            if (approvedPayments.length === 0) {
                console.log(`[MERCADOPAGO] Merchant order ${webhookEvent.data.id} has no approved payments yet. Waiting for payment webhook.`);
                // Return a special event type that won't trigger payment processing
                return {
                    gatewayType: this.gatewayType,
                    eventType: 'merchant_order.pending',
                    paymentId: merchantOrder.id.toString(),
                    status: 'pending',
                    amount: {
                        total: merchantOrder.total_amount?.toString() || '0',
                        currency: merchantOrder.currency_id || 'USD'
                    },
                    metadata: {
                        // Don't include modpackId/userId for pending merchant orders
                        skipPaymentProcessing: true
                    }
                    ,
                    rawPayload: payload
                };
            }

            // If there are approved payments, process the first one
            const paymentId = approvedPayments[0].id;
            const payment = await this.getPayment(paymentId);

            // Extract metadata from external reference
            let metadata: Record<string, any> = {};
            if (payment.external_reference) {
                try {
                    metadata = JSON.parse(payment.external_reference);
                } catch (error) {
                    console.warn('Failed to parse MercadoPago external reference:', error);
                }
            }

            return {
                gatewayType: this.gatewayType,
                eventType: `payment.${payment.status}`,
                paymentId: payment.id.toString(),
                status: this.mapMercadoPagoStatus(payment.status),
                amount: {
                    total: payment.transaction_amount.toString(),
                    currency: payment.currency_id
                },
                metadata,
                rawPayload: payload
            };
        } else if (webhookEvent.type === 'preapproval' || webhookEvent.type === 'subscription_preapproval') {
            const preapproval = await this.getPreApproval(webhookEvent.data.id);

            let metadata: Record<string, any> = {};
            if (preapproval.external_reference) {
                try {
                    metadata = JSON.parse(preapproval.external_reference);
                } catch (error) {
                    console.warn('Failed to parse MercadoPago preapproval external reference:', error);
                }
            }

            return {
                gatewayType: this.gatewayType,
                eventType: `subscription.${preapproval.status}`,
                paymentId: preapproval.id,
                status: this.mapMercadoPagoStatus(preapproval.status),
                amount: {
                    total: preapproval.auto_recurring?.transaction_amount?.toString() || '0',
                    currency: preapproval.auto_recurring?.currency_id || 'ARS'
                },
                metadata,
                rawPayload: payload
            };
        } else if (webhookEvent.type === 'subscription_authorized_payment') {
            const authorizedPayment = await this.getAuthorizedPayment(webhookEvent.data.id);

            // Authorized payments are linked to a preapproval
            const preapproval = await this.getPreApproval(authorizedPayment.preapproval_id);

            let metadata: Record<string, any> = {};
            if (preapproval.external_reference) {
                try {
                    metadata = JSON.parse(preapproval.external_reference);
                } catch (error) {
                    console.warn('Failed to parse MercadoPago preapproval external reference:', error);
                }
            }

            return {
                gatewayType: this.gatewayType,
                eventType: 'payment.completed',
                paymentId: authorizedPayment.preapproval_id, // Link to the subscription
                status: 'completed',
                amount: {
                    total: authorizedPayment.transaction_amount?.toString() || '0',
                    currency: authorizedPayment.currency_id || 'ARS'
                },
                metadata,
                rawPayload: payload
            };
        } else {
            throw new Error(`Unsupported MercadoPago webhook type: ${webhookEvent.type}`);
        }
    }

    async validateWebhook(payload: any, headers: Record<string, string>, query: Record<string, string>): Promise<boolean> {
        if (!this.webhookSecret) {
            console.warn('[MERCADOPAGO] Webhook secret not configured. Skipping validation.');
            return true;
        }

        const xSignature = headers['x-signature'];
        const xRequestId = headers['x-request-id'];

        if (!xSignature || !xRequestId) {
            console.warn('[MERCADOPAGO] Missing x-signature or x-request-id headers');
            return false;
        }

        // Parse x-signature: ts=123,v1=abc
        const parts = xSignature.split(',');
        let ts = '';
        let v1 = '';

        for (const part of parts) {
            const [key, value] = part.split('=');
            if (key === 'ts') ts = value;
            if (key === 'v1') v1 = value;
        }

        if (!ts || !v1) {
            console.warn('[MERCADOPAGO] Invalid x-signature format');
            return false;
        }

        // Get data.id from query params (MercadoPago docs say it's in query params)
        // If not in query, try payload
        const dataId = query['data.id'] || payload.data?.id || '';

        // Manifest: id:[data.id];request-id:[x-request-id];ts:[ts];
        const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;

        const hmac = crypto.createHmac('sha256', this.webhookSecret);
        hmac.update(manifest);
        const sha = hmac.digest('hex');

        const isValid = sha === v1;
        if (!isValid) {
            console.error('[MERCADOPAGO] Webhook signature validation failed', {
                manifest,
                receivedV1: v1,
                computedSha: sha
            });
        }

        return isValid;
    }

    private async getPayment(paymentId: string): Promise<MercadoPagoPayment> {
        const response = await fetch(`${this.baseUrl}/v1/payments/${paymentId}`, {
            headers: {
                'Authorization': `Bearer ${this.accessToken}`
            }
        });

        if (!response.ok) {
            throw new APIError(404, 'MercadoPago payment not found');
        }

        return await response.json();
    }

    private async getPreApproval(preapprovalId: string) {
        const response = await fetch(`${this.baseUrl}/preapproval/${preapprovalId}`, {
            headers: {
                'Authorization': `Bearer ${this.accessToken}`
            }
        });

        if (!response.ok) {
            throw new APIError(404, 'MercadoPago preapproval not found');
        }

        return await response.json();
    }

    private async getAuthorizedPayment(authorizedPaymentId: string) {
        const response = await fetch(`${this.baseUrl}/authorized_payments/${authorizedPaymentId}`, {
            headers: {
                'Authorization': `Bearer ${this.accessToken}`
            }
        });

        if (!response.ok) {
            throw new APIError(404, 'MercadoPago authorized payment not found');
        }

        return await response.json();
    }

    private async getMerchantOrder(merchantOrderId: string) {
        const response = await fetch(`${this.baseUrl}/merchant_orders/${merchantOrderId}`, {
            headers: {
                'Authorization': `Bearer ${this.accessToken}`
            }
        });

        if (!response.ok) {
            throw new APIError(404, 'MercadoPago merchant order not found');
        }

        return await response.json();
    }

    private mapMercadoPagoStatus(mercadopagoStatus: string): string {
        switch (mercadopagoStatus) {
            case 'approved':
                return 'completed';
            case 'pending':
            case 'in_process':
            case 'in_mediation':
                return 'pending';
            case 'rejected':
            case 'cancelled':
            case 'refunded':
            case 'charged_back':
                return 'failed';
            default:
                return 'pending';
        }
    }
}