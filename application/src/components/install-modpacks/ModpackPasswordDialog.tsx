import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { LucideShieldAlert } from "lucide-react"
import { invoke } from "@tauri-apps/api/core"
import { toast } from "sonner"

interface PasswordDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    modpackId: string;
    modpackName: string;
}

export const PasswordDialog = ({
    isOpen,
    onClose,
    onSuccess,
    modpackId,
    modpackName,
}: PasswordDialogProps) => {
    const [password, setPassword] = useState<string>("");
    const [isValidating, setIsValidating] = useState(false);

    const handleConfirm = async () => {
        if (!password.trim()) {
            toast.error("Por favor ingresa la contraseña");
            return;
        }

        setIsValidating(true);

        try {
            const isValid = await invoke<boolean>('validate_modpack_password', {
                modpackId,
                password: password.trim()
            });

            if (isValid) {
                toast.success('Contraseña correcta');
                onSuccess();
                handleClose();
            } else {
                toast.error('Contraseña incorrecta');
            }
        } catch (error) {
            console.error('Error validating password:', error);
            toast.error('Error al validar la contraseña');
        } finally {
            setIsValidating(false);
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && password.trim() && !isValidating) {
            handleConfirm();
        }
    }

    // Limpiar el campo de contraseña cuando se cierra el diálogo
    const handleClose = () => {
        setPassword("");
        setIsValidating(false);
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => {
            if (!open) handleClose();
        }}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <div className="flex items-center gap-2 text-amber-500">
                        <LucideShieldAlert className="h-5 w-5" />
                        <DialogTitle>Modpack protegido</DialogTitle>
                    </div>
                    <DialogDescription>
                        El modpack <span className="font-medium">{modpackName}</span> está protegido por contraseña. Por favor ingresa la contraseña para continuar.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="password">Contraseña</Label>
                        <Input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Ingresa la contraseña"
                            autoComplete="off"
                            autoFocus
                            disabled={isValidating}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button
                        variant="secondary"
                        onClick={handleClose}
                        disabled={isValidating}
                    >
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={!password.trim() || isValidating}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white"
                    >
                        {isValidating ? "Validando..." : "Continuar"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}