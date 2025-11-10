import { User } from "@/entities/User";
import { BenefitsService } from "@/services/benefits.service";
import { UserRole } from "@/types/enums";

/**
 * User flags interface representing Modpack Store+ benefits
 */
export interface UserFlags {
    // Instance limits
    max_instances_allowed: number;
    
    // Upload limits
    max_modpack_size_mb: number;
    
    // Feature flags
    can_upload_cover_image: boolean;
    can_create_private_modpacks: boolean;
    can_create_patreon_exclusive: boolean;
    priority_support: boolean;
    early_access_features: boolean;
    custom_badges: boolean;
    
    // Storage limits
    max_storage_gb: number;
    
    // Publishing limits
    max_publishers: number;
    max_modpacks_per_publisher: number;
    
    // Analytics
    advanced_analytics: boolean;
    
    // API access
    api_rate_limit_multiplier: number;
}

/**
 * Get user flags (benefits) for a specific user
 * This is a convenience wrapper around BenefitsService.getAllBenefits
 * 
 * @param userId - User ID to get flags for
 * @returns UserFlags object with all benefits
 */
export async function getUserFlags(userId: string): Promise<UserFlags> {
    const benefits = await BenefitsService.getAllBenefits(userId);
    return benefits as UserFlags;
}

/**
 * Get user flags from an authenticated request context
 * Expects the user to be attached to the context by auth middleware
 * 
 * @param user - User object from auth middleware
 * @returns UserFlags object with all benefits
 */
export async function getFlagsForUser(user: User): Promise<UserFlags> {
    return getUserFlags(user.id);
}

/**
 * Get default flags for unauthenticated or free users
 * These are the baseline benefits for all users
 * 
 * @returns UserFlags object with default values
 */
export function getDefaultFlags(): UserFlags {
    const benefitDefinitions = BenefitsService.getBenefitDefinitions();
    const defaultFlags: any = {};
    
    for (const [key, definition] of Object.entries(benefitDefinitions)) {
        defaultFlags[key] = definition.default;
    }
    
    return defaultFlags as UserFlags;
}

/**
 * Check if a user has a specific flag enabled
 * 
 * @param userId - User ID to check
 * @param flagKey - Flag key to check
 * @returns Boolean indicating if the flag is enabled
 */
export async function hasFlag(userId: string, flagKey: keyof UserFlags): Promise<boolean> {
    return BenefitsService.hasBenefit(userId, flagKey);
}

/**
 * Get a numeric flag value for a user
 * 
 * @param userId - User ID to get flag for
 * @param flagKey - Flag key to get
 * @returns Numeric value of the flag
 */
export async function getNumericFlag(userId: string, flagKey: keyof UserFlags): Promise<number> {
    return BenefitsService.getNumericBenefit(userId, flagKey);
}
