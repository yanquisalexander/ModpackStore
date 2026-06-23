import { Link, useNavigate } from "react-router-dom";
import {
    LucidePlay, LucideHardDrive, LucideSettings, LucideTrash2, LucideGamepad2,
    LucideFolderSymlink, LucidePackageOpen, LucideStar, LucideUpload, LucideRefreshCw, LucideLoader2,
    LucideTerminal,
    LucideServer,
    LucideWrench,
    LucideDownload
} from "lucide-react";
import { useState, useEffect } from "react";
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { toast } from "sonner";
import { playSound } from "@/utils/sounds";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { invoke } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";
import { save } from "@tauri-apps/plugin-dialog";
import { cn } from "@/lib/utils";
import { useUserFlags } from "@/hooks/useUserFlags";
import { ModManagerDialog } from "@/components/instance/ModManagerDialog";
import { ModDownloaderDialog } from "@/components/instance/ModDownloaderDialog";
import { requestPremiumFeature } from "@/utils/premiumFeatures";

export const InstanceCard = ({
    instance,
    className = "",
    running,
    onInstanceUpdated,
    onInstanceDeleted,
    isBootstrapping
}: {
    instance: any,
    className?: string,
    running?: boolean,
    onInstanceUpdated: (updatedInstance: any) => void,
    onInstanceDeleted: () => void,
    isBootstrapping: boolean
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [showDeleteAlert, setShowDeleteAlert] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isFavorite, setIsFavorite] = useState(instance.favorite || false);
    const [showModManager, setShowModManager] = useState(false);
    const [showModDownloader, setShowModDownloader] = useState(false);
    const navigate = useNavigate();
    const { flags } = useUserFlags();

    const isServer = instance.instanceType === 'server';

    useEffect(() => {
        setIsFavorite(instance.favorite || false);
    }, [instance.favorite]);

    const handleToggleFavorite = async () => {
        try {
            const newFavorite = !isFavorite;
            setIsFavorite(newFavorite);
            await invoke('toggle_favorite', { instanceId: instance.instanceId });
            onInstanceUpdated({ ...instance, favorite: newFavorite });
        } catch (error) {
            console.error('Error toggling favorite:', error);
            toast.error('Error al cambiar favorito');
            setIsFavorite(!isFavorite);
        }
    };

    const handleDeleteInstance = async () => {
        if (isDeleting) return;
        setIsDeleting(true);
        try {
            await invoke('remove_instance', { instanceId: instance.instanceId });
            if (isFavorite) await emit('favorite_updated');
            toast.success('Instancia eliminada correctamente');
            onInstanceDeleted();
        } catch (error) {
            playSound("ERROR_NOTIFICATION");
            toast.error(`Error al eliminar instancia: ${(error as any)?.message || 'Error desconocido'}`);
        } finally {
            setIsDeleting(false);
            setShowDeleteAlert(false);
        }
    };

    const handleExportToMrpack = async () => {
        try {
            const filePath = await save({
                defaultPath: `${instance.instanceName}.mrpack`,
                filters: [{ name: 'Modrinth Modpack', extensions: ['mrpack'] }]
            });
            if (!filePath) return;

            await invoke('export_instance_to_mrpack', { instanceId: instance.instanceId, outputPath: filePath });
            toast.success('Instancia exportada correctamente');
        } catch (error) {
            playSound("ERROR_NOTIFICATION");
            toast.error(`Error al exportar: ${(error as any)?.message}`);
        }
    };

    const handleContextAction = (action: string) => {
        if (action === "settings") {
            navigate(`/prelaunch/${instance.instanceId}?showSettings=true`);
            setIsOpen(false);
        } else if (action === "create_shortcut") {
            invoke('create_shortcut', { instanceId: instance.instanceId })
                .then(() => toast.success('Acceso directo creado'))
                .catch((e) => toast.error(`Error: ${e.message}`));
        } else if (action === "export_mrpack") {
            handleExportToMrpack();
        } else if (action === "manage_mods") {
            /* if (!flags.allow_mod_manager) {
                requestPremiumFeature(
                    'Gestor de Mods Avanzado',
                    'Administra, habilita y deshabilita tus mods fácilmente. Organiza tus mods por categorías y mantén tu instalación limpia y optimizada.'
                );
                return;
            } */
            setShowModManager(true);
        } else if (action === "download_mods") {
            /* if (!flags.enable_instance_mod_downloader) {
                requestPremiumFeature(
                    'Descargador de Mods',
                    'Busca y descarga mods desde Modrinth y CurseForge directamente en tu instancia. Encuentra los mejores mods sin salir de la aplicación.'
                );
                return;
            } */
            setShowModDownloader(true);
        } else {
            toast.info("Acción no disponible");
        }
    };

    const installationType = instance.modpackId ? "modpack" : "local";

    const formatLoaderName = (loaderType: string) => {
        if (!loaderType) return '';
        const lower = loaderType.toLowerCase();
        if (lower === 'vanilla') return 'Vanilla';
        return lower.charAt(0).toUpperCase() + lower.slice(1);
    };

    const loaderText = instance.loaderType && instance.loaderType !== 'vanilla'
        ? `${formatLoaderName(instance.loaderType)} ${instance.loaderVersion}`
        : instance.forgeVersion ? `Forge ${instance.forgeVersion}` : null;

    return (
        <>
            <ContextMenu onOpenChange={setIsOpen}>
                <ContextMenuTrigger asChild>
                    <div className={cn(
                        "group relative aspect-video overflow-hidden rounded-xl border border-white/[0.06] bg-[#121212] transition-all duration-300 hover:border-white/20 hover:-translate-y-0.5 select-none cursor-pointer",
                        className,
                        isOpen && "ring-1 ring-white/20"
                    )}>

                        <Link to={isServer ? `/server/${instance.instanceId}` : `/prelaunch/${instance.instanceId}`} className="block w-full h-full" draggable={false}>

                            <div className="absolute inset-0 overflow-hidden">
                                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent z-10 transition-opacity duration-300 group-hover:via-black/50" />
                                <img
                                    src={instance.bannerUrl || "/images/modpack-fallback.webp"}
                                    alt={instance.instanceName}
                                    onError={(e) => { e.currentTarget.src = "/images/modpack-fallback.webp" }}
                                    className={cn(
                                        "h-full w-full object-cover transition-transform duration-700 group-hover:scale-110",
                                        isBootstrapping && "opacity-50 grayscale blur-sm"
                                    )}
                                />
                            </div>

                            <div className="absolute bottom-0 left-0 w-full p-5 z-20">
                                <div className="transform transition-all duration-300 translate-y-6 group-hover:translate-y-0">

                                    <h3 className="text-white font-semibold text-lg leading-tight mb-1 truncate drop-shadow-md pr-8">
                                        {instance.instanceName}
                                    </h3>

                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-300 font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-75">
                                        <span>MC {instance.minecraftVersion}</span>
                                        {loaderText && (
                                            <>
                                                <span className="w-1 h-1 rounded-full bg-gray-500" />
                                                <span>{loaderText}</span>
                                            </>
                                        )}
                                    </div>

                                    <div className="grid grid-rows-[0fr] group-hover:grid-rows-[1fr] transition-all duration-300 ease-out mt-0 group-hover:mt-3 opacity-0 group-hover:opacity-100">
                                        <div className="overflow-hidden">
                                            <div className="w-full flex items-center justify-center gap-2 bg-white text-black font-semibold py-2 rounded-lg hover:bg-neutral-200 transition-colors">
                                                {isServer ? (
                                                    <><LucideTerminal className="w-4 h-4" /> Abrir Panel</>
                                                ) : (
                                                    <><LucidePlay className="w-4 h-4 fill-black" /> Jugar Ahora</>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </Link>

                        <div className="absolute top-3 left-3 z-20 flex flex-col gap-2 items-start pointer-events-none">
                            {isServer && (
                                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-500/20 text-purple-300 text-[10px] font-bold uppercase tracking-wide border border-purple-500/20">
                                    <LucideServer className="w-3 h-3" /> SERVIDOR
                                </span>
                            )}
                            {running && (
                                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/20 text-emerald-300 text-[10px] font-bold uppercase tracking-wide border border-emerald-500/20 animate-pulse">
                                    <LucideGamepad2 className="w-3 h-3" /> En Ejecución
                                </span>
                            )}
                            {isBootstrapping && (
                                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-500/20 text-blue-300 text-[10px] font-bold uppercase tracking-wide border border-blue-500/20">
                                    <LucideRefreshCw className="w-3 h-3 animate-spin" /> Iniciando...
                                </span>
                            )}
                        </div>

                        <div className="absolute top-3 right-3 z-30 flex items-center gap-2">

                            <span className={cn(
                                "flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide border transition-all duration-300 pointer-events-none",
                                installationType === "modpack"
                                    ? "bg-purple-500/20 text-purple-300 border-purple-500/20"
                                    : "bg-orange-500/20 text-orange-300 border-orange-500/20",
                                "opacity-0 -translate-y-2 group-hover:opacity-100 group-hover:translate-y-0"
                            )}>
                                {installationType === "modpack" ? <LucidePackageOpen className="w-3 h-3" /> : <LucideHardDrive className="w-3 h-3" />}
                                {installationType === "modpack" ? "Modpack" : "Local"}
                            </span>

                            <button
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleToggleFavorite();
                                }}
                                className={cn(
                                    "p-1.5 rounded-md border transition-all duration-200 hover:scale-110 cursor-pointer z-40",
                                    isFavorite
                                        ? "bg-yellow-500/20 border-yellow-500/40 text-yellow-400"
                                        : "bg-black/40 border-white/10 text-white/50 opacity-0 -translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 hover:bg-black/60 hover:text-white"
                                )}
                                title={isFavorite ? "Quitar de favoritos" : "Añadir a favoritos"}
                            >
                                <LucideStar className={cn("w-4 h-4", isFavorite && "fill-yellow-400")} />
                            </button>
                        </div>

                    </div>
                </ContextMenuTrigger>

                <ContextMenuContent className="w-56 bg-[#121214] border-white/[0.06] text-neutral-400 p-1 rounded-lg">
                    <ContextMenuItem onClick={() => handleContextAction("settings")} className="rounded-md text-sm hover:text-white hover:bg-white/[0.04] focus:bg-white/[0.04] cursor-pointer">
                        <LucideSettings className="mr-2 h-4 w-4" /> Configuración
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => handleContextAction("create_shortcut")} className="rounded-md text-sm hover:text-white hover:bg-white/[0.04] focus:bg-white/[0.04] cursor-pointer">
                        <LucideFolderSymlink className="mr-2 h-4 w-4" /> Crear acceso directo
                    </ContextMenuItem>
                    {installationType === "local" && (
                        <>
                            <ContextMenuSeparator className="bg-white/[0.04] my-1" />
                            <ContextMenuItem onClick={() => handleContextAction("manage_mods")} className="rounded-md text-sm hover:text-white hover:bg-white/[0.04] focus:bg-white/[0.04] cursor-pointer">
                                <LucideWrench className="mr-2 h-4 w-4" /> Gestionar Mods
                            </ContextMenuItem>
                            <ContextMenuItem onClick={() => handleContextAction("download_mods")} className="rounded-md text-sm hover:text-white hover:bg-white/[0.04] focus:bg-white/[0.04] cursor-pointer">
                                <LucideDownload className="mr-2 h-4 w-4" /> Descargar Mods
                            </ContextMenuItem>
                            <ContextMenuSeparator className="bg-white/[0.04] my-1" />
                            <ContextMenuItem onClick={() => handleContextAction("export_mrpack")} className="rounded-md text-sm hover:text-white hover:bg-white/[0.04] focus:bg-white/[0.04] cursor-pointer">
                                <LucideUpload className="mr-2 h-4 w-4" /> Exportar .mrpack
                            </ContextMenuItem>
                        </>
                    )}
                    <ContextMenuSeparator className="bg-white/[0.04] my-1" />
                    <ContextMenuItem
                        onClick={() => {
                            if (running || isBootstrapping || isDeleting) return;
                            setShowDeleteAlert(true);
                        }}
                        disabled={running || isBootstrapping || isDeleting}
                        className="rounded-md text-sm hover:text-red-400 hover:bg-red-500/10 focus:bg-red-500/10 cursor-pointer disabled:opacity-50"
                    >
                        <LucideTrash2 className="mr-2 h-4 w-4" />
                        {isDeleting ? "Eliminando..." : "Eliminar instancia"}
                    </ContextMenuItem>
                </ContextMenuContent>
            </ContextMenu>

            <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
                <AlertDialogContent className="bg-[#0e0e10] border-white/[0.06] text-white sm:max-w-[400px]">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-base font-semibold">¿Eliminar instancia?</AlertDialogTitle>
                        <AlertDialogDescription className="text-sm text-neutral-500">
                            Estás a punto de borrar <span className="text-white font-medium">{instance.instanceName}</span>.
                            Esta acción eliminará todos los archivos, mundos y datos de forma permanente.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting} className="bg-transparent border-white/[0.06] text-neutral-400 hover:bg-white/[0.04] hover:text-white text-sm">
                            Cancelar
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => { e.preventDefault(); handleDeleteInstance(); }}
                            disabled={isDeleting}
                            className="bg-red-500/10 text-red-400 hover:bg-red-500/20 border-0 text-sm"
                        >
                            {isDeleting ? <LucideLoader2 className="w-4 h-4 animate-spin" /> : "Eliminar"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {installationType === "local" && (
                <ModManagerDialog
                    isOpen={showModManager}
                    onClose={() => setShowModManager(false)}
                    instanceId={instance.instanceId}
                    instanceName={instance.instanceName}
                />
            )}

            {installationType === "local" && instance.loaderType && instance.loaderType !== 'vanilla' && (
                <ModDownloaderDialog
                    isOpen={showModDownloader}
                    onClose={() => setShowModDownloader(false)}
                    instanceId={instance.instanceId}
                    instanceName={instance.instanceName}
                    minecraftVersion={instance.minecraftVersion}
                    loaderType={instance.loaderType}
                    loaderVersion={instance.loaderVersion}
                />
            )}
        </>
    );
};
