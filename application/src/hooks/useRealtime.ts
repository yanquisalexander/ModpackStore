import { useState, useEffect, useRef, useCallback } from 'react';
import { API_ENDPOINT } from '@/consts';

// --- Types ---
export interface WebSocketMessage {
  type: string;
  payload: any;
}

export interface WebSocketHookOptions {
  autoConnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  debug?: boolean;
}

export interface WebSocketHookReturn {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  connect: () => void;
  disconnect: () => void;
  send: (type: string, payload: any) => void;
  on: (type: string, callback: (payload: any) => void) => () => void;
  off: (type: string, callback?: (payload: any) => void) => void;
  connectionCount: number;
}

// --- Hook Implementation ---
export function useRealtime(
  token?: string,
  options: WebSocketHookOptions = {}
): WebSocketHookReturn {
  const {
    autoConnect = true,
    reconnectInterval = 1000,
    maxReconnectAttempts = 10,
    debug = false
  } = options;

  // State
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionCount, setConnectionCount] = useState(0);

  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const eventListenersRef = useRef<Map<string, Set<(payload: any) => void>>>(new Map());
  const isManualDisconnectRef = useRef(false);

  // --- Helper Functions ---
  const log = useCallback((message: string, ...args: any[]) => {
    if (debug) {
      console.log(`[WebSocket] ${message}`, ...args);
    }
  }, [debug]);

  const getWebSocketUrl = useCallback(() => {
    try {
      const url = new URL(API_ENDPOINT.replace('/v1', ''));
      const wsProtocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${wsProtocol}//${url.host}/ws`;
    } catch (error) {
      console.error('Error parsing API_ENDPOINT URL:', error);
      // Fallback to the old method
      const baseUrl = API_ENDPOINT.replace('/v1', '').replace('http', 'ws');
      return `${baseUrl}/ws`;
    }
  }, []);

  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const calculateBackoffDelay = useCallback((attempt: number) => {
    // Exponential backoff with jitter: base * 2^attempt + random(0, 1000)
    const exponentialDelay = reconnectInterval * Math.pow(2, Math.min(attempt, 6));
    const jitter = Math.random() * 1000;
    return Math.min(exponentialDelay + jitter, 30000); // Max 30 seconds
  }, [reconnectInterval]);

  // --- Event Listeners Management ---
  const on = useCallback((type: string, callback: (payload: any) => void) => {
    if (!eventListenersRef.current.has(type)) {
      eventListenersRef.current.set(type, new Set());
    }
    eventListenersRef.current.get(type)!.add(callback);

    log(`Event listener added for type: ${type}`);

    // Return unsubscribe function
    return () => {
      const listeners = eventListenersRef.current.get(type);
      if (listeners) {
        listeners.delete(callback);
        if (listeners.size === 0) {
          eventListenersRef.current.delete(type);
        }
      }
      log(`Event listener removed for type: ${type}`);
    };
  }, [log]);

  const off = useCallback((type: string, callback?: (payload: any) => void) => {
    if (callback) {
      const listeners = eventListenersRef.current.get(type);
      if (listeners) {
        listeners.delete(callback);
        if (listeners.size === 0) {
          eventListenersRef.current.delete(type);
        }
      }
    } else {
      eventListenersRef.current.delete(type);
    }
    log(`Event listeners removed for type: ${type}`);
  }, [log]);

  const emit = useCallback((type: string, payload: any) => {
    const listeners = eventListenersRef.current.get(type);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(payload);
        } catch (error) {
          console.error(`Error in WebSocket event listener for type ${type}:`, error);
        }
      });
    }
  }, []);

  // --- WebSocket Connection Management ---
  const connect = useCallback(() => {
    if (!token) {
      const errorMsg = 'Cannot connect: No authentication token provided';
      setError(errorMsg);
      log(errorMsg);
      return;
    }

    if (wsRef.current && (wsRef.current.readyState === WebSocket.CONNECTING || wsRef.current.readyState === WebSocket.OPEN)) {
      log('WebSocket already connecting or connected');
      return;
    }

    setIsConnecting(true);
    setError(null);
    isManualDisconnectRef.current = false;

    try {
      const wsUrl = `${getWebSocketUrl()}?token=${encodeURIComponent(token)}`;
      log(`Connecting to WebSocket: ${wsUrl.replace(token, '[TOKEN]')}`);

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        log('WebSocket connected successfully');
        setIsConnected(true);
        setIsConnecting(false);
        setError(null);
        reconnectAttemptsRef.current = 0;
        setConnectionCount(prev => prev + 1);
        emit('connected', { timestamp: new Date().toISOString() });
      };

      ws.onclose = (event) => {
        log(`WebSocket connection closed: ${event.code} - ${event.reason}`);
        setIsConnected(false);
        setIsConnecting(false);
        wsRef.current = null;

        emit('disconnected', {
          code: event.code,
          reason: event.reason,
          timestamp: new Date().toISOString()
        });

        // Auto-reconnect if not manually disconnected and under attempt limit
        if (!isManualDisconnectRef.current && reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = calculateBackoffDelay(reconnectAttemptsRef.current);
          log(`Attempting reconnect in ${delay}ms (attempt ${reconnectAttemptsRef.current + 1}/${maxReconnectAttempts})`);

          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current++;
            connect();
          }, delay);
        } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          const errorMsg = `Max reconnection attempts (${maxReconnectAttempts}) reached`;
          setError(errorMsg);
          log(errorMsg);
          emit('error', { message: errorMsg, timestamp: new Date().toISOString() });
        }
      };

      ws.onerror = (event) => {
        const errorMsg = 'WebSocket connection error';
        log(errorMsg, event);
        setError(errorMsg);
        setIsConnecting(false);
        emit('error', { message: errorMsg, event, timestamp: new Date().toISOString() });
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          log(`Received message:`, message);
          emit(message.type, message.payload);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
          emit('error', {
            message: 'Failed to parse message',
            error: error instanceof Error ? error.message : String(error),
            rawData: event.data,
            timestamp: new Date().toISOString()
          });
        }
      };

    } catch (error) {
      const errorMsg = `Failed to create WebSocket connection: ${error instanceof Error ? error.message : String(error)}`;
      log(errorMsg);
      setError(errorMsg);
      setIsConnecting(false);
      emit('error', { message: errorMsg, error, timestamp: new Date().toISOString() });
    }
  }, [token, getWebSocketUrl, log, emit, maxReconnectAttempts, calculateBackoffDelay]);

  const disconnect = useCallback(() => {
    log('Manually disconnecting WebSocket');
    isManualDisconnectRef.current = true;
    clearReconnectTimeout();

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);
    setIsConnecting(false);
    setError(null);
    reconnectAttemptsRef.current = 0;
  }, [log, clearReconnectTimeout]);

  const send = useCallback((type: string, payload: any) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      const errorMsg = 'Cannot send message: WebSocket not connected';
      log(errorMsg);
      emit('error', { message: errorMsg, timestamp: new Date().toISOString() });
      return;
    }

    try {
      const message: WebSocketMessage = { type, payload };
      wsRef.current.send(JSON.stringify(message));
      log(`Sent message:`, message);
    } catch (error) {
      const errorMsg = `Failed to send message: ${error instanceof Error ? error.message : String(error)}`;
      log(errorMsg);
      emit('error', { message: errorMsg, error, timestamp: new Date().toISOString() });
    }
  }, [log, emit]);

  // --- Effects ---
  useEffect(() => {
    if (autoConnect && token) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [token, autoConnect]); // Only reconnect when token changes

  useEffect(() => {
    return () => {
      clearReconnectTimeout();
      eventListenersRef.current.clear();
    };
  }, [clearReconnectTimeout]);

  // --- Return Hook Interface ---
  return {
    isConnected,
    isConnecting,
    error,
    connect,
    disconnect,
    send,
    on,
    off,
    connectionCount
  };
}