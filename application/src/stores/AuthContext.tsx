// AuthContext.tsx
import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useMemo } from 'react';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { invoke } from "@tauri-apps/api/core";
import { load } from '@tauri-apps/plugin-store';

// --- Type Definitions ---

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

interface SessionTokens {
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  tokenType: string;
}

type AuthStep =
  | null
  | 'starting-auth'
  | 'waiting-callback'
  | 'processing-callback'
  | 'requesting-session';

// --- Error Type Definitions (Improved) ---

// Represents the structured error from the backend
interface ApiErrorDetail {
  code: string;
  detail: string;
  status: string;
  title: string;
}

interface ApiErrorPayload {
  errors: ApiErrorDetail[];
}

// Standardized error object for the context state
interface AuthError {
  code: string;
  message: string;
}

// --- Context Type Definition ---

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

// --- Provider Component ---

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<UserSession | null>(null);
  const [sessionTokens, setSessionTokens] = useState<SessionTokens | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<AuthError | null>(null);
  const [authStep, setAuthStep] = useState<AuthStep>(null);

  // --- Memoized Values ---

  // Memoize isAuthenticated to prevent recalculation on every render
  const isAuthenticated = useMemo(() => !!session && !!sessionTokens, [session, sessionTokens]);

  // --- Helper Functions ---

  // CORRECTED: Handles simple strings, Error objects, and the specific JSON error structure
  const parseError = (err: unknown): AuthError => {
    // 1. Handle the specific JSON error string from the backend
    if (typeof err === 'string') {
      try {
        const parsed = JSON.parse(err) as ApiErrorPayload;
        if (parsed.errors && parsed.errors.length > 0) {
          const firstError = parsed.errors[0];
          return {
            code: firstError.code || 'UNKNOWN_API_ERROR',
            message: firstError.detail || 'An API error occurred.',
          };
        }
      } catch (e) {
        // It's a plain string, not JSON
        return { code: 'RAW_STRING_ERROR', message: err };
      }
    }

    // 2. Handle standard Error objects
    if (err instanceof Error) {
      return { code: 'CLIENT_ERROR', message: err.message };
    }

    // 3. Fallback for other unknown error types
    return { code: 'UNKNOWN_ERROR', message: 'An unknown error occurred' };
  };

  const resetAuthState = useCallback(() => {
    setAuthStep(null);
    setError(null);
  }, []);

  // --- Effects ---

  useEffect(() => {
    const unlistenFunctions: UnlistenFn[] = [];

    const setupListeners = async () => {
      // Listen for auth status updates
      const authStatusUnlisten = await listen<UserSession | null>('auth-status-changed', async (event) => {
        try {
          const store = await load('auth_store.json');
          const tokens = await store.get<any>('auth_tokens');
          if (tokens) {
            setSessionTokens({
              accessToken: tokens.access_token,
              expiresIn: tokens.expires_in,
              refreshToken: tokens.refresh_token,
              tokenType: tokens.token_type,
            });
          } else {
            setSessionTokens(null);
          }
          setSession(event.payload);
          resetAuthState();
        } catch (err) {
          setError(parseError(err));
        } finally {
          // El listener también puede detener la carga si se activa
          setLoading(false);
        }
      });
      unlistenFunctions.push(authStatusUnlisten);

      // Listen for auth errors
      const authErrorUnlisten = await listen<string>('auth-error', (event) => {
        setError(parseError(event.payload));
        console.error("Auth error received:", event.payload);
        setAuthStep(null);
        setLoading(false); // Detener la carga en error
      });
      unlistenFunctions.push(authErrorUnlisten);

      // Listen for auth step updates
      const authStepUnlisten = await listen<AuthStep>('auth-step-changed', (event) => {
        setAuthStep(event.payload);
      });
      unlistenFunctions.push(authStepUnlisten);
    };

    const initAuth = async () => {
      try {
        setLoading(true);
        await setupListeners();
        await invoke('init_session');
      } catch (err) {
        setError(parseError(err));
      } finally {
        // --- ESTA ES LA LÍNEA CLAVE ---
        // Se asegura de que la carga termine después de que `init_session` se complete,
        // incluso si no se emiten eventos.
        setLoading(false);
      }
    };

    initAuth();

    // Cleanup listeners on unmount
    return () => {
      unlistenFunctions.forEach(unlisten => unlisten());
    };
  }, [resetAuthState]);

  // --- Public Actions ---

  const startDiscordAuth = useCallback(async (): Promise<void> => {
    resetAuthState();
    setAuthStep('starting-auth');
    try {
      await invoke('start_discord_auth');
    } catch (err) {
      setError(parseError(err));
      setAuthStep(null);
      throw err; // Re-throw for component-level handling if needed
    }
  }, [resetAuthState]);

  const logout = useCallback(async (): Promise<void> => {
    try {
      await invoke('logout');
      setSession(null);
      setSessionTokens(null);
      resetAuthState();
    } catch (err) {
      setError(parseError(err));
      throw err; // Re-throw for component-level handling if needed
    }
  }, [resetAuthState]);

  // --- Context Value ---

  const value = useMemo(() => ({
    session,
    loading,
    error,
    authStep,
    startDiscordAuth,
    logout,
    isAuthenticated,
    sessionTokens,
  }), [session, loading, error, authStep, startDiscordAuth, logout, isAuthenticated, sessionTokens]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// --- Custom Hook ---

export const useAuthentication = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthentication must be used within an AuthProvider');
  }
  return context;
};