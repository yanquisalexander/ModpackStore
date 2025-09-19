/**
 * Payment Gateway Abstraction Interfaces
 * Provides a unified interface for multiple payment providers
 */

export interface PaymentRequest {
    amount: string;
    currency: string;
    description: string;
    modpackId: string;
    userId: string;
    metadata?: Record<string, any>;
}

export interface PaymentResponse {
    paymentId: string;
    approvalUrl?: string;
    status: 'pending' | 'completed' | 'failed';
    metadata?: Record<string, any>;
}

export interface WebhookPayload {
    gatewayType: string;
    eventType: string;
    paymentId: string;
    status: string;
    amount?: {
        total: string;
        currency: string;
    };
    metadata?: Record<string, any>;
    rawPayload: any;
}

export interface PaymentGateway {
    /**
     * Gateway identifier (e.g., 'paypal', 'mercadopago')
     */
    readonly gatewayType: string;

    /**
     * Create a payment for the given request
     */
    createPayment(request: PaymentRequest): Promise<PaymentResponse>;

    /**
     * Capture an approved payment (for gateways that require explicit capture)
     */
    capturePayment?(paymentId: string): Promise<PaymentResponse>;

    /**
     * Process webhook payload from the gateway
     */
    processWebhook(payload: any): Promise<WebhookPayload>;

    /**
     * Validate webhook authenticity (optional but recommended)
     */
    validateWebhook?(payload: any, signature?: string): Promise<boolean>;

    /**
     * Get gateway configuration status
     */
    isConfigured(): boolean;
}

export interface PaymentGatewayConfig {
    enabled: boolean;
    sandbox: boolean;
    credentials: Record<string, string>;
}

export enum PaymentGatewayType {
    PAYPAL = 'paypal',
    MERCADOPAGO = 'mercadopago'
}