import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
    LucideDownload,
    LucideLoader2,
    LucideSearch,
    LucideAlertCircle,
    LucideExternalLink
} from 'lucide-react';

interface ModrinthMod {
    project_id: string;
    slug: string;
    title: string;
    description: string;
    categories: string[];
    downloads: number;
    icon_url?: string;
    author: string;
}

interface ModVersion {
    id: string;
    version_number: string;
    name: string;
    files: Array<{
        url: string;
        filename: string;
        primary: boolean;
        size: number;
    }>;
}

interface ModDownloaderDialogProps {
    isOpen: boolean;
    onClose: () => void;
    instanceId: string;
    instanceName: string;
    minecraftVersion: string;
    loaderType: string;
    loaderVersion?: string;
}

function formatFileSize(sizeInBytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = sizeInBytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }
    return `${size.toFixed(2)} ${units[unitIndex]}`;
}

function formatDownloads(downloads: number): string {
    if (downloads >= 1_000_000) {
        return (downloads / 1_000_000).toFixed(1) + 'M';
    } else if (downloads >= 1_000) {
        return (downloads / 1_000).toFixed(1) + 'K';
    }
    return downloads.toString();
}

export const ModDownloaderDialog: React.FC<ModDownloaderDialogProps> = ({
    isOpen,
    onClose,
    instanceId,
    instanceName,
    minecraftVersion,
    loaderType,
    loaderVersion
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<ModrinthMod[]>([]);
    const [searching, setSearching] = useState(false);
    const [selectedMod, setSelectedMod] = useState<ModrinthMod | null>(null);
    const [modVersions, setModVersions] = useState<ModVersion[]>([]);
    const [loadingVersions, setLoadingVersions] = useState(false);
    const [downloadingVersionId, setDownloadingVersionId] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) {
            setSearchQuery('');
            setSearchResults([]);
            setSelectedMod(null);
            setModVersions([]);
        }
    }, [isOpen]);

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;
        setSearching(true);
        try {
            const results = await invoke<ModrinthMod[]>('search_modrinth_mods', {
                query: searchQuery,
                minecraftVersion,
                loaderType
            });
            setSearchResults(results);
        } catch {
            toast.error('Error al buscar mods');
        } finally {
            setSearching(false);
        }
    };

    const handleSelectMod = async (mod: ModrinthMod) => {
        setSelectedMod(mod);
        setLoadingVersions(true);
        try {
            const versions = await invoke<ModVersion[]>('get_modrinth_mod_versions', {
                projectId: mod.project_id,
                minecraftVersion,
                loaderType
            });
            setModVersions(versions);
        } catch {
            toast.error('Error al cargar versiones');
        } finally {
            setLoadingVersions(false);
        }
    };

    const handleDownloadMod = async (version: ModVersion) => {
        if (downloadingVersionId) return;
        const file = version.files.find(f => f.primary) ?? version.files[0];
        if (!file) return;

        setDownloadingVersionId(version.id);
        try {
            await invoke('download_mod_to_instance', {
                instanceId,
                downloadUrl: file.url,
                fileName: file.filename
            });
            toast.success(`Descargado ${file.filename}`);
        } catch (error) {
            toast.error((error as string) || 'Error al descargar el mod');
            console.error('Error downloading mod:', error);
        } finally {
            setDownloadingVersionId(null);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="!max-w-6xl h-[85vh] bg-[#0a0a0a] border-white/10 text-white flex flex-col p-0">

                {/* Header fijo */}
                <DialogHeader className="px-6 pt-6 pb-4 border-b border-white/10 flex-shrink-0">
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <LucideDownload className="w-5 h-5 text-green-400" />
                        Descargador de Mods
                    </DialogTitle>
                    <DialogDescription className="text-neutral-400">
                        Busca y descarga mods desde Modrinth para{' '}
                        <span className="text-white font-medium">{instanceName}</span>
                    </DialogDescription>
                    <div className="flex gap-2 mt-2">
                        <Badge variant="outline" className="text-xs">MC {minecraftVersion}</Badge>
                        <Badge variant="outline" className="text-xs">
                            {loaderType.charAt(0).toUpperCase() + loaderType.slice(1)}
                            {loaderVersion && ` ${loaderVersion}`}
                        </Badge>
                    </div>
                </DialogHeader>

                {/* CONTENEDOR PRINCIPAL */}
                <div className="grid grid-cols-2 gap-4 p-6 flex-1 min-h-0">

                    {/* COLUMNA IZQUIERDA */}
                    <div className="flex flex-col gap-4 min-h-0">
                        <div className="flex-shrink-0">
                            <h3 className="text-sm font-medium mb-3 text-neutral-300">
                                Buscar Mods
                            </h3>
                            <div className="flex gap-2">
                                <Input
                                    placeholder="Buscar mods por nombre..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                    className="bg-[#121212] border-white/10"
                                />
                                <Button
                                    onClick={handleSearch}
                                    disabled={searching}
                                    className="bg-purple-600 hover:bg-purple-700"
                                >
                                    {searching
                                        ? <LucideLoader2 className="w-4 h-4 animate-spin" />
                                        : <LucideSearch className="w-4 h-4" />}
                                </Button>
                            </div>
                        </div>

                        {/* RESULTADOS */}
                        <div className="flex-1 min-h-0 bg-[#121212] rounded-lg border border-white/10">
                            <ScrollArea className="h-full">
                                <div className="p-2 space-y-2">
                                    {searchResults.length > 0 ? (
                                        searchResults.map((mod) => (
                                            <div
                                                key={mod.project_id}
                                                onClick={() => handleSelectMod(mod)}
                                                className={`flex gap-3 p-3 rounded-lg bg-[#1a1a1a] border transition-all cursor-pointer group
                      ${selectedMod?.project_id === mod.project_id
                                                        ? 'border-purple-500'
                                                        : 'border-white/5 hover:border-purple-500/50'
                                                    }`}
                                            >
                                                {mod.icon_url && (
                                                    <img
                                                        src={mod.icon_url}
                                                        alt={mod.title}
                                                        className="w-12 h-12 rounded object-cover flex-shrink-0"
                                                    />
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="font-semibold group-hover:text-purple-400 truncate">
                                                        {mod.title}
                                                    </h4>
                                                    <p className="text-xs text-neutral-400 mt-1 line-clamp-2">
                                                        {mod.description}
                                                    </p>
                                                    <div className="flex gap-2 mt-2 flex-wrap">
                                                        <Badge variant="secondary" className="text-[10px]">
                                                            {formatDownloads(mod.downloads)} descargas
                                                        </Badge>
                                                        {mod.categories.slice(0, 1).map(cat => (
                                                            <Badge key={cat} variant="outline" className="text-[10px]">
                                                                {cat}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="flex items-center justify-center py-20 text-neutral-500">
                                            <LucideSearch className="w-8 h-8 opacity-20" />
                                        </div>
                                    )}
                                </div>
                            </ScrollArea>
                        </div>
                    </div>

                    {/* COLUMNA DERECHA */}
                    <div className="flex flex-col min-h-0 border-l border-white/10 pl-4">
                        {selectedMod ? (
                            <>
                                <div className="flex-shrink-0">
                                    <h3 className="text-sm font-medium mb-3 text-neutral-300">
                                        Detalles del Mod
                                    </h3>
                                    <div className="flex gap-3 p-4 rounded-lg bg-[#121212] border border-white/10">
                                        {selectedMod.icon_url && (
                                            <img
                                                src={selectedMod.icon_url}
                                                className="w-14 h-14 rounded object-cover"
                                                alt=""
                                            />
                                        )}
                                        <div className="min-w-0">
                                            <h3 className="text-lg font-semibold truncate">
                                                {selectedMod.title}
                                            </h3>
                                            <Badge variant="secondary" className="text-[10px] mt-1">
                                                Por {selectedMod.author}
                                            </Badge>
                                        </div>
                                    </div>
                                </div>

                                {/* VERSIONES */}
                                <div className="flex-1 min-h-0 mt-3 bg-[#121212] rounded-lg border border-white/10">
                                    <ScrollArea className="h-full">
                                        <div className="p-2 space-y-2">
                                            {modVersions.map(version => {
                                                const file = version.files.find(f => f.primary) ?? version.files[0];
                                                return (
                                                    <div
                                                        key={version.id}
                                                        className="flex items-center justify-between gap-3 p-3 rounded-lg bg-[#1a1a1a]"
                                                    >
                                                        <div className="min-w-0">
                                                            <h5 className="font-medium text-sm truncate">
                                                                {version.name}
                                                            </h5>
                                                            <p className="text-[10px] text-neutral-400">
                                                                {version.version_number} · {formatFileSize(file?.size || 0)}
                                                            </p>
                                                        </div>
                                                        <Button
                                                            size="sm"
                                                            onClick={() => handleDownloadMod(version)}
                                                            disabled={downloadingVersionId !== null}
                                                            className="bg-green-600 hover:bg-green-700 h-8 text-xs"
                                                        >
                                                            {downloadingVersionId === version.id
                                                                ? <LucideLoader2 className="w-3 h-3 animate-spin" />
                                                                : <>
                                                                    <LucideDownload className="w-3 h-3 mr-1" />
                                                                    Descargar
                                                                </>}
                                                        </Button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </ScrollArea>
                                </div>
                            </>
                        ) : (
                            <div className="flex-1 flex items-center justify-center text-neutral-500">
                                <LucideExternalLink className="w-10 h-10 opacity-20" />
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer fijo */}
                <div className="px-6 py-4 border-t border-white/10 flex justify-between flex-shrink-0">
                    <div className="flex items-center gap-2 text-blue-400 text-xs">
                        <LucideAlertCircle className="h-4 w-4" />
                        Los mods se instalan directamente en la instancia.
                    </div>
                    <Button variant="outline" onClick={onClose}>
                        Cerrar
                    </Button>
                </div>

            </DialogContent>
        </Dialog>

    );
};
