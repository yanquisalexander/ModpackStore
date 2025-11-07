import { Context } from "hono";
import * as fs from "fs";
import * as path from "path";
import * as yaml from "yaml";
import { PatreonTier } from "@/entities/PatreonTier";
import { User } from "@/entities/User";
import { PatreonSyncService } from "@/services/patreon-sync.service";

export class PatreonPlusController {
    /**
     * Get all Patreon tiers with member counts
     */
    static async getTiers(c: Context) {
        try {
            const tiers = await PatreonTier.find({ order: { amountCents: 'ASC' } });

            // Get member count for each tier
            const tiersWithCounts = await Promise.all(
                tiers.map(async (tier) => {
                    const memberCount = await User.count({ 
                        where: { patreonTierId: tier.id, patreonIsActive: true } 
                    });

                    return {
                        id: tier.id,
                        name: tier.name,
                        description: tier.description,
                        amountCents: tier.amountCents,
                        active: tier.active,
                        metadata: tier.metadata,
                        memberCount,
                        createdAt: tier.createdAt,
                        updatedAt: tier.updatedAt
                    };
                })
            );

            return c.json({
                success: true,
                data: tiersWithCounts
            });
        } catch (error) {
            console.error('[PATREON_PLUS] Error fetching tiers:', error);
            return c.json({
                success: false,
                error: 'Failed to fetch tiers'
            }, 500);
        }
    }

    /**
     * Get members for a specific tier
     */
    static async getTierMembers(c: Context) {
        try {
            const tierId = c.req.param('tierId');

            const members = await User.find({
                where: { patreonTierId: tierId, patreonIsActive: true },
                select: ['id', 'username', 'email', 'avatarUrl', 'patreonStatus', 'patreonEntitledAmount', 'patreonLastVerified'],
                order: { username: 'ASC' }
            });

            return c.json({
                success: true,
                data: members
            });
        } catch (error) {
            console.error('[PATREON_PLUS] Error fetching tier members:', error);
            return c.json({
                success: false,
                error: 'Failed to fetch tier members'
            }, 500);
        }
    }

    /**
     * Trigger manual sync
     */
    static async triggerSync(c: Context) {
        try {
            console.log('[PATREON_PLUS] Manual sync triggered');

            const result = await PatreonSyncService.fullSync();

            if (!result.success) {
                return c.json({
                    success: false,
                    error: result.error || 'Sync failed'
                }, 500);
            }

            return c.json({
                success: true,
                data: {
                    tiers: result.tiers,
                    members: result.members
                }
            });
        } catch (error) {
            console.error('[PATREON_PLUS] Error during manual sync:', error);
            return c.json({
                success: false,
                error: 'Failed to sync with Patreon'
            }, 500);
        }
    }

    /**
     * Get last sync timestamp
     */
    static async getLastSync(c: Context) {
        try {
            const lastSync = await PatreonSyncService.getLastSyncTimestamp();

            return c.json({
                success: true,
                data: {
                    lastSync
                }
            });
        } catch (error) {
            console.error('[PATREON_PLUS] Error fetching last sync:', error);
            return c.json({
                success: false,
                error: 'Failed to fetch last sync timestamp'
            }, 500);
        }
    }

    /**
     * Get benefits configuration
     */
    static async getBenefitsConfig(c: Context) {
        try {
            const configPath = path.join(__dirname, '../config/benefits_modpackstore_plus.yml');
            const configContent = fs.readFileSync(configPath, 'utf8');
            const config = yaml.parse(configContent);

            return c.json({
                success: true,
                data: config
            });
        } catch (error) {
            console.error('[PATREON_PLUS] Error reading benefits config:', error);
            return c.json({
                success: false,
                error: 'Failed to read benefits configuration'
            }, 500);
        }
    }

    /**
     * Update tier metadata (benefits)
     */
    static async updateTierMetadata(c: Context) {
        try {
            const tierId = c.req.param('tierId');
            const body = await c.req.json();

            const tier = await PatreonTier.findOne({ where: { id: tierId } });

            if (!tier) {
                return c.json({
                    success: false,
                    error: 'Tier not found'
                }, 404);
            }

            // Update metadata
            tier.metadata = {
                ...tier.metadata,
                ...body.metadata
            };

            await tier.save();

            return c.json({
                success: true,
                data: tier
            });
        } catch (error) {
            console.error('[PATREON_PLUS] Error updating tier metadata:', error);
            return c.json({
                success: false,
                error: 'Failed to update tier metadata'
            }, 500);
        }
    }

    /**
     * Get all active Patreon members (across all tiers)
     */
    static async getAllMembers(c: Context) {
        try {
            const members = await User.find({
                where: { patreonIsActive: true },
                relations: ['patreonTierRelation'],
                select: ['id', 'username', 'email', 'avatarUrl', 'patreonStatus', 'patreonEntitledAmount', 'patreonLastVerified', 'patreonTierId'],
                order: { patreonEntitledAmount: 'DESC' }
            });

            const membersWithTiers = members.map(member => ({
                id: member.id,
                username: member.username,
                email: member.email,
                avatarUrl: member.avatarUrl,
                patreonStatus: member.patreonStatus,
                patreonEntitledAmount: member.patreonEntitledAmount,
                patreonLastVerified: member.patreonLastVerified,
                tier: member.patreonTierRelation ? {
                    id: member.patreonTierRelation.id,
                    name: member.patreonTierRelation.name,
                    amountCents: member.patreonTierRelation.amountCents
                } : null
            }));

            return c.json({
                success: true,
                data: membersWithTiers
            });
        } catch (error) {
            console.error('[PATREON_PLUS] Error fetching all members:', error);
            return c.json({
                success: false,
                error: 'Failed to fetch members'
            }, 500);
        }
    }

    /**
     * Get Patreon Plus statistics
     */
    static async getStatistics(c: Context) {
        try {
            const totalTiers = await PatreonTier.count({ where: { active: true } });
            const totalMembers = await User.count({ where: { patreonIsActive: true } });
            const lastSync = await PatreonSyncService.getLastSyncTimestamp();

            // Get revenue statistics
            const members = await User.find({
                where: { patreonIsActive: true },
                select: ['patreonEntitledAmount']
            });

            const totalRevenueCents = members.reduce(
                (sum, member) => sum + (member.patreonEntitledAmount || 0),
                0
            );

            return c.json({
                success: true,
                data: {
                    totalTiers,
                    totalMembers,
                    totalRevenueCents,
                    totalRevenueUSD: (totalRevenueCents / 100).toFixed(2),
                    lastSync
                }
            });
        } catch (error) {
            console.error('[PATREON_PLUS] Error fetching statistics:', error);
            return c.json({
                success: false,
                error: 'Failed to fetch statistics'
            }, 500);
        }
    }
}
