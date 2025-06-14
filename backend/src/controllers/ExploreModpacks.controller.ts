import { type NextFunction, type Request, type Response } from 'express';
import { getExploreModpacks, getModpackById, searchModpacks } from "@/services/modpacks";
import { serializeCollection, serializeResource, serializeError } from "../utils/jsonapi";

export class ExploreModpacksController {
    static async getHomepage(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const modpacks = await getExploreModpacks(); // Assuming this returns an array of modpacks
            res.status(200).json(serializeCollection('modpack', modpacks));
        } catch (error: any) {
            console.error("[CONTROLLER_EXPLORE] Error in getHomepage:", error);
            const statusCode = error.statusCode || 500;
            res.status(statusCode).json(serializeError({
                status: statusCode.toString(),
                title: error.name || 'Homepage Error',
                detail: error.message || "Failed to fetch homepage modpacks."
            }));
        }
    }

    static async search(req: Request, res: Response, next: NextFunction): Promise<void> {
        const { q } = req.query;

        if (!q) {
            res.status(400).json(serializeError({
                status: '400',
                title: 'Bad Request',
                detail: 'Missing search query parameter (q).',
            }));
            return;
        }

        if (typeof q !== 'string' || q.length < 3) {
            res.status(400).json(serializeError({
                status: '400',
                title: 'Bad Request',
                detail: 'Search query (q) must be a string of at least 3 characters.',
            }));
            return;
        }

        try {
            const modpacks = await searchModpacks(q as string); // Service should handle toString() or type checking
            res.status(200).json(serializeCollection('modpack', modpacks));
        } catch (error: any) {
            console.error("[CONTROLLER_EXPLORE] Error in search:", error);
            const statusCode = error.statusCode || 500;
            res.status(statusCode).json(serializeError({
                status: statusCode.toString(),
                title: error.name || 'Search Error',
                detail: error.message || "Failed to search modpacks."
            }));
        }
    }

    static async getModpack(req: Request, res: Response, next: NextFunction): Promise<void> {
        const { modpackId } = req.params;

        // modpackId is guaranteed by the route, no need to check for its existence here.

        try {
            const modpack = await getModpackById(modpackId);
            if (!modpack) {
                res.status(404).json(serializeError({
                    status: '404',
                    title: 'Not Found',
                    detail: "Modpack not found.",
                }));
                return;
            }
            res.status(200).json(serializeResource('modpack', modpack));
        } catch (error: any) {
            console.error(`[CONTROLLER_EXPLORE] Error in getModpack for ID ${modpackId}:`, error);
            const statusCode = error.statusCode || 500;
            res.status(statusCode).json(serializeError({
                status: statusCode.toString(),
                title: error.name || 'Modpack Error',
                detail: error.message || "Failed to fetch modpack details."
            }));
        }
    }
}