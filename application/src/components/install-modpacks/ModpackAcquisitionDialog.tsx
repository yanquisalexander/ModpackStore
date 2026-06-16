import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    LucideLoader2,
    LucideLock,
    LucideGift,
} from "lucide-react";
import { MdiTwitch } from "@/icons/MdiTwitch";
import { toast } from "sonner";
import { useAuthentication } from "@/stores/AuthContext";
import { API_ENDPOINT } from "@/consts";
import { cn } from "@/lib/utils";
import { motion } from "motion/react";

type AcquisitionMethod = 'free' | 'password' | 'twitch_sub';

interface ModpackAcquisitionDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    modpack: {
        id: string;
        name: string;
        acquisitionMethod: AcquisitionMethod;
        requiresTwitchSubscription?: boolean;
    };
}

const getMethodTheme = (method: AcquisitionMethod) => {
    switch (method) {
        case 'password':
            return {
                color: "text-orange-500",
                bg: "bg-orange-500/10",
                border: "border-orange-500/20",
                icon: LucideLock,
                title: "Acceso Protegido",
                desc: "Ingresa la clave para desbloquear este modpack.",
            };
        case 'twitch_sub':
            return {
                color: "text-purple-500",
                bg: "bg-purple-500/10",
                border: "border-purple-500/20",
                icon: MdiTwitch,
                title: "Beneficio de Suscriptor",
                desc: "Exclusivo para suscriptores de Twitch.",
            };
        case 'free':
        default:
            return {
                color: "text-green-500",
                bg: "bg-green-500/10",
                border: "border-green-500/20",
                icon: LucideGift,
                title: "Contenido Gratuito",
                desc: "Añade este modpack a tu biblioteca.",
            };
    }
};

export const ModpackAcquisitionDialog = ({
    isOpen,
    onClose,
    onSuccess,
    modpack,
}: ModpackAcquisitionDialogProps) => {
    const [isProcessing, setIsProcessing] = useState(false);
    const [password, setPassword] = useState("");
    const { sessionTokens } = useAuthentication();

    const theme = getMethodTheme(modpack.acquisitionMethod);

    const handleClose = () => {
        setPassword("");
        setIsProcessing(false);
        onClose();
    };

    const handleAcquisition = useCallback(async () => {
        setIsProcessing(true);
        try {
            const headers = {
                'Authorization': `Bearer ${sessionTokens?.accessToken}`,
                'Content-Type': 'application/json',
            };

            switch (modpack.acquisitionMethod) {
                case 'password': {
                    if (!password.trim()) {
                        toast.error("Ingresa la contraseña");
                        setIsProcessing(false);
                        return;
                    }
                    const res = await fetch(
                        `${API_ENDPOINT}/explore/modpacks/${modpack.id}/acquire/password`,
                        {
                            method: 'POST',
                            headers,
                            body: JSON.stringify({ password: password.trim() }),
                        },
                    );
                    if (res.ok) {
                        toast.success('¡Acceso concedido!');
                        onSuccess();
                        handleClose();
                    } else {
                        const err = await res.json();
                        toast.error(err.errors?.[0]?.detail || 'Contraseña incorrecta');
                    }
                    break;
                }

                case 'free': {
                    const res = await fetch(
                        `${API_ENDPOINT}/explore/modpacks/${modpack.id}/acquire/free`,
                        { method: 'POST', headers },
                    );
                    if (res.ok) {
                        toast.success('¡Añadido a tu biblioteca!');
                        onSuccess();
                        handleClose();
                    } else {
                        const err = await res.json();
                        toast.error(err.errors?.[0]?.detail || 'Error al adquirir');
                    }
                    break;
                }

                case 'twitch_sub': {
                    const res = await fetch(
                        `${API_ENDPOINT}/explore/modpacks/${modpack.id}/acquire/twitch`,
                        { method: 'POST', headers },
                    );
                    if (res.ok) {
                        toast.success('¡Suscripción verificada!');
                        onSuccess();
                        handleClose();
                    } else {
                        const err = await res.json();
                        toast.error(err.errors?.[0]?.detail || 'No se detectó una suscripción válida');
                    }
                    break;
                }
            }
        } catch (error) {
            console.error(error);
            toast.error('Ocurrió un error inesperado');
        } finally {
            setIsProcessing(false);
        }
    }, [modpack, password, sessionTokens, onSuccess]);

    const renderContent = () => {
        return (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-6"
            >
                {modpack.acquisitionMethod === 'password' && (
                    <div className="space-y-3">
                        <Label className="text-orange-400 font-medium">Contraseña de acceso</Label>
                        <div className="relative group">
                            <LucideLock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 group-focus-within:text-orange-500 transition-colors" />
                            <Input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleAcquisition()}
                                placeholder="Ingresa la clave..."
                                className="pl-10 bg-neutral-950 border-neutral-800 focus:border-orange-500/50 focus:ring-orange-500/20 transition-all h-12"
                                autoFocus
                            />
                        </div>
                    </div>
                )}

                {modpack.acquisitionMethod === 'twitch_sub' && (
                    <div className="bg-[#9146FF]/10 border border-[#9146FF]/30 p-5 rounded-xl flex items-start gap-4">
                        <div className="p-2 bg-[#9146FF]/20 rounded-lg">
                            <MdiTwitch className="w-6 h-6 text-[#9146FF]" />
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm text-white font-bold">Verificación de Suscriptor</p>
                            <p className="text-xs text-[#d3b8ff]">
                                Verificaremos automáticamente si tu cuenta de Twitch vinculada está suscrita al canal del creador.
                            </p>
                        </div>
                    </div>
                )}
            </motion.div>
        );
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-md bg-[#0a0a0a] border-neutral-800 p-0 overflow-hidden gap-0 shadow-2xl">
                <div className={cn("relative p-6 pb-8 border-b", theme.bg, theme.border)}>
                    <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]" />

                    <DialogHeader className="relative z-10 space-y-4">
                        <div className="flex items-center justify-between">
                            <div className={cn("p-2.5 rounded-xl inline-flex shadow-lg ring-1 ring-white/10", theme.bg, theme.color)}>
                                <theme.icon className="w-6 h-6" />
                            </div>
                        </div>
                        <div>
                            <DialogTitle className={cn("text-2xl font-bold tracking-tight mb-1", theme.color)}>
                                {theme.title}
                            </DialogTitle>
                            <DialogDescription className="text-neutral-400 font-medium">
                                {theme.desc}
                            </DialogDescription>
                        </div>
                    </DialogHeader>
                </div>

                <div className="p-6 min-h-[180px] bg-[#0a0a0a]">
                    {renderContent()}
                </div>

                <DialogFooter className="p-6 pt-2 bg-[#0a0a0a] sm:justify-between gap-3">
                    <Button
                        variant="ghost"
                        onClick={handleClose}
                        className="text-neutral-500 hover:text-white hover:bg-white/5 transition-colors"
                    >
                        Cancelar
                    </Button>

                    <Button
                        onClick={handleAcquisition}
                        disabled={
                            isProcessing ||
                            (modpack.acquisitionMethod === 'password' && !password)
                        }
                        className={cn(
                            "min-w-[140px] font-bold shadow-lg transition-all border border-transparent",
                            isProcessing ? "opacity-80 cursor-not-allowed" : "hover:scale-[1.02] hover:shadow-xl",
                            theme.color.includes('orange') ? "bg-orange-600 hover:bg-orange-500 text-white" :
                                theme.color.includes('purple') ? "bg-[#9146FF] hover:bg-[#7c2cf5] text-white" :
                                    "bg-green-600 hover:bg-green-500 text-white"
                        )}
                    >
                        {isProcessing ? (
                            <>
                                <LucideLoader2 className="w-4 h-4 mr-2 animate-spin" />
                                Procesando
                            </>
                        ) : (
                            <>
                                {modpack.acquisitionMethod === 'password' ? 'Desbloquear' :
                                    modpack.acquisitionMethod === 'twitch_sub' ? 'Verificar' : 'Obtener'}
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};