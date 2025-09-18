import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    LucideShoppingCart,
    LucideLoader2,
    LucideRefreshCw,
    LucideUser,
    LucidePackage,
    LucideDollarSign,
} from "lucide-react";
import { toast } from "sonner";
import { useAuthentication } from "@/stores/AuthContext";
import { API_ENDPOINT } from "@/consts";

interface PublisherSalesHistoryProps {
    publisherId: string;
    className?: string;
}

interface SaleRecord {
    id: string;
    modpackId: string;
    modpackName: string;
    modpackSlug: string;
    buyerUsername: string;
    pricePaid: number;
    currency: string;
    purchasedAt: string;
    commission: number;
    netEarnings: number;
}

interface SalesData {
    sales: SaleRecord[];
    total: number;
    page: number;
    totalPages: number;
}

export const PublisherSalesHistory = ({ publisherId, className }: PublisherSalesHistoryProps) => {
    const [salesData, setSalesData] = useState<SalesData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [isLoadingPage, setIsLoadingPage] = useState(false);

    const { sessionTokens } = useAuthentication();

    useEffect(() => {
        loadSalesHistory();
    }, [publisherId, currentPage]);

    const loadSalesHistory = async () => {
        if (!sessionTokens?.accessToken) return;

        setIsLoadingPage(true);

        try {
            const response = await fetch(`${API_ENDPOINT}/creators/publishers/${publisherId}/sales?page=${currentPage}&limit=20`, {
                headers: {
                    'Authorization': `Bearer ${sessionTokens.accessToken}`,
                },
            });

            if (response.ok) {
                const data = await response.json();
                setSalesData(data);
            } else {
                toast.error('Error al cargar historial de ventas');
            }
        } catch (error) {
            console.error('Error loading sales history:', error);
            toast.error('Error al cargar historial de ventas');
        } finally {
            setIsLoading(false);
            setIsLoadingPage(false);
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-ES', {
            style: 'currency',
            currency: 'USD',
        }).format(amount);
    };

    if (isLoading) {
        return (
            <Card className={className}>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <LucideShoppingCart className="w-5 h-5" />
                        Historial de Ventas
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-center p-8">
                        <LucideLoader2 className="w-6 h-6 animate-spin" />
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (!salesData) {
        return (
            <Card className={className}>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <LucideShoppingCart className="w-5 h-5" />
                        Historial de Ventas
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground">No se pudo cargar el historial de ventas.</p>
                </CardContent>
            </Card>
        );
    }

    const totalEarnings = salesData.sales.reduce((sum, sale) => sum + sale.netEarnings, 0);
    const totalCommission = salesData.sales.reduce((sum, sale) => sum + sale.commission, 0);
    const totalSales = salesData.sales.reduce((sum, sale) => sum + sale.pricePaid, 0);

    return (
        <Card className={className}>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                        <LucideShoppingCart className="w-5 h-5" />
                        Historial de Ventas
                    </CardTitle>
                    <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                            setCurrentPage(1);
                            loadSalesHistory();
                        }}
                        disabled={isLoadingPage}
                    >
                        <LucideRefreshCw className={`w-4 h-4 mr-2 ${isLoadingPage ? 'animate-spin' : ''}`} />
                        Actualizar
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Summary Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
                    <div className="text-center">
                        <p className="text-sm text-muted-foreground">Total Ventas (Esta página)</p>
                        <p className="text-lg font-semibold text-blue-600">{formatCurrency(totalSales)}</p>
                    </div>
                    <div className="text-center">
                        <p className="text-sm text-muted-foreground">Comisión (30%)</p>
                        <p className="text-lg font-semibold text-orange-600">{formatCurrency(totalCommission)}</p>
                    </div>
                    <div className="text-center">
                        <p className="text-sm text-muted-foreground">Ganancias Netas (70%)</p>
                        <p className="text-lg font-semibold text-green-600">{formatCurrency(totalEarnings)}</p>
                    </div>
                </div>

                {/* Currency Info */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground bg-blue-50 p-3 rounded-lg">
                    <LucideDollarSign className="w-4 h-4 text-blue-600" />
                    <span><strong>Moneda:</strong> USD (Dólares Estadounidenses). Todos los precios y ganancias están en USD.</span>
                </div>

                {/* Sales Table */}
                {salesData.sales.length > 0 ? (
                    <>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>
                                        <div className="flex items-center gap-2">
                                            <LucidePackage className="w-4 h-4" />
                                            Modpack
                                        </div>
                                    </TableHead>
                                    <TableHead>
                                        <div className="flex items-center gap-2">
                                            <LucideUser className="w-4 h-4" />
                                            Comprador
                                        </div>
                                    </TableHead>
                                    <TableHead>Precio</TableHead>
                                    <TableHead>Comisión</TableHead>
                                    <TableHead>Ganancia</TableHead>
                                    <TableHead>Fecha</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {salesData.sales.map((sale) => (
                                    <TableRow key={sale.id}>
                                        <TableCell className="font-medium">
                                            <div>
                                                <p className="font-semibold">{sale.modpackName}</p>
                                                <p className="text-sm text-muted-foreground">/{sale.modpackSlug}</p>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="secondary">{sale.buyerUsername}</Badge>
                                        </TableCell>
                                        <TableCell className="font-semibold text-blue-600">
                                            {formatCurrency(sale.pricePaid)}
                                        </TableCell>
                                        <TableCell className="text-orange-600">
                                            -{formatCurrency(sale.commission)}
                                        </TableCell>
                                        <TableCell className="font-semibold text-green-600">
                                            +{formatCurrency(sale.netEarnings)}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">
                                            {formatDate(sale.purchasedAt)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>

                        {/* Pagination */}
                        {salesData.totalPages > 1 && (
                            <div className="flex items-center justify-between">
                                <p className="text-sm text-muted-foreground">
                                    Página {salesData.page} de {salesData.totalPages} ({salesData.total} ventas total)
                                </p>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setCurrentPage(currentPage - 1)}
                                        disabled={currentPage <= 1 || isLoadingPage}
                                    >
                                        Anterior
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setCurrentPage(currentPage + 1)}
                                        disabled={currentPage >= salesData.totalPages || isLoadingPage}
                                    >
                                        Siguiente
                                    </Button>
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="text-center py-8">
                        <LucideShoppingCart className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">No hay ventas registradas aún.</p>
                        <p className="text-sm text-muted-foreground mt-2">
                            Cuando alguien compre tus modpacks de pago, aparecerán aquí.
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};