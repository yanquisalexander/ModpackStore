import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ModpackAcquisitionDialog } from "../install-modpacks/ModpackAcquisitionDialog";
import { PublisherEarningsCard } from "../publisher/PublisherEarningsCard";
import { WithdrawalsManagement } from "../admin/WithdrawalsManagement";
import { ModpackAccessStatus } from "../modpack/ModpackAccessStatus";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs";
import {
    LucideShield,
    LucideShoppingCart,
    LucideDollarSign,
    LucideSettings,
    LucideUser,
} from "lucide-react";
import { MdiTwitch } from "@/icons/MdiTwitch";

/**
 * Demo component showcasing the complete modpack acquisition system.
 * This demonstrates all three acquisition methods and the management interfaces.
 */
export const AcquisitionSystemDemo = () => {
    const [showPasswordDemo, setShowPasswordDemo] = useState(false);
    const [showPaidDemo, setShowPaidDemo] = useState(false);
    const [showTwitchDemo, setShowTwitchDemo] = useState(false);
    const [showFreeDemo, setShowFreeDemo] = useState(false);

    // Demo modpack configurations
    const demoModpacks = {
        password: {
            id: "password-demo-1",
            name: "Secret Modpack",
            acquisitionMethod: 'password' as const,
            requiresPassword: true,
            isPaid: false,
            isFree: true,
        },
        paid: {
            id: "paid-demo-1", 
            name: "Premium Modpack",
            acquisitionMethod: 'paid' as const,
            requiresPassword: false,
            isPaid: true,
            isFree: false,
            price: "9.99",
        },
        free: {
            id: "free-demo-1",
            name: "Community Modpack",
            acquisitionMethod: 'free' as const,
            requiresPassword: false,
            isPaid: false,
            isFree: true,
        },
        twitch: {
            id: "twitch-demo-1",
            name: "Streamer Exclusive",
            acquisitionMethod: 'twitch_sub' as const,
            requiresPassword: false,
            isPaid: false,
            isFree: true,
            requiresTwitchSubscription: true,
            requiredTwitchChannels: ["example_streamer", "another_creator"],
        },
    };

    return (
        <div className="space-y-8">
            <Card>
                <CardHeader>
                    <CardTitle>Sistema de Adquisición de Modpacks - Demo</CardTitle>
                    <p className="text-muted-foreground">
                        Demostración completa del nuevo sistema de adquisición con tres métodos: 
                        contraseña, compra (gratis/pagado), y suscripción de Twitch.
                    </p>
                </CardHeader>
            </Card>

            <Tabs defaultValue="acquisition" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="acquisition">
                        <LucideShoppingCart className="w-4 h-4 mr-2" />
                        Adquisición
                    </TabsTrigger>
                    <TabsTrigger value="user">
                        <LucideUser className="w-4 h-4 mr-2" />
                        Usuario
                    </TabsTrigger>
                    <TabsTrigger value="publisher">
                        <LucideDollarSign className="w-4 h-4 mr-2" />
                        Publisher
                    </TabsTrigger>
                    <TabsTrigger value="admin">
                        <LucideSettings className="w-4 h-4 mr-2" />
                        Admin
                    </TabsTrigger>
                </TabsList>

                {/* Acquisition Methods Demo */}
                <TabsContent value="acquisition" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Métodos de Adquisición</CardTitle>
                            <p className="text-muted-foreground">
                                Prueba los diferentes métodos para obtener acceso a modpacks.
                            </p>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Password Protection */}
                                <Card>
                                    <CardContent className="p-4">
                                        <div className="flex items-center gap-2 mb-3">
                                            <LucideShield className="w-5 h-5 text-blue-500" />
                                            <h3 className="font-medium">Protección por Contraseña</h3>
                                        </div>
                                        <p className="text-sm text-muted-foreground mb-3">
                                            El publisher establece una contraseña. El usuario la ingresa una vez
                                            y obtiene acceso permanente.
                                        </p>
                                        <Button 
                                            onClick={() => setShowPasswordDemo(true)}
                                            className="w-full"
                                        >
                                            Probar Acceso con Contraseña
                                        </Button>
                                    </CardContent>
                                </Card>

                                {/* Free Purchase */}
                                <Card>
                                    <CardContent className="p-4">
                                        <div className="flex items-center gap-2 mb-3">
                                            <LucideShoppingCart className="w-5 h-5 text-green-500" />
                                            <h3 className="font-medium">Modpack Gratuito</h3>
                                        </div>
                                        <p className="text-sm text-muted-foreground mb-3">
                                            Modpack sin costo. Un clic para adquirir acceso inmediato.
                                        </p>
                                        <Button 
                                            onClick={() => setShowFreeDemo(true)}
                                            className="w-full"
                                        >
                                            Obtener Gratis
                                        </Button>
                                    </CardContent>
                                </Card>

                                {/* Paid Purchase */}
                                <Card>
                                    <CardContent className="p-4">
                                        <div className="flex items-center gap-2 mb-3">
                                            <LucideShoppingCart className="w-5 h-5 text-yellow-500" />
                                            <h3 className="font-medium">Compra con PayPal</h3>
                                            <Badge variant="secondary">$9.99</Badge>
                                        </div>
                                        <p className="text-sm text-muted-foreground mb-3">
                                            Pago único a través de PayPal. Incluye QR para móviles y 
                                            redirección para escritorio.
                                        </p>
                                        <Button 
                                            onClick={() => setShowPaidDemo(true)}
                                            className="w-full"
                                        >
                                            Comprar por $9.99
                                        </Button>
                                    </CardContent>
                                </Card>

                                {/* Twitch Subscription */}
                                <Card>
                                    <CardContent className="p-4">
                                        <div className="flex items-center gap-2 mb-3">
                                            <MdiTwitch className="w-5 h-5 text-purple-500" />
                                            <h3 className="font-medium">Suscripción de Twitch</h3>
                                        </div>
                                        <p className="text-sm text-muted-foreground mb-3">
                                            Acceso automático con suscripción activa. Se suspende si expira
                                            y se reactiva al renovar.
                                        </p>
                                        <Button 
                                            onClick={() => setShowTwitchDemo(true)}
                                            className="w-full"
                                        >
                                            Verificar Suscripción
                                        </Button>
                                    </CardContent>
                                </Card>
                            </div>

                            <Separator />

                            <div className="text-sm text-muted-foreground space-y-2">
                                <h4 className="font-medium text-foreground">Características del Sistema:</h4>
                                <ul className="list-disc list-inside space-y-1">
                                    <li>Adquisición permanente registrada en base de datos</li>
                                    <li>Estados de acceso: activo, suspendido, revocado</li>
                                    <li>Verificación en tiempo real para suscripciones de Twitch</li>
                                    <li>Integración completa con PayPal (webhooks, QR, comisiones)</li>
                                    <li>Gestión de retiros manual por administradores</li>
                                    <li>UI consistente con el diseño existente</li>
                                </ul>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* User View */}
                <TabsContent value="user" className="space-y-6">
                    <ModpackAccessStatus />
                </TabsContent>

                {/* Publisher View */}
                <TabsContent value="publisher" className="space-y-6">
                    <PublisherEarningsCard publisherId="demo-publisher-id" />
                </TabsContent>

                {/* Admin View */}
                <TabsContent value="admin" className="space-y-6">
                    <WithdrawalsManagement />
                </TabsContent>
            </Tabs>

            {/* Acquisition Dialogs */}
            <ModpackAcquisitionDialog
                isOpen={showPasswordDemo}
                onClose={() => setShowPasswordDemo(false)}
                onSuccess={() => {
                    setShowPasswordDemo(false);
                    // In real implementation, this would refresh the user's access status
                }}
                modpack={demoModpacks.password}
            />

            <ModpackAcquisitionDialog
                isOpen={showFreeDemo}
                onClose={() => setShowFreeDemo(false)}
                onSuccess={() => {
                    setShowFreeDemo(false);
                }}
                modpack={demoModpacks.free}
            />

            <ModpackAcquisitionDialog
                isOpen={showPaidDemo}
                onClose={() => setShowPaidDemo(false)}
                onSuccess={() => {
                    setShowPaidDemo(false);
                }}
                modpack={demoModpacks.paid}
            />

            <ModpackAcquisitionDialog
                isOpen={showTwitchDemo}
                onClose={() => setShowTwitchDemo(false)}
                onSuccess={() => {
                    setShowTwitchDemo(false);
                }}
                modpack={demoModpacks.twitch}
            />
        </div>
    );
};