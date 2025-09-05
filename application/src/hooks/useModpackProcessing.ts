import { useState, useEffect, useCallback } from 'react';
import { useRealtime } from './useRealtime';

// --- Types ---
export interface ModpackProcessingState {
  isProcessing: boolean;
  isCompleted: boolean;
  error: string | null;
  statusMessage: string;
  percent: number;
  category?: string;
}

export interface ModpackProcessingHookOptions {
  token?: string;
  autoConnect?: boolean;
  debug?: boolean;
  onProgress?: (data: ModpackProcessingData) => void;
  onCompleted?: (data: ModpackCompletedData) => void;
  onError?: (data: ModpackErrorData) => void;
}

export interface ModpackProcessingData {
  type: 'progress';
  modpackId: string;
  versionId: string;
  category?: string;
  message: string;
  percent?: number;
}

export interface ModpackCompletedData {
  type: 'completed';
  modpackId: string;
  versionId: string;
  message: string;
}

export interface ModpackErrorData {
  type: 'error';
  modpackId: string;
  versionId: string;
  message: string;
  details?: any;
}

export type ModpackProcessingMessage = ModpackProcessingData | ModpackCompletedData | ModpackErrorData;

export interface ModpackProcessingHookReturn {
  isConnected: boolean;
  isConnecting: boolean;
  connectionError: string | null;
  processingState: ModpackProcessingState;
  connect: () => void;
  disconnect: () => void;
  resetState: () => void;
}

// --- Hook Implementation ---
export function useModpackProcessing(
  modpackId: string,
  versionId: string,
  options: ModpackProcessingHookOptions = {}
): ModpackProcessingHookReturn {
  const {
    token,
    autoConnect = true,
    debug = false,
    onProgress,
    onCompleted,
    onError
  } = options;

  // WebSocket connection
  const { 
    isConnected, 
    isConnecting, 
    error: connectionError, 
    connect, 
    disconnect, 
    on, 
    off 
  } = useRealtime(token, { 
    autoConnect, 
    debug,
    reconnectInterval: 2000,
    maxReconnectAttempts: 10
  });

  // Processing state
  const [processingState, setProcessingState] = useState<ModpackProcessingState>({
    isProcessing: false,
    isCompleted: false,
    error: null,
    statusMessage: '',
    percent: 0
  });

  // Reset processing state
  const resetState = useCallback(() => {
    setProcessingState({
      isProcessing: false,
      isCompleted: false,
      error: null,
      statusMessage: '',
      percent: 0
    });
  }, []);

  // Handle modpack processing messages
  const handleModpackProcessing = useCallback((payload: ModpackProcessingMessage) => {
    // Only process messages for the specific modpack and version
    if (payload.modpackId !== modpackId || payload.versionId !== versionId) {
      return;
    }

    if (debug) {
      console.log('[useModpackProcessing] Received message:', payload);
    }

    switch (payload.type) {
      case 'progress':
        setProcessingState(prev => ({
          ...prev,
          isProcessing: true,
          isCompleted: false,
          error: null,
          statusMessage: payload.message,
          percent: payload.percent ?? prev.percent,
          category: payload.category
        }));
        onProgress?.(payload);
        break;

      case 'completed':
        setProcessingState(prev => ({
          ...prev,
          isProcessing: false,
          isCompleted: true,
          error: null,
          statusMessage: payload.message,
          percent: 100
        }));
        onCompleted?.(payload);
        break;

      case 'error':
        setProcessingState(prev => ({
          ...prev,
          isProcessing: false,
          isCompleted: false,
          error: payload.message,
          statusMessage: payload.message,
          percent: prev.percent
        }));
        onError?.(payload);
        break;

      default:
        if (debug) {
          console.warn('[useModpackProcessing] Unknown message type:', (payload as any).type);
        }
    }
  }, [modpackId, versionId, debug, onProgress, onCompleted, onError]);

  // Set up event listeners
  useEffect(() => {
    const unsubscribe = on('modpack_processing', handleModpackProcessing);

    return () => {
      unsubscribe();
    };
  }, [on, handleModpackProcessing]);

  // Clean up when modpack or version changes
  useEffect(() => {
    resetState();
  }, [modpackId, versionId, resetState]);

  return {
    isConnected,
    isConnecting,
    connectionError,
    processingState,
    connect,
    disconnect,
    resetState
  };
}