# Quick Integration Guide

## 🚀 How to Use the New Real-time Notifications

### Backend Integration (in your processing endpoints):

```typescript
import { sendProgressUpdate, sendCompletionUpdate, sendErrorUpdate } from '@/services/realtime.service';

// In your modpack processing endpoint:
export async function processModpack(modpackId: string, versionId: string) {
  try {
    // Start
    sendProgressUpdate(modpackId, versionId, "Iniciando...", { percent: 0 });
    
    // Progress updates
    sendProgressUpdate(modpackId, versionId, "Procesando mods...", { 
      percent: 25, 
      category: "mods" 
    });
    
    // More progress...
    sendProgressUpdate(modpackId, versionId, "Validando texturas...", { 
      percent: 75, 
      category: "resourcepacks" 
    });
    
    // Complete
    sendCompletionUpdate(modpackId, versionId, "¡Completado exitosamente!");
    
  } catch (error) {
    sendErrorUpdate(modpackId, versionId, error.message);
  }
}
```

### Frontend Integration (in your React components):

**Option 1: Use the Component (Recommended)**
```tsx
import ModpackProcessingStatus from '@/components/modpack/ModpackProcessingStatus';

function MyModpackPage() {
  return (
    <ModpackProcessingStatus
      modpackId="my-modpack-id"
      versionId="my-version-id"
      token={authToken}
      onCompleted={() => {
        // Refresh data, show success message, etc.
        toast.success("Modpack ready!");
      }}
    >
      {/* This shows when no processing is active */}
      <Button onClick={startProcessing}>
        Start Processing
      </Button>
    </ModpackProcessingStatus>
  );
}
```

**Option 2: Use the Hook Directly**
```tsx
import { useModpackProcessing } from '@/hooks/useModpackProcessing';

function MyCustomComponent() {
  const { processingState, isConnected } = useModpackProcessing(
    modpackId, 
    versionId, 
    { token: authToken }
  );
  
  const { isProcessing, percent, statusMessage } = processingState;
  
  return (
    <div>
      {isProcessing && (
        <div>
          <div>Progress: {percent}%</div>
          <div>{statusMessage}</div>
        </div>
      )}
    </div>
  );
}
```

## ✨ Key Features Implemented:

- ✅ **Real-time progress updates** with percentage completion
- ✅ **Category tracking** ("mods", "resourcepacks", "config", etc.)
- ✅ **Professional UI components** with progress bars and status indicators
- ✅ **Automatic reconnection** with exponential backoff
- ✅ **Type-safe** with full TypeScript support
- ✅ **Error handling** with detailed error messages
- ✅ **Mobile responsive** design
- ✅ **Dark mode** support

## 📁 Files Added/Modified:

### Backend:
- `backend/src/services/realtime.service.ts` - Added progress notification functions

### Frontend:
- `application/src/hooks/useModpackProcessing.ts` - New specialized hook
- `application/src/components/modpack/ModpackProcessingStatus.tsx` - New UI component

### Documentation:
- `MODPACK_PROCESSING_NOTIFICATIONS.md` - Complete documentation
- `INTEGRATION_EXAMPLE.tsx` - Frontend usage example
- `BACKEND_INTEGRATION_EXAMPLE.ts` - Backend usage example

## 🎯 Ready to Use!

The system is now ready for production use. Simply integrate the backend functions into your existing modpack processing endpoints and use the frontend components in your UI.