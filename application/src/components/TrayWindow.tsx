import { useEffect, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
    LucidePackage, LucidePlay, LucideX, LucideLoader2,
    LucidePower, LucideChevronLeft, LucideChevronRight,
    LucideList, LucideGripVertical
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";

const getIconSrc = (iconUrl?: string | null) => {
    if (!iconUrl) return "/images/default_instances/default_forge.webp";
    if (iconUrl.startsWith("/") || iconUrl.startsWith("http") || iconUrl.startsWith("data:")) {
        return iconUrl;
    }
    return `data:image/png;base64,${iconUrl}`;
};

interface TrayInstance {
    id: string;
    name: string;
    version: string;
    icon: string | null;
    isRunning: boolean;
}

export const TrayWindow = () => {
    const [instances, setInstances] = useState<TrayInstance[]>([]);
    const [isVisible, setIsVisible] = useState(false);
    const [loading, setLoading] = useState(false);
    const [launchingInstances, setLaunchingInstances] = useState<Set<string>>(new Set());

    // UI State
    const [activeIndex, setActiveIndex] = useState(0);
    const [viewMode, setViewMode] = useState<'pill' | 'list'>('pill');

    // --- DATA FETCHING ---
    const refreshInstances = useCallback(async () => {
        try {
            setLoading(true);
            const [allInstances, runningInstances] = await Promise.all([
                invoke<any[]>('get_all_instances'),
                invoke<any[]>('get_running_instances')
            ]);
            const runningIds = new Set(runningInstances.map((i: any) => i.id));
            const combined: TrayInstance[] = allInstances.map((inst: any) => ({
                id: inst.instanceId,
                name: inst.instanceName,
                version: inst.minecraftVersion,
                icon: inst.iconUrl,
                isRunning: runningIds.has(inst.instanceId)
            }));
            setInstances(combined);
        } catch (error) { console.error("Error:", error); } finally { setLoading(false); }
    }, []);

    // --- ACTIONS ---
    const handleLaunch = async (instanceId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (launchingInstances.has(instanceId)) return;
        setLaunchingInstances(prev => new Set(prev).add(instanceId));
        try {
            await invoke('launch_mc_instance', { instanceId });
            refreshInstances();
        } catch (error) { console.error("Failed to launch:", error); } finally {
            setLaunchingInstances(prev => { const next = new Set(prev); next.delete(instanceId); return next; });
        }
    };

    const handleForceCloseInstance = async (instanceId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        try { await invoke('kill_mc_instance', { instanceId }); refreshInstances(); } catch (error) { console.error(error); }
    };

    const handleClose = useCallback(() => setIsVisible(false), []);
    const onExitComplete = async () => { if (!isVisible) try { await getCurrentWindow().hide(); } catch (err) { console.error(err); } };

    useEffect(() => {
        refreshInstances();
        const unlistenLaunched = listen("instance-launched", refreshInstances);
        const unlistenExited = listen("instance-exited", refreshInstances);
        const win = getCurrentWindow();
        const unlistenFocus = win.onFocusChanged(async ({ payload: focused }) => {
            if (focused) { await refreshInstances(); setIsVisible(true); setViewMode('pill'); }
        });
        const handleKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
        window.addEventListener("keydown", handleKeyDown);
        const intervalId = setInterval(refreshInstances, 5000);
        return () => {
            unlistenLaunched.then(f => f()); unlistenExited.then(f => f()); unlistenFocus.then(f => f());
            window.removeEventListener("keydown", handleKeyDown); clearInterval(intervalId);
        };
    }, [refreshInstances, handleClose]);

    // --- LOGIC ---
    const runningInstances = instances.filter(i => i.isRunning);
    const hasRunning = runningInstances.length > 0;

    const safeActiveIndex = Math.min(activeIndex, runningInstances.length - 1);
    const currentRunning = runningInstances[safeActiveIndex < 0 ? 0 : safeActiveIndex];

    const nextInstance = (e: React.MouseEvent) => {
        e.stopPropagation();
        setActiveIndex((prev) => (prev + 1) % runningInstances.length);
    };
    const prevInstance = (e: React.MouseEvent) => {
        e.stopPropagation();
        setActiveIndex((prev) => (prev - 1 + runningInstances.length) % runningInstances.length);
    };

    const currentView = hasRunning ? viewMode : 'list';

    return (
        <div className="w-full h-screen bg-transparent flex flex-col justify-end pb-8 px-4 select-none font-sans overflow-hidden pointer-events-none">
            <AnimatePresence mode="wait" onExitComplete={onExitComplete}>
                {isVisible && (
                    <motion.div
                        key="container"
                        initial={{ y: 80, opacity: 0, scale: 0.95 }}
                        animate={{ y: 0, opacity: 1, scale: 1 }}
                        exit={{ y: 80, opacity: 0, scale: 0.95 }}
                        transition={{ type: "spring", stiffness: 400, damping: 28 }}
                        className="w-full flex justify-center pointer-events-auto"
                    >
                        <div
                            data-tauri-drag-region
                            className={cn(
                                "relative bg-[#09090b] border border-white/10 shadow-2xl overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]",
                                currentView === 'pill' ? "rounded-full w-[400px] h-[80px]" : "rounded-[32px] w-[360px] max-h-[500px]"
                            )}
                        >

                            <AnimatePresence mode="wait">
                                {currentView === 'pill' && currentRunning ? (
                                    <motion.div
                                        key="pill-view"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="relative w-full h-full flex items-center pl-2 pr-4 gap-3 z-10"
                                    >
                                        {/* Background Blur */}
                                        <div className="absolute inset-0 -z-10 opacity-30 pointer-events-none">
                                            <img src={getIconSrc(currentRunning.icon)} className="w-full h-full object-cover blur-3xl scale-150" alt="" />
                                            <div className="absolute inset-0 bg-black/60" />
                                        </div>

                                        {/* --- IZQUIERDA: NAV & ICONO --- */}
                                        <div className="flex items-center gap-2">
                                            {runningInstances.length > 1 && (
                                                <button onClick={prevInstance} className="p-1 text-white/30 hover:text-white transition-colors">
                                                    <LucideChevronLeft size={16} />
                                                </button>
                                            )}

                                            {/* Icono ESTÁTICO (Cuadrado con bordes redondeados) */}
                                            <div className="size-14 rounded-2xl bg-neutral-800 border border-white/10 relative shrink-0 shadow-lg overflow-hidden group">
                                                <img
                                                    key={currentRunning.id}
                                                    src={getIconSrc(currentRunning.icon)}
                                                    className="size-full object-cover"
                                                    alt=""
                                                />
                                            </div>
                                        </div>

                                        {/* --- CENTRO: INFO --- */}
                                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                                            <motion.div
                                                key={currentRunning.id}
                                                initial={{ y: 10, opacity: 0 }}
                                                animate={{ y: 0, opacity: 1 }}
                                                className="flex flex-col"
                                            >
                                                <h3 className="text-white font-bold text-sm truncate leading-tight">
                                                    {currentRunning.name}
                                                </h3>
                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                    <span className="size-1.5 bg-green-500 rounded-full animate-pulse" />
                                                    <span className="text-[10px] text-green-400 font-bold uppercase tracking-wider">
                                                        {runningInstances.length > 1 ? `${safeActiveIndex + 1} / ${runningInstances.length}` : 'Ejecutando'}
                                                    </span>
                                                </div>
                                            </motion.div>
                                        </div>

                                        {/* --- DERECHA: BOTONES --- */}
                                        <div className="flex items-center gap-2">
                                            {runningInstances.length > 1 && (
                                                <button onClick={nextInstance} className="p-1 text-white/30 hover:text-white transition-colors mr-1">
                                                    <LucideChevronRight size={16} />
                                                </button>
                                            )}

                                            <div className="h-8 w-px bg-white/10 mx-1" />

                                            <button
                                                onClick={(e) => handleForceCloseInstance(currentRunning.id, e)}
                                                className="size-9 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/10 hover:border-red-500/30 flex items-center justify-center transition-all active:scale-95"
                                                title="Detener instancia"
                                            >
                                                <LucidePower size={16} />
                                            </button>

                                            <button
                                                onClick={() => setViewMode('list')}
                                                className="size-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all active:scale-95"
                                                title="Ver todas las instancias"
                                            >
                                                <LucideList size={16} />
                                            </button>
                                        </div>
                                    </motion.div>
                                ) : (
                                    /* =========================================
                                       VISTA LISTA
                                       ========================================= */
                                    <motion.div
                                        key="list-view"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="flex flex-col h-full relative z-10"
                                    >
                                        <div className="px-5 py-4 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                                            <div className="flex items-center gap-2 pointer-events-none">
                                                <LucidePackage className="size-4 text-white/50" />
                                                <span className="text-xs font-bold text-white/80 uppercase tracking-wide">Biblioteca</span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                {hasRunning && (
                                                    <button onClick={() => setViewMode('pill')} className="text-[10px] font-bold text-blue-400 hover:text-blue-300 uppercase tracking-widest">
                                                        Minimizar
                                                    </button>
                                                )}
                                                <LucideGripVertical className="size-4 text-white/20" />
                                            </div>
                                        </div>

                                        <div className="p-2 flex flex-col gap-1 overflow-y-auto custom-scrollbar max-h-[350px]">
                                            {instances.length === 0 ? (
                                                <div className="py-8 text-center text-white/30 text-xs">No hay instancias</div>
                                            ) : (
                                                instances.map(inst => (
                                                    <div
                                                        key={inst.id}
                                                        onClick={(e) => !inst.isRunning && handleLaunch(inst.id, e)}
                                                        className={`group flex items-center gap-3 p-2 rounded-xl transition-all border border-transparent ${inst.isRunning ? "bg-white/[0.04] border-white/5" : "hover:bg-white/5 cursor-pointer"
                                                            }`}
                                                    >
                                                        <div className="size-10 rounded-lg bg-neutral-800 relative overflow-hidden shrink-0 border border-white/5">
                                                            <img src={getIconSrc(inst.icon)} className={`size-full object-cover ${!inst.isRunning && 'grayscale opacity-60'}`} alt="" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <h4 className={`text-sm font-bold truncate ${inst.isRunning ? 'text-white' : 'text-white/70'}`}>{inst.name}</h4>
                                                            <p className="text-[10px] text-white/30 truncate">{inst.isRunning ? 'Activo' : inst.version}</p>
                                                        </div>
                                                        <div className="shrink-0">
                                                            {inst.isRunning ? (
                                                                <button onClick={(e) => handleForceCloseInstance(inst.id, e)} className="size-8 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 flex items-center justify-center transition-colors">
                                                                    <LucidePower size={14} />
                                                                </button>
                                                            ) : (
                                                                <button className={`size-8 rounded-lg bg-white/5 text-white/40 group-hover:bg-white group-hover:text-black flex items-center justify-center transition-all ${launchingInstances.has(inst.id) ? 'opacity-50' : 'group-hover:scale-110'}`}>
                                                                    {launchingInstances.has(inst.id) ? <LucideLoader2 size={14} className="animate-spin" /> : <LucidePlay size={14} fill="currentColor" className="ml-0.5" />}
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>

                                        <div className="p-2 border-t border-white/5 bg-black/20">
                                            <button onClick={handleClose} className="w-full py-2 rounded-xl text-[10px] font-bold text-white/30 hover:text-white hover:bg-white/5 transition-all uppercase tracking-widest flex items-center justify-center gap-2">
                                                Cerrar <LucideX size={12} />
                                            </button>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};