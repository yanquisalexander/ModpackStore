import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
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
    LucideDatabase,
    LucideDownload,
    LucideUpload,
    LucideTrash2,
    LucideRefreshCw,
    LucideLoader,
    LucideCheck,
    LucideX,
    LucideClock,
    LucideArchive,
    LucideHardDrive,
    LucideTable,
    LucideFileUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthentication } from '@/stores/AuthContext';
import {
    AdminBackupService,
    BackupJob,
    BackupJobStatus,
    BackupTableInfo,
} from '@/services/backup';

const statusConfig: Record<BackupJobStatus, { label: string; color: string; icon: React.ElementType }> = {
    pending: { label: 'Pendiente', color: 'bg-amber-500/10 text-amber-400', icon: LucideClock },
    processing: { label: 'Procesando', color: 'bg-blue-500/10 text-blue-400', icon: LucideLoader },
    completed: { label: 'Completado', color: 'bg-emerald-500/10 text-emerald-400', icon: LucideCheck },
    failed: { label: 'Error', color: 'bg-destructive/10 text-destructive', icon: LucideX },
};

const groupColors: Record<string, string> = {
    core: 'bg-purple-500/10 text-purple-400',
    modpacks: 'bg-blue-500/10 text-blue-400',
    creators: 'bg-emerald-500/10 text-emerald-400',
    system: 'bg-amber-500/10 text-amber-400',
    ads: 'bg-pink-500/10 text-pink-400',
};

export const ManageBackupView: React.FC = () => {
    const { sessionTokens } = useAuthentication();

    // Data
    const [tables, setTables] = useState<BackupTableInfo[]>([]);
    const [backups, setBackups] = useState<BackupJob[]>([]);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [importing, setImporting] = useState(false);

    // Selection
    const [selectedTables, setSelectedTables] = useState<Set<string>>(new Set());
    const [selectAll, setSelectAll] = useState(true);

    // Dialogs
    const [exportDialogOpen, setExportDialogOpen] = useState(false);
    const [importDialogOpen, setImportDialogOpen] = useState(false);
    const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [restoringBackup, setRestoringBackup] = useState<BackupJob | null>(null);
    const [deletingBackup, setDeletingBackup] = useState<BackupJob | null>(null);

    // Import
    const [importFile, setImportFile] = useState<File | null>(null);
    const [importRestoreAfter, setImportRestoreAfter] = useState(true);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Polling
    const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // ── Data Loading ──

    const loadTables = useCallback(async () => {
        try {
            const data = await AdminBackupService.getTables();
            setTables(data);
            setSelectedTables(new Set(data.map((t) => t.key)));
        } catch (err) {
            toast.error('Error al cargar tablas');
        }
    }, []);

    const loadBackups = useCallback(async () => {
        try {
            const data = await AdminBackupService.listJobs('export', 20);
            setBackups(data);
        } catch (err) {
            toast.error('Error al cargar backups');
        }
    }, []);

    const loadAll = useCallback(async () => {
        setLoading(true);
        await Promise.all([loadTables(), loadBackups()]);
        setLoading(false);
    }, [loadTables, loadBackups]);

    useEffect(() => {
        loadAll();
    }, [loadAll]);

    // ── Polling for active jobs ──

    const startPolling = useCallback(() => {
        if (pollingRef.current) clearInterval(pollingRef.current);
        pollingRef.current = setInterval(async () => {
            await loadBackups();
            // Check if any jobs are still active
            const activeJobs = backups.filter((j) => j.status === 'pending' || j.status === 'processing');
            if (activeJobs.length === 0 && pollingRef.current) {
                clearInterval(pollingRef.current);
                pollingRef.current = null;
            }
        }, 3000);
    }, [backups, loadBackups]);

    useEffect(() => {
        return () => {
            if (pollingRef.current) clearInterval(pollingRef.current);
        };
    }, []);

    // ── Handlers ──

    const handleToggleTable = (key: string) => {
        setSelectedTables((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const handleToggleAll = () => {
        if (selectAll) {
            setSelectedTables(new Set());
        } else {
            setSelectedTables(new Set(tables.map((t) => t.key)));
        }
        setSelectAll(!selectAll);
    };

    useEffect(() => {
        setSelectAll(selectedTables.size === tables.length && tables.length > 0);
    }, [selectedTables, tables]);

    const handleExport = async () => {
        if (selectedTables.size === 0) {
            toast.error('Selecciona al menos una tabla');
            return;
        }

        setExporting(true);
        try {
            await AdminBackupService.createExport(Array.from(selectedTables));
            toast.success('Backup exportado correctamente');
            setExportDialogOpen(false);
            await loadBackups();
            startPolling();
        } catch (err) {
            toast.error('Error al crear backup');
        } finally {
            setExporting(false);
        }
    };

    const handleImport = async () => {
        if (!importFile) {
            toast.error('Selecciona un archivo de backup');
            return;
        }

        setImporting(true);
        try {
            const result = await AdminBackupService.importBackup(importFile, importRestoreAfter);
            toast.success(
                importRestoreAfter
                    ? `Backup importado y restore iniciado (${result.totalRecords} registros)`
                    : `Backup importado correctamente (${result.totalRecords} registros)`
            );
            setImportDialogOpen(false);
            setImportFile(null);
            await loadBackups();
            if (importRestoreAfter) startPolling();
        } catch (err) {
            toast.error('Error al importar backup');
        } finally {
            setImporting(false);
        }
    };

    const handleRestore = async () => {
        if (!restoringBackup) return;

        try {
            await AdminBackupService.createRestore(restoringBackup.id!);
            toast.success('Restore iniciado correctamente');
            setRestoreDialogOpen(false);
            setRestoringBackup(null);
            await loadBackups();
            startPolling();
        } catch (err) {
            toast.error('Error al iniciar restore');
        }
    };

    const handleDownload = async (job: BackupJob) => {
        try {
            const { url, fileName } = await AdminBackupService.getDownloadUrl(job.id!);
            // Open in new tab for download
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            a.target = '_blank';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            toast.success('Descarga iniciada');
        } catch (err) {
            toast.error('Error al descargar backup');
        }
    };

    const handleDelete = async () => {
        if (!deletingBackup) return;

        try {
            await AdminBackupService.deleteJob(deletingBackup.id!);
            toast.success('Backup eliminado');
            setDeleteDialogOpen(false);
            setDeletingBackup(null);
            await loadBackups();
        } catch (err) {
            toast.error('Error al eliminar backup');
        }
    };

    // ── Helpers ──

    const formatDate = (d: string | null) => {
        if (!d) return '-';
        return new Date(d).toLocaleString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const totalRecords = tables.reduce((sum, t) => sum + t.recordCount, 0);

    // ── Loading State ──

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <LucideLoader className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    // ── Render ──

    return (
        <div className="space-y-6">
            {/* Header */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-primary/10">
                                <LucideDatabase className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <CardTitle>Backup & Restore</CardTitle>
                                <p className="text-sm text-muted-foreground">
                                    Exportar e importar la base de datos del sistema
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
                                <LucideFileUp className="h-4 w-4 mr-2" />
                                Importar
                            </Button>
                            <Button onClick={() => setExportDialogOpen(true)}>
                                <LucideArchive className="h-4 w-4 mr-2" />
                                Nuevo Backup
                            </Button>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Tables Summary */}
                <Card className="lg:col-span-1">
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                            <LucideTable className="h-4 w-4" />
                            Tablas Disponibles
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {tables.map((table) => (
                                <div
                                    key={table.key}
                                    className="flex items-center justify-between p-2 rounded-lg bg-muted/30"
                                >
                                    <div className="flex items-center gap-2">
                                        <Badge variant="secondary" className={`text-xs ${groupColors[table.group]}`}>
                                            {table.group}
                                        </Badge>
                                        <span className="text-sm">{table.label}</span>
                                    </div>
                                    <span className="text-sm text-muted-foreground font-mono">
                                        {table.recordCount.toLocaleString()}
                                    </span>
                                </div>
                            ))}
                        </div>
                        <Separator className="my-4" />
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Total registros</span>
                            <span className="font-semibold">{totalRecords.toLocaleString()}</span>
                        </div>
                    </CardContent>
                </Card>

                {/* Backups List */}
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-base flex items-center gap-2">
                                <LucideHardDrive className="h-4 w-4" />
                                Backups Recientes
                            </CardTitle>
                            <Button variant="outline" size="sm" onClick={loadBackups}>
                                <LucideRefreshCw className="h-3 w-3 mr-1" />
                                Actualizar
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {backups.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                                <LucideArchive className="h-8 w-8 mb-2 opacity-30" />
                                <p className="text-sm">No hay backups disponibles</p>
                                <p className="text-xs mt-1">Crea tu primer backup haciendo clic en "Nuevo Backup"</p>
                            </div>
                        ) : (
                            <div className="border border-border rounded-lg overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Archivo</TableHead>
                                            <TableHead>Tablas</TableHead>
                                            <TableHead>Registros</TableHead>
                                            <TableHead>Estado</TableHead>
                                            <TableHead>Progreso</TableHead>
                                            <TableHead>Fecha</TableHead>
                                            <TableHead className="w-[100px]">Acciones</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {backups.map((backup) => {
                                            const status = statusConfig[backup.status];
                                            const StatusIcon = status.icon;
                                            const progress = parseFloat(backup.progress) || 0;

                                            return (
                                                <TableRow key={backup.id}>
                                                    <TableCell>
                                                        <div className="flex items-center gap-2">
                                                            <LucideArchive className="h-4 w-4 text-muted-foreground" />
                                                            <span className="text-sm font-medium">
                                                                {backup.fileName || backup.id?.slice(0, 8)}
                                                            </span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <span className="text-sm">
                                                            {backup.includedTables?.length ?? 0}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell>
                                                        <span className="text-sm font-mono">
                                                            {(backup.totalRecords ?? 0).toLocaleString()}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="secondary" className={status.color}>
                                                            <StatusIcon className="h-3 w-3 mr-1" />
                                                            {status.label}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                                                                <div
                                                                    className="h-full bg-primary rounded-full transition-all"
                                                                    style={{ width: `${progress}%` }}
                                                                />
                                                            </div>
                                                            <span className="text-xs text-muted-foreground">
                                                                {Math.round(progress)}%
                                                            </span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <span className="text-sm text-muted-foreground">
                                                            {formatDate(backup.createdAt)}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-1">
                                                            {backup.status === 'completed' && (
                                                                <>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className="h-7 w-7 p-0"
                                                                        onClick={() => handleDownload(backup)}
                                                                        title="Descargar"
                                                                    >
                                                                        <LucideDownload className="h-3.5 w-3.5" />
                                                                    </Button>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className="h-7 w-7 p-0"
                                                                        onClick={() => {
                                                                            setRestoringBackup(backup);
                                                                            setRestoreDialogOpen(true);
                                                                        }}
                                                                        title="Restaurar"
                                                                    >
                                                                        <LucideUpload className="h-3.5 w-3.5" />
                                                                    </Button>
                                                                </>
                                                            )}
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                                                onClick={() => {
                                                                    setDeletingBackup(backup);
                                                                    setDeleteDialogOpen(true);
                                                                }}
                                                                title="Eliminar"
                                                            >
                                                                <LucideTrash2 className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Export Dialog */}
            <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Crear Backup</DialogTitle>
                        <DialogDescription>
                            Selecciona las tablas que deseas incluir en el backup.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3 max-h-[400px] overflow-y-auto">
                        <div className="flex items-center gap-2 pb-2 border-b">
                            <Checkbox
                                id="select-all"
                                checked={selectAll}
                                onCheckedChange={handleToggleAll}
                            />
                            <label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
                                Seleccionar todas
                            </label>
                            <span className="text-xs text-muted-foreground ml-auto">
                                {selectedTables.size}/{tables.length}
                            </span>
                        </div>

                        {tables.map((table) => (
                            <div key={table.key} className="flex items-center gap-2">
                                <Checkbox
                                    id={table.key}
                                    checked={selectedTables.has(table.key)}
                                    onCheckedChange={() => handleToggleTable(table.key)}
                                />
                                <label htmlFor={table.key} className="flex-1 cursor-pointer">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm">{table.label}</span>
                                        <Badge variant="secondary" className={`text-xs ${groupColors[table.group]}`}>
                                            {table.group}
                                        </Badge>
                                    </div>
                                    <span className="text-xs text-muted-foreground">
                                        {table.recordCount.toLocaleString()} registros
                                    </span>
                                </label>
                            </div>
                        ))}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setExportDialogOpen(false)}>
                            Cancelar
                        </Button>
                        <Button onClick={handleExport} disabled={exporting || selectedTables.size === 0}>
                            {exporting ? (
                                <LucideLoader className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                                <LucideArchive className="h-4 w-4 mr-2" />
                            )}
                            Crear Backup
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Import Dialog */}
            <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Importar Backup</DialogTitle>
                        <DialogDescription>
                            Sube un archivo JSON de backup para importarlo al servidor.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".json"
                                className="hidden"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) setImportFile(file);
                                }}
                            />
                            <Button
                                variant="outline"
                                className="w-full justify-start"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <LucideFileUp className="h-4 w-4 mr-2" />
                                {importFile ? importFile.name : 'Seleccionar archivo JSON...'}
                            </Button>
                            {importFile && (
                                <p className="text-xs text-muted-foreground mt-1">
                                    {(importFile.size / 1024 / 1024).toFixed(2)} MB
                                </p>
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            <Checkbox
                                id="import-restore"
                                checked={importRestoreAfter}
                                onCheckedChange={(checked) => setImportRestoreAfter(checked === true)}
                            />
                            <label htmlFor="import-restore" className="text-sm cursor-pointer">
                                Restaurar automáticamente después de importar
                            </label>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
                            Cancelar
                        </Button>
                        <Button onClick={handleImport} disabled={importing || !importFile}>
                            {importing ? (
                                <LucideLoader className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                                <LucideFileUp className="h-4 w-4 mr-2" />
                            )}
                            Importar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Restore Dialog */}
            <AlertDialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Restaurar Backup</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esto <strong>reemplazará todos los datos actuales</strong> con los datos del backup{' '}
                            <strong>{restoringBackup?.fileName}</strong>. Esta acción no se puede deshacer.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleRestore}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            <LucideUpload className="h-4 w-4 mr-2" />
                            Restaurar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Delete Dialog */}
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Eliminar Backup</AlertDialogTitle>
                        <AlertDialogDescription>
                            Se eliminará permanentemente el backup{' '}
                            <strong>{deletingBackup?.fileName}</strong> y su archivo en el servidor.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            <LucideTrash2 className="h-4 w-4 mr-2" />
                            Eliminar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};
