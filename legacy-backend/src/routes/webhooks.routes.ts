import { Hono } from 'hono';
import paymentWebhookRoutes from './v1/payment-webhooks.routes';

const app = new Hono();

// Payment webhook routes
app.route('/payments', paymentWebhookRoutes);

export default app;