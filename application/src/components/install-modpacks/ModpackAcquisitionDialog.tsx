import { useState, useEffect, useCallback } from "react";
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
    LucideShieldAlert,
    LucideCreditCard,
    LucideExternalLink,
    LucideLoader2,
    LucideCopy,
    LucideCheckCircle2,
    LucideXCircle,
    LucideInfo,
    LucideLock,
    LucideGift,
    LucideWallet
} from "lucide-react";
import { MdiTwitch } from "@/icons/MdiTwitch";
import { toast } from "sonner";
import { useAuthentication } from "@/stores/AuthContext";
import { API_ENDPOINT } from "@/consts";
import { useRealtimeContext } from "@/providers/RealtimeProvider";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "motion/react";

// --- TIPOS ---
type AcquisitionMethod = 'free' | 'paid' | 'password' | 'twitch_sub';

interface ModpackAcquisitionDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    modpack: {
        id: string;
        name: string;
        acquisitionMethod: AcquisitionMethod;
        price?: string;
        requiresTwitchSubscription?: boolean;
    };
}

interface PaymentResponse {
    success: boolean;
    isFree?: boolean;
    paymentId?: string;
    approvalUrl?: string;
    qrCodeUrl?: string;
    gatewayType?: string;
    amount?: string;
    status?: string;
}

// --- HELPER DE ESTILOS ---
const getMethodTheme = (method: AcquisitionMethod) => {
    switch (method) {
        case 'password':
            return {
                color: "text-orange-500",
                bg: "bg-orange-500/10",
                border: "border-orange-500/20",
                icon: LucideLock,
                title: "Acceso Protegido",
                desc: "Ingresa la clave para desbloquear este modpack."
            };
        case 'paid':
            return {
                color: "text-blue-500",
                bg: "bg-blue-500/10",
                border: "border-blue-500/20",
                icon: LucideCreditCard,
                title: "Compra Única",
                desc: "Adquiere la licencia de este contenido."
            };
        case 'twitch_sub':
            return {
                color: "text-purple-500",
                bg: "bg-purple-500/10",
                border: "border-purple-500/20",
                icon: MdiTwitch,
                title: "Beneficio de Suscriptor",
                desc: "Exclusivo para suscriptores de Twitch."
            };
        case 'free':
        default:
            return {
                color: "text-green-500",
                bg: "bg-green-500/10",
                border: "border-green-500/20",
                icon: LucideGift,
                title: "Contenido Gratuito",
                desc: "Añade este modpack a tu biblioteca."
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
    const [selectedGateway, setSelectedGateway] = useState<string | null>(null);
    const [paymentData, setPaymentData] = useState<PaymentResponse | null>(null);
    const [copiedUrl, setCopiedUrl] = useState(false);
    const { sessionTokens } = useAuthentication();
    const { isConnected, on } = useRealtimeContext();

    const theme = getMethodTheme(modpack.acquisitionMethod);

    const handleClose = () => {
        setPassword("");
        setSelectedGateway(null);
        setPaymentData(null);
        setCopiedUrl(false);
        setIsProcessing(false);
        onClose();
    };

    const copyToClipboard = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedUrl(true);
            toast.success("Enlace copiado");
            setTimeout(() => setCopiedUrl(false), 2000);
        } catch {
            toast.error("Error al copiar");
        }
    };

    // --- LOGICA DE ADQUISICIÓN ---
    const handleAcquisition = useCallback(async () => {
        setIsProcessing(true);
        try {
            let response;
            switch (modpack.acquisitionMethod) {
                case 'password':
                    if (!password.trim()) {
                        toast.error("Ingresa la contraseña");
                        setIsProcessing(false);
                        return;
                    }
                    response = await fetch(`${API_ENDPOINT}/explore/modpacks/${modpack.id}/validate-password`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionTokens?.accessToken}` },
                        body: JSON.stringify({ password: password.trim() }),
                    });
                    const passData = await response.json();
                    if (response.ok && passData.valid) {
                        toast.success('¡Acceso concedido!');
                        onSuccess();
                        handleClose();
                    } else {
                        toast.error(passData.message || 'Contraseña incorrecta');
                    }
                    break;

                case 'paid':
                case 'free':
                    if (modpack.acquisitionMethod === 'paid' && !selectedGateway) {
                        toast.error("Selecciona un método de pago");
                        setIsProcessing(false);
                        return;
                    }
                    response = await fetch(`${API_ENDPOINT}/explore/modpacks/${modpack.id}/acquire/purchase`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionTokens?.accessToken}` },
                        body: JSON.stringify({ gatewayType: selectedGateway }),
                    });
                    const payData: PaymentResponse = await response.json();
                    if (response.ok && payData.success) {
                        if (modpack.acquisitionMethod === 'free') {
                            toast.success('¡Añadido a tu biblioteca!');
                            onSuccess();
                            handleClose();
                        } else {
                            setPaymentData(payData);
                        }
                    } else {
                        toast.error('Error al iniciar la transacción');
                    }
                    break;

                case 'twitch_sub':
                    response = await fetch(`${API_ENDPOINT}/explore/modpacks/${modpack.id}/acquire/twitch`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${sessionTokens?.accessToken}` },
                    });
                    const twitchData = await response.json();
                    if (response.ok && twitchData.success) {
                        toast.success('¡Suscripción verificada!');
                        onSuccess();
                        handleClose();
                    } else {
                        toast.error(twitchData.message || 'No se detectó una suscripción válida');
                    }
                    break;
            }
        } catch (error) {
            console.error(error);
            toast.error('Ocurrió un error inesperado');
        } finally {
            if (modpack.acquisitionMethod !== 'paid') setIsProcessing(false);
            if (modpack.acquisitionMethod === 'paid' && !paymentData) setIsProcessing(false);
        }
    }, [modpack, password, selectedGateway, sessionTokens, onSuccess]);

    // --- REALTIME PAYMENT ---
    useEffect(() => {
        if (!paymentData?.paymentId || !isConnected) return;

        const handleUpdate = (payload: any) => {
            if (payload.paymentId !== paymentData.paymentId) return;
            setPaymentData(prev => prev ? { ...prev, status: payload.status } : null);

            if (payload.status === 'completed') {
                toast.success('¡Pago exitoso!');
                setTimeout(() => { onSuccess(); handleClose(); }, 2500);
            } else if (payload.status === 'failed') {
                toast.error('El pago ha fallado');
            }
        };

        const unsubCompleted = on('payment_completed', handleUpdate);
        const unsubProcessing = on('payment_processing', handleUpdate);
        const unsubFailed = on('payment_failed', handleUpdate);

        return () => { unsubCompleted(); unsubProcessing(); unsubFailed(); };
    }, [paymentData?.paymentId, isConnected, on, onSuccess]);


    // --- RENDER CONTENT ---
    const renderContent = () => {
        // 1. ESTADO DE PAGO EN PROGRESO
        if (paymentData && modpack.acquisitionMethod === 'paid') {
            const statusConfig = {
                completed: { text: 'Pago Completado', color: 'text-green-500', bg: 'bg-green-500/10', border: 'border-green-500/20', icon: LucideCheckCircle2 },
                failed: { text: 'Pago Fallido', color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/20', icon: LucideXCircle },
                processing: { text: 'Verificando...', color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/20', icon: LucideLoader2 },
                pending: { text: 'Esperando Pago', color: 'text-yellow-500', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', icon: LucideInfo },
            };
            // @ts-ignore
            const currentStatus = statusConfig[paymentData.status || 'pending'];
            const StatusIcon = currentStatus.icon;

            return (
                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                >
                    {/* Status Banner */}
                    <div className={cn("flex items-center gap-3 p-4 rounded-xl border", currentStatus.bg, currentStatus.border)}>
                        <StatusIcon className={cn("w-6 h-6", currentStatus.color, paymentData.status === 'processing' && "animate-spin")} />
                        <div>
                            <p className={cn("font-bold", currentStatus.color)}>{currentStatus.text}</p>
                            <p className="text-xs text-muted-foreground">Gateway: {paymentData.gatewayType?.toUpperCase()}</p>
                        </div>
                        <div className="ml-auto text-xl font-bold text-white">
                            ${paymentData.amount}
                        </div>
                    </div>

                    {/* QR & Action Area */}
                    <div className="flex flex-col md:flex-row gap-6">
                        {(paymentData.qrCodeUrl || paymentData.approvalUrl) && (
                            <div className="flex-1 bg-white p-4 rounded-xl flex items-center justify-center shadow-lg">
                                <img
                                    src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(paymentData.qrCodeUrl || paymentData.approvalUrl || '')}&format=png`}
                                    alt="QR Pago"
                                    className="w-full max-w-[140px] h-auto object-contain mix-blend-multiply"
                                />
                            </div>
                        )}

                        <div className="flex-1 flex flex-col justify-center gap-3">
                            <div className="text-sm text-neutral-400 mb-2">
                                <p>1. Escanea el QR con tu celular.</p>
                                <p>2. O usa el botón directo.</p>
                            </div>

                            <Button
                                onClick={() => window.open(paymentData?.approvalUrl, '_blank')}
                                className="w-full bg-blue-600 hover:bg-blue-500 text-white"
                            >
                                <LucideExternalLink className="w-4 h-4 mr-2" />
                                Pagar Ahora
                            </Button>

                            <Button variant="outline" onClick={() => copyToClipboard(paymentData?.approvalUrl || '')} className="w-full border-neutral-800 hover:bg-neutral-800">
                                <LucideCopy className="w-4 h-4 mr-2" />
                                {copiedUrl ? 'Copiado' : 'Copiar Link'}
                            </Button>
                        </div>
                    </div>
                </motion.div>
            );
        }

        // 2. FORMULARIO INICIAL (INPUTS)
        return (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-6"
            >
                {/* PASSWORD INPUT */}
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

                {/* PAID GATEWAY SELECTION */}
                {modpack.acquisitionMethod === 'paid' && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <Label className="text-neutral-300">Método de pago</Label>
                            <span className="text-xs font-bold text-green-400 bg-green-500/10 px-2 py-1 rounded border border-green-500/20">
                                Total: ${modpack.price} USD
                            </span>
                        </div>

                        <div className="grid grid-cols-1 gap-3">
                            <button
                                onClick={() => setSelectedGateway('paypal')}
                                className={cn(
                                    "flex items-center gap-4 p-4 rounded-xl border transition-all duration-200 group relative overflow-hidden text-left",
                                    selectedGateway === 'paypal'
                                        ? "border-blue-500 bg-blue-500/10 ring-1 ring-blue-500/50"
                                        : "border-neutral-800 bg-neutral-900/50 hover:bg-neutral-800 hover:border-neutral-700"
                                )}
                            >
                                <div className="p-2 bg-white rounded-lg shrink-0">
                                    <img src="https://www.paypalobjects.com/webstatic/icon/pp258.png" className="w-6 h-6 object-contain" alt="PayPal" />
                                </div>
                                <div>
                                    <div className="font-bold text-white group-hover:text-blue-400 transition-colors">PayPal</div>
                                    <div className="text-xs text-neutral-500">Saldo, Tarjetas de crédito/débito</div>
                                </div>
                                {selectedGateway === 'paypal' && (
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                        <div className="w-4 h-4 bg-blue-500 rounded-full shadow-[0_0_10px_#3b82f6] animate-pulse" />
                                    </div>
                                )}
                            </button>

                            <button
                                disabled
                                className="flex items-center gap-4 p-4 rounded-xl border border-neutral-800 bg-neutral-900/30 opacity-50 cursor-not-allowed grayscale"
                            >
                                <div className="p-2 bg-neutral-800 rounded-lg shrink-0">
                                    <LucideWallet className="w-6 h-6 text-neutral-500" />
                                </div>
                                <div>
                                    <div className="font-bold text-neutral-400">MercadoPago</div>
                                    <div className="text-xs text-neutral-600">No disponible temporalmente</div>
                                </div>
                            </button>
                        </div>
                    </div>
                )}

                {/* TWITCH MESSAGE */}
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
            {/* Contenido Sin Bordes/Padding Extra para Fluidez Visual */}
            <DialogContent className="sm:max-w-md bg-[#0a0a0a] border-neutral-800 p-0 overflow-hidden gap-0 shadow-2xl">

                {/* HEADER */}
                <div className={cn("relative p-6 pb-8 border-b", theme.bg, theme.border)}>
                    {/* Patrón de fondo sutil */}
                    <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]" />

                    <DialogHeader className="relative z-10 space-y-4">
                        <div className="flex items-center justify-between">
                            <div className={cn("p-2.5 rounded-xl inline-flex shadow-lg ring-1 ring-white/10", theme.bg, theme.color)}>
                                <theme.icon className="w-6 h-6" />
                            </div>
                            {modpack.price && modpack.acquisitionMethod === 'paid' && !paymentData && (
                                <div className="text-xl font-black tracking-tight text-white tabular-nums">
                                    ${modpack.price}
                                </div>
                            )}
                        </div>
                        <div>
                            <DialogTitle className={cn("text-2xl font-bold tracking-tight mb-1", theme.color)}>
                                {paymentData ? 'Finalizar Pago' : theme.title}
                            </DialogTitle>
                            <DialogDescription className="text-neutral-400 font-medium">
                                {paymentData ? 'Completa la transacción para desbloquear.' : theme.desc}
                            </DialogDescription>
                        </div>
                    </DialogHeader>
                </div>

                {/* BODY (Con min-height para evitar saltos) */}
                <div className="p-6 min-h-[180px] bg-[#0a0a0a]">
                    <AnimatePresence mode="wait">
                        {renderContent()}
                    </AnimatePresence>
                </div>

                {/* FOOTER (Unificado con el body) */}
                <DialogFooter className="p-6 pt-2 bg-[#0a0a0a] sm:justify-between gap-3">
                    <Button
                        variant="ghost"
                        onClick={handleClose}
                        className="text-neutral-500 hover:text-white hover:bg-white/5 transition-colors"
                    >
                        {paymentData ? 'Cerrar' : 'Cancelar'}
                    </Button>

                    {!paymentData && (
                        <Button
                            onClick={handleAcquisition}
                            disabled={
                                isProcessing ||
                                (modpack.acquisitionMethod === 'password' && !password) ||
                                (modpack.acquisitionMethod === 'paid' && !selectedGateway)
                            }
                            className={cn(
                                "min-w-[140px] font-bold shadow-lg transition-all border border-transparent",
                                isProcessing ? "opacity-80 cursor-not-allowed" : "hover:scale-[1.02] hover:shadow-xl",
                                // Botones temáticos
                                theme.color.includes('orange') ? "bg-orange-600 hover:bg-orange-500 text-white" :
                                    theme.color.includes('blue') ? "bg-blue-600 hover:bg-blue-500 text-white" :
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
                                    {modpack.acquisitionMethod === 'paid' ? 'Continuar' :
                                        modpack.acquisitionMethod === 'password' ? 'Desbloquear' :
                                            modpack.acquisitionMethod === 'twitch_sub' ? 'Verificar' : 'Obtener'}
                                </>
                            )}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};