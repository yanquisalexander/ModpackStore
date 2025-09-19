// Permission utility functions for granular permissions system
import { AppDataSource } from "@/db/data-source";
import { Scope } from "@/entities/Scope";
import { PublisherMember } from "@/entities/PublisherMember";
import { PublisherMemberRole } from "@/types/enums";
import { Not, IsNull } from "typeorm";

// Define all granular permissions as constants
export const PERMISSIONS = {
    // Modpack permissions
    MODPACK_VIEW: 'modpackView',
    MODPACK_MODIFY: 'modpackModify',
    MODPACK_MANAGE_VERSIONS: 'modpackManageVersions',
    MODPACK_PUBLISH: 'modpackPublish',
    MODPACK_DELETE: 'modpackDelete',
    MODPACK_MANAGE_ACCESS: 'modpackManageAccess',
    
    // Publisher permissions
    PUBLISHER_MANAGE_CATEGORIES_TAGS: 'publisherManageCategoriesTags',
    PUBLISHER_VIEW_STATS: 'publisherViewStats',
    
    // Legacy permissions (for backward compatibility)
    CAN_CREATE_MODPACKS: 'canCreateModpacks',
    CAN_EDIT_MODPACKS: 'canEditModpacks',
    CAN_DELETE_MODPACKS: 'canDeleteModpacks',
    CAN_PUBLISH_VERSIONS: 'canPublishVersions',
    CAN_MANAGE_MEMBERS: 'canManageMembers',
    CAN_MANAGE_SETTINGS: 'canManageSettings',
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

// Default permissions for Members based on issue requirements
export const DEFAULT_MEMBER_PERMISSIONS = {
    // Members can view modpacks they created or have explicit access to
    [PERMISSIONS.MODPACK_VIEW]: false, // Will be checked per-modpack
    [PERMISSIONS.MODPACK_MODIFY]: false, // Will be checked per-modpack
    [PERMISSIONS.MODPACK_MANAGE_VERSIONS]: false, // Will be checked per-modpack
    [PERMISSIONS.MODPACK_PUBLISH]: false,
    [PERMISSIONS.MODPACK_DELETE]: false,
    [PERMISSIONS.MODPACK_MANAGE_ACCESS]: false,
    [PERMISSIONS.PUBLISHER_MANAGE_CATEGORIES_TAGS]: false,
    [PERMISSIONS.PUBLISHER_VIEW_STATS]: false,
};

/**
 * Check if a user has a specific permission for a publisher or modpack
 */
export async function hasPermission(
    userId: string,
    publisherId: string,
    permission: Permission,
    modpackId?: string
): Promise<boolean> {
    try {
        // Get the user's membership in the publisher
        const memberRepository = AppDataSource.getRepository(PublisherMember);
        const member = await memberRepository.findOne({
            where: { userId, publisherId }
        });

        if (!member) {
            return false;
        }

        // Owners and Admins have all permissions (as per requirements)
        if (member.role === PublisherMemberRole.OWNER || member.role === PublisherMemberRole.ADMIN) {
            return true;
        }

        // For Members, check granular permissions
        const scopeRepository = AppDataSource.getRepository(Scope);
        
        // Check organization-level permissions first
        const orgScope = await scopeRepository.findOne({
            where: {
                publisherMemberId: member.id,
                publisherId: publisherId,
                modpackId: null
            }
        });

        if (orgScope && orgScope[permission as keyof Scope]) {
            return true;
        }

        // Check modpack-specific permissions if modpackId is provided
        if (modpackId) {
            const modpackScope = await scopeRepository.findOne({
                where: {
                    publisherMemberId: member.id,
                    modpackId: modpackId
                }
            });

            if (modpackScope && modpackScope[permission as keyof Scope]) {
                return true;
            }
        }

        return false;
    } catch (error) {
        console.error(`Error checking permission ${permission} for user ${userId}:`, error);
        return false;
    }
}

/**
 * Check if a user can view a specific modpack
 * Members can view modpacks they created or have explicit access to
 */
export async function canViewModpack(
    userId: string,
    publisherId: string,
    modpackId: string,
    modpackCreatedBy?: string
): Promise<boolean> {
    try {
        const memberRepository = AppDataSource.getRepository(PublisherMember);
        const member = await memberRepository.findOne({
            where: { userId, publisherId }
        });

        if (!member) {
            return false;
        }

        // Owners and Admins can view all modpacks
        if (member.role === PublisherMemberRole.OWNER || member.role === PublisherMemberRole.ADMIN) {
            return true;
        }

        // Members can view modpacks they created
        if (modpackCreatedBy === userId) {
            return true;
        }

        // Check explicit view permission
        return await hasPermission(userId, publisherId, PERMISSIONS.MODPACK_VIEW, modpackId);
    } catch (error) {
        console.error(`Error checking modpack view permission for user ${userId}:`, error);
        return false;
    }
}

/**
 * Check if a user can modify a specific modpack
 * Members can modify modpacks they created or have explicit access to
 */
export async function canModifyModpack(
    userId: string,
    publisherId: string,
    modpackId: string,
    modpackCreatedBy?: string
): Promise<boolean> {
    try {
        const memberRepository = AppDataSource.getRepository(PublisherMember);
        const member = await memberRepository.findOne({
            where: { userId, publisherId }
        });

        if (!member) {
            return false;
        }

        // Owners and Admins can modify all modpacks
        if (member.role === PublisherMemberRole.OWNER || member.role === PublisherMemberRole.ADMIN) {
            return true;
        }

        // Members can modify modpacks they created
        if (modpackCreatedBy === userId) {
            return true;
        }

        // Check explicit modify permission
        return await hasPermission(userId, publisherId, PERMISSIONS.MODPACK_MODIFY, modpackId);
    } catch (error) {
        console.error(`Error checking modpack modify permission for user ${userId}:`, error);
        return false;
    }
}

/**
 * Grant specific permissions to a member for a publisher or modpack
 */
export async function grantPermissions(
    publisherMemberId: number,
    permissions: Partial<Record<Permission, boolean>>,
    publisherId?: string,
    modpackId?: string
): Promise<void> {
    try {
        const scopeRepository = AppDataSource.getRepository(Scope);
        
        // Find existing scope or create new one
        let scope = await scopeRepository.findOne({
            where: {
                publisherMemberId,
                publisherId: publisherId || null,
                modpackId: modpackId || null
            }
        });

        if (!scope) {
            scope = scopeRepository.create({
                publisherMemberId,
                publisherId: publisherId || null,
                modpackId: modpackId || null
            });
        }

        // Update permissions
        Object.entries(permissions).forEach(([permission, value]) => {
            if (permission in scope!) {
                (scope as any)[permission] = value;
            }
        });

        await scopeRepository.save(scope);
    } catch (error) {
        console.error('Error granting permissions:', error);
        throw new Error(`Failed to grant permissions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Revoke specific permissions from a member
 */
export async function revokePermissions(
    publisherMemberId: number,
    permissions: Permission[],
    publisherId?: string,
    modpackId?: string
): Promise<void> {
    try {
        const scopeRepository = AppDataSource.getRepository(Scope);
        
        const scope = await scopeRepository.findOne({
            where: {
                publisherMemberId,
                publisherId: publisherId || null,
                modpackId: modpackId || null
            }
        });

        if (!scope) {
            return; // Nothing to revoke
        }

        // Revoke specified permissions
        permissions.forEach(permission => {
            if (permission in scope) {
                (scope as any)[permission] = false;
            }
        });

        await scopeRepository.save(scope);
    } catch (error) {
        console.error('Error revoking permissions:', error);
        throw new Error(`Failed to revoke permissions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Get all permissions for a member
 */
export async function getMemberPermissions(
    userId: string,
    publisherId: string
): Promise<{
    role: PublisherMemberRole;
    organizationScopes: Scope[];
    modpackScopes: Scope[];
}> {
    try {
        const memberRepository = AppDataSource.getRepository(PublisherMember);
        const scopeRepository = AppDataSource.getRepository(Scope);
        
        const member = await memberRepository.findOne({
            where: { userId, publisherId }
        });

        if (!member) {
            throw new Error('Member not found');
        }

        const organizationScopes = await scopeRepository.find({
            where: {
                publisherMemberId: member.id,
                publisherId: publisherId,
                modpackId: null
            }
        });

        const modpackScopes = await scopeRepository.find({
            where: {
                publisherMemberId: member.id,
                modpackId: Not(IsNull())
            }
        });

        return {
            role: member.role,
            organizationScopes,
            modpackScopes
        };
    } catch (error) {
        console.error('Error getting member permissions:', error);
        throw new Error(`Failed to get member permissions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}