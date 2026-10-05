import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LucideLoader2, LucideRefreshCw, LucideScrollText } from 'lucide-react';
import { useAuthentication } from '@/stores/AuthContext';
import { Pagination } from '@/components/admin/Pagination';
import {
    listCreatorAuditLogs,
    listCreatorAuditActions,
    type CreatorAuditLog,
} from '@/services/creatorAudit.service';

function formatAction(action: string): string {
    return action.replace(/\./g, ' ').replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

function badgeVariant(action: string): "default" | "destructive" | "secondary" | "outline" {
    if (action.includes("deleted") || action.includes("removed") || action.includes("revoked") || action.includes("cleared")) return "destructive";
    if (action.includes("created") || action.includes("added") || action.includes("published") || action.includes("uploaded") || action.includes("requested")) return "default";
    if (action.includes("updated") || action.includes("role") || action.includes("permission") || action.includes("settings")) return "secondary";
    return "outline";
}

export const PublisherAuditLogsView: React.FC = () => {
    const { publisherId } = useParams<{ publisherId: string }>();
    const { sessionTokens } = useAuthentication();
    const accessToken = sessionTokens?.accessToken;

    const [logs, setLogs] = useState<CreatorAuditLog[]>([]);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [page, setPage] = useState(1);
    const [actions, setActions] = useState<string[]>([]);
    const [actionFilter, setActionFilter] = useState("all");
    const [actorFilter, setActorFilter] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        if (!accessToken || !publisherId) return;
        setLoading(true);
        setError(null);
        try {
            const data = await listCreatorAuditLogs(accessToken, publisherId, {
                page,
                limit: 20,
                action: actionFilter === "all" ? undefined : actionFilter,
                actorUserId: actorFilter || undefined,
                startDate: startDate || undefined,
                endDate: endDate || undefined,
            });
            setLogs(data.logs);
            setTotal(data.total);
            setTotalPages(data.totalPages);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Error al cargar el registro de auditoría");
        } finally {
            setLoading(false);
        }
    }, [accessToken, publisherId, page, actionFilter, actorFilter, startDate, endDate]);

    useEffect(() => {
        if (!accessToken || !publisherId) return;
        listCreatorAuditActions(accessToken, publisherId).then(setActions).catch(() => {});
    }, [accessToken, publisherId]);

    useEffect(() => {
        void load();
    }, [load]);

    const resetFilters = () => {
        setActionFilter("all");
        setActorFilter("");
        setStartDate("");
        setEndDate("");
        setPage(1);
    };

    return (
        <div className="max-w-6xl mx-auto p-6 space-y-6">
            <Card>
                <CardHeader className="border-b border-border pb-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-lg">
                                <LucideScrollText className="h-6 w-6 text-primary" />
                            </div>
                            <div>
                                <CardTitle>Auditoría</CardTitle>
                                <CardDescription>Quién hizo qué en este creator. Solo visible para owners y admins.</CardDescription>
                            </div>
                        </div>
                        <Button variant="outline" onClick={resetFilters}>Limpiar filtros</Button>
                    </div>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Acción</label>
                            <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPage(1); }}>
                                <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todas las acciones</SelectItem>
                                    {actions.map((a) => (
                                        <SelectItem key={a} value={a}>{formatAction(a)}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">ID de usuario actor</label>
                            <Input placeholder="Filtrar por actor..." value={actorFilter} onChange={(e) => { setActorFilter(e.target.value); setPage(1); }} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Desde</label>
                            <Input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(1); }} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Hasta</label>
                            <Input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(1); }} />
                        </div>
                        <div className="flex items-end">
                            <Button variant="outline" onClick={() => void load()} disabled={loading} className="w-full">
                                <LucideRefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                            </Button>
                        </div>
                    </div>

                    {error && (
                        <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
                    )}

                    <div className="border rounded-lg">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Fecha</TableHead>
                                    <TableHead>Acción</TableHead>
                                    <TableHead>Actor</TableHead>
                                    <TableHead>Entidad</TableHead>
                                    <TableHead>IP</TableHead>
                                    <TableHead>Detalles</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-8">
                                            <LucideLoader2 className="h-6 w-6 animate-spin mx-auto" />
                                        </TableCell>
                                    </TableRow>
                                ) : logs.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                            Sin actividad registrada todavía
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    logs.map((log) => (
                                        <TableRow key={log.id}>
                                            <TableCell className="font-mono text-xs whitespace-nowrap">
                                                {new Date(log.createdAt).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                                            </TableCell>
                                            <TableCell><Badge variant={badgeVariant(log.action)} className="text-xs whitespace-nowrap">{formatAction(log.action)}</Badge></TableCell>
                                            <TableCell className="min-w-[160px]">
                                                {log.actor ? (
                                                    <div className="flex items-center gap-2">
                                                        {log.actor.avatarUrl && <img src={log.actor.avatarUrl} alt={log.actor.username} className="size-6 rounded-full" />}
                                                        <span className="font-medium truncate">{log.actor.username}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-muted-foreground text-xs">{log.actorTokenId ? "API token" : "—"}</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="font-mono text-xs max-w-[160px] truncate">
                                                {log.entityType ? `${log.entityType}:${(log.entityId ?? "").slice(0, 8)}` : "—"}
                                            </TableCell>
                                            <TableCell className="font-mono text-xs">{log.ipAddress || "—"}</TableCell>
                                            <TableCell className="text-xs max-w-[220px]">
                                                {log.details ? (
                                                    <div className="truncate" title={JSON.stringify(log.details)}>
                                                        {Object.entries(log.details).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(" · ")}
                                                    </div>
                                                ) : (
                                                    <span className="text-muted-foreground">—</span>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {totalPages > 1 && (
                        <Pagination
                            currentPage={page}
                            totalPages={totalPages}
                            total={total}
                            limit={20}
                            onPageChange={setPage}
                            onLimitChange={() => {}}
                            itemLabel="registros"
                        />
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default PublisherAuditLogsView;
