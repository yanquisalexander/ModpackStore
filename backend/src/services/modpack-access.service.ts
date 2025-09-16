import { Modpack } from '@/entities/Modpack';
import { User } from '@/entities/User';
import { TwitchService } from './twitch.service';
import { AcquisitionService } from './acquisition.service';
import { APIError } from '@/lib/APIError';
import { AcquisitionMethod } from '@/types/enums';

export class ModpackAccessService {
    /**
     * Check if user can access a modpack based on all access requirements
     */
    static async canUserAccessModpack(user: User | null, modpack: Modpack): Promise<{
        canAccess: boolean;
        reason?: string;
        requiredChannels?: string[];
    }> {
        // Check basic visibility requirements for free modpacks
        if (modpack.visibility === 'public' && modpack.acquisitionMethod === AcquisitionMethod.FREE) {
            // For authenticated users, ensure they have an acquisition record for the free modpack
            if (user) {
                try {
                    // Check if user already has an acquisition
                    const existingAcquisition = await AcquisitionService.hasActiveAccess(user.id, modpack.id);
                    
                    if (!existingAcquisition.hasAccess) {
                        // Create acquisition record for free modpack automatically
                        await AcquisitionService.acquireWithPurchase(user, modpack);
                    }
                } catch (error) {
                    // Log error but don't prevent access to free modpack
                    console.error('Error auto-creating acquisition for free modpack:', error);
                }
            }
            return { canAccess: true };
        }

        // User must be authenticated for protected content
        if (!user) {
            return {
                canAccess: false,
                reason: 'Authentication required'
            };
        }

        // Check if user has an active acquisition
        const accessResult = await AcquisitionService.hasActiveAccess(user.id, modpack.id);
        if (accessResult.hasAccess) {
            return { canAccess: true };
        }

        // If no active acquisition, return access requirements
        const info = AcquisitionService.getModpackAcquisitionInfo(modpack);
        let reason = 'Access not acquired';
        
        switch (modpack.acquisitionMethod) {
            case AcquisitionMethod.PASSWORD:
                reason = 'Password required';
                break;
            case AcquisitionMethod.PAID:
                reason = 'Purchase required';
                break;
            case AcquisitionMethod.TWITCH_SUB:
                reason = 'Twitch subscription required';
                break;
        }

        return {
            canAccess: false,
            reason,
            requiredChannels: info.requiredTwitchChannels
        };
    }

    /**
     * Get access info for a modpack without checking user permissions
     */
    static getModpackAccessInfo(modpack: Modpack): {
        requiresTwitchSubscription: boolean;
        requiredTwitchChannels: string[];
        isPaid: boolean;
        price?: string;
        requiresPassword: boolean;
        isFree: boolean;
        acquisitionMethod: AcquisitionMethod;
    } {
        const info = AcquisitionService.getModpackAcquisitionInfo(modpack);
        return {
            acquisitionMethod: info.acquisitionMethod,
            requiresTwitchSubscription: info.requiresTwitchSubscription,
            requiredTwitchChannels: info.requiredTwitchChannels,
            isPaid: info.isPaid,
            price: info.price,
            requiresPassword: info.requiresPassword,
            isFree: info.isFree
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