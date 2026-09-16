import { memo, useMemo } from "react";
import { motion } from "motion/react";
import { Badge } from "@/components/ui/badge";
import { LucideCheck, LucideX, LucideAlertTriangle, LucideLoader } from "lucide-react";
import type { CheckResult } from "./CheckCard";

interface SummaryBarProps {
    checks: CheckResult[];
    isRunning: boolean;
}

export const SummaryBar = memo(({ checks, isRunning }: SummaryBarProps) => {
    const counts = useMemo(() => {
        const pass = checks.filter((c) => c.status === "pass").length;
        const warn = checks.filter((c) => c.status === "warn").length;
        const fail = checks.filter((c) => c.status === "fail").length;
        const running = checks.filter((c) => c.status === "running").length;
        return { pass, warn, fail, running };
    }, [checks]);

    const total = checks.length;
    const completed = counts.pass + counts.warn + counts.fail;
    const progress = total > 0 ? (completed / total) * 100 : 0;

    return (
        <div className="space-y-3">
            {/* Progress bar */}
            <div className="relative h-1.5 w-full bg-muted/30 rounded-full overflow-hidden">
                <motion.div
                    className="absolute inset-y-0 left-0 bg-primary/60 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                />
                {isRunning && (
                    <motion.div
                        className="absolute inset-y-0 left-0 bg-primary/40 rounded-full"
                        animate={{ width: ["0%", "100%", "0%"] }}
                        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                        style={{ width: "30%" }}
                    />
                )}
            </div>

            {/* Count badges */}
            <div className="flex items-center gap-2 flex-wrap">
                {isRunning && (
                    <Badge variant="outline" className="text-xs gap-1 text-blue-400 border-blue-500/30">
                        <LucideLoader className="size-3 animate-spin" />
                        Verificando...
                    </Badge>
                )}
                {counts.pass > 0 && (
                    <Badge variant="outline" className="text-xs gap-1 text-emerald-400 border-emerald-500/30">
                        <LucideCheck className="size-3" />
                        {counts.pass} OK
                    </Badge>
                )}
                {counts.warn > 0 && (
                    <Badge variant="outline" className="text-xs gap-1 text-amber-400 border-amber-500/30">
                        <LucideAlertTriangle className="size-3" />
                        {counts.warn} {counts.warn === 1 ? "Advertencia" : "Advertencias"}
                    </Badge>
                )}
                {counts.fail > 0 && (
                    <Badge variant="outline" className="text-xs gap-1 text-red-400 border-red-500/30">
                        <LucideX className="size-3" />
                        {counts.fail} {counts.fail === 1 ? "Error" : "Errores"}
                    </Badge>
                )}
                {!isRunning && completed > 0 && (
                    <span className="text-xs text-muted-foreground ml-auto">
                        {completed}/{total} verificados
                    </span>
                )}
            </div>
        </div>
    );
});
