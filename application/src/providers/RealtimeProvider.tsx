import React, { createContext, useContext, useEffect, ReactNode } from 'react';
import { useRealtime, WebSocketHookReturn } from '@/hooks/useRealtime';

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
  const realtime = useRealtime(token, {
    autoConnect,
    debug: process.env.NODE_ENV === 'development',
    maxReconnectAttempts: 10,
    reconnectInterval: 1000
  });

  // Set up global event listeners here if needed
  useEffect(() => {
    if (!realtime.isConnected) return;

    // Example: Listen for global notifications
    const unsubscribeNotification = realtime.on('notification', (payload) => {
      console.log('Global notification received:', payload);
      // Handle global notifications (toast, etc.)
    });

    const unsubscribeBroadcast = realtime.on('broadcast', (payload) => {
      console.log('Broadcast message received:', payload);
      // Handle broadcast messages
    });

    return () => {
      unsubscribeNotification();
      unsubscribeBroadcast();
    };
  }, [realtime.isConnected, realtime.on]);

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