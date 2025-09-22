import { useState, useEffect, useCallback } from 'react';
import {
    isPermissionGranted,
    requestPermission,
    sendNotification,
    type Options,
} from '@tauri-apps/plugin-notification';
import { playSound } from '@/utils/sounds';

// Tipo para permisos de notificación
type NotificationPermission = 'granted' | 'denied' | 'default';

// Tipos de notificación disponibles
export enum NotificationType {
    SUCCESS = 'success',
    ERROR = 'error',
    WARNING = 'warning',
    INFO = 'info',
    GAME_INVITATION = 'game_invitation',
    DOWNLOAD_COMPLETE = 'download_complete',
    UPDATE_AVAILABLE = 'update_available',
}

// Configuración de sonidos por tipo de notificación
const NOTIFICATION_SOUNDS = {
    [NotificationType.SUCCESS]: 'SUCCESS_NOTIFICATION',
    [NotificationType.ERROR]: 'ERROR_NOTIFICATION',
    [NotificationType.WARNING]: 'WARNING_NOTIFICATION',
    [NotificationType.INFO]: 'INFO_NOTIFICATION',
    [NotificationType.GAME_INVITATION]: 'GAME_INVITATION_NOTIFICATION',
    [NotificationType.DOWNLOAD_COMPLETE]: 'DOWNLOAD_COMPLETE_NOTIFICATION',
    [NotificationType.UPDATE_AVAILABLE]: 'UPDATE_AVAILABLE_NOTIFICATION',
} as const;

// Configuración por defecto para cada tipo
const DEFAULT_CONFIGS = {
    [NotificationType.SUCCESS]: {
        title: 'Éxito',
        icon: '✅',
        sound: true,
        soundVolume: 0.7,
    },
    [NotificationType.ERROR]: {
        title: 'Error',
        icon: '❌',
        sound: true,
        soundVolume: 0.8,
    },
    [NotificationType.WARNING]: {
        title: 'Advertencia',
        icon: '⚠️',
        sound: true,
        soundVolume: 0.6,
    },
    [NotificationType.INFO]: {
        title: 'Información',
        icon: 'ℹ️',
        sound: true,
        soundVolume: 0.5,
    },
    [NotificationType.GAME_INVITATION]: {
        title: 'Invitación de Juego',
        icon: '🎮',
        sound: true,
        soundVolume: 0.9,
    },
    [NotificationType.DOWNLOAD_COMPLETE]: {
        title: 'Descarga Completa',
        icon: '📥',
        sound: true,
        soundVolume: 0.8,
    },
    [NotificationType.UPDATE_AVAILABLE]: {
        title: 'Actualización Disponible',
        icon: '⬆️',
        sound: true,
        soundVolume: 0.7,
    },
};

export interface NotificationOptions {
    title?: string;
    body: string;
    icon?: string;
    sound?: boolean;
    soundVolume?: number;
    customSound?: string;
    persistent?: boolean;
    timeout?: number;
}

export interface UseNotificationsReturn {
    // Estado
    permissionGranted: boolean;
    permissionStatus: NotificationPermission | 'unknown';

    // Acciones
    requestPermission: () => Promise<boolean>;
    notify: (type: NotificationType, body: string, options?: Partial<NotificationOptions>) => Promise<void>;
    notifyCustom: (options: NotificationOptions) => Promise<void>;

    // Notificaciones específicas
    notifySuccess: (body: string, options?: Partial<NotificationOptions>) => Promise<void>;
    notifyError: (body: string, options?: Partial<NotificationOptions>) => Promise<void>;
    notifyWarning: (body: string, options?: Partial<NotificationOptions>) => Promise<void>;
    notifyInfo: (body: string, options?: Partial<NotificationOptions>) => Promise<void>;
    notifyGameInvitation: (body: string, options?: Partial<NotificationOptions>) => Promise<void>;
    notifyDownloadComplete: (body: string, options?: Partial<NotificationOptions>) => Promise<void>;
    notifyUpdateAvailable: (body: string, options?: Partial<NotificationOptions>) => Promise<void>;
}

export function useNotifications(): UseNotificationsReturn {
    const [permissionGranted, setPermissionGranted] = useState(false);
    const [permissionStatus, setPermissionStatus] = useState<NotificationPermission | 'unknown'>('unknown');

    // Verificar permisos al montar el hook
    useEffect(() => {
        checkPermissionStatus();
    }, []);

    const checkPermissionStatus = useCallback(async () => {
        try {
            const granted = await isPermissionGranted();
            setPermissionGranted(granted);
            setPermissionStatus(granted ? 'granted' : 'default');
        } catch (error) {
            console.error('Error checking notification permission:', error);
            setPermissionStatus('unknown');
            setPermissionGranted(false);
        }
    }, []);

    const requestPermissionAsync = useCallback(async (): Promise<boolean> => {
        try {
            const status = await requestPermission();
            const granted = status === 'granted';
            setPermissionGranted(granted);
            setPermissionStatus(status);
            return granted;
        } catch (error) {
            console.error('Error requesting notification permission:', error);
            setPermissionStatus('denied');
            setPermissionGranted(false);
            return false;
        }
    }, []);

    const playNotificationSound = useCallback((type: NotificationType, volume?: number, customSound?: string) => {
        try {
            if (customSound) {
                // Reproducir sonido personalizado
                const audio = new Audio(customSound);
                audio.volume = volume || 0.7;
                audio.play().catch(console.error);
            } else {
                // Reproducir sonido predefinido
                const soundKey = NOTIFICATION_SOUNDS[type];
                if (soundKey) {
                    playSound(soundKey as any, volume);
                }
            }
        } catch (error) {
            console.error('Error playing notification sound:', error);
        }
    }, []);

    const sendSystemNotification = useCallback(async (options: Options) => {
        if (!permissionGranted) {
            console.warn('Notification permission not granted');
            return;
        }

        try {
            await sendNotification(options);
        } catch (error) {
            console.error('Error sending system notification:', error);
        }
    }, [permissionGranted]);

    const notify = useCallback(async (
        type: NotificationType,
        body: string,
        options: Partial<NotificationOptions> = {}
    ) => {
        const config = DEFAULT_CONFIGS[type];
        const finalOptions: NotificationOptions = {
            title: options.title || config.title,
            body,
            icon: options.icon || config.icon,
            sound: options.sound !== undefined ? options.sound : config.sound,
            soundVolume: options.soundVolume || config.soundVolume,
            customSound: options.customSound,
            persistent: options.persistent || false,
            timeout: options.timeout,
        };

        // Reproducir sonido si está habilitado
        if (finalOptions.sound) {
            playNotificationSound(type, finalOptions.soundVolume, finalOptions.customSound);
        }

        // Enviar notificación del sistema
        await sendSystemNotification({
            title: finalOptions.title || 'Notificación',
            body: finalOptions.body,
            icon: finalOptions.icon,
        });
    }, [playNotificationSound, sendSystemNotification]);

    const notifyCustom = useCallback(async (options: NotificationOptions) => {
        // Reproducir sonido si está habilitado
        if (options.sound) {
            playNotificationSound(NotificationType.INFO, options.soundVolume, options.customSound);
        }

        // Enviar notificación del sistema
        await sendSystemNotification({
            title: options.title || 'Notificación',
            body: options.body,
            icon: options.icon,
        });
    }, [playNotificationSound, sendSystemNotification]);

    // Funciones específicas por tipo
    const notifySuccess = useCallback((body: string, options?: Partial<NotificationOptions>) =>
        notify(NotificationType.SUCCESS, body, options), [notify]);

    const notifyError = useCallback((body: string, options?: Partial<NotificationOptions>) =>
        notify(NotificationType.ERROR, body, options), [notify]);

    const notifyWarning = useCallback((body: string, options?: Partial<NotificationOptions>) =>
        notify(NotificationType.WARNING, body, options), [notify]);

    const notifyInfo = useCallback((body: string, options?: Partial<NotificationOptions>) =>
        notify(NotificationType.INFO, body, options), [notify]);

    const notifyGameInvitation = useCallback((body: string, options?: Partial<NotificationOptions>) =>
        notify(NotificationType.GAME_INVITATION, body, options), [notify]);

    const notifyDownloadComplete = useCallback((body: string, options?: Partial<NotificationOptions>) =>
        notify(NotificationType.DOWNLOAD_COMPLETE, body, options), [notify]);

    const notifyUpdateAvailable = useCallback((body: string, options?: Partial<NotificationOptions>) =>
        notify(NotificationType.UPDATE_AVAILABLE, body, options), [notify]);

    return {
        // Estado
        permissionGranted,
        permissionStatus,

        // Acciones
        requestPermission: requestPermissionAsync,
        notify,
        notifyCustom,

        // Notificaciones específicas
        notifySuccess,
        notifyError,
        notifyWarning,
        notifyInfo,
        notifyGameInvitation,
        notifyDownloadComplete,
        notifyUpdateAvailable,
    };
}