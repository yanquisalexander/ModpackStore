import React from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
    LucideHandCoins,
    LucideTrendingUp,
    LucideCreditCard,
    LucideDownload,
    LucideAlertCircle
} from 'lucide-react';
import { PublisherEarningsCard } from '@/components/publisher/PublisherEarningsCard';
import { PublisherSalesHistory } from '@/components/publisher/PublisherSalesHistory';

export const PublisherPaymentsView: React.FC = () => {
    const { publisherId } = useParams<{ publisherId: string }>();

    if (!publisherId) {
        return (
            <div className="text-center py-8">
                <Alert variant="destructive">
                    <LucideAlertCircle className="h-4 w-4" />
                    <AlertDescription>
                        Publisher ID no encontrado.
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <LucideHandCoins className="h-5 w-5" />
                            <CardTitle>Gestión de Pagos</CardTitle>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" disabled>
                                <LucideDownload className="h-4 w-4 mr-2" />
                                Exportar Reporte
                            </Button>
                            <Button disabled>
                                <LucideCreditCard className="h-4 w-4 mr-2" />
                                Retirar Fondos
                            </Button>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            {/* Earnings and Sales Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <PublisherEarningsCard publisherId={publisherId} />
                <PublisherSalesHistory publisherId={publisherId} />
            </div>

            {/* Payment Methods Section */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <LucideCreditCard className="h-5 w-5" />
                        Métodos de Pago
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <Alert>
                        <LucideAlertCircle className="h-4 w-4" />
                        <AlertDescription>
                            La configuración de métodos de pago estará disponible próximamente.
                        </AlertDescription>
                    </Alert>
                </CardContent>
            </Card>

            {/* Transaction History Section */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <LucideTrendingUp className="h-5 w-5" />
                        Historial de Transacciones
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <Alert>
                        <LucideAlertCircle className="h-4 w-4" />
                        <AlertDescription>
                            El historial de transacciones estará disponible próximamente.
                        </AlertDescription>
                    </Alert>
                </CardContent>
            </Card>
        </div>
    );
};