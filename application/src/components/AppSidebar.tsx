// Este componente es una barra lateral
// fija, similar al guild bar de Discord.

import { useAuthentication } from "@/stores/AuthContext";
import { LucideLayoutGrid, LucideLibrary, LucideServer, LucideUsers } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState, useCallback, useMemo, memo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { motion } from "motion/react";
import { useDragAndDrop } from "@formkit/drag-and-drop/react";
import {
    animations
} from "@formkit/drag-and-drop";
import type { MinecraftInstance } from "@/types/TauriCommandReturns";
import { useConnection } from "@/utils/ConnectionContext";


export const AppSidebar: React.FC = memo(() => {
    const navigate = useNavigate();
    const location = useLocation();
    const [favoriteInstances, setFavoriteInstances] = useState<MinecraftInstance[]>([]);
    const { session } = useAuthentication();

    const { isLoading: isLoadingConnectionCheck, isConnected } = useConnection();


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

    const isOfflineMode = !isLoadingConnectionCheck && !isConnected

    const NAV_ITEMS = useMemo(() => {
        const baseItems = [
            {
                name: "Explorar",
                icon: LucideLayoutGrid,
                path: "/",
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

        // Filtrar items basados en el estado de conexión
        return isConnected ? baseItems : baseItems.filter(item => !item.requiresConnection);
    }, [isConnected]);

    return (
        <aside className="bg-ms-secondary h-full scrollbar-hide flex flex-col overflow-y-auto" style={{ gridArea: 'sidebar' }}>
            {/* Navegación principal */}
            <div className="flex flex-col items-center py-2 space-y-1.5">
                {NAV_ITEMS.map((item) => {
                    const isActive = location.pathname === item.path;
                    return (
                        <div
                            key={item.name}
                            className={`group relative flex size-12 items-center justify-center p-2.5 rounded-md transition-all duration-200 ease-in-out cursor-pointer ${isActive ? "bg-neutral-800 text-white before:content-[''] before:absolute before:left-[-8px] before:top-1/2 before:-translate-y-1/2 before:w-1 before:h-6 before:bg-white before:rounded-full" : "text-ms-text hover:bg-neutral-700 hover:text-white"
                                }`}
                            onClick={() => navigate(item.path)}
                        >
                            <item.icon className="size-5 transition-transform duration-200 group-hover:scale-110" />
                        </div>
                    );
                })}
            </div>

            {/* Separador */}
            {favoriteInstances.length > 0 && (
                <div className="mx-2 border-t border-neutral-700"></div>
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
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.8 }}
                                    transition={{
                                        type: "spring",
                                        stiffness: 300,
                                        damping: 25
                                    }}
                                    className={`group relative flex size-12 items-center justify-center rounded-xl overflow-hidden transition-all duration-200 ease-in-out hover:rounded-md cursor-pointer ${isActive ? "bg-neutral-800 text-white border-2 border-white before:content-[''] before:absolute before:left-[-8px] before:top-1/2 before:-translate-y-1/2 before:w-1 before:h-6 before:bg-white before:rounded-full" : "text-ms-text hover:bg-neutral-700 hover:text-white border-2 border-transparent"
                                        }`}
                                    onClick={handleClick}
                                >
                                    <img src={fav.iconUrl || "/images/modpack-fallback.webp"} alt={fav.instanceName} className="transition-all duration-200 group-hover:brightness-110 group-hover:saturate-150" />
                                </motion.div>
                            </div>
                        );
                    })}
                </div>
            )}
        </aside>
    );
});