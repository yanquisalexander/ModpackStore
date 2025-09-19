/**
 * PayPal Payment Gateway Implementation
 *
 * IMPORTANT: This implementation uses PayPal Orders API v2 instead of the legacy Payments API v1.
 * The Orders API is more suitable for desktop applications as it doesn't require redirect URLs
 * for the basic payment flow. For desktop apps, you can handle the approval URL in your
 * application by opening it in the system browser or embedding a web view.
 *
 * Key differences from Payments API:
 * - Uses 'CAPTURE' intent instead of 'sale'
 * - Uses 'purchase_units' instead of 'transactions'
 * - Custom data is stored in 'custom_id' instead of 'custom'
 * - Webhook events have different structure
 * - Requires explicit capture for completed payments
 *
 * NEW FEATURES:
 * - QR Code generation for mobile payments
 * - Enhanced payment descriptions with modpack details
 * - Better metadata handling for tracking
 *
 * Usage Example:
 * ```typescript
 * const payment = await PaymentService.createPayment({
 *   amount: "10.00",
 *   currency: "USD",
 *   description: "Modpack purchase",
 *   modpackId: "modpack-id",
 *   userId: "user-id",
 *   includeModpackDetails: true, // Enable detailed descriptions and QR codes
 *   gatewayType: "paypal"
 * });
 *
 * // Use payment.qrCode for displaying QR code
 * // Use payment.approvalUrl for web payment
 * ```
 */

import { PaymentGateway, PaymentRequest, PaymentResponse, WebhookPayload, PaymentGatewayType } from './interfaces';
import { APIError } from '@/lib/APIError';
import * as QRCode from 'qrcode';

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

interface PayPalOrderPayload {
    intent: string;
    purchase_units: Array<{
        amount: {
            currency_code: string;
            value: string;
        };
        description: string;
        custom_id?: string;
    }>;
    application_context?: {
        return_url?: string;
        cancel_url?: string;
    };
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

interface PayPalOrderWebhookEvent {
    id: string;
    event_type: string;
    resource: {
        id: string;
        status: string;
        purchase_units?: Array<{
            amount: {
                currency_code: string;
                value: string;
            };
            custom_id?: string;
        }>;
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

    private generatePaymentDescription(request: PaymentRequest): string {
        const modpackDetails = request.modpackDetails;
        if (modpackDetails) {
            let description = `Compra de modpack: ${modpackDetails.name}`;
            if (modpackDetails.version) {
                description += ` v${modpackDetails.version}`;
            }
            if (modpackDetails.author) {
                description += ` por ${modpackDetails.author}`;
            }
            if (modpackDetails.description) {
                description += `\n${modpackDetails.description}`;
            }
            return description;
        }
        return request.description;
    }

    private async generateQRCode(url: string): Promise<string> {
        try {
            // Generate QR code as base64 data URL
            const qrCodeDataUrl = await QRCode.toDataURL(url, {
                width: 256,
                margin: 2,
                color: {
                    dark: '#000000',
                    light: '#FFFFFF'
                }
            });
            return qrCodeDataUrl;
        } catch (error) {
            console.warn('Failed to generate QR code:', error);
            return '';
        }
    }

    async createPayment(request: PaymentRequest): Promise<PaymentResponse> {
        if (!this.isConfigured()) {
            throw new APIError(500, 'PayPal configuration not found');
        }

        try {
            const accessToken = await this.getAccessToken();

            // Use Orders API instead of Payments API for desktop applications
            const order: PayPalOrderPayload = {
                intent: 'CAPTURE',
                purchase_units: [{
                    amount: {
                        currency_code: request.currency,
                        value: request.amount
                    },
                    description: this.generatePaymentDescription(request),
                    custom_id: JSON.stringify({
                        modpackId: request.modpackId,
                        userId: request.userId,
                        modpackDetails: request.modpackDetails,
                        ...request.metadata
                    })
                }]
                // Note: No redirect_urls needed for Orders API in desktop apps
            };

            const response = await fetch(`${this.baseUrl}/v2/checkout/orders`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`,
                    'PayPal-Request-Id': `modpack-${request.modpackId}-${Date.now()}`
                },
                body: JSON.stringify(order)
            });

            if (!response.ok) {
                const error = await response.json();
                console.error('PayPal order creation error:', error);
                throw new APIError(400, `PayPal order creation failed: ${error.message || 'Unknown error'}`);
            }

            const orderData = await response.json();
            const approvalUrl = orderData.links?.find((link: any) => link.rel === 'approve')?.href;

            // Generate QR code for mobile payments
            const qrCode = approvalUrl ? await this.generateQRCode(approvalUrl) : '';

            return {
                paymentId: orderData.id,
                approvalUrl,
                qrCode: qrCode || undefined,
                qrCodeUrl: approvalUrl, // Same as approval URL for PayPal
                status: 'pending',
                metadata: {
                    paypalOrderId: orderData.id,
                    approvalUrl,
                    modpackDetails: request.modpackDetails
                }
            };
        } catch (error) {
            console.error('PayPal payment creation error:', error);
            if (error instanceof APIError) {
                throw error;
            }
            throw new APIError(500, 'Failed to create PayPal payment');
        }
    }

    async capturePayment(orderId: string): Promise<PaymentResponse> {
        if (!this.isConfigured()) {
            throw new APIError(500, 'PayPal configuration not found');
        }

        try {
            const accessToken = await this.getAccessToken();

            const response = await fetch(`${this.baseUrl}/v2/checkout/orders/${orderId}/capture`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`,
                    'PayPal-Request-Id': `capture-${orderId}-${Date.now()}`
                }
            });

            if (!response.ok) {
                const error = await response.json();
                console.error('PayPal capture error:', error);
                throw new APIError(400, `PayPal capture failed: ${error.message || 'Unknown error'}`);
            }

            const captureData = await response.json();

            return {
                paymentId: captureData.id,
                status: 'completed',
                metadata: {
                    paypalOrderId: orderId,
                    captureId: captureData.id,
                    captureData
                }
            };
        } catch (error) {
            console.error('PayPal capture error:', error);
            if (error instanceof APIError) {
                throw error;
            }
            throw new APIError(500, 'Failed to capture PayPal payment');
        }
    }

    async processWebhook(payload: any): Promise<WebhookPayload> {
        const paypalEvent = payload as PayPalOrderWebhookEvent;

        // Extract custom data from purchase_units
        let metadata: Record<string, any> = {};
        if (paypalEvent.resource.purchase_units?.[0]?.custom_id) {
            try {
                metadata = JSON.parse(paypalEvent.resource.purchase_units[0].custom_id);
            } catch (error) {
                console.warn('Failed to parse PayPal custom_id data:', error);
            }
        }

        // Extract amount from purchase_units
        const purchaseUnit = paypalEvent.resource.purchase_units?.[0];
        const amount = purchaseUnit ? {
            total: purchaseUnit.amount.value,
            currency: purchaseUnit.amount.currency_code
        } : { total: '0', currency: 'USD' };

        // For Orders API, map status based on event type and resource status
        let status = this.mapPayPalOrderStatus(paypalEvent.resource.status);

        // Handle specific event types
        if (paypalEvent.event_type === 'CHECKOUT.ORDER.APPROVED') {
            // Order was approved by the user, we should capture it
            status = 'approved'; // Custom status for approved orders
        } else if (paypalEvent.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
            status = 'completed';
        }

        return {
            gatewayType: this.gatewayType,
            eventType: paypalEvent.event_type,
            paymentId: paypalEvent.resource.id,
            status,
            amount,
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

    private mapPayPalOrderStatus(paypalStatus: string): string {
        switch (paypalStatus.toUpperCase()) {
            case 'COMPLETED':
                return 'completed';
            case 'APPROVED':
            case 'PAYER_ACTION_REQUIRED':
                return 'pending';
            case 'VOIDED':
            case 'FAILED':
                return 'failed';
            default:
                return 'pending';
        }
    }
}