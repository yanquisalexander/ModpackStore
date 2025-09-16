import { User } from '@/entities/User';
import { Modpack } from '@/entities/Modpack';
import { ModpackAcquisition } from '@/entities/ModpackAcquisition';
import { AcquisitionMethod, AcquisitionStatus } from '@/types/enums';
import { TwitchService } from './twitch.service';
import { APIError } from '@/lib/APIError';

export class AcquisitionService {
    /**
     * Check if user has active access to a modpack through any acquisition method
     */
    static async hasActiveAccess(userId: string, modpackId: string): Promise<{
        hasAccess: boolean;
        acquisition?: ModpackAcquisition;
        reason?: string;
    }> {
        const acquisition = await ModpackAcquisition.findActiveUserAcquisition(userId, modpackId);

        if (!acquisition) {
            return { hasAccess: false, reason: 'No acquisition found' };
        }

        // For Twitch acquisitions, verify subscription is still active
        if (acquisition.method === AcquisitionMethod.TWITCH_SUB) {
            const user = await User.findOne({ where: { id: userId } });
            const modpack = await Modpack.findOne({ where: { id: modpackId } });

            if (!user || !modpack) {
                return { hasAccess: false, reason: 'User or modpack not found' };
            }

            // Check if Twitch subscription is still active
            try {
                const hasActiveSubscription = await TwitchService.checkUserSubscriptions(
                    user.twitchId!,
                    user.twitchAccessToken!,
                    modpack.getRequiredTwitchCreatorIds(),
                    user.twitchRefreshToken || undefined
                );

                if (!hasActiveSubscription) {
                    // Suspend the acquisition
                    acquisition.suspend();
                    await acquisition.save();
                    return { hasAccess: false, acquisition, reason: 'Twitch subscription expired' };
                }
            } catch (error) {
                console.error('Error checking Twitch subscription:', error);
                return { hasAccess: false, acquisition, reason: 'Unable to verify Twitch subscription' };
            }
        }

        return { hasAccess: true, acquisition };
    }

    /**
     * Acquire modpack access using password
     */
    static async acquireWithPassword(user: User, modpack: Modpack, password: string): Promise<ModpackAcquisition> {
        // Validate password
        if (!modpack.validatePassword(password)) {
            throw new APIError(403, 'La contraseña ingresada es incorrecta.');
        }

        // Check if acquisition already exists
        const existingAcquisition = await ModpackAcquisition.findUserAcquisition(user.id, modpack.id);
        if (existingAcquisition) {
            if (existingAcquisition.isActive()) {
                return existingAcquisition;
            }
            // Reactivate revoked acquisition
            existingAcquisition.activate();
            return await existingAcquisition.save();
        }

        // Create new acquisition
        const acquisition = new ModpackAcquisition();
        acquisition.userId = user.id;
        acquisition.modpackId = modpack.id;
        acquisition.method = AcquisitionMethod.PASSWORD;
        acquisition.status = AcquisitionStatus.ACTIVE;

        return await acquisition.save();
    }

    /**
     * Acquire modpack access through purchase (free or paid)
     */
    static async acquireWithPurchase(user: User, modpack: Modpack, transactionId?: string): Promise<ModpackAcquisition> {
        // Check if acquisition already exists
        const existingAcquisition = await ModpackAcquisition.findUserAcquisition(user.id, modpack.id);
        if (existingAcquisition) {
            if (existingAcquisition.isActive()) {
                return existingAcquisition;
            }
            // Reactivate revoked or suspended acquisition
            existingAcquisition.activate();
            existingAcquisition.transactionId = transactionId || null;
            return await existingAcquisition.save();
        }

        // For paid modpacks, transaction ID is required
        if (modpack.acquisitionMethod === AcquisitionMethod.PAID && parseFloat(modpack.price) > 0 && !transactionId) {
            throw new APIError(400, 'Transaction ID required for paid modpack');
        }

        // Create new acquisition
        const acquisition = new ModpackAcquisition();
        acquisition.userId = user.id;
        acquisition.modpackId = modpack.id;
        acquisition.method = modpack.acquisitionMethod; // Use the modpack's defined method
        acquisition.status = AcquisitionStatus.ACTIVE;
        acquisition.transactionId = transactionId || null;

        return await acquisition.save();
    }

    /**
     * Acquire modpack access through Twitch subscription
     */
    static async acquireWithTwitch(user: User, modpack: Modpack): Promise<ModpackAcquisition> {
        // Validate user has Twitch linked
        if (!user.hasTwitchLinked()) {
            throw new APIError(400, 'Twitch account must be linked');
        }

        // Verify current subscription
        const hasActiveSubscription = await TwitchService.checkUserSubscriptions(
            user.twitchId!,
            user.twitchAccessToken!,
            modpack.getRequiredTwitchCreatorIds(),
            user.twitchRefreshToken || undefined
        );

        if (!hasActiveSubscription) {
            throw new APIError(403, 'Active Twitch subscription required');
        }

        // Check if acquisition already exists
        const existingAcquisition = await ModpackAcquisition.findUserAcquisition(user.id, modpack.id);
        if (existingAcquisition) {
            if (existingAcquisition.isActive()) {
                return existingAcquisition;
            }
            // Reactivate revoked or suspended acquisition
            existingAcquisition.activate();
            return await existingAcquisition.save();
        }

        // Create new acquisition
        const acquisition = new ModpackAcquisition();
        acquisition.userId = user.id;
        acquisition.modpackId = modpack.id;
        acquisition.method = AcquisitionMethod.TWITCH_SUB;
        acquisition.status = AcquisitionStatus.ACTIVE;

        return await acquisition.save();
    }

    /**
     * Revoke user's access to a modpack (admin action)
     */
    static async revokeAccess(userId: string, modpackId: string, reason?: string): Promise<boolean> {
        const acquisition = await ModpackAcquisition.findUserAcquisition(userId, modpackId);
        if (!acquisition) {
            return false;
        }

        acquisition.revoke();
        await acquisition.save();
        return true;
    }

    /**
     * Get acquisition method requirements for a modpack
     */
    static getModpackAcquisitionInfo(modpack: Modpack): {
        requiresPassword: boolean;
        isPaid: boolean;
        isFree: boolean;
        price?: string;
        requiresTwitchSubscription: boolean;
        requiredTwitchChannels: string[];
        acquisitionMethod: AcquisitionMethod;
    } {
        return {
            acquisitionMethod: modpack.acquisitionMethod,
            requiresPassword: modpack.acquisitionMethod === AcquisitionMethod.PASSWORD,
            isPaid: modpack.acquisitionMethod === AcquisitionMethod.PAID,
            isFree: modpack.acquisitionMethod === AcquisitionMethod.FREE,
            price: modpack.acquisitionMethod === AcquisitionMethod.PAID ? modpack.price : undefined,
            requiresTwitchSubscription: modpack.acquisitionMethod === AcquisitionMethod.TWITCH_SUB,
            requiredTwitchChannels: modpack.acquisitionMethod === AcquisitionMethod.TWITCH_SUB ? modpack.getRequiredTwitchCreatorIds() : []
        };
    }

    /**
     * Get user's acquisitions with pagination
     */
    static async getUserAcquisitions(userId: string, page: number = 1, limit: number = 20): Promise<{
        acquisitions: ModpackAcquisition[];
        total: number;
        page: number;
        totalPages: number;
    }> {
        const offset = (page - 1) * limit;

        const [acquisitions, total] = await Promise.all([
            ModpackAcquisition.find({
                where: { userId },
                relations: ['modpack', 'modpack.publisher'],
                order: { createdAt: 'DESC' },
                skip: offset,
                take: limit
            }),
            ModpackAcquisition.count({ where: { userId } })
        ]);

        return {
            acquisitions,
            total,
            page,
            totalPages: Math.ceil(total / limit)
        };
    }

    /**
     * Get modpack's acquisitions (for publisher/admin)
     */
    static async getModpackAcquisitions(modpackId: string, page: number = 1, limit: number = 20): Promise<{
        acquisitions: ModpackAcquisition[];
        total: number;
        page: number;
        totalPages: number;
    }> {
        const offset = (page - 1) * limit;

        const [acquisitions, total] = await Promise.all([
            ModpackAcquisition.find({
                where: { modpackId },
                relations: ['user'],
                order: { createdAt: 'DESC' },
                skip: offset,
                take: limit
            }),
            ModpackAcquisition.count({ where: { modpackId } })
        ]);

        return {
            acquisitions,
            total,
            page,
            totalPages: Math.ceil(total / limit)
        };
    }
}