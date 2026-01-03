import { useEffect, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { LucidePackage, LucidePlay, LucideX, LucideLoader2, LucideGripHorizontal } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

// Helper para iconos
const getIconSrc = (iconUrl?: string | null) => {
    if (!iconUrl) return "/images/default_instances/default_forge.webp";
    if (iconUrl.startsWith("/") || iconUrl.startsWith("http") || iconUrl.startsWith("data:")) {
        return iconUrl;
    }
    return `data:image/png;base64,${iconUrl}`;
};

export const TrayWindow = () => {
    const [instances, setInstances] = useState<any[]>([]);
    const [isVisible, setIsVisible] = useState(false);
    const [loading, setLoading] = useState(false);

    // --- LÓGICA DE DATOS ---
    const refreshInstances = useCallback(async () => {
        try {
            setLoading(true);
            const data = await invoke<any[]>('get_running_instances');
            setInstances(data || []);
        } catch (error) {
            console.error("Error:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    // --- LÓGICA DE VENTANA ---

    const handleClose = useCallback(() => {
        setIsVisible(false); // 1. Inicia animación de salida
    }, []);

    const onExitComplete = async () => {
        if (!isVisible) {
            try {
                // 2. Oculta la ventana real SOLO cuando termina la animación
                await getCurrentWindow().hide();
            } catch (err) {
                console.error(err);
            }
        }
    };

    useEffect(() => {
        refreshInstances();

        const unlistenLaunched = listen("instance-launched", refreshInstances);
        const unlistenExited = listen("instance-exited", refreshInstances);

        const win = getCurrentWindow();

        // CORRECCIÓN PRINCIPAL:
        // Solo usamos el evento de foco para refrescar datos y MOSTRAR la animación.
        // Ya NO cerramos automáticamente al perder foco, porque eso rompe el Drag & Drop.
        const unlistenFocus = win.onFocusChanged(async ({ payload: focused }) => {
            if (focused) {
                await refreshInstances();
                setIsVisible(true);
            }
            // Eliminado el 'else { handleClose() }' para permitir el arrastre
        });

        // Añadimos cierre con tecla ESCAPE para mejor UX
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                handleClose();
            }
        };
        window.addEventListener("keydown", handleKeyDown);

        const intervalId = setInterval(refreshInstances, 5000);

        return () => {
            unlistenLaunched.then(f => f());
            unlistenExited.then(f => f());
            unlistenFocus.then(f => f());
            window.removeEventListener("keydown", handleKeyDown);
            clearInterval(intervalId);
        };
    }, [refreshInstances, handleClose]);

    const isSingle = instances.length === 1;
    const singleInstance = isSingle ? instances[0] : null;

    return (
        <div className="w-full h-screen bg-transparent flex flex-col justify-end pb-6 px-4 select-none overflow-hidden font-sans">
            <AnimatePresence mode="wait" onExitComplete={onExitComplete}>
                {isVisible && (
                    <motion.div
                        key={isSingle ? "single" : "multi"}
                        initial={{ y: 100, opacity: 0, scale: 0.9 }}
                        animate={{ y: 0, opacity: 1, scale: 1 }}
                        exit={{ y: 100, opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                        transition={{ type: "spring", stiffness: 350, damping: 28 }}
                        className="w-full mx-auto flex flex-col items-center"
                    >
                        {/* --- MODO SINGLE --- */}
                        {isSingle && singleInstance ? (
                            <div
                                // data-tauri-drag-region PERMITE arrastrar
                                data-tauri-drag-region
                                className="relative w-full max-w-[360px] h-[90px] rounded-[44px] overflow-hidden shadow-2xl ring-1 ring-white/10 group cursor-default"
                            >
                                {/* Background + Blur */}
                                <div className="absolute inset-0 bg-[#0a0a0a]" />
                                <div className="absolute inset-0 opacity-50 pointer-events-none">
                                    <img
                                        src={getIconSrc(singleInstance.icon || singleInstance.iconUrl)}
                                        className="w-full h-full object-cover blur-3xl scale-150 saturate-200"
                                        alt=""
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-transparent" />
                                </div>

                                {/* Contenido */}
                                <div className="relative z-10 flex items-center h-full px-2 w-full gap-4" data-tauri-drag-region>
                                    {/* Icono Giratorio */}
                                    <div className="size-[72px] rounded-full p-1 shrink-0 pointer-events-none">
                                        <div className="size-full rounded-full overflow-hidden border-2 border-white/10 shadow-lg relative">
                                            <img
                                                src={getIconSrc(singleInstance.icon || singleInstance.iconUrl)}
                                                className="size-full object-cover animate-[spin_20s_linear_infinite]"
                                                alt=""
                                            />
                                            <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent rounded-full" />
                                        </div>
                                    </div>

                                    {/* Textos */}
                                    <div className="flex flex-col min-w-0 flex-1 justify-center gap-0.5 pointer-events-none">
                                        <div className="flex items-center gap-1.5 mb-0.5">
                                            <span className="relative flex h-2 w-2">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                            </span>
                                            <span className="text-[9px] font-bold text-green-400 uppercase tracking-widest drop-shadow-md">
                                                Ejecutando
                                            </span>
                                        </div>
                                        <h3 className="text-white font-bold text-base truncate leading-tight drop-shadow-md">
                                            {singleInstance.name || singleInstance.instanceName}
                                        </h3>
                                        <p className="text-white/60 text-xs truncate drop-shadow-sm font-medium">
                                            {singleInstance.version || "Minecraft"}
                                        </p>
                                    </div>

                                    {/* Botón Cerrar */}
                                    <div className="flex items-center pr-4 pl-2" data-tauri-drag-region>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleClose(); }}
                                            className="size-10 rounded-full bg-white/10 hover:bg-white/20 active:scale-90 flex items-center justify-center text-white transition-all backdrop-blur-md"
                                        >
                                            <LucideX size={20} strokeWidth={2.5} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            /* --- MODO MULTI / VACÍO --- */
                            <div
                                data-tauri-drag-region
                                className="w-full max-w-[340px] bg-[#0a0a0a]/90 backdrop-blur-3xl border border-white/10 rounded-[32px] shadow-2xl overflow-hidden flex flex-col ring-1 ring-white/5"
                            >
                                {/* Header Draggable */}
                                <div className="px-5 pt-5 pb-3 flex justify-between items-center" data-tauri-drag-region>
                                    <div className="flex items-center gap-2 pointer-events-none">
                                        {loading ? (
                                            <LucideLoader2 className="w-3.5 h-3.5 text-white animate-spin" />
                                        ) : (
                                            <LucidePackage className="w-4 h-4 text-white/70" />
                                        )}
                                        <span className="text-xs font-bold text-white/90 uppercase tracking-wider">
                                            {instances.length > 0 ? 'Instancias' : 'Launcher'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <LucideGripHorizontal className="w-4 h-4 text-white/20 ml-1" />
                                    </div>
                                </div>

                                {/* Lista */}
                                <div className="px-3 pb-3 flex flex-col gap-2 max-h-[350px] overflow-y-auto custom-scrollbar">
                                    {instances.length === 0 ? (
                                        <div className="py-12 text-center space-y-3 select-none pointer-events-none">
                                            <div className="mx-auto w-12 h-12 bg-white/5 rounded-full flex items-center justify-center">
                                                <LucidePlay className="w-5 h-5 text-white/20 ml-1" />
                                            </div>
                                            <p className="text-sm font-medium text-white/40">No hay actividad reciente</p>
                                        </div>
                                    ) : (
                                        instances.map((instance) => (
                                            <div key={instance.id} className="group flex items-center gap-3 p-2 pr-3 rounded-[20px] hover:bg-white/10 transition-colors cursor-default border border-transparent hover:border-white/5">
                                                <div className="size-12 rounded-2xl bg-neutral-800 border border-white/5 overflow-hidden shrink-0 relative shadow-sm">
                                                    <img
                                                        src={getIconSrc(instance.icon || instance.iconUrl)}
                                                        alt=""
                                                        className="size-full object-cover"
                                                    />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="text-sm font-bold text-white truncate">
                                                        {instance.name || instance.instanceName}
                                                    </h4>
                                                    <div className="flex items-center gap-1.5 mt-0.5">
                                                        <div className="size-1.5 bg-green-500 rounded-full" />
                                                        <p className="text-[10px] text-white/50 font-medium truncate">Activo</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>

                                {/* Footer Cerrar */}
                                <div className="p-2 border-t border-white/5 bg-black/20">
                                    <button
                                        onClick={handleClose}
                                        className="w-full py-2.5 rounded-2xl text-[10px] font-bold text-white/40 hover:text-white hover:bg-white/5 transition-all uppercase tracking-widest flex items-center justify-center gap-2"
                                    >
                                        Cerrar <LucideX size={12} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};