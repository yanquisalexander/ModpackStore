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
    const [isLoading, setIsLoading] = useState<boolean>(false); // Start as false to prevent hanging

    // Ref para controlar si ya se ejecutó la verificación inicial
    const hasCheckedRef = useRef<boolean>(false);

    const checkConnection = async () => {
        try {
            console.log("[checkConnection] Checking connection...");
            const response = await invoke("check_connection");
            setIsConnected(response as boolean);
            console.log("[checkConnection] Connection status:", response);
        } catch (error) {
            console.error("[checkConnection] Error checking connection:", error);
            setIsConnected(false); // Asumir desconectado en caso de error
        }
    };

    const checkInternetAccess = async () => {
        try {
            console.log("[checkInternetAccess] Checking internet access...");
            const response = await invoke("check_real_connection");
            setHasInternetAccess(response as boolean);
            console.log("[checkInternetAccess] Internet access status:", response);
        } catch (error) {
            console.error("[checkInternetAccess] Error checking internet access:", error);
            setHasInternetAccess(false); // Asumir sin internet en caso de error
        }
    };

    const refreshConnection = async () => {
        // Don't set loading to true if already checked to prevent UI blocking
        if (!hasCheckedRef.current) {
            setIsLoading(true);
        }

        try {
            // Use Promise.allSettled to prevent one failed check from blocking others
            const results = await Promise.allSettled([checkConnection(), checkInternetAccess()]);

            // Log results for debugging
            results.forEach((result, index) => {
                if (result.status === 'rejected') {
                    console.error(`Connection check ${index} failed:`, result.reason);
                }
            });
        } catch (error) {
            console.error("[refreshConnection] Unexpected error in connection checks:", error);
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
            // Start the connection check
            const checkPromise = refreshConnection();

            // Fallback: ensure loading is set to false after 3 seconds max
            const fallbackTimeout = setTimeout(() => {
                console.warn("[ConnectionProvider] Connection check taking too long, assuming offline mode");
                setIsLoading(false);
                setIsConnected(false);
                setHasInternetAccess(false);
                hasCheckedRef.current = true;
            }, 3000);

            try {
                await checkPromise;
                clearTimeout(fallbackTimeout);
            } catch (error) {
                clearTimeout(fallbackTimeout);
                console.error("[ConnectionProvider] Error during initial connection check:", error);
                // Ensure states are set even on error
                setIsLoading(false);
                setIsConnected(false);
                setHasInternetAccess(false);
            }

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