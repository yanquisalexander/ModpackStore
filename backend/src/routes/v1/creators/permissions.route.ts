import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { User } from '@/entities/User';
import { Publisher } from '@/models/Publisher.model';
import { PublisherMember } from '@/models/PublisherMember.model';
import { scopeSchema, PublisherRole } from '@/models/Publisher.model';
import { ModpackPermission, PublisherPermission } from '@/types/enums';
import { requireAuth, USER_CONTEXT_KEY } from '@/middlewares/auth.middleware';
import { requireMemberManagement, requireRoleManagement } from '@/middlewares/publisherPermissions.middleware';
import { APIError } from '@/lib/APIError';

export const PermissionsRoute = new Hono();

// Schema for permission assignment
const assignPermissionSchema = z.object({
    userId: z.string().uuid(),
    permissions: scopeSchema.omit({ publisherId: true, modpackId: true }),
    modpackId: z.string().uuid().optional()
});

// Schema for role change
const changeRoleSchema = z.object({
    userId: z.string().uuid(),
    role: z.nativeEnum(PublisherRole)
});

// Get all members and their permissions for a publisher
PermissionsRoute.get(
    '/publishers/:publisherId/members',
    requireAuth,
    requireMemberManagement,
    async (c) => {
        const { publisherId } = c.req.param();
        
        try {
            const publisher = await Publisher.findById(publisherId);
            if (!publisher) {
                throw new APIError(404, 'Not Found', 'PUBLISHER_NOT_FOUND');
            }

            const members = await publisher.getMembers();
            const membersWithPermissions = await Promise.all(
                members.map(async (member) => {
                    const memberModel = new PublisherMember(member);
                    const scopes = await publisher.getMemberScopes(member.userId);
                    
                    return {
                        ...member,
                        scopes
                    };
                })
            );

            return c.json({ members: membersWithPermissions });
        } catch (error) {
            if (error instanceof APIError) {
                throw error;
            }
            throw new APIError(500, 'Internal Server Error', 'FAILED_TO_GET_MEMBERS');
        }
    }
);

// Get permissions for a specific member
PermissionsRoute.get(
    '/publishers/:publisherId/members/:memberId/permissions',
    requireAuth,
    requireMemberManagement,
    async (c) => {
        const { publisherId, memberId } = c.req.param();
        
        try {
            const publisher = await Publisher.findById(publisherId);
            if (!publisher) {
                throw new APIError(404, 'Not Found', 'PUBLISHER_NOT_FOUND');
            }

            const member = await publisher.getMember(memberId);
            if (!member) {
                throw new APIError(404, 'Not Found', 'MEMBER_NOT_FOUND');
            }

            const scopes = await publisher.getMemberScopes(memberId);
            
            return c.json({
                member,
                scopes
            });
        } catch (error) {
            if (error instanceof APIError) {
                throw error;
            }
            throw new APIError(500, 'Internal Server Error', 'FAILED_TO_GET_MEMBER_PERMISSIONS');
        }
    }
);

// Assign permissions to a member
PermissionsRoute.post(
    '/publishers/:publisherId/permissions',
    requireAuth,
    requireMemberManagement,
    zValidator('json', assignPermissionSchema),
    async (c) => {
        const { publisherId } = c.req.param();
        const { userId, permissions, modpackId } = c.req.valid('json');
        
        try {
            const publisher = await Publisher.findById(publisherId);
            if (!publisher) {
                throw new APIError(404, 'Not Found', 'PUBLISHER_NOT_FOUND');
            }

            const member = await publisher.getMember(userId);
            if (!member) {
                throw new APIError(404, 'Not Found', 'MEMBER_NOT_FOUND');
            }

            // Members and Admins can't have their role restricted by default
            if (member.role !== PublisherRole.MEMBER) {
                throw new APIError(400, 'Bad Request', 'CANNOT_ASSIGN_PERMISSIONS_TO_NON_MEMBER');
            }

            const scopeData = {
                publisherId: modpackId ? undefined : publisherId,
                modpackId: modpackId,
                ...permissions
            };

            await publisher.addMemberScope(userId, scopeData);
            
            return c.json({ 
                message: 'Permissions assigned successfully',
                scope: scopeData 
            });
        } catch (error) {
            if (error instanceof APIError) {
                throw error;
            }
            throw new APIError(500, 'Internal Server Error', 'FAILED_TO_ASSIGN_PERMISSIONS');
        }
    }
);

// Remove specific permission scope
PermissionsRoute.delete(
    '/publishers/:publisherId/permissions/:scopeId',
    requireAuth,
    requireMemberManagement,
    async (c) => {
        const { publisherId, scopeId } = c.req.param();
        const user = c.get(USER_CONTEXT_KEY) as User;
        
        try {
            const publisher = await Publisher.findById(publisherId);
            if (!publisher) {
                throw new APIError(404, 'Not Found', 'PUBLISHER_NOT_FOUND');
            }

            // For now, we'll need to implement this in the Publisher model
            // This is a simplified approach - in a full implementation,
            // you'd want to verify the scope belongs to the publisher
            
            await publisher.removeMemberScope(user.id, parseInt(scopeId));
            
            return c.json({ 
                message: 'Permission scope removed successfully' 
            });
        } catch (error) {
            if (error instanceof APIError) {
                throw error;
            }
            throw new APIError(500, 'Internal Server Error', 'FAILED_TO_REMOVE_PERMISSIONS');
        }
    }
);

// Change member role
PermissionsRoute.patch(
    '/publishers/:publisherId/members/:memberId/role',
    requireAuth,
    zValidator('json', changeRoleSchema),
    async (c) => {
        const { publisherId, memberId } = c.req.param();
        const { userId, role } = c.req.valid('json');
        const currentUser = c.get(USER_CONTEXT_KEY) as User;
        
        try {
            const publisher = await Publisher.findById(publisherId);
            if (!publisher) {
                throw new APIError(404, 'Not Found', 'PUBLISHER_NOT_FOUND');
            }

            // Check if current user can manage this role
            const canManage = await publisher.canUserManageRole(currentUser.id, role);
            if (!canManage) {
                throw new APIError(403, 'Forbidden', 'INSUFFICIENT_PERMISSIONS_FOR_ROLE_CHANGE');
            }

            const member = await publisher.getMember(userId);
            if (!member) {
                throw new APIError(404, 'Not Found', 'MEMBER_NOT_FOUND');
            }

            await publisher.updateMemberRole(userId, role);
            
            return c.json({ 
                message: 'Member role updated successfully',
                newRole: role 
            });
        } catch (error) {
            if (error instanceof APIError) {
                throw error;
            }
            throw new APIError(500, 'Internal Server Error', 'FAILED_TO_UPDATE_ROLE');
        }
    }
);

// Get available permissions (for UI dropdown/selection)
PermissionsRoute.get(
    '/permissions/available',
    requireAuth,
    async (c) => {
        const modpackPermissions = Object.values(ModpackPermission);
        const publisherPermissions = Object.values(PublisherPermission);
        
        return c.json({
            modpackPermissions,
            publisherPermissions,
            roles: Object.values(PublisherRole)
        });
    }
);