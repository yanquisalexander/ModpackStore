import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LucideRefreshCw, LucideDownload, LucideCheck, LucideAlert, LucideX } from 'lucide-react';
import { toast } from 'sonner';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { Progress } from '@/components/ui/progress';

interface ModpackInstance {
    instanceId: string;
    instanceName: string;
    modpackId?: string;
    modpackVersionId?: string;
}

interface UpdateInfo {
    hasUpdate: boolean;
    latestVersion?: {
        id: string;
        version: string;
        mcVersion: string;
        forgeVersion?: string;
        releaseDate: string;
    };
    offlineMode?: boolean;
}

interface Props {
    instance: ModpackInstance;
    onUpdate?: () => void;
}

interface TaskUpdate {
    id: string;
    status: 'Pending' | 'Running' | 'Completed' | 'Failed' | 'Cancelled';
    progress: number;
    message: string;
    data?: any;
}

export const ModpackUpdateChecker: React.FC<Props> = ({ instance, onUpdate }) => {
    const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
    const [checking, setChecking] = useState(false);
    const [updating, setUpdating] = useState(false);
    const [lastChecked, setLastChecked] = useState<Date | null>(null);
    const [taskProgress, setTaskProgress] = useState<{
        active: boolean;
        progress: number;
        message: string;
        status: string;
    }>({
        active: false,
        progress: 0,
        message: '',
        status: 'Pending'
    });

    // OFFLINE MODE: Este componente maneja errores de red de forma tolerante.
    // Si no puede contactar el backend, muestra un aviso no bloqueante y continúa funcionando.
    // El objetivo es que el launcher nunca se bloquee por problemas de conexión.

    // Only show for modpack instances
    if (!instance.modpackId) {
        return null;
    }

    useEffect(() => {
        // Listen for task updates
        const unlistenTask = listen<TaskUpdate>('task-updated', (event) => {
            const task = event.payload;
            if (task.data?.type === 'modpack_update' && task.data?.instanceId === instance.instanceId) {
                setTaskProgress({
                    active: task.status === 'Running',
                    progress: task.progress,
                    message: task.message,
                    status: task.status
                });

                if (task.status === 'Completed') {
                    toast.success('Modpack actualizado exitosamente');
                    setUpdating(false);
                    setUpdateInfo(null); // Clear update info since it's now updated
                    onUpdate?.();
                } else if (task.status === 'Failed') {
                    toast.error(`Error actualizando: ${task.message}`);
                    setUpdating(false);
                    setTaskProgress(prev => ({ ...prev, active: false }));
                }
            }
        });

        return () => {
            unlistenTask.then(fn => fn());
        };
    }, [instance.instanceId, onUpdate]);

    const checkForUpdates = async () => {
        if (!instance.modpackId) return;

        setChecking(true);
        try {
            // Get current version from the instance
            const currentVersion = instance.modpackVersionId || 'unknown';
            
            const result = await invoke<UpdateInfo>('check_modpack_updates', {
                modpackId: instance.modpackId,
                currentVersion
            });

            setUpdateInfo(result);
            setLastChecked(new Date());
            
            if (result.offlineMode) {
                // En modo offline - mostrar advertencia no bloqueante
                toast.warning('No se pudo verificar actualizaciones', {
                    description: 'Ejecutando en modo offline. Usando información local.',
                    duration: 4000
                });
            } else if (result.hasUpdate) {
                toast.success('¡Actualización disponible!');
            } else {
                toast.success('Estás en la última versión');
            }
        } catch (error) {
            console.error('Error checking for updates:', error);
            
            // Fallback: Si incluso el comando Tauri falla, usar datos locales
            toast.warning('No se pudo verificar actualizaciones', {
                description: 'Ejecutando en modo offline. Usando información local.',
                duration: 4000
            });
            
            // Usar datos locales - asumir no hay actualización si no podemos verificar
            setUpdateInfo({
                hasUpdate: false,
                latestVersion: undefined,
                offlineMode: true
            });
            setLastChecked(new Date());
        } finally {
            setChecking(false);
        }
    };

    const updateModpack = async () => {
        if (!instance.modpackId || !updateInfo?.hasUpdate) return;

        setUpdating(true);
        setTaskProgress({
            active: true,
            progress: 0,
            message: 'Iniciando actualización...',
            status: 'Running'
        });

        try {
            await invoke('update_modpack_instance', {
                instanceId: instance.instanceId,
                targetVersionId: undefined // Use latest
            });

            toast.success('Actualización iniciada');
        } catch (error) {
            console.error('Error updating modpack:', error);
            toast.error(error instanceof Error ? error.message : 'Error al actualizar el modpack');
            setUpdating(false);
            setTaskProgress(prev => ({ ...prev, active: false }));
        }
    };

    const getUpdateBadge = () => {
        if (!updateInfo) return null;

        if (updateInfo.hasUpdate) {
            return (
                <Badge variant="destructive" className="ml-2">
                    <LucideAlert className="h-3 w-3 mr-1" />
                    Actualización disponible
                </Badge>
            );
        } else if (updateInfo.offlineMode) {
            return (
                <Badge variant="outline" className="ml-2">
                    <LucideX className="h-3 w-3 mr-1" />
                    Modo offline
                </Badge>
            );
        } else {
            return (
                <Badge variant="secondary" className="ml-2">
                    <LucideCheck className="h-3 w-3 mr-1" />
                    Actualizado
                </Badge>
            );
        }
    };

    return (
        <Card className="mt-4">
            <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center">
                    Control de Actualizaciones
                    {getUpdateBadge()}
                </CardTitle>
                <CardDescription>
                    Verifica y aplica actualizaciones para este modpack
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Check for updates button */}
                <div className="flex items-center justify-between">
                    <div>
                        {lastChecked && (
                            <p className="text-sm text-gray-600">
                                Última verificación: {lastChecked.toLocaleString()}
                            </p>
                        )}
                    </div>
                    <Button
                        onClick={checkForUpdates}
                        disabled={checking || updating}
                        variant="outline"
                        size="sm"
                    >
                        <LucideRefreshCw className={`h-4 w-4 mr-2 ${checking ? 'animate-spin' : ''}`} />
                        {checking ? 'Verificando...' : 'Verificar actualizaciones'}
                    </Button>
                </div>

                {/* Update info */}
                {updateInfo?.hasUpdate && updateInfo.latestVersion && (
                    <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                        <div className="flex items-center justify-between">
                            <div>
                                <h4 className="font-medium text-orange-900">
                                    Nueva versión disponible: {updateInfo.latestVersion.version}
                                </h4>
                                <p className="text-sm text-orange-700">
                                    Minecraft {updateInfo.latestVersion.mcVersion}
                                    {updateInfo.latestVersion.forgeVersion && 
                                        ` • Forge ${updateInfo.latestVersion.forgeVersion}`
                                    }
                                </p>
                                <p className="text-xs text-orange-600">
                                    Publicado: {new Date(updateInfo.latestVersion.releaseDate).toLocaleDateString()}
                                </p>
                            </div>
                            <Button
                                onClick={updateModpack}
                                disabled={updating}
                                size="sm"
                            >
                                <LucideDownload className="h-4 w-4 mr-2" />
                                {updating ? 'Actualizando...' : 'Actualizar'}
                            </Button>
                        </div>
                    </div>
                )}

                {/* Update progress */}
                {taskProgress.active && (
                    <div className="space-y-2 p-3 bg-blue-50 rounded-lg border">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-blue-900">
                                Actualizando modpack...
                            </span>
                            <span className="text-sm text-blue-700">
                                {Math.round(taskProgress.progress)}%
                            </span>
                        </div>
                        <Progress value={taskProgress.progress} className="w-full" />
                        <p className="text-xs text-blue-700">
                            {taskProgress.message}
                        </p>
                    </div>
                )}

                {/* Status indicators */}
                {!taskProgress.active && taskProgress.status === 'Completed' && (
                    <div className="flex items-center gap-2 p-2 bg-green-50 rounded text-green-700">
                        <LucideCheck className="h-4 w-4" />
                        <span className="text-sm">Modpack actualizado exitosamente</span>
                    </div>
                )}

                {!taskProgress.active && taskProgress.status === 'Failed' && (
                    <div className="flex items-center gap-2 p-2 bg-red-50 rounded text-red-700">
                        <LucideX className="h-4 w-4" />
                        <span className="text-sm">Error al actualizar el modpack</span>
                    </div>
                )}

                {/* No updates available */}
                {updateInfo && !updateInfo.hasUpdate && (
                    <div className="flex items-center gap-2 p-2 bg-green-50 rounded text-green-700">
                        <LucideCheck className="h-4 w-4" />
                        <span className="text-sm">Estás usando la última versión disponible</span>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};