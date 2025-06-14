import { Request, Response } from "express";
import { newPublisherSchema, publisherUpdateSchema } from "@/models/Publisher.model";
import { AdminPublishersService } from "@/services/adminPublishers.service";
import { serializeResource, serializeCollection, serializeError } from "../utils/jsonapi";
import { z } from "zod";

interface AuthenticatedRequest extends Request {
    user?: {
        id: string;
    };
}

export class AdminPublishersController {
    static async createPublisher(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user!.id;
            const validationResult = newPublisherSchema.safeParse(req.body);

            if (!validationResult.success) {
                return res.status(400).json(serializeError({
                    status: '400',
                    title: 'Validation Error',
                    detail: "Invalid request body for creating publisher",
                    meta: { errors: validationResult.error.flatten().fieldErrors }
                }));
            }

            const publisher = await AdminPublishersService.createPublisher(validationResult.data, userId);
            res.status(201).json(serializeResource('publisher', publisher));
        } catch (error: any) {
            console.error("[CONTROLLER_ADMIN_PUBLISHER] Error creating publisher:", error);
            const statusCode = error.statusCode || 500;
            res.status(statusCode).json(serializeError({
                status: statusCode.toString(),
                title: error.name || 'Create Publisher Error',
                detail: error.message || "Error creating publisher",
                code: error.errorCode,
            }));
        }
    }

    static async listPublishers(req: Request, res: Response) {
        try {
            const publishers = await AdminPublishersService.listPublishers();
            res.status(200).json(serializeCollection('publisher', publishers));
        } catch (error: any) {
            console.error("[CONTROLLER_ADMIN_PUBLISHER] Error listing publishers:", error);
            const statusCode = error.statusCode || 500;
            res.status(statusCode).json(serializeError({
                status: statusCode.toString(),
                title: error.name || 'List Publishers Error',
                detail: error.message || "Error listing publishers"
            }));
        }
    }

    static async getPublisher(req: Request, res: Response) {
        try {
            const { publisherId } = req.params;
            // publisherId is guaranteed by the route.

            const publisherDetails = await AdminPublishersService.getPublisherDetails(publisherId);
            if (!publisherDetails) {
                return res.status(404).json(serializeError({
                    status: '404',
                    title: 'Not Found',
                    detail: "Publisher not found."
                }));
            }
            res.status(200).json(serializeResource('publisher', publisherDetails));
        } catch (error: any) {
            console.error("[CONTROLLER_ADMIN_PUBLISHER] Error getting publisher details:", error);
            const statusCode = error.statusCode || 500;
            res.status(statusCode).json(serializeError({
                status: statusCode.toString(),
                title: error.name || 'Get Publisher Error',
                detail: error.message || "Error getting publisher details."
            }));
        }
    }

    static async updatePublisher(req: AuthenticatedRequest, res: Response) {
        try {
            const { publisherId } = req.params;
            const adminUserId = req.user!.id;
            const validationResult = publisherUpdateSchema.safeParse(req.body);

            if (!validationResult.success) {
                return res.status(400).json(serializeError({
                    status: '400',
                    title: 'Validation Error',
                    detail: "Invalid request body for updating publisher",
                    meta: { errors: validationResult.error.flatten().fieldErrors }
                }));
            }

            if (Object.keys(validationResult.data).length === 0) {
                return res.status(400).json(serializeError({
                    status: '400',
                    title: 'Bad Request',
                    detail: "Request body is empty or contains no updatable fields."
                }));
            }

            const updatedPublisher = await AdminPublishersService.updatePublisher(publisherId, validationResult.data, adminUserId);
            res.status(200).json(serializeResource('publisher', updatedPublisher));
        } catch (error: any) {
            console.error("[CONTROLLER_ADMIN_PUBLISHER] Error updating publisher:", error);
            const statusCode = error.statusCode || (error.message.includes("not found") ? 404 : 500);
            res.status(statusCode).json(serializeError({
                status: statusCode.toString(),
                title: error.name || (statusCode === 404 ? 'Not Found' : 'Update Publisher Error'),
                detail: error.message || "Error updating publisher",
                code: error.errorCode,
            }));
        }
    }

    static async deletePublisher(req: AuthenticatedRequest, res: Response) {
        try {
            const { publisherId } = req.params;
            const adminUserId = req.user!.id;

            await AdminPublishersService.deletePublisher(publisherId, adminUserId);
            // JSON:API recommends 204 No Content for successful DELETE.
            // Alternatively, can return meta: { message: "Publisher deleted successfully." } with 200 OK.
            res.status(204).send();
        } catch (error: any) {
            console.error("[CONTROLLER_ADMIN_PUBLISHER] Error deleting publisher:", error);
            const statusCode = error.statusCode || (error.message.includes("not found") ? 404 : 500);
            res.status(statusCode).json(serializeError({
                status: statusCode.toString(),
                title: error.name || (statusCode === 404 ? 'Not Found' : 'Delete Publisher Error'),
                detail: error.message || "Error deleting publisher",
                code: error.errorCode,
            }));
        }
    }
}
