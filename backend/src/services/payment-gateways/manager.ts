import { PaymentGateway, PaymentRequest, PaymentResponse, WebhookPayload, PaymentGatewayType } from './interfaces';
import { PayPalGateway } from './paypal.gateway';
import { MercadoPagoGateway } from './mercadopago.gateway';
import { APIError } from '@/lib/APIError';

export class PaymentGatewayManager {
    private static instance: PaymentGatewayManager;
    private gateways: Map<string, PaymentGateway> = new Map();

    private constructor() {
        this.initializeGateways();
    }

    static getInstance(): PaymentGatewayManager {
        if (!PaymentGatewayManager.instance) {
            PaymentGatewayManager.instance = new PaymentGatewayManager();
        }
        return PaymentGatewayManager.instance;
    }

    private initializeGateways(): void {
        // Initialize PayPal gateway
        const paypalGateway = new PayPalGateway();
        if (paypalGateway.isConfigured()) {
            this.gateways.set(PaymentGatewayType.PAYPAL, paypalGateway);
            console.log('PayPal gateway initialized and configured');
        } else {
            console.warn('PayPal gateway not configured - missing credentials');
        }

        // Initialize MercadoPago gateway
        const mercadopagoGateway = new MercadoPagoGateway();
        if (mercadopagoGateway.isConfigured()) {
            this.gateways.set(PaymentGatewayType.MERCADOPAGO, mercadopagoGateway);
            console.log('MercadoPago gateway initialized and configured');
        } else {
            console.warn('MercadoPago gateway not configured - missing credentials');
        }
    }

    /**
     * Get available payment gateways
     */
    getAvailableGateways(): string[] {
        return Array.from(this.gateways.keys());
    }

    /**
     * Get a specific gateway by type
     */
    getGateway(gatewayType: string): PaymentGateway {
        const gateway = this.gateways.get(gatewayType);
        if (!gateway) {
            throw new APIError(400, `Payment gateway '${gatewayType}' not available or configured`);
        }
        return gateway;
    }

    /**
     * Get the preferred gateway for a given country/region
     * For Uruguay, prefer MercadoPago, fallback to PayPal
     */
    getPreferredGateway(countryCode?: string): PaymentGateway {
        // For Uruguay and Latin American countries, prefer MercadoPago
        const latinAmericanCountries = ['UY', 'AR', 'BR', 'CL', 'CO', 'MX', 'PE'];
        
        if (countryCode && latinAmericanCountries.includes(countryCode.toUpperCase())) {
            if (this.gateways.has(PaymentGatewayType.MERCADOPAGO)) {
                return this.gateways.get(PaymentGatewayType.MERCADOPAGO)!;
            }
        }

        // Default to PayPal if available
        if (this.gateways.has(PaymentGatewayType.PAYPAL)) {
            return this.gateways.get(PaymentGatewayType.PAYPAL)!;
        }

        // If no gateways available, throw error
        const availableGateways = this.getAvailableGateways();
        if (availableGateways.length === 0) {
            throw new APIError(500, 'No payment gateways configured');
        }

        // Return first available gateway
        return this.gateways.get(availableGateways[0])!;
    }

    /**
     * Create payment using specified gateway
     */
    async createPayment(gatewayType: string, request: PaymentRequest): Promise<PaymentResponse> {
        const gateway = this.getGateway(gatewayType);
        
        console.log(`Creating payment via ${gatewayType} for modpack ${request.modpackId}`);
        
        try {
            const response = await gateway.createPayment(request);
            
            // Log payment creation for traceability
            console.log(`Payment created successfully:`, {
                gateway: gatewayType,
                paymentId: response.paymentId,
                modpackId: request.modpackId,
                userId: request.userId,
                amount: request.amount,
                currency: request.currency
            });
            
            return response;
        } catch (error) {
            console.error(`Payment creation failed for gateway ${gatewayType}:`, error);
            throw error;
        }
    }

    /**
     * Process webhook from any gateway
     */
    async processWebhook(gatewayType: string, payload: any): Promise<WebhookPayload> {
        const gateway = this.getGateway(gatewayType);
        
        console.log(`Processing webhook from ${gatewayType}`);
        
        try {
            // Validate webhook if supported
            if (gateway.validateWebhook) {
                const isValid = await gateway.validateWebhook(payload);
                if (!isValid) {
                    throw new APIError(400, 'Invalid webhook signature');
                }
            }

            const webhookPayload = await gateway.processWebhook(payload);
            
            // Log webhook processing for traceability
            console.log(`Webhook processed successfully:`, {
                gateway: gatewayType,
                eventType: webhookPayload.eventType,
                paymentId: webhookPayload.paymentId,
                status: webhookPayload.status,
                amount: webhookPayload.amount
            });
            
            return webhookPayload;
        } catch (error) {
            console.error(`Webhook processing failed for gateway ${gatewayType}:`, error);
            throw error;
        }
    }

    /**
     * Check if a specific gateway is available
     */
    isGatewayAvailable(gatewayType: string): boolean {
        return this.gateways.has(gatewayType);
    }

    /**
     * Get gateway configuration status
     */
    getGatewayStatus(): Record<string, { available: boolean; configured: boolean }> {
        const status: Record<string, { available: boolean; configured: boolean }> = {};
        
        // Check all possible gateways
        Object.values(PaymentGatewayType).forEach(gatewayType => {
            const gateway = this.gateways.get(gatewayType);
            status[gatewayType] = {
                available: !!gateway,
                configured: gateway ? gateway.isConfigured() : false
            };
        });
        
        return status;
    }
}