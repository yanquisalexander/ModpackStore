import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import {
    LucidePackage,
    LucideLoader,
    LucidePlus,
    LucideMoreHorizontal,
    LucideEdit,
    LucideSettings,
    LucideTrash2,
    LucideHistory
} from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuthentication } from '@/stores/AuthContext';
import { API_ENDPOINT } from '@/consts';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import CreateModpackDialog from '@/components/creator/dialogs/CreateModpackDialog';
import EditModpackDialog from '@/components/creator/dialogs/EditModpackDialog';

// Types
interface Modpack {
    id: string;
    name: string;
    slug: string;
    shortDescription?: string;
    iconUrl: string;
    visibility: string;
    status: string;
    createdAt: string;
    updatedAt: string;
    creatorUser?: {
        username: string;
    };
}

// API Service for publisher modpacks
class PublisherModpacksAPI {
    private static baseUrl = `${API_ENDPOINT}/creators/publishers`;

    static async getModpacks(publisherId: string, accessToken: string): Promise<Modpack[]> {
        const response = await fetch(`${this.baseUrl}/${publisherId}/modpacks`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || `Error fetching modpacks: ${response.statusText}`);
        }

        const { modpacks } = await response.json();

        return modpacks;
    }

    static async deleteModpack(publisherId: string, modpackId: string, accessToken: string): Promise<void> {
        const response = await fetch(`${this.baseUrl}/${publisherId}/modpacks/${modpackId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || `Error deleting modpack: ${response.statusText}`);
        }
    }
}

// Helper functions
const getStatusBadgeVariant = (status: string) => {
    switch (status.toLowerCase()) {
        case 'published': return 'default';
        case 'draft': return 'secondary';
        case 'archived': return 'outline';
        default: return 'outline';
    }
};

const getStatusLabel = (status: string) => {
    switch (status.toLowerCase()) {
        case 'published': return 'Publicado';
        case 'draft': return 'Borrador';
        case 'deleted': return 'Eliminado';
        case 'archived': return 'Archivado';
        default: return status;
    }
};

const getVisibilityBadgeVariant = (visibility: string) => {
    switch (visibility.toLowerCase()) {
        case 'public': return 'default';
        case 'unlisted': return 'secondary';
        case 'private': return 'destructive';
        default: return 'outline';
    }
};

const getVisibilityLabel = (visibility: string) => {
    switch (visibility.toLowerCase()) {
        case 'public': return 'Público';
        case 'unlisted': return 'No listado';
        case 'private': return 'Privado';
        default: return visibility;
    }
};

export const PublisherModpacksView: React.FC = () => {
    const { publisherId } = useParams<{ publisherId: string }>();
    const { session, sessionTokens } = useAuthentication();
    const navigate = useNavigate();

    // State
    const [modpacks, setModpacks] = useState<Modpack[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // AlertDialog states for confirmations
    const [deleteDialog, setDeleteDialog] = useState<{
        open: boolean;
        modpack: Modpack | null;
    }>({
        open: false,
        modpack: null
    });

    // Dialog states for create/edit modpack
    const [createModpackDialogOpen, setCreateModpackDialogOpen] = useState(false);
    const [editModpackDialog, setEditModpackDialog] = useState<{
        open: boolean;
        modpack: Modpack | null;
    }>({
        open: false,
        modpack: null
    });

    // Get user role in this publisher
    const publisherMembership = session?.publisherMemberships?.find(
        membership => membership.publisherId === publisherId
    );
    const userRole = publisherMembership?.role || 'member';
    const canCreateModpacks = ['owner', 'admin'].includes(userRole);

    // Load modpacks
    const loadModpacks = async () => {
        if (!publisherId || !sessionTokens?.accessToken) return;

        try {
            setLoading(true);
            setError(null);
            const data = await PublisherModpacksAPI.getModpacks(publisherId, sessionTokens.accessToken);
            setModpacks(data);
        } catch (err: any) {
            console.error('Error loading modpacks:', err);
            setError(err.message || 'Error al cargar los modpacks');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadModpacks();
    }, [publisherId, sessionTokens?.accessToken]);

    const handleCreateModpack = () => {
        setCreateModpackDialogOpen(true);
    };

    const handleEditModpack = (modpack: Modpack) => {
        setEditModpackDialog({
            open: true,
            modpack
        });
    };

    const handleConfigureModpack = (modpack: Modpack) => {
        // TODO: Implement modpack configuration
        console.log('Configure modpack:', modpack.id);
    };

    const handleDeleteModpack = (modpack: Modpack) => {
        setDeleteDialog({
            open: true,
            modpack
        });
    };

    const confirmDeleteModpack = async () => {
        const modpack = deleteDialog.modpack;
        if (!modpack) return;

        try {
            const response = await PublisherModpacksAPI.deleteModpack(publisherId!, modpack.id, sessionTokens!.accessToken);

            toast.success(`Modpack "${modpack.name}" eliminado correctamente`);
            setModpacks(prev => prev.filter(m => m.id !== modpack.id));
            setDeleteDialog({ open: false, modpack: null });
        } catch (error) {
            console.error('Error deleting modpack:', error);
            toast.error(error instanceof Error ? error.message : 'Error al eliminar el modpack');
        }
    };

    const handleManageVersions = (modpack: Modpack) => {
        navigate(`/publisher/${publisherId}/modpacks/${modpack.id}/versions`);
    };

    const onModpackCreated = () => {
        loadModpacks(); // Refresh the list
        setCreateModpackDialogOpen(false);
    };

    const onModpackUpdated = () => {
        loadModpacks(); // Refresh the list
        setEditModpackDialog({ open: false, modpack: null });
    };

    return (
        <>
            {/* AlertDialog for Delete Confirmation */}
            <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog(prev => ({ ...prev, open }))}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción eliminará permanentemente el modpack "{deleteDialog.modpack?.name}" y todas sus versiones.
                            Esta operación no se puede deshacer.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmDeleteModpack}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Eliminar Modpack
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Create Modpack Dialog */}
            <CreateModpackDialog
                isOpen={createModpackDialogOpen}
                onClose={() => setCreateModpackDialogOpen(false)}
                onSuccess={onModpackCreated}
                teamId={publisherId}
            />

            {/* Edit Modpack Dialog */}
            {editModpackDialog.modpack && (
                <EditModpackDialog
                    isOpen={editModpackDialog.open}
                    onClose={() => setEditModpackDialog({ open: false, modpack: null })}
                    onSuccess={onModpackUpdated}
                    modpack={editModpackDialog.modpack}
                    teamId={publisherId}
                />
            )}

            <div className="space-y-6">
                {/* Header */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <LucidePackage className="h-5 w-5" />
                                <CardTitle>Gestión de Modpacks</CardTitle>
                            </div>
                            {canCreateModpacks && (
                                <Button onClick={handleCreateModpack}>
                                    <LucidePlus className="h-4 w-4 mr-2" />
                                    Crear Nuevo Modpack
                                </Button>
                            )}
                        </div>
                    </CardHeader>
                </Card>

                {/* Content */}
                <Card>
                    <CardContent className="p-6">
                        {error && (
                            <Alert variant="destructive" className="mb-4">
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}

                        {loading ? (
                            <div className="flex items-center justify-center py-8">
                                <LucideLoader className="h-8 w-8 animate-spin" />
                            </div>
                        ) : modpacks.length === 0 ? (
                            <div className="text-center py-12">
                                <LucidePackage className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                                <h3 className="text-lg font-medium mb-2">No hay modpacks</h3>
                                <p className="text-muted-foreground mb-4">
                                    Aún no tienes modpacks en este publisher.
                                </p>
                                {canCreateModpacks && (
                                    <Button onClick={handleCreateModpack}>
                                        <LucidePlus className="h-4 w-4 mr-2" />
                                        Crear tu primer modpack
                                    </Button>
                                )}
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Modpack</TableHead>
                                        <TableHead>Visibilidad</TableHead>
                                        <TableHead>Estado</TableHead>
                                        <TableHead>Última Actualización</TableHead>
                                        <TableHead className="w-[50px]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {modpacks.map((modpack) => (
                                        <TableRow key={modpack.id}>
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <img
                                                        src={modpack.iconUrl}
                                                        alt={modpack.name}
                                                        className="w-10 h-10 rounded object-cover"
                                                        onError={(e) => {
                                                            const target = e.target as HTMLImageElement;
                                                            target.src = '/placeholder-modpack.png';
                                                        }}
                                                    />
                                                    <div>
                                                        <p className="font-medium">{modpack.name}</p>
                                                        <p className="text-sm text-muted-foreground">
                                                            {modpack.shortDescription || 'Sin descripción'}
                                                        </p>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={getVisibilityBadgeVariant(modpack.visibility)}>
                                                    {getVisibilityLabel(modpack.visibility)}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={getStatusBadgeVariant(modpack.status)}>
                                                    {getStatusLabel(modpack.status)}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                {new Date(modpack.updatedAt).toLocaleDateString('es-ES')}
                                            </TableCell>
                                            <TableCell>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="sm">
                                                            <LucideMoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onClick={() => handleManageVersions(modpack)}>
                                                            <LucideHistory className="h-4 w-4 mr-2" />
                                                            Gestionar Versiones
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => handleEditModpack(modpack)}>
                                                            <LucideEdit className="h-4 w-4 mr-2" />
                                                            Editar
                                                        </DropdownMenuItem>

                                                        {(['owner', 'admin'].includes(userRole) && modpack.status !== 'deleted') && (
                                                            <DropdownMenuItem
                                                                onClick={() => handleDeleteModpack(modpack)}
                                                                className="text-destructive"
                                                            >
                                                                <LucideTrash2 className="h-4 w-4 mr-2" />
                                                                Eliminar
                                                            </DropdownMenuItem>
                                                        )}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            </div>
        </>
    );
};