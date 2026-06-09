import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, BaseEntity } from "typeorm";
import { PublisherSubscription } from "./PublisherSubscription";

export enum FeatureKey {
    // Whitelist features
    CAN_USE_WHITELIST = 'can_use_whitelist',
    WHITELIST_MAX_PLAYERS_PER_MODPACK = 'whitelist_max_players_per_modpack',

    // Organization features
    MAX_MEMBERS = 'max_members',
    MAX_MODPACKS = 'max_modpacks',

    // Storage features
    STORAGE_LIMIT_MB = 'storage_limit_mb',

    // Advanced features
    CUSTOM_BRANDING = 'custom_branding',
    PRIORITY_SUPPORT = 'priority_support',
    ANALYTICS_ACCESS = 'analytics_access',

    // Content features
    FEATURED_MODPACKS = 'featured_modpacks',
    CUSTOM_CATEGORIES = 'custom_categories'
}

export type FeatureValue = boolean | number | string;

@Entity({ name: "publisher_subscription_features" })
export class PublisherSubscriptionFeature extends BaseEntity {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column({ name: "subscription_id", type: "uuid" })
    subscriptionId: string;

    @Column({
        name: "feature_key",
        type: "enum",
        enum: FeatureKey
    })
    featureKey: FeatureKey;

    @Column({ name: "feature_value", type: "text" })
    featureValue: string; // Stored as string, parsed based on feature type

    @Column({ name: "is_override", type: "boolean", default: false })
    isOverride: boolean; // Admin manual override

    @CreateDateColumn({ name: "created_at" })
    createdAt: Date;

    @UpdateDateColumn({ name: "updated_at" })
    updatedAt: Date;

    // Relations
    @ManyToOne(() => PublisherSubscription, subscription => subscription.features, { onDelete: "CASCADE" })
    @JoinColumn({ name: "subscription_id" })
    subscription: PublisherSubscription;

    // Helper methods to parse feature values
    getValueAsBoolean(): boolean {
        return this.featureValue === 'true';
    }

    getValueAsNumber(): number {
        return parseInt(this.featureValue, 10);
    }

    getValueAsString(): string {
        return this.featureValue;
    }

    getValue(): FeatureValue {
        // Try to parse as boolean
        if (this.featureValue === 'true') return true;
        if (this.featureValue === 'false') return false;

        // Try to parse as number
        const numValue = Number(this.featureValue);
        if (!isNaN(numValue)) return numValue;

        // Return as string
        return this.featureValue;
    }

    static fromValue(featureKey: FeatureKey, value: FeatureValue, subscriptionId: string, isOverride: boolean = false): PublisherSubscriptionFeature {
        const feature = new PublisherSubscriptionFeature();
        feature.subscriptionId = subscriptionId;
        feature.featureKey = featureKey;
        feature.featureValue = String(value);
        feature.isOverride = isOverride;
        return feature;
    }
}
