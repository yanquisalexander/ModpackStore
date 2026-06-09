// src/stores/ConfigDialogContext.tsx
import { createContext, useContext, useState, ReactNode, useEffect, useCallback, useMemo } from 'react';

interface ConfigDialogContextType {
    isConfigOpen: boolean;
    openConfigDialog: () => void;
    closeConfigDialog: () => void;
}

const ConfigDialogContext = createContext<ConfigDialogContextType | undefined>(undefined);

export function ConfigDialogProvider({ children }: { children: ReactNode }) {
    const [isConfigOpen, setIsConfigOpen] = useState(false);

    const openConfigDialog = useCallback(() => setIsConfigOpen(true), []);
    const closeConfigDialog = useCallback(() => setIsConfigOpen(false), []);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.ctrlKey && event.key === ',') {
                event.preventDefault();
                openConfigDialog();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    const value = useMemo(() => ({
        isConfigOpen, openConfigDialog, closeConfigDialog,
    }), [isConfigOpen, openConfigDialog, closeConfigDialog]);

    return (
        <ConfigDialogContext.Provider value={value}>
            {children}
        </ConfigDialogContext.Provider>
    );
}

export function useConfigDialog() {
    const context = useContext(ConfigDialogContext);
    if (context === undefined) {
        throw new Error('useConfigDialog must be used within a ConfigDialogProvider');
    }
    return context;
}