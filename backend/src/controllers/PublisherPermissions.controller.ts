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
    private static _publisherService: PublisherService | null = null;

    private static getPublisherService(): PublisherService {
        console.log('[DEBUG] getPublisherService called, this:', this);
        console.log('[DEBUG] _publisherService before:', this._publisherService);

        if (!this._publisherService) {
            console.log('[DEBUG] Creating new PublisherService instance');
            try {
                this._publisherService = new PublisherService();
                console.log('[DEBUG] PublisherService created successfully');
            } catch (error) {
                console.error('[DEBUG] Error creating PublisherService:', error);
                throw error;
            }
        }

        console.log('[DEBUG] Returning PublisherService:', !!this._publisherService);
        return this._publisherService;
    }

    /**
     * Get all members of a publisher with their permissions
     */
    static async getMembers(c: Context): Promise<Response> {
        console.log('[DEBUG] getMembers called, this:', this);
        console.log('[DEBUG] PublisherService imported:', !!PublisherService);

        try {
            const user = c.get('user') as { id: string } | undefined;
            if (!user?.id) {
                throw new APIError(401, 'Authentication required.');
            }

            const publisherId = c.req.param('publisherId');
            if (!publisherId) {
                throw new APIError(400, 'Publisher ID is required.');
            }

            console.log('[DEBUG] About to call getPublisherService');
            // Check if user has permission to view members
            const canViewMembers = await PublisherPermissionsController.getPublisherService().hasUserPermission(
                publisherId,
                user.id,
                'manage_members'
            );

            if (!canViewMembers) {
                throw new APIError(403, 'You do not have permission to view members.');
            }

            const members = await PublisherPermissionsController.getPublisherService().getMembers(publisherId);

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
                }), { status: error.statusCode as any });
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
            const canManageMembers = await PublisherPermissionsController.getPublisherService().hasUserPermission(
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
            const canManageRole = await PublisherPermissionsController.getPublisherService().canManageRole(
                publisherId,
                user.id,
                role
            );

            if (!canManageRole) {
                throw new APIError(403, 'You do not have permission to assign this role.');
            }

            const newMember = await PublisherPermissionsController.getPublisherService().addMember(publisherId, targetUserId, role);

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
                }), { status: error.statusCode as any });
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
            const canManageAccess = await PublisherPermissionsController.getPublisherService().hasUserPermission(
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

            await PublisherPermissionsController.getPublisherService().assignPermissionToMember(
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
                }), { status: error.statusCode as any });
            }
            return c.json(serializeError({
                status: '500',
                title: 'Internal Server Error',
                detail: 'An unexpected error occurred.'
            }), { status: 500 });
        }
    }

    /**
     * Update a member's role in a publisher
     */
    static async updateMemberRole(c: Context): Promise<Response> {
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

            // Check if user has permission to manage members
            const canManageMembers = await PublisherPermissionsController.getPublisherService().hasUserPermission(
                publisherId,
                user.id,
                'manage_members'
            );

            if (!canManageMembers) {
                throw new APIError(403, 'You do not have permission to manage members.');
            }

            const body = await c.req.json();
            const { role } = body;

            // Validate role
            if (!role || !Object.values(PublisherMemberRole).includes(role)) {
                throw new APIError(400, 'Invalid role provided.');
            }

            // Check if requesting user can assign this role
            const canManageRole = await PublisherPermissionsController.getPublisherService().canManageRole(
                publisherId,
                user.id,
                role
            );

            if (!canManageRole) {
                throw new APIError(403, 'You do not have permission to assign this role.');
            }

            const updatedMember = await PublisherPermissionsController.getPublisherService().updateMemberRole(
                publisherId,
                targetUserId,
                role
            );

            return c.json(serializeResource('publisher-member', {
                id: updatedMember.id.toString(),
                userId: updatedMember.userId,
                role: updatedMember.role,
                updatedAt: updatedMember.updatedAt
            }), { status: 200 });

        } catch (error) {
            console.error('Error updating member role:', error);
            if (error instanceof APIError) {
                return c.json(serializeError({
                    status: error.statusCode.toString(),
                    title: 'Error',
                    detail: error.message
                }), { status: error.statusCode as any });
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
            const canViewPermissions = await PublisherPermissionsController.getPublisherService().hasUserPermission(
                publisherId,
                user.id,
                'manage_members'
            ) || await PublisherPermissionsController.getPublisherService().hasUserPermission(
                publisherId,
                user.id,
                'modpack.manage_access'
            );

            if (!canViewPermissions) {
                throw new APIError(403, 'You do not have permission to view permissions.');
            }

            const scopes = await PublisherPermissionsController.getPublisherService().getMemberScopes(publisherId, targetUserId);

            console.log('[DEBUG] Scopes from database:', scopes.map(scope => ({
                id: scope.id,
                publisherId: scope.publisherId,
                modpackId: scope.modpackId,
                publisher: scope.publisher?.id,
                modpack: scope.modpack?.id
            })));

            return c.json(serializeCollection('scopes', scopes.map(scope => ({
                id: scope.id.toString(),
                publisherId: scope.publisherId || scope.publisher?.id,
                modpackId: scope.modpackId || scope.modpack?.id,
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
                }), { status: error.statusCode as any });
            }
            return c.json(serializeError({
                status: '500',
                title: 'Internal Server Error',
                detail: 'An unexpected error occurred.'
            }), { status: 500 });
        }
    }
}