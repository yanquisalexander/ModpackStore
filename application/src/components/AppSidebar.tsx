import React, { useEffect, useState, useCallback, useMemo, memo, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuthentication } from "@/stores/AuthContext";
import { useConnection } from "@/utils/ConnectionContext";
import { useWhitelistMode } from "@/hooks/useWhitelistMode";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useDragAndDrop } from "@formkit/drag-and-drop/react";
import { animations } from "@formkit/drag-and-drop";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";

// Iconos
import { LucideLibrary, LucideServer, LucideUsers, LucideTrash2, LucideShield, LucideLayoutGrid, LucideGamepad2, PanelLeftOpen, PanelLeftClose, LucideStethoscope } from "lucide-react";
import GridIcon from "@/icons/GridIcon";
import { MdiHalloween } from "@/icons/MdiHalloween";
import { isHalloween } from "@/utils/SPECIAL_DATES";

// Componentes UI
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import type { MinecraftInstance } from "@/types/TauriCommandReturns";
import GlassGamingButtons from "@/icons/GlassGamingButtons";
import GlassUsers from "@/icons/GlassUsers";
import GlassGridPlus from "@/icons/GlassGridPlus";
import GlassMagnifier from "@/icons/GlassMagnifier";
import GlassLock from "@/icons/GlassLock";
import IconCircleWrench from "@/icons/GlassRepair";

// --- SUBCOMPONENTES ---

const NavItem = memo(({ item, isActive, isExpanded }: { item: any, isActive: boolean, isExpanded: boolean }) => (
    isExpanded ? (
        <Link
            to={item.path}
            draggable={false}
            className={cn(
                "flex items-center gap-3 px-4 py-2.5 mx-2 rounded-md transition-all duration-200 ease-in-out",
                isActive
                    ? "bg-[var(--sidebar-accent)] text-[var(--sidebar-accent-foreground)]"
                    : "text-[var(--sidebar-foreground)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]"
            )}
        >
            <item.icon className="size-5 shrink-0" />
            <span className="text-sm font-medium truncate">{item.name}</span>
        </Link>
    ) : (
        <Tooltip delayDuration={0}>
            <TooltipTrigger>
                <Link
                    to={item.path}
                    draggable={false}
                    className={cn(
                        "group relative flex size-12 items-center justify-center p-2.5 rounded-md transition-all duration-200 ease-in-out cursor-pointer",
                        isActive
                            ? "bg-[var(--sidebar-accent)] text-[var(--sidebar-accent-foreground)] before:content-[''] before:absolute before:left-[-8px] before:top-1/2 before:-translate-y-1/2 before:w-1 before:h-6 before:bg-[var(--sidebar-primary)] before:rounded-full"
                            : "text-[var(--sidebar-foreground)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]"
                    )}
                >
                    <item.icon className="size-5 transition-transform duration-200 group-hover:scale-110" />
                </Link>
            </TooltipTrigger>
            <TooltipContent side="right">
                {item.name}
            </TooltipContent>
        </Tooltip>
    )
));

const HalloweenItem = memo(() => (
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
        <TooltipContent side="right">Feliz Halloween!</TooltipContent>
    </Tooltip>
));

const FavoriteItem = memo(({
    fav,
    isActive,
    isExpanded,
    onClick,
    onContextMenu
}: {
    fav: MinecraftInstance,
    isActive: boolean,
    isExpanded: boolean,
    onClick: () => void,
    onContextMenu: (e: React.MouseEvent) => void
}) => (
    isExpanded ? (
        <div
            className="w-full px-3 py-1.5 flex items-center gap-3 cursor-pointer rounded-md transition-all duration-200 ease-in-out hover:bg-[var(--sidebar-accent)] relative"
            onClick={onClick}
            onContextMenu={onContextMenu}
        >
            <span className={cn(
                "absolute left-0 w-[3px] rounded-r-lg transition-all duration-300 ease-in-out h-[24px]",
                isActive ? "bg-white opacity-100" : "opacity-0"
            )} />
            <div className={cn(
                "size-9 rounded-[12px] overflow-hidden bg-[var(--sidebar-accent)]/20 flex-shrink-0",
                isActive && "bg-[var(--sidebar-primary)]"
            )}>
                <img
                    src={fav.iconUrl || "/images/modpack-fallback.webp"}
                    alt={fav.instanceName}
                    draggable={false}
                    className="h-full w-full object-cover"
                />
            </div>
            <span className={cn(
                "text-sm font-medium truncate",
                isActive ? "text-[var(--sidebar-accent-foreground)]" : "text-[var(--sidebar-foreground)]"
            )}>
                {fav.instanceName}
            </span>
        </div>
    ) : (
        <div className="mb-2 w-full flex justify-center relative">
            <Tooltip>
                <TooltipTrigger asChild>
                    <div
                        className="group relative flex items-center justify-center w-12 h-12 cursor-pointer"
                        onClick={onClick}
                        onContextMenu={onContextMenu}
                    >
                        <span
                            className={cn(
                                "absolute left-[-12px] w-[4px] bg-white rounded-r-lg transition-all duration-300 ease-in-out",
                                isActive
                                    ? "h-[40px] opacity-100"
                                    : "h-[8px] opacity-0 scale-0 group-hover:opacity-50 group-hover:scale-100 group-hover:h-[20px]"
                            )}
                        />

                        <motion.div
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            transition={{ type: "spring", stiffness: 300, damping: 25 }}
                            className={cn(
                                "relative flex size-12 items-center justify-center overflow-hidden transition-all duration-300 ease-in-out",
                                "bg-[var(--sidebar-accent)]/20",
                                isActive ? "rounded-[16px] bg-[var(--sidebar-primary)]" : "rounded-[24px] group-hover:rounded-[16px] group-hover:bg-[var(--sidebar-primary)]/80"
                            )}
                        >
                            <img
                                src={fav.iconUrl || "/images/modpack-fallback.webp"}
                                alt={fav.instanceName}
                                draggable={false}
                                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
                            />
                        </motion.div>
                    </div>
                </TooltipTrigger>
                <TooltipContent side="right" className="font-semibold ml-4">
                    {fav.instanceName}
                </TooltipContent>
            </Tooltip>
        </div>
    )
));

// --- COMPONENTE PRINCIPAL ---

export const AppSidebar: React.FC = memo(() => {
    const navigate = useNavigate();
    const location = useLocation();
    const { session } = useAuthentication();
    const { isLoading: isLoadingConnectionCheck, isConnected } = useConnection();
    const { hasWhitelists } = useWhitelistMode();

    // Estado unificado del Context Menu para evitar re-renders parciales
    const [contextMenuState, setContextMenuState] = useState<{
        isOpen: boolean;
        position: { x: number; y: number };
        instance: MinecraftInstance | null;
    }>({
        isOpen: false,
        position: { x: 0, y: 0 },
        instance: null
    });

    const contextMenuRef = useRef<HTMLDivElement>(null);

    // Estado de datos
    const [favoriteInstances, setFavoriteInstances] = useState<MinecraftInstance[]>([]);
    const [dragItems, setDragItems] = useState<MinecraftInstance[]>([]);

    const [isExpanded, setIsExpanded] = useState(() => localStorage.getItem('sidebarExpanded') === 'true');
    const [extendedEnabled, setExtendedEnabled] = useState(false);

    // --- LÓGICA DE DATOS ---

    const fetchData = useCallback(async () => {
        if (!session) return;
        try {
            const result = await invoke<MinecraftInstance[]>("get_favorite_instances", { session });
            setFavoriteInstances(result);
        } catch (error) {
            console.error("Error al obtener las instancias favoritas:", error);
        }
    }, [session]);

    useEffect(() => {
        fetchData();

        // Setup listener
        const setupListener = async () => {
            const unlisten = await listen("favorite_updated", fetchData);
            return unlisten;
        };

        const unlistenPromise = setupListener();
        return () => { unlistenPromise.then(unlisten => unlisten()); };
    }, [fetchData]);

    // --- DRAG & DROP ---

    const [dragAndDropRef, dragAndDropItems, setDragAndDropItems] = useDragAndDrop<HTMLDivElement, MinecraftInstance>(
        dragItems,
        {
            group: "favorites",
            plugins: [animations()],
            onDragend: async () => {
                const newOrder = dragAndDropItems;
                // Optimistic UI update
                setFavoriteInstances(newOrder);
                setDragItems(newOrder);

                try {
                    await invoke("update_favorite_order", {
                        instanceIds: newOrder.map((item) => item.instanceId)
                    });
                } catch (error) {
                    console.error("Error updating favorite order:", error);
                    // Rollback on error
                    setDragAndDropItems(favoriteInstances);
                    setFavoriteInstances(favoriteInstances);
                    setDragItems(favoriteInstances);
                }
            },
        }
    );

    // Sincronizar estado local de dragItems cuando cambia la fuente de verdad (favoriteInstances)
    useEffect(() => {
        if (favoriteInstances.length !== dragItems.length) {
            setDragItems(favoriteInstances);
            setDragAndDropItems(favoriteInstances);
            return;
        }

        const hasDifference = favoriteInstances.some((fi, i) =>
            fi.instanceId !== dragItems[i]?.instanceId
        );

        if (hasDifference) {
            setDragItems(favoriteInstances);
            setDragAndDropItems(favoriteInstances);
        }
    }, [favoriteInstances, dragItems, setDragAndDropItems]);

    // --- CONTEXT MENU HANDLERS ---

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
                setContextMenuState(prev => ({ ...prev, isOpen: false }));
            }
        };
        window.addEventListener("mousedown", handleClickOutside);
        return () => window.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleContextMenu = useCallback((event: React.MouseEvent, instance: MinecraftInstance) => {
        event.preventDefault();
        setContextMenuState({
            isOpen: true,
            position: { x: event.clientX, y: event.clientY },
            instance
        });
    }, []);

    const removeFromFavorites = useCallback(async () => {
        if (!contextMenuState.instance) return;
        try {
            await invoke("toggle_favorite", { instanceId: contextMenuState.instance.instanceId });
            setContextMenuState(prev => ({ ...prev, isOpen: false, instance: null }));
        } catch (error) {
            console.error("Error removing from favorites:", error);
        }
    }, [contextMenuState.instance]);

    // --- EXPANDED SIDEBAR ---

    useEffect(() => {
        const fetchExtendedEnabled = () => {
            invoke<boolean | null>('get_config_value', { key: 'enableExtendedSidebar' })
                .then(val => setExtendedEnabled(val === true))
                .catch(() => { });
        };

        fetchExtendedEnabled();

        const unlistenPromise = listen('config_changed', fetchExtendedEnabled);
        return () => { unlistenPromise.then(unlisten => unlisten()); };
    }, []);

    useEffect(() => {
        document.documentElement.style.setProperty(
            '--sidebar-width',
            isExpanded ? '200px' : '64px'
        );
    }, [isExpanded]);

    const handleToggleSidebar = useCallback(async () => {
        const newExpanded = !isExpanded;
        setIsExpanded(newExpanded);
        localStorage.setItem('sidebarExpanded', String(newExpanded));
    }, [isExpanded]);

    // --- NAVIGATION ITEMS ---

    const NAV_ITEMS = useMemo(() => {
        const baseItems = [
            { name: "Explorar", icon: GlassMagnifier, path: "/explore", requiresConnection: true },
            { name: "Whitelist", icon: GlassLock, path: "/whitelist-instances", requiresConnection: true },
            { name: "Biblioteca", icon: LucideLibrary, path: "/library", requiresConnection: true },
            { name: "Instancias", icon: GlassGamingButtons, path: (!isConnected && !isLoadingConnectionCheck) ? "/" : "/my-instances", requiresConnection: false },
            /*    { name: "Servidores", icon: LucideServer, path: "/servers", requiresConnection: true }, */
            { name: "Cuentas", icon: GlassUsers, path: "/mc-accounts", requiresConnection: false },
            { name: "Diagnóstico", icon: IconCircleWrench, path: "/troubleshooter", requiresConnection: false },
        ];



        return isConnected ? baseItems : baseItems.filter(item => !item.requiresConnection);
    }, [isConnected, isLoadingConnectionCheck, hasWhitelists]);

    // --- RENDER ---

    return (
        <aside className={cn("h-full scrollbar-hide flex flex-col bg-[var(--sidebar)]", isExpanded ? "overflow-y-auto" : "overflow-y-auto overflow-x-hidden")} style={{ gridArea: 'sidebar' }}>
            {/* Navegación principal */}
            <div className={cn("flex flex-col py-2 space-y-0.5", isExpanded ? "w-full px-1" : "items-center")}>
                {isHalloween() && (isExpanded ? <div className="px-4 py-2 text-sm font-medium text-[var(--sidebar-foreground)]">🎃 Halloween</div> : <HalloweenItem />)}

                {NAV_ITEMS.map((item) => (
                    <NavItem
                        key={item.path}
                        item={item}
                        isActive={location.pathname === item.path}
                        isExpanded={isExpanded}
                    />
                ))}
            </div>

            {/* Separador */}
            {favoriteInstances.length > 0 && (
                <div className="mx-2 border-t border-[var(--sidebar-border)] my-1"></div>
            )}

            {/* Instancias favoritas (Drag & Drop) */}
            {favoriteInstances.length > 0 && (
                <div
                    ref={dragAndDropRef}
                    className={cn("flex flex-col py-2 flex-1", isExpanded ? "w-full px-1 space-y-0.5" : "items-center")}
                >
                    <AnimatePresence mode="popLayout">
                        {dragAndDropItems.map((fav) => (
                            <FavoriteItem
                                key={fav.instanceId}
                                fav={fav}
                                isActive={location.pathname === (fav.instanceType === 'server' ? `/server/${fav.instanceId}` : `/prelaunch/${fav.instanceId}`)}
                                isExpanded={isExpanded}
                                onClick={() => navigate(fav.instanceType === 'server' ? `/server/${fav.instanceId}` : `/prelaunch/${fav.instanceId}`)}
                                onContextMenu={(e) => handleContextMenu(e, fav)}
                            />
                        ))}
                    </AnimatePresence>
                </div>
            )}

            {/* Menú contextual (Portal-like behavior via fixed) */}
            <AnimatePresence>
                {contextMenuState.isOpen && contextMenuState.instance && (
                    <div
                        ref={contextMenuRef}
                        className="fixed z-50 bg-[var(--popover)] border border-[var(--border)] rounded-md shadow-lg p-2 min-w-[180px]"
                        style={{ top: contextMenuState.position.y, left: contextMenuState.position.x }}
                    >
                        <button
                            onClick={removeFromFavorites}
                            className="flex items-center space-x-2 w-full p-2 text-sm text-[var(--popover-foreground)] rounded-md hover:bg-[var(--destructive)] hover:text-[var(--destructive-foreground)] transition-all duration-200 ease-in-out cursor-pointer"
                        >
                            <LucideTrash2 className="size-4" />
                            <span>Eliminar de favoritos</span>
                        </button>
                    </div>
                )}
            </AnimatePresence>

            {/* Toggle expandir/colapsar sidebar */}
            {extendedEnabled && (
                <button
                    onClick={handleToggleSidebar}
                    className={cn(
                        "flex items-center justify-center w-full py-3 text-[var(--sidebar-foreground)]/50 hover:text-[var(--sidebar-foreground)] hover:bg-[var(--sidebar-accent)] transition-colors mt-auto",
                        isExpanded && "gap-2"
                    )}
                >
                    {isExpanded ? <PanelLeftClose className="size-5" /> : <PanelLeftOpen className="size-5" />}
                    {isExpanded && <span className="text-xs">Colapsar</span>}
                </button>
            )}
        </aside>
    );
});