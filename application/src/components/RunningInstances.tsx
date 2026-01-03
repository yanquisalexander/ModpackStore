import { useInstances } from "@/stores/InstancesContext";
import { LucidePackageSearch, LucidePlay, LucideX, LucideLoader2, LucideSquare } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import { invoke } from "@tauri-apps/api/core";
import { TauriCommandReturns } from "@/types/TauriCommandReturns";

// Helper para iconos
const getIconSrc = (iconUrl?: string | null) => {
    if (!iconUrl) return "/images/default_instances/default_forge.webp";
    if (iconUrl.startsWith("/") || iconUrl.startsWith("http") || iconUrl.startsWith("data:")) {
        return iconUrl;
    }
    return `data:image/png;base64,${iconUrl}`;
};

export const RunningInstances = () => {
    const { instances: contextInstances } = useInstances();
    const [detailedInstances, setDetailedInstances] = useState<TauriCommandReturns['get_instance_by_id'][]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const runningInstances = contextInstances.filter(instance => instance.status === "running");

    // Combinamos datos
    const instancesToRender = runningInstances.map(running => {
        const detail = detailedInstances.find(d => d.instanceId === running.id);
        return { ...running, ...detail };
    });

    const isSingleInstance = instancesToRender.length === 1;

    // Fetch de detalles (iconos) solo si es necesario
    useEffect(() => {
        if (isOpen || runningInstances.length > 0) {
            invoke<TauriCommandReturns['get_instance_by_id'][]>('get_all_instances')
                .then(setDetailedInstances)
                .catch(console.error);
        }
    }, [isOpen, runningInstances.length]);

    // Click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        if (isOpen) document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isOpen]);

    if (runningInstances.length === 0) return null;

    return (
        <div className="relative z-50" ref={containerRef}>

            {/* BOTÓN TRIGGER (Siempre visible, pero interactúa con la animación) */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "flex size-9 items-center justify-center hover:bg-neutral-800 transition-all active:scale-95",
                    isOpen ? "bg-neutral-800" : ""
                )}
            >
                <motion.div
                    // Pequeña animación del icono al hacer click
                    animate={{ rotate: isOpen ? 90 : 0 }}
                    transition={{ duration: 0.2 }}
                >
                    {isOpen ? <LucideX className="size-4 text-white" /> : <LucidePackageSearch className="size-4 text-neutral-300" />}
                </motion.div>

                {!isOpen && (
                    <span className="absolute top-1 -right-1 bg-sky-600 size-4 text-[10px] font-bold text-white rounded-full flex items-center justify-center ring-2 ring-[#0a0a0a]">
                        {runningInstances.length}
                    </span>
                )}
            </button>

            <AnimatePresence>
                {isOpen && (
                    isSingleInstance ? (
                        /* =================================================================
                           MODO 1: SINGLE INSTANCE (Dynamic Island / Now Bar Style)
                           - Centrado relativo al botón (anchor right)
                           - Fondo ambiental basado en el icono
                           ================================================================= */
                        <motion.div
                            initial={{ opacity: 0, scale: 0.8, y: -10, width: 40 }}
                            animate={{ opacity: 1, scale: 1, y: 0, width: "auto" }}
                            exit={{ opacity: 0, scale: 0.8, y: -10, transition: { duration: 0.15 } }}
                            transition={{ type: "spring", stiffness: 400, damping: 25 }}
                            className="absolute top-0 right-0 mt-12 mr-[-10px] z-50 origin-top-right"
                        >
                            <Link
                                to={`/prelaunch/${instancesToRender[0].id || instancesToRender[0].instanceId}`}
                                onClick={() => setIsOpen(false)}
                                className="relative flex items-center gap-4 p-3 bg-[#0a0a0a] border border-white/10 rounded-full shadow-2xl overflow-hidden min-w-[280px] group cursor-pointer"
                            >
                                {/* FONDO AMBIENTAL (Blur de la imagen) */}
                                <div className="absolute inset-0 z-0 opacity-40">
                                    <img
                                        src={getIconSrc(instancesToRender[0].iconUrl)}
                                        className="w-full h-full object-cover blur-2xl scale-150 saturate-150"
                                        alt=""
                                    />
                                    <div className="absolute inset-0 bg-black/60" /> {/* Overlay para legibilidad */}
                                </div>

                                {/* CONTENIDO (Z-Index alto) */}
                                <div className="relative z-10 flex items-center gap-3 w-full">
                                    {/* Icono Principal */}
                                    <div className="size-10 rounded-full bg-neutral-900 border border-white/10 overflow-hidden shrink-0 shadow-lg">
                                        <img
                                            src={getIconSrc(instancesToRender[0].iconUrl)}
                                            className="size-full object-cover"
                                            alt=""
                                        />
                                    </div>

                                    {/* Texto */}
                                    <div className="flex flex-col flex-1 min-w-0">
                                        <span className="text-xs font-bold text-white truncate leading-tight">
                                            {instancesToRender[0].instanceName || instancesToRender[0].name}
                                        </span>
                                        <div className="flex items-center gap-1.5">
                                            <span className="size-1.5 rounded-full bg-green-500 animate-pulse" />
                                            <span className="text-[10px] font-medium text-green-400 uppercase tracking-wide">
                                                Ejecutando
                                            </span>
                                        </div>
                                    </div>

                                    {/* Acción */}
                                    <div className="size-9 rounded-full bg-white/10 group-hover:bg-white text-white group-hover:text-black flex items-center justify-center transition-all backdrop-blur-md shrink-0">
                                        <LucidePlay className="size-4 fill-current ml-0.5" />
                                    </div>
                                </div>
                            </Link>
                        </motion.div>
                    ) : (
                        /* =================================================================
                           MODO 2: MULTI INSTANCE (Premium List Dropdown)
                           - Lista vertical limpia
                           ================================================================= */
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: -5 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: -5, transition: { duration: 0.15 } }}
                            transition={{ type: "spring", stiffness: 400, damping: 30 }}
                            className="absolute top-full right-0 mt-2 w-64 bg-[#0a0a0a]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50 origin-top-right"
                        >
                            <div className="p-1">
                                <div className="px-3 py-2 border-b border-white/5 flex justify-between items-center">
                                    <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
                                        Ejecutando ({runningInstances.length})
                                    </span>
                                </div>
                                <div className="flex flex-col gap-1 p-1">
                                    {instancesToRender.map(instance => (
                                        <Link
                                            key={instance.id || instance.instanceId}
                                            to={`/prelaunch/${instance.id || instance.instanceId}`}
                                            onClick={() => setIsOpen(false)}
                                            className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/10 transition-colors group"
                                        >
                                            <div className="size-8 rounded-lg bg-neutral-800 border border-white/5 overflow-hidden shrink-0">
                                                <img
                                                    src={getIconSrc(instance.iconUrl)}
                                                    className="size-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                                                    alt=""
                                                />
                                            </div>
                                            <span className="text-sm font-medium text-neutral-300 group-hover:text-white truncate flex-1">
                                                {instance.instanceName || instance.name}
                                            </span>
                                            <LucidePlay className="size-4 text-green-400 group-hover:text-green-500 shrink-0" />
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    )
                )}
            </AnimatePresence>
        </div>
    );
};