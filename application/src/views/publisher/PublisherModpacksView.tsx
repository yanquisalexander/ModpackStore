import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    LucidePackage,
    LucideLoader,
    LucidePlus,
    LucideMoreHorizontal,
    LucideEdit,
    LucideSettings,
    LucideTrash2,
    LucideHistory,
    LucideUsers,
    LucideSearch,
    LucideRefreshCw,
    LucideSparkles
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
import ImportCurseForgeDialog from '@/components/creator/dialogs/ImportCurseForgeDialog';
import { ManageWhitelistModal } from '@/components/publisher/ManageWhitelistModal';
import { PromoteModpackDialog } from '@/components/creator/dialogs/PromoteModpackDialog';

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
    acquisitionMethod?: string;
    password?: string;
    categories?: Array<{ categoryId: string; isPrimary: boolean; name: string }>;
    creatorUser?: {
        username: string;
    };
}

// API Service for publisher modpacks
class PublisherModpacksAPI {
    private static get baseUrl() { return `${API_ENDPOINT}/creators`; }

    static async getModpacks(publisherId: string, accessToken: string): Promise<Modpack[]> {
        const url = `${this.baseUrl}/${publisherId}/modpacks`;
        console.log('[PublisherModpacksAPI] Fetching:', url);

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        });

        console.log('[PublisherModpacksAPI] Response status:', response.status);

        if (!response.ok) {
            let errorMsg = `Error fetching modpacks: ${response.statusText}`;
            try {
                const errorData = await response.json();
                errorMsg = errorData.detail || errorMsg;
            } catch {}
            throw new Error(errorMsg);
        }

        const modpacks = await response.json();
        console.log('[PublisherModpacksAPI] Raw response:', modpacks);

        return Array.isArray(modpacks) ? modpacks : [];
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
        case 'whitelist': return 'Whitelist';
        default: return visibility;
    }
};

export const PublisherModpacksView: React.FC = () => {
    const { publisherId } = useParams<{ publisherId: string }>();
    const { session, sessionTokens } = useAuthentication();
    const navigate = useNavigate();

    // State
    const [modpacks, setModpacks] = useState<Modpack[]>([]);
    const [activeCampaigns, setActiveCampaigns] = useState<Record<string, { status: string; id: string }>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [visibilityFilter, setVisibilityFilter] = useState('all');

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

    // Dialog state for import CurseForge
    const [importCurseForgeDialogOpen, setImportCurseForgeDialogOpen] = useState(false);

    // Dialog state for manage whitelist
    const [whitelistDialog, setWhitelistDialog] = useState<{
        open: boolean;
        modpack: Modpack | null;
    }>({
        open: false,
        modpack: null
    });

    // Dialog state for promote modpack
    const [promoteDialog, setPromoteDialog] = useState<{
        open: boolean;
        modpack: Modpack | null;
    }>({
        open: false,
        modpack: null
    });

    // Get user role in this publisher
    const publisherMembership = session?.creatorMemberships?.find(
        membership => membership.creatorId === publisherId
    );
    const userRole = publisherMembership?.role || 'member';
    const canCreateModpacks = ['owner', 'admin'].includes(userRole);

    // Load campaigns to know which modpacks already have active/pending promotions
    const loadCampaigns = async () => {
        if (!publisherId) return;
        try {
            const res = await fetch(`${API_ENDPOINT}/creators/${publisherId}/ads`, {
                headers: {
                    'Authorization': `Bearer ${sessionTokens?.accessToken}`,
                    'Content-Type': 'application/json',
                },
            });
            if (res.ok) {
                const json = await res.json();
                const map: Record<string, { status: string; id: string }> = {};
                (json.data || []).forEach((c: any) => {
                    if (c.targetModpackId && (c.status === 'active' || c.status === 'pending_approval')) {
                        map[c.targetModpackId] = { status: c.status, id: c.id };
                    }
                });
                setActiveCampaigns(map);
            }
        } catch (e) {
            console.error('Error fetching creator campaigns:', e);
        }
    };

    // Load modpacks
    const loadModpacks = async () => {
        if (!publisherId || !sessionTokens?.accessToken) return;

        try {
            setLoading(true);
            setError(null);
            const data = await PublisherModpacksAPI.getModpacks(publisherId, sessionTokens.accessToken);
            setModpacks(data);
            await loadCampaigns();
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
        navigate(`/creators/org/${publisherId}/modpacks/${modpack.id}/versions`);
    };

    const onModpackCreated = () => {
        loadModpacks(); // Refresh the list
        setCreateModpackDialogOpen(false);
    };

    const onModpackUpdated = () => {
        loadModpacks(); // Refresh the list
        setEditModpackDialog({ open: false, modpack: null });
    };

    const onImportSuccess = (result: any) => {
        loadModpacks(); // Refresh the list
        setImportCurseForgeDialogOpen(false);
        toast.success(`Modpack "${result.modpack.name}" importado exitosamente`);
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
                creatorId={publisherId}
            />

            {/* Edit Modpack Dialog */}
            {editModpackDialog.modpack && (
                <EditModpackDialog
                    isOpen={editModpackDialog.open}
                    onClose={() => setEditModpackDialog({ open: false, modpack: null })}
                    onSuccess={onModpackUpdated}
                    modpack={editModpackDialog.modpack}
                />
            )}

            {/* Import CurseForge Dialog */}
            <ImportCurseForgeDialog
                isOpen={importCurseForgeDialogOpen}
                onClose={() => setImportCurseForgeDialogOpen(false)}
                onSuccess={onImportSuccess}
                publisherId={publisherId}
            />

            <div className="space-y-6">
                {/* Page Header (Consistent with Admin Layout) */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-500">
                            <LucidePackage className="h-5 w-5" />
                        </div>
                        <div>
                            <h1 className="text-lg font-semibold text-foreground">Gestión de Modpacks</h1>
                            <p className="text-sm text-muted-foreground">
                                Administra los modpacks, visibilidad y versiones de tu organización
                            </p>
                        </div>
                    </div>

                    {canCreateModpacks && (
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                onClick={() => setImportCurseForgeDialogOpen(true)}
                                className="bg-card hover:bg-muted/50 border-border"
                            >
                                <LucidePackage className="h-4 w-4 mr-2 text-muted-foreground" />
                                Importar CurseForge
                            </Button>
                            <Button
                                onClick={handleCreateModpack}
                                className="bg-primary text-primary-foreground hover:bg-primary/90"
                            >
                                <LucidePlus className="h-4 w-4 mr-2" />
                                Crear Modpack
                            </Button>
                        </div>
                    )}
                </div>

                {/* Table Container with Filters */}
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                    {/* Filter Toolbar (Admin Style) */}
                    <div className="p-4 border-b border-border/70 flex flex-col sm:flex-row gap-3">
                        <div className="flex-1 relative">
                            <LucideSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                placeholder="Buscar por nombre o descripción..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 bg-muted/30 border-border text-sm"
                            />
                        </div>

                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-full sm:w-44 bg-muted/30 border-border text-sm">
                                <SelectValue placeholder="Estado" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos los estados</SelectItem>
                                <SelectItem value="published">Publicado</SelectItem>
                                <SelectItem value="draft">Borrador</SelectItem>
                                <SelectItem value="deleted">Eliminado</SelectItem>
                            </SelectContent>
                        </Select>

                        <Select value={visibilityFilter} onValueChange={setVisibilityFilter}>
                            <SelectTrigger className="w-full sm:w-44 bg-muted/30 border-border text-sm">
                                <SelectValue placeholder="Visibilidad" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todas las visibilidades</SelectItem>
                                <SelectItem value="public">Público</SelectItem>
                                <SelectItem value="unlisted">No listado</SelectItem>
                                <SelectItem value="whitelist">Whitelist</SelectItem>
                                <SelectItem value="private">Privado</SelectItem>
                            </SelectContent>
                        </Select>

                        <Button
                            variant="outline"
                            onClick={loadModpacks}
                            disabled={loading}
                            className="border-border bg-muted/30 hover:bg-muted/50 shrink-0"
                            title="Actualizar lista"
                        >
                            <LucideRefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        </Button>
                    </div>

                    {error && (
                        <div className="p-4">
                            <Alert variant="destructive">
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        </div>
                    )}

                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <LucideLoader className="h-6 w-6 animate-spin text-primary" />
                        </div>
                    ) : modpacks.length === 0 ? (
                        <div className="text-center py-12 px-4">
                            <LucidePackage className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                            <h3 className="text-base font-medium mb-1">No hay modpacks</h3>
                            <p className="text-sm text-muted-foreground mb-4 max-w-sm mx-auto">
                                Aún no tienes modpacks en esta organización.
                            </p>
                            {canCreateModpacks && (
                                <Button onClick={handleCreateModpack}>
                                    <LucidePlus className="h-4 w-4 mr-2" />
                                    Crear tu primer modpack
                                </Button>
                            )}
                        </div>
                    ) : (() => {
                        const filteredModpacks = modpacks.filter((modpack) => {
                            const matchesSearch = !searchTerm.trim() ||
                                modpack.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                (modpack.shortDescription && modpack.shortDescription.toLowerCase().includes(searchTerm.toLowerCase()));
                            const matchesStatus = statusFilter === 'all' || modpack.status.toLowerCase() === statusFilter.toLowerCase();
                            const matchesVisibility = visibilityFilter === 'all' || modpack.visibility.toLowerCase() === visibilityFilter.toLowerCase();
                            return matchesSearch && matchesStatus && matchesVisibility;
                        });

                        if (filteredModpacks.length === 0) {
                            return (
                                <div className="text-center py-12 px-4 text-muted-foreground text-sm">
                                    No se encontraron modpacks con los filtros aplicados.
                                </div>
                            );
                        }

                        return (
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
                                    {filteredModpacks.map((modpack) => (
                                        <TableRow key={modpack.id} className="hover:bg-muted/40">
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <img
                                                        className="w-10 h-10 rounded-lg object-cover border border-border/60 shrink-0"
                                                        src={modpack.iconUrl || '/images/modpack-fallback.webp'}
                                                        onError={(e) => {
                                                            const target = e.currentTarget;
                                                            target.src = '/images/modpack-fallback.webp';
                                                            target.onerror = null;
                                                        }}
                                                        alt={modpack.name}
                                                    />

                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <p className="font-medium text-foreground truncate">{modpack.name}</p>
                                                            {activeCampaigns[modpack.id]?.status === 'active' && (
                                                                <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] py-0 px-1.5 flex items-center gap-1">
                                                                    <LucideSparkles className="h-2.5 w-2.5" />
                                                                    Patrocinado
                                                                </Badge>
                                                            )}
                                                            {activeCampaigns[modpack.id]?.status === 'pending_approval' && (
                                                                <Badge className="bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] py-0 px-1.5">
                                                                    Promo en Revisión
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-muted-foreground truncate max-w-sm">
                                                            {modpack.shortDescription || 'Sin descripción'}
                                                        </p>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={getVisibilityBadgeVariant(modpack.visibility)} className="text-[10px]">
                                                    {getVisibilityLabel(modpack.visibility)}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={getStatusBadgeVariant(modpack.status)} className="text-[10px]">
                                                    {getStatusLabel(modpack.status)}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground">
                                                {new Date(modpack.updatedAt).toLocaleDateString('es-ES')}
                                            </TableCell>
                                            <TableCell>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
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

                                                        {modpack.status === 'published' && (
                                                            activeCampaigns[modpack.id] ? (
                                                                <DropdownMenuItem
                                                                    onClick={() => navigate(`/creators/org/${publisherId}/promotions`)}
                                                                    className="text-amber-400"
                                                                >
                                                                    <LucideSparkles className="h-4 w-4 mr-2 text-amber-400" />
                                                                    Ver Campaña ({activeCampaigns[modpack.id].status === 'active' ? 'Activa' : 'En Revisión'})
                                                                </DropdownMenuItem>
                                                            ) : (
                                                                <DropdownMenuItem onClick={() => setPromoteDialog({ open: true, modpack })}>
                                                                    <LucideSparkles className="h-4 w-4 mr-2 text-amber-400" />
                                                                    Promocionar Modpack
                                                                </DropdownMenuItem>
                                                            )
                                                        )}

                                                        {modpack.visibility === 'whitelist' && (
                                                            <DropdownMenuItem onClick={() => setWhitelistDialog({ open: true, modpack })}>
                                                                <LucideUsers className="h-4 w-4 mr-2" />
                                                                Gestionar Whitelist
                                                            </DropdownMenuItem>
                                                        )}

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
                        );
                    })()}
                </div>
            </div>

            {/* Manage Whitelist Modal */}
            {whitelistDialog.modpack && sessionTokens?.accessToken && (
                <ManageWhitelistModal
                    isOpen={whitelistDialog.open}
                    onClose={() => setWhitelistDialog({ open: false, modpack: null })}
                    modpackId={whitelistDialog.modpack.id}
                    modpackName={whitelistDialog.modpack.name}
                    accessToken={sessionTokens.accessToken}
                />
            )}

            {/* Promote Modpack Dialog */}
            {promoteDialog.modpack && publisherId && (
                <PromoteModpackDialog
                    open={promoteDialog.open}
                    onOpenChange={(open) => setPromoteDialog({ open, modpack: open ? promoteDialog.modpack : null })}
                    modpack={promoteDialog.modpack}
                    orgId={publisherId}
                />
            )}
        </>
    );
};