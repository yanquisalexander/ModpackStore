import { useState, useEffect, useCallback } from 'react';
import { getUserFlags as fetchUserFlags } from '@/services/userFlags';
import { UserFlags, DEFAULT_USER_FLAGS } from '@/types/userFlags';
import { useAuthentication } from '@/stores/AuthContext';

/**
 * Hook state interface
 */
interface UseUserFlagsState {
    flags: UserFlags;
    loading: boolean;
    error: Error | null;
    refetch: () => Promise<void>;
}

/**
 * React hook to fetch and manage user flags
 * 
 * Features:
 * - Automatically fetches flags when user is authenticated
 * - Caches flags in component state
 * - Provides refetch function for manual updates
 * - Returns default flags when user is not authenticated
 * - Handles errors gracefully
 * 
 * @returns UseUserFlagsState object with flags, loading state, error, and refetch function
 * 
 * @example
 * ```tsx
 * const MyComponent = () => {
 *   const { flags, loading, error, refetch } = useUserFlags();
 * 
 *   if (loading) return <div>Loading flags...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 * 
 *   return (
 *     <div>
 *       <p>Max instances: {flags.max_instances_allowed}</p>
 *       <p>Can upload cover: {flags.can_upload_cover_image ? 'Yes' : 'No'}</p>
 *       <button onClick={refetch}>Refresh flags</button>
 *     </div>
 *   );
 * };
 * ```
 */
export function useUserFlags(): UseUserFlagsState {
    const { isAuthenticated, loading: authLoading } = useAuthentication();
    const [flags, setFlags] = useState<UserFlags>(DEFAULT_USER_FLAGS);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<Error | null>(null);

    /**
     * Fetch user flags from the API
     */
    const fetchFlags = useCallback(async () => {
        if (!isAuthenticated) {
            // If not authenticated, use default flags
            setFlags(DEFAULT_USER_FLAGS);
            setLoading(false);
            setError(null);
            return;
        }

        try {
            setLoading(true);
            setError(null);
            const userFlags = await fetchUserFlags();
            setFlags(userFlags);
        } catch (err) {
            console.error('[useUserFlags] Error fetching flags:', err);
            setError(err instanceof Error ? err : new Error('Failed to fetch user flags'));
            // Keep using current flags or default flags on error
        } finally {
            setLoading(false);
        }
    }, [isAuthenticated]);

    /**
     * Fetch flags when authentication state changes
     */
    useEffect(() => {
        // Don't fetch if auth is still loading
        if (authLoading) {
            return;
        }

        fetchFlags();
    }, [isAuthenticated, authLoading, fetchFlags]);

    return {
        flags,
        loading,
        error,
        refetch: fetchFlags,
    };
}

/**
 * Hook to check if a specific flag is enabled
 * Convenience wrapper around useUserFlags
 * 
 * @param flagKey - Key of the flag to check
 * @returns Object with flag value, loading state, and error
 * 
 * @example
 * ```tsx
 * const MyComponent = () => {
 *   const { value: canUploadCover, loading } = useFlag('can_upload_cover_image');
 * 
 *   if (loading) return <div>Loading...</div>;
 * 
 *   return canUploadCover ? <UploadButton /> : <PremiumPrompt />;
 * };
 * ```
 */
export function useFlag(flagKey: keyof UserFlags) {
    const { flags, loading, error } = useUserFlags();

    return {
        value: flags[flagKey],
        loading,
        error,
    };
}

/**
 * Hook to check if user can perform an action based on a numeric limit
 * Convenience wrapper around useUserFlags
 * 
 * @param flagKey - Key of the limit flag
 * @param currentCount - Current count of items
 * @returns Object with allowed status, limit, remaining count, loading state, and error
 * 
 * @example
 * ```tsx
 * const MyComponent = () => {
 *   const instanceCount = 5;
 *   const { allowed, limit, remaining, loading } = useActionLimit('max_instances_allowed', instanceCount);
 * 
 *   if (loading) return <div>Loading...</div>;
 * 
 *   return (
 *     <div>
 *       <p>Instances: {instanceCount} / {limit}</p>
 *       <p>Remaining: {remaining}</p>
 *       <button disabled={!allowed}>Create New Instance</button>
 *     </div>
 *   );
 * };
 * ```
 */
export function useActionLimit(flagKey: keyof UserFlags, currentCount: number) {
    const { flags, loading, error } = useUserFlags();

    const value = flags[flagKey];
    const limit = typeof value === 'number' ? value : 0;
    const remaining = Math.max(0, limit - currentCount);
    const allowed = currentCount < limit;

    return {
        allowed,
        limit,
        remaining,
        loading,
        error,
    };
}
