import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
    LucidePackage,
    LucideTrash2,
    LucideLoader2,
    LucideAlertCircle,
    LucideRefreshCw,
    LucideFolderOpen
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ModFile {
    fileName: string;
    filePath: string;
    size: number;
    isEnabled: boolean;
}

interface ModManagerDialogProps {
    isOpen: boolean;
    onClose: () => void;
    instanceId: string;
    instanceName: string;
}

export const ModManagerDialog: React.FC<ModManagerDialogProps> = ({
    isOpen,
    onClose,
    instanceId,
    instanceName
}) => {
    const [mods, setMods] = useState<ModFile[]>([]);
    const [loading, setLoading] = useState(false);
    const [deletingMod, setDeletingMod] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            loadMods();
        }
    }, [isOpen, instanceId]);

    const loadMods = async () => {
        setLoading(true);
        try {
            const modsList = await invoke<ModFile[]>('list_instance_mods', { instanceId });
            setMods(modsList);
        } catch (error) {
            console.error('Error loading mods:', error);
            toast.error(`Error al cargar mods: ${error}`);
            setMods([]);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteMod = async (modFile: ModFile) => {
        if (deletingMod) return;

        setDeletingMod(modFile.fileName);
        try {
            await invoke('delete_instance_mod', {
                instanceId,
                modFileName: modFile.fileName
            });
            toast.success(`Mod "${modFile.fileName}" eliminado correctamente`);
            await loadMods(); // Recargar lista
        } catch (error) {
            console.error('Error deleting mod:', error);
            toast.error(`Error al eliminar mod: ${error}`);
        } finally {
            setDeletingMod(null);
        }
    };

    const handleToggleMod = async (modFile: ModFile) => {
        try {
            await invoke('toggle_instance_mod', {
                instanceId,
                modFileName: modFile.fileName,
                enable: !modFile.isEnabled
            });
            toast.success(`Mod ${modFile.isEnabled ? 'deshabilitado' : 'habilitado'}`);
            await loadMods();
        } catch (error) {
            console.error('Error toggling mod:', error);
            toast.error(`Error al cambiar estado del mod: ${error}`);
        }
    };

    const handleOpenModsFolder = async () => {
        try {
            await invoke('open_instance_mods_folder', { instanceId });
        } catch (error) {
            console.error('Error opening mods folder:', error);
            toast.error(`Error al abrir carpeta de mods: ${error}`);
        }
    };

    const formatFileSize = (bytes: number): string => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl max-h-[80vh] bg-[#0a0a0a] border-white/10 text-white">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <LucidePackage className="w-5 h-5 text-purple-400" />
                        Gestor de Mods
                    </DialogTitle>
                    <DialogDescription className="text-neutral-400">
                        Gestiona los mods de <span className="text-white font-medium">{instanceName}</span>
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Header Actions */}
                    <div className="flex items-center justify-between gap-2">
                        <div className="text-sm text-neutral-400">
                            {loading ? (
                                <span className="flex items-center gap-2">
                                    <LucideLoader2 className="w-4 h-4 animate-spin" />
                                    Cargando...
                                </span>
                            ) : (
                                <span>{mods.length} mod{mods.length !== 1 ? 's' : ''} encontrado{mods.length !== 1 ? 's' : ''}</span>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={loadMods}
                                disabled={loading}
                                className="bg-transparent border-white/10 hover:bg-white/5"
                            >
                                <LucideRefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                                Actualizar
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleOpenModsFolder}
                                className="bg-transparent border-white/10 hover:bg-white/5"
                            >
                                <LucideFolderOpen className="w-4 h-4 mr-2" />
                                Abrir Carpeta
                            </Button>
                        </div>
                    </div>

                    {/* Mods List */}
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <LucideLoader2 className="w-8 h-8 animate-spin text-purple-400" />
                        </div>
                    ) : mods.length === 0 ? (
                        <Alert className="bg-neutral-900 border-white/10">
                            <LucideAlertCircle className="h-4 w-4" />
                            <AlertDescription>
                                No hay mods instalados en esta instancia.
                            </AlertDescription>
                        </Alert>
                    ) : (
                        <ScrollArea className="h-[400px] rounded-lg border border-white/10 bg-[#121212]">
                            <div className="p-2 space-y-2">
                                {mods.map((mod) => (
                                    <div
                                        key={mod.filePath}
                                        className="flex items-center justify-between p-3 rounded-lg bg-[#1a1a1a] border border-white/5 hover:border-white/20 transition-colors"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-medium truncate">{mod.fileName}</h4>
                                                {!mod.isEnabled && (
                                                    <Badge variant="secondary" className="text-xs">
                                                        Deshabilitado
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="text-xs text-neutral-400 mt-1">
                                                {formatFileSize(mod.size)}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2 ml-4">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleToggleMod(mod)}
                                                className="bg-transparent border-white/10 hover:bg-white/5"
                                            >
                                                {mod.isEnabled ? 'Deshabilitar' : 'Habilitar'}
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleDeleteMod(mod)}
                                                disabled={deletingMod === mod.fileName}
                                                className="bg-transparent border-red-500/20 hover:bg-red-500/10 text-red-400"
                                            >
                                                {deletingMod === mod.fileName ? (
                                                    <LucideLoader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <LucideTrash2 className="w-4 h-4" />
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    )}

                    {/* Info Note */}
                    <Alert className="bg-blue-500/10 border-blue-500/20">
                        <LucideAlertCircle className="h-4 w-4 text-blue-400" />
                        <AlertDescription className="text-sm text-blue-200">
                            Los mods deshabilitados se renombran con extensión .disabled para evitar que se carguen.
                        </AlertDescription>
                    </Alert>
                </div>

                <div className="flex justify-end gap-2 mt-4">
                    <Button
                        variant="outline"
                        onClick={onClose}
                        className="bg-transparent border-white/10 hover:bg-white/5"
                    >
                        Cerrar
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};
