import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    CardFooter
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
    LucideTrendingUp,
    LucideTrendingDown,
    LucideUsers,
    LucideDownload,
    LucideShoppingBag,
    LucideRefreshCw,
    LucideThumbsUp,
    LucideActivity,
    LucideCalendarRange,
    LucideMinus
} from 'lucide-react';
import { AreaChart, BarChart } from '@/components/ui/chart-components';
import { useAuthentication } from '@/stores/AuthContext';
import { API_ENDPOINT } from '@/consts';
import { cn } from '@/lib/utils';
import { subDays, format } from 'date-fns'; // Asumiendo disponibilidad o usando nativo JS

// --- Interfaces (Mantenidas del original) ---

interface TrendPoint {
    date: string;
    count: number;
    name?: string;
}

interface OverviewData {
    totalDownloads: number;
    totalAcquisitions: number;
    totalModpacks: number;
    totalLikes: number;
    totalDislikes: number;
    activeUsers24h: number;
    trends: {
        dailyDownloads: TrendPoint[];
        dailyAcquisitions: TrendPoint[];
        dailyActiveUsers: TrendPoint[];
    };
    topModpacks: Array<{
        modpackId: string;
        name: string;
        downloads: number;
        acquisitions: number;
        likes: number;
        dislikes: number;
        activeUsers: number;
    }>;
}

interface AnalyticsData {
    retention: {
        averageRetentionDays: number;
        retentionByModpack: any[];
        retentionTrend: any[];
    };
    updates: {
        adoptionRate: number;
        updateAdoptionByVersion: any[];
        updateTrend: any[];
    };
    comparative: {
        downloadsVsPlatform: { yourDownloads: number; platformAverage: number; percentile: number };
        retentionVsPlatform: { yourRetention: number; platformAverage: number; percentile: number };
        updateAdoptionVsPlatform: { yourAdoption: number; platformAverage: number; percentile: number };
    };
}

// --- Helper para Fechas ---

const calculatePreviousPeriod = (period: string): string => {
    // Intenta calcular un rango de fechas real si la API soporta formato "YYYY-MM-DD,YYYY-MM-DD"
    // O devuelve un string lógico si la API usa convenios como 'prev_30d'
    // Aquí implementamos una lógica de fechas estándar para mayor realismo
    const today = new Date();
    let days = 30;

    switch (period) {
        case '7d': days = 7; break;
        case '30d': days = 30; break;
        case '90d': days = 90; break;
        case '1y': days = 365; break;
        default: days = 30;
    }

    // Calculamos el periodo ANTERIOR al seleccionado
    // Ejemplo: Si hoy es 30 Ene, selected (30d) es 1-30 Ene. Previous es 2 Dic - 31 Dic.
    const endOfPrevious = subDays(today, days);
    const startOfPrevious = subDays(endOfPrevious, days);

    // Retornamos un formato que la API podría entender, o el mismo periodo con un flag
    // NOTA: Dependiendo de tu backend, esto podría ser `?from=...&to=...`
    // Aquí asumimos que podemos pasar un rango personalizado o un identificador.
    // Para asegurar compatibilidad con el código existente que espera un string en 'period':
    return `${format(startOfPrevious, 'yyyy-MM-dd')},${format(endOfPrevious, 'yyyy-MM-dd')}`;
};

// --- Componente Auxiliar: Tarjeta de Métrica ---

interface MetricCardProps {
    title: string;
    value: number | string;
    previousValue?: number | null;
    icon: React.ElementType;
    description?: string;
    formatValue?: (val: number) => string;
    loading?: boolean;
    comparisonLabel?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({
    title,
    value,
    previousValue,
    icon: Icon,
    description,
    formatValue = (v) => v.toLocaleString(),
    loading,
    comparisonLabel = "vs. periodo anterior"
}) => {
    if (loading) {
        return (
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium"><Skeleton className="h-4 w-24" /></CardTitle>
                    <Skeleton className="h-4 w-4 rounded-full" />
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-8 w-32 mb-2" />
                    <Skeleton className="h-3 w-40" />
                </CardContent>
            </Card>
        );
    }

    // Calcular crecimiento real
    let growth = 0;
    let growthLabel = "0%";
    let isPositive = true;
    let hasPreviousData = typeof previousValue === 'number';

    if (typeof value === 'number' && hasPreviousData && previousValue !== 0) {
        // @ts-ignore
        growth = ((value - previousValue) / previousValue) * 100;
        growthLabel = `${growth > 0 ? '+' : ''}${growth.toFixed(1)}%`;
        isPositive = growth >= 0;
    } else if (hasPreviousData && previousValue === 0 && Number(value) > 0) {
        growthLabel = "+100%";
        isPositive = true;
    }

    return (
        <Card className="hover:border-primary/50 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
                <div className="p-2 bg-primary/10 rounded-full">
                    <Icon className="h-4 w-4 text-primary" />
                </div>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{typeof value === 'number' ? formatValue(value) : value}</div>
                <div className="flex items-center text-xs mt-1 h-5">
                    {hasPreviousData ? (
                        <>
                            <Badge
                                variant="secondary"
                                className={cn(
                                    "mr-2 px-1 py-0 border",
                                    isPositive
                                        ? "text-emerald-500 bg-emerald-500/10 border-emerald-500/20"
                                        : "text-rose-500 bg-rose-500/10 border-rose-500/20"
                                )}
                            >
                                {isPositive ? <LucideTrendingUp className="h-3 w-3 mr-1" /> : <LucideTrendingDown className="h-3 w-3 mr-1" />}
                                {growthLabel}
                            </Badge>
                            <span className="text-muted-foreground truncate">{comparisonLabel}</span>
                        </>
                    ) : (
                        <span className="text-muted-foreground text-xs flex items-center">
                            <LucideMinus className="h-3 w-3 mr-1" /> Sin datos previos
                        </span>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};

// --- Componente Principal ---

export const PublisherAnalyticsView: React.FC = () => {
    const { sessionTokens } = useAuthentication();
    const { publisherId } = useParams<{ publisherId: string }>();

    const [data, setData] = useState<{
        overview: OverviewData | null;
        current: AnalyticsData | null;
        previous: AnalyticsData | null;
    }>({ overview: null, current: null, previous: null });

    const [loading, setLoading] = useState(true);
    const [selectedPeriod, setSelectedPeriod] = useState('30d');
    const [activeChart, setActiveChart] = useState<'downloads' | 'acquisitions' | 'users'>('downloads');

    const fetchAllAnalytics = async () => {
        if (!publisherId) return;
        setLoading(true);

        const headers = { Authorization: `Bearer ${sessionTokens?.accessToken}` };

        // Calculamos el periodo anterior real
        const previousPeriodParam = calculatePreviousPeriod(selectedPeriod);

        try {
            const [overviewRes, currentRes, previousRes] = await Promise.all([
                fetch(`${API_ENDPOINT}/creators/${publisherId}/analytics/overview`, { headers }),
                fetch(`${API_ENDPOINT}/creators/${publisherId}/analytics/comprehensive?period=${selectedPeriod}`, { headers }),
                // Intentamos buscar datos del periodo anterior real
                fetch(`${API_ENDPOINT}/creators/${publisherId}/analytics/comprehensive?period=${previousPeriodParam}`, { headers })
            ]);

            const [overviewJson, currentJson, previousJson] = await Promise.all([
                overviewRes.ok ? overviewRes.json() : null,
                currentRes.ok ? currentRes.json() : null,
                previousRes.ok ? previousRes.json() : null
            ]);

            // Transformaciones
            const processOverview = (rawData: any) => {
                if (!rawData?.data?.trends) return rawData?.data;
                const processTrend = (arr: any[]) => arr.map(t => ({
                    ...t,
                    name: new Date(t.date).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })
                }));
                return {
                    ...rawData.data,
                    trends: {
                        dailyDownloads: processTrend(rawData.data.trends.dailyDownloads),
                        dailyAcquisitions: processTrend(rawData.data.trends.dailyAcquisitions),
                        dailyActiveUsers: processTrend(rawData.data.trends.dailyActiveUsers),
                    }
                };
            };

            const processAnalytics = (rawData: any): AnalyticsData | null => {
                if (!rawData?.data) return null;
                return {
                    retention: rawData.data.retention,
                    updates: rawData.data.updates,
                    comparative: rawData.data.comparative
                } as AnalyticsData;
            };

            setData({
                overview: processOverview(overviewJson),
                current: processAnalytics(currentJson),
                previous: processAnalytics(previousJson) // Aquí guardamos la data real, si falló será null
            });

        } catch (error) {
            console.error("Error fetching analytics:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAllAnalytics();
    }, [publisherId, selectedPeriod]);

    // Configuración del gráfico
    const mainChartConfig = useMemo(() => {
        if (!data.overview) {
            return { data: [], color: "var(--chart-1)", label: "" };
        }

        switch (activeChart) {
            case 'downloads':
                return { data: data.overview.trends.dailyDownloads, color: "var(--chart-1)", label: "Instalaciones" };
            case 'acquisitions':
                return { data: data.overview.trends.dailyAcquisitions, color: "var(--chart-2)", label: "Adquisiciones" };
            case 'users':
                return { data: data.overview.trends.dailyActiveUsers, color: "var(--chart-3)", label: "Usuarios Activos" };
            default:
                return { data: [], color: "var(--chart-1)", label: "" };
        }
    }, [data.overview, activeChart]);

    // Helpers para obtener valores seguros
    // NOTA: 'overview' suele ser total histórico o estado actual. 
    // 'current.comparative' nos da el valor específico del periodo seleccionado.
    const getPeriodDownloads = () => data.current?.comparative?.downloadsVsPlatform?.yourDownloads ?? 0;
    const getPreviousPeriodDownloads = () => data.previous?.comparative?.downloadsVsPlatform?.yourDownloads ?? null;

    // Para adquisiciones, si no está en 'comparative', usamos overview (pero sin trend previo si no existe data)
    // Asumimos que overview es el total. Si queremos trend, necesitamos data previa que tal vez no tengamos.
    const getAcquisitions = () => data.overview?.totalAcquisitions ?? 0;

    const getRetention = () => data.current?.retention?.averageRetentionDays ?? 0;
    const getPreviousRetention = () => data.previous?.retention?.averageRetentionDays ?? null;

    const getAdoption = () => data.current?.updates?.adoptionRate ?? 0;
    const getPreviousAdoption = () => data.previous?.updates?.adoptionRate ?? null;


    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header (Consistent with Admin Layout) */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-500">
                        <LucideActivity className="h-5 w-5" />
                    </div>
                    <div>
                        <h1 className="text-lg font-semibold text-foreground">Métricas y Analíticas</h1>
                        <p className="text-sm text-muted-foreground">Monitoriza el impacto y rendimiento de tus creaciones.</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 bg-background/50 p-1 rounded-lg border backdrop-blur-sm">
                    <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                        <SelectTrigger className="w-[150px] border-0 focus:ring-0 bg-transparent">
                            <LucideCalendarRange className="mr-2 h-4 w-4 text-muted-foreground" />
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="7d">Últimos 7 días</SelectItem>
                            <SelectItem value="30d">Últimos 30 días</SelectItem>
                            <SelectItem value="90d">Últimos 3 meses</SelectItem>
                        </SelectContent>
                    </Select>
                    <div className="h-4 w-[1px] bg-border" />
                    <Button variant="ghost" size="icon" onClick={fetchAllAnalytics} disabled={loading} className="h-8 w-8 rounded-md">
                        <LucideRefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                    </Button>
                </div>
            </div>

            {/* Metrics Grid - CON DATOS REALES */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <MetricCard
                    title="Instalaciones en Periodo"
                    value={getPeriodDownloads()}
                    previousValue={getPreviousPeriodDownloads()}
                    icon={LucideDownload}
                    description="Instalaciones completadas"
                    loading={loading}
                />

                {/* Nota: Para adquisiciones usamos el total del overview ya que no tenemos 'period' data en la interfaz AnalyticsData */}
                <MetricCard
                    title="Adquisiciones Totales"
                    value={getAcquisitions()}
                    previousValue={null} // No mostramos trend falso si no tenemos data previa
                    icon={LucideShoppingBag}
                    description="Reclamos acumulados"
                    loading={loading}
                />

                <MetricCard
                    title="Retención Promedio"
                    value={getRetention()}
                    previousValue={getPreviousRetention()}
                    icon={LucideUsers}
                    formatValue={(v) => `${v.toFixed(1)} días`}
                    description="Tiempo de vida de instalación"
                    loading={loading}
                />

                <MetricCard
                    title="Tasa de Adopción"
                    value={getAdoption() * 100}
                    previousValue={getPreviousAdoption() ? (getPreviousAdoption()! * 100) : null}
                    icon={LucideActivity}
                    formatValue={(v) => `${v.toFixed(1)}%`}
                    description="Usuarios en última versión"
                    loading={loading}
                />
            </div>

            {/* Tabs & Charts */}
            <Tabs defaultValue="overview" className="space-y-4">
                <TabsList className="bg-muted/50 p-1">
                    <TabsTrigger value="overview">Resumen</TabsTrigger>
                    <TabsTrigger value="comparative">Comparativo</TabsTrigger>
                    {/* ... otros tabs ... */}
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-7">
                        <Card className="md:col-span-4 lg:col-span-5">
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle>Tendencias</CardTitle>
                                        <CardDescription>Actividad diaria en el periodo seleccionado.</CardDescription>
                                    </div>
                                    <div className="flex bg-muted rounded-lg p-1">
                                        <button onClick={() => setActiveChart('downloads')} className={cn("px-3 py-1 text-xs font-medium rounded-md transition-all", activeChart === 'downloads' ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground")}>
                                            Instalaciones
                                        </button>
                                        <button onClick={() => setActiveChart('acquisitions')} className={cn("px-3 py-1 text-xs font-medium rounded-md transition-all", activeChart === 'acquisitions' ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground")}>
                                            Adquisiciones
                                        </button>
                                        <button onClick={() => setActiveChart('users')} className={cn("px-3 py-1 text-xs font-medium rounded-md transition-all", activeChart === 'users' ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground")}>
                                            Usuarios
                                        </button>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="pl-0">
                                {loading ? (
                                    <div className="h-[300px] flex items-center justify-center"><Skeleton className="h-[250px] w-[90%]" /></div>
                                ) : (
                                    <div className="h-[300px] w-full">
                                        <AreaChart
                                            data={mainChartConfig.data}
                                            config={{ count: { label: mainChartConfig.label, color: mainChartConfig.color } }}
                                        />
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Card className="md:col-span-3 lg:col-span-2 flex flex-col">
                            <CardHeader>
                                <CardTitle>Top Modpacks</CardTitle>
                                <CardDescription>Rendimiento actual</CardDescription>
                            </CardHeader>
                            <CardContent className="flex-1 overflow-hidden">
                                <div className="space-y-4 pr-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                                    {data.overview?.topModpacks.map((modpack) => (
                                        <div key={modpack.modpackId} className="flex items-center justify-between">
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                                                    {modpack.name.substring(0, 2).toUpperCase()}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-medium text-sm truncate">{modpack.name}</p>
                                                    <p className="text-[10px] text-muted-foreground">{modpack.activeUsers.toLocaleString()} users</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-sm font-bold block">{modpack.downloads.toLocaleString()}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="comparative" className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-3">
                        {/* Tarjetas comparativas usando datos REALES de 'current' */}
                        {[
                            {
                                title: "Descargas",
                                percentile: data.current?.comparative?.downloadsVsPlatform?.percentile ?? 0,
                                your: data.current?.comparative.downloadsVsPlatform.yourDownloads,
                                avg: data.current?.comparative.downloadsVsPlatform.platformAverage,
                                unit: ""
                            },
                            {
                                title: "Retención",
                                percentile: data.current?.comparative?.retentionVsPlatform?.percentile ?? 0,
                                your: data.current?.comparative.retentionVsPlatform.yourRetention,
                                avg: data.current?.comparative.retentionVsPlatform.platformAverage,
                                unit: "d"
                            },
                            {
                                title: "Updates",
                                percentile: data.current?.comparative?.updateAdoptionVsPlatform?.percentile ?? 0,
                                your: (data.current?.comparative.updateAdoptionVsPlatform.yourAdoption || 0) * 100,
                                avg: (data.current?.comparative.updateAdoptionVsPlatform.platformAverage || 0) * 100,
                                unit: "%"
                            }
                        ].map((metric, i) => (
                            <Card key={i}>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-center text-sm font-medium text-muted-foreground">{metric.title}</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-center mb-4">
                                        <div className="text-4xl font-bold">{metric.percentile}<span className="text-xl">º</span></div>
                                        <p className="text-xs text-muted-foreground">Percentil Global</p>
                                    </div>
                                    {/* Visualización de barras comparativas reales */}
                                    <div className="space-y-2 text-xs">
                                        <div className="flex justify-between">
                                            <span>Tú</span>
                                            <span className="font-bold">{typeof metric.your === 'number' ? metric.your.toFixed(1) : '-'}{metric.unit}</span>
                                        </div>
                                        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                                            <div className="h-full bg-primary" style={{ width: `${Math.min(100, (metric.your || 0) / Math.max((metric.your || 1), (metric.avg || 1)) * 100)}%` }} />
                                        </div>
                                        <div className="flex justify-between pt-1">
                                            <span className="text-muted-foreground">Promedio</span>
                                            <span className="text-muted-foreground">{typeof metric.avg === 'number' ? metric.avg.toFixed(1) : '-'}{metric.unit}</span>
                                        </div>
                                        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                                            <div className="h-full bg-muted-foreground/30" style={{ width: `${Math.min(100, (metric.avg || 0) / Math.max((metric.your || 1), (metric.avg || 1)) * 100)}%` }} />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
};