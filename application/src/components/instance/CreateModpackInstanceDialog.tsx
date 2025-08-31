import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { LucidePackage, LucideDownload, LucideCheck, LucideX } from 'lucide-react';
import { toast } from 'sonner';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { ModpackPasswordDialog } from '@/components/modpack/ModpackPasswordDialog';

interface ModpackVersion {
    id: string;
    version: string;
    mcVersion: string;
    forgeVersion?: string;
    releaseDate: string;
}

interface Modpack {
    id: string;
    name: string;
    iconUrl?: string;
    versions?: ModpackVersion[];
    isPasswordProtected?: boolean;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (instanceId: string) => void;
    modpack: Modpack;
}

interface TaskUpdate {
    id: string;
    status: 'Pending' | 'Running' | 'Completed' | 'Failed' | 'Cancelled';
    progress: number;
    message: string;
    data?: any;
}

export const CreateModpackInstanceDialog: React.FC<Props> = ({ isOpen, onClose, onSuccess, modpack }) => {
    const [instanceName, setInstanceName] = useState('');
    const [selectedVersionId, setSelectedVersionId] = useState<string>('latest');
    const [loading, setLoading] = useState(false);
    const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
    const [passwordValidated, setPasswordValidated] = useState(false);
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

    useEffect(() => {
        if (modpack.name && !instanceName) {
            setInstanceName(modpack.name);
        }
    }, [modpack.name, instanceName]);

    useEffect(() => {
        // Listen for task updates
        const unlistenTask = listen<TaskUpdate>('task-updated', (event) => {
            const task = event.payload;
            if (task.data?.type === 'modpack_instance_creation') {
                setTaskProgress({
                    active: task.status === 'Running',
                    progress: task.progress,
                    message: task.message,
                    status: task.status
                });

                if (task.status === 'Completed') {
                    toast.success('Instancia creada exitosamente');
                    onSuccess(task.data?.instanceId || 'unknown');
                    handleClose();
                } else if (task.status === 'Failed') {
                    toast.error(`Error: ${task.message}`);
                    setLoading(false);
                    setTaskProgress(prev => ({ ...prev, active: false }));
                }
            }
        });

        return () => {
            unlistenTask.then(fn => fn());
        };
    }, [onSuccess]);

    const handleClose = () => {
        setInstanceName('');
        setSelectedVersionId('latest');
        setLoading(false);
        setPasswordDialogOpen(false);
        setPasswordValidated(false);
        setTaskProgress({
            active: false,
            progress: 0,
            message: '',
            status: 'Pending'
        });
        onClose();
    };

    const handleCreateInstance = async () => {
        if (!instanceName.trim()) {
            toast.error('El nombre de la instancia es requerido');
            return;
        }

        // Check if modpack requires password and if it's not validated yet
        if (modpack.isPasswordProtected && !passwordValidated) {
            setPasswordDialogOpen(true);
            return;
        }

        setLoading(true);
        setTaskProgress({
            active: true,
            progress: 0,
            message: 'Iniciando creación de instancia...',
            status: 'Pending'
        });

        try {
            const versionId = selectedVersionId === 'latest' ? undefined : selectedVersionId;
            
            const instanceId = await invoke<string>('create_modpack_instance', {
                instanceName: instanceName.trim(),
                modpackId: modpack.id,
                versionId
            });

            toast.success('Proceso de creación iniciado');
        } catch (error) {
            console.error('Error creating modpack instance:', error);
            toast.error(error instanceof Error ? error.message : 'Error al crear la instancia');
            setLoading(false);
            setTaskProgress(prev => ({ ...prev, active: false }));
        }
    };

    const handlePasswordValidated = () => {
        setPasswordValidated(true);
        setPasswordDialogOpen(false);
        // Automatically proceed with instance creation after password validation
        setTimeout(() => {
            handleCreateInstance();
        }, 100);
    };

    const getVersionDisplay = (version: ModpackVersion) => {
        const parts = [version.version, `MC ${version.mcVersion}`];
        if (version.forgeVersion) {
            parts.push(`Forge ${version.forgeVersion}`);
        }
        return parts.join(' • ');
    };

    return (
        <>
            <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <LucidePackage className="h-5 w-5" />
                        Crear Instancia de Modpack
                    </DialogTitle>
                    <DialogDescription>
                        Crear una nueva instancia del modpack "{modpack.name}"
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Instance Name */}
                    <div>
                        <label className="text-sm font-medium text-gray-700 block mb-1">
                            Nombre de la Instancia
                        </label>
                        <Input
                            value={instanceName}
                            onChange={(e) => setInstanceName(e.target.value)}
                            placeholder="Nombre de la instancia"
                            disabled={loading}
                        />
                    </div>

                    {/* Version Selection */}
                    <div>
                        <label className="text-sm font-medium text-gray-700 block mb-1">
                            Versión
                        </label>
                        <Select 
                            value={selectedVersionId} 
                            onValueChange={setSelectedVersionId}
                            disabled={loading}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Seleccionar versión" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="latest">
                                    <div className="flex items-center gap-2">
                                        <Badge variant="secondary">Latest</Badge>
                                        <span>Última versión disponible</span>
                                    </div>
                                </SelectItem>
                                {modpack.versions?.map((version) => (
                                    <SelectItem key={version.id} value={version.id}>
                                        <div className="flex flex-col">
                                            <span>{getVersionDisplay(version)}</span>
                                            <span className="text-xs text-gray-500">
                                                {new Date(version.releaseDate).toLocaleDateString()}
                                            </span>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Progress Indicator */}
                    {taskProgress.active && (
                        <div className="space-y-2 p-3 bg-blue-50 rounded-lg border">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-blue-900">
                                    Creando instancia...
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

                    {/* Status Indicators */}
                    {!taskProgress.active && taskProgress.status === 'Completed' && (
                        <div className="flex items-center gap-2 p-2 bg-green-50 rounded text-green-700">
                            <LucideCheck className="h-4 w-4" />
                            <span className="text-sm">Instancia creada exitosamente</span>
                        </div>
                    )}

                    {!taskProgress.active && taskProgress.status === 'Failed' && (
                        <div className="flex items-center gap-2 p-2 bg-red-50 rounded text-red-700">
                            <LucideX className="h-4 w-4" />
                            <span className="text-sm">Error al crear la instancia</span>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={handleClose}
                        disabled={loading}
                    >
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleCreateInstance}
                        disabled={loading || !instanceName.trim()}
                    >
                        <LucideDownload className="h-4 w-4 mr-2" />
                        {loading ? 'Creando...' : 'Crear Instancia'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        
        <ModpackPasswordDialog
            isOpen={passwordDialogOpen}
            onClose={() => setPasswordDialogOpen(false)}
            onSuccess={handlePasswordValidated}
            modpackId={modpack.id}
            modpackName={modpack.name}
        />
        </>
    );
};