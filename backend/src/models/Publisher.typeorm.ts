// src/models/Publisher.typeorm.ts - TypeORM Version with Granular Permissions
import { AppDataSource } from "@/db/data-source";
import { Publisher as PublisherEntity } from "@/entities/Publisher";
import { PublisherMember as PublisherMemberEntity } from "@/entities/PublisherMember";
import { Scope as ScopeEntity } from "@/entities/Scope";
import { User as UserEntity } from "@/entities/User";
import { Modpack as ModpackEntity } from "@/entities/Modpack";
import { PublisherMemberRole } from "@/types/enums";
import { hasPermission, canViewModpack, canModifyModpack, PERMISSIONS, grantPermissions, getMemberPermissions } from "@/utils/permissions";
import { z } from "zod";

// Validation schemas for granular permissions
export const granularScopeSchema = z.object({
    publisherId: z.string().uuid().optional(),
    modpackId: z.string().uuid().optional(),
    // Legacy permissions (keeping for compatibility)
    canCreateModpacks: z.boolean().default(false),
    canEditModpacks: z.boolean().default(false),
    canDeleteModpacks: z.boolean().default(false),
    canPublishVersions: z.boolean().default(false),
    canManageMembers: z.boolean().default(false),
    canManageSettings: z.boolean().default(false),
    // Granular modpack permissions
    modpackView: z.boolean().default(false),
    modpackModify: z.boolean().default(false),
    modpackManageVersions: z.boolean().default(false),
    modpackPublish: z.boolean().default(false),
    modpackDelete: z.boolean().default(false),
    modpackManageAccess: z.boolean().default(false),
    // Granular publisher permissions
    publisherManageCategoriesTags: z.boolean().default(false),
    publisherViewStats: z.boolean().default(false),
}).refine(data => data.publisherId || data.modpackId, {
    message: "Either publisherId or modpackId must be provided"
});

export class PublisherTypeORM {
    // TypeORM-based permission methods for granular permissions

    /**
     * Check if a user has a specific permission
     */
    static async hasUserPermission(
        userId: string,
        publisherId: string,
        permission: keyof typeof PERMISSIONS,
        modpackId?: string
    ): Promise<boolean> {
        const permissionKey = PERMISSIONS[permission];
        return await hasPermission(userId, publisherId, permissionKey, modpackId);
    }

    /**
     * Check if user can view modpack (Members can view their own modpacks or those with explicit access)
     */
    static async canUserViewModpack(
        userId: string,
        publisherId: string,
        modpackId: string
    ): Promise<boolean> {
        try {
            // Get modpack to check creator
            const modpackRepository = AppDataSource.getRepository(ModpackEntity);
            const modpack = await modpackRepository.findOne({
                where: { id: modpackId },
                relations: ["publisher"]
            });

            if (!modpack || modpack.publisher.id !== publisherId) {
                return false;
            }

            return await canViewModpack(userId, publisherId, modpackId, modpack.createdBy);
        } catch (error) {
            console.error(`Error checking modpack view permission:`, error);
            return false;
        }
    }

    /**
     * Check if user can modify modpack (Members can modify their own modpacks or those with explicit access)
     */
    static async canUserModifyModpack(
        userId: string,
        publisherId: string,
        modpackId: string
    ): Promise<boolean> {
        try {
            // Get modpack to check creator
            const modpackRepository = AppDataSource.getRepository(ModpackEntity);
            const modpack = await modpackRepository.findOne({
                where: { id: modpackId },
                relations: ["publisher"]
            });

            if (!modpack || modpack.publisher.id !== publisherId) {
                return false;
            }

            return await canModifyModpack(userId, publisherId, modpackId, modpack.createdBy);
        } catch (error) {
            console.error(`Error checking modpack modify permission:`, error);
            return false;
        }
    }

    /**
     * Grant permissions to a member using TypeORM
     */
    static async grantMemberPermissions(
        publisherId: string,
        userId: string,
        permissions: z.infer<typeof granularScopeSchema>
    ): Promise<void> {
        const parsed = granularScopeSchema.safeParse(permissions);
        if (!parsed.success) {
            throw new Error(`Invalid scope data: ${JSON.stringify(parsed.error.format())}`);
        }

        try {
            // Find the member
            const memberRepository = AppDataSource.getRepository(PublisherMemberEntity);
            const member = await memberRepository.findOne({
                where: { userId, publisherId }
            });

            if (!member) {
                throw new Error(`User ${userId} is not a member of this publisher`);
            }

            // Only Owners and Admins can grant permissions
            if (member.role === PublisherMemberRole.MEMBER) {
                throw new Error('Members cannot grant permissions');
            }

            await grantPermissions(
                member.id,
                parsed.data,
                parsed.data.publisherId,
                parsed.data.modpackId
            );
        } catch (error) {
            throw new Error(`Failed to grant permissions: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Get all member permissions and scopes
     */
    static async getMemberPermissions(
        publisherId: string,
        userId: string
    ): Promise<{
        role: PublisherMemberRole;
        organizationScopes: ScopeEntity[];
        modpackScopes: ScopeEntity[];
    }> {
        return await getMemberPermissions(userId, publisherId);
    }

    /**
     * Check if user is Owner (immutable permissions)
     */
    static async isUserOwner(userId: string, publisherId: string): Promise<boolean> {
        try {
            const memberRepository = AppDataSource.getRepository(PublisherMemberEntity);
            const member = await memberRepository.findOne({
                where: { userId, publisherId }
            });

            return member?.role === PublisherMemberRole.OWNER;
        } catch (error) {
            console.error(`Error checking if user is owner:`, error);
            return false;
        }
    }

    /**
     * Check if user is Admin
     */
    static async isUserAdmin(userId: string, publisherId: string): Promise<boolean> {
        try {
            const memberRepository = AppDataSource.getRepository(PublisherMemberEntity);
            const member = await memberRepository.findOne({
                where: { userId, publisherId }
            });

            return member?.role === PublisherMemberRole.ADMIN || member?.role === PublisherMemberRole.OWNER;
        } catch (error) {
            console.error(`Error checking if user is admin:`, error);
            return false;
        }
    }

    /**
     * Check if user is Member
     */
    static async isUserMember(userId: string, publisherId: string): Promise<boolean> {
        try {
            const memberRepository = AppDataSource.getRepository(PublisherMemberEntity);
            const member = await memberRepository.findOne({
                where: { userId, publisherId }
            });

            return !!member;
        } catch (error) {
            console.error(`Error checking if user is member:`, error);
            return false;
        }
    }

    /**
     * Add a member to publisher with default Member permissions
     */
    static async addMember(
        publisherId: string,
        userId: string,
        role: PublisherMemberRole = PublisherMemberRole.MEMBER
    ): Promise<PublisherMemberEntity> {
        try {
            const memberRepository = AppDataSource.getRepository(PublisherMemberEntity);
            
            // Check if member already exists
            const existingMember = await memberRepository.findOne({
                where: { userId, publisherId }
            });

            if (existingMember) {
                throw new Error('User is already a member of this publisher');
            }

            // Create new member
            const newMember = memberRepository.create({
                userId,
                publisherId,
                role
            });

            const savedMember = await memberRepository.save(newMember);

            // For Members, create default scope with limited permissions
            if (role === PublisherMemberRole.MEMBER) {
                const scopeRepository = AppDataSource.getRepository(ScopeEntity);
                const defaultScope = scopeRepository.create({
                    publisherMemberId: savedMember.id,
                    publisherId: publisherId,
                    // Members have no default permissions at organization level
                    // They need explicit permissions per modpack
                    modpackView: false,
                    modpackModify: false,
                    modpackManageVersions: false,
                    modpackPublish: false,
                    modpackDelete: false,
                    modpackManageAccess: false,
                    publisherManageCategoriesTags: false,
                    publisherViewStats: false,
                });

                await scopeRepository.save(defaultScope);
            }

            return savedMember;
        } catch (error) {
            throw new Error(`Failed to add member: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Update member role (only Owner can demote Admins, Admins can manage Members)
     */
    static async updateMemberRole(
        publisherId: string,
        targetUserId: string,
        actorUserId: string,
        newRole: PublisherMemberRole
    ): Promise<void> {
        try {
            const memberRepository = AppDataSource.getRepository(PublisherMemberEntity);
            
            // Get actor member
            const actorMember = await memberRepository.findOne({
                where: { userId: actorUserId, publisherId }
            });

            if (!actorMember) {
                throw new Error('Actor is not a member of this publisher');
            }

            // Get target member
            const targetMember = await memberRepository.findOne({
                where: { userId: targetUserId, publisherId }
            });

            if (!targetMember) {
                throw new Error('Target user is not a member of this publisher');
            }

            // Permission checks based on requirements
            if (targetMember.role === PublisherMemberRole.OWNER) {
                throw new Error('Cannot modify Owner role');
            }

            if (actorMember.role === PublisherMemberRole.MEMBER) {
                throw new Error('Members cannot modify roles');
            }

            if (actorMember.role === PublisherMemberRole.ADMIN && targetMember.role === PublisherMemberRole.ADMIN) {
                throw new Error('Admins cannot modify other Admin roles');
            }

            // Update role
            targetMember.role = newRole;
            await memberRepository.save(targetMember);

        } catch (error) {
            throw new Error(`Failed to update member role: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Remove member from publisher (with role-based restrictions)
     */
    static async removeMember(
        publisherId: string,
        targetUserId: string,
        actorUserId: string
    ): Promise<void> {
        try {
            const memberRepository = AppDataSource.getRepository(PublisherMemberEntity);
            
            // Get actor member
            const actorMember = await memberRepository.findOne({
                where: { userId: actorUserId, publisherId }
            });

            if (!actorMember) {
                throw new Error('Actor is not a member of this publisher');
            }

            // Get target member
            const targetMember = await memberRepository.findOne({
                where: { userId: targetUserId, publisherId }
            });

            if (!targetMember) {
                throw new Error('Target user is not a member of this publisher');
            }

            // Permission checks
            if (targetMember.role === PublisherMemberRole.OWNER) {
                throw new Error('Cannot remove Owner');
            }

            if (actorMember.role === PublisherMemberRole.MEMBER) {
                throw new Error('Members cannot remove other members');
            }

            if (actorMember.role === PublisherMemberRole.ADMIN && targetMember.role === PublisherMemberRole.ADMIN) {
                throw new Error('Admins cannot remove other Admins');
            }

            // Remove all scopes first
            const scopeRepository = AppDataSource.getRepository(ScopeEntity);
            await scopeRepository.delete({ publisherMemberId: targetMember.id });

            // Remove member
            await memberRepository.remove(targetMember);

        } catch (error) {
            throw new Error(`Failed to remove member: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}