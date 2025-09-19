import { API_ENDPOINT } from '@/consts';

// Types for the new permission system
export interface PermissionScope {
    id: string;
    publisherId?: string;
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
    createdAt: string;
    updatedAt: string;
}

export interface PublisherMemberWithPermissions {
    id: string;
    userId: string;
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

export interface PermissionAssignment {
    userId: string;
    permission: string;
    enabled: boolean;
    modpackId?: string;
    assignedBy: string;
    assignedAt: string;
}

// Permission definitions
export const MODPACK_PERMISSIONS = [
    { key: 'modpack.view', label: 'Ver modpack', description: 'Permite ver un modpack' },
    { key: 'modpack.modify', label: 'Modificar modpack', description: 'Permite modificar un modpack' },
    { key: 'modpack.manage_versions', label: 'Gestionar versiones', description: 'Permite agregar, eliminar y gestionar versiones de un modpack' },
    { key: 'modpack.publish', label: 'Publicar', description: 'Permite cambiar el estado de un modpack de Borrador a Publicado' },
    { key: 'modpack.delete', label: 'Eliminar modpack', description: 'Permite eliminar un modpack' },
    { key: 'modpack.manage_access', label: 'Gestionar acceso', description: 'Permite gestionar los permisos de otros miembros sobre ese modpack' },
] as const;

export const PUBLISHER_PERMISSIONS = [
    { key: 'publisher.manage_categories_tags', label: 'Gestionar categorías y etiquetas', description: 'Permite administrar las categorías y etiquetas del Publisher' },
    { key: 'publisher.view_stats', label: 'Ver estadísticas', description: 'Permite ver las estadísticas de descargas y ventas de los modpacks' },
] as const;

export const ALL_PERMISSIONS = [...MODPACK_PERMISSIONS, ...PUBLISHER_PERMISSIONS] as const;

// API Service for enhanced publisher permissions
export class PublisherPermissionsAPI {
    private static baseUrl = `${API_ENDPOINT}/publishers`;

    // Member management
    static async getMembers(publisherId: string, accessToken: string): Promise<{ members: PublisherMemberWithPermissions[]; total: number }> {
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

        // Handle JSON:API format
        const members = (data.data || []).map((item: any) => ({
            id: item.attributes.id,
            userId: item.attributes.user?.id || item.id, // Use user.id if available, otherwise use item.id
            role: item.attributes.role,
            createdAt: item.attributes.createdAt,
            user: item.attributes.user,
            scopes: (item.attributes.scopes || []).map((scope: any) => ({
                id: scope.id?.toString() || scope.id,
                publisherId: scope.publisherId,
                modpackId: scope.modpackId,
                permissions: {
                    modpackView: scope.modpackView || false,
                    modpackModify: scope.modpackModify || false,
                    modpackManageVersions: scope.modpackManageVersions || false,
                    modpackPublish: scope.modpackPublish || false,
                    modpackDelete: scope.modpackDelete || false,
                    modpackManageAccess: scope.modpackManageAccess || false,
                    publisherManageCategoriesTags: scope.publisherManageCategoriesTags || false,
                    publisherViewStats: scope.publisherViewStats || false,
                },
                createdAt: scope.createdAt,
                updatedAt: scope.updatedAt
            }))
        }));

        return {
            members,
            total: data.meta?.total || members.length
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

    static async updateMemberRole(publisherId: string, userId: string, role: string, accessToken: string): Promise<void> {
        const response = await fetch(`${this.baseUrl}/${publisherId}/members/${userId}/role`, {
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

    // Permission management
    static async getMemberPermissions(publisherId: string, userId: string, accessToken: string): Promise<PermissionScope[]> {
        const response = await fetch(`${this.baseUrl}/${publisherId}/members/${userId}/permissions`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || `Error fetching member permissions: ${response.statusText}`);
        }

        const data = await response.json();

        // Handle JSON:API format
        return (data.data || []).map((item: any) => {
            const attrs = item.attributes || item;
            return {
                id: attrs.id?.toString() || attrs.id,
                publisherId: attrs.publisherId,
                modpackId: attrs.modpackId,
                permissions: {
                    modpackView: attrs.modpackView || false,
                    modpackModify: attrs.modpackModify || false,
                    modpackManageVersions: attrs.modpackManageVersions || false,
                    modpackPublish: attrs.modpackPublish || false,
                    modpackDelete: attrs.modpackDelete || false,
                    modpackManageAccess: attrs.modpackManageAccess || false,
                    publisherManageCategoriesTags: attrs.publisherManageCategoriesTags || false,
                    publisherViewStats: attrs.publisherViewStats || false,
                },
                createdAt: attrs.createdAt,
                updatedAt: attrs.updatedAt
            };
        });
    }

    static async assignPermission(
        publisherId: string,
        userId: string,
        permission: string,
        enable: boolean,
        accessToken: string,
        modpackId?: string
    ): Promise<PermissionAssignment> {
        const response = await fetch(`${this.baseUrl}/${publisherId}/permissions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ userId, permission, enable, modpackId }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || `Error assigning permission: ${response.statusText}`);
        }

        const data = await response.json();

        // Handle JSON:API format if needed
        return data.data || data;
    }

    // Helper methods
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

    static hasPermission(member: PublisherMemberWithPermissions, permission: string, modpackId?: string): boolean {
        // Owners and admins have all permissions
        if (member.role === 'owner' || member.role === 'admin') {
            return true;
        }

        // Check in scopes
        const relevantScope = modpackId
            ? member.scopes.find(scope => {
                const scopeModpackId = scope.modpackId || (scope as any).modpack?.id;
                return scopeModpackId === modpackId;
            })
            : member.scopes.find(scope => {
                const scopePublisherId = scope.publisherId || (scope as any).publisher?.id;
                return scopePublisherId && !scope.modpackId && !(scope as any).modpack?.id;
            });

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

        const permissionField = permissionMap[permission];
        return permissionField ? relevantScope.permissions[permissionField] : false;
    }
}