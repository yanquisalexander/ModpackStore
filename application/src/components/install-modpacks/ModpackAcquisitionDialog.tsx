import { useState, useEffect } from "react";
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
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { 
    LucideShieldAlert, 
    LucideShoppingCart, 
    LucideCreditCard,
    LucideQrCode,
    LucideExternalLink,
    LucideCheck,
    LucideLoader2
} from "lucide-react";
import { MdiTwitch } from "@/icons/MdiTwitch";
import { toast } from "sonner";
import { useAuthentication } from "@/stores/AuthContext";
import { API_ENDPOINT } from "@/consts";

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

type AcquisitionMethod = 'free' | 'paid' | 'password' | 'twitch_sub';

interface PaymentResponse {
    success: boolean;
    isFree?: boolean;
    paymentId?: string;
    approvalUrl?: string;
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
    const [selectedGateway, setSelectedGateway] = useState<string | undefined>(undefined);
    const [paymentData, setPaymentData] = useState<PaymentResponse | null>(null);
    const { sessionTokens } = useAuthentication();

    // Use the single acquisition method directly
    const selectedMethod = modpack.acquisitionMethod;

    const handlePasswordAcquisition = async () => {
        if (!password.trim()) {
            toast.error("Por favor ingresa la contraseña");
            return;
        }

        setIsProcessing(true);
        try {
            const response = await fetch(`${API_ENDPOINT}/explore/modpacks/${modpack.id}/validate-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${sessionTokens?.accessToken}`,
                },
                body: JSON.stringify({ password: password.trim() }),
            });

            const data = await response.json();

            if (response.ok && data.valid) {
                toast.success('¡Acceso concedido con contraseña!');
                onSuccess();
                handleClose();
            } else {
                toast.error(data.message || 'Contraseña incorrecta');
            }
        } catch (error) {
            console.error('Error validating password:', error);
            toast.error('Error al validar la contraseña');
        } finally {
            setIsProcessing(false);
        }
    };

    const handlePurchaseAcquisition = async (gatewayType?: string) => {
        setIsProcessing(true);
        try {
            // Detect user's country for gateway selection (optional)
            let countryCode: string | undefined;
            try {
                // Simple IP-based country detection (optional)
                // In a real app, you might want to use a proper geolocation service
                countryCode = Intl.DateTimeFormat().resolvedOptions().timeZone?.split('/')[0];
            } catch (error) {
                // Fallback if detection fails
                countryCode = undefined;
            }

            const response = await fetch(`${API_ENDPOINT}/explore/modpacks/${modpack.id}/acquire/purchase`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${sessionTokens?.accessToken}`,
                },
                body: JSON.stringify({
                    gatewayType,
                    countryCode
                }),
            });

            const data: PaymentResponse = await response.json();

            if (response.ok && data.success) {
                if (modpack.acquisitionMethod === 'free') {
                    toast.success('¡Modpack gratuito adquirido!');
                    onSuccess();
                    handleClose();
                } else {
                    setPaymentData(data);
                    toast.success(`Pago iniciado via ${data.gatewayType?.toUpperCase()}. Completa el pago para obtener acceso.`);
                }
            } else {
                toast.error('Error al procesar la compra');
            }
        } catch (error) {
            console.error('Error processing purchase:', error);
            toast.error('Error al procesar la compra');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleTwitchAcquisition = async () => {
        setIsProcessing(true);
        try {
            const response = await fetch(`${API_ENDPOINT}/explore/modpacks/${modpack.id}/acquire/twitch`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${sessionTokens?.accessToken}`,
                },
            });

            const data = await response.json();

            if (response.ok && data.success) {
                toast.success('¡Acceso concedido con suscripción de Twitch!');
                onSuccess();
                handleClose();
            } else {
                toast.error(data.message || 'Suscripción de Twitch requerida');
            }
        } catch (error) {
            console.error('Error processing Twitch acquisition:', error);
            toast.error('Error al verificar suscripción de Twitch');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleClose = () => {
        setPassword("");
        setSelectedGateway(undefined);
        setPaymentData(null);
        setIsProcessing(false);
        onClose();
    };

    const getMethodIcon = (method: AcquisitionMethod) => {
        switch (method) {
            case 'password': return <LucideShieldAlert className="w-5 h-5" />;
            case 'free':
            case 'paid': return <LucideShoppingCart className="w-5 h-5" />;
            case 'twitch_sub': return <MdiTwitch className="w-5 h-5" />;
        }
    };

    const getMethodTitle = (method: AcquisitionMethod) => {
        switch (method) {
            case 'password': return 'Acceso con Contraseña';
            case 'free': return 'Obtener Gratis';
            case 'paid': return `Comprar por $${modpack.price} USD`;
            case 'twitch_sub': return 'Acceso con Suscripción de Twitch';
        }
    };

    const getMethodDescription = (method: AcquisitionMethod) => {
        switch (method) {
            case 'password': return 'Ingresa la contraseña proporcionada por el creador';
            case 'free': return 'Este modpack es gratuito';
            case 'paid': return 'Pago único a través de múltiples opciones de pago';
            case 'twitch_sub': return 'Requiere suscripción activa a los canales especificados';
        }
    };

    const getGatewayIcon = (gatewayType?: string) => {
        switch (gatewayType) {
            case 'paypal': return '💳 PayPal';
            case 'mercadopago': return '💳 MercadoPago';
            default: return '💳 Procesando...';
        }
    };

    if (paymentData && modpack.acquisitionMethod === 'paid') {
        return (
            <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <LucideCreditCard className="w-5 h-5" />
                            Completar Pago - {getGatewayIcon(paymentData.gatewayType)}
                        </DialogTitle>
                        <DialogDescription>
                            Completa tu pago de ${paymentData.amount} USD para obtener acceso al modpack.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <Card>
                            <CardContent className="p-4 space-y-4">
                                <div className="text-center">
                                    <div className="text-2xl font-bold">
                                        ${paymentData.amount} USD
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                        {modpack.name}
                                    </div>
                                    <div className="text-xs text-blue-600 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded mt-2">
                                        Procesador: {paymentData.gatewayType?.toUpperCase()} | Moneda: USD
                                    </div>
                                </div>

                                <Separator />

                                <div className="space-y-3">
                                    <Button 
                                        onClick={() => window.open(paymentData.approvalUrl, '_blank')}
                                        className="w-full"
                                        size="lg"
                                    >
                                        <LucideExternalLink className="w-4 h-4 mr-2" />
                                        Completar Pago
                                    </Button>

                                    <div className="text-center text-sm text-muted-foreground">
                                        La confirmación de pago será automática.
                                        <br />
                                        No necesitas regresar a esta ventana.
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <div className="flex justify-between gap-2">
                            <Button
                                variant="outline"
                                onClick={handleClose}
                                className="w-full"
                            >
                                Cerrar
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        {getMethodIcon(selectedMethod)}
                        {getMethodTitle(selectedMethod)}
                    </DialogTitle>
                    <DialogDescription>
                        {getMethodDescription(selectedMethod)}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {selectedMethod === 'password' && (
                        <div className="space-y-2">
                            <Label htmlFor="password">Contraseña</Label>
                            <Input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && password.trim() && !isProcessing) {
                                        handlePasswordAcquisition();
                                    }
                                }}
                                placeholder="Ingresa la contraseña del modpack"
                            />
                        </div>
                    )}

                    {selectedMethod === 'paid' && (
                        <div className="space-y-3">
                            <Label>Método de Pago</Label>
                            <div className="space-y-2">
                                <Button
                                    variant={selectedGateway === 'paypal' ? 'default' : 'outline'}
                                    onClick={() => setSelectedGateway('paypal')}
                                    className="w-full justify-start"
                                >
                                    💳 PayPal
                                </Button>
                                <Button
                                    variant={selectedGateway === 'mercadopago' ? 'default' : 'outline'}
                                    onClick={() => setSelectedGateway('mercadopago')}
                                    className="w-full justify-start"
                                >
                                    💳 MercadoPago
                                </Button>
                                <Button
                                    variant={selectedGateway === undefined ? 'default' : 'outline'}
                                    onClick={() => setSelectedGateway(undefined)}
                                    className="w-full justify-start"
                                >
                                    🌟 Automático (recomendado)
                                </Button>
                            </div>
                            <div className="text-xs text-muted-foreground">
                                El modo automático selecciona el mejor método para tu región.
                            </div>
                        </div>
                    )}

                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            onClick={handleClose}
                            className="flex-1"
                        >
                            Cancelar
                        </Button>
                        <Button
                            onClick={
                                selectedMethod === 'password' ? handlePasswordAcquisition :
                                selectedMethod === 'free' || selectedMethod === 'paid' ? () => handlePurchaseAcquisition(selectedGateway) :
                                handleTwitchAcquisition
                            }
                            disabled={isProcessing || (selectedMethod === 'password' && !password.trim())}
                            className="flex-1"
                        >
                            {isProcessing && <LucideLoader2 className="w-4 h-4 mr-2 animate-spin" />}
                            {selectedMethod === 'password' ? 'Validar Contraseña' :
                             selectedMethod === 'free' ? 'Obtener' :
                             selectedMethod === 'paid' ? 'Comprar' :
                             'Verificar Suscripción'}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};