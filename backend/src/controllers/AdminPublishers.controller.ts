import { Context } from 'hono';
import { newPublisherSchema, publisherUpdateSchema } from "@/models/Publisher.model";
import { AdminPublishersService } from "@/services/adminPublishers.service";
import { serializeResource, serializeCollection, serializeError } from "../utils/jsonapi";
import { z } from "zod";
import { APIError } from '@/lib/APIError'; // Assuming APIError is in lib

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
            throw new APIError(error.statusCode || 500, error.name || 'Create Publisher Error', error.message || "Error creating publisher", error.errorCode);
        }
    }

    static async listPublishers(c: Context): Promise<Response> {
        try {
            const publishers = await AdminPublishersService.listPublishers();
            return c.json(serializeCollection('publisher', publishers), 200);
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
            throw new APIError(statusCode, error.name || (statusCode === 404 ? 'Not Found' : 'Update Publisher Error'), error.message || "Error updating publisher", error.errorCode);
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
            const statusCode = error.statusCode || (error.message && error.message.includes("not found") ? 404 : 500);
            throw new APIError(statusCode, error.name || (statusCode === 404 ? 'Not Found' : 'Delete Publisher Error'), error.message || "Error deleting publisher", error.errorCode);
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
                throw new APIError(400, 'Bad Request', 'User ID and role are required.');
            }

            await AdminPublishersService.addMember(publisherId, userId, role, adminUserId);
            return c.body(null, 201);
        } catch (error: any) {
            console.error("[CONTROLLER_ADMIN_PUBLISHER] Error adding member:", error);
            if (error instanceof APIError) throw error;
            throw new APIError(500, 'Add Member Error', error.message || "Error adding member");
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
            console.error("[CONTROLLER_ADMIN_PUBLISHER] Error removing member:", error);
            if (error instanceof APIError) throw error;
            throw new APIError(500, 'Remove Member Error', error.message || "Error removing member");
        }
    }

    static async getMembers(c: Context): Promise<Response> {
        try {
            const publisherId = c.req.param('publisherId');
            if (!publisherId) {
                throw new APIError(400, 'Bad Request', 'Publisher ID is missing from path.');
            }

            const members = await AdminPublishersService.getPublisherMembers(publisherId);
            return c.json(serializeCollection('publisher-member', members), 200);
        } catch (error: any) {
            console.error("[CONTROLLER_ADMIN_PUBLISHER] Error getting members:", error);
            if (error instanceof APIError) throw error;
            throw new APIError(500, 'Get Members Error', error.message || "Error getting members");
        }
    }

    static async getModpacks(c: Context): Promise<Response> {
        try {
            const publisherId = c.req.param('publisherId');
            if (!publisherId) {
                throw new APIError(400, 'Bad Request', 'Publisher ID is missing from path.');
            }

            const limit = parseInt(c.req.query('limit') || '20');
            const offset = parseInt(c.req.query('offset') || '0');

            const result = await AdminPublishersService.getPublisherModpacks(publisherId, limit, offset);
            return c.json({
                data: serializeCollection('modpack', result.modpacks),
                meta: {
                    total: result.total,
                    limit,
                    offset
                }
            }, 200);
        } catch (error: any) {
            console.error("[CONTROLLER_ADMIN_PUBLISHER] Error getting modpacks:", error);
            if (error instanceof APIError) throw error;
            throw new APIError(500, 'Get Modpacks Error', error.message || "Error getting modpacks");
        }
    }
}
