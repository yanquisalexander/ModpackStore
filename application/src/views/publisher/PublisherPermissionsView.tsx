import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
    LucideShield,
    LucideLoader,
    LucidePlus,
    LucideEdit,
    LucideTrash2,
    LucideUser,
    LucideUserCheck,
    LucideUserX,
    LucideSettings,
    LucideEye,
    LucideFileEdit,
    LucideGitBranch,
    LucideUpload,
    LucideTags,
    LucideBarChart3
} from 'lucide-react';
import { useAuthentication } from '@/stores/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { API_ENDPOINT } from '@/consts';

// Types
interface Permission {
    [key: string]: boolean;
}

interface PermissionScope {
    id: number;
    publisherId?: string;
    modpackId?: string;
    modpackView: boolean;
    modpackModify: boolean;
    modpackManageVersions: boolean;
    modpackPublish: boolean;
    modpackDelete: boolean;
    modpackManageAccess: boolean;
    publisherManageCategoriesTags: boolean;
    publisherViewStats: boolean;
    createdAt: string;
    updatedAt: string;
}

interface PublisherMember {
    id: number;
    role: 'owner' | 'admin' | 'member';
    createdAt: string;
    user: {
        id: string;
        username: string;
        email: string;
        avatarUrl?: string;
    };
    scopes: PermissionScope[];
}

interface Modpack {
    id: string;
    name: string;
    slug: string;
    iconUrl?: string;
}

// API Service for permissions management
class PermissionsAPI {
    private static baseUrl = `${API_ENDPOINT}/v1/creators`;

    static async getMembers(publisherId: string, accessToken: string): Promise<{ members: PublisherMember[] }> {
        const response = await fetch(`${this.baseUrl}/publishers/${publisherId}/members`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `Error fetching members: ${response.statusText}`);
        }

        return await response.json();
    }

    static async assignPermissions(
        publisherId: string,
        userId: string,
        permissions: Permission,
        modpackId?: string,
        accessToken: string = ''
    ): Promise<void> {
        const response = await fetch(`${this.baseUrl}/publishers/${publisherId}/permissions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                userId,
                permissions,
                modpackId
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `Error assigning permissions: ${response.statusText}`);
        }
    }

    static async removePermissionScope(
        publisherId: string,
        scopeId: number,
        accessToken: string
    ): Promise<void> {
        const response = await fetch(`${this.baseUrl}/publishers/${publisherId}/permissions/${scopeId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `Error removing permissions: ${response.statusText}`);
        }
    }

    static async getModpacks(publisherId: string, accessToken: string): Promise<{ modpacks: Modpack[] }> {
        const response = await fetch(`${this.baseUrl}/publishers/${publisherId}/modpacks`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `Error fetching modpacks: ${response.statusText}`);
        }

        return await response.json();
    }

    static async updateMemberRole(
        publisherId: string,
        memberId: string,
        userId: string,
        role: string,
        accessToken: string
    ): Promise<void> {
        const response = await fetch(`${this.baseUrl}/publishers/${publisherId}/members/${memberId}/role`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ userId, role }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `Error updating role: ${response.statusText}`);
        }
    }
}

// Permission configuration
const MODPACK_PERMISSIONS = [
    { key: 'modpackView', label: 'Ver Modpack', icon: LucideEye, description: 'Permite ver el modpack' },
    { key: 'modpackModify', label: 'Modificar Modpack', icon: LucideFileEdit, description: 'Permite modificar el modpack' },
    { key: 'modpackManageVersions', label: 'Gestionar Versiones', icon: LucideGitBranch, description: 'Permite agregar, eliminar y gestionar versiones' },
    { key: 'modpackPublish', label: 'Publicar', icon: LucideUpload, description: 'Permite cambiar el estado de borrador a publicado' },
    { key: 'modpackDelete', label: 'Eliminar', icon: LucideTrash2, description: 'Permite eliminar el modpack' },
    { key: 'modpackManageAccess', label: 'Gestionar Acceso', icon: LucideShield, description: 'Permite gestionar permisos de otros miembros' },
];

const PUBLISHER_PERMISSIONS = [
    { key: 'publisherManageCategoriesTags', label: 'Gestionar Categorías y Etiquetas', icon: LucideTags, description: 'Permite administrar categorías y etiquetas del publisher' },
    { key: 'publisherViewStats', label: 'Ver Estadísticas', icon: LucideBarChart3, description: 'Permite ver estadísticas de descargas y ventas' },
];

// Role configuration
const ROLES = [
    { value: 'owner', label: 'Propietario', color: 'bg-red-500', description: 'Acceso total e inmutable' },
    { value: 'admin', label: 'Administrador', color: 'bg-orange-500', description: 'Acceso total modificable por el propietario' },
    { value: 'member', label: 'Miembro', color: 'bg-blue-500', description: 'Permisos limitados y configurables' },
];

export const PublisherPermissionsView: React.FC = () => {
    const { publisherId } = useParams<{ publisherId: string }>();
    const { accessToken, user } = useAuthentication();
    const { toast } = useToast();
    
    const [members, setMembers] = useState<PublisherMember[]>([]);
    const [modpacks, setModpacks] = useState<Modpack[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    // Dialog states
    const [showPermissionDialog, setShowPermissionDialog] = useState(false);
    const [selectedMember, setSelectedMember] = useState<PublisherMember | null>(null);
    const [selectedModpack, setSelectedModpack] = useState<string>('');
    const [permissions, setPermissions] = useState<Permission>({});
    const [scopeType, setScopeType] = useState<'publisher' | 'modpack'>('publisher');

    useEffect(() => {
        if (publisherId && accessToken) {
            loadData();
        }
    }, [publisherId, accessToken]);

    const loadData = async () => {
        try {
            setLoading(true);
            setError(null);
            
            const [membersData, modpacksData] = await Promise.all([
                PermissionsAPI.getMembers(publisherId!, accessToken!),
                PermissionsAPI.getModpacks(publisherId!, accessToken!)
            ]);
            
            setMembers(membersData.members);
            setModpacks(modpacksData.modpacks);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error loading data');
            toast({
                title: "Error",
                description: "No se pudieron cargar los datos",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    const handleAssignPermissions = async () => {
        if (!selectedMember || !publisherId || !accessToken) return;

        try {
            await PermissionsAPI.assignPermissions(
                publisherId,
                selectedMember.user.id,
                permissions,
                scopeType === 'modpack' ? selectedModpack : undefined,
                accessToken
            );

            toast({
                title: "Éxito",
                description: "Permisos asignados correctamente",
            });

            setShowPermissionDialog(false);
            loadData();
        } catch (err) {
            toast({
                title: "Error",
                description: err instanceof Error ? err.message : "Error asignando permisos",
                variant: "destructive",
            });
        }
    };

    const handleRemoveScope = async (scopeId: number) => {
        if (!publisherId || !accessToken) return;

        try {
            await PermissionsAPI.removePermissionScope(publisherId, scopeId, accessToken);
            
            toast({
                title: "Éxito",
                description: "Permiso removido correctamente",
            });

            loadData();
        } catch (err) {
            toast({
                title: "Error",
                description: err instanceof Error ? err.message : "Error removiendo permiso",
                variant: "destructive",
            });
        }
    };

    const handleRoleChange = async (member: PublisherMember, newRole: string) => {
        if (!publisherId || !accessToken) return;

        try {
            await PermissionsAPI.updateMemberRole(
                publisherId,
                member.id.toString(),
                member.user.id,
                newRole,
                accessToken
            );

            toast({
                title: "Éxito",
                description: "Rol actualizado correctamente",
            });

            loadData();
        } catch (err) {
            toast({
                title: "Error",
                description: err instanceof Error ? err.message : "Error actualizando rol",
                variant: "destructive",
            });
        }
    };

    const openPermissionDialog = (member: PublisherMember) => {
        setSelectedMember(member);
        setPermissions({});
        setScopeType('publisher');
        setSelectedModpack('');
        setShowPermissionDialog(true);
    };

    const getRoleConfig = (role: string) => ROLES.find(r => r.value === role) || ROLES[2];

    const formatScopeDescription = (scope: PermissionScope) => {
        const activePermissions = [];
        
        if (scope.modpackView) activePermissions.push('Ver');
        if (scope.modpackModify) activePermissions.push('Modificar');
        if (scope.modpackManageVersions) activePermissions.push('Gestionar Versiones');
        if (scope.modpackPublish) activePermissions.push('Publicar');
        if (scope.modpackDelete) activePermissions.push('Eliminar');
        if (scope.modpackManageAccess) activePermissions.push('Gestionar Acceso');
        if (scope.publisherManageCategoriesTags) activePermissions.push('Gestionar Categorías');
        if (scope.publisherViewStats) activePermissions.push('Ver Estadísticas');
        
        return activePermissions.join(', ') || 'Sin permisos activos';
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <LucideLoader className="w-8 h-8 animate-spin" />
                <span className="ml-2">Cargando permisos...</span>
            </div>
        );
    }

    if (error) {
        return (
            <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
            </Alert>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold">Gestión de Permisos</h2>
                    <p className="text-muted-foreground">
                        Administra roles y permisos granulares para los miembros del equipo
                    </p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <LucideShield className="w-5 h-5" />
                        Miembros y Permisos
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Usuario</TableHead>
                                <TableHead>Rol</TableHead>
                                <TableHead>Permisos Activos</TableHead>
                                <TableHead>Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {members.map((member) => {
                                const roleConfig = getRoleConfig(member.role);
                                
                                return (
                                    <TableRow key={member.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                                                    {member.user.avatarUrl ? (
                                                        <img 
                                                            src={member.user.avatarUrl} 
                                                            alt={member.user.username}
                                                            className="w-8 h-8 rounded-full object-cover"
                                                        />
                                                    ) : (
                                                        <LucideUser className="w-4 h-4" />
                                                    )}
                                                </div>
                                                <div>
                                                    <div className="font-medium">{member.user.username}</div>
                                                    <div className="text-sm text-muted-foreground">{member.user.email}</div>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge className={`${roleConfig.color} text-white`}>
                                                {roleConfig.label}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="space-y-1 max-w-md">
                                                {member.role === 'owner' ? (
                                                    <Badge variant="outline" className="text-xs">
                                                        Todos los permisos (Inmutable)
                                                    </Badge>
                                                ) : member.role === 'admin' ? (
                                                    <Badge variant="outline" className="text-xs">
                                                        Todos los permisos (Administrador)
                                                    </Badge>
                                                ) : member.scopes.length > 0 ? (
                                                    member.scopes.map((scope) => (
                                                        <div key={scope.id} className="flex items-center gap-2">
                                                            <Badge variant="secondary" className="text-xs">
                                                                {scope.modpackId ? 'Modpack' : 'Publisher'}: {formatScopeDescription(scope)}
                                                            </Badge>
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={() => handleRemoveScope(scope.id)}
                                                                className="h-6 w-6 p-0"
                                                            >
                                                                <LucideX className="w-3 h-3" />
                                                            </Button>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <Badge variant="outline" className="text-xs">
                                                        Sin permisos específicos
                                                    </Badge>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                {member.role === 'member' && (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => openPermissionDialog(member)}
                                                    >
                                                        <LucidePlus className="w-4 h-4 mr-1" />
                                                        Permisos
                                                    </Button>
                                                )}
                                                
                                                {member.role !== 'owner' && (
                                                    <Select
                                                        value={member.role}
                                                        onValueChange={(value) => handleRoleChange(member, value)}
                                                    >
                                                        <SelectTrigger className="w-32">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="admin">Admin</SelectItem>
                                                            <SelectItem value="member">Miembro</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Permission Assignment Dialog */}
            <Dialog open={showPermissionDialog} onOpenChange={setShowPermissionDialog}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>
                            Asignar Permisos a {selectedMember?.user.username}
                        </DialogTitle>
                    </DialogHeader>
                    
                    <div className="space-y-6">
                        {/* Scope Type Selection */}
                        <div>
                            <Label>Tipo de Permiso</Label>
                            <Select value={scopeType} onValueChange={(value: 'publisher' | 'modpack') => setScopeType(value)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="publisher">Permisos de Publisher</SelectItem>
                                    <SelectItem value="modpack">Permisos de Modpack Específico</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Modpack Selection */}
                        {scopeType === 'modpack' && (
                            <div>
                                <Label>Seleccionar Modpack</Label>
                                <Select value={selectedModpack} onValueChange={setSelectedModpack}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecciona un modpack" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {modpacks.map((modpack) => (
                                            <SelectItem key={modpack.id} value={modpack.id}>
                                                {modpack.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {/* Permission Selection */}
                        <div className="space-y-4">
                            {scopeType === 'modpack' ? (
                                <>
                                    <h4 className="font-medium">Permisos de Modpack</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        {MODPACK_PERMISSIONS.map((permission) => (
                                            <div key={permission.key} className="flex items-start space-x-2">
                                                <Checkbox
                                                    id={permission.key}
                                                    checked={permissions[permission.key] || false}
                                                    onCheckedChange={(checked) => 
                                                        setPermissions(prev => ({
                                                            ...prev,
                                                            [permission.key]: checked
                                                        }))
                                                    }
                                                />
                                                <div className="grid gap-1.5 leading-none">
                                                    <label
                                                        htmlFor={permission.key}
                                                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-2"
                                                    >
                                                        <permission.icon className="w-4 h-4" />
                                                        {permission.label}
                                                    </label>
                                                    <p className="text-xs text-muted-foreground">
                                                        {permission.description}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            ) : (
                                <>
                                    <h4 className="font-medium">Permisos de Publisher</h4>
                                    <div className="space-y-4">
                                        {PUBLISHER_PERMISSIONS.map((permission) => (
                                            <div key={permission.key} className="flex items-start space-x-2">
                                                <Checkbox
                                                    id={permission.key}
                                                    checked={permissions[permission.key] || false}
                                                    onCheckedChange={(checked) => 
                                                        setPermissions(prev => ({
                                                            ...prev,
                                                            [permission.key]: checked
                                                        }))
                                                    }
                                                />
                                                <div className="grid gap-1.5 leading-none">
                                                    <label
                                                        htmlFor={permission.key}
                                                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-2"
                                                    >
                                                        <permission.icon className="w-4 h-4" />
                                                        {permission.label}
                                                    </label>
                                                    <p className="text-xs text-muted-foreground">
                                                        {permission.description}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setShowPermissionDialog(false)}>
                                Cancelar
                            </Button>
                            <Button onClick={handleAssignPermissions}>
                                Asignar Permisos
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};