import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { requireAuth } from '@/middlewares/auth.middleware';
import { requireRole } from '@/middlewares/role.middleware';
import { UserRole } from '@/types/enums';
import { PublisherSubscriptionService } from '@/services/publisher-subscription.service';
import { PublisherSubscription, SubscriptionTier, PaymentProvider } from '@/entities/PublisherSubscription';
import { FeatureKey } from '@/entities/PublisherSubscriptionFeature';
import { Publisher } from '@/entities/Publisher';

const subscriptionsRoute = new Hono();

// Apply authentication and admin role requirement to all routes
subscriptionsRoute.use('*', requireAuth);
subscriptionsRoute.use('*', requireRole([UserRole.ADMIN, UserRole.SUPERADMIN]));

// Validation schemas
const createSubscriptionSchema = z.object({
    publisherId: z.string().uuid(),
    tier: z.nativeEnum(SubscriptionTier),
    paymentProvider: z.nativeEnum(PaymentProvider).optional(),
    paymentReference: z.string().optional(),
    amount: z.string().optional(),
    currency: z.string().length(3).default('USD'),
    durationDays: z.number().int().positive().optional(),
    autoRenew: z.boolean().default(false)
});

const renewSubscriptionSchema = z.object({
    durationDays: z.number().int().positive(),
    paymentReference: z.string().optional(),
    amount: z.string().optional()
});

const overrideFeatureSchema = z.object({
    featureKey: z.nativeEnum(FeatureKey),
    value: z.union([z.boolean(), z.number(), z.string()])
});

// Get all subscriptions with filters
subscriptionsRoute.get('/', async (c) => {
    try {
        const { status, tier, publisherId } = c.req.query();

        let query = PublisherSubscription.createQueryBuilder('subscription')
            .leftJoinAndSelect('subscription.publisher', 'publisher')
            .leftJoinAndSelect('subscription.features', 'features')
            .orderBy('subscription.createdAt', 'DESC');

        if (status) {
            query = query.andWhere('subscription.status = :status', { status });
        }

        if (tier) {
            query = query.andWhere('subscription.tier = :tier', { tier });
        }

        if (publisherId) {
            query = query.andWhere('subscription.publisherId = :publisherId', { publisherId });
        }

        const subscriptions = await query.getMany();

        return c.json({
            data: subscriptions.map(sub => ({
                id: sub.id,
                publisher: {
                    id: sub.publisher.id,
                    name: sub.publisher.publisherName
                },
                tier: sub.tier,
                status: sub.status,
                expiresAt: sub.subscriptionExpiresAt,
                isActive: sub.isActive(),
                daysUntilExpiry: sub.daysUntilExpiry(),
                paymentProvider: sub.paymentProvider,
                amount: sub.amount,
                currency: sub.currency,
                autoRenew: sub.autoRenew,
                isAdminOverride: sub.isAdminOverride,
                features: sub.features.map(f => ({
                    key: f.featureKey,
                    value: f.getValue(),
                    isOverride: f.isOverride
                })),
                createdAt: sub.createdAt,
                updatedAt: sub.updatedAt
            }))
        });
    } catch (error) {
        console.error('Error fetching subscriptions:', error);
        return c.json({ error: 'Failed to fetch subscriptions' }, 500);
    }
});

// Set admin override for a publisher
subscriptionsRoute.post(
    '/publisher/:publisherId/set-override',
    zValidator('json', z.object({ override: z.boolean() })),
    async (c) => {
        try {
            const { publisherId } = c.req.param();
            const { override } = c.req.valid('json');

            const subscription = await PublisherSubscriptionService.setAdminOverride(
                publisherId,
                override
            );

            return c.json({
                message: 'Admin override set successfully',
                data: {
                    isAdminOverride: subscription.isAdminOverride
                }
            });
        } catch (error) {
            console.error('Error setting admin override:', error);
            const message = error instanceof Error ? error.message : 'Failed to set admin override';
            return c.json({ error: message }, 400);
        }
    }
);

// Get subscription statistics
subscriptionsRoute.get('/stats', async (c) => {
    try {
        const stats = await PublisherSubscriptionService.getSubscriptionStats();
        return c.json({ data: stats });
    } catch (error) {
        console.error('Error fetching subscription stats:', error);
        return c.json({ error: 'Failed to fetch subscription statistics' }, 500);
    }
});

// Get subscription by ID
subscriptionsRoute.get('/:id', async (c) => {
    try {
        const { id } = c.req.param();

        const subscription = await PublisherSubscription.findOne({
            where: { id },
            relations: ['publisher', 'features']
        });

        if (!subscription) {
            return c.json({ error: 'Subscription not found' }, 404);
        }

        return c.json({
            data: {
                id: subscription.id,
                publisher: {
                    id: subscription.publisher.id,
                    name: subscription.publisher.publisherName
                },
                tier: subscription.tier,
                status: subscription.status,
                expiresAt: subscription.subscriptionExpiresAt,
                isActive: subscription.isActive(),
                daysUntilExpiry: subscription.daysUntilExpiry(),
                paymentProvider: subscription.paymentProvider,
                paymentReference: subscription.paymentReference,
                amount: subscription.amount,
                currency: subscription.currency,
                autoRenew: subscription.autoRenew,
                lastPaymentAt: subscription.lastPaymentAt,
                cancelledAt: subscription.cancelledAt,
                features: subscription.features.map(f => ({
                    id: f.id,
                    key: f.featureKey,
                    value: f.getValue(),
                    isOverride: f.isOverride,
                    createdAt: f.createdAt
                })),
                createdAt: subscription.createdAt,
                updatedAt: subscription.updatedAt
            }
        });
    } catch (error) {
        console.error('Error fetching subscription:', error);
        return c.json({ error: 'Failed to fetch subscription' }, 500);
    }
});

// Get publisher's subscriptions
subscriptionsRoute.get('/publisher/:publisherId', async (c) => {
    try {
        const { publisherId } = c.req.param();

        const subscriptions = await PublisherSubscriptionService.getPublisherSubscriptions(publisherId);

        return c.json({
            data: subscriptions.map(sub => ({
                id: sub.id,
                tier: sub.tier,
                status: sub.status,
                expiresAt: sub.subscriptionExpiresAt,
                isActive: sub.isActive(),
                daysUntilExpiry: sub.daysUntilExpiry(),
                paymentProvider: sub.paymentProvider,
                amount: sub.amount,
                currency: sub.currency,
                autoRenew: sub.autoRenew,
                features: sub.features.map(f => ({
                    key: f.featureKey,
                    value: f.getValue(),
                    isOverride: f.isOverride
                })),
                createdAt: sub.createdAt
            }))
        });
    } catch (error) {
        console.error('Error fetching publisher subscriptions:', error);
        return c.json({ error: 'Failed to fetch publisher subscriptions' }, 500);
    }
});

// Create a new subscription
subscriptionsRoute.post('/', zValidator('json', createSubscriptionSchema), async (c) => {
    try {
        const data = c.req.valid('json');

        const subscription = await PublisherSubscriptionService.createSubscription(data);

        return c.json({
            message: 'Subscription created successfully',
            data: {
                id: subscription.id,
                tier: subscription.tier,
                status: subscription.status,
                expiresAt: subscription.subscriptionExpiresAt
            }
        }, 201);
    } catch (error) {
        console.error('Error creating subscription:', error);
        const message = error instanceof Error ? error.message : 'Failed to create subscription';
        return c.json({ error: message }, 400);
    }
});

// Renew a subscription
subscriptionsRoute.post('/:id/renew', zValidator('json', renewSubscriptionSchema), async (c) => {
    try {
        const { id } = c.req.param();
        const data = c.req.valid('json');

        const subscription = await PublisherSubscriptionService.renewSubscription(
            id,
            data.durationDays,
            data.paymentReference,
            data.amount
        );

        return c.json({
            message: 'Subscription renewed successfully',
            data: {
                id: subscription.id,
                expiresAt: subscription.subscriptionExpiresAt,
                daysUntilExpiry: subscription.daysUntilExpiry()
            }
        });
    } catch (error) {
        console.error('Error renewing subscription:', error);
        const message = error instanceof Error ? error.message : 'Failed to renew subscription';
        return c.json({ error: message }, 400);
    }
});

// Cancel a subscription
subscriptionsRoute.post('/:id/cancel', async (c) => {
    try {
        const { id } = c.req.param();

        const subscription = await PublisherSubscriptionService.cancelSubscription(id);

        return c.json({
            message: 'Subscription cancelled successfully',
            data: {
                id: subscription.id,
                status: subscription.status,
                cancelledAt: subscription.cancelledAt
            }
        });
    } catch (error) {
        console.error('Error cancelling subscription:', error);
        const message = error instanceof Error ? error.message : 'Failed to cancel subscription';
        return c.json({ error: message }, 400);
    }
});

// Override a feature for a publisher
subscriptionsRoute.post(
    '/publisher/:publisherId/features/override',
    zValidator('json', overrideFeatureSchema),
    async (c) => {
        try {
            const { publisherId } = c.req.param();
            const { featureKey, value } = c.req.valid('json');

            const feature = await PublisherSubscriptionService.overrideFeature(
                publisherId,
                featureKey,
                value
            );

            return c.json({
                message: 'Feature overridden successfully',
                data: {
                    featureKey: feature.featureKey,
                    value: feature.getValue(),
                    isOverride: feature.isOverride
                }
            });
        } catch (error) {
            console.error('Error overriding feature:', error);
            const message = error instanceof Error ? error.message : 'Failed to override feature';
            return c.json({ error: message }, 400);
        }
    }
);

// Remove feature override
subscriptionsRoute.delete(
    '/publisher/:publisherId/features/:featureKey/override',
    async (c) => {
        try {
            const { publisherId, featureKey } = c.req.param();

            await PublisherSubscriptionService.removeFeatureOverride(
                publisherId,
                featureKey as FeatureKey
            );

            return c.json({
                message: 'Feature override removed successfully'
            });
        } catch (error) {
            console.error('Error removing feature override:', error);
            const message = error instanceof Error ? error.message : 'Failed to remove feature override';
            return c.json({ error: message }, 400);
        }
    }
);

// Get publisher features
subscriptionsRoute.get('/publisher/:publisherId/features', async (c) => {
    try {
        const { publisherId } = c.req.param();

        const features = await PublisherSubscriptionService.getPublisherFeatures(publisherId);

        return c.json({ data: features });
    } catch (error) {
        console.error('Error fetching publisher features:', error);
        return c.json({ error: 'Failed to fetch publisher features' }, 500);
    }
});

// Process expired subscriptions (manual trigger for testing)
subscriptionsRoute.post('/process-expired', async (c) => {
    try {
        const count = await PublisherSubscriptionService.processExpiredSubscriptions();

        return c.json({
            message: 'Expired subscriptions processed successfully',
            data: { processedCount: count }
        });
    } catch (error) {
        console.error('Error processing expired subscriptions:', error);
        return c.json({ error: 'Failed to process expired subscriptions' }, 500);
    }
});

export default subscriptionsRoute;
