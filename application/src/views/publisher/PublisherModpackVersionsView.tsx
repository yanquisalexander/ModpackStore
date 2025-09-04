import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
    LucideTrash2,
    LucideArrowLeft,
    LucideEye,
    LucideSend
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
import { CreateVersionDialog } from '@/components/creator/CreateVersionDialog';

// Types
interface ModpackVersion {
    id: string;
    version: string;
    mcVersion: string;
    forgeVersion?: string;
    changelog?: string;
    status: string;
    releaseDate?: string;
    createdAt: string;
    updatedAt: string;
}

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
    publisherId: string; // Added
    creatorUser?: {
        username: string;
    };
}

// API Service
class PublisherVersionsAPI {
    private static baseUrl = `${API_ENDPOINT}/creators/publishers`;

    static async getVersions(publisherId: string, modpackId: string, accessToken: string): Promise<{ versions: ModpackVersion[], modpack: Modpack }> {
        const response = await fetch(`${this.baseUrl}/${publisherId}/modpacks/${modpackId}/versions`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || `Error fetching versions: ${response.statusText}`);
        }

        return await response.json();
    }

    static async deleteVersion(publisherId: string, modpackId: string, versionId: string, accessToken: string): Promise<void> {
        const response = await fetch(`${this.baseUrl}/${publisherId}/modpacks/${modpackId}/versions/${versionId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || `Error deleting version: ${response.statusText}`);
        }
    }

    static async getModpack(publisherId: string, modpackId: string, accessToken: string): Promise<Modpack> {
        const response = await fetch(`${this.baseUrl}/${publisherId}/modpacks/${modpackId}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || `Error fetching modpack: ${response.statusText}`);
        }

        return await response.json();
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
        case 'archived': return 'Archivado';
        default: return status;
    }
};

export const PublisherModpackVersionsView: React.FC = () => {
    const { publisherId, modpackId } = useParams<{ publisherId: string; modpackId: string }>();
    const { session, sessionTokens } = useAuthentication();
    const navigate = useNavigate();

    // State
    const [versions, setVersions] = useState<ModpackVersion[]>([]);
    const [modpack, setModpack] = useState<Modpack | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [createVersionDialogOpen, setCreateVersionDialogOpen] = useState(false);


    // AlertDialog states for confirmations
    const [deleteDialog, setDeleteDialog] = useState<{
        open: boolean;
        version: ModpackVersion | null;
    }>({
        open: false,
        version: null
    });

    // Get user role in this publisher
    const publisherMembership = session?.publisherMemberships?.find(
        membership => membership.publisherId === publisherId
    );
    const userRole = publisherMembership?.role || 'member';
    const canCreateVersions = ['owner', 'admin', 'member'].includes(userRole); // Most users can create versions
    const canDeleteVersions = ['owner', 'admin'].includes(userRole);

    // Load versions
    const loadVersions = async () => {
        if (!publisherId || !modpackId || !sessionTokens?.accessToken) return;

        setLoading(true);
        setError(null);

        try {
            const data = await PublisherVersionsAPI.getVersions(publisherId, modpackId, sessionTokens.accessToken);
            let modpackData = data.modpack;

            // If modpack is not included in the response, fetch it separately
            if (!modpackData) {
                modpackData = await PublisherVersionsAPI.getModpack(publisherId, modpackId, sessionTokens.accessToken);
            }

            setVersions(data.versions || []);
            setModpack(modpackData ? { ...modpackData, publisherId } : null);
        } catch (error) {
            console.error('Error loading versions:', error);
            setError(error instanceof Error ? error.message : 'Error al cargar las versiones');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadVersions();
    }, [publisherId, modpackId, sessionTokens?.accessToken]);

    const handleCreateVersion = () => {
        console.log('handleCreateVersion called, modpack:', modpack, 'canCreateVersions:', canCreateVersions);
        setCreateVersionDialogOpen(true);
    };

    const handleViewVersion = (version: ModpackVersion) => {
        navigate(`/publisher/${publisherId}/modpacks/${modpackId}/versions/${version.id}`);
    };

    const handleDeleteVersion = (version: ModpackVersion) => {
        setDeleteDialog({
            open: true,
            version
        });
    };

    const confirmDeleteVersion = async () => {
        const version = deleteDialog.version;
        if (!version) return;

        try {
            await PublisherVersionsAPI.deleteVersion(publisherId!, modpackId!, version.id, sessionTokens!.accessToken);

            toast.success(`Versión "${version.version}" eliminada correctamente`);
            setVersions(prev => prev.filter(v => v.id !== version.id));
            setDeleteDialog({ open: false, version: null });
        } catch (error) {
            console.error('Error deleting version:', error);
            toast.error(error instanceof Error ? error.message : 'Error al eliminar la versión');
        }
    };

    const handleBackToModpacks = () => {
        navigate(`/publisher/${publisherId}/modpacks`);
    };

    const onVersionCreated = () => {
        loadVersions(); // Refresh the list
        setCreateVersionDialogOpen(false);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8">
                <LucideLoader className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    return (
        <>
            {/* AlertDialog for Delete Version Confirmation */}
            <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog(prev => ({ ...prev, open }))}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción eliminará permanentemente la versión "{deleteDialog.version?.version}"
                            y todos los archivos asociados a ella. Esta operación no se puede deshacer.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmDeleteVersion}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Eliminar Versión
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Create Version Dialog */}
            {modpack && (
                <CreateVersionDialog
                    isOpen={createVersionDialogOpen}
                    onClose={() => setCreateVersionDialogOpen(false)}
                    onSuccess={onVersionCreated}
                    modpack={modpack}
                    existingVersions={versions}
                />
            )}

            <div className="space-y-6">
                {/* Header */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleBackToModpacks}
                                    className="mr-2"
                                >
                                    <LucideArrowLeft className="h-4 w-4 mr-1" />
                                    Volver
                                </Button>
                                <LucidePackage className="h-5 w-5" />
                                <CardTitle>
                                    Versiones de {modpack?.name || 'Modpack'}
                                </CardTitle>
                            </div>
                            {canCreateVersions && (
                                <Button onClick={handleCreateVersion}>
                                    <LucidePlus className="h-4 w-4 mr-2" />
                                    Crear Nueva Versión
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

                        {versions.length === 0 ? (
                            <div className="text-center py-12">
                                <LucidePackage className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                                <h3 className="text-lg font-medium mb-2">No hay versiones</h3>
                                <p className="text-muted-foreground mb-4">
                                    Aún no hay versiones para este modpack.
                                </p>
                                {canCreateVersions && (
                                    <Button onClick={handleCreateVersion}>
                                        <LucidePlus className="h-4 w-4 mr-2" />
                                        Crear primera versión
                                    </Button>
                                )}
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Versión</TableHead>
                                        <TableHead>Minecraft</TableHead>
                                        <TableHead>Forge</TableHead>
                                        <TableHead>Estado</TableHead>
                                        <TableHead>Fecha de Creación</TableHead>
                                        <TableHead className="text-right">Acciones</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {versions.map((version) => (
                                        <TableRow key={version.id}>
                                            <TableCell className="font-medium">
                                                {version.version}
                                            </TableCell>
                                            <TableCell>
                                                {version.mcVersion}
                                            </TableCell>
                                            <TableCell>
                                                {version.forgeVersion || 'N/A'}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={getStatusBadgeVariant(version.status)}>
                                                    {getStatusLabel(version.status)}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                {new Date(version.createdAt).toLocaleDateString('es-ES')}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="sm">
                                                            <LucideMoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onClick={() => handleViewVersion(version)}>
                                                            <LucideEye className="h-4 w-4 mr-2" />
                                                            Ver/Editar
                                                        </DropdownMenuItem>
                                                        {version.status !== 'published' && canDeleteVersions && (
                                                            <DropdownMenuItem
                                                                onClick={() => handleDeleteVersion(version)}
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