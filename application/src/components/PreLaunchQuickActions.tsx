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
        className={`flex items-center gap-3 w-full px-3 py-2 text-sm transition-colors ${
            variant === "disabled"
                ? "opacity-50 cursor-not-allowed text-neutral-600"
                : "text-neutral-400 hover:text-white hover:bg-white/[0.04] cursor-pointer"
        }`}
    >
        <Icon className="size-4 shrink-0" />
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

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (quickActionsRef.current && !quickActionsRef.current.contains(event.target as Node)) {
                setQuickActionsOpen(false);
            }
        };
        if (quickActionsOpen) document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [quickActionsOpen]);

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

            const taskId = `integrity_${Date.now()}`;
            await invoke(invokeCommand, { instanceId, taskId });

            setTimeout(cleanup, 300000);
        } catch (error: any) {
            console.error(error);
            toast.error("Error de verificación", { description: error.message || "Ocurrió un error inesperado." });
        }
    };

    return (
        <div className="absolute right-0 bottom-40 z-40" ref={quickActionsRef}>
            <div className="relative flex items-center justify-end">

                <button
                    onClick={() => setQuickActionsOpen(!quickActionsOpen)}
                    className={`size-12 flex items-center justify-center rounded-l-xl border-y border-l transition-colors ${
                        quickActionsOpen
                            ? "bg-[#252528] border-white/[0.08] text-white"
                            : "bg-[#1E1E20] border-white/5 text-neutral-500 hover:bg-white/[0.04] hover:border-white/[0.06]"
                    }`}
                >
                    <LucideSettings className={`size-5 transition-transform duration-200 ${quickActionsOpen ? "rotate-90" : ""}`} />
                </button>

                <div
                    className={`absolute right-full bottom-0 mr-3 w-64 origin-bottom-right transition-all duration-200 ease-out ${
                        quickActionsOpen
                            ? "opacity-100 scale-100 translate-x-0 pointer-events-auto"
                            : "opacity-0 scale-95 translate-x-4 pointer-events-none"
                    }`}
                >
                    <div className="bg-[#121214] border border-white/[0.06] rounded-lg py-1">

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

                        <div onClick={() => setQuickActionsOpen(false)}>
                            <EditInstanceInfo
                                instanceId={instanceId}
                                onUpdate={onReloadInfo}
                                defaultShowEditInfo={defaultShowEditInfo}
                            />
                        </div>

                        <div className="h-px bg-white/[0.04] mx-3 my-1" />

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

            <WorldManagerDialog
                open={worldManagerOpen}
                onOpenChange={setWorldManagerOpen}
                instanceId={instanceId}
            />
        </div>
    );
};

export default PreLaunchQuickActions;
