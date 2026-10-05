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
import { CreatorPermissionsAPI, type CreatorMember } from '@/services/creatorPermissions.service';
import { listCreatorModpacksForTokens } from '@/services/creatorApiTokens.service';

/** Etiquetas en español para cada acción (la clave cruda nunca se muestra). */
const ACTION_LABELS_ES: Record<string, string> = {
    'creator.updated': 'Creador actualizado',
    'creator.profile.updated': 'Perfil actualizado',
    'creator.image.uploaded': 'Imagen subida',
    'member.added': 'Miembro añadido',
    'member.removed': 'Miembro eliminado',
    'member.role.updated': 'Rol cambiado',
    'permission.updated': 'Permiso cambiado',
    'modpack.created': 'Modpack creado',
    'modpack.updated': 'Modpack actualizado',
    'modpack.deleted': 'Modpack eliminado',
    'version.created': 'Versión creada',
    'version.updated': 'Versión actualizada',
    'version.published': 'Versión publicada',
    'version.archived': 'Versión archivada',
    'version.file.side.updated': 'Archivo modificado',
    'version.file.deleted': 'Archivo eliminado',
    'version.files.reused': 'Archivos reutilizados',
    'whitelist.added': 'Lista: añadido',
    'whitelist.bulk_added': 'Lista: importación',
    'whitelist.removed': 'Lista: eliminado',
    'whitelist.cleared': 'Lista: vaciada',
    'whitelist.settings.updated': 'Lista: ajustes',
    'api_token.created': 'Token creado',
    'api_token.revoked': 'Token revocado',
    'asset.uploaded': 'Archivo subido',
    'asset.deleted': 'Archivo eliminado',
    'storage.config.updated': 'Almacenamiento actualizado',
    'ad.requested': 'Promoción solicitada',
    'curseforge.import.started': 'Importación iniciada',
};

function formatAction(action: string): string {
    return ACTION_LABELS_ES[action]
        ?? action.replace(/\./g, ' ').replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

function badgeVariant(action: string): "default" | "destructive" | "secondary" | "outline" {
    if (action.includes("deleted") || action.includes("removed") || action.includes("revoked") || action.includes("cleared")) return "destructive";
    if (action.includes("created") || action.includes("added") || action.includes("published") || action.includes("uploaded") || action.includes("requested")) return "default";
    if (action.includes("updated") || action.includes("role") || action.includes("permission") || action.includes("settings")) return "secondary";
    return "outline";
}

// ── Enriched details ──────────────────────────────────────────────

function formatBytes(value: unknown): string | null {
    if (typeof value !== "number" || !Number.isFinite(value)) return null;
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
    if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
    return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatRole(value: unknown): string {
    if (value === "owner") return "owner";
    if (value === "admin") return "admin";
    if (value === "member") return "miembro";
    return String(value ?? "—");
}

function shortId(value: unknown): string {
    if (typeof value !== "string" || !value) return "—";
    return value.length > 8 ? `${value.slice(0, 8)}…` : value;
}

const DETAIL_LABELS: Record<string, string> = {
    name: "Nombre",
    targetUsername: "Usuario",
    modpackName: "Modpack",
    role: "Rol",
    permission: "Permiso",
    enabled: "Estado",
    modpackId: "Modpack",
    version: "Versión",
    versionId: "Versión",
    fileType: "Tipo",
    fileName: "Archivo",
    sizeBytes: "Tamaño",
    storageLimitBytes: "Límite",
    count: "Cantidad",
    reused: "Reutilizados",
    removedCount: "Eliminados",
    enforceIngame: "Forzar en juego",
    updated: "Campos",
    type: "Tipo",
    title: "Título",
    placement: "Ubicación",
    slug: "Slug",
    prefix: "Prefijo",
    scopes: "Scopes",
    side: "Lado",
};

function formatDetailValue(key: string, value: unknown): string {
    if (key === "sizeBytes" || key === "storageLimitBytes") return formatBytes(value) ?? String(value ?? "—");
    if (key === "role") return formatRole(value);
    if (key === "enabled" || key === "enforceIngame") return value ? "Sí" : "No";
    if (key === "updated" && Array.isArray(value)) return value.join(", ") || "—";
    if (key === "scopes" && Array.isArray(value)) return value.join(", ") || "—";
    if (key === "modpackId" || key === "versionId") return shortId(value);
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
    if (value === null || value === undefined) return "—";
    return JSON.stringify(value);
}

interface NameResolvers {
    memberName: (userId: string | null) => string;
    modpackName: (modpackId: string | null | undefined) => string;
}

/** Human-readable one-liner in Spanish per action. Falls back to the badge label. */
function describeLog(log: CreatorAuditLog, resolvers: NameResolvers): string {
    const d = (log.details ?? {}) as Record<string, unknown>;
    const str = (v: unknown) => (typeof v === "string" && v ? v : null);
    // Snapshots guardados en escritura (sin coste en lectura); fallback a resolvers locales.
    const targetName = str(d.targetUsername) ?? resolvers.memberName(log.entityId);
    const modpackName = (id: string | null | undefined) => str(d.modpackName) ? `«${str(d.modpackName)}»` : resolvers.modpackName(id);
    switch (log.action) {
        case "member.added":
            return `Añadió a ${targetName} como ${formatRole(d.role)}`;
        case "member.removed":
            return `Eliminó a ${targetName} del equipo`;
        case "member.role.updated":
            return `Cambió el rol de ${targetName} a ${formatRole(d.role)}`;
        case "permission.updated": {
            const verb = d.enabled ? "Concedió" : "Revocó";
            const scope = d.modpackId ? ` en ${modpackName(d.modpackId as string)}` : "";
            return `${verb} el permiso «${str(d.permission) ?? "—"}» a ${targetName}${scope}`;
        }
        case "modpack.created":
            return `Creó el modpack «${str(d.name) ?? resolvers.modpackName(log.entityId)}»`;
        case "modpack.updated": {
            const fields = Array.isArray(d.updated) ? d.updated.join(", ") : null;
            return `Actualizó ${modpackName(log.entityId)}${fields ? ` (${fields})` : ""}`;
        }
        case "modpack.deleted":
            return `Eliminó ${modpackName(log.entityId)}`;
        case "version.created":
            return `Creó la versión ${str(d.version) ?? shortId(log.entityId)} en ${modpackName(d.modpackId as string)}`;
        case "version.updated": {
            const fields = Array.isArray(d.updated) ? d.updated.join(", ") : null;
            return `Actualizó la versión ${shortId(log.entityId)}${fields ? ` (${fields})` : ""}`;
        }
        case "version.published":
            return `Publicó la versión ${shortId(log.entityId)} de ${modpackName(d.modpackId as string)}`;
        case "version.archived":
            return `Archivó la versión ${shortId(log.entityId)} de ${modpackName(d.modpackId as string)}`;
        case "version.files.reused":
            return `Reutilizó ${String(d.reused ?? "—")} archivos (${str(d.fileType) ?? "—"}) en la versión ${shortId(log.entityId)}`;
        case "version.file.side.updated":
            return `Cambió el lado a «${str(d.side) ?? "—"}» en un archivo de la versión ${shortId(d.versionId as string)}`;
        case "version.file.deleted":
            return `Eliminó un archivo de la versión ${shortId(d.versionId as string)}`;
        case "whitelist.added":
            return `Añadió a ${targetName} a la whitelist de ${modpackName(d.modpackId as string)}`;
        case "whitelist.bulk_added":
            return `Añadió ${String(d.count ?? "—")} usuarios a la whitelist de ${modpackName(d.modpackId as string)}`;
        case "whitelist.removed":
            return `Quitó a ${targetName} de la whitelist de ${modpackName(d.modpackId as string)}`;
        case "whitelist.cleared":
            return `Vació la whitelist de ${modpackName(d.modpackId as string)} (${String(d.removedCount ?? "—")} eliminados)`;
        case "whitelist.settings.updated":
            return `${d.enforceIngame ? "Activó" : "Desactivó"} la expulsión en juego en ${modpackName(d.modpackId as string)}`;
        case "api_token.created": {
            const scopes = Array.isArray(d.scopes) ? d.scopes.join(", ") : null;
            return `Creó el token «${str(d.name) ?? "—"}» (${str(d.prefix) ?? "—"}…)${scopes ? ` con ${scopes}` : ""}`;
        }
        case "api_token.revoked":
            return `Revocó el token ${shortId(log.entityId)}`;
        case "asset.uploaded":
            return `Subió «${str(d.fileName) ?? "—"}»${typeof d.sizeBytes === "number" ? ` (${formatBytes(d.sizeBytes)})` : ""}`;
        case "asset.deleted":
            return `Eliminó el archivo ${shortId(log.entityId)}`;
        case "storage.config.updated":
            return `Cambió el límite de almacenamiento a ${formatBytes(d.storageLimitBytes) ?? "—"}`;
        case "ad.requested":
            return `Solicitó la campaña «${str(d.title) ?? "—"}» (${str(d.placement) ?? "—"})`;
        case "curseforge.import.started":
            return `Inició la importación de CurseForge «${str(d.name) ?? str(d.slug) ?? "—"}»`;
        case "creator.updated": {
            const fields = Array.isArray(d.updated) ? d.updated.join(", ") : null;
            return `Actualizó el creator${fields ? ` (${fields})` : ""}`;
        }
        case "creator.profile.updated":
            return "Actualizó el perfil público del creator";
        case "creator.image.uploaded":
            return `Subió la imagen «${str(d.type) ?? "—"}» del creator`;
        default:
            return formatAction(log.action);
    }
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
    const [actorFilter, setActorFilter] = useState("all");
    const [members, setMembers] = useState<CreatorMember[]>([]);
    const [modpackNames, setModpackNames] = useState<Record<string, string>>({});
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Actores vistos en los logs (cubre ex-miembros que ya no están en el equipo)
    const actorsFromLogs = React.useMemo(() => {
        const map = new Map<string, { id: string; username: string; avatarUrl: string | null }>();
        for (const log of logs) {
            if (log.actor && !map.has(log.actor.id)) map.set(log.actor.id, log.actor);
        }
        return [...map.values()];
    }, [logs]);

    const actorOptions = React.useMemo(() => {
        const map = new Map<string, { id: string; username: string; avatarUrl?: string | null }>();
        for (const m of members) map.set(m.userId, { id: m.userId, username: m.username, avatarUrl: m.avatarUrl ?? null });
        for (const a of actorsFromLogs) {
            if (!map.has(a.id)) map.set(a.id, a);
        }
        return [...map.values()].sort((a, b) => a.username.localeCompare(b.username));
    }, [members, actorsFromLogs]);

    const load = useCallback(async () => {
        if (!accessToken || !publisherId) return;
        setLoading(true);
        setError(null);
        try {
            const data = await listCreatorAuditLogs(accessToken, publisherId, {
                page,
                limit: 20,
                action: actionFilter === "all" ? undefined : actionFilter,
                actorUserId: actorFilter === "all" ? undefined : actorFilter,
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
        CreatorPermissionsAPI.getMembers(publisherId, accessToken).then((r) => setMembers(r.members)).catch(() => {});
        listCreatorModpacksForTokens(accessToken, publisherId)
            .then((mods) => setModpackNames(Object.fromEntries(mods.map((m) => [m.id, m.name]))))
            .catch(() => {});
    }, [accessToken, publisherId]);

    const resolvers: NameResolvers = React.useMemo(() => {
        const byId = new Map(members.map((m) => [m.userId, m.username]));
        return {
            memberName: (userId) => {
                if (!userId) return "—";
                return byId.get(userId) ?? `usuario ${shortId(userId)}`;
            },
            modpackName: (modpackId) => {
                if (!modpackId) return "el modpack";
                const name = modpackNames[modpackId];
                return name ? `«${name}»` : `modpack ${shortId(modpackId)}`;
            },
        };
    }, [members, modpackNames]);

    useEffect(() => {
        void load();
    }, [load]);

    const resetFilters = () => {
        setActionFilter("all");
        setActorFilter("all");
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
                                <CardDescription>Quién hizo qué en este creator. Solo visible para propietarios y administradores.</CardDescription>
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
                            <label className="block text-sm font-medium mb-1">Miembro</label>
                            <Select value={actorFilter} onValueChange={(v) => { setActorFilter(v); setPage(1); }}>
                                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos los miembros</SelectItem>
                                    {actorOptions.map((a) => (
                                        <SelectItem key={a.id} value={a.id}>
                                            <span className="flex items-center gap-2">
                                                {a.avatarUrl && <img src={a.avatarUrl} alt={a.username} className="size-4 rounded-full" />}
                                                {a.username}
                                            </span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
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
                                    <TableHead>Descripción</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-8">
                                            <LucideLoader2 className="h-6 w-6 animate-spin mx-auto" />
                                        </TableCell>
                                    </TableRow>
                                ) : logs.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                            Sin actividad registrada todavía
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    logs.map((log) => {
                                        const isOpen = !!expanded[log.id];
                                        const entries = log.details ? Object.entries(log.details) : [];
                                        return (
                                            <TableRow key={log.id}>
                                                <TableCell className="font-mono text-xs whitespace-nowrap align-top">
                                                    {new Date(log.createdAt).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                                                </TableCell>
                                                <TableCell className="align-top"><Badge variant={badgeVariant(log.action)} className="text-xs whitespace-nowrap">{formatAction(log.action)}</Badge></TableCell>
                                                <TableCell className="min-w-[140px] align-top">
                                                    {log.actor ? (
                                                        <div className="flex items-center gap-2">
                                                            {log.actor.avatarUrl && <img src={log.actor.avatarUrl} alt={log.actor.username} className="size-6 rounded-full" />}
                                                            <span className="font-medium truncate">{log.actor.username}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-muted-foreground text-xs">{log.actorTokenId ? "API token" : "—"}</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-sm min-w-[280px]">
                                                    <p className="leading-snug">{describeLog(log, resolvers)}</p>
                                                    {(entries.length > 0 || log.ipAddress || log.userAgent) && (
                                                        <div className="mt-1.5">
                                                            <button
                                                                type="button"
                                                                className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                                                                onClick={() => setExpanded((prev) => ({ ...prev, [log.id]: !prev[log.id] }))}
                                                            >
                                                                {isOpen ? "Ocultar detalle" : "Ver detalle"}
                                                            </button>
                                                            {isOpen && (
                                                                <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-md bg-muted/50 p-2.5 text-xs">
                                                                    {entries.map(([k, v]) => (
                                                                        <React.Fragment key={k}>
                                                                            <dt className="font-medium text-muted-foreground">{DETAIL_LABELS[k] ?? k}</dt>
                                                                            <dd className="break-words">{formatDetailValue(k, v)}</dd>
                                                                        </React.Fragment>
                                                                    ))}
                                                                    <React.Fragment>
                                                                        <dt className="font-medium text-muted-foreground">IP</dt>
                                                                        <dd className="font-mono">{log.ipAddress || "No registrada"}</dd>
                                                                    </React.Fragment>
                                                                </dl>
                                                            )}
                                                        </div>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
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
