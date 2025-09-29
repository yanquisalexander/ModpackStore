import { createContext, useContext, useState, ReactNode } from 'react';

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

    return (
        <LayoutContext.Provider value={{ hasSidebar, setHasSidebar }}>
            {children}
        </LayoutContext.Provider>
    );
};