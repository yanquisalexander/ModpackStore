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
    PublisherPermissionsAPI,
    PublisherMemberWithPermissions
} from '@/services/publisherPermissions.service';
import { MemberPermissionsDialog } from '@/components/publisher/MemberPermissionsDialog';

// Add Member Dialog Component
const AddMemberDialog: React.FC<{
    publisherId: string;
    accessToken: string;
    onMemberAdded: () => void;
}> = ({ publisherId, accessToken, onMemberAdded }) => {
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
            await PublisherPermissionsAPI.addMember(publisherId, userId, role, accessToken);

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
                        <Label htmlFor="userId">ID de usuario</Label>
                        <Input
                            id="userId"
                            value={userId}
                            onChange={(e) => setUserId(e.target.value)}
                            placeholder="Introduce el ID del usuario"
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

    // State
    const [members, setMembers] = useState<PublisherMemberWithPermissions[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedMemberForPermissions, setSelectedMemberForPermissions] = useState<PublisherMemberWithPermissions | null>(null);
    const [permissionsDialogOpen, setPermissionsDialogOpen] = useState(false);

    // Get user role in this publisher
    const publisherMembership = session?.publisherMemberships?.find(
        membership => membership.publisherId === publisherId
    );
    const userRole = publisherMembership?.role || 'member';
    const canManageMembers = ['owner', 'admin'].includes(userRole);
    const canManagePermissions = ['owner', 'admin'].includes(userRole); // For now, same as manage members

    // Load members
    const loadMembers = async () => {
        if (!publisherId || !sessionTokens?.accessToken) return;

        try {
            setLoading(true);
            setError(null);
            const data = await PublisherPermissionsAPI.getMembers(publisherId, sessionTokens.accessToken);
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

    // Remove member
    const handleRemoveMember = async (member: PublisherMemberWithPermissions) => {
        if (!publisherId || !sessionTokens?.accessToken) return;
        if (!confirm(`¿Estás seguro de que quieres eliminar a ${member.user.username} del equipo?`)) return;

        try {
            await PublisherPermissionsAPI.removeMember(publisherId, member.userId, sessionTokens.accessToken);
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
        }
    };

    // Update member role
    const handleUpdateRole = async (member: PublisherMemberWithPermissions, newRole: string) => {
        if (!publisherId || !sessionTokens?.accessToken) return;

        try {
            await PublisherPermissionsAPI.updateMemberRole(publisherId, member.userId, newRole, sessionTokens.accessToken);
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

    // Manage permissions
    const handleManagePermissions = (member: PublisherMemberWithPermissions) => {
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
                        No se encontró el ID del publisher.
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
                        Administra los miembros y permisos de tu publisher
                    </p>
                </div>
                {canManageMembers && sessionTokens?.accessToken && (
                    <AddMemberDialog
                        publisherId={publisherId}
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
                            No hay miembros en este publisher
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
                                    <TableRow key={member.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                {member.user?.avatarUrl && (
                                                    <img
                                                        src={member.user?.avatarUrl}
                                                        alt={member.user?.username}
                                                        className="h-8 w-8 rounded-full"
                                                    />
                                                )}
                                                <div>
                                                    <div className="font-medium">{member.user?.username}</div>
                                                    <div className="text-sm text-muted-foreground">{member.user?.email}</div>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={PublisherPermissionsAPI.getRoleBadgeVariant(member.role)}>
                                                {PublisherPermissionsAPI.getRoleDisplayName(member.role)}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            {new Date(member.createdAt).toLocaleDateString('es-ES', {
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
                                                        {member.scopes?.length || 0} permisos configurados
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

            {/* Permissions management dialog */}
            {sessionTokens?.accessToken && (
                <MemberPermissionsDialog
                    member={selectedMemberForPermissions}
                    publisherId={publisherId}
                    accessToken={sessionTokens.accessToken}
                    open={permissionsDialogOpen}
                    onOpenChange={setPermissionsDialogOpen}
                    onPermissionsChanged={loadMembers}
                />
            )}
        </div>
    );
};