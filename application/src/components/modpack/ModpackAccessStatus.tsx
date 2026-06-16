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

interface AcquisitionItem {
    acquisition: {
        id: string;
        method: string;
        status: string;
        createdAt: string;
    };
    modpack: {
        id: string;
        name: string;
        slug: string;
        iconUrl: string;
    };
}

export const ModpackAccessStatus = () => {
    const [items, setItems] = useState<AcquisitionItem[]>([]);
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
                const json = await response.json();
                setItems(json.data || []);
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

    const activeItems = items.filter(i => i.acquisition.status === 'active');
    const inactiveItems = items.filter(i => i.acquisition.status !== 'active');

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
                    Mis Modpacks Adquiridos ({items.length})
                </CardTitle>
                {items.length > 0 && (
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
                                        {items.map((item) => (
                                            <TableRow key={item.acquisition.id}>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        {item.modpack.iconUrl && (
                                                            <img
                                                                src={item.modpack.iconUrl}
                                                                alt={item.modpack.name}
                                                                className="w-8 h-8 rounded"
                                                            />
                                                        )}
                                                        <div>
                                                            <div className="font-medium">{item.modpack.name}</div>
                                                            <div className="text-sm text-muted-foreground">
                                                                {item.modpack.slug}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>{item.acquisition.method}</TableCell>
                                                <TableCell>
                                                    <Badge variant={item.acquisition.status === 'active' ? 'default' : 'secondary'}>
                                                        {item.acquisition.status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    {new Date(item.acquisition.createdAt).toLocaleDateString()}
                                                </TableCell>
                                                <TableCell>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => window.open(`/modpack/${item.modpack.slug}`, '_blank')}
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
                {items.length === 0 ? (
                    <div className="text-center py-8">
                        <LucideShield className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                        <p className="text-lg font-medium">No tienes modpacks adquiridos</p>
                        <p className="text-muted-foreground">
                            Explora el catálogo para encontrar modpacks interesantes.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {activeItems.length > 0 && (
                            <div>
                                <h4 className="text-sm font-medium text-muted-foreground mb-2">
                                    Acceso Activo ({activeItems.length})
                                </h4>
                                <div className="grid gap-2">
                                    {activeItems.slice(0, 5).map((item) => (
                                        <div
                                            key={item.acquisition.id}
                                            className="flex items-center justify-between p-3 border rounded-lg"
                                        >
                                            <div className="flex items-center gap-3">
                                                {item.modpack.iconUrl && (
                                                    <img
                                                        src={item.modpack.iconUrl}
                                                        alt={item.modpack.name}
                                                        className="w-10 h-10 rounded"
                                                    />
                                                )}
                                                <div>
                                                    <div className="font-medium">{item.modpack.name}</div>
                                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                        Adquirido por {item.acquisition.method}
                                                        <span>•</span>
                                                        {new Date(item.acquisition.createdAt).toLocaleDateString()}
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
                                                    onClick={() => window.open(`/modpack/${item.modpack.slug}`, '_blank')}
                                                >
                                                    <LucideLink className="w-3 h-3" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {activeItems.length > 5 && (
                                    <p className="text-sm text-muted-foreground mt-2">
                                        Y {activeItems.length - 5} más...
                                    </p>
                                )}
                            </div>
                        )}

                        {inactiveItems.length > 0 && (
                            <div>
                                <h4 className="text-sm font-medium text-muted-foreground mb-2">
                                    Acceso Inactivo ({inactiveItems.length})
                                </h4>
                                <div className="grid gap-2">
                                    {inactiveItems.slice(0, 3).map((item) => (
                                        <div
                                            key={item.acquisition.id}
                                            className="flex items-center justify-between p-3 border rounded-lg opacity-60"
                                        >
                                            <div className="flex items-center gap-3">
                                                {item.modpack.iconUrl && (
                                                    <img
                                                        src={item.modpack.iconUrl}
                                                        alt={item.modpack.name}
                                                        className="w-8 h-8 rounded grayscale"
                                                    />
                                                )}
                                                <div>
                                                    <div className="font-medium">{item.modpack.name}</div>
                                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                        {item.acquisition.method}
                                                        {item.acquisition.status === 'suspended' && (
                                                            <span className="text-orange-500">
                                                                • Renovar suscripción para reactivar
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <Badge variant="secondary">
                                                {item.acquisition.status}
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