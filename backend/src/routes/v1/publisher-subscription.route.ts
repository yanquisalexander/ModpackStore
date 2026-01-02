import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { requireAuth, AuthVariables } from '@/middlewares/auth.middleware';
import { PublisherSubscriptionService } from '@/services/publisher-subscription.service';
import { SubscriptionTier, PaymentProvider, SubscriptionStatus } from '@/entities/PublisherSubscription';
import { MercadoPagoGateway } from '@/services/payment-gateways/mercadopago.gateway';

// Validation schemas
const createOrderSchema = z.object({
    tier: z.nativeEnum(SubscriptionTier),
});

const publisherSubscriptionRoutes = new Hono<{ Variables: AuthVariables }>();

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
                isAdminOverride: subscription.isAdminOverride,
                features: subscription.features?.map(f => ({
                    key: f.featureKey,
                    value: f.getValue(),
                    isOverride: f.isOverride
                })) || []
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

// Create Mercado Pago Subscription
publisherSubscriptionRoutes.post('/:publisherId/subscription/mercadopago', zValidator('json', createOrderSchema), async (c) => {
    try {
        const { publisherId } = c.req.param();
        const { tier } = c.req.valid('json');
        const user = c.get('user') as any;

        if (tier === SubscriptionTier.FREE) {
            const sub = await PublisherSubscriptionService.createSubscription({
                publisherId,
                tier: SubscriptionTier.FREE
            });
            return c.json({ data: { subscriptionId: sub.id, free: true } });
        }

        // Get amount based on tier
        let amount = '0.00';
        let description = '';
        switch (tier) {
            case SubscriptionTier.BASIC:
                amount = process.env.PRICE_BASIC || '5.00';
                description = 'ModpackStore Basic Plan';
                break;
            case SubscriptionTier.PREMIUM:
                amount = process.env.PRICE_PREMIUM || '15.00';
                description = 'ModpackStore Premium Plan';
                break;
            case SubscriptionTier.ENTERPRISE:
                amount = process.env.PRICE_ENTERPRISE || '50.00';
                description = 'ModpackStore Enterprise Plan';
                break;
        }

        const mpGateway = new MercadoPagoGateway();
        // Do NOT require app-level email; let Mercado Pago handle buyer authentication.
        const response = await mpGateway.createSubscription({
            amount,
            currency: process.env.MERCADOPAGO_CURRENCY || 'UYU',
            description,
            publisherId,
            tier,
            payerEmail: undefined as any,
            backUrl: process.env.MERCADOPAGO_BACK_URL || 'https://modpackstore.com/publisher/subscription/success'
        });

        // Create local subscription in pending state. The frontend must redirect the user
        // to MercadoPago using the returned preapproval plan ID / approvalUrl to complete approval.
        const localSub = await PublisherSubscriptionService.createSubscription({
            publisherId,
            tier,
            paymentProvider: PaymentProvider.MERCADOPAGO,
            paymentReference: response.paymentId,
            amount,
            currency: process.env.MERCADOPAGO_CURRENCY || 'UYU',
            autoRenew: true,
            status: SubscriptionStatus.PENDING
        });

        return c.json({
            subscriptionId: localSub.id,
            approvalUrl: response.approvalUrl,
            preapprovalPlanId: response.paymentId,
            note: 'Redirect the user to `approvalUrl` so they can authenticate on Mercado Pago and approve the subscription.'
        });

    } catch (error) {
        console.error('Error creating Mercado Pago subscription:', error);
        return c.json({ error: 'Failed to create subscription' }, 500);
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

        // Mercado Pago subscriptions are usually cancelled via the preapproval ID
        // For now, we just cancel locally. In a real scenario, we'd call MP API.

        await PublisherSubscriptionService.cancelSubscription(subscription.id);

        return c.json({ message: 'Subscription cancelled successfully' });
    } catch (error) {
        console.error('Error cancelling subscription:', error);
        return c.json({ error: 'Failed to cancel subscription' }, 500);
    }
});

// Admin: Override feature
publisherSubscriptionRoutes.post('/:publisherId/subscription/admin/override-feature', async (c) => {
    try {
        // TODO: Add admin check middleware
        const { publisherId } = c.req.param();
        const { featureKey, value } = await c.req.json();

        const feature = await PublisherSubscriptionService.overrideFeature(publisherId, featureKey, value);
        return c.json({ data: feature });
    } catch (error) {
        console.error('Error overriding feature:', error);
        return c.json({ error: 'Failed to override feature' }, 500);
    }
});

// Admin: Set admin override
publisherSubscriptionRoutes.post('/:publisherId/subscription/admin/set-override', async (c) => {
    try {
        // TODO: Add admin check middleware
        const { publisherId } = c.req.param();
        const { override } = await c.req.json();

        const subscription = await PublisherSubscriptionService.setAdminOverride(publisherId, override);
        return c.json({ data: subscription });
    } catch (error) {
        console.error('Error setting admin override:', error);
        return c.json({ error: 'Failed to set admin override' }, 500);
    }
});

export default publisherSubscriptionRoutes;
