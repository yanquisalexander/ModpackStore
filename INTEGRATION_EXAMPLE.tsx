import React from 'react';
import { Button } from '@/components/ui/button';
import ModpackProcessingStatus from '@/components/modpack/ModpackProcessingStatus';
import { sendProgressUpdate, sendCompletionUpdate, sendErrorUpdate } from '../../../backend/src/services/realtime.service';

// Example integration component showing how to use the real-time modpack processing notifications
export function ModpackProcessingExample() {
  const modpackId = "example-modpack-123";
  const versionId = "example-version-456";
  const token = "your-jwt-token"; // This would come from your auth context

  // Simulate modpack processing with progress updates
  const simulateProcessing = async () => {
    try {
      // Start processing notification
      sendProgressUpdate(modpackId, versionId, "Iniciando procesamiento...", { percent: 0 });

      // Simulate processing steps
      await new Promise(resolve => setTimeout(resolve, 1000));
      sendProgressUpdate(modpackId, versionId, "Extrayendo archivos...", { percent: 20, category: "extraction" });

      await new Promise(resolve => setTimeout(resolve, 1500));
      sendProgressUpdate(modpackId, versionId, "Procesando mods...", { percent: 40, category: "mods" });

      await new Promise(resolve => setTimeout(resolve, 1200));
      sendProgressUpdate(modpackId, versionId, "Validando texturas...", { percent: 60, category: "resourcepacks" });

      await new Promise(resolve => setTimeout(resolve, 1000));
      sendProgressUpdate(modpackId, versionId, "Generando configuración...", { percent: 80, category: "config" });

      await new Promise(resolve => setTimeout(resolve, 800));
      sendProgressUpdate(modpackId, versionId, "Finalizando...", { percent: 95 });

      await new Promise(resolve => setTimeout(resolve, 500));
      sendCompletionUpdate(modpackId, versionId, "Modpack procesado exitosamente");
      
    } catch (error) {
      sendErrorUpdate(modpackId, versionId, "Error durante el procesamiento", { error: error.message });
    }
  };

  const simulateError = () => {
    sendErrorUpdate(modpackId, versionId, "Error simulado: No se pudo acceder al archivo", {
      code: "FILE_ACCESS_ERROR",
      details: "Permiso denegado al intentar leer el archivo modpack.zip"
    });
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Ejemplo de Notificaciones en Tiempo Real</h2>
        <p className="text-muted-foreground">
          Este ejemplo muestra cómo usar el sistema de notificaciones para el procesamiento de modpacks.
        </p>
      </div>

      {/* Processing Status Component */}
      <ModpackProcessingStatus
        modpackId={modpackId}
        versionId={versionId}
        token={token}
        showConnectionStatus={true}
        onCompleted={() => {
          console.log("Processing completed!");
        }}
        onError={(error) => {
          console.error("Processing error:", error);
        }}
      >
        {/* This content is shown when no processing is active */}
        <div className="p-4 border rounded-lg bg-muted/50">
          <h3 className="font-medium mb-2">Listo para procesar</h3>
          <p className="text-sm text-muted-foreground mb-4">
            No hay procesamiento activo. Inicia una simulación para ver las notificaciones en tiempo real.
          </p>
          
          <div className="flex gap-2">
            <Button onClick={simulateProcessing}>
              Simular Procesamiento
            </Button>
            <Button variant="destructive" onClick={simulateError}>
              Simular Error
            </Button>
          </div>
        </div>
      </ModpackProcessingStatus>

      {/* Usage Information */}
      <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
        <h3 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
          Cómo integrar en tu código:
        </h3>
        <div className="text-xs text-blue-800 dark:text-blue-200 space-y-2">
          <p><strong>Backend:</strong> Usa <code>sendProgressUpdate()</code>, <code>sendCompletionUpdate()</code>, <code>sendErrorUpdate()</code> en tus endpoints de procesamiento.</p>
          <p><strong>Frontend:</strong> Usa el componente <code>ModpackProcessingStatus</code> o el hook <code>useModpackProcessing</code> directamente.</p>
          <p><strong>WebSocket:</strong> Las notificaciones se envían automáticamente a todos los usuarios conectados.</p>
        </div>
      </div>
    </div>
  );
}

export default ModpackProcessingExample;