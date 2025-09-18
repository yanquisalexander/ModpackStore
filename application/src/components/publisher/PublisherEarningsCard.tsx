import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    LucideDollarSign,
    LucideDownload,
    LucideHistory,
    LucideInfo,
    LucideLoader2,
} from "lucide-react";
import { toast } from "sonner";
import { useAuthentication } from "@/stores/AuthContext";
import { API_ENDPOINT } from "@/consts";

interface PublisherEarningsProps {
    publisherId: string;
    className?: string;
}

interface EarningsSummary {
    earnings: {
        totalEarnings: number;
        availableBalance: number;
        pendingWithdrawals: number;
        totalWithdrawn: number;
    };
    settings: {
        commissionRate: number;
        minimumWithdrawal: number;
    };
    canWithdraw: boolean;
}

interface WithdrawalRequest {
    id: string;
    amount: string;
    paypalEmail: string;
    status: 'pending' | 'approved' | 'rejected' | 'completed';
    requestedAt: string;
    processedAt?: string;
    notes?: string;
    transactionId?: string;
}

export const PublisherEarningsCard = ({ publisherId, className }: PublisherEarningsProps) => {
    const [earningsSummary, setEarningsSummary] = useState<EarningsSummary | null>(null);
    const [withdrawalHistory, setWithdrawalHistory] = useState<WithdrawalRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRequestingWithdrawal, setIsRequestingWithdrawal] = useState(false);
    const [showWithdrawalDialog, setShowWithdrawalDialog] = useState(false);
    const [showHistoryDialog, setShowHistoryDialog] = useState(false);
    const [withdrawalAmount, setWithdrawalAmount] = useState("");
    const [paypalEmail, setPaypalEmail] = useState("");

    const { sessionTokens } = useAuthentication();

    useEffect(() => {
        loadEarningsSummary();
    }, [publisherId]);

    const loadEarningsSummary = async () => {
        if (!sessionTokens?.accessToken) return;

        try {
            const response = await fetch(`${API_ENDPOINT}/creators/publishers/${publisherId}/earnings`, {
                headers: {
                    'Authorization': `Bearer ${sessionTokens.accessToken}`,
                },
            });

            if (response.ok) {
                const data = await response.json();
                setEarningsSummary(data);
            } else {
                toast.error('Error al cargar información de ganancias');
            }
        } catch (error) {
            console.error('Error loading earnings:', error);
            toast.error('Error al cargar información de ganancias');
        } finally {
            setIsLoading(false);
        }
    };

    const loadWithdrawalHistory = async () => {
        if (!sessionTokens?.accessToken) return;

        try {
            const response = await fetch(`${API_ENDPOINT}/creators/publishers/${publisherId}/withdrawals`, {
                headers: {
                    'Authorization': `Bearer ${sessionTokens.accessToken}`,
                },
            });

            if (response.ok) {
                const data = await response.json();
                setWithdrawalHistory(data.data || []);
            }
        } catch (error) {
            console.error('Error loading withdrawal history:', error);
        }
    };

    const requestWithdrawal = async () => {
        if (!sessionTokens?.accessToken) return;

        const amount = parseFloat(withdrawalAmount);
        if (!amount || amount <= 0) {
            toast.error('Ingresa una cantidad válida');
            return;
        }

        if (!paypalEmail || !paypalEmail.includes('@')) {
            toast.error('Ingresa un email de PayPal válido');
            return;
        }

        if (earningsSummary && amount > earningsSummary.earnings.availableBalance) {
            toast.error('Cantidad excede el saldo disponible');
            return;
        }

        if (earningsSummary && amount < earningsSummary.settings.minimumWithdrawal) {
            toast.error(`Cantidad mínima de retiro: $${earningsSummary.settings.minimumWithdrawal}`);
            return;
        }

        setIsRequestingWithdrawal(true);

        try {
            const response = await fetch(`${API_ENDPOINT}/creators/publishers/${publisherId}/withdrawals`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${sessionTokens.accessToken}`,
                },
                body: JSON.stringify({
                    amount: amount.toString(),
                    paypalEmail,
                }),
            });

            if (response.ok) {
                toast.success('Solicitud de retiro enviada exitosamente');
                setShowWithdrawalDialog(false);
                setWithdrawalAmount("");
                setPaypalEmail("");
                loadEarningsSummary();
            } else {
                const error = await response.json();
                toast.error(error.detail || 'Error al solicitar retiro');
            }
        } catch (error) {
            console.error('Error requesting withdrawal:', error);
            toast.error('Error al solicitar retiro');
        } finally {
            setIsRequestingWithdrawal(false);
        }
    };

    const getStatusBadgeVariant = (status: WithdrawalRequest['status']) => {
        switch (status) {
            case 'pending': return 'default';
            case 'approved': return 'secondary';
            case 'completed': return 'default';
            case 'rejected': return 'destructive';
            default: return 'default';
        }
    };

    const getStatusText = (status: WithdrawalRequest['status']) => {
        switch (status) {
            case 'pending': return 'Pendiente';
            case 'approved': return 'Aprobado';
            case 'completed': return 'Completado';
            case 'rejected': return 'Rechazado';
            default: return status;
        }
    };

    if (isLoading) {
        return (
            <Card className={className}>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <LucideDollarSign className="w-5 h-5" />
                        Ganancias
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

    if (!earningsSummary) {
        return (
            <Card className={className}>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <LucideDollarSign className="w-5 h-5" />
                        Ganancias
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground">No se pudo cargar la información de ganancias.</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className={className}>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <LucideDollarSign className="w-5 h-5" />
                    Ganancias del Publisher
                    <div className="text-xs text-blue-600 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded ml-auto">USD</div>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Earnings Summary */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <p className="text-sm text-muted-foreground">Saldo Disponible</p>
                        <p className="text-2xl font-bold">${earningsSummary.earnings.availableBalance.toFixed(2)}</p>
                    </div>
                    <div>
                        <p className="text-sm text-muted-foreground">Ganancias Totales</p>
                        <p className="text-xl font-semibold">${earningsSummary.earnings.totalEarnings.toFixed(2)}</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <p className="text-sm text-muted-foreground">Retiros Pendientes</p>
                        <p className="text-lg">${earningsSummary.earnings.pendingWithdrawals.toFixed(2)}</p>
                    </div>
                    <div>
                        <p className="text-sm text-muted-foreground">Total Retirado</p>
                        <p className="text-lg">${earningsSummary.earnings.totalWithdrawn.toFixed(2)}</p>
                    </div>
                </div>

                <Separator />

                {/* Commission Info */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <LucideInfo className="w-4 h-4" />
                    <span>Comisión de plataforma: {(earningsSummary.settings.commissionRate * 100).toFixed(1)}%</span>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                    <Dialog open={showWithdrawalDialog} onOpenChange={setShowWithdrawalDialog}>
                        <DialogTrigger asChild>
                            <Button 
                                disabled={!earningsSummary.canWithdraw} 
                                className="flex-1"
                            >
                                <LucideDownload className="w-4 h-4 mr-2" />
                                Solicitar Retiro
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Solicitar Retiro de Fondos</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                                <div>
                                    <Label htmlFor="amount">Cantidad (USD)</Label>
                                    <Input
                                        id="amount"
                                        type="number"
                                        step="0.01"
                                        min={earningsSummary.settings.minimumWithdrawal}
                                        max={earningsSummary.earnings.availableBalance}
                                        value={withdrawalAmount}
                                        onChange={(e) => setWithdrawalAmount(e.target.value)}
                                        placeholder={`Mínimo: $${earningsSummary.settings.minimumWithdrawal}`}
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="paypal">Email de PayPal</Label>
                                    <Input
                                        id="paypal"
                                        type="email"
                                        value={paypalEmail}
                                        onChange={(e) => setPaypalEmail(e.target.value)}
                                        placeholder="tu-email@example.com"
                                    />
                                </div>
                                <div className="text-sm text-muted-foreground">
                                    <p>• Cantidad disponible: ${earningsSummary.earnings.availableBalance.toFixed(2)}</p>
                                    <p>• Mínimo de retiro: ${earningsSummary.settings.minimumWithdrawal.toFixed(2)}</p>
                                    <p>• Los retiros son procesados manualmente por el equipo de administración.</p>
                                </div>
                                <div className="flex gap-2">
                                    <Button 
                                        variant="outline" 
                                        onClick={() => setShowWithdrawalDialog(false)}
                                        className="flex-1"
                                    >
                                        Cancelar
                                    </Button>
                                    <Button 
                                        onClick={requestWithdrawal}
                                        disabled={isRequestingWithdrawal}
                                        className="flex-1"
                                    >
                                        {isRequestingWithdrawal && <LucideLoader2 className="w-4 h-4 mr-2 animate-spin" />}
                                        Solicitar
                                    </Button>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>

                    <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
                        <DialogTrigger asChild>
                            <Button variant="outline" onClick={loadWithdrawalHistory}>
                                <LucideHistory className="w-4 h-4 mr-2" />
                                Historial
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-2xl">
                            <DialogHeader>
                                <DialogTitle>Historial de Retiros</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                                {withdrawalHistory.length > 0 ? (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Cantidad</TableHead>
                                                <TableHead>Estado</TableHead>
                                                <TableHead>Fecha</TableHead>
                                                <TableHead>PayPal</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {withdrawalHistory.map((withdrawal) => (
                                                <TableRow key={withdrawal.id}>
                                                    <TableCell className="font-medium">
                                                        ${parseFloat(withdrawal.amount).toFixed(2)}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant={getStatusBadgeVariant(withdrawal.status)}>
                                                            {getStatusText(withdrawal.status)}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        {new Date(withdrawal.requestedAt).toLocaleDateString()}
                                                    </TableCell>
                                                    <TableCell>
                                                        {withdrawal.paypalEmail}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                ) : (
                                    <p className="text-muted-foreground text-center py-8">
                                        No hay retiros en el historial.
                                    </p>
                                )}
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>

                {!earningsSummary.canWithdraw && (
                    <p className="text-sm text-muted-foreground">
                        Saldo mínimo requerido para retiro: ${earningsSummary.settings.minimumWithdrawal.toFixed(2)}
                    </p>
                )}
            </CardContent>
        </Card>
    );
};