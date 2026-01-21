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
            if (!flags.allow_mod_manager) {
                requestPremiumFeature(
                    'Gestor de Mods Avanzado',
                    'Administra, habilita y deshabilita tus mods fácilmente. Organiza tus mods por categorías y mantén tu instalación limpia y optimizada.'
                );
                return;
            }
            setShowModManager(true);
        } else if (action === "download_mods") {
            if (!flags.enable_instance_mod_downloader) {
                requestPremiumFeature(
                    'Descargador de Mods',
                    'Busca y descarga mods desde Modrinth y CurseForge directamente en tu instancia. Encuentra los mejores mods sin salir de la aplicación.'
                );
                return;
            }
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
                        "group relative aspect-video overflow-hidden rounded-2xl border border-white/5 bg-[#121212] transition-all duration-300 hover:border-white/20 hover:shadow-2xl hover:-translate-y-1 select-none cursor-pointer",
                        className,
                        isOpen && "ring-2 ring-purple-500/50"
                    )}>

                        <Link to={isServer ? `/server/${instance.instanceId}` : `/prelaunch/${instance.instanceId}`} className="block w-full h-full">

                            {/* --- BACKGROUND --- */}
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

                            {/* --- CONTENT (Bottom) --- */}
                            <div className="absolute bottom-0 left-0 w-full p-5 z-20">
                                {/* Usamos translate para mover el título hacia arriba al hacer hover */}
                                <div className="transform transition-all duration-300 translate-y-6 group-hover:translate-y-0">

                                    {/* TITULO: Peso corregido a semibold */}
                                    <h3 className="text-white font-semibold text-lg leading-tight mb-1 truncate drop-shadow-md pr-8">
                                        {instance.instanceName}
                                    </h3>

                                    {/* META INFO: Oculta por defecto (opacity-0), aparece en hover */}
                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-300 font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-75">
                                        <span>MC {instance.minecraftVersion}</span>
                                        {loaderText && (
                                            <>
                                                <span className="w-1 h-1 rounded-full bg-gray-500" />
                                                <span>{loaderText}</span>
                                            </>
                                        )}
                                    </div>

                                    {/* PLAY BUTTON: Se expande en hover */}
                                    <div className="grid grid-rows-[0fr] group-hover:grid-rows-[1fr] transition-all duration-300 ease-out mt-0 group-hover:mt-3 opacity-0 group-hover:opacity-100">
                                        <div className="overflow-hidden">
                                            <div className="w-full flex items-center justify-center gap-2 bg-white text-black font-bold py-2 rounded-lg hover:bg-neutral-200 transition-colors shadow-lg">
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

                        {/* --- OVERLAYS --- */}

                        <div className="absolute top-3 left-3 z-20 flex flex-col gap-2 items-start pointer-events-none">
                            {isServer && (
                                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-500/90 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-wide border border-white/10 shadow-lg">
                                    <LucideServer className="w-3 h-3" /> SERVIDOR
                                </span>
                            )}
                            {running && (
                                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/90 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-wide border border-white/10 shadow-lg animate-pulse">
                                    <LucideGamepad2 className="w-3 h-3" /> En Ejecución
                                </span>
                            )}
                            {isBootstrapping && (
                                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/90 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-wide border border-white/10 shadow-lg">
                                    <LucideRefreshCw className="w-3 h-3 animate-spin" /> Iniciando...
                                </span>
                            )}
                        </div>

                        {/* Actions (Fuera del Link) */}
                        <div className="absolute top-3 right-3 z-30 flex items-center gap-2">

                            {/* Badges Tipo: Ahora ocultos por defecto, solo visibles en hover */}
                            <span className={cn(
                                "flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide backdrop-blur-md border transition-all duration-300 pointer-events-none",
                                installationType === "modpack"
                                    ? "bg-purple-500/20 text-purple-200 border-purple-500/30"
                                    : "bg-orange-500/20 text-orange-200 border-orange-500/30",
                                "opacity-0 -translate-y-2 group-hover:opacity-100 group-hover:translate-y-0"
                            )}>
                                {installationType === "modpack" ? <LucidePackageOpen className="w-3 h-3" /> : <LucideHardDrive className="w-3 h-3" />}
                                {installationType === "modpack" ? "Modpack" : "Local"}
                            </span>

                            {/* Favorito */}
                            <button
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleToggleFavorite();
                                }}
                                className={cn(
                                    "p-1.5 rounded-full backdrop-blur-md border transition-all duration-200 hover:scale-110 cursor-pointer z-40",
                                    isFavorite
                                        ? "bg-yellow-500/20 border-yellow-500/50 text-yellow-400 opacity-100 shadow-[0_0_10px_rgba(234,179,8,0.2)]"
                                        : "bg-black/40 border-white/10 text-white/50 opacity-0 -translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 hover:bg-black/60 hover:text-white"
                                )}
                                title={isFavorite ? "Quitar de favoritos" : "Añadir a favoritos"}
                            >
                                <LucideStar className={cn("w-4 h-4", isFavorite && "fill-yellow-400")} />
                            </button>
                        </div>

                    </div>
                </ContextMenuTrigger>

                <ContextMenuContent className="w-56 bg-[#1a1a1a] border-white/10 text-gray-200 p-1.5 rounded-xl shadow-xl">
                    <ContextMenuItem onClick={() => handleContextAction("settings")} className="rounded-lg hover:bg-white/10 focus:bg-white/10 cursor-pointer">
                        <LucideSettings className="mr-2 h-4 w-4 text-purple-400" /> Configuración
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => handleContextAction("create_shortcut")} className="rounded-lg hover:bg-white/10 focus:bg-white/10 cursor-pointer">
                        <LucideFolderSymlink className="mr-2 h-4 w-4 text-blue-400" /> Crear acceso directo
                    </ContextMenuItem>
                    {installationType === "local" && (
                        <>
                            <ContextMenuSeparator className="bg-white/10 my-1" />
                            <ContextMenuItem onClick={() => handleContextAction("manage_mods")} className="rounded-lg hover:bg-white/10 focus:bg-white/10 cursor-pointer">
                                <LucideWrench className="mr-2 h-4 w-4 text-orange-400" /> Gestionar Mods
                            </ContextMenuItem>
                            <ContextMenuItem onClick={() => handleContextAction("download_mods")} className="rounded-lg hover:bg-white/10 focus:bg-white/10 cursor-pointer">
                                <LucideDownload className="mr-2 h-4 w-4 text-green-400" /> Descargar Mods
                            </ContextMenuItem>
                            <ContextMenuSeparator className="bg-white/10 my-1" />
                            <ContextMenuItem onClick={() => handleContextAction("export_mrpack")} className="rounded-lg hover:bg-white/10 focus:bg-white/10 cursor-pointer">
                                <LucideUpload className="mr-2 h-4 w-4 text-green-400" /> Exportar .mrpack
                            </ContextMenuItem>
                        </>
                    )}
                    <ContextMenuSeparator className="bg-white/10 my-1" />
                    <ContextMenuItem
                        onClick={() => {
                            if (running || isBootstrapping || isDeleting) return;
                            setShowDeleteAlert(true);
                        }}
                        disabled={running || isBootstrapping || isDeleting}
                        className="rounded-lg hover:bg-red-500/20 focus:bg-red-500/20 text-red-400 hover:text-red-300 focus:text-red-300 cursor-pointer"
                    >
                        <LucideTrash2 className="mr-2 h-4 w-4" />
                        {isDeleting ? "Eliminando..." : "Eliminar instancia"}
                    </ContextMenuItem>
                </ContextMenuContent>
            </ContextMenu>

            {/* Alert Dialog */}
            <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
                <AlertDialogContent className="bg-[#0a0a0a] border-white/10 text-white sm:max-w-[400px]">
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar instancia?</AlertDialogTitle>
                        <AlertDialogDescription className="text-neutral-400">
                            Estás a punto de borrar <span className="text-white font-medium">{instance.instanceName}</span>.
                            Esta acción eliminará todos los archivos, mundos y datos de forma permanente.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting} className="bg-transparent border-white/10 text-neutral-300 hover:bg-white/5 hover:text-white hover:border-white/20">
                            Cancelar
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => { e.preventDefault(); handleDeleteInstance(); }}
                            disabled={isDeleting}
                            className="bg-red-600 hover:bg-red-700 text-white border-0"
                        >
                            {isDeleting ? <LucideLoader2 className="w-4 h-4 animate-spin" /> : "Eliminar"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Mod Manager Dialog */}
            {installationType === "local" && (
                <ModManagerDialog
                    isOpen={showModManager}
                    onClose={() => setShowModManager(false)}
                    instanceId={instance.instanceId}
                    instanceName={instance.instanceName}
                />
            )}

            {/* Mod Downloader Dialog */}
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