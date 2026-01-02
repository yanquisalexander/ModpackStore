import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
    LucideCrown,
    LucideLoader,
    LucideCheck,
    LucideX,
    LucideAlertTriangle,
    LucideUsers,
    LucidePackage,
    LucideHardDrive,
    LucideShield,
    LucideSparkles,
    LucideZap,
    LucideGlobe
} from 'lucide-react';
import { useAuthentication } from '@/stores/AuthContext';
import { subscriptionService } from '@/services/subscription.service';
import { PublisherSubscription, SubscriptionTier, TIER_DEFAULTS, TIER_PRICES } from '@/types/subscription';
import { toast } from 'sonner';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { openUrl } from '@tauri-apps/plugin-opener';

// Plan comparison data
const PLAN_FEATURES = [
    { key: 'whitelistMaxPlayers', label: 'Jugadores en Whitelist', icon: LucideUsers },
    { key: 'maxMembers', label: 'Miembros del Equipo', icon: LucideUsers },
    { key: 'maxModpacks', label: 'Modpacks Activos', icon: LucidePackage, formatter: (val: any) => val === -1 ? 'Ilimitados' : val },
    { key: 'storageLimitMB', label: 'Almacenamiento', icon: LucideHardDrive, formatter: (val: any) => `${val >= 1024 ? (val / 1024).toFixed(1) + ' GB' : val + ' MB'}` },
    { key: 'customBranding', label: 'Branding Personalizado', icon: LucideSparkles, formatter: (val: any) => val ? 'Sí' : 'No' },
    { key: 'prioritySupport', label: 'Soporte Prioritario', icon: LucideShield, formatter: (val: any) => val ? 'Sí' : 'No' },
    { key: 'analyticsAccess', label: 'Acceso a Analíticas', icon: LucideZap, formatter: (val: any) => val ? 'Sí' : 'No' },
    { key: 'customCategories', label: 'Categorías Personalizadas', icon: LucideGlobe, formatter: (val: any) => val ? 'Sí' : 'No' },
];

export const PublisherSubscriptionView: React.FC = () => {
    const { publisherId } = useParams<{ publisherId: string }>();
    const { sessionTokens } = useAuthentication();

    const [loading, setLoading] = useState(true);
    const [subscription, setSubscription] = useState<PublisherSubscription | null>(null);
    const [, setFeatures] = useState<Record<string, any>>({});
    const [selectedTier, setSelectedTier] = useState<SubscriptionTier | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [showCancelDialog, setShowCancelDialog] = useState(false);
    const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);

    useEffect(() => {
        if (publisherId && sessionTokens?.accessToken) {
            loadSubscription();
        }
    }, [publisherId, sessionTokens?.accessToken]);

    const loadSubscription = async () => {
        if (!publisherId || !sessionTokens?.accessToken) return;

        setLoading(true);
        try {
            const [subData, featuresData] = await Promise.all([
                subscriptionService.getPublisherSubscription(publisherId, sessionTokens.accessToken),
                subscriptionService.getPublisherFeatures(publisherId, sessionTokens.accessToken)
            ]);

            setSubscription(subData);
            setFeatures(featuresData);
        } catch (error) {
            console.error('Error loading subscription:', error);
            toast.error('Error al cargar la información de la suscripción');
        } finally {
            setLoading(false);
        }
    };

    const handleCancelSubscription = () => {
        setShowCancelDialog(true);
    };

    const confirmCancelSubscription = async () => {
        if (!publisherId || !sessionTokens?.accessToken) return;

        setIsProcessing(true);
        try {
            await subscriptionService.cancelPublisherSubscription(publisherId, sessionTokens.accessToken);
            toast.success('Suscripción cancelada exitosamente');
            loadSubscription();
        } catch (error) {
            console.error('Error cancelling subscription:', error);
            toast.error('Error al cancelar la suscripción');
        } finally {
            setIsProcessing(false);
            setShowCancelDialog(false);
        }
    };

    const getTierColor = (tier: SubscriptionTier) => {
        switch (tier) {
            case SubscriptionTier.FREE: return 'from-gray-500 to-gray-700';
            case SubscriptionTier.BASIC: return 'from-blue-500 to-blue-700';
            case SubscriptionTier.PREMIUM: return 'from-purple-500 to-indigo-700';
            case SubscriptionTier.ENTERPRISE: return 'from-amber-400 to-orange-600';
            default: return 'from-gray-500 to-gray-700';
        }
    };

    const getTierBadge = (tier: SubscriptionTier) => {
        switch (tier) {
            case SubscriptionTier.FREE: return 'Gratis';
            case SubscriptionTier.BASIC: return 'Básico';
            case SubscriptionTier.PREMIUM: return 'Premium';
            case SubscriptionTier.ENTERPRISE: return 'Enterprise';
            default: return tier;
        }
    }

    const getTierFeatures = (tier: SubscriptionTier) => {
        return TIER_DEFAULTS[tier];
    };

    const renderCurrentPlan = () => {
        if (!subscription) return null;

        const currentFeatures = getTierFeatures(subscription.tier);
        const isExpiringSoon = subscription.daysUntilExpiry !== null &&
            subscription.daysUntilExpiry !== undefined &&
            subscription.daysUntilExpiry <= 7 &&
            subscription.daysUntilExpiry > 0;

        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
            >
                <Card className="border-primary/20 bg-gradient-to-br from-background to-secondary/10 overflow-hidden relative">
                    <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${getTierColor(subscription.tier)}`} />
                    <CardHeader>
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div className={`p-3 rounded-xl bg-gradient-to-br ${getTierColor(subscription.tier)} shadow-lg`}>
                                    <LucideCrown className="h-6 w-6 text-white" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <CardTitle className="text-2xl font-bold">
                                            Plan {getTierBadge(subscription.tier)}
                                        </CardTitle>
                                        <Badge variant={subscription.isActive ? 'default' : 'secondary'} className={subscription.isActive ? 'bg-green-500/10 text-green-500 border-green-500/20' : ''}>
                                            {subscription.isActive ? 'Activo' : 'Inactivo'}
                                        </Badge>
                                    </div>
                                    <CardDescription className="mt-1">
                                        Gestiona tu suscripción y límites actuales
                                    </CardDescription>
                                </div>
                            </div>

                            {/* Actions */}
                            {subscription.isActive && subscription.tier !== SubscriptionTier.FREE && (
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={handleCancelSubscription}
                                    disabled={isProcessing}
                                    className="md:self-center"
                                >
                                    {isProcessing ? <LucideLoader className="h-4 w-4 animate-spin mr-2" /> : null}
                                    Cancelar Suscripción
                                </Button>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Expiration Warning */}
                        {isExpiringSoon && (
                            <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
                                <LucideAlertTriangle className="h-4 w-4" />
                                <AlertDescription>
                                    Tu suscripción expira en {subscription.daysUntilExpiry} días.
                                    Renueva pronto para evitar perder beneficios.
                                </AlertDescription>
                            </Alert>
                        )}
                        {subscription.expiresAt && (
                            <div className="text-sm">
                                <span className="text-muted-foreground">Próxima facturación: </span>
                                <span className="font-medium text-foreground">
                                    {new Date(subscription.expiresAt).toLocaleDateString('es-ES', {
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric'
                                    })}
                                </span>
                            </div>
                        )}

                        <Separator className="bg-border/50" />

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            {/* Usage Stats */}
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Whitelist</span>
                                    <span className="font-medium">0 / {currentFeatures.whitelistMaxPlayers}</span>
                                </div>
                                <Progress value={0} className="h-2" />
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Miembros</span>
                                    <span className="font-medium">0 / {currentFeatures.maxMembers}</span>
                                </div>
                                <Progress value={0} className="h-2" />
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Modpacks</span>
                                    <span className="font-medium">0 / {currentFeatures.maxModpacks === -1 ? '∞' : currentFeatures.maxModpacks}</span>
                                </div>
                                {currentFeatures.maxModpacks !== -1 && <Progress value={0} className="h-2" />}
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Almacenamiento</span>
                                    <span className="font-medium">
                                        0 MB / {currentFeatures.storageLimitMB >= 1024
                                            ? `${(currentFeatures.storageLimitMB / 1024).toFixed(1)} GB`
                                            : `${currentFeatures.storageLimitMB} MB`
                                        }
                                    </span>
                                </div>
                                <Progress value={0} className="h-2" />
                            </div>
                        </div>

                        {/* Feature Overrides Notice */}
                        {subscription.features && subscription.features.some(f => f.isOverride) && (
                            <div className="mt-4 p-3 bg-blue-500/10 text-blue-500 rounded-lg text-sm flex items-center gap-2">
                                <LucideShield className="h-4 w-4" />
                                <span>Algunas características han sido ajustadas manualmente por un administrador.</span>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </motion.div>
        );
    };

    const renderPricingCards = () => {
        const tiers = [SubscriptionTier.BASIC, SubscriptionTier.PREMIUM, SubscriptionTier.ENTERPRISE];

        return (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
                {tiers.map((tier, index) => {
                    const isCurrent = subscription?.tier === tier;
                    const price = TIER_PRICES[tier].monthly;
                    const features = getTierFeatures(tier);

                    return (
                        <motion.div
                            key={tier}
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4, delay: index * 0.1 }}
                        >
                            <Card className={`h-full flex flex-col relative overflow-hidden transition-all hover:shadow-xl hover:scale-[1.02] duration-300 ${isCurrent ? 'border-primary ring-2 ring-primary/20' : 'border-border'}`}>
                                {tier === SubscriptionTier.PREMIUM && (
                                    <div className="absolute top-0 right-0 p-1 px-3 bg-gradient-to-r from-pink-500 to-purple-600 rounded-bl-xl text-xs font-bold text-white shadow-lg">
                                        Recomendado
                                    </div>
                                )}

                                <CardHeader>
                                    <CardTitle className="flex justify-between items-start">
                                        <div>
                                            <h3 className="text-xl font-bold">{getTierBadge(tier)}</h3>
                                            <p className="text-sm text-muted-foreground mt-1">Mejora tu experiencia</p>
                                        </div>
                                        <div className={`p-2 rounded-lg bg-gradient-to-br ${getTierColor(tier)}`}>
                                            <LucideCrown className="h-5 w-5 text-white" />
                                        </div>
                                    </CardTitle>
                                    <div className="mt-4">
                                        <span className="text-3xl font-bold">${price}</span>
                                        <span className="text-muted-foreground">/mes</span>
                                    </div>
                                </CardHeader>
                                <CardContent className="flex-1 space-y-4">
                                    <div className="space-y-2 text-sm">
                                        {PLAN_FEATURES.map((feature) => {
                                            const val = features[feature.key as keyof typeof features];
                                            // Only show relevant positive features or limits
                                            if (val === false) return null;

                                            let displayVal: string | number = typeof val === 'boolean' ? 'Incluido' : val;
                                            if (feature.formatter) displayVal = feature.formatter(val as any);

                                            return (
                                                <div key={feature.key} className="flex items-center gap-3">
                                                    <div className="p-1 rounded-full bg-primary/10 text-primary">
                                                        <LucideCheck className="h-3 w-3" />
                                                    </div>
                                                    <span className="text-muted-foreground">
                                                        <strong className="text-foreground">{displayVal}</strong> {feature.label}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </CardContent>
                                <CardFooter>
                                    <Button
                                        className="w-full"
                                        variant={isCurrent ? "secondary" : (tier === SubscriptionTier.PREMIUM ? "default" : "outline")}
                                        disabled={isCurrent}
                                        onClick={() => {
                                            setSelectedTier(tier);
                                            // If user selects a tier, we can trigger payment flow immediately or show confirmation
                                            // For now, let's just set selected tier which will show payment dialog/modal if we had one
                                            // But based on current UI, we probably want to trigger payment directly or show a confirmation dialog
                                        }}
                                    >
                                        {isCurrent ? 'Plan Actual' : 'Seleccionar Plan'}
                                    </Button>
                                </CardFooter>
                            </Card>
                        </motion.div>
                    );
                })}
            </div>
        );
    };

    // Effect to trigger payment when tier is selected
    useEffect(() => {
        if (selectedTier && selectedTier !== SubscriptionTier.FREE) {
            setShowUpgradeDialog(true);
        }
    }, [selectedTier]);

    const handleMercadoPagoPayment = async () => {
        if (!selectedTier || !publisherId || !sessionTokens?.accessToken) return;

        setIsProcessing(true);
        try {
            // Create Mercado Pago subscription
            const { approvalUrl } = await subscriptionService.createMercadoPagoSubscription(
                publisherId,
                selectedTier,
                sessionTokens.accessToken
            );

            // Open Mercado Pago in system browser
            await openUrl(approvalUrl);

            toast.success('Redirigiendo a Mercado Pago...');
            toast.info('Una vez completado el pago, tu suscripción se actualizará automáticamente.');

            // We don't poll for Mercado Pago as it's handled via webhooks and the user is in an external browser
            // But we could refresh the subscription after some time or when the window regains focus
            setSelectedTier(null);

        } catch (error) {
            console.error('Error processing Mercado Pago payment:', error);
            toast.error('Error al procesar el pago con Mercado Pago');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
                className="space-y-8"
            >
                <div>
                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.7 }}
                        className="text-3xl sm:text-4xl font-extrabold leading-tight"
                    >
                        Detalles de la Suscripción
                    </motion.h1>
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.7 }}
                        className="mt-2 text-lg text-muted-foreground"
                    >
                        Aquí puedes ver y gestionar tu suscripción actual, así como explorar otros planes disponibles.
                    </motion.p>
                </div>

                {loading ? (
                    <div className="flex justify-center py-10">
                        <LucideLoader className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : (
                    <div className="space-y-10">
                        {subscription ? renderCurrentPlan() : (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                            >
                                <Card className="border-primary/20 bg-secondary/5">
                                    <CardHeader>
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 rounded-xl bg-gray-500 shadow-lg">
                                                <LucideCrown className="h-6 w-6 text-white" />
                                            </div>
                                            <div>
                                                <CardTitle className="text-2xl font-bold">Plan Gratuito</CardTitle>
                                                <CardDescription>Estás utilizando la versión gratuita de ModpackStore</CardDescription>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-sm text-muted-foreground">
                                            Tu cuenta tiene límites básicos de almacenamiento y modpacks. Mejora tu plan para obtener más beneficios.
                                        </p>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        )}

                        {/* Pricing Section - Always show if not on Enterprise or if no sub */}
                        {(!subscription || subscription.tier !== SubscriptionTier.ENTERPRISE) && (
                            <div>
                                <h3 className="text-2xl font-bold mb-2">
                                    {subscription ? 'Mejora tu Plan' : 'Elige un Plan'}
                                </h3>
                                <p className="text-muted-foreground mb-6">
                                    Desbloquea funciones avanzadas y aumenta tus límites para llevar tu contenido al siguiente nivel.
                                </p>
                                {renderPricingCards()}
                            </div>
                        )}

                        {/* Payment Method Section - Only show if sub exists and not Free Tier */}
                        {subscription && subscription.tier !== SubscriptionTier.FREE && (
                            <div className="mt-8">
                                <h3 className="text-xl font-semibold mb-4">
                                    Método de Pago
                                </h3>
                                <Card>
                                    <CardContent className="pt-6">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-sm text-muted-foreground">Proveedor de pago</p>
                                                <p className="font-medium text-foreground">{subscription.paymentProvider || 'Mercado Pago'}</p>
                                            </div>
                                            <Button
                                                variant="outline"
                                                onClick={() => toast.info('Funcionalidad próximamente disponible')}
                                            >
                                                Gestionar Suscripción
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        )}
                    </div>
                )}

                <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>¿Cancelar suscripción?</AlertDialogTitle>
                            <AlertDialogDescription>
                                ¿Estás seguro de que deseas cancelar tu suscripción? Perderás el acceso a las funciones premium al final de tu periodo de facturación actual.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Volver</AlertDialogCancel>
                            <AlertDialogAction onClick={confirmCancelSubscription} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                Sí, cancelar suscripción
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                <AlertDialog open={showUpgradeDialog} onOpenChange={(open) => {
                    setShowUpgradeDialog(open);
                    if (!open) setSelectedTier(null);
                }}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Confirmar cambio de plan</AlertDialogTitle>
                            <AlertDialogDescription>
                                ¿Deseas actualizar al plan {selectedTier ? getTierBadge(selectedTier) : ''}? Serás redirigido a Mercado Pago para completar el pago.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => {
                                setShowUpgradeDialog(false);
                                handleMercadoPagoPayment();
                            }}>
                                Continuar a Mercado Pago
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </motion.div>
        </div>
    );
};
