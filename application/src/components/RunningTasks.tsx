import { useTasksContext } from "@/stores/TasksContext";
import { LucideCheck, LucideInfo, LucideRefreshCcw, LucideTrash2, LucideX } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";

export const RunningTasks = () => {
    const { tasks, hasRunningTasks, taskCount, syncTasks } = useTasksContext();
    const [openMenu, setOpenMenu] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const toggleMenu = () => {
        setOpenMenu(!openMenu);
        if (!openMenu) {
            syncTasks().catch(console.error);
        }
    };

    const closeMenu = () => {
        setOpenMenu(false);
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                closeMenu();
            }
        };

        if (openMenu) {
            document.addEventListener("mousedown", handleClickOutside);
        } else {
            document.removeEventListener("mousedown", handleClickOutside);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [openMenu]);

    if (!hasRunningTasks && taskCount === 0) return null;

    // --- LOGICA DE ESTADO (Mantenida de la versión mejorada) ---
    const getStatusIcon = (status: string) => {
        switch (status) {
            case "Completed": return <LucideCheck size={16} className="text-emerald-500" />;
            case "Failed": return <LucideX size={16} className="text-red-500" />;
            case "Cancelled": return <LucideTrash2 size={16} className="text-amber-500" />;
            case "Running": return <LucideRefreshCcw size={16} className="text-blue-500 animate-spin" />;
            default: return <LucideInfo size={16} className="text-neutral-400" />;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case "Completed": return "bg-emerald-500";
            case "Failed": return "bg-red-500";
            case "Cancelled": return "bg-amber-500";
            case "Running": return "bg-blue-500";
            default: return "bg-neutral-500";
        }
    };

    const baseClasses = "flex items-center justify-center size-9 aspect-square hover:bg-neutral-800 cursor-pointer ";

    return (
        <div className="relative self-center" ref={containerRef}>

            {/* --- TRIGGER ORIGINAL RESTAURADO --- */}
            <button
                onClick={toggleMenu}
                className={`relative ${baseClasses} ${openMenu ? 'bg-neutral-800' : ''}`}
                title="Tareas en progreso"
                aria-label="Tareas en progreso"
            >
                {taskCount >= 1 && (
                    <span className="absolute top-0.5 right-0 bg-sky-600 size-4 text-[10px] flex items-center justify-center text-white rounded-full">
                        {taskCount}
                    </span>
                )}
                <LucideRefreshCcw
                    className={cn(
                        "size-4 text-white",
                        hasRunningTasks ? "animate-spin duration-[1500ms]" : ""
                    )}
                />
            </button>

            {/* --- MENÚ MEJORADO --- */}
            <AnimatePresence>
                {openMenu && (
                    <motion.div
                        initial={{ opacity: 0, y: 5, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 5, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-[#121212] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 origin-top-right"
                    >
                        {/* Header del Menú */}
                        <div className="px-4 py-3 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
                            <span className="text-sm font-semibold text-white">Actividad</span>
                            <span className="text-xs font-medium text-neutral-500 bg-white/5 px-2 py-0.5 rounded-full">
                                {taskCount}
                            </span>
                        </div>

                        {/* Lista de Tareas */}
                        <div className="max-h-[320px] overflow-y-auto custom-scrollbar p-2 space-y-1">
                            {tasks.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-8 text-neutral-500 gap-2">
                                    <LucideCheck className="w-8 h-8 opacity-20" />
                                    <p className="text-sm">Todo en orden.</p>
                                </div>
                            ) : (
                                tasks.map((task) => (
                                    <div key={task.id} className="p-3 rounded-lg hover:bg-white/5 transition-colors group">
                                        <div className="flex items-start justify-between gap-3 mb-2">
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <div className="shrink-0 mt-0.5">
                                                    {getStatusIcon(task.status)}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-medium text-neutral-200 truncate pr-2">
                                                        {task.label}
                                                    </p>
                                                    {task.message && (
                                                        <p className="text-xs text-neutral-500 truncate mt-0.5">
                                                            {task.message}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            <span className="text-xs font-mono text-neutral-500 shrink-0">
                                                {Math.round(task.progress)}%
                                            </span>
                                        </div>

                                        {/* Barra de Progreso */}
                                        <div className="h-1 w-full bg-neutral-800 rounded-full overflow-hidden">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${Math.max(5, Math.min(100, task.progress))}%` }}
                                                transition={{ duration: 0.3 }}
                                                className={cn("h-full rounded-full", getStatusColor(task.status))}
                                            />
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};