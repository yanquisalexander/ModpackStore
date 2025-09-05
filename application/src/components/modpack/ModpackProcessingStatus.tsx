import React, { useEffect } from 'react';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { LucideCheck, LucideX, LucideLoader2, LucideWifi, LucideWifiOff } from 'lucide-react';
import { useModpackProcessing, ModpackProcessingHookOptions } from '@/hooks/useModpackProcessing';
import { cn } from '@/lib/utils';

// --- Types ---
export interface ModpackProcessingStatusProps {
  modpackId: string;
  versionId: string;
  token?: string;
  className?: string;
  showConnectionStatus?: boolean;
  onCompleted?: () => void;
  onError?: (error: string) => void;
  children?: React.ReactNode;
  processingOptions?: Omit<ModpackProcessingHookOptions, 'token'>;
}

// --- Component ---
export function ModpackProcessingStatus({
  modpackId,
  versionId,
  token,
  className,
  showConnectionStatus = true,
  onCompleted,
  onError,
  children,
  processingOptions = {}
}: ModpackProcessingStatusProps) {
  const {
    isConnected,
    isConnecting,
    connectionError,
    processingState,
    connect,
    disconnect,
    resetState
  } = useModpackProcessing(modpackId, versionId, {
    token,
    ...processingOptions,
    onCompleted: (data) => {
      onCompleted?.();
      processingOptions.onCompleted?.(data);
    },
    onError: (data) => {
      onError?.(data.message);
      processingOptions.onError?.(data);
    }
  });

  // Auto-retry connection if there's an error
  useEffect(() => {
    if (connectionError && !isConnecting && !isConnected) {
      const retryTimeout = setTimeout(() => {
        connect();
      }, 5000);

      return () => clearTimeout(retryTimeout);
    }
  }, [connectionError, isConnecting, isConnected, connect]);

  const renderConnectionStatus = () => {
    if (!showConnectionStatus) return null;

    if (isConnecting) {
      return (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <LucideLoader2 className="h-4 w-4 animate-spin" />
          <span>Conectando...</span>
        </div>
      );
    }

    if (!isConnected) {
      return (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <LucideWifiOff className="h-4 w-4" />
          <span>Desconectado</span>
          <Button
            variant="outline"
            size="sm"
            onClick={connect}
            className="ml-2"
          >
            Reconectar
          </Button>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2 text-sm text-green-600">
        <LucideWifi className="h-4 w-4" />
        <span>Conectado</span>
      </div>
    );
  };

  const renderProcessingStatus = () => {
    const { isProcessing, isCompleted, error, statusMessage, percent, category } = processingState;

    // No active processing
    if (!isProcessing && !isCompleted && !error) {
      return children;
    }

    // Processing in progress
    if (isProcessing) {
      return (
        <div className="space-y-3 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <LucideLoader2 className="h-4 w-4 animate-spin text-blue-600" />
              <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                Procesando modpack...
              </span>
              {category && (
                <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-1 rounded">
                  {category}
                </span>
              )}
            </div>
            <span className="text-sm text-blue-700 dark:text-blue-300">
              {Math.round(percent)}%
            </span>
          </div>
          
          <Progress 
            value={percent} 
            className="w-full" 
          />
          
          {statusMessage && (
            <p className="text-xs text-blue-700 dark:text-blue-300">
              {statusMessage}
            </p>
          )}

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={resetState}
              className="text-blue-600 border-blue-300 hover:bg-blue-50"
            >
              Ocultar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={disconnect}
              className="text-red-600 border-red-300 hover:bg-red-50"
            >
              Desconectar
            </Button>
          </div>
        </div>
      );
    }

    // Completed successfully
    if (isCompleted) {
      return (
        <Alert className="border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800">
          <LucideCheck className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800 dark:text-green-200">
            <div className="flex items-center justify-between">
              <span>{statusMessage || 'Modpack procesado exitosamente'}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={resetState}
                className="text-green-600 border-green-300 hover:bg-green-50"
              >
                Cerrar
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      );
    }

    // Error occurred
    if (error) {
      return (
        <Alert variant="destructive" className="bg-red-50 dark:bg-red-950/20">
          <LucideX className="h-4 w-4" />
          <AlertDescription>
            <div className="flex items-center justify-between">
              <span>{error}</span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetState}
                  className="text-red-600 border-red-300 hover:bg-red-50"
                >
                  Cerrar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={connect}
                  className="text-blue-600 border-blue-300 hover:bg-blue-50"
                >
                  Reintentar
                </Button>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      );
    }

    return children;
  };

  return (
    <div className={cn("space-y-3", className)}>
      {renderConnectionStatus()}
      {renderProcessingStatus()}
    </div>
  );
}

export default ModpackProcessingStatus;