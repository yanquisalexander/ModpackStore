/**
 * User flags interface representing Modpack Store+ benefits
 * These flags are obtained from the backend and reflect the user's Patreon tier
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
 * Default flags for unauthenticated or free users
 */
export const DEFAULT_USER_FLAGS: UserFlags = {
    max_instances_allowed: 10,
    max_modpack_size_mb: 100,
    can_upload_cover_image: false,
    can_create_private_modpacks: false,
    can_create_patreon_exclusive: false,
    priority_support: false,
    early_access_features: false,
    custom_badges: false,
    max_storage_gb: 5,
    max_publishers: 1,
    max_modpacks_per_publisher: 10,
    advanced_analytics: false,
    api_rate_limit_multiplier: 1.0,
};
