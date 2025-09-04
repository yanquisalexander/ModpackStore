// ConnectionContext.tsx
import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";

interface ConnectionState {
    isConnected: boolean;
    hasInternetAccess: boolean;
    isLoading: boolean;
}

interface ConnectionContextType extends ConnectionState {
    refreshConnection: () => Promise<void>;
}

const ConnectionContext = createContext<ConnectionContextType | undefined>(undefined);

export const useConnection = () => {
    const context = useContext(ConnectionContext);
    if (!context) {
        throw new Error("useConnection must be used within a ConnectionProvider");
    }
    return context;
};

interface ConnectionProviderProps {
    children: React.ReactNode;
}

export const ConnectionProvider: React.FC<ConnectionProviderProps> = ({ children }) => {
    const [isConnected, setIsConnected] = useState<boolean>(false);
    const [hasInternetAccess, setHasInternetAccess] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    // Ref para controlar si ya se ejecutó la verificación inicial
    const hasCheckedRef = useRef<boolean>(false);

    const checkConnection = async () => {
        try {
            console.log("[checkConnection] Checking connection...");
            const response = await Promise.race([
                invoke("check_connection"),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Connection check timeout')), 5000))
            ]);
            setIsConnected(response as boolean);
            console.log("[checkConnection] Connection status:", response);
        } catch (error) {
            console.error("[checkConnection] Error or timeout checking connection:", error);
            setIsConnected(false); // Asumir desconectado en caso de error o timeout
        }
    };

    const checkInternetAccess = async () => {
        try {
            console.log("[checkInternetAccess] Checking internet access...");
            const response = await Promise.race([
                invoke("check_real_connection"),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Internet check timeout')), 5000))
            ]);
            setHasInternetAccess(response as boolean);
            console.log("[checkInternetAccess] Internet access status:", response);
        } catch (error) {
            console.error("[checkInternetAccess] Error or timeout checking internet access:", error);
            setHasInternetAccess(false); // Asumir sin internet en caso de error o timeout
        }
    };

    const refreshConnection = async () => {
        setIsLoading(true);
        try {
            await Promise.all([checkConnection(), checkInternetAccess()]);
        } catch (error) {
            console.error("[refreshConnection] Error in connection checks:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        // Si ya se verificó, no hacer nada
        if (hasCheckedRef.current) {
            return;
        }

        const performInitialChecks = async () => {
            await refreshConnection();
            hasCheckedRef.current = true;
        };

        performInitialChecks();
    }, []);

    const value: ConnectionContextType = {
        isConnected,
        hasInternetAccess,
        isLoading,
        refreshConnection,
    };

    return (
        <ConnectionContext.Provider value={value}>
            {children}
        </ConnectionContext.Provider>
    );
};