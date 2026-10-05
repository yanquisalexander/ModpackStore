import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress'; // Si tienes este componente, úsalo. Si no, el div inferior funciona.
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
    LucideLoader2,
    LucideUserPlus,
    LucideTrash2,
    LucideDownload,
    LucideUpload,
    LucideUsers,
    LucideX,
    LucideSearch,
    LucideShieldCheck,
    LucideGamepad2,
    LucideSave,
    LucideMessageSquareText,
    LucideCheck,
    LucideAlertTriangle
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { whitelistService, getWhitelistErrorCode } from '@/services/whitelist.service';
import { WhitelistUser, WhitelistStats, BulkWhitelistResult, BulkWhitelistItemStatus } from '@/types/whitelist';

const MAX_IMPORT_NAMES = 500;

/** Limpia un posible nombre: recorta, quita `@` inicial. Null si queda vacío. */
function cleanUsername(raw: string): string | null {
    const t = raw.trim().replace(/^@+/, '').trim();
    return t || null;
}

/** Parte una lista pegada en nombres únicos: líneas, comas o `;`. */
function parseUsernameList(raw: string): string[] {
    const parts = raw
        .split(/[\n,;]+/)
        .map(cleanUsername)
        .filter((s): s is string => s !== null);
    return [...new Set(parts)].slice(0, MAX_IMPORT_NAMES);
}

const MAX_IMPORT_FILE_BYTES = 1024 * 1024; // 1 MB

/** Una línea CSV en celdas (respeta `"..."` y `""` escapadas; separa `,` o `;`). */
function parseCsvLine(line: string): string[] {
    const cells: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) {
            if (ch === '"') {
                if (line[i + 1] === '"') { cur += '"'; i++; } else { inQuotes = false; }
            } else { cur += ch; }
        } else if (ch === '"') {
            inQuotes = true;
        } else if (ch === ',' || ch === ';') {
            cells.push(cur);
            cur = '';
        } else {
            cur += ch;
        }
    }
    cells.push(cur);
    return cells.map((c) => c.trim());
}

/** Texto completo en filas CSV, descartando líneas vacías. */
function parseCsvRows(text: string): string[][] {
    return text
        .split(/\r?\n/)
        .map(parseCsvLine)
        .filter((row) => row.some((c) => c !== ''));
}

/** ¿La primera fila parece cabecera? (Username, Discord ID, Fecha…) */
function detectHeaderRow(firstRow: string[]): boolean {
    const joined = firstRow.join(' ').toLowerCase();
    return /user\s?name|usuario|discord|nick|nombre|jugador|player|fecha|date|added|agregado|notas?|notes/.test(joined);
}

/** Columna que probablemente contiene los usuarios (por cabecera, si no la 0). */
function suggestUserColumn(rows: string[][], hasHeader: boolean): number {
    if (hasHeader && rows.length > 0) {
        const idx = rows[0].findIndex((c) => /user\s?name|usuario|nick|discord|cuenta|jugador|player|^name$|nombre/i.test(c));
        if (idx >= 0) return idx;
    }
    return 0;
}

/** ¿El contenido tiene pinta de tabla? (≥2 líneas y alguna con delimitador) */
function looksTabular(text: string): boolean {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    return lines.length >= 2 && lines.some((l) => l.includes(',') || l.includes(';'));
}

const ITEM_STATUS_LABEL: Record<BulkWhitelistItemStatus, string> = {
    added: 'Añadido',
    already: 'Ya estaba',
    not_found: 'No encontrado',
    error: 'Error',
};

interface ManageWhitelistModalProps {
    isOpen: boolean;
    onClose: () => void;
    modpackId: string;
    modpackName: string;
    accessToken: string;
}

export const ManageWhitelistModal: React.FC<ManageWhitelistModalProps> = ({
    isOpen,
    onClose,
    modpackId,
    modpackName,
    accessToken
}) => {
    const [loading, setLoading] = useState(false);
    const [users, setUsers] = useState<WhitelistUser[]>([]);
    const [stats, setStats] = useState<WhitelistStats | null>(null);
    const [newUserInput, setNewUserInput] = useState('');
    const [notes, setNotes] = useState('');
    const [addingUser, setAddingUser] = useState(false);
    const [removingUserId, setRemovingUserId] = useState<string | null>(null);
    const [showClearDialog, setShowClearDialog] = useState(false);
    const [enforceIngame, setEnforceIngame] = useState(false);
    const [kickMessage, setKickMessage] = useState('No estás autorizado a acceder a esta instancia');
    const [savingIngame, setSavingIngame] = useState(false);
    // Importación masiva
    const [showImportDialog, setShowImportDialog] = useState(false);
    const [importText, setImportText] = useState('');
    const [importing, setImporting] = useState(false);
    const [importResult, setImportResult] = useState<BulkWhitelistResult | null>(null);
    // Mapeo de columnas (modo tabla): explícito, sin magia
    const [tableMode, setTableMode] = useState(false);
    const [hasHeader, setHasHeader] = useState(true);
    const [columnIndex, setColumnIndex] = useState(0);
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    // Mapeo manual (nested modal): reintentos que se suman al resultado base
    const [showMapDialog, setShowMapDialog] = useState(false);
    const [mappings, setMappings] = useState<Array<{ original: string; value: string }>>([]);
    const [retrying, setRetrying] = useState(false);
    const [extraResults, setExtraResults] = useState<BulkWhitelistResult['results']>([]);
    const [retriedOriginals, setRetriedOriginals] = useState<string[]>([]);

    useEffect(() => {
        if (isOpen && modpackId && accessToken) {
            loadWhitelist();
            loadIngameSettings();
        }
    }, [isOpen, modpackId, accessToken]);

    const loadIngameSettings = async () => {
        try {
            const settings = await whitelistService.getIngameSettings(modpackId, accessToken);
            setEnforceIngame(settings.enforceIngame);
            setKickMessage(settings.kickMessage);
        } catch (error) {
            console.error('Error cargando ajustes de acceso en juego:', error);
        }
    };

    const handleSaveIngameSettings = async () => {
        if (!kickMessage.trim()) {
            toast.warning('Mensaje vacío', { description: 'El mensaje de expulsión no puede estar vacío.' });
            return;
        }
        if (kickMessage.trim().length > 300) {
            toast.warning('Mensaje demasiado largo', { description: 'Máximo 300 caracteres.' });
            return;
        }
        setSavingIngame(true);
        try {
            const updated = await whitelistService.updateIngameSettings(
                modpackId,
                { enforceIngame, kickMessage: kickMessage.trim() },
                accessToken
            );
            setEnforceIngame(updated.enforceIngame);
            setKickMessage(updated.kickMessage);
            toast.success('Acceso en juego actualizado', {
                description: updated.enforceIngame
                    ? 'La whitelist se aplicará al entrar al servidor.'
                    : 'La whitelist ya no bloqueará el acceso en juego.'
            });
        } catch (error) {
            console.error('Error guardando ajustes en juego:', error);
            toast.error('Error al guardar', { description: 'No se pudieron guardar los ajustes de acceso en juego.' });
        } finally {
            setSavingIngame(false);
        }
    };

    const loadWhitelist = async () => {
        setLoading(true);
        try {
            const [usersData, statsData] = await Promise.all([
                whitelistService.getWhitelistedUsers(modpackId, accessToken),
                whitelistService.getWhitelistStats(modpackId, accessToken)
            ]);
            setUsers(usersData);
            setStats(statsData);
        } catch (error) {
            console.error('Error cargando whitelist:', error);
            toast.error('Error al cargar datos', { description: 'No se pudo obtener la lista de usuarios.' });
        } finally {
            setLoading(false);
        }
    };

    const handleAddUser = async () => {
        if (!newUserInput.trim()) {
            toast.warning('Campo vacío', { description: 'Por favor ingresa un usuario de Discord.' });
            return;
        }

        if (stats && stats.remainingSlots !== -1 && stats.remainingSlots <= 0) {
            toast.error('Whitelist llena', {
                description: `Has alcanzado el límite máximo de ${stats.maxAllowed} usuarios.`
            });
            return;
        }

        setAddingUser(true);
        try {
            await whitelistService.addToWhitelist(
                modpackId,
                {
                    discordUsername: newUserInput.trim(),
                    notes: notes.trim() || undefined
                },
                accessToken
            );

            toast.success('Usuario añadido', { description: `${newUserInput} ha sido agregado a la whitelist.` });
            setNewUserInput('');
            setNotes('');
            await loadWhitelist();
        } catch (error: unknown) {
            console.error('Error añadiendo usuario:', error);
            switch (getWhitelistErrorCode(error)) {
                case 'ALREADY_WHITELISTED':
                    toast.warning('Usuario duplicado', { description: 'Este usuario ya está en la whitelist.' });
                    break;
                case 'USER_NOT_FOUND':
                    toast.error('Usuario no encontrado', { description: 'No existe ese usuario en Discord.' });
                    break;
                case 'NOT_WHITELIST_VISIBILITY':
                    toast.error('No disponible', { description: 'Este modpack no usa whitelist.' });
                    break;
                case 'MODPACK_NOT_FOUND':
                    toast.error('Modpack no encontrado', { description: 'El modpack ya no existe o no tienes acceso.' });
                    break;
                case 'MISSING_USER':
                    toast.warning('Campo vacío', { description: 'Por favor ingresa un usuario de Discord.' });
                    break;
                default:
                    toast.error('Error al añadir', {
                        description: error instanceof Error ? error.message : 'Error desconocido',
                    });
                    break;
            }
        } finally {
            setAddingUser(false);
        }
    };

    const handleRemoveUser = async (userId: string) => {
        setRemovingUserId(userId);
        try {
            await whitelistService.removeFromWhitelist(modpackId, userId, accessToken);
            toast.success('Usuario eliminado');
            await loadWhitelist();
        } catch (error) {
            console.error('Error eliminando usuario:', error);
            toast.error('Error al eliminar usuario');
        } finally {
            setRemovingUserId(null);
        }
    };

    const handleClearWhitelist = async () => {
        try {
            const count = await whitelistService.clearWhitelist(modpackId, accessToken);
            toast.success('Whitelist vaciada', { description: `Se eliminaron ${count} usuarios.` });
            setShowClearDialog(false);
            await loadWhitelist();
        } catch (error) {
            console.error('Error vaciando whitelist:', error);
            toast.error('Error al vaciar la lista');
        }
    };

    const escapeCsvCell = (value: unknown): string => {
        const text = value === null || value === undefined ? '' : String(value);
        return `"${text.replace(/"/g, '""')}"`;
    };

    const handleExport = async () => {
        try {
            const rows = await whitelistService.exportWhitelist(modpackId, accessToken);

            // CSV Header y Rows (forma real del backend: array plano de filas)
            const csvContent = [
                ['Username', 'Discord ID', 'Fecha Agregado', 'Agregado Por'],
                ...rows.map(u => [
                    u.username,
                    u.discordId ?? '',
                    u.addedAt ? new Date(u.addedAt).toISOString() : '',
                    u.addedByUsername ?? '',
                ])
            ].map(row => row.map(escapeCsvCell).join(',')).join('\n');

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `whitelist-${modpackName.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            toast.success('Exportación exitosa', { description: `${rows.length} usuarios exportados.` });
        } catch (error) {
            console.error('Error exportando:', error);
            toast.error('Error al exportar');
        }
    };

    // ── Importación masiva ────────────────────────────────────

    /** Filas tabulares del texto actual (null si no hay ≥2 columnas). */
    const importTable = React.useMemo(() => {
        const rows = parseCsvRows(importText);
        const maxCols = rows.reduce((m, r) => Math.max(m, r.length), 0);
        if (rows.length === 0 || maxCols < 2) return null;
        return { rows, maxCols };
    }, [importText]);

    const effectiveColumn = importTable ? Math.min(columnIndex, importTable.maxCols - 1) : 0;

    /** Nombres según el modo activo: columna mapeada o lista de texto. */
    const effectiveImportNames = React.useMemo(() => {
        if (tableMode && importTable) {
            const dataRows = hasHeader ? importTable.rows.slice(1) : importTable.rows;
            const names = dataRows
                .map((r) => cleanUsername(r[effectiveColumn] ?? ''))
                .filter((s): s is string => s !== null);
            return [...new Set(names)].slice(0, MAX_IMPORT_NAMES);
        }
        return parseUsernameList(importText);
    }, [tableMode, importTable, hasHeader, effectiveColumn, importText]);

    const tabularHint = !tableMode && !importResult && looksTabular(importText);

    /** Activa el modo tabla con detección inicial (botón "Usar columnas"). */
    const enableTableMode = () => {
        if (!importTable) return;
        const autoHeader = detectHeaderRow(importTable.rows[0]);
        setHasHeader(autoHeader);
        setColumnIndex(suggestUserColumn(importTable.rows, autoHeader));
        setTableMode(true);
    };

    const columnOptions = React.useMemo(() => {
        if (!importTable) return [];
        const headerRow = hasHeader ? importTable.rows[0] : null;
        const sampleRows = (hasHeader ? importTable.rows.slice(1) : importTable.rows).slice(0, 3);
        return Array.from({ length: importTable.maxCols }, (_, i) => {
            const label = headerRow?.[i]?.trim() || `Columna ${i + 1}`;
            const preview = sampleRows.map((r) => r[i]?.trim()).filter(Boolean).slice(0, 2).join(', ');
            return { index: i, label, preview };
        });
    }, [importTable, hasHeader]);

    const openImportDialog = () => {
        setImportText('');
        setImportResult(null);
        setExtraResults([]);
        setRetriedOriginals([]);
        setMappings([]);
        setTableMode(false);
        setHasHeader(true);
        setColumnIndex(0);
        setShowImportDialog(true);
    };

    const closeImportDialog = async () => {
        setShowImportDialog(false);
        setShowMapDialog(false);
        if (importResult) await loadWhitelist();
        setImportResult(null);
        setExtraResults([]);
        setRetriedOriginals([]);
    };

    /** Resultado combinado: base menos los reintentados + resultados de reintentos. */
    const combinedResults = React.useMemo<BulkWhitelistResult['results']>(() => {
        const base = (importResult?.results ?? []).filter(
            (r) => !(r.status === 'not_found' && r.username && retriedOriginals.includes(r.username))
        );
        return [...base, ...extraResults];
    }, [importResult, extraResults, retriedOriginals]);

    const combinedSummary = React.useMemo(() => {
        const added = combinedResults.filter((r) => r.status === 'added').length;
        const already = combinedResults.filter((r) => r.status === 'already').length;
        const notFound = combinedResults.filter((r) => r.status === 'not_found').length;
        const errors = combinedResults.filter((r) => r.status === 'error').length;
        return { added, already, notFound, errors };
    }, [combinedResults]);

    const handleImportFile = async (file: File) => {
        if (file.size > MAX_IMPORT_FILE_BYTES) {
            toast.error('Archivo demasiado grande', { description: 'Máximo 1 MB.' });
            return;
        }
        try {
            const text = await file.text();
            if (!text.trim()) {
                toast.warning('Archivo vacío', { description: 'El archivo no contiene texto.' });
                return;
            }
            // Se añade el contenido crudo: si es tabular se mapea por columnas abajo.
            setImportText((prev) => [prev.trim(), text.trim()].filter(Boolean).join('\n'));
            const rows = parseCsvRows(text);
            const maxCols = rows.reduce((m, r) => Math.max(m, r.length), 0);
            if (maxCols >= 2 && rows.length > 0) {
                const autoHeader = detectHeaderRow(rows[0]);
                setHasHeader(autoHeader);
                setColumnIndex(suggestUserColumn(rows, autoHeader));
                setTableMode(true);
                toast.success('Archivo cargado', { description: `Tu archivo tiene ${maxCols} columnas: elige cuál tiene los nombres.` });
            } else {
                toast.success('Archivo cargado', { description: 'Contenido añadido a la lista.' });
            }
        } catch (error) {
            console.error('Error leyendo archivo:', error);
            toast.error('Error al leer el archivo');
        } finally {
            // Permite volver a elegir el mismo archivo
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleBulkImport = async () => {
        if (effectiveImportNames.length === 0) {
            toast.warning('Lista vacía', { description: 'Pega o carga al menos un nombre.' });
            return;
        }
        setImporting(true);
        try {
            // El backend procesa todo el lote: lo no encontrado se marca con
            // error y lo duplicado se skipea, sin abortar el resto.
            const result = await whitelistService.bulkAddByUsernames(
                modpackId,
                { usernames: effectiveImportNames },
                accessToken
            );
            setImportResult(result);
            setExtraResults([]);
            setRetriedOriginals([]);
            await loadWhitelist();
            if (result.added > 0) {
                toast.success('Importación completada', {
                    description: `${result.added} añadidos${result.failed > 0 ? `, ${result.failed} con incidencias` : ''}.`
                });
            } else if (result.failed > 0) {
                toast.warning('Sin cambios', { description: 'Ningún nombre pudo añadirse. Revisa el resumen.' });
            }
        } catch (error: unknown) {
            console.error('Error importando:', error);
            const code = getWhitelistErrorCode(error);
            toast.error('Error al importar', {
                description: code === 'TOO_MANY_USERS'
                    ? `Máximo ${MAX_IMPORT_NAMES} nombres por importación.`
                    : error instanceof Error ? error.message : 'Error desconocido',
            });
        } finally {
            setImporting(false);
        }
    };

    // ── Mapeo manual (nested modal) ──────────────────────────

    const openMapping = () => {
        const pending = (importResult?.results ?? []).filter(
            (r) => r.status === 'not_found' && r.username && !retriedOriginals.includes(r.username)
        );
        setMappings(pending.map((r) => ({ original: r.username as string, value: r.username as string })));
        setShowMapDialog(true);
    };

    const pendingMappingsCount = mappings.length;

    const handleRetryMapped = async () => {
        const usernames = [...new Set(mappings.map((m) => m.value.trim()).filter(Boolean))].slice(0, MAX_IMPORT_NAMES);
        if (usernames.length === 0) {
            toast.warning('Sin nombres', { description: 'Corrige al menos un nombre u omítelo de la lista.' });
            return;
        }
        setRetrying(true);
        try {
            const result = await whitelistService.bulkAddByUsernames(modpackId, { usernames }, accessToken);
            setExtraResults((prev) => [...prev, ...result.results]);
            setRetriedOriginals((prev) => [...prev, ...mappings.map((m) => m.original)]);
            setMappings([]);
            setShowMapDialog(false);
            await loadWhitelist();
            toast.success('Mapeo aplicado', {
                description: `${result.added} añadidos${result.failed > 0 ? `, ${result.failed} con incidencias` : ''}.`
            });
        } catch (error: unknown) {
            console.error('Error reintentando mapeo:', error);
            toast.error('Error al reintentar', {
                description: error instanceof Error ? error.message : 'Error desconocido',
            });
        } finally {
            setRetrying(false);
        }
    };

    const isUnlimited = stats && stats.maxAllowed === -1;
    const usagePercentage = stats && !isUnlimited ? Math.min((stats.totalWhitelisted / stats.maxAllowed) * 100, 100) : 0;

    return (
        <>
            <Dialog open={isOpen} onOpenChange={onClose}>
                <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col gap-0 p-0 overflow-hidden">

                    {/* Header */}
                    <div className="p-6 pb-4 border-b">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2 text-xl">
                                <LucideShieldCheck className="h-5 w-5 text-primary" />
                                Gestionar Whitelist
                            </DialogTitle>
                            <DialogDescription>
                                Administra el acceso para <strong>{modpackName}</strong>
                            </DialogDescription>
                        </DialogHeader>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        {loading && !stats ? (
                            <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
                                <LucideLoader2 className="h-8 w-8 animate-spin text-primary" />
                                <span className="text-sm">Cargando lista...</span>
                            </div>
                        ) : (
                            <>
                                {/* Stats & Progress */}
                                {stats && (
                                    <div className="bg-muted/30 border rounded-lg p-4 space-y-3">
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="font-medium text-muted-foreground">Ocupación</span>
                                            <div className="flex gap-2 items-center">
                                                <span className="font-bold text-foreground">{stats.totalWhitelisted}</span>
                                                {!isUnlimited && (
                                                    <span className="text-muted-foreground">/ {stats.maxAllowed}</span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Barra de progreso visual */}
                                        {!isUnlimited && (
                                            <>
                                                <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full transition-all duration-500 ease-out ${stats.remainingSlots === 0 ? 'bg-destructive' : 'bg-primary'}`}
                                                        style={{ width: `${usagePercentage}%` }}
                                                    />
                                                </div>

                                                <div className="flex justify-between items-center text-xs">
                                                    <Badge variant={stats.remainingSlots === 0 ? 'destructive' : 'secondary'} className="font-normal">
                                                        {stats.remainingSlots === 0 ? 'Lleno' : `${stats.remainingSlots} espacios disponibles`}
                                                    </Badge>
                                                    {stats.remainingSlots === 0 && (
                                                        <span className="text-destructive font-medium">Límite alcanzado</span>
                                                    )}
                                                </div>
                                            </>
                                        )}
                                        {isUnlimited && (
                                            <div className="flex justify-between items-center text-xs">
                                                <Badge variant="secondary" className="font-normal">
                                                    Sin límite
                                                </Badge>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Acceso en el servidor */}
                                <div className="bg-muted/30 border rounded-lg p-4 space-y-4">
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="flex items-center gap-3">
                                            <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                                                <LucideGamepad2 className="h-4 w-4 text-primary" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold">Acceso en el servidor</p>
                                                <p className="text-xs text-muted-foreground">
                                                    Bloquea la entrada al servidor a quienes no estén en la whitelist.
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <Badge variant={enforceIngame ? 'default' : 'secondary'} className="font-normal">
                                                {enforceIngame ? 'Activo' : 'Inactivo'}
                                            </Badge>
                                            <Switch checked={enforceIngame} onCheckedChange={setEnforceIngame} />
                                        </div>
                                    </div>

                                    <Separator />

                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                                <LucideMessageSquareText className="h-3.5 w-3.5" />
                                                Mensaje de expulsión
                                            </label>
                                            <span className="text-[11px] text-muted-foreground tabular-nums">
                                                {kickMessage.length}/300
                                            </span>
                                        </div>
                                        <Textarea
                                            value={kickMessage}
                                            onChange={(e) => setKickMessage(e.target.value)}
                                            maxLength={300}
                                            rows={2}
                                            placeholder="No estás autorizado a acceder a esta instancia"
                                        />
                                        {/* Vista previa */}
                                        <div className="rounded-md bg-black/90 px-4 py-3 text-center">
                                            <p className="text-sm font-medium text-red-400">
                                                {kickMessage.trim() || 'No estás autorizado a acceder a esta instancia'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex justify-end">
                                        <Button onClick={handleSaveIngameSettings} disabled={savingIngame} size="sm">
                                            {savingIngame ? (
                                                <LucideLoader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <>
                                                    <LucideSave className="h-4 w-4 mr-2" />
                                                    Guardar
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </div>

                                {/* Add User Section */}
                                <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] items-end">
                                    <div className="space-y-2">
                                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                            Usuario de Discord
                                        </label>
                                        <div className="relative">
                                            <LucideSearch className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                placeholder="usuario#1234"
                                                value={newUserInput}
                                                onChange={(e) => setNewUserInput(e.target.value)}
                                                className="pl-9"
                                                disabled={addingUser || (stats?.remainingSlots === 0)}
                                                onKeyDown={(e) => e.key === 'Enter' && handleAddUser()}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                            Notas (Opcional)
                                        </label>
                                        <Input
                                            placeholder="Ej: VIP, Amigo, Admin"
                                            value={notes}
                                            onChange={(e) => setNotes(e.target.value)}
                                            disabled={addingUser || (stats?.remainingSlots === 0)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleAddUser()}
                                        />
                                    </div>
                                    <Button
                                        onClick={handleAddUser}
                                        disabled={addingUser || !newUserInput.trim() || (stats?.remainingSlots === 0)}
                                        className="mb-[1px]" // Ajuste visual menor
                                    >
                                        {addingUser ? (
                                            <LucideLoader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <>
                                                <LucideUserPlus className="h-4 w-4 sm:mr-2" />
                                                <span className="hidden sm:inline">Añadir</span>
                                            </>
                                        )}
                                    </Button>
                                </div>

                                {/* Actions Toolbar */}
                                <div className="flex items-center justify-between pt-2">
                                    <h3 className="text-sm font-semibold">
                                        Usuarios Permitidos ({users.length})
                                    </h3>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={openImportDialog}
                                            className="h-8 text-xs"
                                        >
                                            <LucideUpload className="h-3.5 w-3.5 mr-1.5" />
                                            Importar
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={handleExport}
                                            disabled={users.length === 0}
                                            className="h-8 text-xs"
                                        >
                                            <LucideDownload className="h-3.5 w-3.5 mr-1.5" />
                                            CSV
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setShowClearDialog(true)}
                                            disabled={users.length === 0}
                                            className="h-8 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                                        >
                                            <LucideX className="h-3.5 w-3.5 mr-1.5" />
                                            Vaciar
                                        </Button>
                                    </div>
                                </div>

                                {/* Users Table */}
                                <div className="border rounded-md overflow-hidden">
                                    {users.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-12 text-center bg-muted/5">
                                            <LucideUsers className="h-10 w-10 text-muted-foreground/30 mb-3" />
                                            <p className="text-sm font-medium text-foreground">La whitelist está vacía</p>
                                            <p className="text-xs text-muted-foreground">Añade usuarios arriba para darles acceso.</p>
                                        </div>
                                    ) : (
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-muted/50 hover:bg-muted/50">
                                                    <TableHead className="w-[200px]">Usuario</TableHead>
                                                    <TableHead>Notas</TableHead>
                                                    <TableHead className="w-[50px]"></TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {users.map((user) => (
                                                    <TableRow key={user.id}>
                                                        <TableCell className="font-medium">
                                                            <div className="flex items-center gap-2">
                                                                {user.avatarUrl ? (
                                                                    <img src={user.avatarUrl} alt="" className="h-6 w-6 rounded-full" />
                                                                ) : (
                                                                    <div className="h-6 w-6 rounded-full bg-secondary flex items-center justify-center text-[10px]">
                                                                        {user.username.charAt(0).toUpperCase()}
                                                                    </div>
                                                                )}
                                                                <div className="flex flex-col">
                                                                    <span>{user.username}</span>
                                                                    <span className="text-[10px] text-muted-foreground">{user.discordId}</span>
                                                                </div>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-muted-foreground text-sm">
                                                            {user.notes || '-'}
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                                                onClick={() => handleRemoveUser(user.id)}
                                                                disabled={removingUserId === user.id}
                                                            >
                                                                {removingUserId === user.id ? (
                                                                    <LucideLoader2 className="h-4 w-4 animate-spin" />
                                                                ) : (
                                                                    <LucideTrash2 className="h-4 w-4" />
                                                                )}
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    )}
                                </div>
                            </>
                        )}
                    </div>

                    <DialogFooter className="p-4 border-t bg-muted/10 mt-auto">
                        <Button variant="outline" onClick={onClose}>
                            Cerrar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Clear Confirmation Dialog */}
            <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Vaciar toda la Whitelist?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción eliminará a <strong>{users.length}</strong> usuarios de la lista.
                            Los usuarios perderán el acceso al modpack inmediatamente.
                            Esta acción no se puede deshacer.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleClearWhitelist} className="bg-destructive hover:bg-destructive/90">
                            Sí, vaciar lista
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Bulk Import Dialog */}
            <Dialog open={showImportDialog} onOpenChange={(open) => { if (!open) void closeImportDialog(); }}>
                <DialogContent className="sm:max-w-xl max-h-[85vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <LucideUpload className="h-5 w-5 text-primary" />
                            Importar a la whitelist
                        </DialogTitle>
                        <DialogDescription>
                            Pega los nombres de Discord (uno por línea o separados por comas). Si alguno
                            no existe te avisaremos al final, y los que ya estén en la lista se omiten.
                        </DialogDescription>
                    </DialogHeader>

                    {!importResult ? (
                        <div className="space-y-3 py-2">
                            <Textarea
                                value={importText}
                                onChange={(e) => setImportText(e.target.value)}
                                rows={tableMode && importTable ? 5 : 8}
                                placeholder={'usuario1\nusuario2#1234\nusuario3'}
                                className="font-mono text-sm"
                                disabled={importing}
                            />
                            {tabularHint && (
                                <div className="flex items-center justify-between gap-2 rounded-md border border-dashed px-3 py-2 text-xs">
                                    <span className="text-muted-foreground">Parece que pegaste una tabla.</span>
                                    <Button variant="outline" size="sm" className="h-7 text-xs shrink-0" onClick={enableTableMode}>
                                        Elegir columna
                                    </Button>
                                </div>
                            )}
                            {tableMode && importTable && (
                                <div className="rounded-md border bg-muted/30 p-3 space-y-2.5">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-xs font-medium">
                                            Tu archivo tiene {importTable.maxCols} columnas
                                        </span>
                                        <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                                            La primera fila son títulos
                                            <Switch checked={hasHeader} onCheckedChange={setHasHeader} />
                                        </label>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-muted-foreground shrink-0">¿En qué columna están los nombres?</span>
                                        <Select value={String(effectiveColumn)} onValueChange={(v) => setColumnIndex(Number(v))}>
                                            <SelectTrigger className="h-8 text-xs flex-1">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {columnOptions.map((opt) => (
                                                    <SelectItem key={opt.index} value={String(opt.index)}>
                                                        {opt.label}{opt.preview ? ` — ${opt.preview}` : ''}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <button
                                        type="button"
                                        className="text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
                                        onClick={() => setTableMode(false)}
                                    >
                                        Usar como lista simple
                                    </button>
                                </div>
                            )}
                            <div className="flex items-center justify-between gap-2">
                                <p className="text-xs text-muted-foreground tabular-nums">
                                    {effectiveImportNames.length} nombre{effectiveImportNames.length === 1 ? '' : 's'} en la lista (máximo {MAX_IMPORT_NAMES})
                                </p>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 text-xs shrink-0"
                                    disabled={importing}
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <LucideUpload className="h-3.5 w-3.5 mr-1.5" />
                                    Desde archivo
                                </Button>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".csv,.txt,text/csv,text/plain"
                                    className="hidden"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) void handleImportFile(file);
                                    }}
                                />
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                                También puedes cargar un archivo .csv o .txt (máximo 1 MB). Si lo exportaste desde aquí, funciona directamente.
                            </p>
                            <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={() => void closeImportDialog()} disabled={importing}>
                                    Cancelar
                                </Button>
                                <Button onClick={() => void handleBulkImport()} disabled={importing || effectiveImportNames.length === 0}>
                                    {importing ? <LucideLoader2 className="h-4 w-4 animate-spin" /> : <>Importar {effectiveImportNames.length > 0 && `(${effectiveImportNames.length})`}</>}
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3 py-2">
                            <div className="flex flex-wrap gap-2">
                                <Badge variant="default">{combinedSummary.added} añadidos</Badge>
                                {combinedSummary.already > 0 && <Badge variant="secondary">{combinedSummary.already} ya estaban</Badge>}
                                {combinedSummary.notFound > 0 && <Badge variant="destructive">{combinedSummary.notFound} no encontrados</Badge>}
                                {combinedSummary.errors > 0 && <Badge variant="destructive">{combinedSummary.errors} con errores</Badge>}
                            </div>
                            {(combinedSummary.notFound > 0 || combinedSummary.errors > 0) && (
                                <div className="border rounded-md max-h-48 overflow-y-auto divide-y text-sm">
                                    {combinedResults.filter((r) => r.status === 'not_found' || r.status === 'error').map((r, i) => (
                                        <div key={`${r.username ?? r.userId ?? i}-${i}`} className="flex items-center justify-between gap-2 px-3 py-1.5">
                                            <span className="font-mono truncate">{r.username ?? r.userId ?? '—'}</span>
                                            <Badge variant="outline" className="shrink-0 text-xs">
                                                {ITEM_STATUS_LABEL[r.status]}
                                            </Badge>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <div className="flex justify-between gap-2">
                                <div>
                                    {combinedSummary.notFound > 0 && (
                                        <Button variant="outline" onClick={openMapping}>
                                            Revisar nombres ({combinedSummary.notFound})
                                        </Button>
                                    )}
                                </div>
                                <Button onClick={() => void closeImportDialog()}>Cerrar</Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Nested Dialog: mapeo manual de no encontrados */}
            <Dialog open={showMapDialog} onOpenChange={setShowMapDialog}>
                <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <LucideSearch className="h-5 w-5 text-primary" />
                            Revisar nombres
                        </DialogTitle>
                        <DialogDescription>
                            No hemos encontrado estos nombres. Escríbelos tal como aparecen en
                            Discord, o quítalos de la lista para omitirlos.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2 py-2 overflow-y-auto">
                        {pendingMappingsCount === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-6">Nada pendiente de revisar.</p>
                        ) : (
                            mappings.map((m, i) => (
                                <div key={`${m.original}-${i}`} className="flex items-center gap-2">
                                    <span className="font-mono text-xs text-muted-foreground line-through truncate w-32 shrink-0" title={m.original}>
                                        {m.original}
                                    </span>
                                    <Input
                                        value={m.value}
                                        onChange={(e) => setMappings((prev) => prev.map((p, j) => j === i ? { ...p, value: e.target.value } : p))}
                                        className="h-8 font-mono text-sm"
                                        disabled={retrying}
                                        placeholder="Nombre en Discord"
                                    />
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                        title="Quitar de la lista"
                                        disabled={retrying}
                                        onClick={() => setMappings((prev) => prev.filter((_, j) => j !== i))}
                                    >
                                        <LucideX className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))
                        )}
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" onClick={() => setShowMapDialog(false)} disabled={retrying}>
                            Volver
                        </Button>
                        <Button onClick={() => void handleRetryMapped()} disabled={retrying || pendingMappingsCount === 0}>
                            {retrying ? (
                                <LucideLoader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <><LucideCheck className="h-4 w-4 mr-2" />Volver a intentarlo ({pendingMappingsCount})</>
                            )}
                        </Button>
                    </div>
                    <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <LucideAlertTriangle className="h-3 w-3" />
                        Si un nombre ya está en la lista, se omite sin duplicarlo.
                    </p>
                </DialogContent>
            </Dialog>
        </>
    );
};