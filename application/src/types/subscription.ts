// Publisher Subscription Types
export enum SubscriptionTier {
    FREE = 'free',
    BASIC = 'basic',
    PREMIUM = 'premium',
    ENTERPRISE = 'enterprise'
}

export enum SubscriptionStatus {
    ACTIVE = 'active',
    EXPIRED = 'expired',
    CANCELLED = 'cancelled',
    SUSPENDED = 'suspended'
}

export enum PaymentProvider {
    PAYPAL = 'paypal',
    MERCADOPAGO = 'mercadopago',
    MANUAL = 'manual'
}

export enum FeatureKey {
    CAN_USE_WHITELIST = 'can_use_whitelist',
    WHITELIST_MAX_PLAYERS_PER_MODPACK = 'whitelist_max_players_per_modpack',
    MAX_MEMBERS = 'max_members',
    MAX_MODPACKS = 'max_modpacks',
    STORAGE_LIMIT_MB = 'storage_limit_mb',
    CUSTOM_BRANDING = 'custom_branding',
    PRIORITY_SUPPORT = 'priority_support',
    ANALYTICS_ACCESS = 'analytics_access',
    FEATURED_MODPACKS = 'featured_modpacks',
    CUSTOM_CATEGORIES = 'custom_categories'
}

export interface SubscriptionFeature {
    key: FeatureKey;
    value: boolean | number | string;
    isOverride: boolean;
}

export interface PublisherSubscription {
    id: string;
    publisher: {
        id: string;
        name: string;
    };
    tier: SubscriptionTier;
    status: SubscriptionStatus;
    expiresAt?: Date | null;
    isActive: boolean;
    daysUntilExpiry?: number | null;
    paymentProvider?: PaymentProvider | null;
    amount?: string | null;
    currency: string;
    autoRenew: boolean;
    features: SubscriptionFeature[];
    createdAt: Date;
    updatedAt: Date;
}

export interface SubscriptionStats {
    totalSubscriptions: number;
    activeSubscriptions: number;
    expiredSubscriptions: number;
    byTier: {
        [key in SubscriptionTier]: number;
    };
}

export interface CreateSubscriptionData {
    publisherId: string;
    tier: SubscriptionTier;
    paymentProvider?: PaymentProvider;
    paymentReference?: string;
    amount?: string;
    currency?: string;
    durationDays?: number;
    autoRenew?: boolean;
}

export interface TierFeatures {
    canUseWhitelist: boolean;
    whitelistMaxPlayers: number;
    maxMembers: number;
    maxModpacks: number;
    storageLimitMB: number;
    customBranding: boolean;
    prioritySupport: boolean;
    analyticsAccess: boolean;
    featuredModpacks: number;
    customCategories: boolean;
}

// Default features per tier based on backend implementation
export const TIER_DEFAULTS: Record<SubscriptionTier, TierFeatures> = {
    [SubscriptionTier.FREE]: {
        canUseWhitelist: false,
        whitelistMaxPlayers: 0,
        maxMembers: 3,
        maxModpacks: 5,
        storageLimitMB: 512,
        customBranding: false,
        prioritySupport: false,
        analyticsAccess: false,
        featuredModpacks: 0,
        customCategories: false
    },
    [SubscriptionTier.BASIC]: {
        canUseWhitelist: true,
        whitelistMaxPlayers: 50,
        maxMembers: 10,
        maxModpacks: 20,
        storageLimitMB: 2048,
        customBranding: false,
        prioritySupport: false,
        analyticsAccess: true,
        featuredModpacks: 0,
        customCategories: false
    },
    [SubscriptionTier.PREMIUM]: {
        canUseWhitelist: true,
        whitelistMaxPlayers: 200,
        maxMembers: 25,
        maxModpacks: 100,
        storageLimitMB: 10240,
        customBranding: true,
        prioritySupport: true,
        analyticsAccess: true,
        featuredModpacks: 3,
        customCategories: false
    },
    [SubscriptionTier.ENTERPRISE]: {
        canUseWhitelist: true,
        whitelistMaxPlayers: 1000,
        maxMembers: 100,
        maxModpacks: -1, // unlimited
        storageLimitMB: 51200,
        customBranding: true,
        prioritySupport: true,
        analyticsAccess: true,
        featuredModpacks: 10,
        customCategories: true
    }
};

export const TIER_PRICES: Record<SubscriptionTier, { monthly: string; yearly: string }> = {
    [SubscriptionTier.FREE]: { monthly: '0', yearly: '0' },
    [SubscriptionTier.BASIC]: { monthly: '4.99', yearly: '49.99' },
    [SubscriptionTier.PREMIUM]: { monthly: '14.99', yearly: '149.99' },
    [SubscriptionTier.ENTERPRISE]: { monthly: '49.99', yearly: '499.99' }
};
