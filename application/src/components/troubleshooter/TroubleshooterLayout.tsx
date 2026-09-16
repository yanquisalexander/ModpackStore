import { useState, useCallback, useEffect, useRef, memo } from "react";
import { AnimatePresence } from "motion/react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { LucideRefreshCw, LucideLoader, LucideStethoscope, LucideCopy, LucideCheckCheck } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { toast } from "sonner";
import { CheckCard, type CheckResult } from "./CheckCard";

interface TroubleshooterResult {
    checks: CheckResult[];
    timestamp: string;
    app_version: string;
    os: string;
}

const TroubleshooterSidebar = memo(({
    checks,
    isRunning,
    onRerun,
    result,
}: {
    checks: CheckResult[];
    isRunning: boolean;
    onRerun: () => void;
    result: TroubleshooterResult | null;
}) => {
    const [copiedAll, setCopiedAll] = useState(false);

    const passCount = checks.filter((c) => c.status === "pass").length;
    const warnCount = checks.filter((c) => c.status === "warn").length;
    const failCount = checks.filter((c) => c.status === "fail").length;
    const total = checks.length;

    const overallStatus = failCount > 0 ? "fail" : warnCount > 0 ? "warn" : total === 0 ? "running" : "pass";

    const handleCopyAll = useCallback(async () => {
        if (!result) return;

        const lines: string[] = [
            `**ModpackStore Diagnostico** — ${result.os} — v${result.app_version}`,
            `Fecha: ${result.timestamp}`,
            "",
        ];

        for (const check of result.checks) {
            const icon = check.status === "pass" ? "✅" : check.status === "warn" ? "⚠️" : "❌";
            lines.push(`${icon} **${check.name}**: ${check.detail || "Sin detalle"}`);
            if (check.technical) {
                lines.push(`\`\`\`${check.technical}\`\`\``);
            }
        }

        await navigator.clipboard.writeText(lines.join("\n"));
        setCopiedAll(true);
        toast.success("Diagnostico copiado — pegalo en Discord");
        setTimeout(() => setCopiedAll(false), 2000);
    }, [result]);

    return (
        <Card className="h-fit">
            <CardContent className="p-5">
                <div className="space-y-5">
                    {/* Header */}
                    <div className="flex items-center gap-2.5">
                        <div className="flex items-center justify-center size-9 rounded-xl bg-primary/10">
                            <LucideStethoscope className="size-[18px] text-primary" />
                        </div>
                        <div>
                            <h2 className="text-sm font-semibold">Diagnostico</h2>
                            <p className="text-[11px] text-muted-foreground">Launcher</p>
                        </div>
                    </div>

                    <Separator />

                    {/* Stats grid */}
                    {total > 0 && (
                        <div className="grid grid-cols-3 gap-2">
                            <div className="flex flex-col items-center py-2.5 rounded-lg bg-emerald-500/5 ring-1 ring-emerald-500/10">
                                <span className="text-xl font-bold text-emerald-400 tabular-nums">{passCount}</span>
                                <span className="text-[10px] text-muted-foreground font-medium">OK</span>
                            </div>
                            <div className="flex flex-col items-center py-2.5 rounded-lg bg-amber-500/5 ring-1 ring-amber-500/10">
                                <span className="text-xl font-bold text-amber-400 tabular-nums">{warnCount}</span>
                                <span className="text-[10px] text-muted-foreground font-medium">Warn</span>
                            </div>
                            <div className="flex flex-col items-center py-2.5 rounded-lg bg-red-500/5 ring-1 ring-red-500/10">
                                <span className="text-xl font-bold text-red-400 tabular-nums">{failCount}</span>
                                <span className="text-[10px] text-muted-foreground font-medium">Error</span>
                            </div>
                        </div>
                    )}

                    {/* Overall status badge */}
                    {total > 0 && !isRunning && (
                        <div className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium ${
                            overallStatus === "pass"
                                ? "bg-emerald-500/10 text-emerald-400"
                                : overallStatus === "warn"
                                ? "bg-amber-500/10 text-amber-400"
                                : "bg-red-500/10 text-red-400"
                        }`}>
                            {overallStatus === "pass" ? "Todo esta bien" : overallStatus === "warn" ? "Hay advertencias" : "Se encontraron problemas"}
                        </div>
                    )}

                    <Separator />

                    {/* Copy for Discord */}
                    <Button
                        variant="outline"
                        className="w-full gap-2"
                        onClick={handleCopyAll}
                        disabled={!result || isRunning}
                    >
                        {copiedAll ? (
                            <LucideCheckCheck className="size-4 text-emerald-400" />
                        ) : (
                            <LucideCopy className="size-4" />
                        )}
                        {copiedAll ? "Copiado!" : "Copiar para Discord"}
                    </Button>

                    {/* Re-run */}
                    <Button
                        variant="ghost"
                        className="w-full gap-2 text-muted-foreground"
                        onClick={onRerun}
                        disabled={isRunning}
                    >
                        {isRunning ? (
                            <LucideLoader className="size-4 animate-spin" />
                        ) : (
                            <LucideRefreshCw className="size-4" />
                        )}
                        {isRunning ? "Verificando..." : "Volver a verificar"}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
});

export const TroubleshooterLayout = () => {
    const [checks, setChecks] = useState<CheckResult[]>([]);
    const [isRunning, setIsRunning] = useState(false);
    const [result, setResult] = useState<TroubleshooterResult | null>(null);
    const unlistenRef = useRef<Promise<() => void>>(null);

    const runDiagnostic = useCallback(async () => {
        setChecks([]);
        setResult(null);
        setIsRunning(true);
        try {
            const res = await invoke<TroubleshooterResult>("run_troubleshooter");
            setResult(res);
        } catch (error) {
            console.error("Error running troubleshooter:", error);
            toast.error("Error al ejecutar el diagnostico");
        } finally {
            setIsRunning(false);
        }
    }, []);

    useEffect(() => {
        const setup = async () => {
            unlistenRef.current = listen<CheckResult>("troubleshooter_check_complete", (event) => {
                setChecks((prev) => {
                    const existing = prev.findIndex((c) => c.id === event.payload.id);
                    if (existing >= 0) {
                        const next = [...prev];
                        next[existing] = event.payload;
                        return next;
                    }
                    return [...prev, event.payload];
                });
            });

            const unlistenFinished = await listen("troubleshooter_finished", () => {
                setIsRunning(false);
            });

            return () => {
                unlistenRef.current?.then((unlisten) => unlisten());
                unlistenFinished();
            };
        };

        const cleanup = setup();
        return () => {
            cleanup.then((fn) => fn());
        };
    }, []);

    useEffect(() => {
        runDiagnostic();
    }, [runDiagnostic]);

    const handleFixApplied = useCallback((_checkId: string) => {
        runDiagnostic();
    }, [runDiagnostic]);

    return (
        <div className="flex h-full">
            {/* Sidebar */}
            <div className="w-64 shrink-0 p-4 overflow-y-auto">
                <TroubleshooterSidebar
                    checks={checks}
                    isRunning={isRunning}
                    onRerun={runDiagnostic}
                    result={result}
                />
            </div>

            {/* Main Content */}
            <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden">
                {/* Checks list — scrollable */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    <AnimatePresence mode="popLayout">
                        {checks.map((check) => (
                            <CheckCard
                                key={check.id}
                                check={check}
                                onFixApplied={handleFixApplied}
                            />
                        ))}
                    </AnimatePresence>

                    {isRunning && checks.length === 0 && (
                        <div className="flex items-center justify-center py-20">
                            <div className="flex flex-col items-center gap-3">
                                <LucideLoader className="size-7 animate-spin text-primary" />
                                <p className="text-sm text-muted-foreground">Verificando...</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
