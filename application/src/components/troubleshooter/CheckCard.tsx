import { useState, memo, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LucideCheck, LucideX, LucideAlertTriangle, LucideLoader, LucideChevronDown, LucideWrench, LucideCopy, LucideCheckCheck } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";

export interface CheckResult {
    id: string;
    name: string;
    description: string;
    status: "pass" | "warn" | "fail" | "running";
    detail: string | null;
    technical: string | null;
    fixable: boolean;
}

interface CheckCardProps {
    check: CheckResult;
    onFixApplied?: (checkId: string) => void;
}

const statusConfig = {
    pass: { icon: LucideCheck, color: "text-emerald-400", bg: "bg-emerald-500/10", ring: "ring-emerald-500/20" },
    warn: { icon: LucideAlertTriangle, color: "text-amber-400", bg: "bg-amber-500/10", ring: "ring-amber-500/20" },
    fail: { icon: LucideX, color: "text-red-400", bg: "bg-red-500/10", ring: "ring-red-500/20" },
    running: { icon: LucideLoader, color: "text-blue-400", bg: "bg-blue-500/10", ring: "ring-blue-500/20" },
};

const fixIdMap: Record<string, string> = {
    java_configured: "fix_java",
    java_not_system: "fix_java_config",
    java_version_compatibility: "fix_java_version_compatibility",
    instances_dir: "fix_instances_dir",
    orphan_accounts: "fix_orphan_accounts",
    connectivity: "recheck_connection",
    jvm_memory_config: "fix_jvm_memory",
    macos_java_permissions: "fix_macos_java_permissions",
};

export const CheckCard = memo(({ check, onFixApplied }: CheckCardProps) => {
    const [isFixing, setIsFixing] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const [copied, setCopied] = useState(false);
    const config = statusConfig[check.status];
    const StatusIcon = config.icon;

    const handleFix = useCallback(async () => {
        const fixId = fixIdMap[check.id];
        if (!fixId) return;
        setIsFixing(true);
        try {
            const result = await invoke<string>("apply_troubleshooter_fix", { fixId });
            toast.success(result);
            onFixApplied?.(check.id);
        } catch (error) {
            toast.error(String(error));
        } finally {
            setIsFixing(false);
        }
    }, [check.id, onFixApplied]);

    const handleCopy = useCallback(async () => {
        const text = `[${check.name}] ${check.detail || "Sin detalle"}${check.technical ? `\n\`${check.technical}\`` : ""}`;
        await navigator.clipboard.writeText(text);
        setCopied(true);
        toast.success("Copiado al portapapeles");
        setTimeout(() => setCopied(false), 2000);
    }, [check]);

    return (
        <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
        >
            <Card className={`border-0 ring-1 ${config.ring} bg-card/60 backdrop-blur-sm`}>
                <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                        {/* Status icon */}
                        <div className={`flex-shrink-0 flex items-center justify-center size-9 rounded-xl ${config.bg} transition-colors`}>
                            <StatusIcon
                                className={`size-[18px] ${config.color} ${check.status === "running" ? "animate-spin" : ""}`}
                            />
                        </div>

                        {/* Text */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">{check.name}</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">{check.description}</p>
                            {check.detail && !expanded && (
                                <p className="text-xs text-muted-foreground/70 mt-1 truncate">{check.detail}</p>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1.5 shrink-0">
                            {/* Copy button */}
                            {check.status !== "running" && check.detail && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-7 text-muted-foreground hover:text-foreground"
                                    onClick={handleCopy}
                                >
                                    {copied ? (
                                        <LucideCheckCheck className="size-3.5 text-emerald-400" />
                                    ) : (
                                        <LucideCopy className="size-3.5" />
                                    )}
                                </Button>
                            )}

                            {/* Expand technical detail */}
                            {check.technical && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-7 text-muted-foreground hover:text-foreground"
                                    onClick={() => setExpanded(!expanded)}
                                >
                                    <motion.div
                                        animate={{ rotate: expanded ? 180 : 0 }}
                                        transition={{ duration: 0.15 }}
                                    >
                                        <LucideChevronDown className="size-3.5" />
                                    </motion.div>
                                </Button>
                            )}

                            {/* Fix button */}
                            {check.fixable && check.status !== "pass" && check.status !== "running" && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleFix}
                                    disabled={isFixing}
                                    className="h-7 text-xs gap-1.5 px-2.5"
                                >
                                    {isFixing ? (
                                        <LucideLoader className="size-3 animate-spin" />
                                    ) : (
                                        <LucideWrench className="size-3" />
                                    )}
                                    Reparar
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Expanded technical detail */}
                    <AnimatePresence>
                        {expanded && check.technical && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.15 }}
                                className="overflow-hidden"
                            >
                                <div className="mt-3 pt-3 border-t border-border/50">
                                    <pre className="text-[11px] text-muted-foreground font-mono whitespace-pre-wrap break-all leading-relaxed">
                                        {check.technical}
                                    </pre>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </CardContent>
            </Card>
        </motion.div>
    );
});
