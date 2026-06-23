import { API_ENDPOINT } from '@/consts';
import {
    PublisherSubscription,
    SubscriptionStats,
    CreateSubscriptionData,
    FeatureKey
} from '@/types/subscription';

class SubscriptionService {
    private get baseUrl() { return `${API_ENDPOINT}/admin/subscriptions`; }
    private get publisherBaseUrl() { return `${API_ENDPOINT}/publishers`; }

    /**
     * Get subscription for a specific publisher
     */
    async getPublisherSubscription(publisherId: string, accessToken: string): Promise<PublisherSubscription | null> {
        try {
            const response = await fetch(`${this.publisherBaseUrl}/${publisherId}/subscription`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                if (response.status === 404) {
                    return null; // No subscription found
                }
                throw new Error(`Failed to fetch subscription: ${response.statusText}`);
            }

            const { data } = await response.json();
            return data;
        } catch (error) {
            console.error('Error fetching publisher subscription:', error);
            throw error;
        }
    }

    /**
     * Get all features for a publisher
     */
    async getPublisherFeatures(publisherId: string, accessToken: string): Promise<Record<string, any>> {
        try {
            const response = await fetch(`${this.publisherBaseUrl}/${publisherId}/subscription/features`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch publisher features: ${response.statusText}`);
            }

            const { data } = await response.json();
            return data;
        } catch (error) {
            console.error('Error fetching publisher features:', error);
            throw error;
        }
    }

    /**
     * Create Mercado Pago Subscription
     */
    async createMercadoPagoSubscription(publisherId: string, tier: string, accessToken: string): Promise<{ subscriptionId: string; approvalUrl: string }> {
        try {
            const response = await fetch(`${this.publisherBaseUrl}/${publisherId}/subscription/mercadopago`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ tier }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to create Mercado Pago subscription');
            }

            const data = await response.json();
            return { subscriptionId: data.subscriptionId, approvalUrl: data.approvalUrl };
        } catch (error) {
            console.error('Error creating Mercado Pago subscription:', error);
            throw error;
        }
    }

    /**
     * Cancel subscription for publisher
     */
    async cancelPublisherSubscription(publisherId: string, accessToken: string): Promise<void> {
        try {
            const response = await fetch(`${this.publisherBaseUrl}/${publisherId}/subscription/cancel`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to cancel subscription');
            }
        } catch (error) {
            console.error('Error cancelling subscription:', error);
            throw error;
        }
    }

    /**
     * Get subscription stats (admin only)
     */
    async getSubscriptionStats(accessToken: string): Promise<SubscriptionStats> {
        try {
            const response = await fetch(`${this.baseUrl}/stats`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch subscription stats: ${response.statusText}`);
            }

            const { data } = await response.json();
            return data;
        } catch (error) {
            console.error('Error fetching subscription stats:', error);
            throw error;
        }
    }

    /**
     * Create a new subscription (admin only)
     */
    async createSubscription(data: CreateSubscriptionData, accessToken: string): Promise<PublisherSubscription> {
        try {
            const response = await fetch(this.baseUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Failed to create subscription: ${response.statusText}`);
            }

            const { data: subscription } = await response.json();
            return subscription;
        } catch (error) {
            console.error('Error creating subscription:', error);
            throw error;
        }
    }

    /**
     * Renew a subscription (admin only)
     */
    async renewSubscription(
        subscriptionId: string,
        durationDays: number,
        accessToken: string,
        paymentReference?: string,
        amount?: string
    ): Promise<PublisherSubscription> {
        try {
            const response = await fetch(`${this.baseUrl}/${subscriptionId}/renew`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    durationDays,
                    paymentReference,
                    amount,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Failed to renew subscription: ${response.statusText}`);
            }

            const { data } = await response.json();
            return data;
        } catch (error) {
            console.error('Error renewing subscription:', error);
            throw error;
        }
    }

    /**
     * Cancel a subscription (admin only)
     */
    async cancelSubscription(subscriptionId: string, accessToken: string): Promise<void> {
        try {
            const response = await fetch(`${this.baseUrl}/${subscriptionId}/cancel`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Failed to cancel subscription: ${response.statusText}`);
            }
        } catch (error) {
            console.error('Error cancelling subscription:', error);
            throw error;
        }
    }

    /**
     * Override a feature for a publisher (admin only)
     */
    async overrideFeature(
        publisherId: string,
        featureKey: FeatureKey,
        value: boolean | number | string,
        accessToken: string
    ): Promise<void> {
        try {
            const response = await fetch(`${this.publisherBaseUrl}/${publisherId}/subscription/admin/override-feature`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    featureKey,
                    value,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Failed to override feature: ${response.statusText}`);
            }
        } catch (error) {
            console.error('Error overriding feature:', error);
            throw error;
        }
    }

    /**
     * Set admin override for a publisher (admin only)
     */
    async setAdminOverride(
        publisherId: string,
        override: boolean,
        accessToken: string
    ): Promise<void> {
        try {
            const response = await fetch(`${this.publisherBaseUrl}/${publisherId}/subscription/admin/set-override`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    override,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Failed to set admin override: ${response.statusText}`);
            }
        } catch (error) {
            console.error('Error setting admin override:', error);
            throw error;
        }
    }

    /**
     * Remove a feature override (admin only)
     */
    async removeFeatureOverride(
        publisherId: string,
        featureKey: FeatureKey,
        accessToken: string
    ): Promise<void> {
        try {
            const response = await fetch(`${this.baseUrl}/publisher/${publisherId}/features/${featureKey}/override`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Failed to remove feature override: ${response.statusText}`);
            }
        } catch (error) {
            console.error('Error removing feature override:', error);
            throw error;
        }
    }
}

export const subscriptionService = new SubscriptionService();
