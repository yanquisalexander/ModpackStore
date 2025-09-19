import { type Context } from 'hono';
import { PaymentService } from '@/services/payment.service';
import { paymentGatewayManager, PaymentGatewayType } from '@/services/payment-gateways';

export class PaymentWebhookController {
    /**
     * Handle PayPal webhook
     */
    static async paypalWebhook(c: Context): Promise<Response> {
        try {
            const payload = await c.req.json();
            await PaymentService.handleWebhook(PaymentGatewayType.PAYPAL, payload);

            console.log('[WEBHOOK_PAYPAL] Webhook processed successfully');
            return c.json({ success: true }, 200);
        } catch (error: any) {
            console.error('[WEBHOOK_PAYPAL] Webhook processing failed:', error);
            return c.json({ 
                error: 'Webhook processing failed',
                details: error.message 
            }, 500);
        }
    }

    /**
     * Handle MercadoPago webhook
     */
    static async mercadopagoWebhook(c: Context): Promise<Response> {
        try {
            const payload = await c.req.json();
            await PaymentService.handleWebhook(PaymentGatewayType.MERCADOPAGO, payload);

            console.log('[WEBHOOK_MERCADOPAGO] Webhook processed successfully');
            return c.json({ success: true }, 200);
        } catch (error: any) {
            console.error('[WEBHOOK_MERCADOPAGO] Webhook processing failed:', error);
            return c.json({ 
                error: 'Webhook processing failed',
                details: error.message 
            }, 500);
        }
    }

    /**
     * Get payment gateway status (for debugging/monitoring)
     */
    static async getGatewayStatus(c: Context): Promise<Response> {
        try {
            const status = PaymentService.getGatewayStatus();
            const availableGateways = PaymentService.getAvailableGateways();

            return c.json({
                status,
                availableGateways,
                timestamp: new Date().toISOString()
            }, 200);
        } catch (error: any) {
            console.error('[WEBHOOK_STATUS] Error getting gateway status:', error);
            return c.json({ 
                error: 'Failed to get gateway status',
                details: error.message 
            }, 500);
        }
    }

    /**
     * Health check endpoint for webhook monitoring
     */
    static async healthCheck(c: Context): Promise<Response> {
        return c.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            gateways: PaymentService.getAvailableGateways()
        }, 200);
    }
}