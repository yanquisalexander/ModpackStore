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
    LucideFolderOpen,
    LucidePower,
    LucidePowerOff
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
            await loadMods();
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

    const enabledCount = mods.filter(m => m.isEnabled).length;
    const disabledCount = mods.length - enabledCount;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="!max-w-3xl h-[80vh] bg-[#0a0a0a] border-white/[0.06] text-white flex flex-col p-0 shadow-2xl overflow-hidden">

                {/* Header con gradiente */}
                <div className="relative px-6 pt-6 pb-5 border-b border-white/[0.06] bg-gradient-to-b from-white/[0.02] to-transparent flex-shrink-0">
                    <DialogHeader className="gap-1">
                        <DialogTitle className="flex items-center gap-3 text-xl font-bold">
                            <div className="p-2 bg-purple-500/10 rounded-lg border border-purple-500/20">
                                <LucidePackage className="w-5 h-5 text-purple-400" />
                            </div>
                            Gestor de Mods
                        </DialogTitle>
                        <DialogDescription className="text-neutral-400 text-sm">
                            Gestiona los mods de{' '}
                            <span className="text-white font-medium">{instanceName}</span>
                        </DialogDescription>
                    </DialogHeader>
                </div>

                {/* BODY */}
                <div className="flex flex-col gap-4 px-6 py-5 flex-1 min-h-0">

                    {/* HEADER ACTIONS */}
                    <div className="flex items-center justify-between gap-3 flex-shrink-0">
                        <div className="text-sm text-neutral-400">
                            {loading ? (
                                <span className="flex items-center gap-2">
                                    <LucideLoader2 className="w-4 h-4 animate-spin" />
                                    Cargando...
                                </span>
                            ) : (
                                <div className="flex items-center gap-3">
                                    <span>
                                        <span className="text-white font-semibold">{mods.length}</span> mod{mods.length !== 1 ? 's' : ''}
                                    </span>
                                    {mods.length > 0 && (
                                        <>
                                            <span className="text-neutral-600">·</span>
                                            <span className="text-emerald-400 text-xs font-bold">{enabledCount} activo{enabledCount !== 1 ? 's' : ''}</span>
                                            {disabledCount > 0 && (
                                                <>
                                                    <span className="text-neutral-600">·</span>
                                                    <span className="text-neutral-500 text-xs font-bold">{disabledCount} inactivo{disabledCount !== 1 ? 's' : ''}</span>
                                                </>
                                            )}
                                        </>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={loadMods}
                                disabled={loading}
                                className="bg-transparent border-white/[0.06] hover:bg-white/5 transition-all duration-200"
                            >
                                <LucideRefreshCw
                                    className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`}
                                />
                                Actualizar
                            </Button>

                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleOpenModsFolder}
                                className="bg-transparent border-white/[0.06] hover:bg-white/5 transition-all duration-200"
                            >
                                <LucideFolderOpen className="w-4 h-4 mr-2" />
                                Abrir Carpeta
                            </Button>
                        </div>
                    </div>

                    {/* LISTA */}
                    <div className="flex-1 min-h-0">
                        {loading ? (
                            <div className="flex items-center justify-center h-full">
                                <div className="flex flex-col items-center gap-3">
                                    <LucideLoader2 className="w-8 h-8 animate-spin text-purple-400" />
                                    <span className="text-sm text-neutral-500">Cargando mods...</span>
                                </div>
                            </div>
                        ) : mods.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full gap-3">
                                <div className="p-4 bg-white/[0.02] rounded-2xl border border-white/[0.04]">
                                    <LucidePackage className="w-8 h-8 opacity-30 text-neutral-500" />
                                </div>
                                <p className="text-sm text-neutral-500">No hay mods instalados en esta instancia.</p>
                            </div>
                        ) : (
                            <div className="h-full rounded-xl border border-white/[0.06] bg-[#121212] overflow-hidden">
                                <ScrollArea className="h-full custom-scrollbar">
                                    <div className="p-3 space-y-2">
                                        {mods.map((mod) => (
                                            <div
                                                key={mod.filePath}
                                                className={`flex items-center justify-between gap-4 p-4 rounded-xl border transition-all duration-200
                                                    ${mod.isEnabled
                                                        ? 'bg-[#1a1a1a]/60 border-white/[0.04] hover:border-white/10 hover:bg-[#1a1a1a]'
                                                        : 'bg-[#1a1a1a]/30 border-white/[0.03] opacity-60 hover:opacity-80'
                                                    }`}
                                            >
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2.5">
                                                        <div className={`p-1.5 rounded-md ${mod.isEnabled ? 'bg-purple-500/10' : 'bg-white/5'}`}>
                                                            <LucidePackage className={`w-3.5 h-3.5 ${mod.isEnabled ? 'text-purple-400' : 'text-neutral-500'}`} />
                                                        </div>
                                                        <h4 className="font-semibold truncate text-sm">
                                                            {mod.fileName}
                                                        </h4>
                                                        {!mod.isEnabled && (
                                                            <Badge variant="secondary" className="text-[9px] font-bold uppercase tracking-wider bg-neutral-500/10 text-neutral-500 border border-neutral-500/20">
                                                                Deshabilitado
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-neutral-500 mt-1.5 ml-9">
                                                        {formatFileSize(mod.size)}
                                                    </p>
                                                </div>

                                                <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleToggleMod(mod)}
                                                        className={`h-8 px-3 text-xs font-semibold transition-all duration-200
                                                            ${mod.isEnabled
                                                                ? 'bg-transparent border-white/[0.06] hover:bg-white/5 text-neutral-400'
                                                                : 'bg-transparent border-emerald-500/20 hover:bg-emerald-500/10 text-emerald-400'
                                                            }`}
                                                    >
                                                        {mod.isEnabled
                                                            ? <><LucidePowerOff className="w-3.5 h-3.5 mr-1.5" /> Deshabilitar</>
                                                            : <><LucidePower className="w-3.5 h-3.5 mr-1.5" /> Habilitar</>
                                                        }
                                                    </Button>

                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleDeleteMod(mod)}
                                                        disabled={deletingMod === mod.fileName}
                                                        className="h-8 w-8 p-0 bg-transparent border-red-500/20 hover:bg-red-500/10 text-red-400 transition-all duration-200"
                                                    >
                                                        {deletingMod === mod.fileName ? (
                                                            <LucideLoader2 className="w-3.5 h-3.5 animate-spin" />
                                                        ) : (
                                                            <LucideTrash2 className="w-3.5 h-3.5" />
                                                        )}
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>
                            </div>
                        )}
                    </div>

                    {/* INFO */}
                    <Alert className="bg-blue-500/5 border-blue-500/10 flex-shrink-0">
                        <LucideAlertCircle className="h-4 w-4 text-blue-400/70" />
                        <AlertDescription className="text-xs text-blue-200/60">
                            Los mods deshabilitados se renombran con extensión .disabled y no se cargan al iniciar.
                        </AlertDescription>
                    </Alert>
                </div>

                {/* FOOTER */}
                <div className="px-6 py-4 border-t border-white/[0.06] bg-gradient-to-t from-white/[0.01] to-transparent flex justify-end flex-shrink-0">
                    <Button
                        variant="outline"
                        onClick={onClose}
                        className="bg-transparent border-white/10 hover:bg-white/5 transition-all duration-200"
                    >
                        Cerrar
                    </Button>
                </div>

            </DialogContent>
        </Dialog>

    );
};
