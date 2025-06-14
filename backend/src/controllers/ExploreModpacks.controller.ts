import { type Context } from 'hono';
import { getExploreModpacks, getModpackById, searchModpacks } from "@/services/modpacks";
import { serializeCollection, serializeResource, serializeError } from "../utils/jsonapi";

export class ExploreModpacksController {
    static async getHomepage(c: Context): Promise<Response> {
        try {
            const modpacks = await getExploreModpacks(); // Assuming this returns an array of modpacks
            return c.json(serializeCollection('modpack', modpacks), 200);
        } catch (error: any) {
            console.error("[CONTROLLER_EXPLORE] Error in getHomepage:", error);
            const statusCode = error.statusCode || 500;
            return c.json(serializeError({
                status: statusCode.toString(),
                title: error.name || 'Homepage Error',
                detail: error.message || "Failed to fetch homepage modpacks."
            }), statusCode);
        }
    }

    static async search(c: Context): Promise<Response> {
        const q = c.req.query('q');

        if (!q) {
            return c.json(serializeError({
                status: '400',
                title: 'Bad Request',
                detail: 'Missing search query parameter (q).',
            }), 400);
        }

        if (typeof q !== 'string' || q.length < 3) {
            return c.json(serializeError({
                status: '400',
                title: 'Bad Request',
                detail: 'Search query (q) must be a string of at least 3 characters.',
            }), 400);
        }

        try {
            const modpacks = await searchModpacks(q); // Service should handle toString() or type checking
            return c.json(serializeCollection('modpack', modpacks), 200);
        } catch (error: any) {
            console.error("[CONTROLLER_EXPLORE] Error in search:", error);
            const statusCode = error.statusCode || 500;
            return c.json(serializeError({
                status: statusCode.toString(),
                title: error.name || 'Search Error',
                detail: error.message || "Failed to search modpacks."
            }), statusCode);
        }
    }

    static async getModpack(c: Context): Promise<Response> {
        const modpackId = c.req.param('modpackId');

        // modpackId is guaranteed by the route, no need to check for its existence here.

        try {
            const modpack = await getModpackById(modpackId);
            if (!modpack) {
                return c.json(serializeError({
                    status: '404',
                    title: 'Not Found',
                    detail: "Modpack not found.",
                }), 404);
            }
            return c.json(serializeResource('modpack', modpack), 200);
        } catch (error: any) {
            console.error(`[CONTROLLER_EXPLORE] Error in getModpack for ID ${modpackId}:`, error);
            const statusCode = error.statusCode || 500;
            return c.json(serializeError({
                status: statusCode.toString(),
                title: error.name || 'Modpack Error',
                detail: error.message || "Failed to fetch modpack details."
            }), statusCode);
        }
    }
}