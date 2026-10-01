import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LucideShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ArmoredViolationDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    file?: string | null;
}

export const ArmoredViolationDialog = ({
    open,
    onOpenChange,
    file,
}: ArmoredViolationDialogProps) => {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <div className="flex items-center gap-3">
                        <div className="bg-destructive/10 p-3 rounded-full">
                            <LucideShieldAlert className="h-6 w-6 text-destructive" />
                        </div>
                        <div>
                            <DialogTitle>Instancia blindada</DialogTitle>
                            <DialogDescription>
                                Modificación no autorizada detectada
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>
                <div className="space-y-3 text-sm">
                    <p>
                        Esta instancia está blindada y no se permiten modificaciones no autorizadas.
                        La instancia se ha cerrado forzosamente para proteger la integridad del modpack.
                    </p>
                    {file && (
                        <p className="rounded-md bg-muted px-3 py-2 font-mono text-xs break-all">
                            Archivo detectado: {file}
                        </p>
                    )}
                    <p className="text-muted-foreground">
                        Si crees que se trata de un error, contacta con el creador del modpack.
                    </p>
                </div>
                <div className="flex justify-end">
                    <Button onClick={() => onOpenChange(false)}>
                        Entendido
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};
