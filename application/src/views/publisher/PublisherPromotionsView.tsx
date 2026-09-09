import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    LucideSparkles,
    LucideEye,
    LucideMousePointerClick,
    LucideTrendingUp,
    LucideLoader,
    LucideClock,
    LucideCheckCircle2,
    LucideXCircle,
    LucideMegaphone,
    LucideCalendar,
    LucidePackage,
    LucideBarChart2,
} from 'lucide-react';
import { toast } from 'sonner';
import { API_ENDPOINT } from '@/consts';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import { PromoteModpackDialog } from '@/components/creator/dialogs/PromoteModpackDialog';
import { CampaignAnalyticsDialog } from '@/components/ads/CampaignAnalyticsDialog';

interface CreatorCampaign {
    id: string;
    name: string;
    type: string;
    placement: string;
    status: 'draft' | 'pending_approval' | 'active' | 'paused' | 'completed' | 'rejected';
    title: string;
    subtitle: string | null;
    badgeText: string;
    ctaText: string;
    mediaUrl: string;
    targetModpackId: string | null;
    modpackName?: string | null;
    totalImpressions: number;
    totalClicks: number;
    ctr: string;
    startAt: string;
    endAt: string | null;
    createdAt: string;
}

export const PublisherPromotionsView: React.FC = () => {
    const { publisherId } = useParams<{ publisherId: string }>();
    const [campaigns, setCampaigns] = useState<CreatorCampaign[]>([]);
    const [loading, setLoading] = useState(true);

    // Dialog state for new promotion
    const [promoteDialogOpen, setPromoteDialogOpen] = useState(false);
    const [selectedModpack, setSelectedModpack] = useState<any>(null);
    const [orgModpacks, setOrgModpacks] = useState<any[]>([]);

    // Dialog state for detailed analytics
    const [analyticsDialogOpen, setAnalyticsDialogOpen] = useState(false);
    const [selectedAnalyticsCampaignId, setSelectedAnalyticsCampaignId] = useState<string | null>(null);

    const openAnalytics = (campaignId: string) => {
        setSelectedAnalyticsCampaignId(campaignId);
        setAnalyticsDialogOpen(true);
    };

    const loadCampaigns = async () => {
        if (!publisherId) return;
        try {
            setLoading(true);
            const res = await fetchWithAuth(`${API_ENDPOINT}/creators/${publisherId}/ads`);
            if (!res.ok) throw new Error('Error al cargar patrocinios');
            const json = await res.json();
            setCampaigns(json.data || []);
        } catch (err: any) {
            console.error('[PublisherPromotionsView] Error:', err);
            toast.error(err.message || 'Error al cargar campañas');
        } finally {
            setLoading(false);
        }
    };

    const loadOrgModpacks = async () => {
        if (!publisherId) return;
        try {
            const res = await fetchWithAuth(`${API_ENDPOINT}/creators/${publisherId}/modpacks`);
            if (res.ok) {
                const json = await res.json();
                setOrgModpacks(json.data || []);
            }
        } catch (e) {}
    };

    useEffect(() => {
        loadCampaigns();
        loadOrgModpacks();
    }, [publisherId]);

    const activeCount = campaigns.filter((c) => c.status === 'active').length;
    const totalImpressions = campaigns.reduce((sum, c) => sum + (c.totalImpressions || 0), 0);
    const totalClicks = campaigns.reduce((sum, c) => sum + (c.totalClicks || 0), 0);
    const avgCtr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : '0.00';

    const handleOpenNewPromo = () => {
        setSelectedModpack(orgModpacks[0] || null);
        setPromoteDialogOpen(true);
    };

    return (
        <div className="space-y-6">
            {/* Page Header (Consistent with Admin & Creator Layout) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-500">
                        <LucideMegaphone className="h-5 w-5" />
                    </div>
                    <div>
                        <h1 className="text-lg font-semibold text-foreground">Campañas y Patrocinios</h1>
                        <p className="text-sm text-muted-foreground">
                            Promociona tus modpacks en la tienda y consulta el rendimiento de tus campañas en tiempo real
                        </p>
                    </div>
                </div>

                <Button
                    onClick={handleOpenNewPromo}
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                    <LucideSparkles className="h-4 w-4 mr-2" />
                    Promocionar Modpack
                </Button>
            </div>

            {/* Metrics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="p-4 pb-2">
                        <CardDescription>Campañas Activas</CardDescription>
                        <CardTitle className="text-2xl font-bold text-green-400">{activeCount}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0 text-xs text-muted-foreground">
                        Mostrándose en la tienda ahora
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="p-4 pb-2">
                        <CardDescription className="flex items-center gap-1.5">
                            <LucideEye className="h-3.5 w-3.5" /> Total Impresiones
                        </CardDescription>
                        <CardTitle className="text-2xl font-bold">{totalImpressions.toLocaleString()}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0 text-xs text-muted-foreground">
                        Jugadores que vieron tu modpack (&gt;1s)
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="p-4 pb-2">
                        <CardDescription className="flex items-center gap-1.5">
                            <LucideMousePointerClick className="h-3.5 w-3.5" /> Clics Obtenidos
                        </CardDescription>
                        <CardTitle className="text-2xl font-bold">{totalClicks.toLocaleString()}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0 text-xs text-muted-foreground">
                        Interacciones hacia la página del modpack
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="p-4 pb-2">
                        <CardDescription className="flex items-center gap-1.5">
                            <LucideTrendingUp className="h-3.5 w-3.5" /> CTR Promedio
                        </CardDescription>
                        <CardTitle className="text-2xl font-bold">{avgCtr}%</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0 text-xs text-muted-foreground">
                        Tasa de conversión de clics
                    </CardContent>
                </Card>
            </div>

            {/* Campaigns Table */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Tus Campañas</CardTitle>
                    <CardDescription>
                        Historial y estado de tus solicitudes de patrocinio.
                    </CardDescription>
                </CardHeader>

                <CardContent className="p-0">
                    {loading ? (
                        <div className="flex items-center justify-center p-12">
                            <LucideLoader className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : campaigns.length === 0 ? (
                        <div className="text-center py-16 px-4 space-y-3">
                            <LucideSparkles className="w-12 h-12 mx-auto text-amber-400/40" />
                            <h3 className="text-base font-semibold">Aún no tienes campañas de patrocinio</h3>
                            <p className="text-sm text-muted-foreground max-w-md mx-auto">
                                Destaca tus modpacks en la portada principal o entre las categorías para aumentar drásticamente tus descargas.
                            </p>
                            <Button onClick={handleOpenNewPromo} className="mt-2 bg-amber-500 hover:bg-amber-600 text-black font-semibold">
                                <LucideSparkles className="w-4 h-4 mr-2" />
                                Promocionar mi primer modpack
                            </Button>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Campaña / Modpack</TableHead>
                                    <TableHead>Ubicación</TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead>Vigencia</TableHead>
                                    <TableHead className="text-right">Rendimiento (Imp / Clics / CTR)</TableHead>
                                    <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {campaigns.map((c) => (
                                    <TableRow key={c.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <img
                                                    src={c.mediaUrl}
                                                    alt={c.title}
                                                    className="w-14 h-9 object-cover rounded border border-white/10 shrink-0"
                                                />
                                                <div>
                                                    <div className="font-semibold text-sm flex items-center gap-2">
                                                        {c.title}
                                                        {c.type === 'creator_profile' && (
                                                            <Badge variant="secondary" className="text-[10px] py-0 px-1.5 font-normal">
                                                                General
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {c.modpackName
                                                            ? `Modpack: ${c.modpackName}`
                                                            : (c.targetUrl ? `Enlace: ${c.targetUrl}` : c.name)}
                                                    </div>
                                                </div>
                                            </div>
                                        </TableCell>

                                        <TableCell>
                                            <Badge variant="outline" className="text-xs capitalize">
                                                {c.placement === 'hero_carousel' ? 'Hero Carousel' : 'Banner Catálogo'}
                                            </Badge>
                                        </TableCell>

                                        <TableCell>
                                            {c.status === 'active' && (
                                                <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                                                    Activa
                                                </Badge>
                                            )}
                                            {c.status === 'pending_approval' && (
                                                <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                                                    En Revisión
                                                </Badge>
                                            )}
                                            {c.status === 'paused' && (
                                                <Badge variant="secondary">Pausada</Badge>
                                            )}
                                            {c.status === 'completed' && (
                                                <Badge variant="outline">Finalizada</Badge>
                                            )}
                                            {c.status === 'rejected' && (
                                                <Badge variant="destructive">Rechazada</Badge>
                                            )}
                                        </TableCell>

                                        <TableCell>
                                            <div className="text-xs text-muted-foreground space-y-0.5">
                                                <div>Inicio: {new Date(c.startAt).toLocaleDateString('es-ES')}</div>
                                                {c.endAt && (
                                                    <div>Fin: {new Date(c.endAt).toLocaleDateString('es-ES')}</div>
                                                )}
                                            </div>
                                        </TableCell>

                                        <TableCell className="text-right">
                                            <div className="text-xs space-y-0.5">
                                                <div><span className="font-bold text-white">{c.totalImpressions.toLocaleString()}</span> imp.</div>
                                                <div><span className="font-bold text-amber-400">{c.totalClicks.toLocaleString()}</span> clics ({c.ctr})</div>
                                            </div>
                                        </TableCell>

                                        <TableCell className="text-right">
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-8 px-2 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                                                title="Ver Analíticas Detalladas"
                                                onClick={() => openAnalytics(c.id)}
                                            >
                                                <LucideBarChart2 className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Detailed Analytics Dialog */}
            <CampaignAnalyticsDialog
                open={analyticsDialogOpen}
                onOpenChange={setAnalyticsDialogOpen}
                campaignId={selectedAnalyticsCampaignId}
                fetchUrl={
                    selectedAnalyticsCampaignId && publisherId
                        ? `${API_ENDPOINT}/creators/${publisherId}/ads/${selectedAnalyticsCampaignId}/analytics`
                        : null
                }
            />

            {/* Promote Dialog */}
            {publisherId && (
                <PromoteModpackDialog
                    open={promoteDialogOpen}
                    onOpenChange={setPromoteDialogOpen}
                    modpack={selectedModpack}
                    availableModpacks={orgModpacks}
                    orgId={publisherId}
                    onSuccess={loadCampaigns}
                />
            )}
        </div>
    );
};
