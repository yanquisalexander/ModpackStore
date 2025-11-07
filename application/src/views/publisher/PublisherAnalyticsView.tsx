import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    LucideTrendingUp,
    LucideUsers,
    LucideDownload,
    LucideClock,
    LucideRefreshCw
} from 'lucide-react';
import { AreaChart, BarChart, LineChart } from '@/components/ui/chart-components';
import { useAuthentication } from '@/stores/AuthContext';
import { API_ENDPOINT } from '@/consts';
import { useParams } from 'react-router-dom';

interface AnalyticsData {
    retention: {
        averageRetentionDays: number;
        retentionByModpack: Array<{
            modpackName: string;
            averageRetentionDays: number;
            totalUsers: number;
        }>;
        retentionTrend: Array<{
            date: string;
            averageRetention: number;
        }>;
    };
    updates: {
        adoptionRate: number;
        updateAdoptionByVersion: Array<{
            version: string;
            adoptionRate: number;
            totalUsers: number;
        }>;
        updateTrend: Array<{
            date: string;
            updatesAdopted: number;
            totalAvailable: number;
        }>;
    };
    comparative: {
        downloadsVsPlatform: {
            yourDownloads: number;
            platformAverage: number;
            percentile: number;
        };
        retentionVsPlatform: {
            yourRetention: number;
            platformAverage: number;
            percentile: number;
        };
        updateAdoptionVsPlatform: {
            yourAdoption: number;
            platformAverage: number;
            percentile: number;
        };
    };
}

export const PublisherAnalyticsView: React.FC = () => {
    const { sessionTokens } = useAuthentication();
    const { publisherId } = useParams<{ publisherId: string }>();
    const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
    const [previousPeriodData, setPreviousPeriodData] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedPeriod, setSelectedPeriod] = useState('30d');

    const fetchAnalytics = async () => {
        if (!publisherId) return;

        try {
            setLoading(true);

            // Fetch current period data
            const currentResponse = await fetch(
                `${API_ENDPOINT}/creators/publishers/${publisherId}/analytics/comprehensive?period=${selectedPeriod}`,
                {
                    headers: {
                        Authorization: `Bearer ${sessionTokens?.accessToken}`,
                    },
                }
            );

            // Fetch previous period data for comparison
            const previousResponse = await fetch(
                `${API_ENDPOINT}/creators/publishers/${publisherId}/analytics/comprehensive?period=${getPreviousPeriod(selectedPeriod)}`,
                {
                    headers: {
                        Authorization: `Bearer ${sessionTokens?.accessToken}`,
                    },
                }
            );

            if (currentResponse.ok) {
                const currentData = await currentResponse.json();
                const transformedData = transformAnalyticsData(currentData);
                setAnalyticsData(transformedData);
            }

            if (previousResponse.ok) {
                const previousData = await previousResponse.json();
                const transformedPreviousData = transformAnalyticsData(previousData);
                setPreviousPeriodData(transformedPreviousData);
            }
        } catch (error) {
            console.error('Error fetching analytics:', error);
        } finally {
            setLoading(false);
        }
    };

    const getPreviousPeriod = (currentPeriod: string): string => {
        // For now, return the same period (simplified)
        // In a real implementation, this would calculate the actual previous period
        // e.g., for '30d' it would be the 30 days before the current 30-day period
        return currentPeriod;
    };

    const transformAnalyticsData = (data: any): AnalyticsData => {
        return {
            retention: {
                averageRetentionDays: data.data?.retention?.averageRetentionDays ?? 0,
                retentionByModpack: data.data?.retention?.retentionByModpack ?? [],
                retentionTrend: (data.data?.retention?.retentionTrend ?? []).map((item: any) => ({
                    ...item,
                    name: item.date
                }))
            },
            updates: {
                adoptionRate: data.data?.updates?.adoptionRate ?? 0,
                updateAdoptionByVersion: data.data?.updates?.updateAdoptionByVersion ?? [],
                updateTrend: (data.data?.updates?.updateTrend ?? []).map((item: any) => ({
                    ...item,
                    name: item.date
                }))
            },
            comparative: {
                downloadsVsPlatform: {
                    yourDownloads: data.data?.comparative?.downloadsVsPlatform?.yourDownloads ?? 0,
                    platformAverage: data.data?.comparative?.downloadsVsPlatform?.platformAverage ?? 0,
                    percentile: data.data?.comparative?.downloadsVsPlatform?.percentile ?? 0
                },
                retentionVsPlatform: {
                    yourRetention: data.data?.comparative?.retentionVsPlatform?.yourRetention ?? 0,
                    platformAverage: data.data?.comparative?.retentionVsPlatform?.platformAverage ?? 0,
                    percentile: data.data?.comparative?.retentionVsPlatform?.percentile ?? 0
                },
                updateAdoptionVsPlatform: {
                    yourAdoption: data.data?.comparative?.updateAdoptionVsPlatform?.yourAdoption ?? 0,
                    platformAverage: data.data?.comparative?.updateAdoptionVsPlatform?.platformAverage ?? 0,
                    percentile: data.data?.comparative?.updateAdoptionVsPlatform?.percentile ?? 0
                }
            }
        };
    };

    const calculatePercentageChange = (current: number, previous: number): string => {
        if (previous === 0) return '+0.0%';
        const change = ((current - previous) / previous) * 100;
        const sign = change >= 0 ? '+' : '';
        return `${sign}${change.toFixed(1)}%`;
    };

    useEffect(() => {
        fetchAnalytics();
    }, [selectedPeriod, publisherId]);

    const retentionChartConfig = {
        averageRetention: {
            label: "Retención Promedio (días)",
            color: "hsl(var(--chart-1))",
        },
    };

    const updateChartConfig = {
        adoptionRate: {
            label: "Tasa de Adopción (%)",
            color: "hsl(var(--chart-2))",
        },
    };

    const comparativeChartConfig = {
        yourValue: {
            label: "Tu Valor",
            color: "hsl(var(--chart-1))",
        },
        platformAverage: {
            label: "Promedio Plataforma",
            color: "hsl(var(--chart-2))",
        },
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold">Analytics</h1>
                        <p className="text-muted-foreground">
                            Métricas de rendimiento de tus modpacks
                        </p>
                    </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {[...Array(4)].map((_, i) => (
                        <Card key={i}>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Cargando...</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="h-4 bg-muted rounded animate-pulse"></div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Analytics</h1>
                    <p className="text-muted-foreground">
                        Métricas de rendimiento de tus modpacks
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                        <SelectTrigger className="w-32">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="7d">7 días</SelectItem>
                            <SelectItem value="30d">30 días</SelectItem>
                            <SelectItem value="90d">90 días</SelectItem>
                            <SelectItem value="1y">1 año</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button variant="outline" size="sm" onClick={fetchAnalytics}>
                        <LucideRefreshCw className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Key Metrics Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Retención Promedio</CardTitle>
                        <LucideClock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {analyticsData?.retention?.averageRetentionDays ? analyticsData.retention.averageRetentionDays.toFixed(1) : '0.0'} días
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {previousPeriodData?.retention?.averageRetentionDays ?
                                calculatePercentageChange(
                                    analyticsData?.retention?.averageRetentionDays ?? 0,
                                    previousPeriodData.retention.averageRetentionDays
                                ) : '+0.0%'} vs período anterior
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Tasa de Adopción</CardTitle>
                        <LucideTrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {analyticsData?.updates?.adoptionRate ? ((analyticsData.updates.adoptionRate || 0) * 100).toFixed(1) : '0.0'}%
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {previousPeriodData?.updates?.adoptionRate ?
                                calculatePercentageChange(
                                    (analyticsData?.updates?.adoptionRate ?? 0) * 100,
                                    (previousPeriodData.updates.adoptionRate ?? 0) * 100
                                ) : '+0.0%'} vs período anterior
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Descargas Totales</CardTitle>
                        <LucideDownload className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {analyticsData?.comparative?.downloadsVsPlatform?.yourDownloads ? analyticsData.comparative.downloadsVsPlatform.yourDownloads.toLocaleString() : '0'}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {analyticsData?.comparative?.downloadsVsPlatform?.percentile ? `${analyticsData.comparative.downloadsVsPlatform.percentile}º` : '0º'} percentil
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Usuarios Activos</CardTitle>
                        <LucideUsers className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {analyticsData?.retention?.retentionByModpack?.reduce((sum, modpack) => sum + modpack.totalUsers, 0)?.toLocaleString() ?? '0'}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Usuarios únicos con descargas
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Detailed Analytics Tabs */}
            <Tabs defaultValue="retention" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="retention">Retención</TabsTrigger>
                    <TabsTrigger value="updates">Actualizaciones</TabsTrigger>
                    <TabsTrigger value="comparative">Comparativo</TabsTrigger>
                </TabsList>

                <TabsContent value="retention" className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <Card>
                            <CardHeader>
                                <CardTitle>Tendencia de Retención</CardTitle>
                                <CardDescription>
                                    Cómo los usuarios mantienen tus modpacks a lo largo del tiempo
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <LineChart
                                    data={analyticsData?.retention.retentionTrend || []}
                                    config={retentionChartConfig}
                                />
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Retención por Modpack</CardTitle>
                                <CardDescription>
                                    Rendimiento individual de cada modpack
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {analyticsData?.retention.retentionByModpack.map((modpack, index) => (
                                        <div key={index} className="flex items-center justify-between">
                                            <div className="space-y-1">
                                                <p className="text-sm font-medium leading-none">
                                                    {modpack.modpackName}
                                                </p>
                                                <p className="text-sm text-muted-foreground">
                                                    {modpack.totalUsers} usuarios
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-sm font-medium">
                                                    {modpack.averageRetentionDays.toFixed(1)} días
                                                </div>
                                                <Badge variant="secondary" className="text-xs">
                                                    {modpack.averageRetentionDays > analyticsData.retention.averageRetentionDays ? '↑' : '↓'}
                                                </Badge>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="updates" className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <Card>
                            <CardHeader>
                                <CardTitle>Adopción de Actualizaciones</CardTitle>
                                <CardDescription>
                                    Tasa de adopción de nuevas versiones
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <AreaChart
                                    data={analyticsData?.updates.updateTrend || []}
                                    config={updateChartConfig}
                                />
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Adopción por Versión</CardTitle>
                                <CardDescription>
                                    Rendimiento de cada actualización
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {analyticsData?.updates.updateAdoptionByVersion.map((version, index) => (
                                        <div key={index} className="flex items-center justify-between">
                                            <div className="space-y-1">
                                                <p className="text-sm font-medium leading-none">
                                                    v{version.version}
                                                </p>
                                                <p className="text-sm text-muted-foreground">
                                                    {version.totalUsers} usuarios
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-sm font-medium">
                                                    {(version.adoptionRate * 100).toFixed(1)}%
                                                </div>
                                                <Badge
                                                    variant={version.adoptionRate > 0.5 ? "default" : "secondary"}
                                                    className="text-xs"
                                                >
                                                    {version.adoptionRate > 0.5 ? 'Alta' : 'Baja'}
                                                </Badge>
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
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-center">Descargas</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-center space-y-2">
                                    <div className="text-3xl font-bold text-primary">
                                        {analyticsData?.comparative?.downloadsVsPlatform?.percentile ?? 0}º
                                    </div>
                                    <p className="text-sm text-muted-foreground">Percentil</p>
                                    <div className="text-sm">
                                        <span className="font-medium">
                                            {analyticsData?.comparative.downloadsVsPlatform.yourDownloads.toLocaleString()}
                                        </span>
                                        <span className="text-muted-foreground"> vs </span>
                                        <span className="font-medium">
                                            {analyticsData?.comparative.downloadsVsPlatform.platformAverage.toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-center">Retención</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-center space-y-2">
                                    <div className="text-3xl font-bold text-primary">
                                        {analyticsData?.comparative?.retentionVsPlatform?.percentile ?? 0}º
                                    </div>
                                    <p className="text-sm text-muted-foreground">Percentil</p>
                                    <div className="text-sm">
                                        <span className="font-medium">
                                            {analyticsData?.comparative.retentionVsPlatform.yourRetention.toFixed(1)}d
                                        </span>
                                        <span className="text-muted-foreground"> vs </span>
                                        <span className="font-medium">
                                            {analyticsData?.comparative.retentionVsPlatform.platformAverage.toFixed(1)}d
                                        </span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-center">Adopción de Updates</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-center space-y-2">
                                    <div className="text-3xl font-bold text-primary">
                                        {analyticsData?.comparative?.updateAdoptionVsPlatform?.percentile ?? 0}º
                                    </div>
                                    <p className="text-sm text-muted-foreground">Percentil</p>
                                    <div className="text-sm">
                                        <span className="font-medium">
                                            {(analyticsData?.comparative?.updateAdoptionVsPlatform?.yourAdoption || 0).toFixed(1)}%
                                        </span>
                                        <span className="text-muted-foreground"> vs </span>
                                        <span className="font-medium">
                                            {(analyticsData?.comparative?.updateAdoptionVsPlatform?.platformAverage || 0 * 100).toFixed(1)}%
                                        </span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle>Comparativo Detallado</CardTitle>
                            <CardDescription>
                                Cómo te comparas con otros publishers en la plataforma
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <BarChart
                                data={[
                                    {
                                        name: 'Descargas',
                                        yourValue: analyticsData?.comparative?.downloadsVsPlatform?.yourDownloads || 0,
                                        platformAverage: analyticsData?.comparative?.downloadsVsPlatform?.platformAverage || 0,
                                    },
                                    {
                                        name: 'Retención',
                                        yourValue: analyticsData?.comparative?.retentionVsPlatform?.yourRetention || 0,
                                        platformAverage: analyticsData?.comparative?.retentionVsPlatform?.platformAverage || 0,
                                    },
                                    {
                                        name: 'Adopción Updates',
                                        yourValue: (analyticsData?.comparative?.updateAdoptionVsPlatform?.yourAdoption || 0) * 100,
                                        platformAverage: (analyticsData?.comparative?.updateAdoptionVsPlatform?.platformAverage || 0) * 100,
                                    },
                                ]}
                                config={comparativeChartConfig}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
};