import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { requireAuth } from '@/middlewares/auth.middleware';
import { PublisherSubscriptionService } from '@/services/publisher-subscription.service';
import { SubscriptionTier, PaymentProvider } from '@/entities/PublisherSubscription';
import { ordersController } from '@/lib/paypal';

// Validation schemas
const createOrderSchema = z.object({
    tier: z.nativeEnum(SubscriptionTier),
});

const captureOrderSchema = z.object({
    orderId: z.string(),
    tier: z.nativeEnum(SubscriptionTier),
});

const publisherSubscriptionRoutes = new Hono();

// All routes require authentication
publisherSubscriptionRoutes.use('*', requireAuth);

// Get active subscription
publisherSubscriptionRoutes.get('/:publisherId/subscription', async (c) => {
    try {
        const { publisherId } = c.req.param();

        const subscription = await PublisherSubscriptionService.getActiveSubscription(publisherId);

        if (!subscription) {
            return c.json({ data: null });
        }

        return c.json({
            data: {
                id: subscription.id,
                tier: subscription.tier,
                status: subscription.status,
                expiresAt: subscription.subscriptionExpiresAt,
                isActive: subscription.isActive(),
                daysUntilExpiry: subscription.daysUntilExpiry(),
                paymentProvider: subscription.paymentProvider,
                autoRenew: subscription.autoRenew,
            }
        });
    } catch (error) {
        console.error('Error fetching subscription:', error);
        return c.json({ error: 'Failed to fetch subscription' }, 500);
    }
});

// Get features
publisherSubscriptionRoutes.get('/:publisherId/subscription/features', async (c) => {
    try {
        const { publisherId } = c.req.param();
        const features = await PublisherSubscriptionService.getPublisherFeatures(publisherId);
        return c.json({ data: features });
    } catch (error) {
        console.error('Error fetching features:', error);
        return c.json({ error: 'Failed to fetch features' }, 500);
    }
});

// Create PayPal Order
publisherSubscriptionRoutes.post('/:publisherId/subscription/order', zValidator('json', createOrderSchema), async (c) => {
    try {
        const { publisherId } = c.req.param();
        const { tier } = c.req.valid('json');

        // Determine price based on tier
        let price = '0.00';
        switch (tier) {
            case SubscriptionTier.BASIC: price = '9.99'; break;
            case SubscriptionTier.PREMIUM: price = '29.99'; break;
            case SubscriptionTier.ENTERPRISE: price = '99.99'; break;
            case SubscriptionTier.FREE:
                const sub = await PublisherSubscriptionService.createSubscription({
                    publisherId,
                    tier: SubscriptionTier.FREE
                });
                return c.json({ data: { subscriptionId: sub.id, free: true } });
        }

        const collect = {
            body: {
                intent: 'CAPTURE',
                purchaseUnits: [{
                    amount: {
                        currencyCode: 'USD',
                        value: price
                    },
                    description: `Subscription Upgrade to ${tier.toUpperCase()}`
                }]
            }
        };

        const { result } = await ordersController.createOrder(collect);
        return c.json({ orderId: result.id });

    } catch (error) {
        console.error('Error creating PayPal order:', error);
        return c.json({ error: 'Failed to create payment order' }, 500);
    }
});

// Capture PayPal Order
publisherSubscriptionRoutes.post('/:publisherId/subscription/capture', zValidator('json', captureOrderSchema), async (c) => {
    try {
        const { publisherId } = c.req.param();
        const { orderId, tier } = c.req.valid('json');

        const { result } = await ordersController.captureOrder({ id: orderId, prefer: 'return=representation' });

        if (result.status === 'COMPLETED') {
            const durationDays = 30;
            const amount = result.purchaseUnits?.[0]?.payments?.captures?.[0]?.amount?.value || '0.00';

            const subscription = await PublisherSubscriptionService.createSubscription({
                publisherId,
                tier,
                paymentProvider: PaymentProvider.PAYPAL,
                paymentReference: orderId,
                amount: amount,
                currency: 'USD',
                durationDays,
                autoRenew: false
            });

            return c.json({
                message: 'Subscription activated successfully',
                data: { subscriptionId: subscription.id }
            });
        } else {
            return c.json({ error: 'Payment not completed' }, 400);
        }

    } catch (error) {
        console.error('Error capturing PayPal order:', error);
        return c.json({ error: 'Failed to capture payment' }, 500);
    }
});

// Cancel subscription
publisherSubscriptionRoutes.post('/:publisherId/subscription/cancel', async (c) => {
    try {
        const { publisherId } = c.req.param();

        const subscription = await PublisherSubscriptionService.getActiveSubscription(publisherId);
        if (!subscription) {
            return c.json({ error: 'No active subscription found' }, 404);
        }

        await PublisherSubscriptionService.cancelSubscription(subscription.id);

        return c.json({ message: 'Subscription cancelled successfully' });
    } catch (error) {
        console.error('Error cancelling subscription:', error);
        return c.json({ error: 'Failed to cancel subscription' }, 500);
    }
});

// Get PayPal approval URL
publisherSubscriptionRoutes.get('/subscription/paypal/approval/:orderId', async (c) => {
    try {
        const { orderId } = c.req.param();

        // Get order details from PayPal to extract approval URL
        const approvalUrl = `https://www.sandbox.paypal.com/checkoutnow?token=${orderId}`;

        return c.json({ data: { approvalUrl } });
    } catch (error) {
        console.error('Error getting PayPal approval URL:', error);
        return c.json({ error: 'Failed to get approval URL' }, 500);
    }
});

// Check payment status
publisherSubscriptionRoutes.get('/subscription/paypal/status/:orderId', async (c) => {
    try {
        const { orderId } = c.req.param();

        // Check order status with PayPal API
        const { result, ...httpResponse } = await ordersController.ordersGet({ id: orderId });

        if (httpResponse.statusCode === 200 && result) {
            const paypalStatus = result.status;

            // Map PayPal status to our status
            let status = 'PENDING';
            if (paypalStatus === 'APPROVED') {
                status = 'COMPLETED';
            } else if (paypalStatus === 'COMPLETED') {
                status = 'COMPLETED';
            } else if (paypalStatus === 'VOIDED' || paypalStatus === 'CANCELLED') {
                status = 'CANCELLED';
            }

            return c.json({ data: { status, paypalStatus } });
        }

        return c.json({ data: { status: 'PENDING' } });
    } catch (error) {
        console.error('Error checking payment status:', error);
        return c.json({ error: 'Failed to check payment status' }, 500);
    }
});

export default publisherSubscriptionRoutes;
