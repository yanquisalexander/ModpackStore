import { useEffect, useState, useRef } from "react";
import { useGlobalContext } from "@/stores/GlobalContext";
import {
    LucideDownload,
    LucideCheckCircle2,
    LucideAlertCircle,
    LucideLoader2,
    LucideRocket,
    LucideX,
    LucideRefreshCw,
    LucideWifiOff,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const UpdateStatus = () => {
    const {
        isUpdating,
        updateProgress,
        updateVersion,
        updateState,
        isSimulated,
        resetUpdate,
    } = useGlobalContext();

    const [visible, setVisible] = useState(false);
    const [progress, setProgress] = useState(0);
    const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Sync external progress
    useEffect(() => {
        setProgress(updateProgress);
    }, [updateProgress]);

    // Show when updating starts
    useEffect(() => {
        if (isUpdating) setVisible(true);
    }, [isUpdating]);

    // Auto-hide after 6s if not downloading
    useEffect(() => {
        if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
        if (!isUpdating || updateState === "downloading") return;

        hideTimeoutRef.current = setTimeout(() => {
            setVisible(false);
        }, 6000);

        return () => {
            if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
        };
    }, [isUpdating, updateState]);

    if (!isUpdating) return null;

    const stateConfig = {
        downloading: {
            icon: <LucideDownload className="size-5 text-blue-400" />,
            iconBg: "bg-blue-500/10",
            title: "Descargando actualización...",
            accent: "text-blue-400",
            border: "border-blue-500/20",
            gradient: "from-blue-500/[0.08] to-transparent",
        },
        "ready-to-install": {
            icon: <LucideRocket className="size-5 text-green-400" />,
            iconBg: "bg-green-500/10",
            title: "¡Actualización lista!",
            accent: "text-green-400",
            border: "border-green-500/20",
            gradient: "from-green-500/[0.08] to-transparent",
        },
        error: {
            icon: <LucideAlertCircle className="size-5 text-red-400" />,
            iconBg: "bg-red-500/10",
            title: "Error en la actualización",
            accent: "text-red-400",
            border: "border-red-500/20",
            gradient: "from-red-500/[0.08] to-transparent",
        },
        checking: {
            icon: <LucideLoader2 className="size-5 animate-spin text-neutral-400" />,
            iconBg: "bg-neutral-500/10",
            title: "Buscando actualizaciones...",
            accent: "text-neutral-400",
            border: "border-white/10",
            gradient: "from-white/[0.03] to-transparent",
        },
    }[updateState as string] ?? {
        icon: <LucideLoader2 className="size-5 animate-spin text-neutral-400" />,
        iconBg: "bg-neutral-500/10",
        title: String(updateState),
        accent: "text-neutral-400",
        border: "border-white/10",
        gradient: "from-white/[0.03] to-transparent",
    };

    return (
        <div
            className={cn(
                "fixed bottom-6 right-6 z-50 w-80 rounded-2xl shadow-2xl border overflow-hidden transition-all duration-300",
                "bg-[#0a0a0a]",
                stateConfig.border,
                visible
                    ? "opacity-100 translate-y-0"
                    : "opacity-0 translate-y-4 pointer-events-none"
            )}
        >
            {/* Header with gradient */}
            <div className={cn("relative p-4 pb-3 border-b border-white/5 bg-gradient-to-b", stateConfig.gradient)}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={cn("flex items-center justify-center size-9 rounded-xl", stateConfig.iconBg)}>
                            {stateConfig.icon}
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-white">{stateConfig.title}</p>
                            {updateVersion && (
                                <p className="text-xs text-neutral-500 mt-0.5">
                                    v{updateVersion}
                                    {isSimulated && (
                                        <span className="ml-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                            Simulado
                                        </span>
                                    )}
                                </p>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={() => {
                            setVisible(false);
                            setTimeout(() => resetUpdate(), 200);
                        }}
                        className="flex items-center justify-center size-7 rounded-lg text-neutral-600 hover:text-neutral-400 hover:bg-white/5 transition-colors"
                    >
                        <LucideX className="size-3.5" />
                    </button>
                </div>
            </div>

            {/* Body */}
            <div className="p-4 space-y-3">
                {/* Progress bar (downloading) */}
                {updateState === "downloading" && (
                    <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-neutral-500">Progreso</span>
                            <span className="text-blue-400 font-medium">{progress}%</span>
                        </div>
                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all duration-300"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>
                )}

                {/* Ready to install */}
                {updateState === "ready-to-install" && (
                    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-green-500/5 border border-green-500/10">
                        <LucideCheckCircle2 className="size-4 text-green-400 flex-shrink-0" />
                        <span className="text-xs text-green-400/80">
                            Reinicia la aplicación para aplicar la actualización
                        </span>
                    </div>
                )}

                {/* Error */}
                {updateState === "error" && (
                    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-500/5 border border-red-500/10">
                        <LucideWifiOff className="size-4 text-red-400 flex-shrink-0" />
                        <span className="text-xs text-red-400/80">
                            Verifica tu conexión a internet e intenta de nuevo
                        </span>
                    </div>
                )}

                {/* Checking */}
                {updateState === "checking" && (
                    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-white/[0.02] border border-white/5">
                        <LucideRefreshCw className="size-4 text-neutral-500 animate-spin flex-shrink-0" />
                        <span className="text-xs text-neutral-500">
                            Comprobando si hay una nueva versión disponible...
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
};
