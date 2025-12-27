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
    LucideUsers,
    LucideX,
    LucideSearch,
    LucideShieldCheck
} from 'lucide-react';
import { toast } from 'sonner';
import { whitelistService } from '@/services/whitelist.service';
import { WhitelistUser, WhitelistStats } from '@/types/whitelist';

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

    useEffect(() => {
        if (isOpen && modpackId && accessToken) {
            loadWhitelist();
        }
    }, [isOpen, modpackId, accessToken]);

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

        if (stats && stats.remainingSlots <= 0) {
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
        } catch (error: any) {
            console.error('Error añadiendo usuario:', error);
            const message = error.message || 'Error desconocido';

            if (message.includes('not found')) {
                toast.error('Usuario no encontrado', { description: 'No existe ese usuario en Discord.' });
            } else if (message.includes('already')) {
                toast.warning('Usuario duplicado', { description: 'Este usuario ya está en la whitelist.' });
            } else if (message.includes('limit')) {
                toast.error('Límite alcanzado');
            } else {
                toast.error('Error al añadir', { description: message });
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

    const handleExport = async () => {
        try {
            const exportData = await whitelistService.exportWhitelist(modpackId, accessToken);

            // CSV Header y Rows
            const csvContent = [
                ['Username', 'Discord ID', 'Fecha Agregado', 'Agregado Por', 'Notas'],
                ...exportData.users.map(u => [
                    u.username,
                    u.discordId || '',
                    new Date(u.addedAt).toISOString(),
                    u.addedBy,
                    u.notes || ''
                ])
            ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

            const blob = new Blob([csvContent], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `whitelist-${modpackName.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            toast.success('Exportación exitosa');
        } catch (error) {
            console.error('Error exportando:', error);
            toast.error('Error al exportar');
        }
    };

    // Calcular porcentaje de uso para barra de progreso
    const usagePercentage = stats ? Math.min((stats.totalWhitelisted / stats.maxAllowed) * 100, 100) : 0;

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
                                                <span className="text-muted-foreground">/ {stats.maxAllowed}</span>
                                            </div>
                                        </div>

                                        {/* Barra de progreso visual */}
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
                                    </div>
                                )}

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
        </>
    );
};