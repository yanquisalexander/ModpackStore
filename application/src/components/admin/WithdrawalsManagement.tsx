import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
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
import {
    LucideCheck,
    LucideX,
    LucideEye,
    LucideLoader2,
    LucideRefreshCw,
    LucideDollarSign,
} from "lucide-react";
import { toast } from "sonner";
import { useAuthentication } from "@/stores/AuthContext";
import { API_ENDPOINT } from "@/consts";

interface WithdrawalRequest {
    id: string;
    publisherId: string;
    publisher: {
        publisherName: string;
    };
    amount: string;
    paypalEmail: string;
    status: 'pending' | 'approved' | 'rejected' | 'completed';
    requestedAt: string;
    processedAt?: string;
    processedByUserId?: string;
    notes?: string;
    transactionId?: string;
}

interface WithdrawalsData {
    requests: WithdrawalRequest[];
    total: number;
    page: number;
    totalPages: number;
}

export const WithdrawalsManagement = () => {
    const [withdrawals, setWithdrawals] = useState<WithdrawalsData>({
        requests: [],
        total: 0,
        page: 1,
        totalPages: 1
    });
    const [isLoading, setIsLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<string>('pending');
    const [selectedWithdrawal, setSelectedWithdrawal] = useState<WithdrawalRequest | null>(null);
    const [showActionDialog, setShowActionDialog] = useState(false);
    const [actionType, setActionType] = useState<'approve' | 'reject' | 'complete' | null>(null);
    const [actionNotes, setActionNotes] = useState('');
    const [transactionId, setTransactionId] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    const { sessionTokens } = useAuthentication();

    useEffect(() => {
        loadWithdrawals();
    }, [statusFilter]);

    const loadWithdrawals = async () => {
        if (!sessionTokens?.accessToken) return;

        setIsLoading(true);
        try {
            const params = new URLSearchParams({
                ...(statusFilter && { status: statusFilter }),
                limit: '20'
            });

            const response = await fetch(`${API_ENDPOINT}/admin/withdrawals?${params}`, {
                headers: {
                    'Authorization': `Bearer ${sessionTokens.accessToken}`,
                },
            });

            if (response.ok) {
                const data = await response.json();
                setWithdrawals(data);
            } else {
                toast.error('Error al cargar solicitudes de retiro');
            }
        } catch (error) {
            console.error('Error loading withdrawals:', error);
            toast.error('Error al cargar solicitudes de retiro');
        } finally {
            setIsLoading(false);
        }
    };

    const handleAction = async () => {
        if (!selectedWithdrawal || !actionType || !sessionTokens?.accessToken) return;

        if (actionType === 'reject' && !actionNotes.trim()) {
            toast.error('Se requiere una razón para rechazar la solicitud');
            return;
        }

        if (actionType === 'complete' && !transactionId.trim()) {
            toast.error('Se requiere el ID de transacción externa');
            return;
        }

        setIsProcessing(true);

        try {
            const endpoint = `${API_ENDPOINT}/admin/withdrawals/${selectedWithdrawal.id}/${actionType}`;
            const body: any = {};

            if (actionType === 'reject') {
                body.notes = actionNotes;
            } else if (actionType === 'complete') {
                body.externalTransactionId = transactionId;
                if (actionNotes.trim()) body.notes = actionNotes;
            } else if (actionType === 'approve' && actionNotes.trim()) {
                body.notes = actionNotes;
            }

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${sessionTokens.accessToken}`,
                },
                body: JSON.stringify(body),
            });

            if (response.ok) {
                const actionText = {
                    approve: 'aprobada',
                    reject: 'rechazada',
                    complete: 'marcada como completada'
                };

                toast.success(`Solicitud ${actionText[actionType]} exitosamente`);
                setShowActionDialog(false);
                resetActionForm();
                loadWithdrawals();
            } else {
                const error = await response.json();
                toast.error(error.detail || 'Error al procesar la acción');
            }
        } catch (error) {
            console.error('Error processing action:', error);
            toast.error('Error al procesar la acción');
        } finally {
            setIsProcessing(false);
        }
    };

    const resetActionForm = () => {
        setSelectedWithdrawal(null);
        setActionType(null);
        setActionNotes('');
        setTransactionId('');
    };

    const openActionDialog = (withdrawal: WithdrawalRequest, action: 'approve' | 'reject' | 'complete') => {
        setSelectedWithdrawal(withdrawal);
        setActionType(action);
        setShowActionDialog(true);
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

    const getActionTitle = () => {
        switch (actionType) {
            case 'approve': return 'Aprobar Solicitud';
            case 'reject': return 'Rechazar Solicitud';
            case 'complete': return 'Marcar como Completado';
            default: return 'Acción';
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <LucideDollarSign className="w-5 h-5" />
                    Gestión de Retiros
                </CardTitle>
                <div className="flex items-center justify-between">
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-48">
                            <SelectValue placeholder="Filtrar por estado" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="">Todos</SelectItem>
                            <SelectItem value="pending">Pendientes</SelectItem>
                            <SelectItem value="approved">Aprobados</SelectItem>
                            <SelectItem value="completed">Completados</SelectItem>
                            <SelectItem value="rejected">Rechazados</SelectItem>
                        </SelectContent>
                    </Select>

                    <Button variant="outline" onClick={loadWithdrawals} disabled={isLoading}>
                        <LucideRefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                        Actualizar
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex items-center justify-center p-8">
                        <LucideLoader2 className="w-6 h-6 animate-spin" />
                    </div>
                ) : withdrawals.requests.length > 0 ? (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Publisher</TableHead>
                                <TableHead>Cantidad</TableHead>
                                <TableHead>PayPal</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead>Fecha Solicitud</TableHead>
                                <TableHead>Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {withdrawals.requests.map((withdrawal) => (
                                <TableRow key={withdrawal.id}>
                                    <TableCell>
                                        <div>
                                            <div className="font-medium">{withdrawal.publisher.publisherName}</div>
                                            <div className="text-sm text-muted-foreground">ID: {withdrawal.publisherId.slice(0, 8)}...</div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="font-medium">
                                        ${parseFloat(withdrawal.amount).toFixed(2)}
                                    </TableCell>
                                    <TableCell>{withdrawal.paypalEmail}</TableCell>
                                    <TableCell>
                                        <Badge variant={getStatusBadgeVariant(withdrawal.status)}>
                                            {getStatusText(withdrawal.status)}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        {new Date(withdrawal.requestedAt).toLocaleDateString()}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex gap-1">
                                            {withdrawal.status === 'pending' && (
                                                <>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => openActionDialog(withdrawal, 'approve')}
                                                    >
                                                        <LucideCheck className="w-3 h-3" />
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => openActionDialog(withdrawal, 'reject')}
                                                    >
                                                        <LucideX className="w-3 h-3" />
                                                    </Button>
                                                </>
                                            )}
                                            {withdrawal.status === 'approved' && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => openActionDialog(withdrawal, 'complete')}
                                                >
                                                    <LucideCheck className="w-3 h-3 mr-1" />
                                                    Completar
                                                </Button>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                ) : (
                    <p className="text-muted-foreground text-center py-8">
                        No hay solicitudes de retiro {statusFilter ? `con estado "${getStatusText(statusFilter as any)}"` : ''}.
                    </p>
                )}
            </CardContent>

            {/* Action Dialog */}
            <Dialog open={showActionDialog} onOpenChange={(open) => {
                if (!open) {
                    setShowActionDialog(false);
                    resetActionForm();
                }
            }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{getActionTitle()}</DialogTitle>
                    </DialogHeader>
                    
                    {selectedWithdrawal && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                                <div>
                                    <Label>Publisher</Label>
                                    <p className="font-medium">{selectedWithdrawal.publisher.publisherName}</p>
                                </div>
                                <div>
                                    <Label>Cantidad</Label>
                                    <p className="font-medium">${parseFloat(selectedWithdrawal.amount).toFixed(2)}</p>
                                </div>
                                <div className="col-span-2">
                                    <Label>Email PayPal</Label>
                                    <p className="font-medium">{selectedWithdrawal.paypalEmail}</p>
                                </div>
                            </div>

                            {actionType === 'complete' && (
                                <div>
                                    <Label htmlFor="transactionId">ID de Transacción Externa *</Label>
                                    <Input
                                        id="transactionId"
                                        value={transactionId}
                                        onChange={(e) => setTransactionId(e.target.value)}
                                        placeholder="ID de la transacción PayPal"
                                    />
                                </div>
                            )}

                            <div>
                                <Label htmlFor="notes">
                                    Notas {actionType === 'reject' ? '*' : '(opcional)'}
                                </Label>
                                <Textarea
                                    id="notes"
                                    value={actionNotes}
                                    onChange={(e) => setActionNotes(e.target.value)}
                                    placeholder={
                                        actionType === 'reject' 
                                            ? "Razón del rechazo (requerido)" 
                                            : "Notas adicionales (opcional)"
                                    }
                                />
                            </div>

                            <div className="flex gap-2">
                                <Button 
                                    variant="outline" 
                                    onClick={() => setShowActionDialog(false)}
                                    className="flex-1"
                                >
                                    Cancelar
                                </Button>
                                <Button 
                                    onClick={handleAction}
                                    disabled={isProcessing}
                                    className="flex-1"
                                    variant={actionType === 'reject' ? 'destructive' : 'default'}
                                >
                                    {isProcessing && <LucideLoader2 className="w-4 h-4 mr-2 animate-spin" />}
                                    {actionType === 'approve' && 'Aprobar'}
                                    {actionType === 'reject' && 'Rechazar'}
                                    {actionType === 'complete' && 'Marcar Completado'}
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </Card>
    );
};