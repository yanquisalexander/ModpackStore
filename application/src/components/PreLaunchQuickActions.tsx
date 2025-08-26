import { useState, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { LucideFolderOpen, LucideLoaderCircle, LucideSettings, LucideShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { EditInstanceInfo } from "@/components/EditInstanceInfo";

const PreLaunchQuickActions = ({
    instanceId,
    isForge = false,
    onReloadInfo,
    defaultShowEditInfo = false,
}: {
    instanceId: string;
    isForge?: boolean;
    onReloadInfo: () => void;
    defaultShowEditInfo?: boolean;
}) => {
    const [quickActionsOpen, setQuickActionsOpen] = useState(false);
    const quickActionsRef = useRef<HTMLDivElement>(null);

    // Click outside handler for quick actions menu
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (quickActionsRef.current && !quickActionsRef.current.contains(event.target as Node)) {
                setQuickActionsOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const toggleQuickActions = () => {
        setQuickActionsOpen(prev => !prev);
    };

    const openGameDir = async () => {
        try {
            await invoke("open_game_dir", { instanceId });
            toast.success("Abriendo carpeta de la instancia...");
            setQuickActionsOpen(false);
        } catch (error) {
            console.error("Error opening game directory:", error);
            toast.error("Error al abrir la carpeta de la instancia", {
                description: "No se pudo abrir la carpeta de la instancia. Intenta nuevamente.",
                dismissible: true,
            });
        }
    };

    const notAvailable = () => {
        setQuickActionsOpen(false);
        toast.error("Función no disponible aún", {
            description: "Esta función estará disponible en futuras versiones.",
        });
    };

    const verifyIntegrity = async () => {
        const invokeCommand = isForge ? null : "check_vanilla_integrity_async";
        if (!invokeCommand) {
            toast.error("Función no disponible para Forge", {
                description: "Esta función no está disponible para instancias de Forge.",
                dismissible: true,
            });
            return;
        }

        try {
            let currentToastId: string | null = null;

            const unlisten = await listen("instance-verifying-status", (event) => {
                const { status, message } = event.payload as any

                if (status === "instance-verifying-complete") {
                    if (currentToastId) {
                        toast.dismiss(currentToastId);
                    }
                    toast.success("Verificación completada", {
                        description: message,
                        dismissible: true,
                    });
                    unlisten();
                } else if (status === "instance-verifying-progress") {
                    // Update existing toast or create new one
                    if (currentToastId) {
                        toast.dismiss(currentToastId);
                    }

                    currentToastId = String(toast.loading(message, {
                        dismissible: false,
                    }));
                } else {
                    if (currentToastId) {
                        toast.dismiss(currentToastId);
                    }

                    currentToastId = String(toast(message, {
                        dismissible: true,
                    }));
                }
            });

            // Listen for detailed task updates
            const unlistenTask = await listen("task-updated", (event) => {
                const { task } = event.payload as any;

                if (task.message?.includes("Verificando") && task.data?.stats) {
                    const { stats } = task.data;
                    const progress = Math.round(task.progress || 0);

                    let description = `Progreso: ${progress}%`;

                    if (stats.checkedFiles > 0) {
                        description += `\nArchivos verificados: ${stats.checkedFiles}/${stats.totalFiles}`;
                    }

                    if (stats.corruptedFiles > 0 || stats.missingFiles > 0) {
                        const issues = [];
                        if (stats.corruptedFiles > 0) {
                            issues.push(`${stats.corruptedFiles} corruptos`);
                        }
                        if (stats.missingFiles > 0) {
                            issues.push(`${stats.missingFiles} faltantes`);
                        }
                        description += `\nProblemas encontrados: ${issues.join(', ')}`;
                    }

                    if (stats.fixedFiles > 0) {
                        description += `\nArchivos reparados: ${stats.fixedFiles}`;
                    }

                    if (currentToastId) {
                        toast.dismiss(currentToastId);
                    }

                    currentToastId = String(toast.loading(task.message, {
                        description: description,
                        dismissible: false,
                    }));
                }
            });

            // Generate a unique task ID
            const taskId = `integrity_check_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            await invoke(invokeCommand, {
                instanceId,
                taskId: taskId
            });

            toast.success("Verificación iniciada", {
                description: "Verificando integridad de archivos...",
                dismissible: true,
            });

            setQuickActionsOpen(false);

            // Clean up listeners after some time if not already cleaned
            setTimeout(() => {
                unlisten();
                unlistenTask();
            }, 300000); // 5 minutes timeout

        } catch (error) {
            console.error("Error verifying integrity:", error);
            toast.error("Error al verificar la integridad", {
                description: (typeof error === "object" && error !== null && "message" in error)
                    ? (error as { message: string }).message
                    : String(error) || "No se pudo verificar la integridad de archivos. Intenta nuevamente.",
                dismissible: true,
            });
        }
    };

    return (
        <div className="absolute right-0 bottom-40 z-40 group" ref={quickActionsRef}>
            <div className="flex items-center justify-end relative w-fit">
                {/* Settings button */}
                <button
                    onClick={toggleQuickActions}
                    className="size-12 cursor-pointer group hover:bg-neutral-900 transition bg-neutral-800 rounded-l-md flex items-center justify-center"
                >
                    <LucideSettings
                        style={{
                            transform: quickActionsOpen ? "rotate(90deg)" : "rotate(0deg)",
                            transition: "transform 0.3s ease-in-out",
                        }}
                        className="size-5 text-white"
                    />
                </button>

                {/* Actions menu */}
                <div
                    className={`absolute right-full bottom-0 mr-2 ${quickActionsOpen
                        ? "opacity-100 pointer-events-auto translate-x-0"
                        : "opacity-0 pointer-events-none translate-x-2"
                        } transition-all duration-300`}
                >
                    <div className="bg-neutral-900 border border-neutral-700 rounded-md shadow-md p-2 space-y-2 max-w-xs w-64">
                        <button
                            onClick={openGameDir}
                            className="cursor-pointer flex items-center gap-x-2 text-white w-full hover:bg-neutral-800 px-3 py-2 rounded-md transition"
                        >
                            <LucideFolderOpen className="size-4 text-white" />
                            Abrir .minecraft
                        </button>

                        <EditInstanceInfo
                            instanceId={instanceId}
                            onUpdate={onReloadInfo}
                            defaultShowEditInfo={defaultShowEditInfo}
                        />

                        {isForge && (
                            <button
                                onClick={notAvailable}
                                className="cursor-pointer flex items-center gap-x-2 text-white w-full hover:bg-neutral-800 px-3 py-2 rounded-md transition"
                            >
                                <LucideLoaderCircle className="size-4 text-white" />
                                Descargar mods
                            </button>
                        )}

                        <button
                            onClick={verifyIntegrity}
                            className="cursor-pointer flex items-center gap-x-2 text-white w-full hover:bg-neutral-800 px-3 py-2 rounded-md transition"
                        >
                            <LucideShieldCheck className="size-4 text-white" />
                            Verificar integridad
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PreLaunchQuickActions;