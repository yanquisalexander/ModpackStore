import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
    LucideShield,
    LucideShoppingCart,
    LucideHistory,
    LucideLoader2,
    LucideCheck,
    LucideClock,
    LucideX,
    LucideLink,
} from "lucide-react";
import { MdiTwitch } from "@/icons/MdiTwitch";
import { toast } from "sonner";
import { useAuthentication } from "@/stores/AuthContext";
import { API_ENDPOINT } from "@/consts";

interface ModpackAcquisition {
    id: string;
    modpack: {
        id: string;
        name: string;
        iconUrl?: string;
        slug: string;
    };
    method: 'free' | 'paid' | 'password' | 'twitch_sub';
    status: 'active' | 'revoked' | 'suspended';
    createdAt: string;
    transactionId?: string;
}

interface AcquisitionsData {
    acquisitions: ModpackAcquisition[];
    total: number;
    page: number;
    totalPages: number;
}

export const ModpackAccessStatus = () => {
    const [acquisitions, setAcquisitions] = useState<AcquisitionsData>({
        acquisitions: [],
        total: 0,
        page: 1,
        totalPages: 1
    });
    const [isLoading, setIsLoading] = useState(true);
    const [showHistoryDialog, setShowHistoryDialog] = useState(false);

    const { sessionTokens } = useAuthentication();

    useEffect(() => {
        loadAcquisitions();
    }, []);

    const loadAcquisitions = async () => {
        if (!sessionTokens?.accessToken) return;

        setIsLoading(true);
        try {
            const response = await fetch(`${API_ENDPOINT}/explore/user/acquisitions`, {
                headers: {
                    'Authorization': `Bearer ${sessionTokens.accessToken}`,
                },
            });

            if (response.ok) {
                const data = await response.json();
                setAcquisitions(data);
            } else {
                toast.error('Error al cargar tus modpacks adquiridos');
            }
        } catch (error) {
            console.error('Error loading acquisitions:', error);
            toast.error('Error al cargar tus modpacks adquiridos');
        } finally {
            setIsLoading(false);
        }
    };

    const getMethodIcon = (method: ModpackAcquisition['method']) => {
        switch (method) {
            case 'password': return <LucideShield className="w-4 h-4" />;
            case 'free':
            case 'paid': return <LucideShoppingCart className="w-4 h-4" />;
            case 'twitch_sub': return <MdiTwitch className="w-4 h-4" />;
        }
    };

    const getMethodText = (method: ModpackAcquisition['method']) => {
        switch (method) {
            case 'password': return 'Contraseña';
            case 'free': return 'Gratuito';
            case 'paid': return 'Compra';
            case 'twitch_sub': return 'Twitch';
        }
    };

    const getStatusBadgeVariant = (status: ModpackAcquisition['status']) => {
        switch (status) {
            case 'active': return 'default';
            case 'suspended': return 'secondary';
            case 'revoked': return 'destructive';
        }
    };

    const getStatusText = (status: ModpackAcquisition['status']) => {
        switch (status) {
            case 'active': return 'Activo';
            case 'suspended': return 'Suspendido';
            case 'revoked': return 'Revocado';
        }
    };

    const getStatusIcon = (status: ModpackAcquisition['status']) => {
        switch (status) {
            case 'active': return <LucideCheck className="w-4 h-4" />;
            case 'suspended': return <LucideClock className="w-4 h-4" />;
            case 'revoked': return <LucideX className="w-4 h-4" />;
        }
    };

    const activeAcquisitions = acquisitions.acquisitions.filter(a => a.status === 'active');
    const inactiveAcquisitions = acquisitions.acquisitions.filter(a => a.status !== 'active');

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <LucideShield className="w-5 h-5" />
                        Mis Modpacks Adquiridos
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

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <LucideShield className="w-5 h-5" />
                    Mis Modpacks Adquiridos ({acquisitions.total})
                </CardTitle>
                {acquisitions.total > 0 && (
                    <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
                        <DialogTrigger asChild>
                            <Button variant="outline" size="sm">
                                <LucideHistory className="w-4 h-4 mr-2" />
                                Ver Todos
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-4xl">
                            <DialogHeader>
                                <DialogTitle>Historial Completo de Adquisiciones</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Modpack</TableHead>
                                            <TableHead>Método</TableHead>
                                            <TableHead>Estado</TableHead>
                                            <TableHead>Fecha</TableHead>
                                            <TableHead>Acción</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {acquisitions.acquisitions.map((acquisition) => (
                                            <TableRow key={acquisition.id}>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        {acquisition.modpack.iconUrl && (
                                                            <img
                                                                src={acquisition.modpack.iconUrl}
                                                                alt={acquisition.modpack.name}
                                                                className="w-8 h-8 rounded"
                                                            />
                                                        )}
                                                        <div>
                                                            <div className="font-medium">{acquisition.modpack.name}</div>
                                                            <div className="text-sm text-muted-foreground">
                                                                {acquisition.modpack.slug}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        {getMethodIcon(acquisition.method)}
                                                        {getMethodText(acquisition.method)}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={getStatusBadgeVariant(acquisition.status)}>
                                                        <div className="flex items-center gap-1">
                                                            {getStatusIcon(acquisition.status)}
                                                            {getStatusText(acquisition.status)}
                                                        </div>
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    {new Date(acquisition.createdAt).toLocaleDateString()}
                                                </TableCell>
                                                <TableCell>
                                                    <Button 
                                                        size="sm" 
                                                        variant="outline"
                                                        onClick={() => window.open(`/modpack/${acquisition.modpack.slug}`, '_blank')}
                                                    >
                                                        <LucideLink className="w-3 h-3 mr-1" />
                                                        Ver
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </DialogContent>
                    </Dialog>
                )}
            </CardHeader>
            <CardContent>
                {acquisitions.total === 0 ? (
                    <div className="text-center py-8">
                        <LucideShield className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                        <p className="text-lg font-medium">No tienes modpacks adquiridos</p>
                        <p className="text-muted-foreground">
                            Explora el catálogo para encontrar modpacks interesantes.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Active Acquisitions */}
                        {activeAcquisitions.length > 0 && (
                            <div>
                                <h4 className="text-sm font-medium text-muted-foreground mb-2">
                                    Acceso Activo ({activeAcquisitions.length})
                                </h4>
                                <div className="grid gap-2">
                                    {activeAcquisitions.slice(0, 5).map((acquisition) => (
                                        <div
                                            key={acquisition.id}
                                            className="flex items-center justify-between p-3 border rounded-lg"
                                        >
                                            <div className="flex items-center gap-3">
                                                {acquisition.modpack.iconUrl && (
                                                    <img
                                                        src={acquisition.modpack.iconUrl}
                                                        alt={acquisition.modpack.name}
                                                        className="w-10 h-10 rounded"
                                                    />
                                                )}
                                                <div>
                                                    <div className="font-medium">{acquisition.modpack.name}</div>
                                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                        {getMethodIcon(acquisition.method)}
                                                        Adquirido por {getMethodText(acquisition.method)}
                                                        <span>•</span>
                                                        {new Date(acquisition.createdAt).toLocaleDateString()}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Badge variant="default">
                                                    <LucideCheck className="w-3 h-3 mr-1" />
                                                    Activo
                                                </Badge>
                                                <Button 
                                                    size="sm" 
                                                    variant="ghost"
                                                    onClick={() => window.open(`/modpack/${acquisition.modpack.slug}`, '_blank')}
                                                >
                                                    <LucideLink className="w-3 h-3" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {activeAcquisitions.length > 5 && (
                                    <p className="text-sm text-muted-foreground mt-2">
                                        Y {activeAcquisitions.length - 5} más...
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Inactive Acquisitions */}
                        {inactiveAcquisitions.length > 0 && (
                            <div>
                                <h4 className="text-sm font-medium text-muted-foreground mb-2">
                                    Acceso Inactivo ({inactiveAcquisitions.length})
                                </h4>
                                <div className="grid gap-2">
                                    {inactiveAcquisitions.slice(0, 3).map((acquisition) => (
                                        <div
                                            key={acquisition.id}
                                            className="flex items-center justify-between p-3 border rounded-lg opacity-60"
                                        >
                                            <div className="flex items-center gap-3">
                                                {acquisition.modpack.iconUrl && (
                                                    <img
                                                        src={acquisition.modpack.iconUrl}
                                                        alt={acquisition.modpack.name}
                                                        className="w-8 h-8 rounded grayscale"
                                                    />
                                                )}
                                                <div>
                                                    <div className="font-medium">{acquisition.modpack.name}</div>
                                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                        {getMethodIcon(acquisition.method)}
                                                        {getMethodText(acquisition.method)}
                                                        {acquisition.status === 'suspended' && (
                                                            <span className="text-orange-500">
                                                                • Renovar suscripción para reactivar
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <Badge variant={getStatusBadgeVariant(acquisition.status)}>
                                                {getStatusIcon(acquisition.status)}
                                                {getStatusText(acquisition.status)}
                                            </Badge>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};