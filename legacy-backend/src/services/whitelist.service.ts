import { ModpackWhitelist } from "@/entities/ModpackWhitelist";
import { Modpack } from "@/entities/Modpack";
import { User } from "@/entities/User";
import { Publisher } from "@/entities/Publisher";
import { PublisherMember } from "@/entities/PublisherMember";
import { APIError } from "@/lib/APIError";
import { ModpackVisibility } from "@/types/enums";
import { PublisherSubscriptionService } from "./publisher-subscription.service";
import { FeatureKey } from "@/entities/PublisherSubscriptionFeature";

interface AddToWhitelistParams {
    modpackId: string;
    userId: string;
    addedByUserId: string;
    notes?: string;
}

export class WhitelistService {
    /**
     * Validate that publisher can use whitelist feature
     */
    private static async validatePublisherWhitelistAccess(publisherId: string): Promise<void> {
        const canUseWhitelist = await PublisherSubscriptionService.canUseWhitelist(publisherId);
        
        if (!canUseWhitelist) {
            throw new APIError(403, 'Publisher does not have access to whitelist feature. Please upgrade your subscription.');
        }
    }

    /**
     * Validate whitelist limit for a modpack
     */
    private static async validateWhitelistLimit(modpackId: string, publisherId: string): Promise<void> {
        const maxPlayers = await PublisherSubscriptionService.getMaxWhitelistPlayers(publisherId);
        const currentCount = await ModpackWhitelist.getWhitelistCount(modpackId);

        if (maxPlayers > 0 && currentCount >= maxPlayers) {
            throw new APIError(403, `Whitelist limit reached. Maximum ${maxPlayers} players allowed per modpack.`);
        }
    }

    /**
     * Validate that user has permission to manage whitelist
     */
    private static async validateWhitelistManagementPermission(
        modpackId: string,
        userId: string
    ): Promise<{ modpack: Modpack; publisher: Publisher }> {
        const modpack = await Modpack.findOne({
            where: { id: modpackId },
            relations: ['publisher']
        });

        if (!modpack) {
            throw new APIError(404, 'Modpack not found');
        }

        if (modpack.visibility !== ModpackVisibility.WHITELIST) {
            throw new APIError(400, 'Modpack is not in whitelist mode');
        }

        const publisher = modpack.publisher;
        if (!publisher) {
            throw new APIError(404, 'Publisher not found');
        }

        // Check if user is a member of the publisher
        const membership = await PublisherMember.findOne({
            where: {
                userId,
                publisherId: publisher.id
            }
        });

        if (!membership) {
            throw new APIError(403, 'You do not have permission to manage this whitelist');
        }

        return { modpack, publisher };
    }

    /**
     * Add a user to modpack whitelist
     */
    static async addToWhitelist(params: AddToWhitelistParams): Promise<ModpackWhitelist> {
        const { modpack, publisher } = await this.validateWhitelistManagementPermission(
            params.modpackId,
            params.addedByUserId
        );

        // Validate publisher has whitelist access
        await this.validatePublisherWhitelistAccess(publisher.id);

        // Validate whitelist limit
        await this.validateWhitelistLimit(params.modpackId, publisher.id);

        // Validate target user exists
        const targetUser = await User.findOne({ where: { id: params.userId } });
        if (!targetUser) {
            throw new APIError(404, 'Target user not found');
        }

        // Check if already whitelisted
        const existing = await ModpackWhitelist.findOne({
            where: {
                modpackId: params.modpackId,
                userId: params.userId
            }
        });

        if (existing) {
            throw new APIError(400, 'User is already whitelisted for this modpack');
        }

        // Add to whitelist
        return await ModpackWhitelist.addUserToWhitelist(
            params.modpackId,
            params.userId,
            params.addedByUserId,
            params.notes
        );
    }

    /**
     * Add user to whitelist by Discord username
     */
    static async addToWhitelistByDiscord(
        modpackId: string,
        discordUsername: string,
        addedByUserId: string,
        notes?: string
    ): Promise<ModpackWhitelist> {
        // Find user by Discord username
        const targetUser = await User.findOne({
            where: { username: discordUsername }
        });

        if (!targetUser) {
            throw new APIError(404, `User with Discord username '${discordUsername}' not found`);
        }

        return await this.addToWhitelist({
            modpackId,
            userId: targetUser.id,
            addedByUserId,
            notes
        });
    }

    /**
     * Remove a user from modpack whitelist
     */
    static async removeFromWhitelist(
        modpackId: string,
        userId: string,
        removedByUserId: string
    ): Promise<boolean> {
        await this.validateWhitelistManagementPermission(modpackId, removedByUserId);

        const removed = await ModpackWhitelist.removeUserFromWhitelist(modpackId, userId);

        if (!removed) {
            throw new APIError(404, 'User is not whitelisted for this modpack');
        }

        return true;
    }

    /**
     * Get all whitelisted users for a modpack
     */
    static async getWhitelistedUsers(
        modpackId: string,
        requestingUserId: string
    ): Promise<User[]> {
        await this.validateWhitelistManagementPermission(modpackId, requestingUserId);

        return await ModpackWhitelist.getModpackWhitelistedUsers(modpackId);
    }

    /**
     * Check if a user has access to a whitelist modpack
     */
    static async hasAccess(modpackId: string, userId: string): Promise<boolean> {
        const modpack = await Modpack.findOne({
            where: { id: modpackId }
        });

        if (!modpack) {
            return false;
        }

        // If not whitelist mode, access is determined by other means
        if (modpack.visibility !== ModpackVisibility.WHITELIST) {
            return true;
        }

        // Check whitelist
        return await ModpackWhitelist.isUserWhitelisted(modpackId, userId);
    }

    /**
     * Get all modpacks a user has whitelist access to
     */
    static async getUserWhitelistedModpacks(userId: string): Promise<Modpack[]> {
        const modpackIds = await ModpackWhitelist.getUserWhitelistedModpacks(userId);

        if (modpackIds.length === 0) {
            return [];
        }

        return await Modpack.find({
            where: {
                id: In(modpackIds),
                visibility: ModpackVisibility.WHITELIST
            },
            relations: ['publisher', 'versions', 'categories']
        });
    }

    /**
     * Get whitelist statistics for a modpack
     */
    static async getWhitelistStats(
        modpackId: string,
        requestingUserId: string
    ): Promise<{
        totalWhitelisted: number;
        maxAllowed: number;
        remainingSlots: number;
    }> {
        const { publisher } = await this.validateWhitelistManagementPermission(
            modpackId,
            requestingUserId
        );

        const totalWhitelisted = await ModpackWhitelist.getWhitelistCount(modpackId);
        const maxAllowed = await PublisherSubscriptionService.getMaxWhitelistPlayers(publisher.id);
        const remainingSlots = maxAllowed > 0 ? maxAllowed - totalWhitelisted : -1; // -1 means unlimited

        return {
            totalWhitelisted,
            maxAllowed,
            remainingSlots
        };
    }

    /**
     * Bulk add users to whitelist
     */
    static async bulkAddToWhitelist(
        modpackId: string,
        userIds: string[],
        addedByUserId: string,
        notes?: string
    ): Promise<{ added: number; failed: number; errors: string[] }> {
        const { publisher } = await this.validateWhitelistManagementPermission(
            modpackId,
            addedByUserId
        );

        await this.validatePublisherWhitelistAccess(publisher.id);

        const maxPlayers = await PublisherSubscriptionService.getMaxWhitelistPlayers(publisher.id);
        const currentCount = await ModpackWhitelist.getWhitelistCount(modpackId);

        const result = {
            added: 0,
            failed: 0,
            errors: [] as string[]
        };

        for (const userId of userIds) {
            try {
                // Check limit before each addition
                if (maxPlayers > 0 && (currentCount + result.added) >= maxPlayers) {
                    result.failed++;
                    result.errors.push(`Whitelist limit reached at ${maxPlayers} players`);
                    break;
                }

                await ModpackWhitelist.addUserToWhitelist(
                    modpackId,
                    userId,
                    addedByUserId,
                    notes
                );
                result.added++;
            } catch (error) {
                result.failed++;
                result.errors.push(error instanceof Error ? error.message : 'Unknown error');
            }
        }

        return result;
    }

    /**
     * Clear all whitelist entries for a modpack
     */
    static async clearWhitelist(
        modpackId: string,
        clearedByUserId: string
    ): Promise<number> {
        await this.validateWhitelistManagementPermission(modpackId, clearedByUserId);

        const entries = await ModpackWhitelist.find({ where: { modpackId } });
        
        for (const entry of entries) {
            await entry.remove();
        }

        return entries.length;
    }

    /**
     * Export whitelist to array of user data
     */
    static async exportWhitelist(
        modpackId: string,
        requestingUserId: string
    ): Promise<Array<{
        userId: string;
        username: string;
        discordId: string | null;
        addedAt: Date;
        addedBy: string;
    }>> {
        await this.validateWhitelistManagementPermission(modpackId, requestingUserId);

        const entries = await ModpackWhitelist.find({
            where: { modpackId },
            relations: ['user', 'addedBy'],
            order: { createdAt: 'ASC' }
        });

        return entries.map(entry => ({
            userId: entry.user.id,
            username: entry.user.username,
            discordId: entry.user.discordId,
            addedAt: entry.createdAt,
            addedBy: entry.addedBy.username
        }));
    }
}

// Import In from typeorm for getUserWhitelistedModpacks
import { In } from "typeorm";
