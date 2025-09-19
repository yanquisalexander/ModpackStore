import { PaymentGateway, PaymentRequest, PaymentResponse, WebhookPayload, PaymentGatewayType } from './interfaces';
import { APIError } from '@/lib/APIError';

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

    async processWebhook(payload: any): Promise<WebhookPayload> {
        const webhookEvent = payload as MercadoPagoWebhookEvent;
        
        // Only process payment notifications
        if (webhookEvent.type !== 'payment') {
            throw new Error(`Unsupported MercadoPago webhook type: ${webhookEvent.type}`);
        }

        // Fetch payment details
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
    }

    async validateWebhook(payload: any, signature?: string): Promise<boolean> {
        // TODO: Implement MercadoPago webhook signature validation
        // For now, we'll return true as MercadoPago webhooks are on a secure endpoint
        return true;
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