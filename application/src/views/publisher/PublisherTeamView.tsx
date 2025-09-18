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
    LucideX
} from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuthentication } from '@/stores/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { API_ENDPOINT } from '@/consts';

// Types
interface PublisherMember {
    id: number;
    role: string;
    createdAt: string;
    user: {
        id: string;
        username: string;
        email: string;
        avatarUrl?: string;
    };
}

// API Service for publisher team management
class PublisherTeamAPI {
    private static baseUrl = `${API_ENDPOINT}/admin/publishers`; // Note: Using admin endpoint as basis

    static async getMembers(publisherId: string, accessToken: string): Promise<{ members: PublisherMember[]; total: number }> {
        const response = await fetch(`${this.baseUrl}/${publisherId}/members`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || `Error fetching members: ${response.statusText}`);
        }

        const data = await response.json();
        return {
            members: data.data || [],
            total: data.meta?.total || data.data?.length || 0
        };
    }

    static async addMember(publisherId: string, userId: string, role: string, accessToken: string): Promise<void> {
        const response = await fetch(`${this.baseUrl}/${publisherId}/members`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ userId, role }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || `Error adding member: ${response.statusText}`);
        }
    }

    static async removeMember(publisherId: string, userId: string, accessToken: string): Promise<void> {
        const response = await fetch(`${this.baseUrl}/${publisherId}/members/${userId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || `Error removing member: ${response.statusText}`);
        }
    }

    static async updateMemberRole(publisherId: string, userId: string, role: string, accessToken: string): Promise<void> {
        const response = await fetch(`${this.baseUrl}/${publisherId}/members/${userId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ role }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || `Error updating member role: ${response.statusText}`);
        }
    }
}

// Helper functions
const getRoleBadgeVariant = (role: string) => {
    switch (role) {
        case 'owner': return 'destructive';
        case 'admin': return 'default';
        case 'member': return 'secondary';
        default: return 'outline';
    }
};

const getRoleLabel = (role: string) => {
    switch (role) {
        case 'owner': return 'Propietario';
        case 'admin': return 'Administrador';
        case 'member': return 'Miembro';
        default: return role;
    }
};

// Add Member Dialog Component
const AddMemberDialog: React.FC<{
    publisherId: string;
    onMemberAdded: () => void;
}> = ({ publisherId, onMemberAdded }) => {
    const [open, setOpen] = useState(false);
    const [userId, setUserId] = useState('');
    const [role, setRole] = useState('member');
    const [loading, setLoading] = useState(false);
    const { sessionTokens } = useAuthentication();
    const { toast } = useToast();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userId.trim() || !sessionTokens?.accessToken) return;

        try {
            setLoading(true);
            await PublisherTeamAPI.addMember(publisherId, userId.trim(), role, sessionTokens.accessToken);

            toast({
                title: "Miembro agregado",
                description: "El miembro ha sido agregado exitosamente al equipo.",
            });

            setUserId('');
            setRole('member');
            setOpen(false);
            onMemberAdded();
        } catch (err: any) {
            console.error('Error adding member:', err);
            toast({
                title: "Error",
                description: err.message || "Error al agregar el miembro",
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
                    Invitar Miembro
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Invitar Nuevo Miembro</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <Label htmlFor="userId">ID de Usuario</Label>
                        <Input
                            id="userId"
                            value={userId}
                            onChange={(e) => setUserId(e.target.value)}
                            placeholder="Ingresa el ID del usuario"
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
    const [members, setMembers] = useState<PublisherMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Get user role in this publisher
    const publisherMembership = session?.publisherMemberships?.find(
        membership => membership.publisherId === publisherId
    );
    const userRole = publisherMembership?.role || 'member';
    const canManageMembers = ['owner', 'admin'].includes(userRole);

    // Load members
    const loadMembers = async () => {
        if (!publisherId || !sessionTokens?.accessToken) return;

        try {
            setLoading(true);
            setError(null);
            const data = await PublisherTeamAPI.getMembers(publisherId, sessionTokens.accessToken);
            setMembers(data.members);
        } catch (err: any) {
            console.error('Error loading members:', err);
            setError(err.message || 'Error al cargar los miembros del equipo');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadMembers();
    }, [publisherId, sessionTokens?.accessToken]);

    const handleRemoveMember = async (member: PublisherMember) => {
        if (!sessionTokens?.accessToken || !publisherId) return;

        if (!confirm(`¿Estás seguro de que quieres eliminar a ${member.user.username} del equipo?`)) {
            return;
        }

        try {
            await PublisherTeamAPI.removeMember(publisherId, member.user.id, sessionTokens.accessToken);

            toast({
                title: "Miembro eliminado",
                description: `${member.user.username} ha sido eliminado del equipo.`,
            });

            loadMembers();
        } catch (err: any) {
            console.error('Error removing member:', err);
            toast({
                title: "Error",
                description: err.message || "Error al eliminar el miembro",
                variant: "destructive",
            });
        }
    };

    const handleChangeRole = async (member: PublisherMember, newRole: string) => {
        if (!sessionTokens?.accessToken || !publisherId) return;

        try {
            await PublisherTeamAPI.updateMemberRole(publisherId, member.user.id, newRole, sessionTokens.accessToken);

            toast({
                title: "Rol actualizado",
                description: `El rol de ${member.user.username} ha sido actualizado.`,
            });

            loadMembers();
        } catch (err: any) {
            console.error('Error updating member role:', err);
            toast({
                title: "Error",
                description: err.message || "Error al actualizar el rol",
                variant: "destructive",
            });
        }
    };

    if (!canManageMembers) {
        return (
            <Card>
                <CardContent className="p-8 text-center">
                    <LucideUsers className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-medium mb-2">Acceso Restringido</h3>
                    <p className="text-muted-foreground">
                        No tienes permisos para gestionar los miembros del equipo.
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <LucideUsers className="h-5 w-5" />
                            <CardTitle>Gestión de Equipo</CardTitle>
                        </div>
                        {canManageMembers && publisherId && (
                            <AddMemberDialog
                                publisherId={publisherId}
                                onMemberAdded={loadMembers}
                            />
                        )}
                    </div>
                </CardHeader>
            </Card>

            {/* Content */}
            <Card>
                <CardContent className="p-6">
                    {error && (
                        <Alert variant="destructive" className="mb-4">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <LucideLoader className="h-8 w-8 animate-spin" />
                        </div>
                    ) : members.length === 0 ? (
                        <div className="text-center py-12">
                            <LucideUsers className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                            <h3 className="text-lg font-medium mb-2">No hay miembros</h3>
                            <p className="text-muted-foreground mb-4">
                                Este publisher aún no tiene miembros en el equipo.
                            </p>
                            {publisherId && (
                                <AddMemberDialog
                                    publisherId={publisherId}
                                    onMemberAdded={loadMembers}
                                />
                            )}
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Miembro</TableHead>
                                    <TableHead>Rol</TableHead>
                                    <TableHead>Fecha de Unión</TableHead>
                                    <TableHead className="w-[50px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {members.map((member) => (
                                    <TableRow key={member.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                                    {member.user.avatarUrl ? (
                                                        <img
                                                            src={member.user.avatarUrl}
                                                            alt={member.user.username}
                                                            className="w-8 h-8 rounded-full"
                                                        />
                                                    ) : (
                                                        <span className="text-sm font-medium">
                                                            {member.user.username.charAt(0).toUpperCase()}
                                                        </span>
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="font-medium">{member.user.username}</p>
                                                    <p className="text-sm text-muted-foreground">{member.user.email}</p>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={getRoleBadgeVariant(member.role)}>
                                                {getRoleLabel(member.role)}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            {new Date(member.createdAt).toLocaleDateString('es-ES')}
                                        </TableCell>
                                        <TableCell>
                                            {member.role !== 'owner' && (
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="sm">
                                                            <LucideMoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onClick={() => handleChangeRole(member, member.role === 'admin' ? 'member' : 'admin')}>
                                                            <LucideUserCog className="h-4 w-4 mr-2" />
                                                            {member.role === 'admin' ? 'Hacer Miembro' : 'Hacer Admin'}
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            onClick={() => handleRemoveMember(member)}
                                                            className="text-destructive"
                                                        >
                                                            <LucideUserMinus className="h-4 w-4 mr-2" />
                                                            Eliminar del Equipo
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};