import { useState, useEffect } from 'react';
import { useAuthentication } from '@/stores/AuthContext';
import { whitelistService } from '@/services/whitelist.service';
import { UserWhitelistInfo } from '@/types/whitelist';

interface WhitelistModeState {
    hasWhitelists: boolean;
    whitelistCount: number;
    loading: boolean;
    error: string | null;
    isWhitelistMode: boolean; // User preference to show whitelist-first UI
}

/**
 * Custom hook to manage whitelist mode for the launcher
 * This determines if the user should see a whitelist-first UI
 */
export const useWhitelistMode = () => {
    const { sessionTokens, isAuthenticated } = useAuthentication();
    const [state, setState] = useState<WhitelistModeState>({
        hasWhitelists: false,
        whitelistCount: 0,
        loading: true,
        error: null,
        isWhitelistMode: false
    });

    // Load whitelist mode preference from localStorage
    useEffect(() => {
        const savedPreference = localStorage.getItem('whitelistMode');
        if (savedPreference !== null) {
            setState(prev => ({
                ...prev,
                isWhitelistMode: savedPreference === 'true'
            }));
        }
    }, []);

    // Check if user has any whitelists
    useEffect(() => {
        const checkWhitelists = async () => {
            if (!isAuthenticated || !sessionTokens?.accessToken) {
                setState({
                    hasWhitelists: false,
                    whitelistCount: 0,
                    loading: false,
                    error: null,
                    isWhitelistMode: false
                });
                return;
            }

            try {
                setState(prev => ({ ...prev, loading: true, error: null }));
                
                const info: UserWhitelistInfo = await whitelistService.hasAnyWhitelists(
                    sessionTokens.accessToken
                );

                // Auto-enable whitelist mode if user has whitelists and hasn't manually disabled it
                const savedPreference = localStorage.getItem('whitelistMode');
                const shouldEnableWhitelistMode = info.hasWhitelists && savedPreference !== 'false';

                setState({
                    hasWhitelists: info.hasWhitelists,
                    whitelistCount: info.count,
                    loading: false,
                    error: null,
                    isWhitelistMode: shouldEnableWhitelistMode
                });

                // Save preference if auto-enabling
                if (shouldEnableWhitelistMode && savedPreference === null) {
                    localStorage.setItem('whitelistMode', 'true');
                }
            } catch (error) {
                console.error('Error checking whitelists:', error);
                setState(prev => ({
                    ...prev,
                    loading: false,
                    error: error instanceof Error ? error.message : 'Failed to check whitelists'
                }));
            }
        };

        checkWhitelists();
    }, [isAuthenticated, sessionTokens?.accessToken]);

    // Toggle whitelist mode preference
    const setWhitelistMode = (enabled: boolean) => {
        setState(prev => ({ ...prev, isWhitelistMode: enabled }));
        localStorage.setItem('whitelistMode', enabled.toString());
    };

    // Force refresh whitelist check
    const refreshWhitelistCheck = async () => {
        if (!isAuthenticated || !sessionTokens?.accessToken) return;

        try {
            setState(prev => ({ ...prev, loading: true }));
            
            const info: UserWhitelistInfo = await whitelistService.hasAnyWhitelists(
                sessionTokens.accessToken
            );

            setState(prev => ({
                ...prev,
                hasWhitelists: info.hasWhitelists,
                whitelistCount: info.count,
                loading: false,
                error: null
            }));
        } catch (error) {
            console.error('Error refreshing whitelists:', error);
            setState(prev => ({
                ...prev,
                loading: false,
                error: error instanceof Error ? error.message : 'Failed to refresh whitelists'
            }));
        }
    };

    return {
        ...state,
        setWhitelistMode,
        refreshWhitelistCheck
    };
};
