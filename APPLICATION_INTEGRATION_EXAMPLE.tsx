// Example integration with the main application

import React from 'react';
import { RealtimeProvider } from '@/providers/RealtimeProvider';
import { useRealtimeContext } from '@/providers/RealtimeProvider';

// Example component using the WebSocket functionality
function NotificationComponent() {
  const { isConnected, on, send } = useRealtimeContext();

  React.useEffect(() => {
    if (!isConnected) return;

    // Listen for specific events
    const unsubscribers = [
      on('user_message', (payload) => {
        console.log('User message:', payload);
        // Handle user messages
      }),
      
      on('modpack_update', (payload) => {
        console.log('Modpack update:', payload);
        // Handle modpack updates
      }),
      
      on('system_announcement', (payload) => {
        console.log('System announcement:', payload);
        // Handle system announcements
      })
    ];

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [isConnected, on]);

  const sendTestMessage = () => {
    send('test', {
      message: 'Hello from React component!',
      timestamp: new Date().toISOString()
    });
  };

  return (
    <div>
      <p>WebSocket Status: {isConnected ? '🟢 Connected' : '🔴 Disconnected'}</p>
      <button onClick={sendTestMessage} disabled={!isConnected}>
        Send Test Message
      </button>
    </div>
  );
}

// Main App component showing integration
function App() {
  const [authToken, setAuthToken] = React.useState<string | undefined>(undefined);

  // This would come from your auth system
  React.useEffect(() => {
    // Example: Get token from localStorage or auth context
    const token = localStorage.getItem('auth_token');
    if (token) {
      setAuthToken(token);
    }
  }, []);

  return (
    <RealtimeProvider token={authToken} autoConnect={!!authToken}>
      <div className="app">
        <h1>ModpackStore with WebSocket Support</h1>
        <NotificationComponent />
        {/* Your other app components */}
      </div>
    </RealtimeProvider>
  );
}

export default App;

// Alternative: Direct usage without provider
function DirectUsageExample() {
  const [authToken, setAuthToken] = React.useState<string>('your-jwt-token');
  
  const {
    isConnected,
    isConnecting,
    error,
    send,
    on,
    connectionCount
  } = useRealtime(authToken, {
    autoConnect: true,
    debug: true
  });

  React.useEffect(() => {
    if (!isConnected) return;

    // Listen for notifications
    const unsubscribe = on('notification', (payload) => {
      // Show toast notification
      alert(`Notification: ${payload.title}\n${payload.message}`);
    });

    return unsubscribe;
  }, [isConnected, on]);

  return (
    <div>
      <h2>Direct WebSocket Usage</h2>
      <p>Status: {isConnected ? 'Connected' : isConnecting ? 'Connecting...' : 'Disconnected'}</p>
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
      <p>Connections: {connectionCount}</p>
      
      <button 
        onClick={() => send('ping', { timestamp: Date.now() })}
        disabled={!isConnected}
      >
        Send Ping
      </button>
    </div>
  );
}