# Sistema de Notificaciones con Tauri

Este sistema proporciona notificaciones del sistema operativo con sonidos personalizados para la aplicación ModpackStore.

## Características

- ✅ Notificaciones del sistema nativas
- 🔊 Sonidos personalizados por tipo de notificación
- 🎛️ Control de volumen
- 🔒 Manejo de permisos
- 🎨 Configuración por defecto por tipo
- 🔔 Notificaciones personalizadas

## Instalación

El hook `useNotifications` ya está disponible en el proyecto. Solo necesitas importar sonidos en la carpeta `/public/sounds/`.

## Archivos de sonido requeridos

Coloca estos archivos MP3 en `/public/sounds/`:

```
public/sounds/
├── error-notification.mp3
├── success-notification.mp3
├── warning-notification.mp3
├── info-notification.mp3
├── game-invitation-notification.mp3
├── download-complete-notification.mp3
└── update-available-notification.mp3
```

## Uso básico

```tsx
import { useNotifications } from '@/hooks/useNotifications';

function MyComponent() {
  const { notifySuccess, notifyError, permissionGranted } = useNotifications();

  const handleAction = async () => {
    try {
      await someAsyncOperation();
      notifySuccess('Operación completada');
    } catch (error) {
      notifyError('Error en la operación');
    }
  };

  if (!permissionGranted) {
    return <div>Se requieren permisos de notificación</div>;
  }

  return (
    <button onClick={handleAction}>
      Ejecutar acción
    </button>
  );
}
```

## API completa

### Estados

- `permissionGranted: boolean` - Si el usuario concedió permisos
- `permissionStatus: 'granted' | 'denied' | 'default' | 'unknown'` - Estado detallado

### Acciones

- `requestPermission(): Promise<boolean>` - Solicitar permisos al usuario
- `notify(type, body, options?)` - Enviar notificación por tipo
- `notifyCustom(options)` - Notificación completamente personalizada

### Notificaciones predefinidas

```tsx
const {
  notifySuccess,
  notifyError,
  notifyWarning,
  notifyInfo,
  notifyGameInvitation,
  notifyDownloadComplete,
  notifyUpdateAvailable,
} = useNotifications();

// Todas devuelven Promise<void>
notifySuccess('Mensaje de éxito');
notifyError('Mensaje de error');
notifyWarning('Mensaje de advertencia');
notifyInfo('Mensaje informativo');
notifyGameInvitation('Invitación de juego');
notifyDownloadComplete('Descarga completada');
notifyUpdateAvailable('Actualización disponible');
```

## Opciones de personalización

```tsx
interface NotificationOptions {
  title?: string;           // Título personalizado
  body: string;             // Contenido (requerido)
  icon?: string;            // Emoji o URL de icono
  sound?: boolean;          // Habilitar sonido (default: true)
  soundVolume?: number;     // Volumen 0-1 (default: varía por tipo)
  customSound?: string;     // URL de sonido personalizado
  persistent?: boolean;     // Notificación persistente
  timeout?: number;         // Timeout en ms
}

// Ejemplo de notificación personalizada
notifyCustom({
  title: 'Notificación Especial',
  body: 'Contenido personalizado',
  icon: '🎉',
  sound: true,
  soundVolume: 0.8,
  customSound: '/sounds/mi-sonido.mp3',
});
```

## Tipos de notificación

| Tipo | Icono | Sonido | Volumen | Uso |
|------|-------|--------|---------|-----|
| SUCCESS | ✅ | success-notification.mp3 | 0.7 | Operaciones exitosas |
| ERROR | ❌ | error-notification.mp3 | 0.8 | Errores |
| WARNING | ⚠️ | warning-notification.mp3 | 0.6 | Advertencias |
| INFO | ℹ️ | info-notification.mp3 | 0.5 | Información general |
| GAME_INVITATION | 🎮 | game-invitation-notification.mp3 | 0.9 | Invitaciones de juego |
| DOWNLOAD_COMPLETE | 📥 | download-complete-notification.mp3 | 0.8 | Descargas completadas |
| UPDATE_AVAILABLE | ⬆️ | update-available-notification.mp3 | 0.7 | Actualizaciones |

## Manejo de permisos

```tsx
const { permissionGranted, requestPermission } = useNotifications();

useEffect(() => {
  if (!permissionGranted) {
    // Solicitar permisos automáticamente o mostrar UI
    requestPermission();
  }
}, [permissionGranted]);
```

## Integración con componentes existentes

El hook está diseñado para integrarse fácilmente con el sistema existente de toasts (Sonner):

```tsx
import { toast } from 'sonner';
import { useNotifications } from '@/hooks/useNotifications';

function handleAction() {
  const { notifySuccess } = useNotifications();

  // Toast visual + notificación del sistema
  toast.success('Operación exitosa');
  notifySuccess('La operación se completó correctamente');
}
```

## Notas técnicas

- Los sonidos se precargan automáticamente al iniciar la aplicación
- Las notificaciones respetan la configuración del sistema operativo
- En Windows/Linux se muestran notificaciones nativas
- En macOS se integran con el Centro de Notificaciones
- Los sonidos personalizados deben estar en formato MP3
- El volumen se controla por software (no afecta el volumen del sistema)