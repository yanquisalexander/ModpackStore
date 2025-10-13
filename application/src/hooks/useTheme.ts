import { useState, useEffect, useCallback } from 'react';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';

export interface Theme {
    id: string;
    name: string;
    description?: string;
    author?: string;
    version?: string;
    is_premium: boolean;
    is_external: boolean;
    variables: Record<string, string>;
}

export interface UseThemeReturn {
    theme: Theme | null;
    themes: Theme[];
    freeThemes: Theme[];
    premiumThemes: Theme[];
    setTheme: (themeId: string) => Promise<void>;
    reloadExternalThemes: () => Promise<void>;
    isLoading: boolean;
}

/**
 * Hook for theme management
 * Automatically listens for theme changes and provides theme switching functions
 */
export function useTheme(): UseThemeReturn {
    const [currentTheme, setCurrentTheme] = useState<Theme | null>(null);
    const [allThemes, setAllThemes] = useState<Theme[]>([]);
    const [freeThemes, setFreeThemes] = useState<Theme[]>([]);
    const [premiumThemes, setPremiumThemes] = useState<Theme[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Load initial themes
    useEffect(() => {
        const loadInitialData = async () => {
            try {
                setIsLoading(true);

                // Get all available themes
                const themes = await invoke<Theme[]>('get_available_themes');
                setAllThemes(themes);

                // Get free themes
                const free = await invoke<Theme[]>('get_free_themes');
                setFreeThemes(free);

                // Get premium themes
                const premium = await invoke<Theme[]>('get_premium_themes');
                setPremiumThemes(premium);

                // Get current theme
                const current = await invoke<Theme>('get_current_theme');
                setCurrentTheme(current);

                // Apply theme variables
                applyThemeVariables(current);
            } catch (error) {
                console.error('Failed to load theme data:', error);
                // Fallback to dark theme if there's an error
                setCurrentTheme({
                    id: 'dark',
                    name: 'Dark',
                    description: 'Default dark theme',
                    is_premium: false,
                    is_external: false,
                    variables: {}
                });
            } finally {
                setIsLoading(false);
            }
        };

        loadInitialData();
    }, []);

    // Listen for theme change events
    useEffect(() => {
        const unlisten = listen<Theme>('theme-changed', (event) => {
            setCurrentTheme(event.payload);
            applyThemeVariables(event.payload);
        });

        return () => {
            unlisten.then(fn => fn());
        };
    }, []);

    // Function to apply theme variables to CSS
    const applyThemeVariables = useCallback((theme: Theme) => {
        const root = document.documentElement;
        
        // Apply all theme variables
        Object.entries(theme.variables).forEach(([key, value]) => {
            root.style.setProperty(key, value);
        });

        // Add dark class to body for compatibility
        document.body.classList.add('dark');
    }, []);

    // Set theme function
    const setTheme = useCallback(async (themeId: string): Promise<void> => {
        try {
            await invoke('set_theme', { themeId });
            // The theme-changed event will update the state
        } catch (error) {
            console.error('Failed to set theme:', error);
            throw error;
        }
    }, []);

    // Reload external themes function
    const reloadExternalThemes = useCallback(async (): Promise<void> => {
        try {
            const premium = await invoke<Theme[]>('reload_external_themes');
            setPremiumThemes(premium);

            // Reload all themes
            const themes = await invoke<Theme[]>('get_available_themes');
            setAllThemes(themes);
        } catch (error) {
            console.error('Failed to reload external themes:', error);
            throw error;
        }
    }, []);

    return {
        theme: currentTheme,
        themes: allThemes,
        freeThemes,
        premiumThemes,
        setTheme,
        reloadExternalThemes,
        isLoading
    };
}

/**
 * Hook for getting the current theme
 */
export function useCurrentTheme(): Theme | null {
    const { theme } = useTheme();
    return theme;
}

/**
 * Hook for theme switching functionality
 */
export function useThemeSwitcher() {
    const { theme, themes, freeThemes, premiumThemes, setTheme, isLoading } = useTheme();

    return {
        currentTheme: theme,
        allThemes: themes,
        freeThemes,
        premiumThemes,
        setTheme,
        isLoading
    };
}
