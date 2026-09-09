import React, { useState, useEffect, useMemo } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
    LucideEye,
    LucideMousePointerClick,
    LucideTrendingUp,
    LucideCalendar,
    LucideLink,
    LucideCopy,
    LucideCheck,
    LucideLoader,
    LucideMegaphone,
    LucideExternalLink,
} from "lucide-react";
import { BarChart, LineChart } from "@/components/ui/chart-components";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { subDays, format } from "date-fns";

interface DailyMetric {
    date: string;
    impressions: number;
    clicks: number;
    ctr: string;
}

interface CampaignAnalyticsResponse {
    campaign: {
        id: string;
        name: string;
        type: string;
        placement: string;
        status: string;
        title: string;
        subtitle: string | null;
        badgeText: string;
        ctaText: string;
        mediaUrl: string;
        targetUrl: string | null;
        trackedTargetUrl: string | null;
        maxImpressions: number | null;
        maxClicks: number | null;
        startAt: string;
        endAt: string | null;
        creatorName?: string | null;
        modpackName?: string | null;
    };
    period: {
        from: string;
        to: string;
    };
    totals: {
        impressions: number;
        clicks: number;
        ctr: string;
    };
    daily: DailyMetric[];
}

interface CampaignAnalyticsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    campaignId: string | null;
    fetchUrl: string | null;
}

export const CampaignAnalyticsDialog: React.FC<CampaignAnalyticsDialogProps> = ({
    open,
    onOpenChange,
    campaignId,
    fetchUrl,
}) => {
    const [period, setPeriod] = useState<string>("30d");
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<CampaignAnalyticsResponse | null>(null);
    const [copiedUrl, setCopiedUrl] = useState(false);
    const [chartMetric, setChartMetric] = useState<"both" | "impressions" | "clicks">("both");

    const { fromStr, toStr } = useMemo(() => {
        const today = new Date();
        const to = format(today, "yyyy-MM-dd");
        let fromDate = subDays(today, 29);

        if (period === "7d") fromDate = subDays(today, 6);
        else if (period === "14d") fromDate = subDays(today, 13);
        else if (period === "30d") fromDate = subDays(today, 29);
        else if (period === "90d") fromDate = subDays(today, 89);
        else if (period === "all") fromDate = subDays(today, 365);

        return {
            fromStr: format(fromDate, "yyyy-MM-dd"),
            toStr: to,
        };
    }, [period]);

    useEffect(() => {
        if (!open || !fetchUrl || !campaignId) {
            return;
        }

        let isMounted = true;
        const loadAnalytics = async () => {
            try {
                setLoading(true);
                const url = new URL(fetchUrl);
                url.searchParams.set("from", fromStr);
                url.searchParams.set("to", toStr);

                const res = await fetchWithAuth(url.toString());
                if (!res.ok) {
                    throw new Error("No se pudieron cargar las analíticas.");
                }
                const json = await res.json();
                if (isMounted) {
                    setData(json.data);
                }
            } catch (err: any) {
                if (isMounted) {
                    toast.error(err.message || "Error al cargar analíticas");
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        loadAnalytics();

        return () => {
            isMounted = false;
        };
    }, [open, fetchUrl, campaignId, fromStr, toStr]);

    const handleCopyUrl = (url: string) => {
        navigator.clipboard.writeText(url);
        setCopiedUrl(true);
        toast.success("URL con parámetros UTM copiada al portapapeles");
        setTimeout(() => setCopiedUrl(false), 2500);
    };

    const chartData = useMemo(() => {
        if (!data?.daily) return [];
        return data.daily.map((d) => ({
            name: d.date.slice(5),
            fullDate: d.date,
            impressions: d.impressions,
            clicks: d.clicks,
        }));
    }, [data?.daily]);

    const chartConfig = useMemo(() => {
        if (chartMetric === "impressions") {
            return {
                impressions: {
                    label: "Impresiones",
                    color: "var(--chart-1)",
                },
            };
        }
        if (chartMetric === "clicks") {
            return {
                clicks: {
                    label: "Clics",
                    color: "var(--chart-2)",
                },
            };
        }
        return {
            impressions: {
                label: "Impresiones",
                color: "var(--chart-1)",
            },
            clicks: {
                label: "Clics",
                color: "var(--chart-2)",
            },
        };
    }, [chartMetric]);

    const campaign = data?.campaign;
    const totals = data?.totals;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto custom-scrollbar flex flex-col p-6 gap-6">
                {/* Header */}
                <DialogHeader className="space-y-3 pb-4 border-b border-border">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-lg bg-primary/10 text-primary shrink-0">
                                <LucideMegaphone className="h-5 w-5" />
                            </div>
                            <div>
                                <DialogTitle className="text-xl font-bold tracking-tight">
                                    {campaign?.title || "Analíticas de Campaña"}
                                </DialogTitle>
                                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                                    {campaign?.name || "Rendimiento y métricas de interacción"}
                                </DialogDescription>
                            </div>
                        </div>

                        {/* Period Filter */}
                        <div className="flex items-center gap-2 shrink-0">
                            <LucideCalendar className="w-4 h-4 text-muted-foreground" />
                            <Select value={period} onValueChange={setPeriod}>
                                <SelectTrigger className="w-[145px] h-8 text-xs">
                                    <SelectValue placeholder="Periodo" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="7d">Últimos 7 días</SelectItem>
                                    <SelectItem value="14d">Últimos 14 días</SelectItem>
                                    <SelectItem value="30d">Últimos 30 días</SelectItem>
                                    <SelectItem value="90d">Últimos 90 días</SelectItem>
                                    <SelectItem value="all">Histórico (1 año)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {campaign && (
                        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                            <Badge variant="outline" className="capitalize">
                                {campaign.placement.replace("_", " ")}
                            </Badge>
                            <Badge variant="secondary" className="capitalize">
                                {campaign.type.replace("_", " ")}
                            </Badge>
                            {campaign.status === "active" && (
                                <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                                    Activa
                                </Badge>
                            )}
                            {campaign.status === "paused" && (
                                <Badge variant="secondary">Pausada</Badge>
                            )}
                            {campaign.status === "completed" && (
                                <Badge variant="outline">Finalizada</Badge>
                            )}
                            {campaign.status === "pending_approval" && (
                                <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                                    Pendiente
                                </Badge>
                            )}
                            {campaign.creatorName && (
                                <span className="text-muted-foreground text-xs">
                                    Creador: <span className="text-foreground font-medium">{campaign.creatorName}</span>
                                </span>
                            )}
                            {campaign.modpackName && (
                                <span className="text-muted-foreground text-xs">
                                    Modpack: <span className="text-foreground font-medium">{campaign.modpackName}</span>
                                </span>
                            )}
                        </div>
                    )}
                </DialogHeader>

                {loading ? (
                    <div className="py-20 flex flex-col items-center justify-center gap-3">
                        <LucideLoader className="w-8 h-8 text-primary animate-spin" />
                        <p className="text-xs text-muted-foreground">Cargando métricas de la campaña...</p>
                    </div>
                ) : data ? (
                    <div className="space-y-6">
                        {/* KPI Metrics */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <Card>
                                <CardHeader className="p-4 pb-2">
                                    <CardDescription className="flex items-center gap-1.5">
                                        <LucideEye className="h-3.5 w-3.5" /> Impresiones Totales
                                    </CardDescription>
                                    <CardTitle className="text-2xl font-bold">
                                        {totals?.impressions.toLocaleString()}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-4 pt-0 text-xs text-muted-foreground">
                                    {campaign?.maxImpressions
                                        ? `Tope: ${campaign.maxImpressions.toLocaleString()} imp.`
                                        : "Sin límite establecido"}
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader className="p-4 pb-2">
                                    <CardDescription className="flex items-center gap-1.5">
                                        <LucideMousePointerClick className="h-3.5 w-3.5" /> Clics Generados
                                    </CardDescription>
                                    <CardTitle className="text-2xl font-bold">
                                        {totals?.clicks.toLocaleString()}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-4 pt-0 text-xs text-muted-foreground">
                                    {campaign?.maxClicks
                                        ? `Tope: ${campaign.maxClicks.toLocaleString()} clics`
                                        : "Sin límite establecido"}
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader className="p-4 pb-2">
                                    <CardDescription className="flex items-center gap-1.5">
                                        <LucideTrendingUp className="h-3.5 w-3.5" /> CTR Promedio
                                    </CardDescription>
                                    <CardTitle className="text-2xl font-bold">
                                        {totals?.ctr}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-4 pt-0 text-xs text-muted-foreground">
                                    Tasa de clics por visualización
                                </CardContent>
                            </Card>
                        </div>

                        {/* Chart Card */}
                        <Card>
                            <CardHeader className="p-4 pb-2">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                    <div>
                                        <CardTitle className="text-base font-semibold">
                                            Evolución en el Tiempo
                                        </CardTitle>
                                        <CardDescription className="text-xs">
                                            Tendencia diaria del {fromStr} al {toStr}
                                        </CardDescription>
                                    </div>
                                    <div className="flex bg-muted rounded-lg p-1">
                                        <button
                                            type="button"
                                            onClick={() => setChartMetric("both")}
                                            className={cn(
                                                "px-2.5 py-1 text-xs font-medium rounded-md transition-all",
                                                chartMetric === "both"
                                                    ? "bg-background shadow text-foreground"
                                                    : "text-muted-foreground hover:text-foreground"
                                            )}
                                        >
                                            Ambos
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setChartMetric("impressions")}
                                            className={cn(
                                                "px-2.5 py-1 text-xs font-medium rounded-md transition-all",
                                                chartMetric === "impressions"
                                                    ? "bg-background shadow text-foreground"
                                                    : "text-muted-foreground hover:text-foreground"
                                            )}
                                        >
                                            Impresiones
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setChartMetric("clicks")}
                                            className={cn(
                                                "px-2.5 py-1 text-xs font-medium rounded-md transition-all",
                                                chartMetric === "clicks"
                                                    ? "bg-background shadow text-foreground"
                                                    : "text-muted-foreground hover:text-foreground"
                                            )}
                                        >
                                            Clics
                                        </button>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-4 pt-2">
                                <div className="h-[260px] w-full">
                                    <BarChart
                                        data={chartData}
                                        config={chartConfig}
                                        className="min-h-[260px]"
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        {/* Tracking URL preview */}
                        {campaign?.trackedTargetUrl && (
                            <Card className="border-border bg-muted/20">
                                <CardContent className="p-4 space-y-2">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                                            <LucideLink className="w-4 h-4 text-primary shrink-0" />
                                            <span>Enlace de Destino con Auto-UTM</span>
                                        </div>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleCopyUrl(campaign.trackedTargetUrl!)}
                                            className="h-7 text-xs"
                                        >
                                            {copiedUrl ? (
                                                <>
                                                    <LucideCheck className="w-3.5 h-3.5 mr-1.5 text-green-400" />
                                                    Copiado
                                                </>
                                            ) : (
                                                <>
                                                    <LucideCopy className="w-3.5 h-3.5 mr-1.5" />
                                                    Copiar URL
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                    <p className="text-xs font-mono text-muted-foreground break-all bg-muted/60 p-2.5 rounded-md border border-border/50 select-all">
                                        {campaign.trackedTargetUrl}
                                    </p>
                                </CardContent>
                            </Card>
                        )}

                        {/* Daily Table */}
                        <div className="space-y-2">
                            <h4 className="text-sm font-semibold text-foreground">Desglose Diario</h4>
                            <div className="rounded-lg border border-border overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="text-xs">Fecha</TableHead>
                                            <TableHead className="text-xs text-right">Impresiones</TableHead>
                                            <TableHead className="text-xs text-right">Clics</TableHead>
                                            <TableHead className="text-xs text-right">CTR</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {data.daily.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={4} className="text-center py-6 text-muted-foreground text-xs">
                                                    Sin actividad en este período.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            [...data.daily].reverse().slice(0, 15).map((row) => (
                                                <TableRow key={row.date}>
                                                    <TableCell className="font-mono text-xs">
                                                        {row.date}
                                                    </TableCell>
                                                    <TableCell className="text-right text-xs font-medium">
                                                        {row.impressions.toLocaleString()}
                                                    </TableCell>
                                                    <TableCell className="text-right text-xs font-medium">
                                                        {row.clicks.toLocaleString()}
                                                    </TableCell>
                                                    <TableCell className="text-right text-xs text-muted-foreground">
                                                        {row.ctr}
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    </div>
                ) : null}

                <DialogFooter className="pt-2 border-t border-border">
                    <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                        Cerrar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
