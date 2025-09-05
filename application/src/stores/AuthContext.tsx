// AuthContext.tsx
import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useMemo } from 'react';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { invoke } from "@tauri-apps/api/core";
import { load } from '@tauri-apps/plugin-store';
import { ApiErrorPayload } from "@/types/ApiResponses";

// --- Type Definitions ---

interface UserSession {
  id: string;
  name: string;
  username: string;
  email: string;
  avatarUrl?: string;
  discordId: string;
  twitchId?: string;
  createdAt: string;
  patreonId: string;
  role: 'user' | 'admin' | 'superadmin';
  publisherMemberships: null | {
    createdAt: string;
    id: number;
    permissions: Record<string, unknown>;
    publisherId: string;
    role: string;
    updatedAt: string;
  }[];
  // Helper methods for role checking
  isAdmin?: () => boolean;
  isSuperAdmin?: () => boolean;
  hasRole?: (role: 'user' | 'admin' | 'superadmin') => boolean;
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

// --- Utility Functions ---

const enhanceSession = (session: UserSession | null): UserSession | null => {
  if (!session) return null;

  // Add helper methods to session object
  return {
    ...session,
    isAdmin: () => session.role === 'admin' || session.role === 'superadmin',
    isSuperAdmin: () => session.role === 'superadmin',
    hasRole: (role: 'user' | 'admin' | 'superadmin') => session.role === role,
  };
};

// --- Provider Component ---

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<UserSession | null>(null);
  const [sessionTokens, setSessionTokens] = useState<SessionTokens | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<AuthError | null>(null);
  const [authStep, setAuthStep] = useState<AuthStep>(null);
  const [pendingInstance, setPendingInstance] = useState<string | null>(null);

  const isAuthenticated = useMemo(() => !!session && !!sessionTokens, [session, sessionTokens]);

  const parseError = (err: unknown): AuthError => {
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
        return { code: 'RAW_STRING_ERROR', message: err };
      }
    }
    if (err instanceof Error) {
      return { code: 'CLIENT_ERROR', message: err.message };
    }
    return { code: 'UNKNOWN_ERROR', message: 'An unknown error occurred' };
  };

  const resetAuthState = useCallback(() => {
    setAuthStep(null);
    setError(null);
  }, []);

  // --- Effects ---

  useEffect(() => {
    let unlistenFunctions: UnlistenFn[] = [];
    let isMounted = true; // Flag to prevent state updates on unmounted component

    const setupListenersAndInit = async () => {
      // Create a promise that resolves when the auth status is received
      let resolveAuthStatus: (value?: unknown) => void = () => { };
      const authStatusPromise = new Promise((resolve) => {
        resolveAuthStatus = resolve;
      });

      // Listen for auth status updates
      const authStatusUnlisten = await listen<UserSession | null>('auth-status-changed', async (event) => {
        if (!isMounted) return;
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
          setSession(enhanceSession(event.payload));
          resetAuthState();
        } catch (err) {
          setError(parseError(err));
        } finally {
          // Resolve the promise to signal that auth has been processed
          resolveAuthStatus();
        }
      });
      unlistenFunctions.push(authStatusUnlisten);

      // Listen for auth errors
      const authErrorUnlisten = await listen<string>('auth-error', (event) => {
        if (!isMounted) return;
        setError(parseError(event.payload));
        console.error("Auth error received:", event.payload);
        setAuthStep(null);
        setLoading(false);
        resolveAuthStatus(); // Resolve on error too, to stop the loading state
      });
      unlistenFunctions.push(authErrorUnlisten);

      // Listen for auth step updates
      const authStepUnlisten = await listen<AuthStep>('auth-step-changed', (event) => {
        if (!isMounted) return;
        setAuthStep(event.payload);
      });
      unlistenFunctions.push(authStepUnlisten);

      // --- Initialization Logic ---
      try {
        setLoading(true);
        // Invoke the init command. This will likely trigger the 'auth-status-changed' event.
        await invoke('init_session');
        // Wait for the auth status event to be received before proceeding.
        await authStatusPromise;
      } catch (err) {
        if (!isMounted) return;
        console.error("[AuthContext] Error during init_session:", err);
        setError(parseError(err));
        setSession(null);
        setSessionTokens(null);
        // Resolve the promise to prevent hanging
        resolveAuthStatus();
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    setupListenersAndInit();

    return () => {
      isMounted = false; // Cleanup flag
      unlistenFunctions.forEach(unlisten => unlisten());
    };
  }, [resetAuthState]);

  useEffect(() => {
    let unlisten: UnlistenFn | null = null;
    const setup = async () => {
      unlisten = await listen<string>('open-instance', (event) => {
        console.log("Shortcut recibido:", event.payload);
        // Emitir navegación de inmediato para soportar shortcuts en modo offline
        window.dispatchEvent(
          new CustomEvent("navigate-to-instance", { detail: event.payload })
        );
      });
    };
    setup();
    return () => {
      if (unlisten) unlisten();
    };
  }, []);


  useEffect(() => {
    if (isAuthenticated && pendingInstance) {
      window.dispatchEvent(
        new CustomEvent("navigate-to-instance", { detail: pendingInstance })
      );
      setPendingInstance(null);
    }
  }, [isAuthenticated, pendingInstance]);

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