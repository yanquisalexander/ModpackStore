import { Hono } from 'hono';
import { PaymentWebhookController } from '../../controllers/PaymentWebhook.controller';

const app = new Hono();

/**
 * @openapi
 * /webhooks/payments/paypal:
 *   post:
 *     summary: PayPal payment webhook
 *     tags: [Payment Webhooks]
 *     description: Handles PayPal payment completion and status change webhooks.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: PayPal webhook event payload
 *     responses:
 *       200:
 *         description: Webhook processed successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *       500:
 *         description: Webhook processing failed.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                 details:
 *                   type: string
 */
app.post('/paypal', PaymentWebhookController.paypalWebhook);

/**
 * @openapi
 * /webhooks/payments/mercadopago:
 *   post:
 *     summary: MercadoPago payment webhook
 *     tags: [Payment Webhooks]
 *     description: Handles MercadoPago payment notifications and status changes.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: MercadoPago webhook event payload
 *     responses:
 *       200:
 *         description: Webhook processed successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *       500:
 *         description: Webhook processing failed.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                 details:
 *                   type: string
 */
app.post('/mercadopago', PaymentWebhookController.mercadopagoWebhook);

/**
 * @openapi
 * /webhooks/payments/status:
 *   get:
 *     summary: Payment gateway status
 *     tags: [Payment Webhooks]
 *     description: Get current status of all configured payment gateways.
 *     responses:
 *       200:
 *         description: Gateway status retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: object
 *                   additionalProperties:
 *                     type: object
 *                     properties:
 *                       available:
 *                         type: boolean
 *                       configured:
 *                         type: boolean
 *                 availableGateways:
 *                   type: array
 *                   items:
 *                     type: string
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
app.get('/status', PaymentWebhookController.getGatewayStatus);

/**
 * @openapi
 * /webhooks/payments/health:
 *   get:
 *     summary: Webhook health check
 *     tags: [Payment Webhooks]
 *     description: Health check endpoint for monitoring webhook service availability.
 *     responses:
 *       200:
 *         description: Service is healthy.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [healthy]
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 gateways:
 *                   type: array
 *                   items:
 *                     type: string
 */
app.get('/health', PaymentWebhookController.healthCheck);

export default app;