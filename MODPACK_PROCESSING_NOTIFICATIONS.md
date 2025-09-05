# Modpack Processing Real-time Notifications

This implementation provides a comprehensive real-time notification system for modpack file processing using WebSockets.

## ✨ Features

- **Real-time Progress Updates**: Get live updates on processing progress with percentage completion
- **Category Support**: Track different processing stages ("mods", "resourcepacks", "config", etc.)
- **Error Handling**: Comprehensive error notifications with details
- **Auto-reconnection**: Automatic reconnection with exponential backoff
- **Type Safety**: Full TypeScript support with proper typing
- **Reusable Components**: Ready-to-use React components and hooks

## 🏗️ Architecture

### Backend Structure

```
backend/src/services/
├── websocket.service.ts     # WebSocket connection management
├── realtime.service.ts      # Progress notification functions
```

### Frontend Structure

```
application/src/
├── hooks/
│   ├── useRealtime.ts               # Generic WebSocket hook
│   └── useModpackProcessing.ts      # Specialized modpack processing hook
└── components/modpack/
    └── ModpackProcessingStatus.tsx  # Progress status component
```

## 📡 Message Format

All modpack processing messages follow this structure:

```typescript
interface ModpackProcessingMessage {
  type: 'progress' | 'completed' | 'error';
  modpackId: string;
  versionId: string;
  message: string;
  category?: string;    // For progress: "mods", "resourcepacks", etc.
  percent?: number;     // For progress: 0-100
  details?: any;        // For errors: additional error information
}
```

### Example Messages

**Progress Message:**
```json
{
  "type": "progress",
  "modpackId": "skyblock-adventures",
  "versionId": "v1.2.0",
  "category": "mods",
  "message": "Procesando mods... (45/120 completados)",
  "percent": 37
}
```

**Completion Message:**
```json
{
  "type": "completed",
  "modpackId": "skyblock-adventures",
  "versionId": "v1.2.0",
  "message": "Modpack procesado exitosamente. Listo para usar."
}
```

**Error Message:**
```json
{
  "type": "error",
  "modpackId": "skyblock-adventures",
  "versionId": "v1.2.0",
  "message": "Error al procesar archivo de configuración",
  "details": {
    "errorCode": "CONFIG_PARSE_ERROR",
    "fileName": "config.json",
    "line": 42
  }
}
```

## 🔧 Backend Usage

### Basic Progress Updates

```typescript
import { sendProgressUpdate, sendCompletionUpdate, sendErrorUpdate } from '@/services/realtime.service';

// Send progress update
sendProgressUpdate(
  "modpack-123", 
  "version-456", 
  "Procesando mods...", 
  { 
    percent: 45, 
    category: "mods" 
  }
);

// Send completion
sendCompletionUpdate(
  "modpack-123", 
  "version-456", 
  "Procesamiento completado exitosamente"
);

// Send error
sendErrorUpdate(
  "modpack-123", 
  "version-456", 
  "Error al procesar archivo", 
  { 
    errorCode: "FILE_READ_ERROR",
    fileName: "modpack.zip" 
  }
);
```

### Integration in Endpoints

```typescript
exampleRoute.post('/process', async (c) => {
  const { modpackId, versionId } = c.req.param();
  
  try {
    // Start processing
    sendProgressUpdate(modpackId, versionId, "Iniciando...", { percent: 0 });
    
    // Process steps with updates
    await processStep1();
    sendProgressUpdate(modpackId, versionId, "Extrayendo archivos...", { 
      percent: 25, 
      category: "extraction" 
    });
    
    await processStep2();
    sendProgressUpdate(modpackId, versionId, "Procesando mods...", { 
      percent: 50, 
      category: "mods" 
    });
    
    // Complete
    sendCompletionUpdate(modpackId, versionId, "¡Completado!");
    
    return c.json({ success: true });
  } catch (error) {
    sendErrorUpdate(modpackId, versionId, error.message, { 
      stack: error.stack 
    });
    return c.json({ error: error.message }, 500);
  }
});
```

## ⚛️ Frontend Usage

### Using the Hook

```typescript
import { useModpackProcessing } from '@/hooks/useModpackProcessing';

function MyComponent() {
  const { 
    isConnected, 
    processingState, 
    resetState 
  } = useModpackProcessing(modpackId, versionId, {
    token: authToken,
    onCompleted: () => {
      toast.success("Procesamiento completado!");
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });

  const { isProcessing, percent, statusMessage, category } = processingState;

  return (
    <div>
      {isProcessing && (
        <div>
          <div>Progress: {percent}%</div>
          <div>Status: {statusMessage}</div>
          <div>Category: {category}</div>
        </div>
      )}
    </div>
  );
}
```

### Using the Component

```typescript
import ModpackProcessingStatus from '@/components/modpack/ModpackProcessingStatus';

function ModpackPage() {
  return (
    <div>
      <h1>My Modpack</h1>
      
      <ModpackProcessingStatus
        modpackId="my-modpack"
        versionId="v1.0.0"
        token={authToken}
        onCompleted={() => {
          // Refresh modpack data
          refetch();
        }}
        onError={(error) => {
          console.error("Processing failed:", error);
        }}
      >
        {/* This content shows when no processing is active */}
        <Button onClick={startProcessing}>
          Start Processing
        </Button>
      </ModpackProcessingStatus>
    </div>
  );
}
```

## 🚀 Benefits

1. **Enhanced UX**: Users see real-time progress instead of waiting blindly
2. **Better Error Handling**: Immediate feedback on failures with detailed error information
3. **Scalable**: Uses existing WebSocket infrastructure
4. **Type Safe**: Full TypeScript support prevents runtime errors
5. **Reusable**: Components and hooks can be used across different modpack features
6. **Professional**: Clean, professional-looking progress indicators

## 🔧 Configuration

### Backend Configuration

The WebSocket service automatically handles authentication using JWT tokens. No additional configuration needed.

### Frontend Configuration

The hooks use your existing API endpoint configuration via the `API_ENDPOINT` constant.

## 🧪 Testing

Use the provided integration examples to test the system:

1. Start the backend server
2. Use the example component to simulate processing
3. Observe real-time updates in the UI

## 📱 Mobile Responsive

The components are built with Tailwind CSS and are fully responsive for desktop and mobile devices.

## 🔒 Security

- WebSocket connections require JWT authentication
- Messages are filtered by modpack/version ID to ensure users only see relevant notifications
- No sensitive data is exposed in progress messages