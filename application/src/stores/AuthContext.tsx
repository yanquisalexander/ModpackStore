// AuthContext.tsx
import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useMemo, useRef } from 'react';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { invoke } from "@tauri-apps/api/core";
import { load } from '@tauri-apps/plugin-store';
import { ApiErrorPayload } from "@/types/ApiResponses";
import { jwtDecode } from 'jwt-decode';

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
  role: 'user' | 'admin' | 'super_admin' | 'support';
  tosAcceptedAt?: string | null;
  isBanned?: boolean;
  banReason?: string;
  activeBan?: {
    id: string;
    reason?: string;
    banDate: string;
    adminId: string;
  };
  creatorMemberships: null | {
    creatorId: string;
    role: string;
    displayName: string;
    slug: string;
    status: string;
  }[];
  // Helper methods for role checking
  isAdmin?: () => boolean;
  isSuperAdmin?: () => boolean;
  isSupport?: () => boolean;
  isStaff?: () => boolean;
  hasRole?: (role: 'user' | 'admin' | 'super_admin' | 'support') => boolean;
}

interface SessionTokens {
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  tokenType: string;
  expiresAt?: number; // Timestamp when the token expires
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
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
  showSessionExpired: boolean;
  refreshTokens: () => Promise<void>;
}

// --- Utility Functions ---

// Decode JWT to extract expiration time
const decodeToken = (token: string): { exp?: number } | null => {
  try {
    return jwtDecode<{ exp?: number }>(token);
  } catch (error) {
    console.error('Error decoding token:', error);
    return null;
  }
};

// Calculate token expiration timestamp
const calculateTokenExpiration = (token: string, expiresIn: number): number | undefined => {
  const decoded = decodeToken(token);
  if (decoded?.exp) {
    return decoded.exp * 1000; // Convert to milliseconds
  }
  // Fallback: calculate from current time + expiresIn
  return Date.now() + (expiresIn * 1000);
};

const enhanceSession = (session: UserSession | null): UserSession | null => {
  if (!session) return null;

  // Add helper methods to session object
  return {
    ...session,
    isAdmin: () => session.role === 'admin' || session.role === 'super_admin',
    isSuperAdmin: () => session.role === 'super_admin',
    isSupport: () => session.role === 'support',
    isStaff: () => session.role === 'admin' || session.role === 'super_admin' || session.role === 'support',
    hasRole: (role: 'user' | 'admin' | 'super_admin' | 'support') => session.role === role,
  };
};

// --- Session Cache (SWR stale-while-revalidate) ---

const SESSION_CACHE_KEY = 'session_cache';

interface SessionCache {
  session: UserSession;
  tokens: {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
  };
  cachedAt: number;
}

const getStoreName = () => import.meta.env.PROD ? 'auth_store.json' : 'auth_store.dev.json';

async function readSessionCache(): Promise<SessionCache | null> {
  try {
    const store = await load(getStoreName());
    const cached = await store.get<SessionCache>(SESSION_CACHE_KEY);
    return cached ?? null;
  } catch {
    return null;
  }
}

async function writeSessionCache(data: SessionCache): Promise<void> {
  try {
    const store = await load(getStoreName());
    await store.set(SESSION_CACHE_KEY, data);
    await store.save();
  } catch (err) {
    console.warn('[AuthContext] Failed to write session cache:', err);
  }
}

async function clearSessionCache(): Promise<void> {
  try {
    const store = await load(getStoreName());
    await store.delete(SESSION_CACHE_KEY);
    await store.save();
  } catch {
    // Ignore errors on cleanup
  }
}

// --- Provider Component ---

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<UserSession | null>(null);
  const [sessionTokens, setSessionTokens] = useState<SessionTokens | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<AuthError | null>(null);
  const [authStep, setAuthStep] = useState<AuthStep>(null);
  const [pendingInstance, setPendingInstance] = useState<string | null>(null);
  const [showSessionExpired, setShowSessionExpired] = useState<boolean>(false);

  // Refs for managing token refresh
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isRefreshingRef = useRef<boolean>(false);
  // Track whether the initial cache has been loaded
  const cacheLoadedRef = useRef<boolean>(false);

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
    setShowSessionExpired(false);
    setAuthStep(null);
    setError(null);
  }, []);

  // Clear any existing refresh timer
  const clearRefreshTimer = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, []);

  // Refresh tokens function
  const refreshTokens = useCallback(async (): Promise<void> => {
    // Prevent concurrent refresh attempts
    if (isRefreshingRef.current) {
      console.log('[AuthContext] Refresh already in progress, skipping...');
      return;
    }

    try {
      isRefreshingRef.current = true;
      console.log('[AuthContext] Refreshing tokens...');

      const success = await invoke<boolean>('refresh_tokens');

      if (success) {
        console.log('[AuthContext] Tokens refreshed successfully');
        // Tokens will be updated via the auth-status-changed event
      } else {
        console.warn('[AuthContext] Token refresh returned false (auth expired)');
        // Show session expired dialog
        setShowSessionExpired(true);
        setSession(null);
        setSessionTokens(null);
        clearSessionCache();
      }
    } catch (err) {
      console.error('[AuthContext] Error refreshing tokens:', err);
      const parsedError = parseError(err);

      // No cerramos sesión si es un error de servidor o red
      const isTransientError =
        parsedError.code.includes('50') ||
        parsedError.code.includes('NETWORK') ||
        parsedError.code.includes('API_ERROR') ||
        parsedError.message.toLowerCase().includes('database') ||
        parsedError.message.toLowerCase().includes('timeout');

      if (!isTransientError) {
        setShowSessionExpired(true);
        setSession(null);
        setSessionTokens(null);
        clearSessionCache();
      } else {
        console.warn('[AuthContext] Transient error during refresh, keeping tokens to retry later');
      }
    } finally {
      isRefreshingRef.current = false;
    }
  }, []);

  // Schedule token refresh based on expiration time
  const scheduleTokenRefresh = useCallback((tokens: SessionTokens) => {
    clearRefreshTimer();

    if (!tokens.expiresAt) {
      console.warn('[AuthContext] No expiration time available for token');
      return;
    }

    const now = Date.now();
    const expiresAt = tokens.expiresAt;
    const timeUntilExpiry = expiresAt - now;

    // Refresh 5 minutes before expiration (or immediately if less than 5 min remaining)
    const REFRESH_BUFFER_MS = 5 * 60 * 1000; // 5 minutes
    const refreshIn = Math.max(0, timeUntilExpiry - REFRESH_BUFFER_MS);

    console.log(`[AuthContext] Scheduling token refresh in ${Math.floor(refreshIn / 1000 / 60)} minutes`);

    refreshTimerRef.current = setTimeout(() => {
      console.log('[AuthContext] Token refresh timer triggered');
      refreshTokens();
    }, refreshIn);
  }, [clearRefreshTimer, refreshTokens]);

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
      const authStatusUnlisten = await listen<{
        session: UserSession | null;
        tokens?: TokenResponse | null;
      }>('auth-status-changed', async (event) => {
        if (!isMounted) return;
        const { session: payloadSession, tokens: payloadTokens } = event.payload;
        try {
          // Prefer tokens carried in the event payload (reliable in dev & prod).
          // Fall back to reading from the store if not present (backwards compat).
          let tokens = payloadTokens ?? null;
          if (!tokens) {
            try {
              const store = await load(getStoreName());
              tokens = await store.get<TokenResponse>('auth_tokens');
            } catch {
              tokens = null;
            }
          }

          if (tokens) {
            const expiresAt = calculateTokenExpiration(tokens.access_token, tokens.expires_in);
            const tokensWithExpiry: SessionTokens = {
              accessToken: tokens.access_token,
              expiresIn: tokens.expires_in,
              refreshToken: tokens.refresh_token,
              tokenType: tokens.token_type,
              expiresAt,
            };
            setSessionTokens(tokensWithExpiry);

            // Update session cache with fresh data
            writeSessionCache({
              session: payloadSession as UserSession,
              tokens,
              cachedAt: Date.now(),
            });

            // Schedule automatic token refresh
            scheduleTokenRefresh(tokensWithExpiry);
          } else {
            setSessionTokens(null);
            clearRefreshTimer();
            clearSessionCache();
          }
          setSession(enhanceSession(payloadSession));
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
        // SWR: Load cached session immediately so UI renders without blocking
        if (!cacheLoadedRef.current) {
          const cached = await readSessionCache();
          if (cached && isMounted) {
            setSession(enhanceSession(cached.session));
            const expiresAt = calculateTokenExpiration(cached.tokens.access_token, cached.tokens.expires_in);
            const tokensWithExpiry: SessionTokens = {
              accessToken: cached.tokens.access_token,
              expiresIn: cached.tokens.expires_in,
              refreshToken: cached.tokens.refresh_token,
              tokenType: cached.tokens.token_type,
              expiresAt,
            };
            setSessionTokens(tokensWithExpiry);
            scheduleTokenRefresh(tokensWithExpiry);
            setLoading(false); // Show cached data immediately
          }
          cacheLoadedRef.current = true;
        }

        // Revalidate in background (init_session calls /auth/me)
        invoke('init_session');

        // Wait for auth-status-changed event, but with a safety timeout
        // to prevent infinite loading if the backend fails to emit the event
        const AUTH_INIT_TIMEOUT_MS = 15_000;
        await Promise.race([
          authStatusPromise,
          new Promise((resolve) => setTimeout(resolve, AUTH_INIT_TIMEOUT_MS))
        ]);
      } catch (err) {
        if (!isMounted) return;
        console.error("[AuthContext] Error during init_session:", err);
        const parsedError = parseError(err);
        setError(parsedError);

        // No borramos la sesión si es un error temporal del servidor (50x) o red
        const isTransientError =
          parsedError.code.includes('50') ||
          parsedError.code.includes('NETWORK') ||
          parsedError.code.includes('API_ERROR') ||
          parsedError.message.toLowerCase().includes('database') ||
          parsedError.message.toLowerCase().includes('timeout');

        if (!isTransientError) {
          console.log("[AuthContext] Non-transient error, clearing session state");
          setSession(null);
          setSessionTokens(null);
          clearSessionCache();
        } else {
          console.warn("[AuthContext] Transient server/DB error, preserving session state for later retry");
        }

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
      clearRefreshTimer(); // Clear refresh timer on unmount
    };
  }, [resetAuthState, scheduleTokenRefresh, clearRefreshTimer]);

  const openInstanceUnlistenRef = useRef<UnlistenFn | null>(null);

  useEffect(() => {
    const setup = async () => {
      openInstanceUnlistenRef.current = await listen<string>('open-instance', (event) => {
        console.log("Shortcut recibido:", event.payload);
        // Emitir navegación de inmediato para soportar shortcuts en modo offline
        window.dispatchEvent(
          new CustomEvent("navigate-to-instance", { detail: event.payload })
        );
      });
    };
    setup();
    return () => {
      openInstanceUnlistenRef.current?.();
      openInstanceUnlistenRef.current = null;
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
      clearRefreshTimer();
      clearSessionCache();
      resetAuthState();
    } catch (err) {
      setError(parseError(err));
      throw err; // Re-throw for component-level handling if needed
    }
  }, [resetAuthState, clearRefreshTimer]);

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
    showSessionExpired,
    refreshTokens,
  }), [session, loading, error, authStep, startDiscordAuth, logout, isAuthenticated, sessionTokens, showSessionExpired, refreshTokens]);

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