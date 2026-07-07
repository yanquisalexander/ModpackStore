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
    LucideExternalLink,
    LucideCheck,
    LucideDownloadCloud
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
    const [downloadedMods, setDownloadedMods] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (!isOpen) {
            setSearchQuery('');
            setSearchResults([]);
            setSelectedMod(null);
            setModVersions([]);
        }
    }, [isOpen]);

    const loadDownloadedMods = async () => {
        try {
            const mods = await invoke<Array<{ fileName: string }>>('list_instance_mods', { instanceId });
            const fileNames = new Set(mods.map(m => m.fileName.toLowerCase()));
            setDownloadedMods(fileNames);
        } catch {
            // Silently fail - not critical
        }
    };

    const isModDownloaded = (mod: ModrinthMod): boolean => {
        const slug = mod.slug.toLowerCase();
        const title = mod.title.toLowerCase().replace(/\s+/g, '');
        return Array.from(downloadedMods).some(f =>
            f.includes(slug) || f.includes(title)
        );
    };

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
            setDownloadedMods(prev => new Set([...prev, file.filename.toLowerCase()]));
        } catch (error) {
            toast.error((error as string) || 'Error al descargar el mod');
            console.error('Error downloading mod:', error);
        } finally {
            setDownloadingVersionId(null);
        }
    };

    useEffect(() => {
        if (isOpen) {
            loadDownloadedMods();
        }
    }, [isOpen, instanceId]);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="!max-w-6xl h-[85vh] bg-[#0a0a0a] border-white/[0.06] text-white flex flex-col p-0 shadow-2xl overflow-hidden">

                {/* Header con gradiente sutil */}
                <div className="relative px-6 pt-6 pb-5 border-b border-white/[0.06] bg-gradient-to-b from-white/[0.02] to-transparent flex-shrink-0">
                    <DialogHeader className="gap-1">
                        <DialogTitle className="flex items-center gap-3 text-xl font-bold">
                            <div className="p-2 bg-purple-500/10 rounded-lg border border-purple-500/20">
                                <LucideDownloadCloud className="w-5 h-5 text-purple-400" />
                            </div>
                            Descargador de Mods
                        </DialogTitle>
                        <DialogDescription className="text-neutral-400 text-sm">
                            Busca y descarga mods desde Modrinth para{' '}
                            <span className="text-white font-medium">{instanceName}</span>
                        </DialogDescription>
                        <div className="flex gap-2 mt-1">
                            <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider border-white/10 text-neutral-400">MC {minecraftVersion}</Badge>
                            <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider border-white/10 text-neutral-400">
                                {loaderType.charAt(0).toUpperCase() + loaderType.slice(1)}
                                {loaderVersion && ` ${loaderVersion}`}
                            </Badge>
                        </div>
                    </DialogHeader>
                </div>

                {/* CONTENEDOR PRINCIPAL */}
                <div className="grid grid-cols-2 gap-5 p-6 flex-1 min-h-0">

                    {/* COLUMNA IZQUIERDA */}
                    <div className="flex flex-col gap-4 min-h-0">
                        <div className="flex-shrink-0">
                            <h3 className="text-[10px] font-bold uppercase tracking-wider mb-3 text-neutral-500">
                                Buscar Mods
                            </h3>
                            <div className="flex gap-2">
                                <Input
                                    placeholder="Buscar mods por nombre..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                    className="bg-[#121212] border-white/[0.06] focus:border-purple-500/50 focus:ring-purple-500/20 h-10"
                                />
                                <Button
                                    onClick={handleSearch}
                                    disabled={searching}
                                    className="bg-purple-600 hover:bg-purple-700 h-10 px-4 transition-all duration-200"
                                >
                                    {searching
                                        ? <LucideLoader2 className="w-4 h-4 animate-spin" />
                                        : <LucideSearch className="w-4 h-4" />}
                                </Button>
                            </div>
                        </div>

                        {/* RESULTADOS */}
                        <div className="flex-1 min-h-0 bg-[#121212] rounded-xl border border-white/[0.06] overflow-hidden">
                            <ScrollArea className="h-full custom-scrollbar">
                                <div className="p-3 space-y-3">
                                    {searchResults.length > 0 ? (
                                        searchResults.map((mod) => {
                                            const downloaded = isModDownloaded(mod);
                                            return (
                                                <div
                                                    key={mod.project_id}
                                                    onClick={() => handleSelectMod(mod)}
                                                    className={`flex gap-4 p-4 rounded-xl border transition-all duration-200 cursor-pointer group
                                                        ${selectedMod?.project_id === mod.project_id
                                                            ? 'bg-purple-500/5 border-purple-500/30 shadow-[0_0_20px_-8px] shadow-purple-500/20'
                                                            : 'bg-[#1a1a1a]/60 border-white/[0.04] hover:border-white/10 hover:bg-[#1a1a1a]'
                                                        }`}
                                                >
                                                    {mod.icon_url && (
                                                        <img
                                                            src={mod.icon_url}
                                                            alt={mod.title}
                                                            className="w-14 h-14 rounded-lg object-cover flex-shrink-0 ring-1 ring-white/[0.06]"
                                                        />
                                                    )}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <h4 className="font-semibold group-hover:text-purple-400 truncate transition-colors">
                                                                {mod.title}
                                                            </h4>
                                                            {downloaded && (
                                                                <Badge className="text-[9px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 flex-shrink-0">
                                                                    <LucideCheck className="w-3 h-3 mr-1" />
                                                                    Descargado
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        <p className="text-sm text-neutral-400 mt-1.5 line-clamp-2 leading-relaxed">
                                                            {mod.description}
                                                        </p>
                                                        <div className="flex gap-2 mt-2.5 flex-wrap">
                                                            <Badge variant="secondary" className="text-[10px] font-bold bg-white/5 border-white/[0.06]">
                                                                {formatDownloads(mod.downloads)} descargas
                                                            </Badge>
                                                            {mod.categories.slice(0, 2).map(cat => (
                                                                <Badge key={cat} variant="outline" className="text-[10px] font-bold border-white/[0.06] text-neutral-500">
                                                                    {cat}
                                                                </Badge>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div className="flex flex-col items-center justify-center py-24 text-neutral-500 gap-3">
                                            <div className="p-4 bg-white/[0.02] rounded-2xl border border-white/[0.04]">
                                                <LucideSearch className="w-8 h-8 opacity-30" />
                                            </div>
                                            <p className="text-sm">Busca mods en Modrinth</p>
                                        </div>
                                    )}
                                </div>
                            </ScrollArea>
                        </div>
                    </div>

                    {/* COLUMNA DERECHA */}
                    <div className="flex flex-col min-h-0 border-l border-white/[0.06] pl-5">
                        {selectedMod ? (
                            <>
                                {/* Info del mod seleccionado */}
                                <div className="flex-shrink-0">
                                    <h3 className="text-[10px] font-bold uppercase tracking-wider mb-3 text-neutral-500">
                                        Detalles del Mod
                                    </h3>
                                    <div className="flex gap-4 p-4 rounded-xl bg-[#121212] border border-white/[0.06]">
                                        {selectedMod.icon_url && (
                                            <img
                                                src={selectedMod.icon_url}
                                                className="w-16 h-16 rounded-lg object-cover ring-1 ring-white/[0.06] flex-shrink-0"
                                                alt=""
                                            />
                                        )}
                                        <div className="min-w-0 flex-1">
                                            <h3 className="text-lg font-bold truncate">
                                                {selectedMod.title}
                                            </h3>
                                            <p className="text-sm text-neutral-400 mt-1 line-clamp-2 leading-relaxed">
                                                {selectedMod.description}
                                            </p>
                                            <div className="flex items-center gap-3 mt-2.5">
                                                <Badge variant="secondary" className="text-[10px] font-bold bg-white/5 border-white/[0.06]">
                                                    Por {selectedMod.author}
                                                </Badge>
                                                <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider">
                                                    {formatDownloads(selectedMod.downloads)} descargas
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* VERSIONES */}
                                <div className="flex-1 min-h-0 mt-4 bg-[#121212] rounded-xl border border-white/[0.06] overflow-hidden">
                                    <div className="px-4 py-3 border-b border-white/[0.06]">
                                        <h4 className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                                            Versiones Disponibles
                                        </h4>
                                    </div>
                                    <ScrollArea className="h-full custom-scrollbar">
                                        <div className="p-3 space-y-2">
                                            {loadingVersions ? (
                                                <div className="flex items-center justify-center py-16">
                                                    <LucideLoader2 className="w-6 h-6 animate-spin text-purple-400" />
                                                </div>
                                            ) : modVersions.length > 0 ? (
                                                modVersions.map(version => {
                                                    const file = version.files.find(f => f.primary) ?? version.files[0];
                                                    return (
                                                        <div
                                                            key={version.id}
                                                            className="flex items-center justify-between gap-4 p-4 rounded-xl bg-[#1a1a1a]/60 border border-white/[0.04] hover:border-white/10 transition-all duration-200"
                                                        >
                                                            <div className="min-w-0 flex-1">
                                                                <h5 className="font-semibold text-sm truncate">
                                                                    {version.name}
                                                                </h5>
                                                                <div className="flex items-center gap-2 mt-1">
                                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                                                                        v{version.version_number}
                                                                    </span>
                                                                    <span className="text-neutral-600">·</span>
                                                                    <span className="text-[10px] text-neutral-500">
                                                                        {formatFileSize(file?.size || 0)}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <Button
                                                                size="sm"
                                                                onClick={() => handleDownloadMod(version)}
                                                                disabled={downloadingVersionId !== null}
                                                                className="bg-green-600 hover:bg-green-700 h-9 px-4 text-xs font-semibold transition-all duration-200 flex-shrink-0"
                                                            >
                                                                {downloadingVersionId === version.id
                                                                    ? <LucideLoader2 className="w-3.5 h-3.5 animate-spin" />
                                                                    : <>
                                                                        <LucideDownload className="w-3.5 h-3.5 mr-1.5" />
                                                                        Descargar
                                                                    </>}
                                                            </Button>
                                                        </div>
                                                    );
                                                })
                                            ) : (
                                                <div className="flex flex-col items-center justify-center py-16 text-neutral-500 gap-2">
                                                    <p className="text-sm">No hay versiones compatibles</p>
                                                </div>
                                            )}
                                        </div>
                                    </ScrollArea>
                                </div>
                            </>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-neutral-500 gap-3">
                                <div className="p-4 bg-white/[0.02] rounded-2xl border border-white/[0.04]">
                                    <LucideExternalLink className="w-8 h-8 opacity-30" />
                                </div>
                                <p className="text-sm">Selecciona un mod para ver sus versiones</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer fijo */}
                <div className="px-6 py-4 border-t border-white/[0.06] bg-gradient-to-t from-white/[0.01] to-transparent flex justify-between flex-shrink-0">
                    <div className="flex items-center gap-2 text-blue-400/70 text-xs">
                        <LucideAlertCircle className="h-4 w-4" />
                        Los mods se instalan directamente en la instancia.
                    </div>
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
