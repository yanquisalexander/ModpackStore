import { createContext, useContext, useState, ReactNode, useMemo, useCallback } from 'react';

// Layout Context
interface LayoutContextType {
    hasSidebar: boolean;
    setHasSidebar: (has: boolean) => void;
}

const LayoutContext = createContext<LayoutContextType | undefined>(undefined);

export const useLayout = () => {
    const context = useContext(LayoutContext);
    if (!context) {
        throw new Error('useLayout must be used within a LayoutProvider');
    }
    return context;
};

interface LayoutProviderProps {
    children: ReactNode;
}

export const LayoutProvider: React.FC<LayoutProviderProps> = ({ children }) => {
    const [hasSidebar, setHasSidebar] = useState(true);

    const setSidebar = useCallback((has: boolean) => setHasSidebar(has), []);

    const value = useMemo(() => ({
        hasSidebar,
        setHasSidebar: setSidebar,
    }), [hasSidebar, setSidebar]);

    return (
        <LayoutContext.Provider value={value}>
            {children}
        </LayoutContext.Provider>
    );
};