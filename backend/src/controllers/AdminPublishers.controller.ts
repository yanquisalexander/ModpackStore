import { Request, Response } from "express";
import { Publisher, newPublisherSchema, publisherUpdateSchema } from "../models/Publisher.model";
// User model might not be strictly necessary if req.user.id is available and typed.
// import { User } from "../models/User.model";

// Extend Express Request type to include user
interface AuthenticatedRequest extends Request {
    user?: {
        id: string;
        // Add other user properties if needed, e.g., admin: boolean
    };
}

export class AdminPublishersController {
    static async createPublisher(req: AuthenticatedRequest, res: Response) {
        try {
            if (!req.user || !req.user.id) {
                return res.status(401).json({ message: "Unauthorized: User not authenticated" });
            }
            const userId = req.user.id;

            const validationResult = newPublisherSchema.safeParse(req.body);
            if (!validationResult.success) {
                return res.status(400).json({
                    message: "Invalid request body",
                    errors: validationResult.error.flatten().fieldErrors
                });
            }

            const publisher = await Publisher.create(validationResult.data, userId);
            res.status(201).json(publisher.toJson());
        } catch (error) {
            console.error("Error creating publisher:", error);
            const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
            res.status(500).json({ message: "Error creating publisher", error: errorMessage });
        }
    }

    static async listPublishers(req: Request, res: Response) {
        try {
            // For now, using findActive. Admins might need to see all publishers (including banned) later.
            const publishers = await Publisher.findActive();
            res.status(200).json(publishers.map(p => p.toJson()));
        } catch (error) {
            console.error("Error listing publishers:", error);
            const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
            res.status(500).json({ message: "Error listing publishers", error: errorMessage });
        }
    }

    static async getPublisher(req: Request, res: Response) { // Renamed from getPublisherDetails to match route
        try {
            const { publisherId } = req.params;
            if (!publisherId) {
                return res.status(400).json({ message: "Publisher ID is required" });
            }

            const publisher = await Publisher.getCompletePublisher(publisherId);
            if (!publisher) {
                return res.status(404).json({ message: "Publisher not found" });
            }
            // Publisher.getCompletePublisher returns a slightly different structure
            // We might need to adapt this or use Publisher.findById and then toJson if the structure is incompatible
            res.status(200).json(publisher);
        } catch (error) {
            console.error("Error getting publisher details:", error);
            const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
            res.status(500).json({ message: "Error getting publisher details", error: errorMessage });
        }
    }

    static async updatePublisher(req: AuthenticatedRequest, res: Response) {
        try {
            const { publisherId } = req.params;
            if (!publisherId) {
                return res.status(400).json({ message: "Publisher ID is required" });
            }

            if (!req.user || !req.user.id) { // Ensure user is authenticated for update operations
                return res.status(401).json({ message: "Unauthorized: User not authenticated" });
            }

            const publisher = await Publisher.findById(publisherId);
            if (!publisher) {
                return res.status(404).json({ message: "Publisher not found" });
            }

            const validationResult = publisherUpdateSchema.safeParse(req.body);
            if (!validationResult.success) {
                return res.status(400).json({
                    message: "Invalid request body",
                    errors: validationResult.error.flatten().fieldErrors
                });
            }

            // TODO: Add authorization check here - does req.user.id have permission to update this publisher?
            // For now, any authenticated user can update, which is not ideal for admin routes.

            const updatedPublisher = await publisher.update(validationResult.data);
            res.status(200).json(updatedPublisher.toJson());
        } catch (error) {
            console.error("Error updating publisher:", error);
            const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
            res.status(500).json({ message: "Error updating publisher", error: errorMessage });
        }
    }

    static async deletePublisher(req: AuthenticatedRequest, res: Response) {
        try {
            const { publisherId } = req.params;
            if (!publisherId) {
                return res.status(400).json({ message: "Publisher ID is required" });
            }

            if (!req.user || !req.user.id) { // Ensure user is authenticated
                return res.status(401).json({ message: "Unauthorized: User not authenticated" });
            }

            const publisher = await Publisher.findById(publisherId);
            if (!publisher) {
                return res.status(404).json({ message: "Publisher not found" });
            }

            // TODO: Add authorization check here - does req.user.id have permission to delete this publisher?

            await publisher.delete();
            res.status(200).json({ message: "Publisher deleted successfully" });
            // Alternatively, use 204 No Content:
            // res.status(204).send();
        } catch (error) {
            console.error("Error deleting publisher:", error);
            const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
            res.status(500).json({ message: "Error deleting publisher", error: errorMessage });
        }
    }
}
