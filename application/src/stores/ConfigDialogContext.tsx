// src/stores/ConfigDialogContext.tsx
import { createContext, useContext, useState, ReactNode, useEffect } from 'react';

interface ConfigDialogContextType {
    isConfigOpen: boolean;
    openConfigDialog: () => void;
    closeConfigDialog: () => void;
}

const ConfigDialogContext = createContext<ConfigDialogContextType | undefined>(undefined);

export function ConfigDialogProvider({ children }: { children: ReactNode }) {
    const [isConfigOpen, setIsConfigOpen] = useState(false);

    const openConfigDialog = () => setIsConfigOpen(true);
    const closeConfigDialog = () => setIsConfigOpen(false);

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

    return (
        <ConfigDialogContext.Provider value={{ isConfigOpen, openConfigDialog, closeConfigDialog }}>
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