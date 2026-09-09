import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    LucideMegaphone,
    LucideEye,
    LucideMousePointerClick,
    LucidePlus,
    LucideCheckCircle2,
    LucideXCircle,
    LucidePause,
    LucidePlay,
    LucideSparkles,
    LucideLoader,
    LucideDollarSign,
    LucideClock,
    LucideEdit,
    LucideBarChart2,
} from "lucide-react";
import { toast } from "sonner";
import { API_ENDPOINT } from "@/consts";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { CampaignAnalyticsDialog } from "@/components/ads/CampaignAnalyticsDialog";

interface AdCampaign {
    id: string;
    name: string;
    type: "house" | "creator_modpack" | "creator_profile" | "external_sponsor";
    placement: "hero_carousel" | "explore_banner" | "modpack_sidebar" | "server_sponsor";
    status: "draft" | "pending_approval" | "active" | "paused" | "completed" | "rejected";
    title: string;
    subtitle: string | null;
    badgeText: string;
    ctaText: string;
    mediaUrl: string;
    weight: number;
    targetModpackId: string | null;
    targetUrl: string | null;
    paymentMethod: string | null;
    paymentNotes: string | null;
    creatorId: string | null;
    creatorName?: string | null;
    modpackName?: string | null;
    maxImpressions?: number | null;
    maxClicks?: number | null;
    totalImpressions: number;
    totalClicks: number;
    ctr: string;
    createdAt: string;
}

export const ManageAdsView: React.FC = () => {
    const [campaigns, setCampaigns] = useState<AdCampaign[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<string>("all");

    // Modal Create / Edit
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingCampaign, setEditingCampaign] = useState<AdCampaign | null>(null);
    const [saving, setSaving] = useState(false);

    // Modal Analytics
    const [analyticsDialogOpen, setAnalyticsDialogOpen] = useState(false);
    const [selectedAnalyticsCampaignId, setSelectedAnalyticsCampaignId] = useState<string | null>(null);

    // Form fields
    const [form, setForm] = useState({
        name: "",
        type: "house",
        placement: "explore_banner",
        title: "",
        subtitle: "",
        badgeText: "Patrocinado",
        ctaText: "Ver más",
        mediaUrl: "",
        weight: 1,
        targetModpackId: "",
        targetUrl: "",
        maxImpressions: "" as string | number,
        maxClicks: "" as string | number,
        paymentNotes: "",
    });

    const liveUtmPreview = useMemo(() => {
        if (!form.targetUrl) return null;
        try {
            const parsed = new URL(form.targetUrl);
            if (!parsed.searchParams.has("utm_source")) parsed.searchParams.set("utm_source", "modpackstore");
            if (!parsed.searchParams.has("utm_medium")) parsed.searchParams.set("utm_medium", form.placement);
            if (!parsed.searchParams.has("utm_campaign")) {
                const slug = (form.name || "campaign")
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, "-")
                    .replace(/^-|-$/g, "");
                parsed.searchParams.set("utm_campaign", slug || "campaign");
            }
            return parsed.toString();
        } catch {
            return null;
        }
    }, [form.targetUrl, form.placement, form.name]);

    const loadCampaigns = async () => {
        try {
            setLoading(true);
            const res = await fetchWithAuth(`${API_ENDPOINT}/admin/ads`);
            if (!res.ok) throw new Error("Error cargando campañas");
            const data = await res.json();
            setCampaigns(data.data || []);
        } catch (err: any) {
            toast.error(err.message || "Error al cargar las campañas publicitarias");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadCampaigns();
    }, []);

    const openCreateDialog = () => {
        setEditingCampaign(null);
        setForm({
            name: "",
            type: "house",
            placement: "explore_banner",
            title: "",
            subtitle: "",
            badgeText: "Patrocinado",
            ctaText: "Ver más",
            mediaUrl: "",
            weight: 1,
            targetModpackId: "",
            targetUrl: "",
            maxImpressions: "",
            maxClicks: "",
            paymentNotes: "House Ad interno",
        });
        setDialogOpen(true);
    };

    const openEditDialog = (c: AdCampaign) => {
        setEditingCampaign(c);
        setForm({
            name: c.name,
            type: c.type,
            placement: c.placement,
            title: c.title,
            subtitle: c.subtitle || "",
            badgeText: c.badgeText || "Patrocinado",
            ctaText: c.ctaText || "Ver más",
            mediaUrl: c.mediaUrl,
            weight: c.weight || 1,
            targetModpackId: c.targetModpackId || "",
            targetUrl: c.targetUrl || "",
            maxImpressions: c.maxImpressions || "",
            maxClicks: c.maxClicks || "",
            paymentNotes: c.paymentNotes || "",
        });
        setDialogOpen(true);
    };

    const openAnalytics = (campaignId: string) => {
        setSelectedAnalyticsCampaignId(campaignId);
        setAnalyticsDialogOpen(true);
    };

    const handleSave = async () => {
        if (!form.name || !form.title || !form.mediaUrl) {
            toast.error("Por favor completa el nombre, título y la URL del banner");
            return;
        }

        try {
            setSaving(true);
            const method = editingCampaign ? "PATCH" : "POST";
            const url = editingCampaign
                ? `${API_ENDPOINT}/admin/ads/${editingCampaign.id}`
                : `${API_ENDPOINT}/admin/ads`;

            const res = await fetchWithAuth(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...form,
                    weight: Number(form.weight) || 1,
                    targetModpackId: form.targetModpackId || null,
                    targetUrl: form.targetUrl || null,
                    maxImpressions: form.maxImpressions ? Number(form.maxImpressions) : null,
                    maxClicks: form.maxClicks ? Number(form.maxClicks) : null,
                }),
            });

            if (!res.ok) throw new Error("Error al guardar la campaña");

            toast.success(editingCampaign ? "Campaña actualizada" : "Campaña creada exitosamente");
            setDialogOpen(false);
            loadCampaigns();
        } catch (err: any) {
            toast.error(err.message || "Error al procesar la solicitud");
        } finally {
            setSaving(false);
        }
    };

    const handleApprove = async (id: string) => {
        try {
            const res = await fetchWithAuth(`${API_ENDPOINT}/admin/ads/${id}/approve`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ paymentNotes: "Pago verificado por PayPal y aprobado por Administrador" }),
            });
            if (!res.ok) throw new Error("Error al aprobar");
            toast.success("Campaña aprobada y activada");
            loadCampaigns();
        } catch (err: any) {
            toast.error(err.message || "Error al aprobar campaña");
        }
    };

    const handleReject = async (id: string) => {
        try {
            const res = await fetchWithAuth(`${API_ENDPOINT}/admin/ads/${id}/reject`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reason: "Rechazado en revisión administrativa" }),
            });
            if (!res.ok) throw new Error("Error al rechazar");
            toast.info("Campaña rechazada");
            loadCampaigns();
        } catch (err: any) {
            toast.error(err.message || "Error al rechazar campaña");
        }
    };

    const handleToggleStatus = async (c: AdCampaign) => {
        const nextStatus = c.status === "active" ? "paused" : "active";
        try {
            const res = await fetchWithAuth(`${API_ENDPOINT}/admin/ads/${c.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: nextStatus }),
            });
            if (!res.ok) throw new Error("Error al cambiar estado");
            toast.success(nextStatus === "active" ? "Campaña activada" : "Campaña pausada");
            loadCampaigns();
        } catch (err: any) {
            toast.error(err.message || "Error al actualizar estado");
        }
    };

    // Metrics calculations
    const totalImpressions = campaigns.reduce((acc, c) => acc + (c.totalImpressions || 0), 0);
    const totalClicks = campaigns.reduce((acc, c) => acc + (c.totalClicks || 0), 0);
    const activeCount = campaigns.filter((c) => c.status === "active").length;
    const pendingCount = campaigns.filter((c) => c.status === "pending_approval").length;
    const avgCtr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : "0.00";

    const filteredCampaigns = campaigns.filter((c) => {
        if (filterStatus === "all") return true;
        return c.status === filterStatus;
    });

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <LucideMegaphone className="h-6 w-6 text-primary" />
                        Publicidad y Patrocinios
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Gestiona House Ads internos, campañas pagadas de creadores y sponsors externos.
                    </p>
                </div>
                <Button onClick={openCreateDialog} className="flex items-center gap-2">
                    <LucidePlus className="h-4 w-4" />
                    Nueva Campaña
                </Button>
            </div>

            {/* Metrics cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="p-4 pb-2">
                        <CardDescription>Campañas Activas</CardDescription>
                        <CardTitle className="text-2xl font-bold text-green-400">{activeCount}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0 text-xs text-muted-foreground">
                        En rotación actualmente
                    </CardContent>
                </Card>

                <Card className={pendingCount > 0 ? "border-amber-500/50 bg-amber-500/5" : ""}>
                    <CardHeader className="p-4 pb-2">
                        <CardDescription>Solicitudes Pendientes</CardDescription>
                        <CardTitle className="text-2xl font-bold text-amber-400">{pendingCount}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0 text-xs text-muted-foreground">
                        Requieren aprobación administrativa
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
                        Visualizaciones reales (&gt;1s en pantalla)
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="p-4 pb-2">
                        <CardDescription className="flex items-center gap-1.5">
                            <LucideMousePointerClick className="h-3.5 w-3.5" /> Total Clics / CTR
                        </CardDescription>
                        <CardTitle className="text-2xl font-bold">
                            {totalClicks.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">({avgCtr}%)</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0 text-xs text-muted-foreground">
                        Interacciones totales registradas
                    </CardContent>
                </Card>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-2 border-b border-border pb-3">
                <Button
                    variant={filterStatus === "all" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilterStatus("all")}
                >
                    Todas ({campaigns.length})
                </Button>
                <Button
                    variant={filterStatus === "pending_approval" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilterStatus("pending_approval")}
                    className={pendingCount > 0 ? "border-amber-500 text-amber-400" : ""}
                >
                    Pendientes ({pendingCount})
                </Button>
                <Button
                    variant={filterStatus === "active" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilterStatus("active")}
                >
                    Activas ({activeCount})
                </Button>
                <Button
                    variant={filterStatus === "paused" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilterStatus("paused")}
                >
                    Pausadas
                </Button>
            </div>

            {/* Campaigns Table */}
            <Card>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="flex items-center justify-center p-12">
                            <LucideLoader className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : filteredCampaigns.length === 0 ? (
                        <div className="text-center p-12 text-muted-foreground">
                            No se encontraron campañas con este filtro.
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Campaña</TableHead>
                                    <TableHead>Ubicación & Tipo</TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead>Métricas (Imp / Clics / CTR)</TableHead>
                                    <TableHead>Pago / Notas</TableHead>
                                    <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredCampaigns.map((c) => (
                                    <TableRow key={c.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <img
                                                    src={c.mediaUrl}
                                                    alt={c.title}
                                                    className="w-14 h-9 object-cover rounded border border-white/10 shrink-0"
                                                />
                                                <div>
                                                    <div className="font-semibold text-sm">{c.title}</div>
                                                    <div className="text-xs text-muted-foreground">{c.name}</div>
                                                    {c.creatorName && (
                                                        <div className="text-[11px] text-primary">Creador: {c.creatorName}</div>
                                                    )}
                                                </div>
                                            </div>
                                        </TableCell>

                                        <TableCell>
                                            <div className="space-y-1">
                                                <Badge variant="outline" className="text-xs">
                                                    {c.placement}
                                                </Badge>
                                                <div className="text-xs text-muted-foreground capitalize">
                                                    {c.type.replace("_", " ")}
                                                </div>
                                            </div>
                                        </TableCell>

                                        <TableCell>
                                            {c.status === "active" && (
                                                <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Activa</Badge>
                                            )}
                                            {c.status === "pending_approval" && (
                                                <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">Pendiente Aprobación</Badge>
                                            )}
                                            {c.status === "paused" && (
                                                <Badge variant="secondary">Pausada</Badge>
                                            )}
                                            {c.status === "rejected" && (
                                                <Badge variant="destructive">Rechazada</Badge>
                                            )}
                                        </TableCell>

                                        <TableCell>
                                            <div className="text-xs space-y-0.5">
                                                <div><span className="font-medium">{c.totalImpressions.toLocaleString()}</span> imp.</div>
                                                <div><span className="font-medium">{c.totalClicks.toLocaleString()}</span> clics ({c.ctr})</div>
                                            </div>
                                        </TableCell>

                                        <TableCell>
                                            <div className="text-xs text-muted-foreground max-w-xs truncate">
                                                {c.paymentNotes || (c.paymentMethod ? `Método: ${c.paymentMethod}` : "Sin notas")}
                                            </div>
                                        </TableCell>

                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                {c.status === "pending_approval" ? (
                                                    <>
                                                        <Button
                                                            size="sm"
                                                            variant="default"
                                                            className="bg-green-600 hover:bg-green-700 h-8 px-2.5 text-xs"
                                                            onClick={() => handleApprove(c.id)}
                                                        >
                                                            <LucideCheckCircle2 className="h-3.5 w-3.5 mr-1" />
                                                            Aprobar
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="destructive"
                                                            className="h-8 px-2.5 text-xs"
                                                            onClick={() => handleReject(c.id)}
                                                        >
                                                            <LucideXCircle className="h-3.5 w-3.5 mr-1" />
                                                            Rechazar
                                                        </Button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="h-8 px-2 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                                                            title="Ver Analíticas Detalladas"
                                                            onClick={() => openAnalytics(c.id)}
                                                        >
                                                            <LucideBarChart2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                        {c.type === "house" && (
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                className="h-8 px-2"
                                                                title="Editar House Ad"
                                                                onClick={() => openEditDialog(c)}
                                                            >
                                                                <LucideEdit className="h-3.5 w-3.5" />
                                                            </Button>
                                                        )}
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="h-8 px-2"
                                                            title={c.status === "active" ? "Pausar" : "Activar"}
                                                            onClick={() => handleToggleStatus(c)}
                                                        >
                                                            {c.status === "active" ? (
                                                                <LucidePause className="h-3.5 w-3.5 text-amber-400" />
                                                            ) : (
                                                                <LucidePlay className="h-3.5 w-3.5 text-green-400" />
                                                            )}
                                                        </Button>
                                                    </>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Create/Edit Campaign Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            {editingCampaign ? "Editar Campaña" : "Crear Nueva Campaña"}
                        </DialogTitle>
                        <DialogDescription>
                            Define la creatividad, el placement y los destinos de la campaña.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-3">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label>Nombre interno</Label>
                                <Input
                                    placeholder="ej. Promo BisectHosting Octubre"
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label>Tipo de Campaña</Label>
                                <Select
                                    value={form.type}
                                    onValueChange={(val) => setForm({ ...form, type: val })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="house">House Ad (Interno)</SelectItem>
                                        <SelectItem value="creator_modpack">Modpack Patrocinado</SelectItem>
                                        <SelectItem value="external_sponsor">Sponsor Externo / Hosting</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label>Ubicación (Placement)</Label>
                                <Select
                                    value={form.placement}
                                    onValueChange={(val) => setForm({ ...form, placement: val })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="hero_carousel">Hero Carousel (Explore)</SelectItem>
                                        <SelectItem value="explore_banner">Banner Horizontal (Explore)</SelectItem>
                                        <SelectItem value="modpack_sidebar">Widget Detalle Modpack</SelectItem>
                                        <SelectItem value="server_sponsor">Pestaña Servidores</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1.5">
                                <Label>Peso de Rotación (1 - 10)</Label>
                                <Input
                                    type="number"
                                    min={1}
                                    max={10}
                                    value={form.weight}
                                    onChange={(e) => setForm({ ...form, weight: Number(e.target.value) })}
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label>Título público</Label>
                            <Input
                                placeholder="ej. Alojá tu servidor con 25% de descuento"
                                value={form.title}
                                onChange={(e) => setForm({ ...form, title: e.target.value })}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label>Subtítulo o descripción breve</Label>
                            <Input
                                placeholder="ej. Servidores de alto rendimiento con instalación en un clic."
                                value={form.subtitle}
                                onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label>URL del Banner / Imagen (Media URL)</Label>
                            <Input
                                placeholder="https://..."
                                value={form.mediaUrl}
                                onChange={(e) => setForm({ ...form, mediaUrl: e.target.value })}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label>Texto de la Insignia (Badge)</Label>
                                <Input
                                    placeholder="Patrocinado"
                                    value={form.badgeText}
                                    onChange={(e) => setForm({ ...form, badgeText: e.target.value })}
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label>Texto del Botón (CTA)</Label>
                                <Input
                                    placeholder="Ver más"
                                    value={form.ctaText}
                                    onChange={(e) => setForm({ ...form, ctaText: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label>Modpack ID destino (opcional)</Label>
                                <Input
                                    placeholder="UUID del modpack interno"
                                    value={form.targetModpackId}
                                    onChange={(e) => setForm({ ...form, targetModpackId: e.target.value })}
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label>URL Externa destino (opcional)</Label>
                                <Input
                                    placeholder="https://holy.gg/..."
                                    value={form.targetUrl}
                                    onChange={(e) => setForm({ ...form, targetUrl: e.target.value })}
                                />
                            </div>
                        </div>

                        {/* Live UTM Preview */}
                        {liveUtmPreview && (
                            <div className="p-3 rounded-lg bg-muted/40 border border-border text-xs space-y-1.5">
                                <div className="font-semibold text-foreground flex items-center gap-1.5">
                                    <span>Vista previa Auto-UTM para el anunciante</span>
                                </div>
                                <p className="font-mono text-xs text-muted-foreground bg-muted/60 p-2 rounded border border-border/50 break-all select-all">
                                    {liveUtmPreview}
                                </p>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label>Tope Máximo Impresiones (opcional)</Label>
                                <Input
                                    type="number"
                                    placeholder="ej. 50000"
                                    value={form.maxImpressions}
                                    onChange={(e) => setForm({ ...form, maxImpressions: e.target.value })}
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label>Tope Máximo Clics (opcional)</Label>
                                <Input
                                    type="number"
                                    placeholder="ej. 1000"
                                    value={form.maxClicks}
                                    onChange={(e) => setForm({ ...form, maxClicks: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label>Notas de Pago / Registro Interno</Label>
                            <Input
                                placeholder="ej. Pago vía PayPal ID #ABC-123 / Factura #45"
                                value={form.paymentNotes}
                                onChange={(e) => setForm({ ...form, paymentNotes: e.target.value })}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
                            Cancelar
                        </Button>
                        <Button onClick={handleSave} disabled={saving}>
                            {saving ? <LucideLoader className="h-4 w-4 animate-spin mr-2" /> : null}
                            Guardar Campaña
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Detailed Analytics Dialog */}
            <CampaignAnalyticsDialog
                open={analyticsDialogOpen}
                onOpenChange={setAnalyticsDialogOpen}
                campaignId={selectedAnalyticsCampaignId}
                fetchUrl={
                    selectedAnalyticsCampaignId
                        ? `${API_ENDPOINT}/admin/ads/${selectedAnalyticsCampaignId}/analytics`
                        : null
                }
            />
        </div>
    );
};
