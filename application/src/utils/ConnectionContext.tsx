// ConnectionContext.tsx
import React, { createContext, useContext, useEffect, useRef, useMemo, useCallback, useReducer } from "react";
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

type Action =
    | { type: 'SET_CONNECTED'; payload: boolean }
    | { type: 'SET_INTERNET_ACCESS'; payload: boolean }
    | { type: 'SET_LOADING'; payload: boolean }
    | { type: 'SET_OFFLINE' };

const initialState: ConnectionState = {
    isConnected: false,
    hasInternetAccess: false,
    isLoading: true,
};

function connectionReducer(state: ConnectionState, action: Action): ConnectionState {
    switch (action.type) {
        case 'SET_CONNECTED':
            return { ...state, isConnected: action.payload };
        case 'SET_INTERNET_ACCESS':
            return { ...state, hasInternetAccess: action.payload };
        case 'SET_LOADING':
            return { ...state, isLoading: action.payload };
        case 'SET_OFFLINE':
            return { isConnected: false, hasInternetAccess: false, isLoading: false };
        default:
            return state;
    }
}

export const ConnectionProvider: React.FC<ConnectionProviderProps> = ({ children }) => {
    const [state, dispatch] = useReducer(connectionReducer, initialState);

    // Ref para controlar si ya se ejecutó la verificación inicial
    const hasCheckedRef = useRef<boolean>(false);

    const checkConnection = async () => {
        try {
            console.log("[checkConnection] Checking connection...");
            const response = await invoke("check_connection");
            dispatch({ type: 'SET_CONNECTED', payload: response as boolean });
            console.log("[checkConnection] Connection status:", response);
        } catch (error) {
            console.error("[checkConnection] Error checking connection:", error);
            dispatch({ type: 'SET_CONNECTED', payload: false });
        }
    };

    const checkInternetAccess = async () => {
        try {
            console.log("[checkInternetAccess] Checking internet access...");
            const response = await invoke("check_real_connection");
            dispatch({ type: 'SET_INTERNET_ACCESS', payload: response as boolean });
            console.log("[checkInternetAccess] Internet access status:", response);
        } catch (error) {
            console.error("[checkInternetAccess] Error checking internet access:", error);
            dispatch({ type: 'SET_INTERNET_ACCESS', payload: false });
        }
    };

    const refreshConnection = useCallback(async () => {
        if (!hasCheckedRef.current) {
            dispatch({ type: 'SET_LOADING', payload: true });
        }

        try {
            const results = await Promise.allSettled([checkConnection(), checkInternetAccess()]);

            results.forEach((result, index) => {
                if (result.status === 'rejected') {
                    console.error(`Connection check ${index} failed:`, result.reason);
                }
            });
        } catch (error) {
            console.error("[refreshConnection] Unexpected error in connection checks:", error);
        } finally {
            hasCheckedRef.current = true;
            dispatch({ type: 'SET_LOADING', payload: false });
        }
    }, []);

    useEffect(() => {
        if (hasCheckedRef.current) {
            return;
        }

        let timedOut = false;

        const performInitialChecks = async () => {
            const checkPromise = refreshConnection();

            const fallbackTimeout = setTimeout(() => {
                console.warn("[ConnectionProvider] Connection check taking too long, assuming offline mode");
                timedOut = true;
                dispatch({ type: 'SET_OFFLINE' });
            }, 3000);

            try {
                await checkPromise;
                clearTimeout(fallbackTimeout);
            } catch (error) {
                clearTimeout(fallbackTimeout);
                console.error("[ConnectionProvider] Error during initial connection check:", error);
                if (!timedOut) {
                    dispatch({ type: 'SET_OFFLINE' });
                }
            }
        };

        performInitialChecks();
    }, []);

    const value = useMemo<ConnectionContextType>(() => ({
        isConnected: state.isConnected,
        hasInternetAccess: state.hasInternetAccess,
        isLoading: state.isLoading,
        refreshConnection,
    }), [state.isConnected, state.hasInternetAccess, state.isLoading, refreshConnection]);

    return (
        <ConnectionContext.Provider value={value}>
            {children}
        </ConnectionContext.Provider>
    );
};