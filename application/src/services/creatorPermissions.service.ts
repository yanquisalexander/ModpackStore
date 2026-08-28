import { API_ENDPOINT } from '@/consts';

function extractErrorDetail(errorData: any): string | undefined {
    if (errorData?.errors?.[0]?.detail) return errorData.errors[0].detail;
    if (errorData?.detail) return errorData.detail;
    return undefined;
}

export interface PermissionScope {
    id: string;
    creatorId?: string;
    modpackId?: string;
    permissions: {
        modpackView: boolean;
        modpackModify: boolean;
        modpackManageVersions: boolean;
        modpackPublish: boolean;
        modpackDelete: boolean;
        modpackManageAccess: boolean;
        publisherManageCategoriesTags: boolean;
        publisherViewStats: boolean;
    };
}

export interface CreatorMember {
    userId: string;
    role: 'owner' | 'admin' | 'member';
    username: string;
    email: string;
    avatarUrl?: string;
    joinedAt: string;
}

export const MODPACK_PERMISSIONS = [
    { key: 'modpack.view', label: 'Ver modpack', description: 'Permite ver un modpack' },
    { key: 'modpack.modify', label: 'Modificar modpack', description: 'Permite modificar un modpack' },
    { key: 'modpack.manage_versions', label: 'Gestionar versiones', description: 'Permite agregar, eliminar y gestionar versiones de un modpack' },
    { key: 'modpack.publish', label: 'Publicar', description: 'Permite cambiar el estado de un modpack de Borrador a Publicado' },
    { key: 'modpack.delete', label: 'Eliminar modpack', description: 'Permite eliminar un modpack' },
    { key: 'modpack.manage_access', label: 'Gestionar acceso', description: 'Permite gestionar los permisos de otros miembros sobre ese modpack' },
] as const;

export const CREATOR_PERMISSIONS = [
    { key: 'publisher.manage_categories_tags', label: 'Gestionar categorías y etiquetas', description: 'Permite administrar las categorías y etiquetas del Creator' },
    { key: 'publisher.view_stats', label: 'Ver estadísticas', description: 'Permite ver las estadísticas de descargas y ventas de los modpacks' },
] as const;

export const ALL_PERMISSIONS = [...MODPACK_PERMISSIONS, ...CREATOR_PERMISSIONS] as const;

export class CreatorPermissionsAPI {
    private static get baseUrl() { return `${API_ENDPOINT}/creators`; }

    static async getMembers(creatorId: string, accessToken: string): Promise<{ members: CreatorMember[]; total: number }> {
        const response = await fetch(`${this.baseUrl}/${creatorId}/members`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(extractErrorDetail(errorData) || `Error fetching members: ${response.statusText}`);
        }

        const data = await response.json();
        const members = Array.isArray(data) ? data : data.data || [];

        return {
            members: members.map((m: any) => ({
                userId: m.userId,
                role: m.role,
                username: m.username,
                email: m.email,
                avatarUrl: m.avatarUrl,
                joinedAt: m.joinedAt,
            })),
            total: members.length,
        };
    }

    static async addMember(creatorId: string, userId: string, role: string, accessToken: string): Promise<void> {
        const response = await fetch(`${this.baseUrl}/${creatorId}/members`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ userId, role }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(extractErrorDetail(errorData) || `Error adding member: ${response.statusText}`);
        }
    }

    static async updateMemberRole(creatorId: string, userId: string, role: string, accessToken: string): Promise<void> {
        const response = await fetch(`${this.baseUrl}/${creatorId}/members/${userId}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ role }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(extractErrorDetail(errorData) || `Error updating member role: ${response.statusText}`);
        }
    }

    static async removeMember(creatorId: string, userId: string, accessToken: string): Promise<void> {
        const response = await fetch(`${this.baseUrl}/${creatorId}/members/${userId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(extractErrorDetail(errorData) || `Error removing member: ${response.statusText}`);
        }
    }

    static async getMemberPermissions(creatorId: string, userId: string, accessToken: string): Promise<PermissionScope[]> {
        const response = await fetch(`${this.baseUrl}/${creatorId}/members/${userId}/permissions`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(extractErrorDetail(errorData) || `Error fetching member permissions: ${response.statusText}`);
        }

        const json = await response.json();
        return json.data || [];
    }

    static async assignPermission(
        creatorId: string,
        userId: string,
        permission: string,
        enabled: boolean,
        accessToken: string,
        modpackId?: string
    ): Promise<void> {
        const response = await fetch(`${this.baseUrl}/${creatorId}/permissions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ userId, permission, enabled, modpackId }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(extractErrorDetail(errorData) || `Error assigning permission: ${response.statusText}`);
        }
    }

    static getRoleDisplayName(role: string): string {
        const roleMap: Record<string, string> = {
            'owner': 'Propietario',
            'admin': 'Administrador',
            'member': 'Miembro'
        };
        return roleMap[role] || role;
    }

    static getRoleBadgeVariant(role: string): 'default' | 'secondary' | 'destructive' | 'outline' {
        const variantMap: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
            'owner': 'destructive',
            'admin': 'default',
            'member': 'secondary'
        };
        return variantMap[role] || 'outline';
    }

    static hasPermission(member: CreatorMember, permissions: PermissionScope[], permission: string, modpackId?: string): boolean {
        if (member.role === 'owner' || member.role === 'admin') {
            return true;
        }

        const relevantScope = modpackId
            ? permissions.find(s => s.modpackId === modpackId)
            : permissions.find(s => s.creatorId && !s.modpackId);

        if (!relevantScope) return false;

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
        return field ? relevantScope.permissions[field] : false;
    }
}
