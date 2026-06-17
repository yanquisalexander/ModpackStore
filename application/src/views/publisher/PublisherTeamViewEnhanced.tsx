import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    LucideUsers,
    LucideLoader,
    LucidePlus,
    LucideMoreHorizontal,
    LucideUserMinus,
    LucideUserCog,
    LucideSettings,
    LucideShield,
    LucideAlertTriangle
} from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { useAuthentication } from '@/stores/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
    CreatorPermissionsAPI,
    CreatorMember,
} from '@/services/creatorPermissions.service';
import { MemberPermissionsDialog } from '@/components/publisher/MemberPermissionsDialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

const AddMemberDialog: React.FC<{
    creatorId: string;
    accessToken: string;
    onMemberAdded: () => void;
}> = ({ creatorId, accessToken, onMemberAdded }) => {
    const [open, setOpen] = useState(false);
    const [userId, setUserId] = useState('');
    const [role, setRole] = useState('member');
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userId.trim()) return;

        try {
            setLoading(true);
            await CreatorPermissionsAPI.addMember(creatorId, userId, role, accessToken);

            toast({
                title: "Éxito",
                description: "Miembro agregado correctamente",
            });

            setUserId('');
            setRole('member');
            setOpen(false);
            onMemberAdded();
        } catch (error) {
            toast({
                title: "Error",
                description: `Error al agregar miembro: ${error instanceof Error ? error.message : 'Error desconocido'}`,
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>
                    <LucidePlus className="h-4 w-4 mr-2" />
                    Invitar miembro
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Invitar nuevo miembro</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <Label htmlFor="userId">ID de usuario o Username de Discord</Label>
                        <Input
                            id="userId"
                            value={userId}
                            onChange={(e) => setUserId(e.target.value)}
                            placeholder="Introduce el ID del usuario o @username de Discord"
                            required
                        />
                    </div>
                    <div>
                        <Label htmlFor="role">Rol</Label>
                        <Select value={role} onValueChange={setRole}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="member">Miembro</SelectItem>
                                <SelectItem value="admin">Administrador</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={loading || !userId.trim()}>
                            {loading ? <LucideLoader className="h-4 w-4 animate-spin mr-2" /> : null}
                            Invitar
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export const PublisherTeamView: React.FC = () => {
    const { publisherId } = useParams<{ publisherId: string }>();
    const { session, sessionTokens } = useAuthentication();
    const { toast } = useToast();

    const [members, setMembers] = useState<CreatorMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedMemberForPermissions, setSelectedMemberForPermissions] = useState<CreatorMember | null>(null);
    const [permissionsDialogOpen, setPermissionsDialogOpen] = useState(false);
    const [memberToRemove, setMemberToRemove] = useState<CreatorMember | null>(null);
    const [removeDialogOpen, setRemoveDialogOpen] = useState(false);

    const creatorMembership = session?.creatorMemberships?.find(
        membership => membership.creatorId === publisherId
    );
    const userRole = creatorMembership?.role || 'member';
    const canManageMembers = ['owner', 'admin'].includes(userRole);
    const canManagePermissions = ['owner', 'admin'].includes(userRole);

    const loadMembers = async () => {
        if (!publisherId || !sessionTokens?.accessToken) return;

        try {
            setLoading(true);
            setError(null);
            const data = await CreatorPermissionsAPI.getMembers(publisherId, sessionTokens.accessToken);
            setMembers(data.members);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
            setError(errorMessage);
            toast({
                title: "Error",
                description: `Error al cargar miembros: ${errorMessage}`,
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    const handleRemoveMember = async (member: CreatorMember) => {
        setMemberToRemove(member);
        setRemoveDialogOpen(true);
    };

    const confirmRemoveMember = async () => {
        if (!memberToRemove || !publisherId || !sessionTokens?.accessToken) return;

        try {
            await CreatorPermissionsAPI.removeMember(publisherId, memberToRemove.userId, sessionTokens.accessToken);
            toast({
                title: "Éxito",
                description: "Miembro eliminado correctamente",
            });
            loadMembers();
        } catch (error) {
            toast({
                title: "Error",
                description: `Error al eliminar miembro: ${error instanceof Error ? error.message : 'Error desconocido'}`,
                variant: "destructive",
            });
        } finally {
            setRemoveDialogOpen(false);
            setMemberToRemove(null);
        }
    };

    const handleUpdateRole = async (member: CreatorMember, newRole: string) => {
        if (!publisherId || !sessionTokens?.accessToken) return;

        try {
            await CreatorPermissionsAPI.updateMemberRole(publisherId, member.userId, newRole, sessionTokens.accessToken);
            toast({
                title: "Éxito",
                description: "Rol actualizado correctamente",
            });
            loadMembers();
        } catch (error) {
            toast({
                title: "Error",
                description: `Error al actualizar rol: ${error instanceof Error ? error.message : 'Error desconocido'}`,
                variant: "destructive",
            });
        }
    };

    const handleManagePermissions = (member: CreatorMember) => {
        setSelectedMemberForPermissions(member);
        setPermissionsDialogOpen(true);
    };

    useEffect(() => {
        loadMembers();
    }, [publisherId, sessionTokens?.accessToken]);

    if (!publisherId) {
        return (
            <div className="p-6">
                <Alert>
                    <LucideAlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                        No se encontró el ID del creator.
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <LucideUsers className="h-6 w-6" />
                        Gestión del equipo
                    </h1>
                    <p className="text-muted-foreground">
                        Administra los miembros y permisos de tu creator
                    </p>
                </div>
                {canManageMembers && sessionTokens?.accessToken && (
                    <AddMemberDialog
                        creatorId={publisherId}
                        accessToken={sessionTokens.accessToken}
                        onMemberAdded={loadMembers}
                    />
                )}
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Miembros del equipo</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <LucideLoader className="h-6 w-6 animate-spin mr-2" />
                            Cargando miembros...
                        </div>
                    ) : error ? (
                        <Alert variant="destructive">
                            <LucideAlertTriangle className="h-4 w-4" />
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    ) : members.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            No hay miembros en este creator
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Usuario</TableHead>
                                    <TableHead>Rol</TableHead>
                                    <TableHead>Miembro desde</TableHead>
                                    <TableHead>Permisos</TableHead>
                                    {canManageMembers && <TableHead>Acciones</TableHead>}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {members.map((member) => (
                                    <TableRow key={member.userId}>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                {member.avatarUrl && (
                                                    <img
                                                        src={member.avatarUrl}
                                                        alt={member.username}
                                                        className="h-8 w-8 rounded-full"
                                                    />
                                                )}
                                                <div>
                                                    <div className="font-medium">{member.username}</div>
                                                    <div className="text-sm text-muted-foreground">{member.email}</div>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={CreatorPermissionsAPI.getRoleBadgeVariant(member.role)}>
                                                {CreatorPermissionsAPI.getRoleDisplayName(member.role)}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            {new Date(member.joinedAt).toLocaleDateString('es-ES', {
                                                year: 'numeric',
                                                month: 'short',
                                                day: 'numeric'
                                            })}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                {member.role === 'owner' || member.role === 'admin' ? (
                                                    <Badge variant="outline" className="text-xs">
                                                        <LucideShield className="h-3 w-3 mr-1" />
                                                        Acceso completo
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline" className="text-xs">
                                                        <LucideSettings className="h-3 w-3 mr-1" />
                                                        Configurable
                                                    </Badge>
                                                )}

                                                {canManagePermissions && (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => handleManagePermissions(member)}
                                                    >
                                                        <LucideSettings className="h-3 w-3 mr-1" />
                                                        Gestionar
                                                    </Button>
                                                )}
                                            </div>
                                        </TableCell>
                                        {canManageMembers && (
                                            <TableCell>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" className="h-8 w-8 p-0">
                                                            <LucideMoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onClick={() => handleManagePermissions(member)}>
                                                            <LucideUserCog className="h-4 w-4 mr-2" />
                                                            Gestionar permisos
                                                        </DropdownMenuItem>
                                                        {member.role !== 'owner' && (
                                                            <>
                                                                <DropdownMenuSeparator />
                                                                <DropdownMenuItem
                                                                    onClick={() => handleUpdateRole(member, member.role === 'admin' ? 'member' : 'admin')}
                                                                >
                                                                    <LucideUserCog className="h-4 w-4 mr-2" />
                                                                    {member.role === 'admin' ? 'Degradar a miembro' : 'Promover a admin'}
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem
                                                                    className="text-destructive"
                                                                    onClick={() => handleRemoveMember(member)}
                                                                >
                                                                    <LucideUserMinus className="h-4 w-4 mr-2" />
                                                                    Eliminar del equipo
                                                                </DropdownMenuItem>
                                                            </>
                                                        )}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        )}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {sessionTokens?.accessToken && (
                <MemberPermissionsDialog
                    member={selectedMemberForPermissions}
                    creatorId={publisherId}
                    accessToken={sessionTokens.accessToken}
                    open={permissionsDialogOpen}
                    onOpenChange={setPermissionsDialogOpen}
                    onPermissionsChanged={loadMembers}
                    currentUserRole={userRole as 'owner' | 'admin' | 'member'}
                />
            )}

            <AlertDialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar miembro del equipo?</AlertDialogTitle>
                        <AlertDialogDescription>
                            ¿Estás seguro de que quieres eliminar a {memberToRemove?.username} del equipo?
                            Esta acción no se puede deshacer.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => {
                            setRemoveDialogOpen(false);
                            setMemberToRemove(null);
                        }}>
                            Cancelar
                        </AlertDialogCancel>
                        <AlertDialogAction onClick={confirmRemoveMember}>
                            Eliminar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};
