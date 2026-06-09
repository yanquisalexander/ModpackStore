import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, BaseEntity, OneToMany } from "typeorm";
import { Publisher } from "./Publisher";
import { PublisherSubscriptionFeature } from "./PublisherSubscriptionFeature";

export enum SubscriptionTier {
    FREE = 'free',
    BASIC = 'basic',
    PREMIUM = 'premium',
    ENTERPRISE = 'enterprise'
}

export enum PaymentProvider {
    PAYPAL = 'paypal',
    MERCADOPAGO = 'mercadopago',
    MANUAL = 'manual'
}

export enum SubscriptionStatus {
    ACTIVE = 'active',
    PENDING = 'pending',
    EXPIRED = 'expired',
    CANCELLED = 'cancelled',
    SUSPENDED = 'suspended'
}

@Entity({ name: "publisher_subscriptions" })
export class PublisherSubscription extends BaseEntity {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column({ name: "publisher_id", type: "uuid" })
    publisherId: string;

    @Column({
        name: "tier",
        type: "enum",
        enum: SubscriptionTier,
        default: SubscriptionTier.FREE
    })
    tier: SubscriptionTier;

    @Column({
        name: "status",
        type: "enum",
        enum: SubscriptionStatus,
        default: SubscriptionStatus.ACTIVE
    })
    status: SubscriptionStatus;

    @Column({ name: "subscription_expires_at", type: "timestamp", nullable: true })
    subscriptionExpiresAt?: Date | null;

    @Column({
        name: "payment_provider",
        type: "enum",
        enum: PaymentProvider,
        nullable: true
    })
    paymentProvider?: PaymentProvider | null;

    @Column({ name: "payment_reference", type: "text", nullable: true })
    paymentReference?: string | null;

    @Column({ name: "amount", type: "decimal", precision: 10, scale: 2, nullable: true })
    amount?: string | null;

    @Column({ name: "currency", type: "varchar", length: 3, default: "USD" })
    currency: string;

    @Column({ name: "auto_renew", type: "boolean", default: false })
    autoRenew: boolean;

    @Column({ name: "cancelled_at", type: "timestamp", nullable: true })
    cancelledAt?: Date | null;

    @Column({ name: "last_payment_at", type: "timestamp", nullable: true })
    lastPaymentAt?: Date | null;

    @Column({ name: "is_admin_override", type: "boolean", default: false })
    isAdminOverride: boolean;

    @CreateDateColumn({ name: "created_at" })
    createdAt: Date;

    @UpdateDateColumn({ name: "updated_at" })
    updatedAt: Date;

    // Relations
    @ManyToOne(() => Publisher, publisher => publisher.subscriptions, { onDelete: "CASCADE" })
    @JoinColumn({ name: "publisher_id" })
    publisher: Publisher;

    @OneToMany(() => PublisherSubscriptionFeature, feature => feature.subscription, { cascade: true })
    features: PublisherSubscriptionFeature[];

    // Helper methods
    isActive(): boolean {
        if (this.isAdminOverride) {
            return true;
        }

        if (this.status !== SubscriptionStatus.ACTIVE) {
            return false;
        }

        if (this.subscriptionExpiresAt && new Date() > this.subscriptionExpiresAt) {
            return false;
        }

        return true;
    }

    isExpired(): boolean {
        return this.subscriptionExpiresAt !== null &&
            this.subscriptionExpiresAt !== undefined &&
            new Date() > this.subscriptionExpiresAt;
    }

    daysUntilExpiry(): number | null {
        if (!this.subscriptionExpiresAt) {
            return null;
        }

        const now = new Date();
        const expiry = new Date(this.subscriptionExpiresAt);
        const diffTime = expiry.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        return diffDays;
    }
}
