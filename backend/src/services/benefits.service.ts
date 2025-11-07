import * as fs from "fs";
import * as path from "path";
import * as yaml from "yaml";
import { PatreonTier } from "@/entities/PatreonTier";
import { User } from "@/entities/User";

interface BenefitDefinition {
    type: 'number' | 'boolean';
    name: string;
    description: string;
    default: number | boolean;
    validator: string;
}

interface BenefitsConfig {
    benefits: Record<string, BenefitDefinition>;
    validators: Record<string, any>;
}

export class BenefitsService {
    private static config: BenefitsConfig | null = null;

    /**
     * Load benefits configuration from YAML file
     */
    private static loadConfig(): BenefitsConfig {
        if (this.config) {
            return this.config;
        }

        const configPath = path.join(__dirname, '../config/benefits_modpackstore_plus.yml');
        const configContent = fs.readFileSync(configPath, 'utf8');
        this.config = yaml.parse(configContent);

        return this.config!;
    }

    /**
     * Get benefit value for a user
     */
    static async getBenefit(userId: string, benefitKey: string): Promise<number | boolean | null> {
        const config = this.loadConfig();
        const benefitDef = config.benefits[benefitKey];

        if (!benefitDef) {
            console.error(`[BENEFITS] Unknown benefit key: ${benefitKey}`);
            return null;
        }

        const user = await User.findOne({ 
            where: { id: userId },
            relations: ['patreonTierRelation']
        });

        if (!user) {
            return benefitDef.default;
        }

        // Check if user has an active Patreon tier
        if (!user.patreonIsActive || !user.patreonTierRelation) {
            return benefitDef.default;
        }

        // Get benefit from tier metadata
        const tierMetadata = user.patreonTierRelation.metadata;
        if (tierMetadata && benefitKey in tierMetadata) {
            return tierMetadata[benefitKey];
        }

        // Return default if not configured
        return benefitDef.default;
    }

    /**
     * Get all benefits for a user
     */
    static async getAllBenefits(userId: string): Promise<Record<string, number | boolean>> {
        const config = this.loadConfig();
        const benefits: Record<string, number | boolean> = {};

        for (const benefitKey in config.benefits) {
            const value = await this.getBenefit(userId, benefitKey);
            benefits[benefitKey] = value ?? config.benefits[benefitKey].default;
        }

        return benefits;
    }

    /**
     * Check if user has a specific benefit enabled
     */
    static async hasBenefit(userId: string, benefitKey: string): Promise<boolean> {
        const value = await this.getBenefit(userId, benefitKey);
        
        if (typeof value === 'boolean') {
            return value;
        }

        if (typeof value === 'number') {
            return value > 0;
        }

        return false;
    }

    /**
     * Get numeric benefit value
     */
    static async getNumericBenefit(userId: string, benefitKey: string): Promise<number> {
        const value = await this.getBenefit(userId, benefitKey);
        
        if (typeof value === 'number') {
            return value;
        }

        const config = this.loadConfig();
        const defaultValue = config.benefits[benefitKey]?.default;
        
        return typeof defaultValue === 'number' ? defaultValue : 0;
    }

    /**
     * Validate benefit value according to validator rules
     */
    static validateBenefit(benefitKey: string, value: any): { valid: boolean; error?: string } {
        const config = this.loadConfig();
        const benefitDef = config.benefits[benefitKey];

        if (!benefitDef) {
            return { valid: false, error: 'Unknown benefit key' };
        }

        // Type validation
        if (benefitDef.type === 'number' && typeof value !== 'number') {
            return { valid: false, error: 'Value must be a number' };
        }

        if (benefitDef.type === 'boolean' && typeof value !== 'boolean') {
            return { valid: false, error: 'Value must be a boolean' };
        }

        // Validator-specific validation
        const validator = config.validators[benefitDef.validator];
        if (!validator) {
            return { valid: true }; // No validator, consider valid
        }

        if (validator.min !== undefined && typeof value === 'number') {
            if (value < validator.min) {
                return { valid: false, error: `Value must be at least ${validator.min}` };
            }
        }

        if (validator.values && Array.isArray(validator.values)) {
            if (!validator.values.includes(value)) {
                return { valid: false, error: `Value must be one of: ${validator.values.join(', ')}` };
            }
        }

        return { valid: true };
    }

    /**
     * Set tier benefits (metadata)
     */
    static async setTierBenefits(tierId: string, benefits: Record<string, any>): Promise<{ success: boolean; errors?: string[] }> {
        const errors: string[] = [];

        // Validate all benefits
        for (const [key, value] of Object.entries(benefits)) {
            const validation = this.validateBenefit(key, value);
            if (!validation.valid) {
                errors.push(`${key}: ${validation.error}`);
            }
        }

        if (errors.length > 0) {
            return { success: false, errors };
        }

        // Update tier metadata
        const tier = await PatreonTier.findOne({ where: { id: tierId } });
        if (!tier) {
            return { success: false, errors: ['Tier not found'] };
        }

        tier.metadata = {
            ...tier.metadata,
            ...benefits
        };

        await tier.save();

        return { success: true };
    }

    /**
     * Get all available benefit definitions
     */
    static getBenefitDefinitions(): Record<string, BenefitDefinition> {
        const config = this.loadConfig();
        return config.benefits;
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
