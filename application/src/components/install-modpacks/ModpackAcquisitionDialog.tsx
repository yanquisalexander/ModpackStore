import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
    LucideShieldAlert,
    LucideShoppingCart,
    LucideCreditCard,
    LucideQrCode,
    LucideExternalLink,
    LucideLoader2,
    LucideCopy,
    LucideCheckCircle,
    LucideXCircle,
    LucideInfo,
} from "lucide-react";
import { MdiTwitch } from "@/icons/MdiTwitch";
import { toast } from "sonner";
import { useAuthentication } from "@/stores/AuthContext";
import { API_ENDPOINT } from "@/consts";
import { useRealtimeContext } from "@/providers/RealtimeProvider";

// Definiciones de tipos y props
type AcquisitionMethod = 'free' | 'paid' | 'password' | 'twitch_sub';

interface ModpackAcquisitionDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    modpack: {
        id: string;
        name: string;
        acquisitionMethod: AcquisitionMethod;
        requiresPassword?: boolean;
        isPaid?: boolean;
        isFree?: boolean;
        price?: string;
        requiresTwitchSubscription?: boolean;
        requiredTwitchChannels?: string[];
    };
}

interface PaymentResponse {
    success: boolean;
    isFree?: boolean;
    paymentId?: string;
    approvalUrl?: string;
    qrCode?: string;
    qrCodeUrl?: string;
    gatewayType?: string;
    amount?: string;
    currency?: string;
    status?: string;
    metadata?: Record<string, any>;
}

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
        } catch (error) {
            toast.error("Error al copiar el enlace");
        }
    };

    const getAcquisitionInfo = (method: AcquisitionMethod) => {
        switch (method) {
            case 'password':
                return {
                    icon: <LucideShieldAlert className="w-5 h-5" />,
                    title: 'Acceso con Contraseña',
                    description: 'Ingresa la contraseña proporcionada por el creador.',
                };
            case 'free':
                return {
                    icon: <LucideShoppingCart className="w-5 h-5" />,
                    title: 'Obtener Gratis',
                    description: 'Este modpack es gratuito.',
                };
            case 'paid':
                return {
                    icon: <LucideCreditCard className="w-5 h-5" />,
                    title: `Comprar por $${modpack.price} USD`,
                    description: 'Pago único a través de múltiples opciones.',
                };
            case 'twitch_sub':
                return {
                    icon: <MdiTwitch className="w-5 h-5" />,
                    title: 'Acceso con Suscripción de Twitch',
                    description: 'Requiere suscripción activa a los canales especificados.',
                };
        }
    };

    const acquisitionInfo = getAcquisitionInfo(modpack.acquisitionMethod);

    const handleAcquisition = useCallback(async () => {
        setIsProcessing(true);
        try {
            let response;
            switch (modpack.acquisitionMethod) {
                case 'password':
                    if (!password.trim()) {
                        toast.error("Por favor ingresa la contraseña");
                        setIsProcessing(false);
                        return;
                    }
                    response = await fetch(`${API_ENDPOINT}/explore/modpacks/${modpack.id}/validate-password`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${sessionTokens?.accessToken}`,
                        },
                        body: JSON.stringify({ password: password.trim() }),
                    });
                    const data = await response.json();
                    if (response.ok && data.valid) {
                        toast.success('¡Acceso concedido!');
                        onSuccess();
                        handleClose();
                    } else {
                        toast.error(data.message || 'Contraseña incorrecta');
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
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${sessionTokens?.accessToken}`,
                        },
                        body: JSON.stringify({ gatewayType: selectedGateway }),
                    });
                    const paymentResponse: PaymentResponse = await response.json();
                    if (response.ok && paymentResponse.success) {
                        if (modpack.acquisitionMethod === 'free') {
                            toast.success('¡Modpack gratuito adquirido!');
                            onSuccess();
                            handleClose();
                        } else {
                            setPaymentData(paymentResponse);
                            toast.success(`Pago iniciado via ${paymentResponse.gatewayType?.toUpperCase()}. Completa el pago para obtener acceso.`);
                        }
                    } else {
                        toast.error('Error al procesar la compra');
                    }
                    break;
                case 'twitch_sub':
                    response = await fetch(`${API_ENDPOINT}/explore/modpacks/${modpack.id}/acquire/twitch`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${sessionTokens?.accessToken}`,
                        },
                    });
                    const twitchData = await response.json();
                    if (response.ok && twitchData.success) {
                        toast.success('¡Acceso concedido!');
                        onSuccess();
                        handleClose();
                    } else {
                        toast.error(twitchData.message || 'Suscripción de Twitch requerida');
                    }
                    break;
                default:
                    break;
            }
        } catch (error) {
            console.error('Error durante la adquisición:', error);
            toast.error('Ocurrió un error inesperado');
        } finally {
            setIsProcessing(false);
        }
    }, [modpack, password, selectedGateway, sessionTokens, onSuccess, handleClose]);

    useEffect(() => {
        if (!paymentData?.paymentId || !isConnected) return;

        const handlePaymentUpdate = (payload: any) => {
            if (payload.paymentId !== paymentData.paymentId) return;

            setPaymentData(prev => prev ? { ...prev, status: payload.status } : null);
            switch (payload.status) {
                case 'completed':
                    toast.success(payload.message || '¡Pago completado exitosamente!');
                    setTimeout(() => {
                        onSuccess();
                        handleClose();
                    }, 2000);
                    break;
                case 'processing':
                    toast.info(payload.message || 'Procesando pago...');
                    break;
                case 'failed':
                    toast.error(payload.message || 'Error en el pago');
                    break;
                default:
                    break;
            }
        };

        const unsubscribeCompleted = on('payment_completed', handlePaymentUpdate);
        const unsubscribeProcessing = on('payment_processing', handlePaymentUpdate);
        const unsubscribeFailed = on('payment_failed', handlePaymentUpdate);

        return () => {
            unsubscribeCompleted();
            unsubscribeProcessing();
            unsubscribeFailed();
        };
    }, [paymentData?.paymentId, isConnected, on, onSuccess]);

    // Renderizado del diálogo de pago en curso
    if (paymentData && modpack.acquisitionMethod === 'paid') {
        const statusMap = {
            completed: { text: 'Pago completado', color: 'green', icon: <LucideCheckCircle /> },
            failed: { text: 'Pago fallido', color: 'red', icon: <LucideXCircle /> },
            processing: { text: 'Procesando pago...', color: 'blue', icon: <LucideLoader2 className="animate-spin" /> },
            pending: { text: 'Pendiente de confirmación', color: 'yellow', icon: <LucideInfo /> },
        };
        const currentStatus = statusMap[paymentData.status as keyof typeof statusMap] || statusMap.pending;

        return (
            <Dialog open={isOpen} onOpenChange={() => false}>
                <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <LucideCreditCard className="w-5 h-5" />
                            Información de Pago
                        </DialogTitle>
                        <DialogDescription>
                            Completa tu pago a través de {paymentData.gatewayType?.toUpperCase()}.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className={`p-4 rounded-lg border border-${currentStatus.color}-200 bg-${currentStatus.color}-50 dark:bg-${currentStatus.color}-900/20`}>
                            <div className="flex items-center gap-3">
                                <span className={`text-${currentStatus.color}-600`}>
                                    {currentStatus.icon}
                                </span>
                                <span className="font-medium text-sm">
                                    {currentStatus.text}
                                </span>
                            </div>
                        </div>

                        <div className="text-center p-6 bg-muted/50 rounded-lg">
                            <div className="text-3xl font-bold text-primary">
                                ${paymentData.amount} USD
                            </div>
                            <div className="text-sm text-muted-foreground mt-1">
                                Estás adquiriendo: <span className="font-medium">{modpack.name}</span>
                            </div>
                        </div>

                        <div className="flex flex-col gap-2 md:flex-row md:items-center">
                            <Button
                                onClick={() => window.open(paymentData?.approvalUrl, '_blank')}
                                disabled={!paymentData?.approvalUrl}
                                className="flex-1"
                            >
                                <LucideExternalLink className="w-4 h-4 mr-2" />
                                Pagar en Navegador
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => copyToClipboard(paymentData?.approvalUrl || '')}
                                className="flex-none"
                            >
                                <LucideCopy className="w-4 h-4 mr-2" />
                                {copiedUrl ? 'Copiado' : 'Copiar Enlace'}
                            </Button>
                        </div>

                        {(paymentData.qrCodeUrl || paymentData.approvalUrl) && (
                            <Card className="p-3 bg-muted/10 rounded-md">
                                <div className="text-center space-y-2">
                                    <div className="text-sm text-muted-foreground">
                                        Escanea el código QR con tu teléfono
                                    </div>
                                    <div className="flex justify-center">
                                        {(() => {
                                            const qrSrc = paymentData.qrCodeUrl
                                                ? `https://api.qrserver.com/v1/create-qr-code/?size=360x360&data=${encodeURIComponent(paymentData.qrCodeUrl)}&format=png`
                                                : (paymentData.approvalUrl ? `https://api.qrserver.com/v1/create-qr-code/?size=360x360&data=${encodeURIComponent(paymentData.approvalUrl)}&format=png` : '');
                                            return (
                                                <img
                                                    src={qrSrc}
                                                    alt="Código QR para pago móvil"
                                                    className="w-36 h-36 border rounded-md shadow-sm"
                                                />
                                            );
                                        })()}
                                    </div>
                                </div>
                            </Card>
                        )}

                        <div className="text-center text-xs text-muted-foreground">
                            La confirmación de pago es automática. Puedes cerrar este diálogo.
                        </div>

                    </div>
                    <div className="flex justify-end pt-4 border-t border-border">
                        <Button variant="ghost" onClick={handleClose}>
                            Cerrar
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    // Renderizado del diálogo de adquisición inicial
    return (
        <Dialog open={isOpen} onOpenChange={() => false}>
            <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        {acquisitionInfo.icon}
                        {acquisitionInfo.title}
                    </DialogTitle>
                    <DialogDescription>
                        {acquisitionInfo.description}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {modpack.acquisitionMethod === 'password' && (
                        <div className="space-y-2">
                            <Label htmlFor="password">Contraseña</Label>
                            <Input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleAcquisition()}
                                placeholder="Ingresa la contraseña del modpack"
                            />
                        </div>
                    )}

                    {modpack.acquisitionMethod === 'paid' && (
                        <div className="space-y-3">
                            <Label>Método de Pago</Label>
                            <div className="text-sm text-muted-foreground mb-2">
                                Selecciona tu proveedor preferido:
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                <Button
                                    variant={selectedGateway === 'paypal' ? 'default' : 'outline'}
                                    onClick={() => setSelectedGateway('paypal')}
                                    className="w-full justify-start"
                                >
                                    💳 PayPal
                                </Button>
                                <Button
                                    disabled
                                    variant={selectedGateway === 'mercadopago' ? 'default' : 'outline'}
                                    onClick={() => setSelectedGateway('mercadopago')}
                                    className="w-full justify-start"
                                >
                                    💳 MercadoPago (No disponible)
                                </Button>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                                <LucideQrCode className="w-4 h-4 text-muted-foreground" />
                                <div>Se generará un código QR para pago móvil al iniciar la compra.</div>
                            </div>
                            {!selectedGateway && (
                                <div className="text-xs text-orange-600 bg-orange-50 dark:bg-orange-900/20 px-3 py-2 rounded">
                                    Por favor, selecciona un método de pago para continuar.
                                </div>
                            )}
                        </div>
                    )}

                    {isConnected && (
                        <div className="flex items-center justify-center gap-1 text-xs text-green-600">
                            <div className="w-1.5 h-1.5 bg-green-400 rounded-full"></div>
                            Conectado en tiempo real
                        </div>
                    )}
                </div>

                <div className="flex flex-col gap-2 sm:flex-row-reverse sm:justify-between sm:items-center pt-4 border-t border-border">
                    <Button
                        onClick={handleAcquisition}
                        disabled={isProcessing || (modpack.acquisitionMethod === 'password' && !password.trim()) || (modpack.acquisitionMethod === 'paid' && !selectedGateway)}
                        className="flex-1"
                    >
                        {isProcessing && <LucideLoader2 className="w-4 h-4 mr-2 animate-spin" />}
                        {modpack.acquisitionMethod === 'password' ? 'Validar Contraseña' :
                            modpack.acquisitionMethod === 'free' ? 'Obtener' :
                                modpack.acquisitionMethod === 'paid' ? 'Comprar' :
                                    'Verificar Suscripción'}
                    </Button>
                    <Button
                        variant="outline"
                        onClick={handleClose}
                        className="flex-1 sm:flex-none"
                    >
                        Cancelar
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};