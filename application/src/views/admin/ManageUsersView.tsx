import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
    LucideLoader,
    LucideTrash,
    LucideEdit,
    LucideUserPlus,
    LucideSearch,
    LucideRefreshCw,
    LucideBan,
    LucideShieldCheck,
    LucideHistory,
    LucideUsers,
} from 'lucide-react';
import { useAuthentication } from '@/stores/AuthContext';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { API_ENDPOINT } from "@/consts";
import { Pagination } from '@/components/admin/Pagination';

interface User {
    id: string;
    username: string;
    email: string;
    role: 'user' | 'admin' | 'super_admin';
    avatarUrl?: string;
    createdAt: string;
    updatedAt: string;
    isBanned: boolean;
}

interface BanHistoryItem {
    id: string;
    userId: string;
    user: { id: string; username: string; avatarUrl?: string };
    adminId: string;
    admin: { id: string; username: string; avatarUrl?: string };
    reason?: string;
    banDate: string;
    unbanDate?: string;
    unbannedBy?: { id: string; username: string; avatarUrl?: string };
    isActive: boolean;
}

interface UserFormData {
    username: string;
    email: string;
    role: 'user' | 'admin' | 'super_admin' | 'system';
    avatarUrl?: string;
}

const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.4 } },
};

const tableRowVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 90, damping: 18 } },
} as const;

const tableContainerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.04 } },
} as const;

class AdminUsersAPI {
    private static get baseUrl() { return `${API_ENDPOINT}/admin/users`; }

    static async fetchUsers(params: {
        page?: number; limit?: number; search?: string; role?: string; sortBy?: string; sortOrder?: string;
    } = {}, accessToken: string) {
        const queryParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== '') queryParams.set(key, value.toString());
        });

        const response = await fetch(`${this.baseUrl}?${queryParams}`, {
            headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        });
        if (!response.ok) throw new Error('Failed to fetch users');

        const json = await response.json();
        return { users: json.data, total: json.meta.total, page: json.meta.page, totalPages: json.meta.totalPages };
    }

    static async createUser(userData: UserFormData, accessToken: string): Promise<User> {
        const response = await fetch(this.baseUrl, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(userData),
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.errors?.[0]?.detail || errorData.error || 'Failed to create user');
        }
        const json = await response.json();
        return json.data;
    }

    static async updateUser(userId: string, userData: Partial<UserFormData>, accessToken: string): Promise<User> {
        const response = await fetch(`${this.baseUrl}/${userId}`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(userData),
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.errors?.[0]?.detail || errorData.error || 'Failed to update user');
        }
        const json = await response.json();
        return json.data;
    }

    static async deleteUser(userId: string, accessToken: string): Promise<void> {
        const response = await fetch(`${this.baseUrl}/${userId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${accessToken}` },
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.errors?.[0]?.detail || errorData.error || 'Failed to delete user');
        }
    }

    static async banUser(userId: string, reason: string, accessToken: string): Promise<void> {
        const response = await fetch(`${API_ENDPOINT}/admin/bans`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, reason }),
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.errors?.[0]?.detail || errorData.error || 'Failed to ban user');
        }
    }

    static async unbanUser(userId: string, accessToken: string): Promise<void> {
        const response = await fetch(`${API_ENDPOINT}/admin/bans/${userId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${accessToken}` },
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.errors?.[0]?.detail || errorData.error || 'Failed to unban user');
        }
    }

    static async getUserBanHistory(userId: string, accessToken: string, page = 1, limit = 20): Promise<{ data: BanHistoryItem[]; meta: { total: number; page: number; totalPages: number } }> {
        const response = await fetch(`${API_ENDPOINT}/admin/bans/user/${userId}/history?page=${page}&limit=${limit}`, {
            headers: { 'Authorization': `Bearer ${accessToken}` },
        });
        if (!response.ok) throw new Error('Failed to fetch ban history');
        return response.json();
    }

    static async checkBanStatus(userId: string, accessToken: string): Promise<{ isBanned: boolean; ban?: BanHistoryItem }> {
        const response = await fetch(`${API_ENDPOINT}/admin/bans/user/${userId}/status`, {
            headers: { 'Authorization': `Bearer ${accessToken}` },
        });
        if (!response.ok) throw new Error('Failed to check ban status');
        return response.json();
    }
}

const RoleBadge = ({ role }: { role: string }) => {
    const config: Record<string, { variant: "destructive" | "default" | "secondary"; label: string; className: string }> = {
        super_admin: {
            variant: "destructive",
            label: "SUPER ADMIN",
            className: "bg-destructive/10 text-destructive border-destructive/20",
        },
        admin: {
            variant: "default",
            label: "ADMIN",
            className: "bg-blue-500/10 text-blue-400 border-blue-500/20",
        },
        user: {
            variant: "secondary",
            label: "USUARIO",
            className: "bg-muted/30 text-muted-foreground border-border",
        },
        system: {
            variant: "secondary",
            label: "SISTEMA",
            className: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
        },
    };

    const c = config[role] || config.user;

    return (
        <Badge variant={c.variant} className={c.className}>
            {c.label}
        </Badge>
    );
};

const StatusBadge = ({ isBanned }: { isBanned: boolean }) => {
    if (isBanned) {
        return (
            <Badge variant="destructive" className="bg-destructive/10 text-destructive border-destructive/20">
                BANEADO
            </Badge>
        );
    }
    return (
        <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
            ACTIVO
        </Badge>
    );
};

const AvatarInitials = ({ username, avatarUrl, className }: { username: string; avatarUrl?: string; className?: string }) => {
    if (avatarUrl) {
        return <img src={avatarUrl} alt={username} className={`w-7 h-7 rounded-full object-cover ${className || ''}`} />;
    }
    const initials = username.slice(0, 2).toUpperCase();
    return (
        <div className={`w-7 h-7 rounded-full bg-muted/30 flex items-center justify-center text-[10px] font-medium text-muted-foreground ${className || ''}`}>
            {initials}
        </div>
    );
};

const UserForm = ({ user, onSubmit, onCancel, isLoading }: {
    user?: User; onSubmit: (data: UserFormData) => void; onCancel: () => void; isLoading: boolean;
}) => {
    const [formData, setFormData] = useState<UserFormData>({
        username: user?.username || '',
        email: user?.email || '',
        role: user?.role || 'user',
        avatarUrl: user?.avatarUrl || '',
    });

    const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); onSubmit(formData); };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label htmlFor="username" className="block text-sm font-medium mb-1.5 text-foreground">
                    Nombre de Usuario
                </label>
                <Input id="username" value={formData.username} onChange={(e) => setFormData(p => ({ ...p, username: e.target.value }))}
                    placeholder="Ingresa el nombre de usuario" required className="bg-muted/30 border-border" />
            </div>
            <div>
                <label htmlFor="email" className="block text-sm font-medium mb-1.5 text-foreground">
                    Correo Electrónico
                </label>
                <Input id="email" type="email" value={formData.email}
                    onChange={(e) => setFormData(p => ({ ...p, email: e.target.value }))}
                    placeholder="Ingresa el correo electrónico" required className="bg-muted/30 border-border" />
            </div>
            <div>
                <label htmlFor="role" className="block text-sm font-medium mb-1.5 text-foreground">
                    Rol
                </label>
                <Select value={formData.role} onValueChange={(value: 'user' | 'admin' | 'super_admin') =>
                    setFormData(p => ({ ...p, role: value }))}>
                    <SelectTrigger className="bg-muted/30 border-border">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="user">Usuario</SelectItem>
                        <SelectItem value="admin">Administrador</SelectItem>
                        <SelectItem value="super_admin">Super Administrador</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <div>
                <label htmlFor="avatarUrl" className="block text-sm font-medium mb-1.5 text-foreground">
                    URL del Avatar <span className="text-muted-foreground">(Opcional)</span>
                </label>
                <Input id="avatarUrl" value={formData.avatarUrl}
                    onChange={(e) => setFormData(p => ({ ...p, avatarUrl: e.target.value }))}
                    placeholder="https://..." className="bg-muted/30 border-border" />
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

const BanDialog = ({ user, isOpen, onClose, onBan, isLoading }: {
    user: User; isOpen: boolean; onClose: () => void; onBan: (reason: string) => void; isLoading: boolean;
}) => {
    const [reason, setReason] = useState('');

    const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); onBan(reason); };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Banear Usuario</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <p className="text-sm text-muted-foreground mb-4">
                            ¿Estás seguro de que quieres banear a <strong className="text-white">{user.username}</strong>?
                        </p>
                        <label htmlFor="banReason" className="block text-sm font-medium mb-1.5 text-foreground">
                            Razón del ban <span className="text-muted-foreground">(opcional)</span>
                        </label>
                        <Textarea id="banReason" value={reason} onChange={(e) => setReason(e.target.value)}
                            placeholder="Describe la razón del ban..." rows={4}
                            className="bg-muted/30 border-border" />
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
                            Cancelar
                        </Button>
                        <Button type="submit" variant="destructive" disabled={isLoading}>
                            {isLoading && <LucideLoader className="mr-2 h-4 w-4 animate-spin" />}
                            Banear Usuario
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

const BanHistoryDialog = ({ user, isOpen, onClose, accessToken }: {
    user: User; isOpen: boolean; onClose: () => void; accessToken: string;
}) => {
    const [history, setHistory] = useState<BanHistoryItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);
    const [total, setTotal] = useState(0);
    const limit = 10;

    useEffect(() => {
        if (isOpen && user) loadHistory();
    }, [isOpen, user, currentPage]);

    const loadHistory = async () => {
        setIsLoading(true);
        try {
            const result = await AdminUsersAPI.getUserBanHistory(user.id, accessToken, currentPage, limit);
            setHistory(result.data);
            setTotalPages(result.meta.totalPages);
            setTotal(result.meta.total);
        } catch (error) {
            console.error('Error loading ban history:', error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <LucideHistory className="h-4 w-4 text-muted-foreground" />
                        Historial de Bans — {user.username}
                    </DialogTitle>
                </DialogHeader>
                <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <LucideLoader className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                    ) : history.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                            <LucideShieldCheck className="h-8 w-8 mb-2 opacity-50" />
                            <p className="text-sm">No hay historial de bans para este usuario.</p>
                        </div>
                    ) : (
                        history.map((ban) => (
                            <div key={ban.id} className="border border-border rounded-lg p-4 space-y-2 bg-muted/20">
                                <div className="flex items-center justify-between">
                                    <Badge variant={ban.isActive ? 'destructive' : 'secondary'}
                                        className={ban.isActive ? 'bg-destructive/10 text-destructive border-destructive/20' : 'bg-muted/30 text-muted-foreground border-border'}>
                                        {ban.isActive ? 'ACTIVO' : 'INACTIVO'}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">
                                        {new Date(ban.banDate).toLocaleString('es-ES')}
                                    </span>
                                </div>
                                {ban.reason && (
                                    <div>
                                        <span className="text-xs font-medium text-muted-foreground">Razón:</span>
                                        <p className="text-sm text-foreground mt-0.5">{ban.reason}</p>
                                    </div>
                                )}
                                <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border">
                                    <span>Baneado por: <strong className="text-foreground">{ban.admin.username}</strong></span>
                                    {ban.unbannedBy && (
                                        <span>Desbaneado por: <strong className="text-foreground">{ban.unbannedBy.username}</strong></span>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
                {totalPages > 1 && (
                    <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        total={total}
                        limit={limit}
                        onPageChange={setCurrentPage}
                        onLimitChange={() => {}}
                        itemLabel="bans"
                    />
                )}
            </DialogContent>
        </Dialog>
    );
};

export const ManageUsersView = () => {
    const [usersData, setUsersData] = useState({ users: [] as User[], total: 0, page: 1, totalPages: 0 });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [deletingUser, setDeletingUser] = useState<User | null>(null);
    const [banningUser, setBanningUser] = useState<User | null>(null);
    const [viewingBanHistory, setViewingBanHistory] = useState<User | null>(null);

    const { toast } = useToast();
    const { session, sessionTokens } = useAuthentication();

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const loadUsers = async () => {
        if (!sessionTokens?.accessToken) { setError('No access token available'); return; }
        setIsLoading(true);
        setError(null);
        try {
            const data = await AdminUsersAPI.fetchUsers({
                page: currentPage,
                limit: pageSize,
                search: debouncedSearch || undefined,
                role: roleFilter === 'all' ? undefined : roleFilter || undefined,
                sortBy: 'createdAt',
                sortOrder: 'DESC',
            }, sessionTokens.accessToken);
            setUsersData(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load users');
            toast({ title: 'Error', description: 'Failed to load users', variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (sessionTokens?.accessToken) loadUsers();
    }, [currentPage, pageSize, debouncedSearch, roleFilter, sessionTokens?.accessToken]);

    const handleCreateUser = async (userData: UserFormData) => {
        if (!sessionTokens?.accessToken) return;
        setIsSubmitting(true);
        try {
            await AdminUsersAPI.createUser(userData, sessionTokens.accessToken);
            setIsCreateDialogOpen(false);
            await loadUsers();
            toast({ title: 'Usuario creado', description: 'Usuario creado exitosamente' });
        } catch (err) {
            toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to create user', variant: 'destructive' });
        } finally { setIsSubmitting(false); }
    };

    const handleUpdateUser = async (userData: UserFormData) => {
        if (!editingUser || !sessionTokens?.accessToken) return;
        setIsSubmitting(true);
        try {
            await AdminUsersAPI.updateUser(editingUser.id, userData, sessionTokens.accessToken);
            setEditingUser(null);
            await loadUsers();
            toast({ title: 'Usuario actualizado', description: 'Usuario actualizado exitosamente' });
        } catch (err) {
            toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to update user', variant: 'destructive' });
        } finally { setIsSubmitting(false); }
    };

    const confirmDeleteUser = async () => {
        if (!deletingUser || !sessionTokens?.accessToken) return;
        try {
            await AdminUsersAPI.deleteUser(deletingUser.id, sessionTokens.accessToken);
            setDeletingUser(null);
            await loadUsers();
            toast({ title: 'Usuario eliminado', description: 'Usuario eliminado exitosamente' });
        } catch (err) {
            toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to delete user', variant: 'destructive' });
        }
    };

    const handleBanUser = async (reason: string) => {
        if (!banningUser || !sessionTokens?.accessToken) return;
        setIsSubmitting(true);
        try {
            await AdminUsersAPI.banUser(banningUser.id, reason, sessionTokens.accessToken);
            setBanningUser(null);
            await loadUsers();
            toast({ title: 'Usuario baneado', description: 'Usuario baneado exitosamente' });
        } catch (err) {
            toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to ban user', variant: 'destructive' });
        } finally { setIsSubmitting(false); }
    };

    const handleUnbanUser = async (user: User) => {
        if (!sessionTokens?.accessToken) return;
        try {
            await AdminUsersAPI.unbanUser(user.id, sessionTokens.accessToken);
            await loadUsers();
            toast({ title: 'Usuario desbaneado', description: 'Usuario desbaneado exitosamente' });
        } catch (err) {
            toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to unban user', variant: 'destructive' });
        }
    };

    return (
        <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">

            <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/10">
                    <LucideUsers className="h-5 w-5 text-purple-400" />
                </div>
                <div>
                    <h1 className="text-lg font-semibold text-white">Gestión de Usuarios</h1>
                    <p className="text-sm text-muted-foreground">Administrar usuarios, roles y permisos del sistema</p>
                </div>
            </div>

            <div className="bg-card border border-border rounded-xl">
                <div className="flex items-center justify-between p-6 pb-0">
                    <div className="flex-1" />
                    <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                        <DialogTrigger asChild>
                            <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                                <LucideUserPlus className="mr-2 h-4 w-4" />
                                Crear Usuario
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Crear Nuevo Usuario</DialogTitle>
                            </DialogHeader>
                            <UserForm onSubmit={handleCreateUser} onCancel={() => setIsCreateDialogOpen(false)} isLoading={isSubmitting} />
                        </DialogContent>
                    </Dialog>
                </div>

                <div className="p-6 pb-0">
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="flex-1 relative">
                            <LucideSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input placeholder="Buscar por nombre o correo..." value={searchTerm}
                                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                                className="pl-10 bg-muted/30 border-border text-sm" />
                        </div>
                        <Select value={roleFilter}
                            onValueChange={(v) => { setRoleFilter(v); setCurrentPage(1); }}>
                            <SelectTrigger className="w-full sm:w-44 bg-muted/30 border-border text-sm">
                                <SelectValue placeholder="Filtrar por rol" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos los Roles</SelectItem>
                                <SelectItem value="user">Usuario</SelectItem>
                                <SelectItem value="admin">Administrador</SelectItem>
                                <SelectItem value="super_admin">Super Administrador</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button variant="outline" onClick={loadUsers} disabled={isLoading}
                            className="border-border bg-muted/30 hover:bg-muted/30">
                            <LucideRefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                        </Button>
                    </div>
                </div>

                <div className="p-6">
                    {error && (
                        <div className="flex items-center gap-3 p-4 mb-4 rounded-lg bg-destructive/10 border border-destructive text-sm text-destructive">
                            <LucideBan className="h-4 w-4 shrink-0" />
                            {error}
                        </div>
                    )}

                    <div className="border border-border rounded-lg overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow className="border-b border-border hover:bg-transparent">
                                    <TableHead className="h-10 text-xs font-medium text-muted-foreground">Usuario</TableHead>
                                    <TableHead className="h-10 text-xs font-medium text-muted-foreground">Correo</TableHead>
                                    <TableHead className="h-10 text-xs font-medium text-muted-foreground">Rol</TableHead>
                                    <TableHead className="h-10 text-xs font-medium text-muted-foreground">Estado</TableHead>
                                    <TableHead className="h-10 text-xs font-medium text-muted-foreground">Creado</TableHead>
                                    <TableHead className="h-10 text-xs font-medium text-muted-foreground text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            {isLoading ? (
                                <TableBody>
                                    <TableRow>
                                        <TableCell colSpan={6}>
                                            <div className="flex items-center justify-center py-12">
                                                <LucideLoader className="h-5 w-5 animate-spin text-muted-foreground" />
                                                <span className="ml-3 text-sm text-muted-foreground">Cargando usuarios...</span>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                </TableBody>
                            ) : usersData.users.length === 0 ? (
                                <TableBody>
                                    <TableRow>
                                        <TableCell colSpan={6}>
                                            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                                                <LucideUsers className="h-8 w-8 mb-2 opacity-30" />
                                                <p className="text-sm">No se encontraron usuarios</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                </TableBody>
                            ) : (
                                <motion.tbody className="[&_tr:last-child]:border-0"
                                    variants={tableContainerVariants} initial="hidden" animate="visible">
                                    {usersData.users.map((user) => {
                                        const isBanned = user.isBanned;
                                        const isSystem = user.username === "system";
                                        const isSelf = user.id === session?.id;
                                        const isAdmin = user.role === 'admin' || user.role === 'super_admin';

                                        return (
                                            <motion.tr key={user.id}
                                                variants={tableRowVariants}
                                                className="group border-b border-border last:border-0 transition-colors hover:bg-muted/20">
                                                <TableCell className="py-3">
                                                    <div className="flex items-center gap-2.5">
                                                        <AvatarInitials username={user.username} avatarUrl={user.avatarUrl} />
                                                        <span className="text-sm font-medium text-white">{user.username}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="py-3">
                                                    <span className="text-sm text-muted-foreground">{user.email}</span>
                                                </TableCell>
                                                <TableCell className="py-3">
                                                    <RoleBadge role={user.role} />
                                                </TableCell>
                                                <TableCell className="py-3">
                                                    <StatusBadge isBanned={isBanned} />
                                                </TableCell>
                                                <TableCell className="py-3">
                                                    <span className="text-sm text-muted-foreground">
                                                        {new Date(user.createdAt).toLocaleDateString('es-ES')}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="py-3 text-right">
                                                    <div className="flex justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Button variant="outline" size="sm" disabled={isSystem}
                                                            onClick={() => setEditingUser(user)}
                                                            className="border-border bg-muted/30 hover:bg-muted/30 h-8 w-8 p-0">
                                                            <LucideEdit className="h-3.5 w-3.5 text-muted-foreground" />
                                                        </Button>
                                                        <Button variant="outline" size="sm"
                                                            onClick={() => setViewingBanHistory(user)}
                                                            className="border-border bg-muted/30 hover:bg-muted/30 h-8 w-8 p-0">
                                                            <LucideHistory className="h-3.5 w-3.5 text-muted-foreground" />
                                                        </Button>
                                                        {isBanned ? (
                                                            <Button variant="outline" size="sm" disabled={isSystem}
                                                                onClick={() => handleUnbanUser(user)}
                                                                className="border-border bg-muted/30 hover:bg-muted/30 h-8 w-8 p-0">
                                                                <LucideShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                                                            </Button>
                                                        ) : (
                                                            <Button variant="outline" size="sm"
                                                                disabled={isAdmin || isSystem}
                                                                onClick={() => setBanningUser(user)}
                                                                className="border-border bg-muted/30 hover:bg-muted/30 h-8 w-8 p-0"
                                                                title={isAdmin ? "No se pueden banear administradores" : "Banear usuario"}>
                                                                <LucideBan className="h-3.5 w-3.5 text-destructive" />
                                                            </Button>
                                                        )}
                                                        <Button variant="outline" size="sm"
                                                            onClick={() => setDeletingUser(user)}
                                                            disabled={isSelf || isSystem}
                                                            className="border-border bg-muted/30 hover:bg-muted/50 hover:border-destructive/30 h-8 w-8 p-0">
                                                            <LucideTrash className="h-3.5 w-3.5 text-destructive" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </motion.tr>
                                        );
                                    })}
                                </motion.tbody>
                            )}
                        </Table>
                    </div>

                    {usersData.totalPages > 1 && (
                        <Pagination
                            currentPage={currentPage}
                            totalPages={usersData.totalPages}
                            total={usersData.total}
                            limit={pageSize}
                            onPageChange={setCurrentPage}
                            onLimitChange={(newLimit) => {
                                setPageSize(newLimit);
                                setCurrentPage(1);
                            }}
                            itemLabel="usuarios"
                        />
                    )}
                </div>
            </div>

            <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Editar Usuario</DialogTitle></DialogHeader>
                    {editingUser && <UserForm user={editingUser} onSubmit={handleUpdateUser}
                        onCancel={() => setEditingUser(null)} isLoading={isSubmitting} />}
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!deletingUser} onOpenChange={(open) => { if (!open) setDeletingUser(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Eliminar Usuario</AlertDialogTitle>
                        <AlertDialogDescription>
                            ¿Seguro que quieres eliminar a <strong className="text-white">{deletingUser?.username}</strong>?
                            Esta acción no se puede deshacer.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setDeletingUser(null)}
                            className="border-border bg-muted/30 hover:bg-muted/30">
                            Cancelar
                        </AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDeleteUser}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Eliminar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {banningUser && sessionTokens?.accessToken && (
                <BanDialog user={banningUser} isOpen={!!banningUser} onClose={() => setBanningUser(null)}
                    onBan={handleBanUser} isLoading={isSubmitting} />
            )}

            {viewingBanHistory && sessionTokens?.accessToken && (
                <BanHistoryDialog user={viewingBanHistory} isOpen={!!viewingBanHistory}
                    onClose={() => setViewingBanHistory(null)} accessToken={sessionTokens.accessToken} />
            )}

        </motion.div>
    );
};
