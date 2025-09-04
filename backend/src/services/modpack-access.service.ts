import { Modpack } from '@/entities/Modpack';
import { User } from '@/entities/User';
import { TwitchService } from './twitch.service';
import { APIError } from '@/lib/APIError';

export class ModpackAccessService {
    /**
     * Check if user can access a modpack based on all access requirements
     */
    static async canUserAccessModpack(user: User | null, modpack: Modpack): Promise<{
        canAccess: boolean;
        reason?: string;
        requiredChannels?: string[];
    }> {
        // If modpack doesn't require Twitch subscription, check other requirements
        if (!modpack.requiresTwitchSub) {
            // Could add other access checks here (payment, etc.)
            return { canAccess: true };
        }

        // User must be authenticated for Twitch-protected content
        if (!user) {
            return {
                canAccess: false,
                reason: 'Authentication required',
                requiredChannels: modpack.getRequiredTwitchCreatorIds()
            };
        }

        // User must have Twitch linked
        if (!user.hasTwitchLinked()) {
            return {
                canAccess: false,
                reason: 'Twitch account must be linked',
                requiredChannels: modpack.getRequiredTwitchCreatorIds()
            };
        }

        // Check Twitch subscriptions
        const requiredChannelIds = modpack.getRequiredTwitchCreatorIds();
        try {
            const hasSubscription = await TwitchService.canUserAccessModpack(user, requiredChannelIds);

            if (!hasSubscription) {
                return {
                    canAccess: false,
                    reason: 'Must be subscribed to at least one of the required Twitch channels',
                    requiredChannels: requiredChannelIds
                };
            }

            return { canAccess: true };
        } catch (error) {
            console.error('Error checking Twitch subscriptions:', error);
            return {
                canAccess: false,
                reason: 'Unable to verify Twitch subscriptions',
                requiredChannels: requiredChannelIds
            };
        }
    }

    /**
     * Get access info for a modpack without checking user permissions
     */
    static getModpackAccessInfo(modpack: Modpack): {
        requiresTwitchSubscription: boolean;
        requiredTwitchChannels: string[];
        isPaid: boolean;
        price?: string;
    } {
        return {
            requiresTwitchSubscription: modpack.requiresTwitchSub,
            requiredTwitchChannels: modpack.getRequiredTwitchCreatorIds(),
            isPaid: modpack.isPaid,
            price: modpack.isPaid ? modpack.price : undefined
        };
    }

    /**
     * Check if user can download/access modpack and throw appropriate error if not
     */
    static async validateModpackAccess(user: User | null, modpack: Modpack): Promise<void> {
        const accessResult = await this.canUserAccessModpack(user, modpack);

        if (!accessResult.canAccess) {
            throw new APIError(403, accessResult.reason || 'Access denied', JSON.stringify({
                requiredChannels: accessResult.requiredChannels
            }));
        }
    }
}