import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    LucideMoreHorizontal,
    LucideEdit,
    LucideSettings,
    LucideTrash2,
    LucideHistory,
    LucideEye,
    LucideFileEdit,
    LucideGitBranch,
    LucideUpload,
    LucideShield
} from 'lucide-react';

interface Permission {
    canView: boolean;
    canModify: boolean;
    canManageVersions: boolean;
    canPublish: boolean;
    canDelete: boolean;
    canManageAccess: boolean;
}

interface ModpackActionsProps {
    modpack: {
        id: string;
        name: string;
        status: string;
    };
    userRole: 'owner' | 'admin' | 'member';
    permissions?: Permission;
    onEdit?: () => void;
    onDelete?: () => void;
    onViewVersions?: () => void;
    onManageAccess?: () => void;
}

export const ModpackPermissionActions: React.FC<ModpackActionsProps> = ({
    modpack,
    userRole,
    permissions,
    onEdit,
    onDelete,
    onViewVersions,
    onManageAccess
}) => {
    // Owner and Admin have all permissions
    const hasFullAccess = userRole === 'owner' || userRole === 'admin';
    
    // For members, check specific permissions
    const canModify = hasFullAccess || permissions?.canModify || false;
    const canManageVersions = hasFullAccess || permissions?.canManageVersions || false;
    const canPublish = hasFullAccess || permissions?.canPublish || false;
    const canDelete = hasFullAccess || permissions?.canDelete || false;
    const canManageAccess = hasFullAccess || permissions?.canManageAccess || false;
    const canView = hasFullAccess || permissions?.canView || false;

    if (!canView) {
        return (
            <Badge variant="secondary" className="text-xs">
                Sin acceso
            </Badge>
        );
    }

    return (
        <div className="flex items-center gap-2">
            {/* Permission indicators */}
            <div className="flex gap-1">
                {canModify && (
                    <Badge variant="outline" className="text-xs flex items-center gap-1">
                        <LucideFileEdit className="w-3 h-3" />
                        Editar
                    </Badge>
                )}
                {canManageVersions && (
                    <Badge variant="outline" className="text-xs flex items-center gap-1">
                        <LucideGitBranch className="w-3 h-3" />
                        Versiones
                    </Badge>
                )}
                {canPublish && (
                    <Badge variant="outline" className="text-xs flex items-center gap-1">
                        <LucideUpload className="w-3 h-3" />
                        Publicar
                    </Badge>
                )}
                {canManageAccess && (
                    <Badge variant="outline" className="text-xs flex items-center gap-1">
                        <LucideShield className="w-3 h-3" />
                        Acceso
                    </Badge>
                )}
            </div>

            {/* Actions dropdown */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                        <LucideMoreHorizontal className="w-4 h-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={onViewVersions}>
                        <LucideHistory className="w-4 h-4 mr-2" />
                        Ver Versiones
                    </DropdownMenuItem>
                    
                    {canModify && (
                        <DropdownMenuItem onClick={onEdit}>
                            <LucideEdit className="w-4 h-4 mr-2" />
                            Editar Modpack
                        </DropdownMenuItem>
                    )}
                    
                    {canManageAccess && (
                        <DropdownMenuItem onClick={onManageAccess}>
                            <LucideShield className="w-4 h-4 mr-2" />
                            Gestionar Acceso
                        </DropdownMenuItem>
                    )}
                    
                    {canDelete && (
                        <DropdownMenuItem 
                            onClick={onDelete}
                            className="text-red-600 focus:text-red-600"
                        >
                            <LucideTrash2 className="w-4 h-4 mr-2" />
                            Eliminar
                        </DropdownMenuItem>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
};

// Permission summary component
export const UserPermissionSummary: React.FC<{
    userRole: 'owner' | 'admin' | 'member';
    activeScopes?: number;
}> = ({ userRole, activeScopes = 0 }) => {
    const roleConfig = {
        owner: { label: 'Propietario', color: 'bg-red-500', description: 'Acceso total' },
        admin: { label: 'Administrador', color: 'bg-orange-500', description: 'Acceso completo' },
        member: { label: 'Miembro', color: 'bg-blue-500', description: `${activeScopes} permisos activos` }
    };

    const config = roleConfig[userRole];

    return (
        <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
            <Badge className={`${config.color} text-white`}>
                {config.label}
            </Badge>
            <span className="text-sm text-muted-foreground">
                {config.description}
            </span>
        </div>
    );
};