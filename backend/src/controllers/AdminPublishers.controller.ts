import { Context } from 'hono';
import { newPublisherSchema, publisherUpdateSchema } from "@/validators/publisher.validator";
import { AdminPublishersService } from "@/services/adminPublishers.service";
import { serializeResource, serializeCollection, serializeError } from "../utils/jsonapi";
import { z } from "zod";
import { APIError } from '@/lib/APIError'; // Assuming APIError is in lib
import { PublisherMemberRole } from '../types/enums';

// Interface for user object potentially set by middleware
// interface AuthenticatedUser {
//     id: string;
// }

export class AdminPublishersController {
    static async createPublisher(c: Context): Promise<Response> {
        try {
            // TODO: MIGRATE_MIDDLEWARE - This relies on 'c.get('user')' which comes from requireAuth/validateAdmin middleware
            const user = c.get('user') as { id: string } | undefined;
            if (!user || !user.id) {
                throw new APIError(401, 'Unauthorized', 'Admin privileges required.');
            }
            const userId = user.id;

            const body = await c.req.json();
            const validationResult = newPublisherSchema.safeParse(body);

            if (!validationResult.success) {
                return c.json(serializeError({
                    status: '400',
                    title: 'Validation Error',
                    detail: "Invalid request body for creating publisher",
                    meta: { errors: validationResult.error.flatten().fieldErrors }
                }), 400);
            }

            const publisher = await AdminPublishersService.createPublisher(validationResult.data, userId);
            return c.json(serializeResource('publisher', publisher), 201);
        } catch (error: any) {
            console.error("[CONTROLLER_ADMIN_PUBLISHER] Error creating publisher:", error);
            if (error instanceof APIError) throw error;
            throw new APIError(error.statusCode || 500, error.message || "Error creating publisher", error.errorCode);
        }
    }

    static async listPublishers(c: Context): Promise<Response> {
        try {
            const query = c.req.query();
            const options = {
                page: query.page ? parseInt(query.page, 10) : 1,
                limit: query.limit ? parseInt(query.limit, 10) : 20,
                search: query.search,
                verified: query.verified !== undefined ? query.verified === 'true' : undefined,
                partnered: query.partnered !== undefined ? query.partnered === 'true' : undefined,
                sortBy: (query.sortBy as 'publisherName' | 'createdAt' | 'verified' | 'partnered') || 'createdAt',
                sortOrder: (query.sortOrder as 'ASC' | 'DESC') || 'DESC'
            };

            const result = await AdminPublishersService.listPublishers(options);
            return c.json({
                data: result.publishers,
                meta: {
                    total: result.total,
                    page: result.page,
                    totalPages: result.totalPages,
                    limit: options.limit
                }
            }, 200);
        } catch (error: any) {
            console.error("[CONTROLLER_ADMIN_PUBLISHER] Error listing publishers:", error);
            if (error instanceof APIError) throw error;
            throw new APIError(error.statusCode || 500, error.name || 'List Publishers Error', error.message || "Error listing publishers");
        }
    }

    static async getPublisher(c: Context): Promise<Response> {
        try {
            const publisherId = c.req.param('publisherId');
            if (!publisherId) { // Should be guaranteed by route, but good practice
                throw new APIError(400, 'Bad Request', 'Publisher ID is missing from path.');
            }

            const publisherDetails = await AdminPublishersService.getPublisherDetails(publisherId);
            if (!publisherDetails) {
                throw new APIError(404, 'Not Found', 'Publisher not found.');
            }
            return c.json(serializeResource('publisher', publisherDetails), 200);
        } catch (error: any) {
            console.error("[CONTROLLER_ADMIN_PUBLISHER] Error getting publisher details:", error);
            if (error instanceof APIError) throw error;
            throw new APIError(error.statusCode || 500, error.name || 'Get Publisher Error', error.message || "Error getting publisher details.");
        }
    }

    static async updatePublisher(c: Context): Promise<Response> {
        try {
            // TODO: MIGRATE_MIDDLEWARE - This relies on 'c.get('user')'
            const user = c.get('user') as { id: string } | undefined;
            if (!user || !user.id) {
                throw new APIError(401, 'Unauthorized', 'Admin privileges required.');
            }
            const adminUserId = user.id;
            const publisherId = c.req.param('publisherId');
            if (!publisherId) {
                throw new APIError(400, 'Bad Request', 'Publisher ID is missing from path.');
            }

            const body = await c.req.json();
            const validationResult = publisherUpdateSchema.safeParse(body);

            if (!validationResult.success) {
                return c.json(serializeError({
                    status: '400',
                    title: 'Validation Error',
                    detail: "Invalid request body for updating publisher",
                    meta: { errors: validationResult.error.flatten().fieldErrors }
                }), 400);
            }

            if (Object.keys(validationResult.data).length === 0) {
                return c.json(serializeError({
                    status: '400',
                    title: 'Bad Request',
                    detail: "Request body is empty or contains no updatable fields."
                }), 400);
            }

            const updatedPublisher = await AdminPublishersService.updatePublisher(publisherId, validationResult.data, adminUserId);
            return c.json(serializeResource('publisher', updatedPublisher), 200);
        } catch (error: any) {
            console.error("[CONTROLLER_ADMIN_PUBLISHER] Error updating publisher:", error);
            if (error instanceof APIError) throw error;
            const statusCode = error.statusCode || (error.message && error.message.includes("not found") ? 404 : 500);
            throw new APIError(statusCode, error.message || "Error updating publisher", error.errorCode);
        }
    }

    static async deletePublisher(c: Context): Promise<Response> {
        try {
            // TODO: MIGRATE_MIDDLEWARE - This relies on 'c.get('user')'
            const user = c.get('user') as { id: string } | undefined;
            if (!user || !user.id) {
                throw new APIError(401, 'Unauthorized', 'Admin privileges required.');
            }
            const adminUserId = user.id;
            const publisherId = c.req.param('publisherId');
            if (!publisherId) {
                throw new APIError(400, 'Bad Request', 'Publisher ID is missing from path.');
            }

            await AdminPublishersService.deletePublisher(publisherId, adminUserId);
            return c.body(null, 204);
        } catch (error: any) {
            console.error("[CONTROLLER_ADMIN_PUBLISHER] Error deleting publisher:", error);
            if (error instanceof APIError) throw error;
            throw new APIError(error.statusCode || 500, error.message || "Error deleting publisher", error.errorCode);
        }
    }

    static async getPublisherMembers(c: Context): Promise<Response> {
        try {
            const publisherId = c.req.param('publisherId');
            if (!publisherId) {
                throw new APIError(400, 'Bad Request', 'Publisher ID is missing from path.');
            }

            const query = c.req.query();
            const page = query.page ? parseInt(query.page, 10) : 1;
            const limit = query.limit ? parseInt(query.limit, 10) : 20;

            const result = await AdminPublishersService.getPublisherMembers(publisherId, page, limit);
            return c.json({
                data: result.members,
                meta: {
                    total: result.total,
                    page,
                    totalPages: Math.ceil(result.total / limit),
                    limit
                }
            }, 200);
        } catch (error: any) {
            console.error("[CONTROLLER_ADMIN_PUBLISHER] Error getting publisher members:", error);
            if (error instanceof APIError) throw error;
            throw new APIError(error.statusCode || 500, error.name || 'Get Publisher Members Error', error.message || "Error getting publisher members");
        }
    }

    static async addMember(c: Context): Promise<Response> {
        try {
            const user = c.get('user') as { id: string } | undefined;
            if (!user || !user.id) {
                throw new APIError(401, 'Unauthorized', 'Admin privileges required.');
            }
            const adminUserId = user.id;
            const publisherId = c.req.param('publisherId');
            if (!publisherId) {
                throw new APIError(400, 'Bad Request', 'Publisher ID is missing from path.');
            }

            const body = await c.req.json();
            const { userId, role } = body;

            if (!userId || !role) {
                throw new APIError(400, 'Bad Request', 'userId and role are required.');
            }

            if (!Object.values(PublisherMemberRole).includes(role)) {
                throw new APIError(400, 'Bad Request', 'Invalid role specified.');
            }

            const member = await AdminPublishersService.addMember(publisherId, { userId, role }, adminUserId);
            return c.json(serializeResource('publisherMember', member), 201);
        } catch (error: any) {
            console.error("[CONTROLLER_ADMIN_PUBLISHER] Error adding publisher member:", error);
            if (error instanceof APIError) throw error;
            throw new APIError(error.statusCode || 500, error.name || 'Add Publisher Member Error', error.message || "Error adding publisher member");
        }
    }

    static async removeMember(c: Context): Promise<Response> {
        try {
            const user = c.get('user') as { id: string } | undefined;
            if (!user || !user.id) {
                throw new APIError(401, 'Unauthorized', 'Admin privileges required.');
            }
            const adminUserId = user.id;
            const publisherId = c.req.param('publisherId');
            const userId = c.req.param('userId');

            if (!publisherId || !userId) {
                throw new APIError(400, 'Bad Request', 'Publisher ID and User ID are required.');
            }

            await AdminPublishersService.removeMember(publisherId, userId, adminUserId);
            return c.body(null, 204);
        } catch (error: any) {
            console.error("[CONTROLLER_ADMIN_PUBLISHER] Error removing publisher member:", error);
            if (error instanceof APIError) throw error;
            throw new APIError(error.statusCode || 500, error.name || 'Remove Publisher Member Error', error.message || "Error removing publisher member");
        }
    }

    static async updateMemberRole(c: Context): Promise<Response> {
        try {
            const user = c.get('user') as { id: string } | undefined;
            if (!user || !user.id) {
                throw new APIError(401, 'Unauthorized', 'Admin privileges required.');
            }
            const adminUserId = user.id;
            const publisherId = c.req.param('publisherId');
            const userId = c.req.param('userId');

            if (!publisherId || !userId) {
                throw new APIError(400, 'Bad Request', 'Publisher ID and User ID are required.');
            }

            const body = await c.req.json();
            const { role } = body;

            if (!role || !Object.values(PublisherMemberRole).includes(role)) {
                throw new APIError(400, 'Bad Request', 'Valid role is required.');
            }
            // Verificar el rol del usuario actual dentro del publisher
            // c.get('user') debería contener publisherMemberships (establecido por el middleware de autenticación)
            const currentUser = c.get('user') as any;
            const membership = currentUser?.publisherMemberships?.find((m: any) => m.publisherId === publisherId);
            const currentUserRole = membership?.role as string | undefined;

            if (!membership || !['owner', 'admin'].includes(String(currentUserRole).toLowerCase())) {
                throw new APIError(403, 'Forbidden', 'Insufficient publisher role to update member roles.');
            }

            const updatedMember = await AdminPublishersService.updateMemberRole(publisherId, userId, role, adminUserId);
            return c.json(serializeResource('publisherMember', updatedMember), 200);
        } catch (error: any) {
            console.error("[CONTROLLER_ADMIN_PUBLISHER] Error updating publisher member role:", error);
            if (error instanceof APIError) throw error;
            throw new APIError(error.statusCode || 500, error.name || 'Update Publisher Member Role Error', error.message || "Error updating publisher member role");
        }
    }
}
