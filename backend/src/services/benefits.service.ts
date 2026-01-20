import { PatreonTier } from "@/entities/PatreonTier";
import { User } from "@/entities/User";
import { UserRole } from "@/types/enums";
import { BENEFIT_DEFINITIONS, getBenefitDefinition } from "@/config/benefitDefinitions";

export class BenefitsService {
    /**
     * Get benefit definitions
     */
    static getBenefitDefinitions() {
        return BENEFIT_DEFINITIONS;
    }

    /**
     * Get benefit value for a user
     */
    static async getBenefit(userId: string, benefitKey: string): Promise<number | boolean | string | null> {
        const benefitDef = getBenefitDefinition(benefitKey);

        if (!benefitDef) {
            console.error(`[BENEFITS] Unknown benefit key: ${benefitKey}`);
            return null;
        }

        const user = await User.findOne({
            where: { id: userId },
            relations: ['patreonTierRelation']
        });

        if (!user) {
            return benefitDef.defaultValue;
        }

        // Check if user is admin or superadmin - they get highest tier benefits
        if (user.role === UserRole.ADMIN || user.role === UserRole.SUPERADMIN) {
            const highestTier = await PatreonTier.findOne({
                where: { active: true },
                order: { amountCents: 'DESC' }
            });

            if (highestTier && highestTier.metadata && benefitKey in highestTier.metadata) {
                return highestTier.metadata[benefitKey];
            }
        }

        // Check if user has an active Patreon tier
        if (!user.patreonIsActive || !user.patreonTierRelation) {
            return benefitDef.defaultValue;
        }

        // Get benefit from tier metadata
        const tierMetadata = user.patreonTierRelation.metadata;
        if (tierMetadata && benefitKey in tierMetadata) {
            return tierMetadata[benefitKey];
        }

        // Return default if not configured
        return benefitDef.defaultValue;
    }

    /**
     * Get all benefits for a user
     */
    static async getAllBenefits(userId: string): Promise<Record<string, number | boolean | string>> {
        const benefits: Record<string, number | boolean | string> = {};

        for (const benefit of BENEFIT_DEFINITIONS) {
            const value = await this.getBenefit(userId, benefit.id);
            benefits[benefit.id] = (value !== null && value !== undefined) ? value : benefit.defaultValue;
        }

        return benefits;
    }

    /**
     * Check if user has a boolean benefit
     */
    static async hasBenefit(userId: string, benefitKey: string): Promise<boolean> {
        const value = await this.getBenefit(userId, benefitKey);
        if (typeof value === 'boolean') return value;
        if (typeof value === 'number') return value > 0;
        return false;
    }

    /**
     * Get numeric benefit value
     */
    static async getNumericBenefit(userId: string, benefitKey: string): Promise<number> {
        const value = await this.getBenefit(userId, benefitKey);
        return typeof value === 'number' ? value : 0;
    }

    /**
     * Check if user can perform an action based on benefit limits
     */
    static async canPerformAction(
        userId: string,
        benefitKey: string,
        currentCount: number
    ): Promise<{ allowed: boolean; limit: number; remaining: number }> {
        const limit = await this.getNumericBenefit(userId, benefitKey);
        const remaining = Math.max(0, limit - currentCount);
        const allowed = currentCount < limit;

        return { allowed, limit, remaining };
    }
}

