import { API_ENDPOINT } from "@/consts";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { UserFlags, DEFAULT_USER_FLAGS } from "@/types/userFlags";

/**
 * Response type from the backend API
 */
interface UserFlagsResponse {
    data: UserFlags;
}

/**
 * Fetch user flags from the backend API
 * Requires authentication
 * 
 * @returns Promise<UserFlags> - User's feature flags and benefits
 * @throws Error if the request fails
 */
export async function getUserFlags(): Promise<UserFlags> {
    try {
        const response = await fetchWithAuth(`${API_ENDPOINT}/auth/flags`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch user flags: ${response.statusText}`);
        }

        const data: UserFlagsResponse = await response.json();
        return data.data;
    } catch (error) {
        console.error('[USER_FLAGS] Error fetching user flags:', error);
        // Return default flags on error
        return DEFAULT_USER_FLAGS;
    }
}

/**
 * Check if a user has a specific flag enabled
 * 
 * @param flags - UserFlags object
 * @param flagKey - Key of the flag to check
 * @returns boolean indicating if the flag is enabled
 */
export function hasFlag(flags: UserFlags, flagKey: keyof UserFlags): boolean {
    const value = flags[flagKey];
    
    if (typeof value === 'boolean') {
        return value;
    }
    
    if (typeof value === 'number') {
        return value > 0;
    }
    
    return false;
}

/**
 * Get a numeric flag value
 * 
 * @param flags - UserFlags object
 * @param flagKey - Key of the numeric flag
 * @returns number value of the flag, or 0 if not numeric
 */
export function getNumericFlag(flags: UserFlags, flagKey: keyof UserFlags): number {
    const value = flags[flagKey];
    return typeof value === 'number' ? value : 0;
}

/**
 * Check if user can perform an action based on a numeric limit
 * 
 * @param flags - UserFlags object
 * @param flagKey - Key of the limit flag
 * @param currentCount - Current count of items
 * @returns Object with allowed status, limit, and remaining count
 */
export function canPerformAction(
    flags: UserFlags,
    flagKey: keyof UserFlags,
    currentCount: number
): { allowed: boolean; limit: number; remaining: number } {
    const limit = getNumericFlag(flags, flagKey);
    const remaining = Math.max(0, limit - currentCount);
    const allowed = currentCount < limit;

    return { allowed, limit, remaining };
}
