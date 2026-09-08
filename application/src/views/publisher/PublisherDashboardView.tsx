import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import {
    LucidePackage,
    LucideLayers,
    LucideUsers,
    LucideCloud,
    LucidePlus,
    LucideArrowRight,
    LucideHistory,
    LucideBuilding2,
    LucideBarChart3,
    LucideLoader,
    LucideSettings,
    LucideSparkles
} from 'lucide-react';
import { useAuthentication } from '@/stores/AuthContext';
import { API_ENDPOINT } from '@/consts';
import { useTeams } from '@/hooks/creators/useTeams';
import { getStorageUsage, StorageUsage } from '@/services/storage';
import { CreatorPermissionsAPI } from '@/services/creatorPermissions.service';
import CreateModpackDialog from '@/components/creator/dialogs/CreateModpackDialog';
import ImportCurseForgeDialog from '@/components/creator/dialogs/ImportCurseForgeDialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Modpack {
    id: string;
    name: string;
    slug: string;
    shortDescription?: string;
    iconUrl?: string;
    visibility: string;
    status: string;
    createdAt: string;
    updatedAt: string;
    versions?: any[];
}

function StatCard({
    icon: Icon,
    label,
    value,
    color,
    subtext
}: {
    icon: any;
    label: string;
    value: string | number;
    color: string;
    subtext?: string;
}) {
    return (
        <Card className="border-border bg-card hover:border-border/80 transition-all">
            <CardContent className="p-5 flex items-center gap-4">
                <div className={cn("size-11 rounded-lg flex items-center justify-center shrink-0", color)}>
                    <Icon size={20} />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="text-2xl font-bold tracking-tight text-foreground">{value}</div>
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</div>
                    {subtext && <div className="text-[11px] text-muted-foreground/70 truncate mt-0.5">{subtext}</div>}
                </div>
            </CardContent>
        </Card>
    );
}

export const PublisherDashboardView: React.FC = () => {
    const { publisherId } = useParams<{ publisherId: string }>();
    const { session, sessionTokens } = useAuthentication();
    const navigate = useNavigate();

    const { teams } = useTeams(sessionTokens?.accessToken);
    const currentTeam = teams.find((t: any) => t.id === publisherId);

    const [modpacks, setModpacks] = useState<Modpack[]>([]);
    const [loadingModpacks, setLoadingModpacks] = useState(true);
    const [totalVersions, setTotalVersions] = useState<number>(0);
    const [membersCount, setMembersCount] = useState<number>(0);
    const [storageUsage, setStorageUsage] = useState<StorageUsage | null>(null);

    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [importDialogOpen, setImportDialogOpen] = useState(false);

    // Permission check
    const publisherMembership = session?.creatorMemberships?.find(
        (m: any) => m.creatorId === publisherId
    );
    const userRole = publisherMembership?.role || 'member';
    const canCreateModpacks = ['owner', 'admin'].includes(userRole);

    const loadDashboardData = useCallback(async () => {
        if (!publisherId || !sessionTokens?.accessToken) return;

        setLoadingModpacks(true);
        try {
            // 1. Fetch Modpacks
            const res = await fetch(`${API_ENDPOINT}/creators/${publisherId}/modpacks`, {
                headers: {
                    Authorization: `Bearer ${sessionTokens.accessToken}`,
                    'Content-Type': 'application/json',
                },
            });

            if (res.ok) {
                const data = await res.json();
                const items: Modpack[] = Array.isArray(data) ? data : (data.modpacks || []);
                setModpacks(items);

                // Count versions
                let vCount = 0;
                for (const mp of items) {
                    if (Array.isArray(mp.versions)) {
                        vCount += mp.versions.length;
                    } else {
                        try {
                            const vRes = await fetch(`${API_ENDPOINT}/creators/${publisherId}/modpacks/${mp.id}/versions`, {
                                headers: { Authorization: `Bearer ${sessionTokens.accessToken}` },
                            });
                            if (vRes.ok) {
                                const vData = await vRes.json();
                                const versions = Array.isArray(vData) ? vData : (vData.versions || []);
                                vCount += versions.length;
                            }
                        } catch {
                            // Ignore version count fetch errors
                        }
                    }
                }
                setTotalVersions(vCount);
            }

            // 2. Fetch Storage Usage
            try {
                const storage = await getStorageUsage(sessionTokens.accessToken, publisherId);
                setStorageUsage(storage);
            } catch {
                // Ignore storage fetch errors
            }

            // 3. Fetch Team Members Count
            try {
                const members = await CreatorPermissionsAPI.getMembers(publisherId, sessionTokens.accessToken);
                setMembersCount(members.length);
            } catch {
                // Ignore members fetch errors
            }
        } catch (error) {
            console.error('Error loading dashboard data:', error);
        } finally {
            setLoadingModpacks(false);
        }
    }, [publisherId, sessionTokens?.accessToken]);

    useEffect(() => {
        loadDashboardData();
    }, [loadDashboardData]);

    const publishedCount = modpacks.filter(m => m.status === 'published').length;
    const draftCount = modpacks.filter(m => m.status === 'draft').length;

    const formatStorageMb = (kb: number) => {
        if (kb < 1024) return `${kb} KB`;
        return `${(kb / 1024).toFixed(1)} MB`;
    };

    return (
        <>
            {/* Create Dialog */}
            <CreateModpackDialog
                isOpen={createDialogOpen}
                onClose={() => setCreateDialogOpen(false)}
                onSuccess={() => {
                    setCreateDialogOpen(false);
                    loadDashboardData();
                    toast.success('Modpack creado con éxito');
                }}
                creatorId={publisherId}
            />

            {/* Import Dialog */}
            <ImportCurseForgeDialog
                isOpen={importDialogOpen}
                onClose={() => setImportDialogOpen(false)}
                onSuccess={(result: any) => {
                    setImportDialogOpen(false);
                    loadDashboardData();
                    toast.success(`Modpack "${result?.modpack?.name || ''}" importado exitosamente`);
                }}
                publisherId={publisherId}
            />

            <div className="space-y-6">
                {/* Page Header (Consistent with Admin Layout) */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="size-11 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
                            {currentTeam?.logoUrl ? (
                                <img src={currentTeam.logoUrl} alt="" className="size-full object-cover rounded-lg" />
                            ) : (
                                <LucideBuilding2 className="h-6 w-6" />
                            )}
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-lg font-semibold text-foreground">
                                    {currentTeam?.displayName || currentTeam?.publisherName || 'Organización'}
                                </h1>
                                <Badge variant="secondary" className="text-xs">
                                    {userRole.toUpperCase()}
                                </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                Resumen general de actividad, modpacks y recursos del equipo
                            </p>
                        </div>
                    </div>

                    {canCreateModpacks && (
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                onClick={() => setImportDialogOpen(true)}
                                className="bg-card hover:bg-muted/50 border-border"
                            >
                                <LucidePackage className="h-4 w-4 mr-2 text-muted-foreground" />
                                Importar CurseForge
                            </Button>
                            <Button
                                onClick={() => setCreateDialogOpen(true)}
                                className="bg-primary text-primary-foreground hover:bg-primary/90"
                            >
                                <LucidePlus className="h-4 w-4 mr-2" />
                                Crear Modpack
                            </Button>
                        </div>
                    )}
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard
                        icon={LucidePackage}
                        label="Modpacks"
                        value={loadingModpacks ? "..." : modpacks.length}
                        color="bg-blue-500/10 text-blue-500"
                        subtext={`${publishedCount} publicados · ${draftCount} borradores`}
                    />
                    <StatCard
                        icon={LucideLayers}
                        label="Versiones"
                        value={loadingModpacks ? "..." : totalVersions}
                        color="bg-emerald-500/10 text-emerald-500"
                        subtext="Lanzamientos disponibles"
                    />
                    <StatCard
                        icon={LucideUsers}
                        label="Miembros"
                        value={membersCount || 1}
                        color="bg-amber-500/10 text-amber-500"
                        subtext="Colaboradores del equipo"
                    />
                    <StatCard
                        icon={LucideCloud}
                        label="Almacenamiento"
                        value={storageUsage ? formatStorageMb(storageUsage.used_kb) : "0 MB"}
                        color="bg-purple-500/10 text-purple-500"
                        subtext={storageUsage ? `${storageUsage.used_percentage}% del cupo usado` : "Cloud storage"}
                    />
                </div>

                {/* Quick Actions Shortcuts */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Link
                        to={`/creators/org/${publisherId}/modpacks`}
                        className="p-4 rounded-xl bg-card border border-border hover:border-primary/40 hover:bg-muted/30 transition-all flex items-center justify-between group"
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
                                <LucidePackage className="h-5 w-5" />
                            </div>
                            <div>
                                <div className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                                    Ver todos los modpacks
                                </div>
                                <div className="text-xs text-muted-foreground">
                                    Gestionar versiones, archivos y visibilidad
                                </div>
                            </div>
                        </div>
                        <LucideArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                    </Link>

                    <Link
                        to={`/creators/org/${publisherId}/team`}
                        className="p-4 rounded-xl bg-card border border-border hover:border-primary/40 hover:bg-muted/30 transition-all flex items-center justify-between group"
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
                                <LucideUsers className="h-5 w-5" />
                            </div>
                            <div>
                                <div className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                                    Gestionar equipo
                                </div>
                                <div className="text-xs text-muted-foreground">
                                    Invitar miembros y configurar permisos
                                </div>
                            </div>
                        </div>
                        <LucideArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                    </Link>

                    <Link
                        to={`/creators/org/${publisherId}/analytics`}
                        className="p-4 rounded-xl bg-card border border-border hover:border-primary/40 hover:bg-muted/30 transition-all flex items-center justify-between group"
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
                                <LucideBarChart3 className="h-5 w-5" />
                            </div>
                            <div>
                                <div className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                                    Ver estadísticas
                                </div>
                                <div className="text-xs text-muted-foreground">
                                    Descargas, instalaciones y retención
                                </div>
                            </div>
                        </div>
                        <LucideArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                    </Link>
                </div>

                {/* Recent Modpacks Table Card */}
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                    <div className="p-6 border-b border-border/70 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <LucidePackage className="h-4 w-4 text-muted-foreground" />
                            <h2 className="font-semibold text-base">Modpacks de la Organización</h2>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            asChild
                            className="text-xs text-muted-foreground hover:text-foreground"
                        >
                            <Link to={`/creators/org/${publisherId}/modpacks`}>
                                Ver listado completo ({modpacks.length})
                                <LucideArrowRight className="ml-1 h-3.5 w-3.5" />
                            </Link>
                        </Button>
                    </div>

                    {loadingModpacks ? (
                        <div className="flex items-center justify-center py-12">
                            <LucideLoader className="h-6 w-6 animate-spin text-primary" />
                        </div>
                    ) : modpacks.length === 0 ? (
                        <div className="p-12 text-center">
                            <div className="size-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-3 text-muted-foreground">
                                <LucidePackage size={24} />
                            </div>
                            <h3 className="text-base font-medium mb-1">Aún no hay modpacks creados</h3>
                            <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-6">
                                Comienza publicando tu primer modpack o importándolo directamente desde CurseForge.
                            </p>
                            {canCreateModpacks && (
                                <div className="flex items-center justify-center gap-3">
                                    <Button
                                        variant="outline"
                                        onClick={() => setImportDialogOpen(true)}
                                    >
                                        Importar CurseForge
                                    </Button>
                                    <Button
                                        onClick={() => setCreateDialogOpen(true)}
                                    >
                                        <LucidePlus className="h-4 w-4 mr-2" />
                                        Crear primer modpack
                                    </Button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Modpack</TableHead>
                                    <TableHead>Visibilidad</TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead>Última actualización</TableHead>
                                    <TableHead className="text-right">Acción</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {modpacks.slice(0, 5).map((modpack) => (
                                    <TableRow key={modpack.id} className="hover:bg-muted/40">
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <img
                                                    className="size-9 rounded-lg object-cover border border-border/60 shrink-0"
                                                    src={modpack.iconUrl || '/images/modpack-fallback.webp'}
                                                    onError={(e) => {
                                                        const target = e.currentTarget;
                                                        target.src = '/images/modpack-fallback.webp';
                                                        target.onerror = null;
                                                    }}
                                                    alt=""
                                                />
                                                <div className="min-w-0">
                                                    <div className="font-medium text-foreground truncate">
                                                        {modpack.name}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground truncate max-w-xs">
                                                        {modpack.shortDescription || 'Sin descripción'}
                                                    </div>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={modpack.visibility === 'public' ? 'default' : 'secondary'} className="text-[10px]">
                                                {modpack.visibility === 'public' ? 'Público' : modpack.visibility === 'whitelist' ? 'Whitelist' : 'Privado'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant={modpack.status === 'published' ? 'default' : 'outline'}
                                                className="text-[10px]"
                                            >
                                                {modpack.status === 'published' ? 'Publicado' : modpack.status === 'draft' ? 'Borrador' : modpack.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground">
                                            {new Date(modpack.updatedAt).toLocaleDateString('es-ES')}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => navigate(`/creators/org/${publisherId}/modpacks/${modpack.id}/versions`)}
                                                className="h-8 text-xs gap-1"
                                            >
                                                <LucideHistory className="h-3.5 w-3.5" />
                                                Versiones
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </div>
            </div>
        </>
    );
};

export default PublisherDashboardView;
