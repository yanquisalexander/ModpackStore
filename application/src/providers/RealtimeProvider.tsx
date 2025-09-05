import React, { createContext, useContext, ReactNode } from 'react';
import { useRealtime, WebSocketHookReturn } from '@/hooks/useRealtime';
import { useAuthentication } from '@/stores/AuthContext';

// Context for WebSocket functionality
interface RealtimeContextType extends WebSocketHookReturn {
  // Can extend with additional methods if needed
}

const RealtimeContext = createContext<RealtimeContextType | null>(null);

// Provider component
interface RealtimeProviderProps {
  children: ReactNode;
  token?: string;
  autoConnect?: boolean;
}

export function RealtimeProvider({ children, token, autoConnect = true }: RealtimeProviderProps) {
  // Safely get authentication data, with fallback if not available
  let sessionTokens = null;
  let authLoading = true;

  try {
    const auth = useAuthentication();
    sessionTokens = auth.sessionTokens;
    authLoading = auth.loading;
  } catch (error) {
    // AuthProvider might not be available yet, continue without auth
    console.warn('[RealtimeProvider] AuthProvider not available yet, continuing without authentication');
    authLoading = false;
  }

  // Use provided token or get from auth context
  const authToken = token || sessionTokens?.accessToken;

  const realtime = useRealtime(authToken, {
    autoConnect: autoConnect && !!authToken && !authLoading,
    debug: import.meta.env.DEV,
    maxReconnectAttempts: 10,
    reconnectInterval: 1000
  });



  return (
    <RealtimeContext.Provider value={realtime}>
      {children}
    </RealtimeContext.Provider>
  );
}

// Hook to use WebSocket context
export function useRealtimeContext(): RealtimeContextType {
  const context = useContext(RealtimeContext);
  if (!context) {
    throw new Error('useRealtimeContext must be used within a RealtimeProvider');
  }
  return context;
}

// Optional: Higher-order component for easy integration
export function withRealtime<P extends object>(
  WrappedComponent: React.ComponentType<P>
): React.ComponentType<P & { token?: string }> {
  return function WithRealtimeComponent({ token, ...props }: P & { token?: string }) {
    return (
      <RealtimeProvider token={token}>
        <WrappedComponent {...props as P} />
      </RealtimeProvider>
    );
  };
}