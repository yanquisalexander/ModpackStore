import { PublisherSubscription, SubscriptionTier, PaymentProvider, SubscriptionStatus } from "@/entities/PublisherSubscription";
import { PublisherSubscriptionFeature, FeatureKey, FeatureValue } from "@/entities/PublisherSubscriptionFeature";
import { Publisher } from "@/entities/Publisher";
import { APIError } from "@/lib/APIError";
import { In, IsNull, LessThan, MoreThan } from "typeorm";

interface CreateSubscriptionParams {
    publisherId: string;
    tier: SubscriptionTier;
    paymentProvider?: PaymentProvider;
    paymentReference?: string;
    amount?: string;
    currency?: string;
    durationDays?: number;
    autoRenew?: boolean;
}

interface SubscriptionFeatures {
    can_use_whitelist: boolean;
    whitelist_max_players_per_modpack: number;
    max_members: number;
    max_modpacks: number;
    storage_limit_mb: number;
    custom_branding: boolean;
    priority_support: boolean;
    analytics_access: boolean;
    featured_modpacks: number;
    custom_categories: boolean;
}

export class PublisherSubscriptionService {
    // Default feature values by tier
    private static readonly TIER_FEATURES: Record<SubscriptionTier, Partial<SubscriptionFeatures>> = {
        [SubscriptionTier.FREE]: {
            can_use_whitelist: false,
            whitelist_max_players_per_modpack: 0,
            max_members: 3,
            max_modpacks: 5,
            storage_limit_mb: 512,
            custom_branding: false,
            priority_support: false,
            analytics_access: false,
            featured_modpacks: 0,
            custom_categories: false,
        },
        [SubscriptionTier.BASIC]: {
            can_use_whitelist: true,
            whitelist_max_players_per_modpack: 50,
            max_members: 10,
            max_modpacks: 20,
            storage_limit_mb: 2048,
            custom_branding: false,
            priority_support: false,
            analytics_access: true,
            featured_modpacks: 1,
            custom_categories: false,
        },
        [SubscriptionTier.PREMIUM]: {
            can_use_whitelist: true,
            whitelist_max_players_per_modpack: 200,
            max_members: 25,
            max_modpacks: 100,
            storage_limit_mb: 10240,
            custom_branding: true,
            priority_support: true,
            analytics_access: true,
            featured_modpacks: 3,
            custom_categories: true,
        },
        [SubscriptionTier.ENTERPRISE]: {
            can_use_whitelist: true,
            whitelist_max_players_per_modpack: 1000,
            max_members: 100,
            max_modpacks: -1, // Unlimited
            storage_limit_mb: 51200,
            custom_branding: true,
            priority_support: true,
            analytics_access: true,
            featured_modpacks: 10,
            custom_categories: true,
        },
    };

    /**
     * Create a new subscription for a publisher
     */
    static async createSubscription(params: CreateSubscriptionParams): Promise<PublisherSubscription> {
        // Verify publisher exists
        const publisher = await Publisher.findOne({ where: { id: params.publisherId } });
        if (!publisher) {
            throw new APIError(404, 'Publisher not found');
        }

        // Check if publisher already has an active subscription
        const existingActive = await PublisherSubscription.findOne({
            where: {
                publisherId: params.publisherId,
                status: SubscriptionStatus.ACTIVE
            }
        });

        if (existingActive && existingActive.isActive()) {
            // Cancel existing subscription before creating new one
            await this.cancelSubscription(existingActive.id);
        }

        // Create subscription
        const subscription = new PublisherSubscription();
        subscription.publisherId = params.publisherId;
        subscription.tier = params.tier;
        subscription.status = SubscriptionStatus.ACTIVE;
        subscription.paymentProvider = params.paymentProvider || null;
        subscription.paymentReference = params.paymentReference || null;
        subscription.amount = params.amount || null;
        subscription.currency = params.currency || 'USD';
        subscription.autoRenew = params.autoRenew || false;
        subscription.lastPaymentAt = new Date();

        // Set expiration date if duration is provided
        if (params.durationDays && params.durationDays > 0) {
            const expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + params.durationDays);
            subscription.subscriptionExpiresAt = expiryDate;
        }

        await subscription.save();

        // Apply default features for the tier
        await this.applyTierFeatures(subscription.id, params.tier);

        return subscription;
    }

    /**
     * Apply default features for a tier to a subscription
     */
    static async applyTierFeatures(subscriptionId: string, tier: SubscriptionTier): Promise<void> {
        const features = this.TIER_FEATURES[tier];
        
        for (const [key, value] of Object.entries(features)) {
            const feature = PublisherSubscriptionFeature.fromValue(
                key as FeatureKey,
                value,
                subscriptionId,
                false
            );
            await feature.save();
        }
    }

    /**
     * Get active subscription for a publisher
     */
    static async getActiveSubscription(publisherId: string): Promise<PublisherSubscription | null> {
        const subscription = await PublisherSubscription.findOne({
            where: {
                publisherId,
                status: SubscriptionStatus.ACTIVE
            },
            relations: ['features']
        });

        if (!subscription) {
            return null;
        }

        // Check if subscription is expired
        if (subscription.isExpired()) {
            await this.expireSubscription(subscription.id);
            return null;
        }

        return subscription;
    }

    /**
     * Get all subscriptions for a publisher
     */
    static async getPublisherSubscriptions(publisherId: string): Promise<PublisherSubscription[]> {
        return await PublisherSubscription.find({
            where: { publisherId },
            relations: ['features'],
            order: { createdAt: 'DESC' }
        });
    }

    /**
     * Renew a subscription
     */
    static async renewSubscription(
        subscriptionId: string,
        durationDays: number,
        paymentReference?: string,
        amount?: string
    ): Promise<PublisherSubscription> {
        const subscription = await PublisherSubscription.findOne({
            where: { id: subscriptionId }
        });

        if (!subscription) {
            throw new APIError(404, 'Subscription not found');
        }

        // Update expiration date
        const currentExpiry = subscription.subscriptionExpiresAt || new Date();
        const newExpiry = new Date(currentExpiry);
        
        // If subscription is already expired, start from now
        if (new Date() > currentExpiry) {
            newExpiry.setTime(new Date().getTime());
        }
        
        newExpiry.setDate(newExpiry.getDate() + durationDays);
        
        subscription.subscriptionExpiresAt = newExpiry;
        subscription.status = SubscriptionStatus.ACTIVE;
        subscription.lastPaymentAt = new Date();
        
        if (paymentReference) {
            subscription.paymentReference = paymentReference;
        }
        if (amount) {
            subscription.amount = amount;
        }

        await subscription.save();

        return subscription;
    }

    /**
     * Cancel a subscription
     */
    static async cancelSubscription(subscriptionId: string): Promise<PublisherSubscription> {
        const subscription = await PublisherSubscription.findOne({
            where: { id: subscriptionId }
        });

        if (!subscription) {
            throw new APIError(404, 'Subscription not found');
        }

        subscription.status = SubscriptionStatus.CANCELLED;
        subscription.cancelledAt = new Date();
        subscription.autoRenew = false;

        await subscription.save();

        return subscription;
    }

    /**
     * Expire a subscription
     */
    static async expireSubscription(subscriptionId: string): Promise<void> {
        const subscription = await PublisherSubscription.findOne({
            where: { id: subscriptionId }
        });

        if (!subscription) {
            return;
        }

        subscription.status = SubscriptionStatus.EXPIRED;
        await subscription.save();
    }

    /**
     * Check if publisher has a specific feature
     */
    static async hasFeature(publisherId: string, featureKey: FeatureKey): Promise<boolean> {
        const subscription = await this.getActiveSubscription(publisherId);
        
        if (!subscription) {
            // No active subscription, return free tier feature
            const freeFeatures = this.TIER_FEATURES[SubscriptionTier.FREE];
            const featureValue = freeFeatures[featureKey as keyof typeof freeFeatures];
            return typeof featureValue === 'boolean' ? featureValue : false;
        }

        const feature = subscription.features.find(f => f.featureKey === featureKey);
        
        if (!feature) {
            return false;
        }

        return feature.getValueAsBoolean();
    }

    /**
     * Get feature value for a publisher
     */
    static async getFeatureValue(publisherId: string, featureKey: FeatureKey): Promise<FeatureValue> {
        const subscription = await this.getActiveSubscription(publisherId);
        
        if (!subscription) {
            // No active subscription, return free tier feature
            const freeFeatures = this.TIER_FEATURES[SubscriptionTier.FREE];
            return freeFeatures[featureKey as keyof typeof freeFeatures] || false;
        }

        const feature = subscription.features.find(f => f.featureKey === featureKey);
        
        if (!feature) {
            // Feature not found, check tier defaults
            const tierFeatures = this.TIER_FEATURES[subscription.tier];
            return tierFeatures[featureKey as keyof typeof tierFeatures] || false;
        }

        return feature.getValue();
    }

    /**
     * Get all features for a publisher
     */
    static async getPublisherFeatures(publisherId: string): Promise<Record<string, FeatureValue>> {
        const subscription = await this.getActiveSubscription(publisherId);
        
        if (!subscription) {
            return this.TIER_FEATURES[SubscriptionTier.FREE] as Record<string, FeatureValue>;
        }

        const features: Record<string, FeatureValue> = {};
        
        for (const feature of subscription.features) {
            features[feature.featureKey] = feature.getValue();
        }

        return features;
    }

    /**
     * Override a feature for a publisher (admin only)
     */
    static async overrideFeature(
        publisherId: string,
        featureKey: FeatureKey,
        value: FeatureValue
    ): Promise<PublisherSubscriptionFeature> {
        let subscription = await this.getActiveSubscription(publisherId);
        
        if (!subscription) {
            // Create a free subscription if none exists
            subscription = await this.createSubscription({
                publisherId,
                tier: SubscriptionTier.FREE
            });
        }

        // Check if feature already exists
        let feature = subscription.features.find(f => f.featureKey === featureKey);
        
        if (feature) {
            feature.featureValue = String(value);
            feature.isOverride = true;
            await feature.save();
        } else {
            feature = PublisherSubscriptionFeature.fromValue(
                featureKey,
                value,
                subscription.id,
                true
            );
            await feature.save();
        }

        return feature;
    }

    /**
     * Remove feature override (admin only)
     */
    static async removeFeatureOverride(
        publisherId: string,
        featureKey: FeatureKey
    ): Promise<void> {
        const subscription = await this.getActiveSubscription(publisherId);
        
        if (!subscription) {
            return;
        }

        const feature = subscription.features.find(
            f => f.featureKey === featureKey && f.isOverride
        );
        
        if (feature) {
            await feature.remove();
        }
    }

    /**
     * Process expired subscriptions (cron job)
     */
    static async processExpiredSubscriptions(): Promise<number> {
        const expiredSubscriptions = await PublisherSubscription.find({
            where: {
                status: SubscriptionStatus.ACTIVE,
                subscriptionExpiresAt: LessThan(new Date())
            }
        });

        for (const subscription of expiredSubscriptions) {
            await this.expireSubscription(subscription.id);
        }

        return expiredSubscriptions.length;
    }

    /**
     * Get subscription statistics
     */
    static async getSubscriptionStats(): Promise<{
        total: number;
        active: number;
        expired: number;
        cancelled: number;
        byTier: Record<SubscriptionTier, number>;
    }> {
        const all = await PublisherSubscription.find();
        
        const stats = {
            total: all.length,
            active: 0,
            expired: 0,
            cancelled: 0,
            byTier: {
                [SubscriptionTier.FREE]: 0,
                [SubscriptionTier.BASIC]: 0,
                [SubscriptionTier.PREMIUM]: 0,
                [SubscriptionTier.ENTERPRISE]: 0,
            }
        };

        for (const sub of all) {
            if (sub.status === SubscriptionStatus.ACTIVE) stats.active++;
            if (sub.status === SubscriptionStatus.EXPIRED) stats.expired++;
            if (sub.status === SubscriptionStatus.CANCELLED) stats.cancelled++;
            
            stats.byTier[sub.tier]++;
        }

        return stats;
    }

    /**
     * Validate if publisher can use whitelist feature
     */
    static async canUseWhitelist(publisherId: string): Promise<boolean> {
        return await this.hasFeature(publisherId, FeatureKey.CAN_USE_WHITELIST);
    }

    /**
     * Get max whitelist players for publisher
     */
    static async getMaxWhitelistPlayers(publisherId: string): Promise<number> {
        const value = await this.getFeatureValue(
            publisherId,
            FeatureKey.WHITELIST_MAX_PLAYERS_PER_MODPACK
        );
        return typeof value === 'number' ? value : 0;
    }
}
