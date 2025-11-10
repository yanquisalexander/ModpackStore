/**
 * User flags interface representing Modpack Store+ benefits
 * These flags are obtained from the backend and reflect the user's Patreon tier
 */
export interface UserFlags {
    max_instances_allowed: number;

    // Feature flags
    can_upload_cover_image: boolean;
    priority_support: boolean;
    early_access_features: boolean;
    custom_badges: boolean;

}

/**
 * Default flags for unauthenticated or free users
 */
export const DEFAULT_USER_FLAGS: UserFlags = {
    max_instances_allowed: 10,
    can_upload_cover_image: false,
    priority_support: false,
    early_access_features: false,
    custom_badges: false,
};
