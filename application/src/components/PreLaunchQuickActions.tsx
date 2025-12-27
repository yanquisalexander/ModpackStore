import { useState, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
    LucideFolderOpen,
    LucideLoaderCircle,
    LucideSettings,
    LucideShieldCheck,
    LucideGlobe,
    LucideDownload
} from "lucide-react";
import { toast } from "sonner";
import { EditInstanceInfo } from "@/components/EditInstanceInfo";
import { WorldManagerDialog } from "@/components/WorldManagerDialog";

// --- SUB-COMPONENTE PARA LOS ÍTEMS DEL MENÚ ---
// Reduce la repetición de clases CSS
const ActionItem = ({
    onClick,
    icon: Icon,
    label,
    variant = "default"
}: {
    onClick: () => void;
    icon: React.ElementType;
    label: string;
    variant?: "default" | "disabled";
}) => (
    <button
        onClick={onClick}
        disabled={variant === "disabled"}
        className={`
            group flex items-center gap-x-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
            ${variant === "disabled"
                ? "opacity-50 cursor-not-allowed text-neutral-500"
                : "text-neutral-200 hover:bg-white/10 hover:text-white cursor-pointer"
            }
        `}
    >
        <Icon className={`size-4 ${variant === "disabled" ? "text-neutral-600" : "text-neutral-400 group-hover:text-white"}`} />
        {label}
    </button>
);

const PreLaunchQuickActions = ({
    instanceId,
    isForge = false,
    onReloadInfo,
    isModpack = false,
    defaultShowEditInfo = false,
}: {
    instanceId: string;
    isForge?: boolean;
    isModpack?: boolean;
    onReloadInfo: () => void;
    defaultShowEditInfo?: boolean;
}) => {
    const [quickActionsOpen, setQuickActionsOpen] = useState(false);
    const [worldManagerOpen, setWorldManagerOpen] = useState(false);
    const quickActionsRef = useRef<HTMLDivElement>(null);

    // Click outside handler
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (quickActionsRef.current && !quickActionsRef.current.contains(event.target as Node)) {
                setQuickActionsOpen(false);
            }
        };
        if (quickActionsOpen) document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [quickActionsOpen]);

    // Handlers
    const openGameDir = async () => {
        try {
            setQuickActionsOpen(false);
            await invoke("open_game_dir", { instanceId });
            toast.success("Carpeta abierta");
        } catch (error) {
            console.error(error);
            toast.error("Error al abrir carpeta");
        }
    };

    const openWorldManager = () => {
        setQuickActionsOpen(false);
        setWorldManagerOpen(true);
    };

    const verifyIntegrity = async () => {
        setQuickActionsOpen(false);

        const invokeCommand = isForge ? null : "check_vanilla_integrity_async";
        if (!invokeCommand) {
            return toast.warning("No disponible para Forge", { description: "Solo instancias Vanilla soportan verificación por ahora." });
        }

        try {
            let toastId: string | number = toast.loading("Iniciando verificación...", { description: "Preparando archivos..." });

            // Listeners
            const unlistenStatus = await listen("instance-verifying-status", (event: any) => {
                const { status, message } = event.payload;
                if (status === "instance-verifying-complete") {
                    toast.success("Verificación completada", { id: toastId, description: message });
                    cleanup();
                } else {
                    toast.loading(message, { id: toastId });
                }
            });

            const unlistenTask = await listen("task-updated", (event: any) => {
                const { task } = event.payload;
                if (task.message?.includes("Verificando") && task.data?.stats) {
                    const { stats } = task.data;
                    const progress = Math.round(task.progress || 0);

                    let issues = [];
                    if (stats.corruptedFiles > 0) issues.push(`${stats.corruptedFiles} corruptos`);
                    if (stats.missingFiles > 0) issues.push(`${stats.missingFiles} faltantes`);

                    const desc = `Progreso: ${progress}% ${issues.length ? `• ${issues.join(", ")}` : ""}`;

                    toast.loading(task.message, { id: toastId, description: desc });
                }
            });

            const cleanup = () => {
                unlistenStatus();
                unlistenTask();
            };

            // Iniciar comando
            const taskId = `integrity_${Date.now()}`;
            await invoke(invokeCommand, { instanceId, taskId });

            // Timeout de seguridad para limpiar listeners
            setTimeout(cleanup, 300000); // 5 min

        } catch (error: any) {
            console.error(error);
            toast.error("Error de verificación", { description: error.message || "Ocurrió un error inesperado." });
        }
    };

    return (
        <div className="absolute right-0 bottom-40 z-40" ref={quickActionsRef}>
            <div className="relative flex items-center justify-end">

                {/* --- TOGGLE BUTTON --- */}
                <button
                    onClick={() => setQuickActionsOpen(!quickActionsOpen)}
                    className={`
                        size-12 flex items-center justify-center rounded-l-xl
                        bg-[#1E1E20] border-y border-l border-white/5 shadow-xl cursor-pointer
                        hover:bg-white/10 hover:border-white/10 transition-all duration-200
                        ${quickActionsOpen ? "bg-white/10 text-white" : "text-neutral-400"}
                    `}
                >
                    <LucideSettings
                        className={`size-6 transition-transform duration-300 ease-out ${quickActionsOpen ? "rotate-90 text-white" : ""}`}
                    />
                </button>

                {/* --- DROPDOWN MENU --- */}
                <div
                    className={`
                        absolute right-full bottom-0 mr-3 w-64 origin-bottom-right
                        transition-all duration-200 ease-out
                        ${quickActionsOpen
                            ? "opacity-100 scale-100 translate-x-0 pointer-events-auto"
                            : "opacity-0 scale-95 translate-x-4 pointer-events-none"
                        }
                    `}
                >
                    <div className="bg-[#121214]/90 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl p-2 space-y-1">

                        <div className="px-3 py-2 text-xs font-bold text-neutral-500 uppercase tracking-wider">
                            Acciones Rápidas
                        </div>

                        <ActionItem
                            onClick={openGameDir}
                            icon={LucideFolderOpen}
                            label="Abrir carpeta local"
                        />

                        <ActionItem
                            onClick={openWorldManager}
                            icon={LucideGlobe}
                            label="Administrar mundos"
                        />

                        {/* Edit Info Dialog Trigger Wrapper */}
                        <div onClick={() => setQuickActionsOpen(false)}>
                            <EditInstanceInfo
                                instanceId={instanceId}
                                onUpdate={onReloadInfo}
                                defaultShowEditInfo={defaultShowEditInfo}
                            />
                        </div>

                        <div className="h-px bg-white/5 my-1 mx-2" />

                        {isForge && !isModpack && (
                            <ActionItem
                                onClick={() => toast.info("Próximamente...")}
                                icon={LucideDownload}
                                label="Descargar mods"
                                variant="disabled"
                            />
                        )}

                        <ActionItem
                            onClick={verifyIntegrity}
                            icon={LucideShieldCheck}
                            label="Verificar integridad"
                        />

                    </div>
                </div>
            </div>

            {/* --- DIALOGS --- */}
            <WorldManagerDialog
                open={worldManagerOpen}
                onOpenChange={setWorldManagerOpen}
                instanceId={instanceId}
            />
        </div>
    );
};

export default PreLaunchQuickActions;