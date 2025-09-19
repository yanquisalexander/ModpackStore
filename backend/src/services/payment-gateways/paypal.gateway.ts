import { PaymentGateway, PaymentRequest, PaymentResponse, WebhookPayload, PaymentGatewayType } from './interfaces';
import { APIError } from '@/lib/APIError';

interface PayPalPaymentPayload {
    intent: string;
    payer: {
        payment_method: string;
    };
    transactions: Array<{
        amount: {
            total: string;
            currency: string;
        };
        description: string;
        custom?: string;
    }>;
}

interface PayPalWebhookEvent {
    id: string;
    event_type: string;
    resource: {
        id: string;
        state: string;
        amount: {
            total: string;
            currency: string;
        };
        custom?: string;
    };
}

export class PayPalGateway implements PaymentGateway {
    readonly gatewayType = PaymentGatewayType.PAYPAL;

    private readonly clientId: string;
    private readonly clientSecret: string;
    private readonly baseUrl: string;

    constructor() {
        this.clientId = process.env.PAYPAL_CLIENT_ID || '';
        this.clientSecret = process.env.PAYPAL_CLIENT_SECRET || '';
        this.baseUrl = process.env.PAYPAL_BASE_URL || 'https://api.sandbox.paypal.com';
    }

    isConfigured(): boolean {
        return !!(this.clientId && this.clientSecret);
    }

    async createPayment(request: PaymentRequest): Promise<PaymentResponse> {
        if (!this.isConfigured()) {
            throw new APIError(500, 'PayPal configuration not found');
        }

        try {
            const accessToken = await this.getAccessToken();
            
            const payment: PayPalPaymentPayload = {
                intent: 'sale',
                payer: {
                    payment_method: 'paypal'
                },
                transactions: [{
                    amount: {
                        total: request.amount,
                        currency: request.currency
                    },
                    description: request.description,
                    custom: JSON.stringify({
                        modpackId: request.modpackId,
                        userId: request.userId,
                        ...request.metadata
                    })
                }]
            };

            const response = await fetch(`${this.baseUrl}/v1/payments/payment`, {
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
            const approvalUrl = paymentData.links?.find((link: any) => link.rel === 'approval_url')?.href;

            return {
                paymentId: paymentData.id,
                approvalUrl,
                status: 'pending',
                metadata: {
                    paypalPaymentId: paymentData.id,
                    approvalUrl
                }
            };
        } catch (error) {
            console.error('PayPal payment creation error:', error);
            throw new APIError(500, 'Failed to create PayPal payment');
        }
    }

    async processWebhook(payload: any): Promise<WebhookPayload> {
        const paypalEvent = payload as PayPalWebhookEvent;
        
        // Extract custom data
        let metadata: Record<string, any> = {};
        if (paypalEvent.resource.custom) {
            try {
                metadata = JSON.parse(paypalEvent.resource.custom);
            } catch (error) {
                console.warn('Failed to parse PayPal custom data:', error);
            }
        }

        return {
            gatewayType: this.gatewayType,
            eventType: paypalEvent.event_type,
            paymentId: paypalEvent.resource.id,
            status: this.mapPayPalStatus(paypalEvent.resource.state),
            amount: {
                total: paypalEvent.resource.amount.total,
                currency: paypalEvent.resource.amount.currency
            },
            metadata,
            rawPayload: payload
        };
    }

    async validateWebhook(payload: any, signature?: string): Promise<boolean> {
        // TODO: Implement PayPal webhook signature validation
        // For now, we'll return true as PayPal webhooks are on a secure endpoint
        return true;
    }

    private async getAccessToken(): Promise<string> {
        const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

        const response = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: 'grant_type=client_credentials'
        });

        if (!response.ok) {
            console.error('Failed to get PayPal access token:', await response.text());
            throw new APIError(500, 'Failed to get PayPal access token');
        }

        const data = await response.json();
        return data.access_token;
    }

    private mapPayPalStatus(paypalStatus: string): string {
        switch (paypalStatus) {
            case 'completed':
                return 'completed';
            case 'pending':
                return 'pending';
            case 'failed':
            case 'cancelled':
                return 'failed';
            default:
                return 'pending';
        }
    }
}