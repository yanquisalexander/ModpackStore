import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
    LucideLoader,
    LucideSettings,
    LucideShield,
    LucideInfo,
    LucidePackage,
    LucideUsers,
    LucideEye,
    LucideEdit,
    LucideTrash2,
    LucideUpload,
    LucideBarChart3,
    LucideTags
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
    CreatorPermissionsAPI,
    CreatorMember,
    PermissionScope,
    MODPACK_PERMISSIONS,
    CREATOR_PERMISSIONS,
    ALL_PERMISSIONS
} from '@/services/creatorPermissions.service';
import { API_ENDPOINT } from '@/consts';

interface MemberPermissionsDialogProps {
    member: CreatorMember | null;
    creatorId: string;
    accessToken: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onPermissionsChanged: () => void;
    currentUserRole: 'owner' | 'admin' | 'member';
}

interface ModpackInfo {
    id: string;
    name: string;
    slug: string;
    iconUrl?: string;
    status: string;
}

const PermissionIcon: React.FC<{ permission: string }> = ({ permission }) => {
    const iconMap: Record<string, React.ReactNode> = {
        'modpack.view': <LucideEye className="h-4 w-4" />,
        'modpack.modify': <LucideEdit className="h-4 w-4" />,
        'modpack.manage_versions': <LucidePackage className="h-4 w-4" />,
        'modpack.publish': <LucideUpload className="h-4 w-4" />,
        'modpack.delete': <LucideTrash2 className="h-4 w-4" />,
        'modpack.manage_access': <LucideUsers className="h-4 w-4" />,
        'publisher.manage_categories_tags': <LucideTags className="h-4 w-4" />,
        'publisher.view_stats': <LucideBarChart3 className="h-4 w-4" />,
    };
    return iconMap[permission] || <LucideShield className="h-4 w-4" />;
};

export const MemberPermissionsDialog: React.FC<MemberPermissionsDialogProps> = ({
    member,
    creatorId,
    accessToken,
    open,
    onOpenChange,
    onPermissionsChanged,
    currentUserRole
}) => {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [permissions, setPermissions] = useState<PermissionScope[]>([]);
    const [modifyingPermissions, setModifyingPermissions] = useState<Set<string>>(new Set());
    const [modpacks, setModpacks] = useState<ModpackInfo[]>([]);
    const [loadingModpacks, setLoadingModpacks] = useState(false);

    const canManagePermissions = (targetMemberRole: string): boolean => {
        if (currentUserRole === 'member') return false;
        if (currentUserRole === 'owner') return true;
        if (currentUserRole === 'admin') return targetMemberRole === 'member';
        return false;
    };

    const canAccessDialog = (): boolean => {
        if (!member) return false;
        return canManagePermissions(member.role);
    };

    useEffect(() => {
        if (open && member) {
            loadPermissions();
            loadModpacks();
        }
    }, [open, member]);

    const loadPermissions = async () => {
        if (!member) return;

        try {
            setLoading(true);
            const scopes = await CreatorPermissionsAPI.getMemberPermissions(
                creatorId,
                member.userId,
                accessToken
            );
            setPermissions(scopes);
        } catch (error) {
            console.error('[ERROR] Failed to load permissions:', error);
            toast({
                title: "Error",
                description: `Error al cargar permisos: ${error instanceof Error ? error.message : 'Error desconocido'}`,
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    const loadModpacks = async () => {
        if (!creatorId) return;

        try {
            setLoadingModpacks(true);
            const response = await fetch(`${API_ENDPOINT}/creators/${creatorId}/modpacks`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            });

            if (response.ok) {
                const data = await response.json();
                const items = (Array.isArray(data) ? data : data.data || data.modpacks || []).map((m: any) => ({
                    id: m.id,
                    name: m.name,
                    slug: m.slug,
                    iconUrl: m.iconUrl,
                    status: m.status
                }));
                setModpacks(items);
            }
        } catch (error) {
            console.error('Error loading modpacks:', error);
        } finally {
            setLoadingModpacks(false);
        }
    };

    const handlePermissionToggle = async (permission: string, enabled: boolean, modpackId?: string) => {
        if (!member) return;

        if (!canManagePermissions(member.role)) {
            toast({
                title: "Acceso denegado",
                description: `No tienes permisos para modificar los permisos de un ${CreatorPermissionsAPI.getRoleDisplayName(member.role)}`,
                variant: "destructive",
            });
            return;
        }

        const permissionKey = modpackId ? `${permission}-${modpackId}` : permission;
        setModifyingPermissions(prev => new Set(prev).add(permissionKey));

        try {
            await CreatorPermissionsAPI.assignPermission(
                creatorId,
                member.userId,
                permission,
                enabled,
                accessToken,
                modpackId
            );

            toast({
                title: "Éxito",
                description: `Permiso ${enabled ? 'otorgado' : 'revocado'} correctamente`,
            });

            await loadPermissions();
            onPermissionsChanged();
        } catch (error) {
            toast({
                title: "Error",
                description: `Error al modificar permiso: ${error instanceof Error ? error.message : 'Error desconocido'}`,
                variant: "destructive",
            });
        } finally {
            setModifyingPermissions(prev => {
                const newSet = new Set(prev);
                newSet.delete(permissionKey);
                return newSet;
            });
        }
    };

    const hasPermission = (permission: string, modpackId?: string): boolean => {
        if (!member) return false;

        if (member.role === 'owner' || member.role === 'admin') return true;

        const relevantScope = modpackId
            ? permissions.find(s => s.modpackId === modpackId)
            : permissions.find(s => s.creatorId && !s.modpackId);

        if (!relevantScope || !relevantScope.permissions) return false;

        const permissionMap: Record<string, keyof PermissionScope['permissions']> = {
            'modpack.view': 'modpackView',
            'modpack.modify': 'modpackModify',
            'modpack.manage_versions': 'modpackManageVersions',
            'modpack.publish': 'modpackPublish',
            'modpack.delete': 'modpackDelete',
            'modpack.manage_access': 'modpackManageAccess',
            'publisher.manage_categories_tags': 'publisherManageCategoriesTags',
            'publisher.view_stats': 'publisherViewStats',
        };

        const field = permissionMap[permission];
        return field ? relevantScope.permissions[field] === true : false;
    };

    const renderPermissionSwitch = (permission: typeof ALL_PERMISSIONS[number], modpackId?: string) => {
        if (!member) return null;

        if (member.role === 'owner' || member.role === 'admin') {
            return (
                <div className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-3">
                        <PermissionIcon permission={permission.key} />
                        <div>
                            <Label className="text-sm font-medium">{permission.label}</Label>
                            <p className="text-xs text-muted-foreground">{permission.description}</p>
                        </div>
                    </div>
                    <Badge variant="outline" className="text-xs">
                        Siempre habilitado
                    </Badge>
                </div>
            );
        }

        const permissionKey = modpackId ? `${permission.key}-${modpackId}` : permission.key;
        const isEnabled = hasPermission(permission.key, modpackId);
        const isModifying = modifyingPermissions.has(permissionKey);

        return (
            <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                    <PermissionIcon permission={permission.key} />
                    <div>
                        <Label className="text-sm font-medium">{permission.label}</Label>
                        <p className="text-xs text-muted-foreground">{permission.description}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {isModifying && <LucideLoader className="h-4 w-4 animate-spin" />}
                    <Switch
                        checked={isEnabled}
                        onCheckedChange={(checked) => handlePermissionToggle(permission.key, checked, modpackId)}
                        disabled={isModifying}
                    />
                </div>
            </div>
        );
    };

    if (!member) return null;

    if (!canAccessDialog()) {
        return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <LucideShield className="h-5 w-5" />
                            Acceso Denegado
                        </DialogTitle>
                    </DialogHeader>
                    <Alert>
                        <LucideInfo className="h-4 w-4" />
                        <AlertDescription>
                            No tienes permisos para gestionar los permisos de {member.username}
                            ({CreatorPermissionsAPI.getRoleDisplayName(member.role)}).
                            {currentUserRole === 'member' && ' Los miembros no pueden gestionar permisos.'}
                            {currentUserRole === 'admin' && member.role !== 'member' && ' Los administradores solo pueden gestionar permisos de miembros.'}
                        </AlertDescription>
                    </Alert>
                    <div className="flex justify-end">
                        <Button variant="outline" onClick={() => onOpenChange(false)}>
                            Cerrar
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <LucideSettings className="h-5 w-5" />
                        Gestionar permisos de {member.username}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    <Card>
                        <CardContent className="pt-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    {member.avatarUrl && (
                                        <img
                                            src={member.avatarUrl}
                                            alt={member.username}
                                            className="h-10 w-10 rounded-full"
                                        />
                                    )}
                                    <div>
                                        <p className="font-medium">{member.username}</p>
                                        <p className="text-sm text-muted-foreground">{member.email}</p>
                                    </div>
                                </div>
                                <Badge variant={CreatorPermissionsAPI.getRoleBadgeVariant(member.role)}>
                                    {CreatorPermissionsAPI.getRoleDisplayName(member.role)}
                                </Badge>
                            </div>
                        </CardContent>
                    </Card>

                    {member.role === 'member' ? (
                        <Tabs defaultValue="creator" className="w-full">
                            <TabsList className="grid w-full grid-cols-3">
                                <TabsTrigger value="creator">Creator</TabsTrigger>
                                <TabsTrigger value="modpacks-general">Modpacks Generales</TabsTrigger>
                                <TabsTrigger value="modpacks-specific">Modpacks Específicos</TabsTrigger>
                            </TabsList>

                            <TabsContent value="creator" className="space-y-4">
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-base">Permisos a nivel Creator</CardTitle>
                                        <p className="text-sm text-muted-foreground">
                                            Estos permisos se aplican a todo el creator
                                        </p>
                                    </CardHeader>
                                    <CardContent className="space-y-1">
                                        {loading ? (
                                            <div className="flex items-center justify-center py-4">
                                                <LucideLoader className="h-6 w-6 animate-spin" />
                                            </div>
                                        ) : (
                                            CREATOR_PERMISSIONS.map((permission) => (
                                                <div key={permission.key}>
                                                    {renderPermissionSwitch(permission)}
                                                    <Separator className="my-2" />
                                                </div>
                                            ))
                                        )}
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            <TabsContent value="modpacks-general" className="space-y-4">
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-base">Permisos generales de Modpacks</CardTitle>
                                        <p className="text-sm text-muted-foreground">
                                            Estos permisos se aplican a todos los modpacks del creator
                                        </p>
                                    </CardHeader>
                                    <CardContent className="space-y-1">
                                        {loading ? (
                                            <div className="flex items-center justify-center py-4">
                                                <LucideLoader className="h-6 w-6 animate-spin" />
                                            </div>
                                        ) : (
                                            MODPACK_PERMISSIONS.map((permission) => (
                                                <div key={permission.key}>
                                                    {renderPermissionSwitch(permission)}
                                                    <Separator className="my-2" />
                                                </div>
                                            ))
                                        )}
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            <TabsContent value="modpacks-specific" className="space-y-4">
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-base">Permisos específicos por Modpack</CardTitle>
                                        <p className="text-sm text-muted-foreground">
                                            Configura permisos individuales para cada modpack
                                        </p>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        {loadingModpacks ? (
                                            <div className="flex items-center justify-center py-4">
                                                <LucideLoader className="h-6 w-6 animate-spin" />
                                            </div>
                                        ) : modpacks.length === 0 ? (
                                            <div className="text-center py-4 text-muted-foreground">
                                                No hay modpacks disponibles
                                            </div>
                                        ) : (
                                            modpacks.map((modpack) => (
                                                <div key={modpack.id} className="border rounded-lg p-4 space-y-3">
                                                    <div className="flex items-center gap-3">
                                                        {modpack.iconUrl && (
                                                            <img
                                                                src={modpack.iconUrl}
                                                                alt={modpack.name}
                                                                className="h-8 w-8 rounded"
                                                            />
                                                        )}
                                                        <div>
                                                            <h4 className="font-medium">{modpack.name}</h4>
                                                            <p className="text-sm text-muted-foreground">/{modpack.slug}</p>
                                                        </div>
                                                        <Badge variant="outline" className="ml-auto">
                                                            {modpack.status}
                                                        </Badge>
                                                    </div>

                                                    <div className="space-y-2 pl-11">
                                                        {MODPACK_PERMISSIONS.map((permission) => (
                                                            <div key={`${permission.key}-${modpack.id}`}>
                                                                {renderPermissionSwitch(permission, modpack.id)}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </CardContent>
                                </Card>

                                <Alert>
                                    <LucideInfo className="h-4 w-4" />
                                    <AlertDescription>
                                        Los permisos específicos por modpack tienen prioridad sobre los permisos generales.
                                    </AlertDescription>
                                </Alert>
                            </TabsContent>
                        </Tabs>
                    ) : (
                        <Alert>
                            <LucideInfo className="h-4 w-4" />
                            <AlertDescription className="block">
                                Los usuarios con rol de <strong>{CreatorPermissionsAPI.getRoleDisplayName(member.role)}</strong> tienen
                                acceso completo y no requieren configuración de permisos individuales.
                            </AlertDescription>
                        </Alert>
                    )}

                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => onOpenChange(false)}>
                            Cerrar
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};
