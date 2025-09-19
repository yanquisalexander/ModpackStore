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
    PublisherPermissionsAPI,
    PublisherMemberWithPermissions,
    PermissionScope,
    MODPACK_PERMISSIONS,
    PUBLISHER_PERMISSIONS,
    ALL_PERMISSIONS
} from '@/services/publisherPermissions.service';
import { API_ENDPOINT } from '@/consts';

interface MemberPermissionsDialogProps {
    member: PublisherMemberWithPermissions | null;
    publisherId: string;
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
    publisherId,
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
    const [publisherModpacks, setPublisherModpacks] = useState<ModpackInfo[]>([]);
    const [loadingModpacks, setLoadingModpacks] = useState(false);

    // Role validation functions
    const canManagePermissions = (targetMemberRole: string): boolean => {
        // Members cannot manage any permissions
        if (currentUserRole === 'member') return false;
        
        // Owners can manage all permissions
        if (currentUserRole === 'owner') return true;
        
        // Admins can only manage member permissions
        if (currentUserRole === 'admin') {
            return targetMemberRole === 'member';
        }
        
        return false;
    };

    const canAccessDialog = (): boolean => {
        if (!member) return false;
        return canManagePermissions(member.role);
    };

    useEffect(() => {
        if (open && member) {
            loadPermissions();
            loadPublisherModpacks();
        }
    }, [open, member]);

    const loadPermissions = async () => {
        if (!member) return;

        try {
            setLoading(true);
            const memberPermissions = await PublisherPermissionsAPI.getMemberPermissions(
                publisherId,
                member.userId,
                accessToken
            );
            console.log('[DEBUG] Loaded permissions from API:', memberPermissions);
            console.log('[DEBUG] Member scopes from props:', member.scopes);

            // Process permissions without overriding existing values
            const processedPermissions = memberPermissions.map(scope => {
                // Make sure we preserve the actual permission values from the API
                const existingPermissions = scope.permissions || {};
                console.log('[DEBUG] Processing scope:', scope.id, 'permissions:', existingPermissions);
                
                return {
                    ...scope,
                    permissions: {
                        modpackView: existingPermissions.modpackView === true,
                        modpackModify: existingPermissions.modpackModify === true,
                        modpackManageVersions: existingPermissions.modpackManageVersions === true,
                        modpackPublish: existingPermissions.modpackPublish === true,
                        modpackDelete: existingPermissions.modpackDelete === true,
                        modpackManageAccess: existingPermissions.modpackManageAccess === true,
                        publisherManageCategoriesTags: existingPermissions.publisherManageCategoriesTags === true,
                        publisherViewStats: existingPermissions.publisherViewStats === true,
                    }
                };
            });
            
            console.log('[DEBUG] Final processed permissions:', processedPermissions);
            setPermissions(processedPermissions);
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

    const loadPublisherModpacks = async () => {
        if (!publisherId) return;

        try {
            setLoadingModpacks(true);
            const response = await fetch(`${API_ENDPOINT}/creators/publishers/${publisherId}/modpacks`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            });

            if (response.ok) {
                const data = await response.json();
                // Assuming the API returns modpacks in data array
                const modpacks = (data.data || data.modpacks || []).map((modpack: any) => ({
                    id: modpack.id,
                    name: modpack.name,
                    slug: modpack.slug,
                    iconUrl: modpack.iconUrl,
                    status: modpack.status
                }));
                setPublisherModpacks(modpacks);
            }
        } catch (error) {
            console.error('Error loading publisher modpacks:', error);
        } finally {
            setLoadingModpacks(false);
        }
    };

    const handlePermissionToggle = async (permission: string, enabled: boolean, modpackId?: string) => {
        if (!member) return;

        // Validate that current user can manage this member's permissions
        if (!canManagePermissions(member.role)) {
            toast({
                title: "Acceso denegado",
                description: `No tienes permisos para modificar los permisos de un ${PublisherPermissionsAPI.getRoleDisplayName(member.role)}`,
                variant: "destructive",
            });
            return;
        }

        const permissionKey = modpackId ? `${permission}-${modpackId}` : permission;
        setModifyingPermissions(prev => new Set(prev).add(permissionKey));

        try {
            await PublisherPermissionsAPI.assignPermission(
                publisherId,
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

            // Reload permissions and notify parent
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

        console.log(`[DEBUG] hasPermission called:`, { permission, modpackId, memberRole: member.role });

        // Owners and admins have all permissions
        if (member.role === 'owner' || member.role === 'admin') {
            console.log(`[DEBUG] User is ${member.role}, granting permission`);
            return true;
        }

        // Use the loaded permissions state, or fall back to member.scopes
        const scopesToCheck = permissions.length > 0 ? permissions : member.scopes;
        console.log(`[DEBUG] Using ${permissions.length > 0 ? 'loaded permissions' : 'member.scopes'}, count:`, scopesToCheck.length);

        // Find the relevant scope
        const relevantScope = modpackId
            ? scopesToCheck.find((scope: any) => {
                const scopeModpackId = scope.modpackId || scope.modpack?.id;
                const isMatch = scopeModpackId === modpackId;
                console.log(`[DEBUG] Checking modpack scope:`, { scopeModpackId, modpackId, isMatch });
                return isMatch;
            })
            : scopesToCheck.find((scope: any) => {
                const scopePublisherId = scope.publisherId || scope.publisher?.id;
                const hasPublisherId = !!scopePublisherId;
                const hasNoModpackId = !scope.modpackId && !scope.modpack?.id;
                const isPublisherScope = hasPublisherId && hasNoModpackId;
                console.log(`[DEBUG] Checking publisher scope:`, {
                    scopePublisherId,
                    hasPublisherId,
                    hasNoModpackId,
                    isPublisherScope
                });
                return isPublisherScope;
            });

        if (!relevantScope) {
            console.log(`[DEBUG] No relevant scope found for permission ${permission}`);
            return false;
        }

        if (!relevantScope.permissions) {
            console.log(`[DEBUG] Relevant scope found but no permissions object:`, relevantScope);
            return false;
        }

        // Map permission keys to permission object fields
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

        const permissionField = permissionMap[permission];
        if (!permissionField) {
            console.log(`[DEBUG] Unknown permission key: ${permission}`);
            return false;
        }

        const result = relevantScope.permissions[permissionField] === true;

        console.log(`[DEBUG] hasPermission(${permission}, ${modpackId}) result:`, {
            role: member.role,
            usingLoadedPermissions: permissions.length > 0,
            scopeId: relevantScope.id,
            permissionField,
            permissionValue: relevantScope.permissions[permissionField],
            result
        });

        return result;
    };

    const renderPermissionSwitch = (permission: typeof ALL_PERMISSIONS[number], modpackId?: string) => {
        if (!member) return null;

        // Owners and admins can't have their permissions modified
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

    // Check if current user has permission to manage this member
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
                            No tienes permisos para gestionar los permisos de {member.user.username} 
                            ({PublisherPermissionsAPI.getRoleDisplayName(member.role)}).
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
                        Gestionar permisos de {member.user.username}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Member info */}
                    <Card>
                        <CardContent className="pt-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    {member.user.avatarUrl && (
                                        <img
                                            src={member.user.avatarUrl}
                                            alt={member.user.username}
                                            className="h-10 w-10 rounded-full"
                                        />
                                    )}
                                    <div>
                                        <p className="font-medium">{member.user.username}</p>
                                        <p className="text-sm text-muted-foreground">{member.user.email}</p>
                                    </div>
                                </div>
                                <Badge variant={PublisherPermissionsAPI.getRoleBadgeVariant(member.role)}>
                                    {PublisherPermissionsAPI.getRoleDisplayName(member.role)}
                                </Badge>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Permission management */}
                    {member.role === 'member' ? (
                        <Tabs defaultValue="publisher" className="w-full">
                            <TabsList className="grid w-full grid-cols-3">
                                <TabsTrigger value="publisher">Publisher</TabsTrigger>
                                <TabsTrigger value="modpacks-general">Modpacks Generales</TabsTrigger>
                                <TabsTrigger value="modpacks-specific">Modpacks Específicos</TabsTrigger>
                            </TabsList>

                            <TabsContent value="publisher" className="space-y-4">
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-base">Permisos a nivel Publisher</CardTitle>
                                        <p className="text-sm text-muted-foreground">
                                            Estos permisos se aplican a todo el publisher
                                        </p>
                                    </CardHeader>
                                    <CardContent className="space-y-1">
                                        {loading ? (
                                            <div className="flex items-center justify-center py-4">
                                                <LucideLoader className="h-6 w-6 animate-spin" />
                                            </div>
                                        ) : (
                                            PUBLISHER_PERMISSIONS.map((permission) => (
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
                                            Estos permisos se aplican a todos los modpacks del publisher
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
                                        ) : publisherModpacks.length === 0 ? (
                                            <div className="text-center py-4 text-muted-foreground">
                                                No hay modpacks disponibles
                                            </div>
                                        ) : (
                                            publisherModpacks.map((modpack) => (
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
                            <AlertDescription>
                                Los usuarios con rol de <strong>{PublisherPermissionsAPI.getRoleDisplayName(member.role)}</strong> tienen
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