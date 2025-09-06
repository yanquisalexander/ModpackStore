import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import {
    LucideLoader,
    LucideTrash,
    LucideEdit,
    LucideUserPlus,
    LucideSearch,
    LucideRefreshCw
} from 'lucide-react';
import { useAuthentication } from '@/stores/AuthContext';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { API_ENDPOINT } from "@/consts";

// Types
interface User {
    id: string;
    username: string;
    email: string;
    role: 'user' | 'admin' | 'superadmin';
    avatarUrl?: string;
    createdAt: string;
    updatedAt: string;
}

interface PaginatedUsers {
    users: User[];
    total: number;
    page: number;
    totalPages: number;
}

interface UserFormData {
    username: string;
    email: string;
    role: 'user' | 'admin' | 'superadmin';
    avatarUrl?: string;
}

// API Service
class AdminUsersAPI {
    private static baseUrl = `${API_ENDPOINT}/admin/users`;

    static async fetchUsers(params: {
        page?: number;
        limit?: number;
        search?: string;
        role?: string;
        sortBy?: string;
        sortOrder?: string;
    } = {}, accessToken: string): Promise<PaginatedUsers> {
        const queryParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== '') {
                queryParams.set(key, value.toString());
            }
        });

        const response = await fetch(`${this.baseUrl}?${queryParams}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error('Failed to fetch users');
        }

        return response.json();
    }

    static async createUser(userData: UserFormData, accessToken: string): Promise<User> {
        const response = await fetch(this.baseUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(userData),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to create user');
        }

        return response.json();
    }

    static async updateUser(userId: string, userData: Partial<UserFormData>, accessToken: string): Promise<User> {
        const response = await fetch(`${this.baseUrl}/${userId}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(userData),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to update user');
        }

        return response.json();
    }

    static async deleteUser(userId: string, accessToken: string): Promise<void> {
        const response = await fetch(`${this.baseUrl}/${userId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to delete user');
        }
    }
}

// User Form Component
const UserForm: React.FC<{
    user?: User;
    onSubmit: (data: UserFormData) => void;
    onCancel: () => void;
    isLoading: boolean;
}> = ({ user, onSubmit, onCancel, isLoading }) => {
    const [formData, setFormData] = useState<UserFormData>({
        username: user?.username || '',
        email: user?.email || '',
        role: user?.role || 'user',
        avatarUrl: user?.avatarUrl || ''
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(formData);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label htmlFor="username" className="block text-sm font-medium mb-1">
                    Nombre de Usuario
                </label>
                <Input
                    id="username"
                    value={formData.username}
                    onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                    placeholder="Ingresa el nombre de usuario"
                    required
                />
            </div>

            <div>
                <label htmlFor="email" className="block text-sm font-medium mb-1">
                    Correo Electrónico
                </label>
                <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="Ingresa el correo electrónico"
                    required
                />
            </div>

            <div>
                <label htmlFor="role" className="block text-sm font-medium mb-1">
                    Rol
                </label>
                <Select
                    value={formData.role}
                    onValueChange={(value: 'user' | 'admin' | 'superadmin') =>
                        setFormData(prev => ({ ...prev, role: value }))
                    }
                >
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="user">Usuario</SelectItem>
                        <SelectItem value="support">Soporte</SelectItem>
                        <SelectItem value="admin">Administrador</SelectItem>
                        <SelectItem value="superadmin">Super Administrador</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div>
                <label htmlFor="avatarUrl" className="block text-sm font-medium mb-1">
                    URL del Avatar (Opcional)
                </label>
                <Input
                    id="avatarUrl"
                    value={formData.avatarUrl}
                    onChange={(e) => setFormData(prev => ({ ...prev, avatarUrl: e.target.value }))}
                    placeholder="Ingresa la URL del avatar"
                />
            </div>

            <DialogFooter>
                <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
                    Cancelar
                </Button>
                <Button type="submit" disabled={isLoading}>
                    {isLoading && <LucideLoader className="mr-2 h-4 w-4 animate-spin" />}
                    {user ? 'Actualizar Usuario' : 'Crear Usuario'}
                </Button>
            </DialogFooter>
        </form>
    );
};

// Role Badge Component
const RoleBadge: React.FC<{ role: string }> = ({ role }) => {
    const getBadgeVariant = (role: string) => {
        switch (role) {
            case 'superadmin': return 'destructive';
            case 'admin': return 'default';
            default: return 'secondary';
        }
    };

    const getRoleLabel = (role: string) => {
        switch (role) {
            case 'superadmin': return 'SUPER ADMIN';
            case 'admin': return 'ADMIN';
            case 'user': return 'USUARIO';
            default: return role.toUpperCase();
        }
    };

    return (
        <Badge variant={getBadgeVariant(role) as any}>
            {getRoleLabel(role)}
        </Badge>
    );
};

// Main Component
export const ManageUsersView: React.FC = () => {
    const [usersData, setUsersData] = useState<PaginatedUsers>({
        users: [],
        total: 0,
        page: 1,
        totalPages: 0
    });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [deletingUser, setDeletingUser] = useState<User | null>(null);

    const { toast } = useToast();
    const { session, sessionTokens } = useAuthentication();

    const loadUsers = async () => {
        if (!sessionTokens?.accessToken) {
            setError('No access token available');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const data = await AdminUsersAPI.fetchUsers({
                page: currentPage,
                limit: 20,
                search: searchTerm || undefined,
                role: roleFilter === 'all' ? undefined : roleFilter || undefined,
                sortBy: 'createdAt',
                sortOrder: 'DESC'
            }, sessionTokens.accessToken);

            setUsersData(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load users');
            toast({
                title: 'Error',
                description: 'Failed to load users',
                variant: 'destructive'
            });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (sessionTokens?.accessToken) {
            loadUsers();
        }
    }, [currentPage, searchTerm, roleFilter, sessionTokens?.accessToken]);

    const handleCreateUser = async (userData: UserFormData) => {
        if (!sessionTokens?.accessToken) {
            toast({
                title: 'Error',
                description: 'No access token available',
                variant: 'destructive'
            });
            return;
        }

        setIsSubmitting(true);
        try {
            await AdminUsersAPI.createUser(userData, sessionTokens.accessToken);
            setIsCreateDialogOpen(false);
            await loadUsers();
            toast({
                title: 'Success',
                description: 'User created successfully'
            });
        } catch (err) {
            toast({
                title: 'Error',
                description: err instanceof Error ? err.message : 'Failed to create user',
                variant: 'destructive'
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUpdateUser = async (userData: UserFormData) => {
        if (!editingUser) return;

        if (!sessionTokens?.accessToken) {
            toast({
                title: 'Error',
                description: 'No access token available',
                variant: 'destructive'
            });
            return;
        }

        setIsSubmitting(true);
        try {
            await AdminUsersAPI.updateUser(editingUser.id, userData, sessionTokens.accessToken);
            setEditingUser(null);
            await loadUsers();
            toast({
                title: 'Success',
                description: 'User updated successfully'
            });
        } catch (err) {
            toast({
                title: 'Error',
                description: err instanceof Error ? err.message : 'Failed to update user',
                variant: 'destructive'
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Open confirm dialog for deletion
    const handleDeleteUser = (user: User) => {
        setDeletingUser(user);
    };

    // Perform deletion after confirmation
    const confirmDeleteUser = async () => {
        if (!deletingUser) return;

        if (!sessionTokens?.accessToken) {
            toast({
                title: 'Error',
                description: 'No access token available',
                variant: 'destructive'
            });
            return;
        }

        try {
            await AdminUsersAPI.deleteUser(deletingUser.id, sessionTokens.accessToken);
            setDeletingUser(null);
            await loadUsers();
            toast({
                title: 'Success',
                description: 'User deleted successfully'
            });
        } catch (err) {
            toast({
                title: 'Error',
                description: err instanceof Error ? err.message : 'Failed to delete user',
                variant: 'destructive'
            });
        }
    };

    // Prevent non-admin users from accessing this view
    if (!session?.isAdmin?.()) {
        return (
            <div className="container mx-auto p-4 text-center">
                <Alert>
                    <AlertDescription>
                        You do not have permission to access this page.
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4 space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        <span>Gestión de Usuarios</span>
                        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                            <DialogTrigger asChild>
                                <Button>
                                    <LucideUserPlus className="mr-2 h-4 w-4" />
                                    Crear Usuario
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Crear Nuevo Usuario</DialogTitle>
                                </DialogHeader>
                                <UserForm
                                    onSubmit={handleCreateUser}
                                    onCancel={() => setIsCreateDialogOpen(false)}
                                    isLoading={isSubmitting}
                                />
                            </DialogContent>
                        </Dialog>
                    </CardTitle>
                </CardHeader>

                <CardContent className="space-y-4">
                    {/* Filters */}
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="flex-1">
                            <div className="relative">
                                <LucideSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    placeholder="Buscar por nombre de usuario o correo..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                        </div>

                        <Select value={roleFilter} onValueChange={setRoleFilter}>
                            <SelectTrigger className="w-full sm:w-48">
                                <SelectValue placeholder="Filtrar por rol" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos los Roles</SelectItem>
                                <SelectItem value="user">Usuario</SelectItem>
                                <SelectItem value="support">Soporte</SelectItem>
                                <SelectItem value="admin">Administrador</SelectItem>
                                <SelectItem value="superadmin">Super Administrador</SelectItem>
                            </SelectContent>
                        </Select>

                        <Button variant="outline" onClick={loadUsers} disabled={isLoading}>
                            <LucideRefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                        </Button>
                    </div>

                    {/* Error Display */}
                    {error && (
                        <Alert variant="destructive">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    {/* Users Table */}
                    <div className="border rounded-lg">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Nombre de Usuario</TableHead>
                                    <TableHead>Correo Electrónico</TableHead>
                                    <TableHead>Rol</TableHead>
                                    <TableHead>Creado</TableHead>
                                    <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-8">
                                            <LucideLoader className="h-6 w-6 animate-spin mx-auto" />
                                            <p className="mt-2 text-muted-foreground">Cargando usuarios...</p>
                                        </TableCell>
                                    </TableRow>
                                ) : usersData.users.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                            No se encontraron usuarios
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    usersData.users.map((user) => (
                                        <TableRow key={user.id}>
                                            <TableCell className="font-medium">
                                                <div className="flex items-center gap-2">
                                                    {user.avatarUrl && (
                                                        <img
                                                            src={user.avatarUrl}
                                                            alt={user.username}
                                                            className="w-6 h-6 rounded-full"
                                                        />
                                                    )}
                                                    {user.username}
                                                </div>
                                            </TableCell>
                                            <TableCell>{user.email}</TableCell>
                                            <TableCell>
                                                <RoleBadge role={user.role} />
                                            </TableCell>
                                            <TableCell>
                                                {new Date(user.createdAt).toLocaleDateString()}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        disabled={user.username === "system"}
                                                        onClick={() => setEditingUser(user)}
                                                    >
                                                        <LucideEdit className="h-3 w-3" />
                                                    </Button>
                                                    <Button
                                                        variant="destructive"
                                                        size="sm"
                                                        onClick={() => handleDeleteUser(user)}
                                                        disabled={user.id === session?.id || user.username === "system"}
                                                    >
                                                        <LucideTrash className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Pagination */}
                    {usersData.totalPages > 1 && (
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-muted-foreground">
                                Mostrando {((currentPage - 1) * 20) + 1} a {Math.min(currentPage * 20, usersData.total)} de {usersData.total} usuarios
                            </p>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                >
                                    Anterior
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage(p => Math.min(usersData.totalPages, p + 1))}
                                    disabled={currentPage === usersData.totalPages}
                                >
                                    Siguiente
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Edit User Dialog */}
            <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Editar Usuario</DialogTitle>
                    </DialogHeader>
                    {editingUser && (
                        <UserForm
                            user={editingUser}
                            onSubmit={handleUpdateUser}
                            onCancel={() => setEditingUser(null)}
                            isLoading={isSubmitting}
                        />
                    )}
                </DialogContent>
            </Dialog>

            {/* Delete confirmation AlertDialog */}
            <AlertDialog open={!!deletingUser} onOpenChange={(open) => { if (!open) setDeletingUser(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Eliminar Usuario</AlertDialogTitle>
                        <AlertDialogDescription>
                            ¿Seguro que quieres eliminar al usuario <strong>{deletingUser?.username}</strong>? Esta acción no se puede deshacer.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setDeletingUser(null)}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDeleteUser} className="bg-red-600 hover:bg-red-700">Eliminar</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};
