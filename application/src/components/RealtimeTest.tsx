import React, { useState, useEffect } from 'react';
import { useRealtime } from '@/hooks/useRealtime';

interface RealtimeTestProps {
  token?: string;
}

export function RealtimeTest({ token }: RealtimeTestProps) {
  const [messages, setMessages] = useState<Array<{ type: string; payload: any; timestamp: string }>>([]);
  const [messageType, setMessageType] = useState('test');
  const [messagePayload, setMessagePayload] = useState('');

  const {
    isConnected,
    isConnecting,
    error,
    connect,
    disconnect,
    send,
    on,
    off,
    connectionCount
  } = useRealtime(token, {
    autoConnect: true,
    debug: true,
    maxReconnectAttempts: 5
  });

  useEffect(() => {
    // Listen for all message types
    const unsubscribers: Array<() => void> = [];

    // Connection events
    unsubscribers.push(on('connected', (payload) => {
      setMessages(prev => [...prev, { 
        type: 'connected', 
        payload, 
        timestamp: new Date().toISOString() 
      }]);
    }));

    unsubscribers.push(on('disconnected', (payload) => {
      setMessages(prev => [...prev, { 
        type: 'disconnected', 
        payload, 
        timestamp: new Date().toISOString() 
      }]);
    }));

    // Echo messages
    unsubscribers.push(on('echo', (payload) => {
      setMessages(prev => [...prev, { 
        type: 'echo', 
        payload, 
        timestamp: new Date().toISOString() 
      }]);
    }));

    // Test messages
    unsubscribers.push(on('test', (payload) => {
      setMessages(prev => [...prev, { 
        type: 'test', 
        payload, 
        timestamp: new Date().toISOString() 
      }]);
    }));

    // Error messages
    unsubscribers.push(on('error', (payload) => {
      setMessages(prev => [...prev, { 
        type: 'error', 
        payload, 
        timestamp: new Date().toISOString() 
      }]);
    }));

    // Broadcast messages
    unsubscribers.push(on('broadcast', (payload) => {
      setMessages(prev => [...prev, { 
        type: 'broadcast', 
        payload, 
        timestamp: new Date().toISOString() 
      }]);
    }));

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [on]);

  const handleSendMessage = () => {
    if (messageType && messagePayload) {
      try {
        const payload = messagePayload.startsWith('{') ? JSON.parse(messagePayload) : messagePayload;
        send(messageType, payload);
      } catch (error) {
        send(messageType, messagePayload);
      }
    }
  };

  const clearMessages = () => {
    setMessages([]);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">WebSocket Realtime Test</h2>
      
      {/* Connection Status */}
      <div className="mb-6 p-4 rounded-lg border">
        <h3 className="text-lg font-semibold mb-2">Connection Status</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="font-medium">Status: </span>
            <span className={`px-2 py-1 rounded text-sm ${
              isConnected ? 'bg-green-100 text-green-800' :
              isConnecting ? 'bg-yellow-100 text-yellow-800' :
              'bg-red-100 text-red-800'
            }`}>
              {isConnected ? 'Connected' : isConnecting ? 'Connecting...' : 'Disconnected'}
            </span>
          </div>
          <div>
            <span className="font-medium">Connections: </span>
            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">
              {connectionCount}
            </span>
          </div>
        </div>
        {error && (
          <div className="mt-2 p-2 bg-red-100 text-red-800 rounded text-sm">
            <strong>Error:</strong> {error}
          </div>
        )}
      </div>

      {/* Connection Controls */}
      <div className="mb-6 p-4 rounded-lg border">
        <h3 className="text-lg font-semibold mb-2">Connection Controls</h3>
        <div className="flex gap-2">
          <button
            onClick={connect}
            disabled={isConnected || isConnecting}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Connect
          </button>
          <button
            onClick={disconnect}
            disabled={!isConnected && !isConnecting}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Disconnect
          </button>
        </div>
      </div>

      {/* Send Message */}
      <div className="mb-6 p-4 rounded-lg border">
        <h3 className="text-lg font-semibold mb-2">Send Message</h3>
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={messageType}
            onChange={(e) => setMessageType(e.target.value)}
            placeholder="Message type (e.g., 'test')"
            className="flex-1 px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex gap-2">
          <textarea
            value={messagePayload}
            onChange={(e) => setMessagePayload(e.target.value)}
            placeholder="Message payload (JSON or text)"
            rows={3}
            className="flex-1 px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleSendMessage}
            disabled={!isConnected || !messageType}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="p-4 rounded-lg border">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-lg font-semibold">Messages ({messages.length})</h3>
          <button
            onClick={clearMessages}
            className="px-3 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Clear
          </button>
        </div>
        <div className="max-h-96 overflow-y-auto space-y-2">
          {messages.length === 0 ? (
            <p className="text-gray-500 italic">No messages received yet...</p>
          ) : (
            messages.map((message, index) => (
              <div
                key={index}
                className={`p-3 rounded border-l-4 ${
                  message.type === 'error' ? 'border-red-500 bg-red-50' :
                  message.type === 'connected' ? 'border-green-500 bg-green-50' :
                  message.type === 'disconnected' ? 'border-orange-500 bg-orange-50' :
                  'border-blue-500 bg-blue-50'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="font-medium text-sm text-gray-600">
                      {message.type}
                    </div>
                    <div className="mt-1">
                      <pre className="text-sm whitespace-pre-wrap">
                        {JSON.stringify(message.payload, null, 2)}
                      </pre>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 ml-2">
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}