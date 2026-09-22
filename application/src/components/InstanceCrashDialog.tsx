import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CrashDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    exitCode: number;
    errorMessage: string;
    data: any;
    onViewCrashReport?: () => void;
    onSendCrashReport?: () => void;
}

function useCopyState() {
    const [copied, setCopied] = useState(false);
    useEffect(() => {
        if (!copied) return;
        const t = setTimeout(() => setCopied(false), 2000);
        return () => clearTimeout(t);
    }, [copied]);
    return [copied, setCopied] as const;
}

export const InstanceCrashDialog = ({
    open,
    onOpenChange,
    exitCode,
    errorMessage,
    data,
}: CrashDialogProps) => {
    const [copiedReport, setCopiedReport] = useCopyState();
    const [copiedCode, setCopiedCode] = useCopyState();

    const crashReport: string | null = data?.crashReport ?? null;
    const errorCode: string | null = data?.detectedError?.code ?? null;

    const fullCopyText = [
        `Exit code: ${exitCode}`,
        errorCode ? `Error code: ${errorCode}` : null,
        errorMessage ? `Message: ${errorMessage}` : null,
        crashReport ? `\n--- Crash report ---\n${crashReport}` : null,
    ]
        .filter(Boolean)
        .join("\n");

    const copyReport = () => {
        navigator.clipboard.writeText(fullCopyText);
        setCopiedReport(true);
        toast.success("Reporte de crash copiado al portapapeles");
    };

    const copyExitCode = () => {
        navigator.clipboard.writeText(exitCode.toString());
        setCopiedCode(true);
        toast.success("Código de salida copiado");
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="bg-neutral-900 text-white border-none max-w-max sm:max-w-[600px] w-full">
                <DialogHeader className="text-center">
                    <DialogTitle className="text-sm font-normal text-center text-zinc-400">ERROR</DialogTitle>
                    <DialogTitle className="text-2xl font-semibold text-center mb-1">Game crashed</DialogTitle>
                    <DialogDescription className="text-zinc-300 text-center text-sm">
                        An unexpected issue occurred and the game has crashed.
                    </DialogDescription>
                </DialogHeader>

                {/* Error code badge */}
                {errorCode && (
                    <div className="flex justify-center">
                        <code className="text-red-400 text-xs bg-red-950/40 border border-red-900/50 px-2 py-1 rounded select-text">
                            {errorCode}
                        </code>
                    </div>
                )}

                {/* Error message */}
                {errorMessage && (
                    <p className="text-center text-zinc-300 text-sm select-text px-1">
                        {errorMessage}
                    </p>
                )}

                {/* Exit code row */}
                <div className="flex items-center justify-center gap-2 text-sm text-zinc-400">
                    <span>
                        Exit code:{" "}
                        <span className="font-mono text-zinc-200 select-text">{exitCode}</span>
                    </span>
                    <button
                        onClick={copyExitCode}
                        className="text-zinc-500 hover:text-zinc-200 transition-colors"
                        title="Copiar código de salida"
                    >
                        {copiedCode ? (
                            <Check className="size-3.5 text-green-400" />
                        ) : (
                            <Copy className="size-3.5" />
                        )}
                    </button>
                </div>

                {/* Crash report log */}
                {crashReport && (
                    <div className="mt-1">
                        <p className="text-xs text-zinc-500 mb-1">Log del crash:</p>
                        <pre className="font-mono bg-neutral-800 text-xs text-zinc-300 p-3 rounded overflow-x-auto max-h-52 overflow-y-auto whitespace-pre-wrap break-all select-text cursor-text">
                            {crashReport}
                        </pre>
                    </div>
                )}

                {/* Copy full report button */}
                <div className="flex justify-center pt-1">
                    <Button
                        variant="outline"
                        size="sm"
                        className="bg-neutral-800 hover:bg-neutral-700 text-zinc-200 border-neutral-700 gap-2"
                        onClick={copyReport}
                    >
                        {copiedReport ? (
                            <Check className="size-4 text-green-400" />
                        ) : (
                            <Copy className="size-4" />
                        )}
                        {copiedReport ? "Copiado" : "Copiar reporte completo"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};
