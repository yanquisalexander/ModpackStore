import React, { createContext, useContext, ReactNode } from 'react';
import { useTheme, UseThemeReturn } from '../hooks/useTheme';

const ThemeContext = createContext<UseThemeReturn | undefined>(undefined);

interface ThemeProviderProps {
    children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
    const theme = useTheme();

    return (
        <ThemeContext.Provider value={theme}>
            {children}
        </ThemeContext.Provider>
    );
}

/**
 * Hook to use theme context
 * Must be used within a ThemeProvider
 */
export function useThemeContext(): UseThemeReturn {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useThemeContext must be used within a ThemeProvider');
    }
    return context;
}

/**
 * HOC to inject theme into component props
 */
export function withTheme<P extends object>(
    Component: React.ComponentType<P & { theme: UseThemeReturn }>
) {
    return function ThemedComponent(props: P) {
        const theme = useThemeContext();
        return <Component {...props} theme={theme} />;
    };
}
