import { Request, Response } from "express";
import { newPublisherSchema, publisherUpdateSchema } from "@/models/Publisher.model"; // Schemas directly from model
import { AdminPublishersService } from "@/services/adminPublishers.service";
import { z } from "zod";

// Extend Express Request type to include user (if not already globally typed)
interface AuthenticatedRequest extends Request {
    user?: {
        id: string;
        // e.g., admin?: boolean;
    };
}

export class AdminPublishersController {
    static async createPublisher(req: AuthenticatedRequest, res: Response) {
        try {
            // The adminAuth middleware should already ensure req.user and req.user.id exist
            // and that the user is an admin.
            const userId = req.user!.id; // Non-null assertion due to preceding adminAuth middleware

            const validationResult = newPublisherSchema.safeParse(req.body);
            if (!validationResult.success) {
                return res.status(400).json({
                    message: "Invalid request body for creating publisher",
                    errors: validationResult.error.flatten().fieldErrors
                });
            }

            const publisherJson = await AdminPublishersService.createPublisher(validationResult.data, userId);
            res.status(201).json(publisherJson);
        } catch (error: any) {
            console.error("[CONTROLLER_ADMIN_PUBLISHER] Error creating publisher:", error);
            res.status(error.statusCode || 500).json({
                message: error.message || "Error creating publisher",
                ...(error.errorCode && { error_code: error.errorCode }),
            });
        }
    }

    static async listPublishers(req: Request, res: Response) {
        try {
            const publishersJson = await AdminPublishersService.listPublishers();
            res.status(200).json(publishersJson);
        } catch (error: any) {
            console.error("[CONTROLLER_ADMIN_PUBLISHER] Error listing publishers:", error);
            res.status(error.statusCode || 500).json({ message: error.message || "Error listing publishers" });
        }
    }

    static async getPublisher(req: Request, res: Response) {
        try {
            const { publisherId } = req.params;
            if (!publisherId) { // Basic validation, though routing might enforce this
                return res.status(400).json({ message: "Publisher ID is required in URL parameters." });
            }

            const publisherDetails = await AdminPublishersService.getPublisherDetails(publisherId);
            if (!publisherDetails) {
                return res.status(404).json({ message: "Publisher not found." });
            }
            res.status(200).json(publisherDetails);
        } catch (error: any) {
            console.error("[CONTROLLER_ADMIN_PUBLISHER] Error getting publisher details:", error);
            res.status(error.statusCode || 500).json({ message: error.message || "Error getting publisher details." });
        }
    }

    static async updatePublisher(req: AuthenticatedRequest, res: Response) {
        try {
            const { publisherId } = req.params;
             if (!publisherId) {
                return res.status(400).json({ message: "Publisher ID is required in URL parameters." });
            }
            // Admin user ID for logging or potential authorization checks within the service
            const adminUserId = req.user!.id;

            const validationResult = publisherUpdateSchema.safeParse(req.body);
            if (!validationResult.success) {
                return res.status(400).json({
                    message: "Invalid request body for updating publisher",
                    errors: validationResult.error.flatten().fieldErrors
                });
            }

            if (Object.keys(validationResult.data).length === 0) {
                return res.status(400).json({ message: "Request body is empty or contains no updatable fields."});
            }

            const updatedPublisherJson = await AdminPublishersService.updatePublisher(publisherId, validationResult.data, adminUserId);
            res.status(200).json(updatedPublisherJson);
        } catch (error: any) {
            console.error("[CONTROLLER_ADMIN_PUBLISHER] Error updating publisher:", error);
             if (error.message.includes("Publisher not found")) { // Example of more specific error handling
                return res.status(404).json({ message: "Publisher not found for update." });
            }
            res.status(error.statusCode || 500).json({
                message: error.message || "Error updating publisher",
                ...(error.errorCode && { error_code: error.errorCode }),
            });
        }
    }

    static async deletePublisher(req: AuthenticatedRequest, res: Response) {
        try {
            const { publisherId } = req.params;
            if (!publisherId) {
                return res.status(400).json({ message: "Publisher ID is required in URL parameters." });
            }
            const adminUserId = req.user!.id;

            const success = await AdminPublishersService.deletePublisher(publisherId, adminUserId);
            if (!success) {
                // This might occur if the service returns false because publisher wasn't found prior to delete
                return res.status(404).json({ message: "Publisher not found or could not be deleted." });
            }
            res.status(200).json({ message: "Publisher deleted successfully." });
            // Or use 204 No Content: res.status(204).send();
        } catch (error: any) {
            console.error("[CONTROLLER_ADMIN_PUBLISHER] Error deleting publisher:", error);
            res.status(error.statusCode || 500).json({
                message: error.message || "Error deleting publisher",
                ...(error.errorCode && { error_code: error.errorCode }),
            });
        }
    }
}
