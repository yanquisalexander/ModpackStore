import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
    LucideLoader,
    LucideTrash,
    LucideEdit,
    LucideUserPlus,
    LucideSearch,
    LucideRefreshCw,
    LucideBuilding2,
    LucideUsers,
    LucidePackage,
    LucideShield,
    LucideCheck,
    LucideX
} from 'lucide-react';
import { useAuthentication } from '@/stores/AuthContext';
import { API_ENDPOINT } from "@/consts";

// Types
interface Publisher {
    id: string;
    publisherName: string;
    description: string;
    tosUrl: string;
    privacyUrl: string;
    bannerUrl: string;
    logoUrl: string;
    websiteUrl?: string;
    discordUrl?: string;
    verified: boolean;
    partnered: boolean;
    banned: boolean;
    isHostingPartner: boolean;
    createdAt: string;
    members?: PublisherMember[];
    modpacks?: any[];
}

interface PublisherMember {
    id: number;
    publisherId: string;
    userId: string;
    role: 'owner' | 'admin' | 'member';
    createdAt: string;
    updatedAt: string;
    user?: {
        id: string;
        username: string;
        email: string;
        avatarUrl?: string;
    };
}

interface PaginatedPublishers {
    publishers: Publisher[];
    total: number;
    page: number;
    totalPages: number;
}

interface PublisherFormData {
    publisherName: string;
    description: string;
    tosUrl: string;
    privacyUrl: string;
    bannerUrl: string;
    logoUrl: string;
    websiteUrl?: string;
    discordUrl?: string;
}

// API Service
class AdminPublishersAPI {
    private static baseUrl = `${API_ENDPOINT}/admin/publishers`;

    static async getPublishers(options: {
        page?: number;
        limit?: number;
        search?: string;
        verified?: boolean;
        partnered?: boolean;
        sortBy?: string;
        sortOrder?: string;
    } = {}) {
        const params = new URLSearchParams();
        Object.entries(options).forEach(([key, value]) => {
            if (value !== undefined) {
                params.append(key, value.toString());
            }
        });

        const response = await fetch(`${this.baseUrl}?${params}`, {
            credentials: 'include',
        });

        if (!response.ok) {
            throw new Error(`Error fetching publishers: ${response.statusText}`);
        }

        return response.json();
    }

    static async getPublisher(id: string) {
        const response = await fetch(`${this.baseUrl}/${id}`, {
            credentials: 'include',
        });

        if (!response.ok) {
            throw new Error(`Error fetching publisher: ${response.statusText}`);
        }

        return response.json();
    }

    static async createPublisher(data: PublisherFormData) {
        const response = await fetch(this.baseUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || `Error creating publisher: ${response.statusText}`);
        }

        return response.json();
    }

    static async updatePublisher(id: string, data: Partial<PublisherFormData & {
        verified: boolean;
        partnered: boolean;
        banned: boolean;
        isHostingPartner: boolean;
    }>) {
        const response = await fetch(`${this.baseUrl}/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || `Error updating publisher: ${response.statusText}`);
        }

        return response.json();
    }

    static async deletePublisher(id: string) {
        const response = await fetch(`${this.baseUrl}/${id}`, {
            method: 'DELETE',
            credentials: 'include',
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || `Error deleting publisher: ${response.statusText}`);
        }
    }

    static async getPublisherMembers(publisherId: string, page = 1, limit = 20) {
        const response = await fetch(`${this.baseUrl}/${publisherId}/members?page=${page}&limit=${limit}`, {
            credentials: 'include',
        });

        if (!response.ok) {
            throw new Error(`Error fetching publisher members: ${response.statusText}`);
        }

        return response.json();
    }

    static async addMember(publisherId: string, userId: string, role: string) {
        const response = await fetch(`${this.baseUrl}/${publisherId}/members`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({ userId, role }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || `Error adding member: ${response.statusText}`);
        }

        return response.json();
    }

    static async removeMember(publisherId: string, userId: string) {
        const response = await fetch(`${this.baseUrl}/${publisherId}/members/${userId}`, {
            method: 'DELETE',
            credentials: 'include',
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || `Error removing member: ${response.statusText}`);
        }
    }

    static async updateMemberRole(publisherId: string, userId: string, role: string) {
        const response = await fetch(`${this.baseUrl}/${publisherId}/members/${userId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({ role }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || `Error updating member role: ${response.statusText}`);
        }

        return response.json();
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

// Components
const PublisherForm: React.FC<{
    publisher?: Publisher;
    onSubmit: (data: PublisherFormData) => void;
    onCancel: () => void;
    isLoading: boolean;
}> = ({ publisher, onSubmit, onCancel, isLoading }) => {
    const [formData, setFormData] = useState<PublisherFormData>({
        publisherName: publisher?.publisherName || '',
        description: publisher?.description || '',
        tosUrl: publisher?.tosUrl || '',
        privacyUrl: publisher?.privacyUrl || '',
        bannerUrl: publisher?.bannerUrl || '',
        logoUrl: publisher?.logoUrl || '',
        websiteUrl: publisher?.websiteUrl || '',
        discordUrl: publisher?.discordUrl || '',
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(formData);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium mb-2">Nombre del Publisher</label>
                    <Input
                        value={formData.publisherName}
                        onChange={(e) => setFormData({ ...formData, publisherName: e.target.value })}
                        required
                        maxLength={32}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-2">URL del Logo</label>
                    <Input
                        type="url"
                        value={formData.logoUrl}
                        onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
                        required
                    />
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium mb-2">Descripción</label>
                <Input
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    required
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium mb-2">URL de Términos de Servicio</label>
                    <Input
                        type="url"
                        value={formData.tosUrl}
                        onChange={(e) => setFormData({ ...formData, tosUrl: e.target.value })}
                        required
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-2">URL de Política de Privacidad</label>
                    <Input
                        type="url"
                        value={formData.privacyUrl}
                        onChange={(e) => setFormData({ ...formData, privacyUrl: e.target.value })}
                        required
                    />
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium mb-2">URL del Banner</label>
                <Input
                    type="url"
                    value={formData.bannerUrl}
                    onChange={(e) => setFormData({ ...formData, bannerUrl: e.target.value })}
                    required
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium mb-2">URL del Sitio Web (Opcional)</label>
                    <Input
                        type="url"
                        value={formData.websiteUrl}
                        onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-2">URL de Discord (Opcional)</label>
                    <Input
                        type="url"
                        value={formData.discordUrl}
                        onChange={(e) => setFormData({ ...formData, discordUrl: e.target.value })}
                    />
                </div>
            </div>

            <DialogFooter>
                <Button type="button" variant="outline" onClick={onCancel}>
                    Cancelar
                </Button>
                <Button type="submit" disabled={isLoading}>
                    {isLoading && <LucideLoader className="mr-2 h-4 w-4 animate-spin" />}
                    {publisher ? 'Actualizar' : 'Crear'}
                </Button>
            </DialogFooter>
        </form>
    );
};

const PublisherDetails: React.FC<{ 
    publisher: Publisher;
    onEdit: () => void;
    onDelete: () => void;
    onToggleStatus: (field: 'verified' | 'partnered' | 'banned' | 'isHostingPartner', value: boolean) => void;
}> = ({ publisher, onEdit, onDelete, onToggleStatus }) => {
    const [members, setMembers] = useState<PublisherMember[]>([]);
    const [membersLoading, setMembersLoading] = useState(false);

    useEffect(() => {
        loadMembers();
    }, [publisher.id]);

    const loadMembers = async () => {
        setMembersLoading(true);
        try {
            const result = await AdminPublishersAPI.getPublisherMembers(publisher.id);
            setMembers(result.data || []);
        } catch (error) {
            console.error('Error loading members:', error);
        } finally {
            setMembersLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="text-lg font-semibold">{publisher.publisherName}</h3>
                    <p className="text-muted-foreground">{publisher.description}</p>
                    <div className="flex gap-2 mt-2">
                        {publisher.verified && <Badge variant="default">Verificado</Badge>}
                        {publisher.partnered && <Badge variant="secondary">Partner</Badge>}
                        {publisher.banned && <Badge variant="destructive">Baneado</Badge>}
                        {publisher.isHostingPartner && <Badge variant="outline">Hosting Partner</Badge>}
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={onEdit}>
                        <LucideEdit className="h-4 w-4 mr-2" />
                        Editar
                    </Button>
                    <Button variant="destructive" size="sm" onClick={onDelete}>
                        <LucideTrash className="h-4 w-4 mr-2" />
                        Eliminar
                    </Button>
                </div>
            </div>

            <Tabs defaultValue="info" className="w-full">
                <TabsList>
                    <TabsTrigger value="info">Información</TabsTrigger>
                    <TabsTrigger value="members">Miembros ({members.length})</TabsTrigger>
                    <TabsTrigger value="modpacks">Modpacks ({publisher.modpacks?.length || 0})</TabsTrigger>
                    <TabsTrigger value="status">Estado</TabsTrigger>
                </TabsList>

                <TabsContent value="info" className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-medium">ID</label>
                            <p className="text-sm text-muted-foreground">{publisher.id}</p>
                        </div>
                        <div>
                            <label className="text-sm font-medium">Creado</label>
                            <p className="text-sm text-muted-foreground">
                                {new Date(publisher.createdAt).toLocaleDateString('es-ES')}
                            </p>
                        </div>
                        <div>
                            <label className="text-sm font-medium">Sitio Web</label>
                            <p className="text-sm text-muted-foreground">
                                {publisher.websiteUrl ? (
                                    <a href={publisher.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                        {publisher.websiteUrl}
                                    </a>
                                ) : 'No especificado'}
                            </p>
                        </div>
                        <div>
                            <label className="text-sm font-medium">Discord</label>
                            <p className="text-sm text-muted-foreground">
                                {publisher.discordUrl ? (
                                    <a href={publisher.discordUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                        {publisher.discordUrl}
                                    </a>
                                ) : 'No especificado'}
                            </p>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="members">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <LucideUsers className="h-5 w-5" />
                                Miembros del Publisher
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {membersLoading ? (
                                <div className="flex items-center justify-center py-4">
                                    <LucideLoader className="h-6 w-6 animate-spin" />
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Usuario</TableHead>
                                            <TableHead>Rol</TableHead>
                                            <TableHead>Unido</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {members.map((member) => (
                                            <TableRow key={member.id}>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        {member.user?.avatarUrl && (
                                                            <img 
                                                                src={member.user.avatarUrl} 
                                                                alt={member.user.username}
                                                                className="w-6 h-6 rounded-full"
                                                            />
                                                        )}
                                                        <div>
                                                            <p className="font-medium">{member.user?.username}</p>
                                                            <p className="text-sm text-muted-foreground">{member.user?.email}</p>
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
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="modpacks">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <LucidePackage className="h-5 w-5" />
                                Modpacks
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-muted-foreground">
                                {publisher.modpacks?.length || 0} modpacks asociados
                            </p>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="status">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <LucideShield className="h-5 w-5" />
                                Estado del Publisher
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-medium">Verificado</p>
                                    <p className="text-sm text-muted-foreground">Publisher verificado oficialmente</p>
                                </div>
                                <Button
                                    variant={publisher.verified ? "destructive" : "default"}
                                    size="sm"
                                    onClick={() => onToggleStatus('verified', !publisher.verified)}
                                >
                                    {publisher.verified ? <LucideX className="h-4 w-4 mr-2" /> : <LucideCheck className="h-4 w-4 mr-2" />}
                                    {publisher.verified ? 'Desverificar' : 'Verificar'}
                                </Button>
                            </div>

                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-medium">Partner</p>
                                    <p className="text-sm text-muted-foreground">Publisher partner oficial</p>
                                </div>
                                <Button
                                    variant={publisher.partnered ? "destructive" : "default"}
                                    size="sm"
                                    onClick={() => onToggleStatus('partnered', !publisher.partnered)}
                                >
                                    {publisher.partnered ? <LucideX className="h-4 w-4 mr-2" /> : <LucideCheck className="h-4 w-4 mr-2" />}
                                    {publisher.partnered ? 'Quitar Partner' : 'Hacer Partner'}
                                </Button>
                            </div>

                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-medium">Baneado</p>
                                    <p className="text-sm text-muted-foreground">Publisher suspendido</p>
                                </div>
                                <Button
                                    variant={publisher.banned ? "default" : "destructive"}
                                    size="sm"
                                    onClick={() => onToggleStatus('banned', !publisher.banned)}
                                >
                                    {publisher.banned ? <LucideCheck className="h-4 w-4 mr-2" /> : <LucideX className="h-4 w-4 mr-2" />}
                                    {publisher.banned ? 'Desbanear' : 'Banear'}
                                </Button>
                            </div>

                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-medium">Hosting Partner</p>
                                    <p className="text-sm text-muted-foreground">Publisher con servicios de hosting</p>
                                </div>
                                <Button
                                    variant={publisher.isHostingPartner ? "destructive" : "default"}
                                    size="sm"
                                    onClick={() => onToggleStatus('isHostingPartner', !publisher.isHostingPartner)}
                                >
                                    {publisher.isHostingPartner ? <LucideX className="h-4 w-4 mr-2" /> : <LucideCheck className="h-4 w-4 mr-2" />}
                                    {publisher.isHostingPartner ? 'Quitar Hosting' : 'Hacer Hosting Partner'}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
};

export const ManagePublishersView: React.FC = () => {
    const { session } = useAuthentication();
    const { toast } = useToast();

    // State
    const [publishers, setPublishers] = useState<Publisher[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedPublisher, setSelectedPublisher] = useState<Publisher | null>(null);
    
    // Dialog states
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [showEditDialog, setShowEditDialog] = useState(false);
    const [showDetailsDialog, setShowDetailsDialog] = useState(false);
    const [operationLoading, setOperationLoading] = useState(false);

    // Filter states
    const [search, setSearch] = useState('');
    const [verifiedFilter, setVerifiedFilter] = useState<string>('all');
    const [partneredFilter, setPartneredFilter] = useState<string>('all');

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const limit = 10;

    useEffect(() => {
        loadPublishers();
    }, [currentPage, search, verifiedFilter, partneredFilter]);

    const loadPublishers = async () => {
        setLoading(true);
        setError(null);
        try {
            const options: any = {
                page: currentPage,
                limit,
                sortBy: 'createdAt',
                sortOrder: 'DESC'
            };

            if (search) options.search = search;
            if (verifiedFilter !== 'all') options.verified = verifiedFilter === 'true';
            if (partneredFilter !== 'all') options.partnered = partneredFilter === 'true';

            const result = await AdminPublishersAPI.getPublishers(options);
            
            setPublishers(result.data || []);
            setTotal(result.meta?.total || 0);
            setTotalPages(result.meta?.totalPages || 1);
        } catch (err: any) {
            setError(err.message);
            toast({
                title: "Error",
                description: "Error al cargar los publishers: " + err.message,
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    const handleCreatePublisher = async (data: PublisherFormData) => {
        setOperationLoading(true);
        try {
            await AdminPublishersAPI.createPublisher(data);
            toast({
                title: "Éxito",
                description: "Publisher creado exitosamente",
            });
            setShowCreateDialog(false);
            loadPublishers();
        } catch (err: any) {
            toast({
                title: "Error",
                description: "Error al crear publisher: " + err.message,
                variant: "destructive",
            });
        } finally {
            setOperationLoading(false);
        }
    };

    const handleEditPublisher = async (data: PublisherFormData) => {
        if (!selectedPublisher) return;
        
        setOperationLoading(true);
        try {
            await AdminPublishersAPI.updatePublisher(selectedPublisher.id, data);
            toast({
                title: "Éxito",
                description: "Publisher actualizado exitosamente",
            });
            setShowEditDialog(false);
            setSelectedPublisher(null);
            loadPublishers();
        } catch (err: any) {
            toast({
                title: "Error",
                description: "Error al actualizar publisher: " + err.message,
                variant: "destructive",
            });
        } finally {
            setOperationLoading(false);
        }
    };

    const handleDeletePublisher = async (publisher: Publisher) => {
        if (!confirm(`¿Estás seguro de que quieres eliminar el publisher "${publisher.publisherName}"?`)) {
            return;
        }

        try {
            await AdminPublishersAPI.deletePublisher(publisher.id);
            toast({
                title: "Éxito",
                description: "Publisher eliminado exitosamente",
            });
            loadPublishers();
        } catch (err: any) {
            toast({
                title: "Error",
                description: "Error al eliminar publisher: " + err.message,
                variant: "destructive",
            });
        }
    };

    const handleToggleStatus = async (publisherId: string, field: 'verified' | 'partnered' | 'banned' | 'isHostingPartner', value: boolean) => {
        try {
            await AdminPublishersAPI.updatePublisher(publisherId, { [field]: value });
            toast({
                title: "Éxito",
                description: "Estado del publisher actualizado exitosamente",
            });
            loadPublishers();
            if (selectedPublisher && selectedPublisher.id === publisherId) {
                const updatedPublisher = { ...selectedPublisher, [field]: value };
                setSelectedPublisher(updatedPublisher);
            }
        } catch (err: any) {
            toast({
                title: "Error",
                description: "Error al actualizar estado: " + err.message,
                variant: "destructive",
            });
        }
    };

    const resetFilters = () => {
        setSearch('');
        setVerifiedFilter('all');
        setPartneredFilter('all');
        setCurrentPage(1);
    };

    // Check if user has admin privileges
    if (!session?.isAdmin?.()) {
        return (
            <Card>
                <CardContent className="p-8 text-center">
                    <LucideShield className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <h2 className="text-xl font-semibold mb-2">Acceso Denegado</h2>
                    <p className="text-muted-foreground">
                        No tienes permisos para acceder a la gestión de publishers.
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold">Gestión de Publishers</h1>
                    <p className="text-muted-foreground">
                        Administrar organizaciones, miembros y configuraciones
                    </p>
                </div>
                <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                    <DialogTrigger asChild>
                        <Button>
                            <LucideBuilding2 className="mr-2 h-4 w-4" />
                            Crear Publisher
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>Crear Nuevo Publisher</DialogTitle>
                        </DialogHeader>
                        <PublisherForm
                            onSubmit={handleCreatePublisher}
                            onCancel={() => setShowCreateDialog(false)}
                            isLoading={operationLoading}
                        />
                    </DialogContent>
                </Dialog>
            </div>

            {/* Filters */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex flex-wrap gap-4 items-center">
                        <div className="flex-1 min-w-[200px]">
                            <Input
                                placeholder="Buscar publishers..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full"
                            />
                        </div>
                        <Select value={verifiedFilter} onValueChange={setVerifiedFilter}>
                            <SelectTrigger className="w-[140px]">
                                <SelectValue placeholder="Verificados" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos</SelectItem>
                                <SelectItem value="true">Verificados</SelectItem>
                                <SelectItem value="false">No Verificados</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={partneredFilter} onValueChange={setPartneredFilter}>
                            <SelectTrigger className="w-[140px]">
                                <SelectValue placeholder="Partners" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos</SelectItem>
                                <SelectItem value="true">Partners</SelectItem>
                                <SelectItem value="false">No Partners</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button variant="outline" onClick={resetFilters}>
                            <LucideRefreshCw className="h-4 w-4 mr-2" />
                            Limpiar
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Results */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <LucideBuilding2 className="h-5 w-5" />
                        Publishers ({total})
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {error && (
                        <Alert variant="destructive" className="mb-4">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <LucideLoader className="h-8 w-8 animate-spin" />
                        </div>
                    ) : (
                        <>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Publisher</TableHead>
                                        <TableHead>Estado</TableHead>
                                        <TableHead>Miembros</TableHead>
                                        <TableHead>Creado</TableHead>
                                        <TableHead>Acciones</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {publishers.map((publisher) => (
                                        <TableRow key={publisher.id}>
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <img 
                                                        src={publisher.logoUrl} 
                                                        alt={publisher.publisherName}
                                                        className="w-8 h-8 rounded"
                                                        onError={(e) => {
                                                            e.currentTarget.src = '/placeholder-logo.png';
                                                        }}
                                                    />
                                                    <div>
                                                        <p className="font-medium">{publisher.publisherName}</p>
                                                        <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                                                            {publisher.description}
                                                        </p>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex gap-1 flex-wrap">
                                                    {publisher.verified && <Badge variant="default" className="text-xs">Verificado</Badge>}
                                                    {publisher.partnered && <Badge variant="secondary" className="text-xs">Partner</Badge>}
                                                    {publisher.banned && <Badge variant="destructive" className="text-xs">Baneado</Badge>}
                                                    {publisher.isHostingPartner && <Badge variant="outline" className="text-xs">Hosting</Badge>}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {publisher.members?.length || 0}
                                            </TableCell>
                                            <TableCell>
                                                {new Date(publisher.createdAt).toLocaleDateString('es-ES')}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex gap-2">
                                                    <Button 
                                                        variant="outline" 
                                                        size="sm"
                                                        onClick={() => {
                                                            setSelectedPublisher(publisher);
                                                            setShowDetailsDialog(true);
                                                        }}
                                                    >
                                                        Ver
                                                    </Button>
                                                    <Button 
                                                        variant="outline" 
                                                        size="sm"
                                                        onClick={() => {
                                                            setSelectedPublisher(publisher);
                                                            setShowEditDialog(true);
                                                        }}
                                                    >
                                                        <LucideEdit className="h-4 w-4" />
                                                    </Button>
                                                    <Button 
                                                        variant="destructive" 
                                                        size="sm"
                                                        onClick={() => handleDeletePublisher(publisher)}
                                                    >
                                                        <LucideTrash className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>

                            {/* Pagination */}
                            {totalPages > 1 && (
                                <div className="flex justify-center items-center gap-2 mt-4">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={currentPage === 1}
                                        onClick={() => setCurrentPage(currentPage - 1)}
                                    >
                                        Anterior
                                    </Button>
                                    <span className="text-sm text-muted-foreground">
                                        Página {currentPage} de {totalPages}
                                    </span>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={currentPage === totalPages}
                                        onClick={() => setCurrentPage(currentPage + 1)}
                                    >
                                        Siguiente
                                    </Button>
                                </div>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Edit Dialog */}
            <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Editar Publisher</DialogTitle>
                    </DialogHeader>
                    {selectedPublisher && (
                        <PublisherForm
                            publisher={selectedPublisher}
                            onSubmit={handleEditPublisher}
                            onCancel={() => {
                                setShowEditDialog(false);
                                setSelectedPublisher(null);
                            }}
                            isLoading={operationLoading}
                        />
                    )}
                </DialogContent>
            </Dialog>

            {/* Details Dialog */}
            <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Detalles del Publisher</DialogTitle>
                    </DialogHeader>
                    {selectedPublisher && (
                        <PublisherDetails
                            publisher={selectedPublisher}
                            onEdit={() => {
                                setShowDetailsDialog(false);
                                setShowEditDialog(true);
                            }}
                            onDelete={() => {
                                setShowDetailsDialog(false);
                                handleDeletePublisher(selectedPublisher);
                            }}
                            onToggleStatus={(field, value) => handleToggleStatus(selectedPublisher.id, field, value)}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
};