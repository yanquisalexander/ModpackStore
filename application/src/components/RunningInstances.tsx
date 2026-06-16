import { useInstances } from "@/stores/InstancesContext";
import { LucidePackageSearch, LucidePlay, LucideX, LucideLoader2 } from "lucide-react";
import { useEffect, useRef, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { invoke } from "@tauri-apps/api/core";
import { TauriCommandReturns } from "@/types/TauriCommandReturns";

const getIconSrc = (iconUrl?: string | null) => {
    if (!iconUrl) return "/images/default_instances/default_forge.webp";
    if (iconUrl.startsWith("/") || iconUrl.startsWith("http") || iconUrl.startsWith("data:")) {
        return iconUrl;
    }
    return `data:image/png;base64,${iconUrl}`;
};

export const RunningInstances = () => {
    const { instances: contextInstances } = useInstances();
    const [detailMap, setDetailMap] = useState<Map<string, TauriCommandReturns['get_instance_by_id']>>(new Map());
    const [isLoading, setIsLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const fetchedIdsRef = useRef<string[]>([]);

    const runningInstances = useMemo(
        () => contextInstances.filter(i => i.status === "running"),
        [contextInstances]
    );

    const runningIds = useMemo(() => runningInstances.map(i => i.id), [runningInstances]);

    const instancesToRender = useMemo(
        () => runningInstances.map(running => {
            const detail = detailMap.get(running.id);
            return { ...running, ...detail, instanceId: detail?.instanceId ?? running.id };
        }),
        [runningInstances, detailMap]
    );

    const isSingleInstance = instancesToRender.length === 1;

    // Fetch de detalles solo cuando cambien las instancias en ejecución
    useEffect(() => {
        const missingIds = runningIds.filter(id => !fetchedIdsRef.current.includes(id));
        if (missingIds.length === 0 && fetchedIdsRef.current.length > 0) return;

        let cancelled = false;
        setIsLoading(true);

        invoke<TauriCommandReturns['get_instance_by_id'][]>('get_all_instances')
            .then(instances => {
                if (cancelled) return;
                const map = new Map<string, TauriCommandReturns['get_instance_by_id']>();
                instances.forEach(inst => map.set(inst.instanceId, inst));
                setDetailMap(map);
                fetchedIdsRef.current = runningIds;
            })
            .catch(err => {
                if (cancelled) return;
                console.error('Failed to fetch instance details:', err);
            })
            .finally(() => {
                if (!cancelled) setIsLoading(false);
            });

        return () => { cancelled = true; };
    }, [runningIds]);

    // Click outside + Escape key
    useEffect(() => {
        if (!isOpen) return;
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") setIsOpen(false);
        };
        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("keydown", handleEscape);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleEscape);
        };
    }, [isOpen]);

    if (runningInstances.length === 0) return null;

    return (
        <div className="relative z-50" ref={containerRef}>

            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`relative cursor-pointer flex size-9 aspect-square items-center justify-center hover:bg-neutral-800 ${isOpen ? "bg-neutral-800" : ""}`}
            >
                <motion.div
                    animate={{ rotate: isOpen ? 90 : 0 }}
                    transition={{ duration: 0.2 }}
                >
                    {isOpen ? <LucideX className="size-4 text-white" /> : <LucidePackageSearch className="size-4 text-white" />}
                </motion.div>

                {!isOpen && (
                    <span className="absolute top-0.5 right-0 bg-sky-600 size-4 text-[10px] flex items-center justify-center text-white rounded-full">
                        {runningInstances.length}
                    </span>
                )}
            </button>

            <AnimatePresence>
                {isOpen && (
                    isSingleInstance ? (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.8, y: -10, width: 40 }}
                            animate={{ opacity: 1, scale: 1, y: 0, width: "auto" }}
                            exit={{ opacity: 0, scale: 0.8, y: -10, transition: { duration: 0.15 } }}
                            transition={{ type: "spring", stiffness: 400, damping: 25 }}
                            className="absolute top-0 right-0 mt-12 mr-[-10px] z-50 origin-top-right"
                        >
                            <Link
                                to={`/prelaunch/${instancesToRender[0].instanceId || instancesToRender[0].id}`}
                                onClick={() => setIsOpen(false)}
                                className="relative flex items-center gap-4 p-3 bg-[#0a0a0a] border border-white/10 rounded-full shadow-2xl overflow-hidden min-w-[280px] group cursor-pointer"
                            >
                                {!isLoading && (
                                    <div className="absolute inset-0 z-0 opacity-40">
                                        <img
                                            src={getIconSrc(instancesToRender[0].iconUrl)}
                                            className="w-full h-full object-cover blur-2xl scale-150 saturate-150"
                                            alt=""
                                        />
                                        <div className="absolute inset-0 bg-black/60" />
                                    </div>
                                )}

                                <div className="relative z-10 flex items-center gap-3 w-full">
                                    <div className="size-10 rounded-full bg-neutral-900 border border-white/10 overflow-hidden shrink-0 shadow-lg flex items-center justify-center">
                                        {isLoading ? (
                                            <LucideLoader2 className="size-4 text-neutral-500 animate-spin" />
                                        ) : (
                                            <img
                                                src={getIconSrc(instancesToRender[0].iconUrl)}
                                                className="size-full object-cover"
                                                alt=""
                                            />
                                        )}
                                    </div>

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

                                    <div className="size-9 rounded-full bg-white/10 group-hover:bg-white text-white group-hover:text-black flex items-center justify-center transition-all backdrop-blur-md shrink-0">
                                        <LucidePlay className="size-4 fill-current ml-0.5" />
                                    </div>
                                </div>
                            </Link>
                        </motion.div>
                    ) : (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: -5 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: -5, transition: { duration: 0.15 } }}
                            transition={{ type: "spring", stiffness: 400, damping: 30 }}
                            className="absolute top-full right-0 mt-2 w-72 bg-[#0a0a0a]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50 origin-top-right"
                        >
                            <div className="p-1">
                                <div className="px-3 py-2 border-b border-white/5 flex items-center justify-between">
                                    <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
                                        Ejecutando ({runningInstances.length})
                                    </span>
                                    {isLoading && (
                                        <LucideLoader2 className="size-3 text-neutral-500 animate-spin" />
                                    )}
                                </div>
                                <div className="flex flex-col gap-1 p-1 max-h-[320px] overflow-y-auto">
                                    {instancesToRender.map(instance => (
                                        <Link
                                            key={instance.id || instance.instanceId}
                                            to={`/prelaunch/${instance.id || instance.instanceId}`}
                                            onClick={() => setIsOpen(false)}
                                            className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/10 transition-colors group"
                                        >
                                            <div className="size-9 rounded-lg bg-neutral-800 border border-white/5 overflow-hidden shrink-0 flex items-center justify-center">
                                                {isLoading ? (
                                                    <LucideLoader2 className="size-3 text-neutral-600 animate-spin" />
                                                ) : (
                                                    <img
                                                        src={getIconSrc(instance.iconUrl)}
                                                        className="size-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                                                        alt=""
                                                    />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <span className="text-sm font-medium text-neutral-300 group-hover:text-white truncate block">
                                                    {instance.instanceName || instance.name}
                                                </span>
                                                {(instance.minecraftVersion || instance.loaderType) && (
                                                    <span className="text-[10px] text-neutral-500 flex items-center gap-1">
                                                        {instance.loaderType && (
                                                            <span className="capitalize">{instance.loaderType}</span>
                                                        )}
                                                        {instance.loaderType && instance.minecraftVersion && <span>·</span>}
                                                        {instance.minecraftVersion}
                                                        {instance.instanceType && (
                                                            <>
                                                                <span>·</span>
                                                                <span className="capitalize">{instance.instanceType}</span>
                                                            </>
                                                        )}
                                                    </span>
                                                )}
                                            </div>
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