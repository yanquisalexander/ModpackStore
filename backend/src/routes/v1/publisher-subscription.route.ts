import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { requireAuth } from '@/middlewares/auth.middleware';
import { PublisherSubscriptionService } from '@/services/publisher-subscription.service';
import { SubscriptionTier, PaymentProvider } from '@/entities/PublisherSubscription';
import { ordersController, subscriptionsController } from '@/lib/paypal';

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

// Create PayPal Subscription
publisherSubscriptionRoutes.post('/:publisherId/subscription/order', zValidator('json', createOrderSchema), async (c) => {
    try {
        const { publisherId } = c.req.param();
        const { tier } = c.req.valid('json');

        if (tier === SubscriptionTier.FREE) {
            const sub = await PublisherSubscriptionService.createSubscription({
                publisherId,
                tier: SubscriptionTier.FREE
            });
            return c.json({ data: { subscriptionId: sub.id, free: true } });
        }

        // Get Plan ID from env
        let planId = '';
        switch (tier) {
            case SubscriptionTier.BASIC: planId = process.env.PAYPAL_PLAN_ID_BASIC || ''; break;
            case SubscriptionTier.PREMIUM: planId = process.env.PAYPAL_PLAN_ID_PREMIUM || ''; break;
            case SubscriptionTier.ENTERPRISE: planId = process.env.PAYPAL_PLAN_ID_ENTERPRISE || ''; break;
        }

        if (!planId) {
            console.error(`Missing PayPal Plan ID for tier ${tier}`);
            return c.json({ error: 'Configuration error: Missing Plan ID' }, 500);
        }

        const collect = {
            body: {
                planId: planId,
                customId: publisherId, // Store publisherId in custom_id for reference
                applicationContext: {
                    userAction: 'SUBSCRIBE_NOW',
                    returnUrl: 'https://example.com/return', // Frontend handles the return via popup, but this is required
                    cancelUrl: 'https://example.com/cancel'
                }
            }
        };

        const { result } = await subscriptionsController.subscriptionsCreate(collect);

        // Find approval URL
        const approvalLink = result.links?.find((link: any) => link.rel === 'approve');
        if (!approvalLink) {
            console.error('No approval link found in PayPal response', result);
            return c.json({ error: 'Failed to get approval URL' }, 500);
        }

        return c.json({ orderId: result.id, approvalUrl: approvalLink.href });

    } catch (error) {
        console.error('Error creating PayPal subscription:', error);
        return c.json({ error: 'Failed to create subscription' }, 500);
    }
});

// Activate/Check PayPal Subscription
const activateSubscriptionSchema = z.object({
    subscriptionId: z.string(),
    tier: z.nativeEnum(SubscriptionTier),
});

publisherSubscriptionRoutes.post('/:publisherId/subscription/capture', zValidator('json', activateSubscriptionSchema), async (c) => {
    try {
        const { publisherId } = c.req.param();
        const { subscriptionId, tier } = c.req.valid('json');

        // Verify status with PayPal
        const { result } = await subscriptionsController.subscriptionsGet({ id: subscriptionId });

        if (result.status === 'ACTIVE') {
            const subscription = await PublisherSubscriptionService.createSubscription({
                publisherId,
                tier,
                paymentProvider: PaymentProvider.PAYPAL,
                paymentReference: subscriptionId,
                amount: result.billingInfo?.lastPayment?.amount?.value || '0.00', // Best effort to get amount
                currency: result.billingInfo?.lastPayment?.amount?.currencyCode || 'USD',
                durationDays: 30, // Monthly
                autoRenew: true
            });

            return c.json({
                message: 'Subscription activated successfully',
                data: { subscriptionId: subscription.id }
            });
        } else {
            return c.json({ error: `Subscription status is ${result.status}` }, 400);
        }

    } catch (error) {
        console.error('Error activating PayPal subscription:', error);
        return c.json({ error: 'Failed to activate subscription' }, 500);
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

        // If PayPal, cancel on PayPal side too
        if (subscription.paymentProvider === PaymentProvider.PAYPAL && subscription.paymentReference) {
            try {
                await subscriptionsController.subscriptionsCancel({
                    id: subscription.paymentReference,
                    reason: 'User requested cancellation' // Note: verify signature, usually body/reason
                });
            } catch (ppError) {
                console.error('Error cancelling PayPal subscription:', ppError);
                // Continue to cancel locally even if PayPal fails (maybe already cancelled)
            }
        }

        await PublisherSubscriptionService.cancelSubscription(subscription.id);

        return c.json({ message: 'Subscription cancelled successfully' });
    } catch (error) {
        console.error('Error cancelling subscription:', error);
        return c.json({ error: 'Failed to cancel subscription' }, 500);
    }
});

// Get PayPal approval URL - No longer needed as it is returned in create, but keeping for backward compat if needed or just error
publisherSubscriptionRoutes.get('/subscription/paypal/approval/:orderId', async (c) => {
    return c.json({ error: 'Use create endpoint response' }, 400);
});

// Check payment status
publisherSubscriptionRoutes.get('/subscription/paypal/status/:orderId', async (c) => {
    try {
        const { orderId } = c.req.param(); // In this context orderId is subscriptionId

        const { result } = await subscriptionsController.subscriptionsGet({ id: orderId });

        if (result) {
            const paypalStatus = result.status;
            // Map PayPal status
            // ACTIVE, APPROVAL_PENDING, APPROVED, SUSPENDED, CANCELLED, EXPIRED

            return c.json({ data: { status: paypalStatus, paypalStatus } });
        }

        return c.json({ data: { status: 'PENDING' } });
    } catch (error) {
        console.error('Error checking subscription status:', error);
        return c.json({ error: 'Failed to check status' }, 500);
    }
});

export default publisherSubscriptionRoutes;
