import { Context } from "hono";
import { PatreonTier } from "@/entities/PatreonTier";
import { User } from "@/entities/User";
import { PatreonSyncService } from "@/services/patreon-sync.service";
import { validatePatreonMetadata } from "@/validators/patreon-metadata.validator";
import { BENEFIT_DEFINITIONS } from "@/config/benefitDefinitions";
import { AppDataSource } from "@/db/data-source";

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
                        lastSyncAt: tier.lastSyncAt,
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
            return c.json({
                success: true,
                data: {
                    benefits: BENEFIT_DEFINITIONS.reduce((acc, def) => {
                        acc[def.id] = {
                            type: def.type,
                            name: def.name,
                            description: def.description,
                            default: def.defaultValue
                        };
                        return acc;
                    }, {} as any)
                }
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
     * Update tier metadata (benefits) - PATCH endpoint
     */
    static async updateTierMetadata(c: Context) {
        try {
            const tierId = c.req.param('tierId');
            let body;
            try {
                body = await c.req.json();
            } catch (e) {
                console.error('[PATREON_PLUS] JSON parse error:', e);
                return c.json({ success: false, error: 'Invalid JSON body' }, 400);
            }

            console.log('[PATREON_PLUS] Updating metadata for tier:', tierId, 'Body:', JSON.stringify(body));

            // Validate that metadata exists in body
            if (!body || !body.metadata || typeof body.metadata !== 'object') {
                return c.json({
                    success: false,
                    error: 'Metadata object is required'
                }, 400);
            }

            // Validate metadata values (only boolean, number, string allowed)
            const validation = validatePatreonMetadata(body.metadata);
            if (!validation.valid) {
                console.error('[PATREON_PLUS] Validation error:', validation.error);
                return c.json({
                    success: false,
                    error: validation.error
                }, 400);
            }

            const tier = await PatreonTier.findOne({ where: { id: tierId } });

            if (!tier) {
                console.error(`[PATREON_PLUS] Tier not found: ${tierId}`);
                return c.json({
                    success: false,
                    error: 'Tier not found'
                }, 404);
            }

            console.log(`[PATREON_PLUS] Found tier: ${tier.name}. Current metadata:`, JSON.stringify(tier.metadata));
            console.log(`[PATREON_PLUS] New metadata to save:`, JSON.stringify(validation.data));

            // Use explicit update to ensure JSONB column is updated correctly in Postgres
            await AppDataSource.createQueryBuilder()
                .update(PatreonTier)
                .set({ metadata: validation.data || {} })
                .where("id = :id", { id: tierId })
                .execute();

            // Fetch again to verify
            const updatedTier = await PatreonTier.findOne({ where: { id: tierId } });
            console.log(`[PATREON_PLUS] Metadata after update:`, JSON.stringify(updatedTier?.metadata));

            return c.json({
                success: true,
                data: updatedTier
            });
        } catch (error) {
            console.error('[PATREON_PLUS] Error updating tier metadata:', error);
            // If it's a JSON parse error or something similar, it might be caught here
            return c.json({
                success: false,
                error: (error instanceof Error) ? error.message : 'Failed to update tier metadata'
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
