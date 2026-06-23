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
    LucideSend,
    Copy,
    ExternalLink
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
import { useWizard } from '@/components/creators/WizardContext';

// Types
interface ModpackVersion {
    id: string;
    version: string;
    mcVersion: string;
    forgeVersion?: string;
    changelog?: string;
    loaderType?: string;
    loaderVersion?: string;
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
    loaderType: string;
    loaderVersion: string;
    publisherId: string; // Added
    creatorUser?: {
        username: string;
    };
}

// API Service
class PublisherVersionsAPI {
    private static get baseUrl() { return `${API_ENDPOINT}/creators`; }

    static async getVersions(publisherId: string, modpackId: string, accessToken: string): Promise<ModpackVersion[]> {
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

        const data = await response.json();
        return Array.isArray(data) ? data : [];
    }

    static async archiveVersion(publisherId: string, modpackId: string, versionId: string, accessToken: string): Promise<void> {
        const response = await fetch(`${this.baseUrl}/${publisherId}/modpacks/${modpackId}/versions/${versionId}/archive`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || `Error archiving version: ${response.statusText}`);
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
        case 'deleted': return 'Eliminado';
        default: return status;
    }
};

export const PublisherModpackVersionsView: React.FC = () => {
    const { publisherId, modpackId } = useParams<{ publisherId: string; modpackId: string }>();
    const { session, sessionTokens } = useAuthentication();
    const navigate = useNavigate();
    const { openWizard } = useWizard();

    // State
    const [versions, setVersions] = useState<ModpackVersion[]>([]);
    const [modpack, setModpack] = useState<Modpack | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);


    // AlertDialog states for confirmations
    const [archiveDialog, setArchiveDialog] = useState<{
        open: boolean;
        version: ModpackVersion | null;
    }>({
        open: false,
        version: null
    });

    // Get user role in this publisher
    const publisherMembership = session?.creatorMemberships?.find(
        membership => membership.creatorId === publisherId
    );
    const userRole = publisherMembership?.role || 'member';
    const canCreateVersions = ['owner', 'admin', 'member'].includes(userRole); // Most users can create versions
    const canArchiveVersions = ['owner', 'admin'].includes(userRole);

    // Load versions
    const loadVersions = async () => {
        if (!publisherId || !modpackId || !sessionTokens?.accessToken) return;

        setLoading(true);
        setError(null);

        try {
            const versionsData = await PublisherVersionsAPI.getVersions(publisherId, modpackId, sessionTokens.accessToken);
            let modpackData = await PublisherVersionsAPI.getModpack(publisherId, modpackId, sessionTokens.accessToken);

            setVersions(versionsData);
            setModpack(modpackData ? { ...modpackData, publisherId } : null);
        } catch (error) {
            console.error('Error loading versions:', error);
            setError(error instanceof Error ? error.message : 'Error al cargar las versiones');
        } finally {
            setLoading(false);
        }
    };

    const handleCopyId = async () => {
        if (!modpack) return;
        const idToCopy = `mpack:${modpack.id}`;

        try {
            await navigator.clipboard.writeText(idToCopy);
            toast.success('ID copiado al portapapeles');
        } catch (error) {
            console.error('Error copying to clipboard:', error);
            toast.error('Error al copiar el ID');
        }
    };

    const handleGoToModpack = () => {
        if (!modpack) return;
        navigate(`/modpack/${modpack.id}`);
    };

    useEffect(() => {
        loadVersions();
    }, [publisherId, modpackId, sessionTokens?.accessToken]);

    const handleCreateVersion = () => {
        console.log('handleCreateVersion called, modpack:', modpack, 'canCreateVersions:', canCreateVersions);
        if (modpack) {
            openWizard(modpack, versions, onVersionCreated);
        }
    };

    const handleViewVersion = (version: ModpackVersion) => {
        navigate(`/creators/org/${publisherId}/modpacks/${modpackId}/versions/${version.id}`);
    };

    const handleArchiveVersion = (version: ModpackVersion) => {
        setArchiveDialog({
            open: true,
            version
        });
    };

    const confirmArchiveVersion = async () => {
        const version = archiveDialog.version;
        if (!version) return;

        try {
            await PublisherVersionsAPI.archiveVersion(publisherId!, modpackId!, version.id, sessionTokens!.accessToken);

            toast.success(`Versión "${version.version}" archivada correctamente`);
            setArchiveDialog({ open: false, version: null });
            // Refresh the list
            loadVersions();
        } catch (error) {
            console.error('Error archiving version:', error);
            toast.error(error instanceof Error ? error.message : 'Error al archivar la versión');
        }
    };

    const handleBackToModpacks = () => {
        navigate(`/creators/org/${publisherId}/modpacks`);
    };

    const onVersionCreated = () => {
        loadVersions(); // Refresh the list
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
            {/* AlertDialog for Archive Version Confirmation */}
            <AlertDialog open={archiveDialog.open} onOpenChange={(open) => setArchiveDialog(prev => ({ ...prev, open }))}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Archivar esta versión?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción archivará la versión "{archiveDialog.version?.version}" del modpack "{modpack?.name}".
                            Una versión archivada no estará disponible para los usuarios, pero podrás restaurarla después.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmArchiveVersion}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Archivar Versión
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

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

                            <div className="flex items-center gap-2">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleCopyId}
                                    className="flex items-center gap-1"
                                    title="Copiar ID del modpack"
                                >
                                    <Copy className="w-4 h-4" />
                                    Copiar ID
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={handleGoToModpack}
                                    className="flex items-center gap-2"
                                >
                                    <ExternalLink className="w-4 h-4" />
                                    Ir al modpack
                                </Button>
                                {canCreateVersions && (
                                    <Button onClick={handleCreateVersion}>
                                        <LucidePlus className="h-4 w-4 mr-2" />
                                        Crear Nueva Versión
                                    </Button>
                                )}
                            </div>

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
                                        <TableHead>Modloader</TableHead>
                                        <TableHead>Versión de Modloader</TableHead>
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
                                                {version.loaderType || 'N/A'}
                                            </TableCell>
                                            <TableCell>
                                                {version.loaderVersion || 'N/A'}
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
                                                        {canArchiveVersions && !['published', 'archived'].includes(version.status.toLowerCase()) && (
                                                            <DropdownMenuItem
                                                                onClick={() => handleArchiveVersion(version)}
                                                                className="text-destructive"
                                                            >
                                                                <LucideTrash2 className="h-4 w-4 mr-2" />
                                                                Archivar
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