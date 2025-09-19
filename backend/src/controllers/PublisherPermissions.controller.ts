import { Context } from 'hono';
import { PublisherService } from '../services/publisher.service';
import { serializeResource, serializeCollection, serializeError } from "../utils/jsonapi";
import { APIError } from '../lib/APIError';
import { PublisherMemberRole } from '../types/enums';
import { 
    assignPermissionSchema, 
    publisherMemberSchema 
} from '../validators/publisher.validator';

export class PublisherPermissionsController {
    private static publisherService = new PublisherService();

    /**
     * Get all members of a publisher with their permissions
     */
    static async getMembers(c: Context): Promise<Response> {
        try {
            const user = c.get('user') as { id: string } | undefined;
            if (!user?.id) {
                throw new APIError(401, 'Authentication required.');
            }

            const publisherId = c.req.param('publisherId');
            if (!publisherId) {
                throw new APIError(400, 'Publisher ID is required.');
            }

            // Check if user has permission to view members
            const canViewMembers = await this.publisherService.hasUserPermission(
                publisherId, 
                user.id, 
                'manage_members'
            );

            if (!canViewMembers) {
                throw new APIError(403, 'You do not have permission to view members.');
            }

            const members = await this.publisherService.getMembers(publisherId);
            
            return c.json(serializeCollection('publisher-members', members.map(member => ({
                id: member.id.toString(),
                userId: member.userId,
                role: member.role,
                createdAt: member.createdAt,
                user: member.user ? {
                    id: member.user.id,
                    username: member.user.username,
                    email: member.user.email,
                    avatarUrl: member.user.avatarUrl
                } : null,
                scopes: member.scopes || []
            }))), { status: 200 });

        } catch (error) {
            console.error('Error getting publisher members:', error);
            if (error instanceof APIError) {
                return c.json(serializeError({
                    status: error.statusCode.toString(),
                    title: 'Error',
                    detail: error.message
                }), { status: error.statusCode });
            }
            return c.json(serializeError({
                status: '500',
                title: 'Internal Server Error',
                detail: 'An unexpected error occurred.'
            }), { status: 500 });
        }
    }

    /**
     * Add a new member to a publisher
     */
    static async addMember(c: Context): Promise<Response> {
        try {
            const user = c.get('user') as { id: string } | undefined;
            if (!user?.id) {
                throw new APIError(401, 'Authentication required.');
            }

            const publisherId = c.req.param('publisherId');
            if (!publisherId) {
                throw new APIError(400, 'Publisher ID is required.');
            }

            // Check if user has permission to manage members
            const canManageMembers = await this.publisherService.hasUserPermission(
                publisherId, 
                user.id, 
                'manage_members'
            );

            if (!canManageMembers) {
                throw new APIError(403, 'You do not have permission to manage members.');
            }

            const body = await c.req.json();
            const validationResult = publisherMemberSchema.safeParse({ ...body, publisherId });

            if (!validationResult.success) {
                return c.json(serializeError({
                    status: '400',
                    title: 'Validation Error',
                    detail: validationResult.error.issues.map(i => i.message).join(', ')
                }), { status: 400 });
            }

            const { userId: targetUserId, role } = validationResult.data;

            // Check if requesting user can assign this role
            const canManageRole = await this.publisherService.canManageRole(
                publisherId, 
                user.id, 
                role
            );

            if (!canManageRole) {
                throw new APIError(403, 'You do not have permission to assign this role.');
            }

            const newMember = await this.publisherService.addMember(publisherId, targetUserId, role);

            return c.json(serializeResource('publisher-member', {
                id: newMember.id.toString(),
                userId: newMember.userId,
                role: newMember.role,
                createdAt: newMember.createdAt
            }), { status: 201 });

        } catch (error) {
            console.error('Error adding publisher member:', error);
            if (error instanceof APIError) {
                return c.json(serializeError({
                    status: error.statusCode.toString(),
                    title: 'Error',
                    detail: error.message
                }), { status: error.statusCode });
            }
            return c.json(serializeError({
                status: '500',
                title: 'Internal Server Error',
                detail: 'An unexpected error occurred.'
            }), { status: 500 });
        }
    }

    /**
     * Assign or revoke a specific permission for a member
     */
    static async assignPermission(c: Context): Promise<Response> {
        try {
            const user = c.get('user') as { id: string } | undefined;
            if (!user?.id) {
                throw new APIError(401, 'Authentication required.');
            }

            const publisherId = c.req.param('publisherId');
            if (!publisherId) {
                throw new APIError(400, 'Publisher ID is required.');
            }

            // Check if user has permission to manage access
            const canManageAccess = await this.publisherService.hasUserPermission(
                publisherId, 
                user.id, 
                'modpack.manage_access'
            );

            if (!canManageAccess) {
                throw new APIError(403, 'You do not have permission to manage permissions.');
            }

            const body = await c.req.json();
            const validationResult = assignPermissionSchema.safeParse(body);

            if (!validationResult.success) {
                return c.json(serializeError({
                    status: '400',
                    title: 'Validation Error',
                    detail: validationResult.error.issues.map(i => i.message).join(', ')
                }), { status: 400 });
            }

            const { userId: targetUserId, permission, enable, modpackId } = validationResult.data;

            await this.publisherService.assignPermissionToMember(
                publisherId,
                targetUserId,
                permission,
                enable,
                modpackId
            );

            return c.json(serializeResource('permission-assignment', {
                userId: targetUserId,
                permission,
                enabled: enable,
                modpackId,
                assignedBy: user.id,
                assignedAt: new Date().toISOString()
            }), { status: 200 });

        } catch (error) {
            console.error('Error assigning permission:', error);
            if (error instanceof APIError) {
                return c.json(serializeError({
                    status: error.statusCode.toString(),
                    title: 'Error',
                    detail: error.message
                }), { status: error.statusCode });
            }
            return c.json(serializeError({
                status: '500',
                title: 'Internal Server Error',
                detail: 'An unexpected error occurred.'
            }), { status: 500 });
        }
    }

    /**
     * Get member permissions/scopes
     */
    static async getMemberPermissions(c: Context): Promise<Response> {
        try {
            const user = c.get('user') as { id: string } | undefined;
            if (!user?.id) {
                throw new APIError(401, 'Authentication required.');
            }

            const publisherId = c.req.param('publisherId');
            const targetUserId = c.req.param('userId');
            
            if (!publisherId || !targetUserId) {
                throw new APIError(400, 'Publisher ID and User ID are required.');
            }

            // Check if user has permission to view permissions 
            const canViewPermissions = await this.publisherService.hasUserPermission(
                publisherId, 
                user.id, 
                'manage_members'
            ) || await this.publisherService.hasUserPermission(
                publisherId, 
                user.id, 
                'modpack.manage_access'
            );

            if (!canViewPermissions) {
                throw new APIError(403, 'You do not have permission to view permissions.');
            }

            const scopes = await this.publisherService.getMemberScopes(publisherId, targetUserId);

            return c.json(serializeCollection('scopes', scopes.map(scope => ({
                id: scope.id.toString(),
                publisherId: scope.publisherId,
                modpackId: scope.modpackId,
                permissions: {
                    modpackView: scope.modpackView,
                    modpackModify: scope.modpackModify,
                    modpackManageVersions: scope.modpackManageVersions,
                    modpackPublish: scope.modpackPublish,
                    modpackDelete: scope.modpackDelete,
                    modpackManageAccess: scope.modpackManageAccess,
                    publisherManageCategoriesTags: scope.publisherManageCategoriesTags,
                    publisherViewStats: scope.publisherViewStats
                },
                createdAt: scope.createdAt,
                updatedAt: scope.updatedAt
            }))), { status: 200 });

        } catch (error) {
            console.error('Error getting member permissions:', error);
            if (error instanceof APIError) {
                return c.json(serializeError({
                    status: error.statusCode.toString(),
                    title: 'Error',
                    detail: error.message
                }), { status: error.statusCode });
            }
            return c.json(serializeError({
                status: '500',
                title: 'Internal Server Error',
                detail: 'An unexpected error occurred.'
            }), { status: 500 });
        }
    }
}