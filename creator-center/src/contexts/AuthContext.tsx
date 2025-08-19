// AuthContext.tsx para React puro (sin Tauri)
import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';

// Define types
interface UserSession {
    id: string;
    name: string;
    username: string;
    email: string;
    avatarUrl?: string;
    admin: boolean;
    publisherMemberships: null | {
        createdAt: string;
        id: number;
        permissions: Record<string, unknown>;
        publisherId: string;
        role: string;
        updatedAt: string;
    }[];
}

type AuthStep =
    | null
    | 'starting-auth'
    | 'waiting-callback'
    | 'processing-callback'
    | 'requesting-session';

interface AuthError {
    error_code: string;
    error: string;
}

interface SessionTokens {
    accessToken: string;
    expiresIn: number;
    refreshToken: string;
    tokenType: string;
}

interface AuthContextType {
    session: UserSession | null;
    loading: boolean;
    error: AuthError | null;
    authStep: AuthStep;
    startDiscordAuth: () => Promise<void>;
    logout: () => Promise<void>;
    isAuthenticated: boolean;
    sessionTokens: SessionTokens | null;
}

interface AuthProviderProps {
    children: ReactNode;
}

const defaultContextValue: AuthContextType = {
    session: null,
    loading: true,
    error: null,
    authStep: null,
    startDiscordAuth: async () => { throw new Error('AuthContext not initialized') },
    logout: async () => { throw new Error('AuthContext not initialized') },
    isAuthenticated: false,
    sessionTokens: null
};

export const AuthContext = createContext<AuthContextType>(defaultContextValue);

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const [session, setSession] = useState<UserSession | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<AuthError | null>(null);
    const [authStep, setAuthStep] = useState<AuthStep>(null);
    const [sessionTokens, setSessionTokens] = useState<SessionTokens | null>(null);

    const isAuthenticated = !!session && !!sessionTokens;

    // Parse error helper
    const parseError = (err: unknown): AuthError => {
        if (err instanceof Error) {
            return { error_code: 'UNKNOWN_ERROR', error: err.message };
        }
        if (typeof err === 'string') {
            try {
                return JSON.parse(err) as AuthError;
            } catch {
                return { error_code: 'PARSE_ERROR', error: err };
            }
        }
        return { error_code: 'UNKNOWN_ERROR', error: 'Unknown authentication error occurred' };
    };

    // Reset auth state helper
    const resetAuthState = useCallback(() => {
        setAuthStep(null);
        setError(null);
    }, []);

    // Cargar sesión y tokens desde localStorage
    useEffect(() => {
        setLoading(true);
        try {
            const tokens = localStorage.getItem('auth_tokens');
            const sessionData = localStorage.getItem('user_session');
            if (tokens) setSessionTokens(JSON.parse(tokens));
            if (sessionData) setSession(JSON.parse(sessionData));
        } catch (err) {
            setError(parseError(err));
        } finally {
            setLoading(false);
        }
    }, []);

    // Guardar sesión y tokens en localStorage
    useEffect(() => {
        if (sessionTokens) {
            localStorage.setItem('auth_tokens', JSON.stringify(sessionTokens));
        } else {
            localStorage.removeItem('auth_tokens');
        }
        if (session) {
            localStorage.setItem('user_session', JSON.stringify(session));
        } else {
            localStorage.removeItem('user_session');
        }
    }, [sessionTokens, session]);

    // Iniciar OAuth Discord
    const startDiscordAuth = useCallback(async (): Promise<void> => {
        try {
            setError(null);
            setAuthStep('starting-auth');
            // Redirigir a la URL de login del backend
            window.location.href = `${API_URL}/auth/discord`;
        } catch (err) {
            setError({ error_code: 'DISCORD_AUTH_ERROR', error: String(err) });
            setAuthStep(null);
            throw err;
        }
    }, []);

    // Logout
    const logout = useCallback(async (): Promise<void> => {
        try {
            setLoading(true);
            await fetch(`${API_URL}/auth/logout`, { method: 'POST', credentials: 'include' });
            setSession(null);
            setSessionTokens(null);
            resetAuthState();
        } catch (err) {
            setError({ error_code: 'LOGOUT_ERROR', error: String(err) });
            throw err;
        } finally {
            setLoading(false);
        }
    }, [resetAuthState]);

    const value: AuthContextType = {
        session,
        loading,
        error,
        authStep,
        startDiscordAuth,
        logout,
        isAuthenticated,
        sessionTokens,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuthentication = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuthentication must be used within an AuthProvider');
    }
    return context;
};
