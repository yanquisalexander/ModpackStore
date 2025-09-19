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

interface MemberPermissionsDialogProps {
    member: PublisherMemberWithPermissions | null;
    publisherId: string;
    accessToken: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onPermissionsChanged: () => void;
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
    onPermissionsChanged
}) => {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [permissions, setPermissions] = useState<PermissionScope[]>([]);
    const [modifyingPermissions, setModifyingPermissions] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (open && member) {
            loadPermissions();
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
            setPermissions(memberPermissions);
        } catch (error) {
            toast({
                title: "Error",
                description: `Error al cargar permisos: ${error instanceof Error ? error.message : 'Error desconocido'}`,
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    const handlePermissionToggle = async (permission: string, enabled: boolean, modpackId?: string) => {
        if (!member) return;

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
        return PublisherPermissionsAPI.hasPermission(member, permission, modpackId);
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
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="publisher">Permisos del Publisher</TabsTrigger>
                                <TabsTrigger value="modpacks">Permisos de Modpacks</TabsTrigger>
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

                            <TabsContent value="modpacks" className="space-y-4">
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

                                {/* TODO: Add modpack-specific permissions here */}
                                <Alert>
                                    <LucideInfo className="h-4 w-4" />
                                    <AlertDescription>
                                        Los permisos específicos por modpack se pueden configurar desde la página de cada modpack individual.
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