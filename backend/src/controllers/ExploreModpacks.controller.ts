import { type NextFunction, type Request, type Response } from 'express';
import { getExploreModpacks, getModpackById, searchModpacks } from "@/services/modpacks"; // Assuming this service handles underlying logic

export class ExploreModpacksController {
    static async getHomepage(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const data = await getExploreModpacks();
            // It's good practice for services to return data in a client-safe format.
            // If not, transformation/serialization (e.g. modpack.toPublicJson()) might be needed here or in the service.
            res.status(200).json({ data });
        } catch (error: any) {
            console.error("[CONTROLLER_EXPLORE] Error in getHomepage:", error);
            res.status(error.statusCode || 500).json({
                message: error.message || "Failed to fetch homepage modpacks."
            });
        }
    }

    static async search(req: Request, res: Response, next: NextFunction): Promise<void> {
        const { q } = req.query;

        if (!q) {
            res.status(400).json({ message: 'Missing search query parameter (q).' });
            return;
        }

        if (typeof q !== 'string' || q.length < 3) {
            res.status(400).json({ message: 'Search query (q) must be a string of at least 3 characters.' });
            return;
        }

        try {
            const data = await searchModpacks(q); // Service should handle toString() or type checking if necessary
            res.status(200).json({ data });
        } catch (error: any) {
            console.error("[CONTROLLER_EXPLORE] Error in search:", error);
            res.status(error.statusCode || 500).json({
                message: error.message || "Failed to search modpacks."
            });
        }
    }

    static async getModpack(req: Request, res: Response, next: NextFunction): Promise<void> {
        const { modpackId } = req.params;

        if (!modpackId) {
            // This check might be redundant if routing ensures modpackId is always present.
            res.status(400).json({ message: 'Missing modpack ID in URL parameters.' });
            return;
        }

        try {
            const data = await getModpackById(modpackId);
            if (!data) {
                // Service explicitly returns null or undefined if not found
                res.status(404).json({ message: "Modpack not found." });
                return;
            }
            res.status(200).json({ data });
        } catch (error: any) {
            console.error(`[CONTROLLER_EXPLORE] Error in getModpack for ID ${modpackId}:`, error);
            // If getModpackById can throw specific "NotFound" errors, catch them here.
            // Otherwise, a generic error might hide a 404 case if service throws generally.
            res.status(error.statusCode || 500).json({
                message: error.message || "Failed to fetch modpack details."
            });
        }
    }
}