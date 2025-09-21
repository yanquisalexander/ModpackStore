import { type Context } from 'hono';
import { PaymentService } from '@/services/payment.service';
import { paymentGatewayManager, PaymentGatewayType } from '@/services/payment-gateways';
import { PatreonIntegrationService } from '@/services/patreon-integration.service';
import crypto from 'crypto';

export class PaymentWebhookController {
    /**
     * Handle PayPal webhook
     */
    static async paypalWebhook(c: Context): Promise<Response> {
        const requestId = Date.now().toString();
        const startTime = Date.now();

        try {
            const payload = await c.req.json();

            console.log('[WEBHOOK_PAYPAL] Received webhook:', {
                requestId,
                timestamp: new Date().toISOString(),
                eventType: payload.event_type,
                resourceId: payload.resource?.id
            });

            await PaymentService.handleWebhook(PaymentGatewayType.PAYPAL, payload);

            const processingTime = Date.now() - startTime;
            console.log('[WEBHOOK_PAYPAL] Webhook processed successfully:', {
                requestId,
                processingTimeMs: processingTime
            });

            return c.json({ success: true, requestId }, 200);
        } catch (error: any) {
            const processingTime = Date.now() - startTime;
            console.error('[WEBHOOK_PAYPAL] Webhook processing failed:', {
                requestId,
                error: error.message || 'Unknown error',
                processingTimeMs: processingTime,
                stack: error.stack
            });

            // Return 200 even on error to prevent PayPal from retrying invalid webhooks
            // Log the error but don't expose internal details
            return c.json({
                success: false,
                requestId,
                error: 'Webhook processing failed'
            }, 200);
        }
    }

    /**
     * Handle MercadoPago webhook
     */
    static async mercadopagoWebhook(c: Context): Promise<Response> {
        const requestId = Date.now().toString();
        const startTime = Date.now();

        try {
            // MercadoPago sends data as query parameters, not JSON body
            const queryParams = c.req.query();
            const payload = {
                type: queryParams.topic, // 'payment' or 'merchant_order'
                data: {
                    id: queryParams.id // payment or merchant_order ID
                }
            };

            console.log('[WEBHOOK_MERCADOPAGO] Received webhook:', {
                requestId,
                timestamp: new Date().toISOString(),
                type: payload.type,
                dataId: payload.data?.id,
                queryParams // Log for debugging
            });

            await PaymentService.handleWebhook(PaymentGatewayType.MERCADOPAGO, payload);

            const processingTime = Date.now() - startTime;
            console.log('[WEBHOOK_MERCADOPAGO] Webhook processed successfully:', {
                requestId,
                processingTimeMs: processingTime
            });

            return c.json({ success: true, requestId }, 200);
        } catch (error: any) {
            const processingTime = Date.now() - startTime;
            console.error('[WEBHOOK_MERCADOPAGO] Webhook processing failed:', {
                requestId,
                error: error.message || 'Unknown error',
                processingTimeMs: processingTime,
                stack: error.stack
            });

            // Return 200 even on error to prevent MercadoPago from retrying invalid webhooks
            // Log the error but don't expose internal details
            return c.json({
                success: false,
                requestId,
                error: 'Webhook processing failed'
            }, 200);
        }
    }

    /**
     * Handle Patreon webhook
     */
    static async patreonWebhook(c: Context): Promise<Response> {
        const requestId = Date.now().toString();
        const startTime = Date.now();

        try {
            // Get the raw body for signature validation
            const body = await c.req.text();
            const signature = c.req.header('X-Patreon-Signature');
            
            if (!signature) {
                console.warn('[WEBHOOK_PATREON] Missing signature header:', { requestId });
                return c.json({ error: 'Missing signature' }, 401);
            }

            // Validate webhook signature
            const webhookSecret = process.env.PATREON_WEBHOOK_SECRET;
            if (!webhookSecret) {
                console.error('[WEBHOOK_PATREON] Webhook secret not configured:', { requestId });
                return c.json({ error: 'Webhook not configured' }, 500);
            }

            const expectedSignature = crypto
                .createHmac('md5', webhookSecret)
                .update(body)
                .digest('hex');

            if (signature !== expectedSignature) {
                console.warn('[WEBHOOK_PATREON] Invalid signature:', { 
                    requestId,
                    receivedSignature: signature,
                    expectedSignature 
                });
                return c.json({ error: 'Invalid signature' }, 401);
            }

            const payload = JSON.parse(body);

            console.log('[WEBHOOK_PATREON] Received webhook:', {
                requestId,
                timestamp: new Date().toISOString(),
                eventType: payload.data?.type,
                resourceId: payload.data?.id
            });

            // Process the webhook
            await PatreonIntegrationService.handleWebhook(payload);

            const processingTime = Date.now() - startTime;
            console.log('[WEBHOOK_PATREON] Webhook processed successfully:', {
                requestId,
                processingTimeMs: processingTime
            });

            return c.json({ success: true, requestId }, 200);
        } catch (error: any) {
            const processingTime = Date.now() - startTime;
            console.error('[WEBHOOK_PATREON] Webhook processing failed:', {
                requestId,
                error: error.message || 'Unknown error',
                processingTimeMs: processingTime,
                stack: error.stack
            });

            // Return 200 even on error to prevent Patreon from retrying invalid webhooks
            return c.json({
                success: false,
                requestId,
                error: 'Webhook processing failed'
            }, 200);
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