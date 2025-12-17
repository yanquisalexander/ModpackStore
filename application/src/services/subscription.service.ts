import { API_ENDPOINT } from '@/consts';
import {
    PublisherSubscription,
    SubscriptionStats,
    CreateSubscriptionData,
    FeatureKey
} from '@/types/subscription';

class SubscriptionService {
    private baseUrl = `${API_ENDPOINT}/admin/subscriptions`;
    private publisherBaseUrl = `${API_ENDPOINT}/publishers`;

    /**
     * Get subscription for a specific publisher
     */
    async getPublisherSubscription(publisherId: string, accessToken: string): Promise<PublisherSubscription | null> {
        try {
            const response = await fetch(`${this.baseUrl}/publisher/${publisherId}`, {
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

            // Return the first active subscription or the most recent one
            if (Array.isArray(data) && data.length > 0) {
                return data[0];
            }

            return null;
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
            const response = await fetch(`${this.baseUrl}/publisher/${publisherId}/features`, {
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
     * Create PayPal Order for subscription
     */
    async createPayPalOrder(publisherId: string, tier: string, accessToken: string): Promise<string> {
        try {
            const response = await fetch(`${this.publisherBaseUrl}/${publisherId}/subscription/order`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ tier }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to create PayPal order');
            }

            const data = await response.json();
            return data.orderId;
        } catch (error) {
            console.error('Error creating PayPal order:', error);
            throw error;
        }
    }

    /**
     * Capture PayPal Order and activate subscription
     */
    async capturePayPalOrder(publisherId: string, orderId: string, tier: string, accessToken: string): Promise<void> {
        try {
            const response = await fetch(`${this.publisherBaseUrl}/${publisherId}/subscription/capture`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ orderId, tier }), // Tier sent for validation
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to capture PayPal order');
            }

            return;
        } catch (error) {
            console.error('Error capturing PayPal order:', error);
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
            const response = await fetch(`${this.baseUrl}/publisher/${publisherId}/features/override`, {
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

    /**
     * Get PayPal approval URL for an order
     */
    async getPayPalApprovalUrl(orderId: string, accessToken: string): Promise<string> {
        try {
            const response = await fetch(`${this.publisherBaseUrl}/subscription/paypal/approval/${orderId}`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to get PayPal approval URL: ${response.statusText}`);
            }

            const { data } = await response.json();
            return data.approvalUrl;
        } catch (error) {
            console.error('Error getting PayPal approval URL:', error);
            throw error;
        }
    }

    /**
     * Check payment status
     */
    async checkPaymentStatus(orderId: string, accessToken: string): Promise<{ status: string }> {
        try {
            const response = await fetch(`${this.publisherBaseUrl}/subscription/paypal/status/${orderId}`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to check payment status: ${response.statusText}`);
            }

            const { data } = await response.json();
            return data;
        } catch (error) {
            console.error('Error checking payment status:', error);
            throw error;
        }
    }
}

export const subscriptionService = new SubscriptionService();
