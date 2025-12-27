// Este componente es una barra lateral
// fija, similar al guild bar de Discord.

import { useAuthentication } from "@/stores/AuthContext";
import { LucideLibrary, LucideServer, LucideUsers, LucideTrash2, LucideShield } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState, useCallback, useMemo, memo, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { motion } from "motion/react";
import { useDragAndDrop } from "@formkit/drag-and-drop/react";
import {
    animations
} from "@formkit/drag-and-drop";
import type { MinecraftInstance } from "@/types/TauriCommandReturns";
import { useConnection } from "@/utils/ConnectionContext";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import GridIcon from "@/icons/GridIcon";
import { isHalloween } from "@/utils/SPECIAL_DATES";
import { MdiHalloween } from "@/icons/MdiHalloween";
import { useWhitelistMode } from "@/hooks/useWhitelistMode";


export const AppSidebar: React.FC = memo(() => {
    const navigate = useNavigate();
    const location = useLocation();
    const [favoriteInstances, setFavoriteInstances] = useState<MinecraftInstance[]>([]);
    const { session } = useAuthentication();

    const { isLoading: isLoadingConnectionCheck, isConnected } = useConnection();
    const { hasWhitelists, whitelistCount } = useWhitelistMode();

    // Estado para el menú contextual
    const [contextMenuOpen, setContextMenuOpen] = useState(false);
    const [selectedInstance, setSelectedInstance] = useState<MinecraftInstance | null>(null);
    const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
    const contextMenuRef = useRef<HTMLDivElement>(null);

    // Estado separado para drag and drop
    const [dragItems, setDragItems] = useState<MinecraftInstance[]>([]);

    // Memoizar fetchData para evitar recrearla en cada render
    const fetchData = useCallback(async () => {
        try {
            const result = await invoke("get_favorite_instances", { session });
            setFavoriteInstances(result as MinecraftInstance[]);
        } catch (error) {
            console.error("Error al obtener las instancias favoritas:", error);
        }
    }, [session]);

    // Obtiene las instancias favoritas reales
    useEffect(() => {
        fetchData();

        // Escuchar cambios en favoritos para sincronización en tiempo real
        let unlisten: (() => void) | undefined;
        const setupListener = async () => {
            unlisten = await listen("favorite_updated", () => {
                fetchData();
            });
        };
        setupListener();

        return () => {
            if (unlisten) unlisten();
        };
    }, [fetchData]);

    // Configuración de drag and drop con FormKit
    const [dragAndDropRef, dragAndDropItems, setDragAndDropItems] = useDragAndDrop(
        dragItems,
        {
            group: "favorites",
            plugins: [animations()],
            onDragend: async () => {
                // Los items ya están reordenados por FormKit
                const newOrder = dragAndDropItems as MinecraftInstance[];
                setFavoriteInstances(newOrder);
                setDragItems(newOrder);

                // Guardar el nuevo orden en el backend
                try {
                    await invoke("update_favorite_order", {
                        instanceIds: newOrder.map((item) => item.instanceId)
                    });
                } catch (error) {
                    console.error("Error updating favorite order:", error);
                    // Revertir el cambio si falla
                    setDragAndDropItems(favoriteInstances);
                    setFavoriteInstances(favoriteInstances);
                    setDragItems(favoriteInstances);
                }
            },
        }
    );

    // Sincronizar cambios externos con FormKit
    useEffect(() => {
        if (favoriteInstances.length !== dragItems.length ||
            !favoriteInstances.every((item, index) => item.instanceId === dragItems[index]?.instanceId)) {
            setDragItems(favoriteInstances);
            setDragAndDropItems(favoriteInstances);
        }
    }, [favoriteInstances, dragItems.length, setDragAndDropItems]);

    // Click outside handler for context menu
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
                setContextMenuOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const isOfflineMode = !isLoadingConnectionCheck && !isConnected

    const handleContextMenu = (event: React.MouseEvent, instance: MinecraftInstance) => {
        event.preventDefault();
        setSelectedInstance(instance);
        setContextMenuPosition({ x: event.clientX, y: event.clientY });
        setContextMenuOpen(true);
    };

    const removeFromFavorites = async () => {
        if (!selectedInstance) return;

        try {
            await invoke("toggle_favorite", { instanceId: selectedInstance.instanceId });
            setContextMenuOpen(false);
            setSelectedInstance(null);
        } catch (error) {
            console.error("Error removing from favorites:", error);
        }
    };

    const NAV_ITEMS = useMemo(() => {
        const isOfflineMode = !isConnected && !isLoadingConnectionCheck;

        const baseItems = [
            {
                name: "Explorar",
                icon: GridIcon,
                path: "/explore",
                requiresConnection: true
            },
            {
                name: "Biblioteca",
                icon: LucideLibrary,
                path: "/library",
                requiresConnection: true
            },
            {
                name: "Instancias",
                icon: LucideServer,
                path: isOfflineMode ? "/" : "/my-instances",
                requiresConnection: false
            },
            {
                name: "Cuentas",
                icon: LucideUsers,
                path: "/mc-accounts",
                requiresConnection: false
            }
        ];

        // Add whitelist instances if user has whitelists
        if (hasWhitelists && isConnected) {
            baseItems.splice(1, 0, {
                name: `Whitelist (${whitelistCount})`,
                icon: LucideShield,
                path: "/whitelist-instances",
                requiresConnection: true
            });
        }

        // Filtrar items basados en el estado de conexión
        return isConnected ? baseItems : baseItems.filter(item => !item.requiresConnection);
    }, [isConnected, isLoadingConnectionCheck, hasWhitelists, whitelistCount]);

    return (
        <aside className="h-full scrollbar-hide flex flex-col overflow-y-auto bg-[var(--sidebar)]" style={{ gridArea: 'sidebar' }}>
            {/* Navegación principal */}
            <div className="flex flex-col items-center py-2 space-y-1.5">
                {
                    isHalloween() && (
                        <Tooltip>
                            <TooltipTrigger>
                                <Link
                                    to="/seasons/halloween"
                                    className="group relative flex size-12 items-center justify-center p-2.5 rounded-md transition-all duration-200 ease-in-out cursor-pointer text-[var(--sidebar-foreground)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]"
                                >
                                    <motion.div
                                        initial={{ rotate: 0 }}
                                        animate={{ rotate: [0, 15, -15, 0] }}
                                        transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                                    >
                                        <MdiHalloween className="size-5 transition-all duration-200 group-hover:scale-110 group-hover:text-orange-500" />
                                    </motion.div>
                                </Link>
                            </TooltipTrigger>
                            <TooltipContent side="right">
                                Feliz Halloween!
                            </TooltipContent>
                        </Tooltip>
                    )
                }
                {NAV_ITEMS.map((item) => {
                    const isActive = location.pathname === item.path;
                    return (
                        <Tooltip
                            key={item.name}
                        >
                            <TooltipTrigger>
                                <Link
                                    draggable={false}
                                    to={item.path}
                                    className={`group relative flex size-12 items-center justify-center p-2.5 rounded-md transition-all duration-200 ease-in-out cursor-pointer ${isActive ? "bg-[var(--sidebar-accent)] text-[var(--sidebar-accent-foreground)] before:content-[''] before:absolute before:left-[-8px] before:top-1/2 before:-translate-y-1/2 before:w-1 before:h-6 before:bg-[var(--sidebar-primary)] before:rounded-full" : "text-[var(--sidebar-foreground)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]"
                                        }`}>
                                    <item.icon className="size-5 transition-transform duration-200 group-hover:scale-110" />
                                </Link>
                            </TooltipTrigger>
                            <TooltipContent side="right">
                                {item.name}
                            </TooltipContent>
                        </Tooltip>
                    );
                })}
            </div>

            {/* Separador */}
            {favoriteInstances.length > 0 && (
                <div className="mx-2 border-t border-[var(--sidebar-border)]"></div>
            )}

            {/* Instancias favoritas */}
            {favoriteInstances.length > 0 && (
                <div
                    ref={dragAndDropRef as React.RefObject<HTMLDivElement>}
                    className="flex flex-col items-center py-2 flex-1"
                >
                    {dragAndDropItems.map((fav: MinecraftInstance) => {
                        const isActive = location.pathname === `/prelaunch/${fav.instanceId}`;
                        const handleClick = () => navigate(`/prelaunch/${fav.instanceId}`);

                        return (
                            <div
                                key={fav.instanceId}
                                className="mb-2"
                            >
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.8 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.8 }}
                                            transition={{
                                                type: "spring",
                                                stiffness: 300,
                                                damping: 25
                                            }}
                                            className={`group relative flex size-12 items-center justify-center rounded-xl overflow-hidden transition-all duration-200 ease-in-out hover:rounded-md cursor-pointer ${isActive ? "bg-[var(--sidebar-accent)] text-[var(--sidebar-accent-foreground)] border-2 border-[var(--sidebar-primary)] before:content-[''] before:absolute before:left-[-8px] before:top-1/2 before:-translate-y-1/2 before:w-1 before:h-6 before:bg-[var(--sidebar-primary)] before:rounded-full" : "text-[var(--sidebar-foreground)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)] border-2 border-transparent"
                                                }`}
                                            onClick={handleClick}
                                            onContextMenu={(e) => handleContextMenu(e, fav)}
                                        >
                                            <img src={fav.iconUrl || "/images/modpack-fallback.webp"} alt={fav.instanceName} className="transition-all duration-200 group-hover:brightness-110 group-hover:saturate-150" />
                                        </motion.div>
                                    </TooltipTrigger>
                                    <TooltipContent side="right">
                                        {fav.instanceName}
                                    </TooltipContent>
                                </Tooltip>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Menú contextual */}
            {contextMenuOpen && selectedInstance && (
                <div
                    ref={contextMenuRef}
                    className="fixed z-50 bg-[var(--popover)] border border-[var(--border)] rounded-md shadow-lg p-2"
                    style={{ top: contextMenuPosition.y, left: contextMenuPosition.x }}
                >
                    <button
                        onClick={removeFromFavorites}
                        className="flex items-center space-x-2 w-full p-2 text-sm text-[var(--popover-foreground)] rounded-md hover:bg-[var(--destructive)] hover:text-[var(--destructive-foreground)] transition-all duration-200 ease-in-out"
                    >
                        <LucideTrash2 className="size-4" />
                        <span>Eliminar de favoritos</span>
                    </button>
                </div>
            )}
        </aside>
    );
});