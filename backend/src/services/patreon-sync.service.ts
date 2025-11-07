import { User } from "@/entities/User";
import { PatreonTier } from "@/entities/PatreonTier";
import { AuditLog, AuditAction } from "@/entities/AuditLog";
import { AppDataSource } from "@/db/data-source";
import { Not } from "typeorm";
import { SYSTEM_EMAIL } from "@/utils/system";

interface PatreonTierResponse {
    data: Array<{
        id: string;
        type: 'campaign';
        relationships: {
            tiers: {
                data: Array<{
                    id: string;
                    type: 'tier';
                }>;
            };
        };
    }>;
    included: Array<{
        id: string;
        type: 'tier';
        attributes: {
            title: string;
            description: string;
            amount_cents: number;
            published: boolean;
        };
    }>;
}

interface PatreonMemberResponse {
    data: Array<{
        id: string;
        type: 'member';
        attributes: {
            patron_status: string;
            currently_entitled_amount_cents: number;
            last_charge_status: string;
        };
        relationships: {
            user: {
                data: {
                    id: string;
                    type: 'user';
                };
            };
            currently_entitled_tiers: {
                data: Array<{
                    id: string;
                    type: 'tier';
                }>;
            };
        };
    }>;
    included?: Array<{
        id: string;
        type: 'user';
        attributes: {
            email: string;
        };
    }>;
}

export class PatreonSyncService {
    private static readonly PATREON_API_BASE = 'https://www.patreon.com/api/oauth2/v2';
    private static readonly CAMPAIGN_ID = process.env.PATREON_CAMPAIGN_ID;
    private static readonly CREATOR_ACCESS_TOKEN = process.env.PATREON_CREATOR_ACCESS_TOKEN;

    /**
     * Sync tiers from Patreon API
     */
    static async syncTiers(): Promise<{ success: boolean; tiersAdded: number; tiersUpdated: number; tiersDeactivated: number; error?: string }> {
        if (!this.CAMPAIGN_ID || !this.CREATOR_ACCESS_TOKEN) {
            return { success: false, tiersAdded: 0, tiersUpdated: 0, tiersDeactivated: 0, error: 'Missing Patreon configuration' };
        }

        try {
            console.log('[PATREON_SYNC] Starting tier synchronization...');

            // Fetch campaign with tiers from Patreon API
            const response = await fetch(
                `${this.PATREON_API_BASE}/campaigns/${this.CAMPAIGN_ID}?include=tiers&fields%5Btier%5D=title,description,amount_cents,published`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.CREATOR_ACCESS_TOKEN}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (!response.ok) {
                throw new Error(`Patreon API error: ${response.status} - ${response.statusText}`);
            }

            const data: PatreonTierResponse = await response.json();
            const patreonTierIds = new Set<string>();
            let tiersAdded = 0;
            let tiersUpdated = 0;

            // Process each tier from Patreon (now in included array)
            for (const tierData of data.included || []) {
                if (tierData.type !== 'tier') continue;

                patreonTierIds.add(tierData.id);

                const existingTier = await PatreonTier.findOne({ where: { id: tierData.id } });

                if (existingTier) {
                    // Update existing tier
                    existingTier.name = tierData.attributes.title;
                    existingTier.description = tierData.attributes.description;
                    existingTier.amountCents = tierData.attributes.amount_cents;
                    existingTier.active = tierData.attributes.published;
                    existingTier.lastSyncAt = new Date();
                    await existingTier.save();
                    tiersUpdated++;
                    console.log(`[PATREON_SYNC] Updated tier: ${tierData.attributes.title}`);
                } else {
                    // Create new tier
                    const newTier = PatreonTier.create({
                        id: tierData.id,
                        name: tierData.attributes.title,
                        description: tierData.attributes.description,
                        amountCents: tierData.attributes.amount_cents,
                        active: tierData.attributes.published,
                        metadata: {},
                        lastSyncAt: new Date()
                    });
                    await newTier.save();
                    tiersAdded++;
                    console.log(`[PATREON_SYNC] Added new tier: ${tierData.attributes.title}`);
                }
            }

            // Deactivate tiers that no longer exist in Patreon
            const allTiers = await PatreonTier.find({ where: { active: true } });
            let tiersDeactivated = 0;

            for (const tier of allTiers) {
                if (!patreonTierIds.has(tier.id)) {
                    tier.active = false;
                    await tier.save();
                    tiersDeactivated++;
                    console.log(`[PATREON_SYNC] Deactivated tier: ${tier.name}`);
                }
            }

            // Create audit log
            await this.createAuditLog(AuditAction.PATREON_TIER_SYNC, {
                tiersAdded,
                tiersUpdated,
                tiersDeactivated,
                totalTiers: patreonTierIds.size
            });

            console.log(`[PATREON_SYNC] Tier sync completed: ${tiersAdded} added, ${tiersUpdated} updated, ${tiersDeactivated} deactivated`);

            return { success: true, tiersAdded, tiersUpdated, tiersDeactivated };
        } catch (error) {
            console.error('[PATREON_SYNC] Error syncing tiers:', error);
            return {
                success: false,
                tiersAdded: 0,
                tiersUpdated: 0,
                tiersDeactivated: 0,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Sync members from Patreon API
     */
    static async syncMembers(): Promise<{ success: boolean; membersUpdated: number; membersCleared: number; error?: string }> {
        if (!this.CAMPAIGN_ID || !this.CREATOR_ACCESS_TOKEN) {
            return { success: false, membersUpdated: 0, membersCleared: 0, error: 'Missing Patreon configuration' };
        }

        try {
            console.log('[PATREON_SYNC] Starting member synchronization...');

            // Fetch members from Patreon API
            const response = await fetch(
                `${this.PATREON_API_BASE}/campaigns/${this.CAMPAIGN_ID}/members?include=user,currently_entitled_tiers&fields%5Bmember%5D=patron_status,currently_entitled_amount_cents,last_charge_status&fields%5Buser%5D=email`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.CREATOR_ACCESS_TOKEN}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (!response.ok) {
                throw new Error(`Patreon API error: ${response.status} - ${response.statusText}`);
            }

            const data: PatreonMemberResponse = await response.json();
            const activePatreonUserIds = new Set<string>();

            let membersUpdated = 0;

            // Process each member from Patreon
            for (const memberData of data.data) {
                const patreonUserId = memberData.relationships.user.data.id;
                activePatreonUserIds.add(patreonUserId);

                // Find user by patreon_user_id
                const user = await User.findOne({ where: { patreonUserId } });

                if (!user) {
                    console.log(`[PATREON_SYNC] User not found for Patreon user ID: ${patreonUserId}`);
                    continue;
                }

                // Get the highest entitled tier
                const entitledTiers = memberData.relationships.currently_entitled_tiers.data;
                let highestTier: PatreonTier | null = null;
                let highestAmount = 0;

                for (const tierRef of entitledTiers) {
                    const tier = await PatreonTier.findOne({ where: { id: tierRef.id } });
                    if (tier && tier.amountCents > highestAmount) {
                        highestTier = tier;
                        highestAmount = tier.amountCents;
                    }
                }

                // Update user's Patreon data
                const isActive = memberData.attributes.patron_status === 'active_patron' &&
                    memberData.attributes.last_charge_status === 'Paid';

                user.patreonTierId = highestTier?.id || null;
                user.patreonStatus = memberData.attributes.patron_status;
                user.patreonEntitledAmount = memberData.attributes.currently_entitled_amount_cents;
                user.patreonIsActive = isActive;
                user.patreonLastVerified = new Date();

                await user.save();
                membersUpdated++;
                console.log(`[PATREON_SYNC] Updated user ${user.username} - Tier: ${highestTier?.name || 'None'}`);
            }

            // Clear tier assignments for users who are no longer members
            const allPatreonUsers = await User.find({
                where: [
                    { patreonUserId: Not(null) as any }
                ]
            });

            let membersCleared = 0;

            for (const user of allPatreonUsers) {
                if (user.patreonUserId && !activePatreonUserIds.has(user.patreonUserId)) {
                    user.patreonTierId = null;
                    user.patreonStatus = null;
                    user.patreonIsActive = false;
                    user.patreonLastVerified = new Date();
                    await user.save();
                    membersCleared++;
                    console.log(`[PATREON_SYNC] Cleared tier for inactive user: ${user.username}`);
                }
            }

            // Create audit log
            await this.createAuditLog(AuditAction.PATREON_MEMBER_SYNC, {
                membersUpdated,
                membersCleared,
                totalActiveMembers: activePatreonUserIds.size
            });

            console.log(`[PATREON_SYNC] Member sync completed: ${membersUpdated} updated, ${membersCleared} cleared`);

            return { success: true, membersUpdated, membersCleared };
        } catch (error) {
            console.error('[PATREON_SYNC] Error syncing members:', error);
            return {
                success: false,
                membersUpdated: 0,
                membersCleared: 0,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Full sync: tiers + members
     */
    static async fullSync(): Promise<{
        success: boolean;
        tiers: { tiersAdded: number; tiersUpdated: number; tiersDeactivated: number };
        members: { membersUpdated: number; membersCleared: number };
        error?: string;
    }> {
        console.log('[PATREON_SYNC] Starting full synchronization...');

        // Sync tiers first
        const tierResult = await this.syncTiers();
        if (!tierResult.success) {
            return {
                success: false,
                tiers: { tiersAdded: 0, tiersUpdated: 0, tiersDeactivated: 0 },
                members: { membersUpdated: 0, membersCleared: 0 },
                error: tierResult.error
            };
        }

        // Then sync members
        const memberResult = await this.syncMembers();
        if (!memberResult.success) {
            return {
                success: false,
                tiers: { tiersAdded: tierResult.tiersAdded, tiersUpdated: tierResult.tiersUpdated, tiersDeactivated: tierResult.tiersDeactivated },
                members: { membersUpdated: 0, membersCleared: 0 },
                error: memberResult.error
            };
        }

        console.log('[PATREON_SYNC] Full sync completed successfully');

        return {
            success: true,
            tiers: {
                tiersAdded: tierResult.tiersAdded,
                tiersUpdated: tierResult.tiersUpdated,
                tiersDeactivated: tierResult.tiersDeactivated
            },
            members: {
                membersUpdated: memberResult.membersUpdated,
                membersCleared: memberResult.membersCleared
            }
        };
    }

    /**
     * Get last sync timestamp
     */
    static async getLastSyncTimestamp(): Promise<Date | null> {
        const lastAudit = await AuditLog.findOne({
            where: [
                { action: AuditAction.PATREON_TIER_SYNC },
                { action: AuditAction.PATREON_MEMBER_SYNC }
            ],
            order: { createdAt: 'DESC' }
        });

        return lastAudit?.createdAt || null;
    }

    /**
     * Create audit log for sync operations
     */
    private static async createAuditLog(action: AuditAction, details: any): Promise<void> {
        try {
            const SYSTEM_USER = await User.findOne({ where: { email: SYSTEM_EMAIL } });
            const auditLog = AuditLog.create({
                user: SYSTEM_USER ?? undefined, // System action (relation)
                action,
                details,
                ipAddress: null,
                userAgent: null
            });

            await auditLog.save();

        } catch (error) {
            console.error('[PATREON_SYNC] Error creating audit log:', error);
        }
    }
}
