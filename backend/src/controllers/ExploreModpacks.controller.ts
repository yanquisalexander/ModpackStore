import { type Context } from 'hono';
import { getExploreModpacks, getModpackById, searchModpacks } from "@/services/modpacks";
import { serializeCollection, serializeResource, serializeError } from "../utils/jsonapi";
import { ModpackVersion } from "@/entities/ModpackVersion";
import { ModpackVersionStatus } from "@/types/enums";
import { DOWNLOAD_PREFIX_URL } from "@/services/r2UploadService";

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

    static async getModpackVersions(c: Context): Promise<Response> {
        const modpackId = c.req.param('modpackId');

        try {
            const versions = await ModpackVersion.find({
                where: { modpackId, status: ModpackVersionStatus.PUBLISHED },
                relations: ['files', 'files.file'],
                select: {
                    id: true,
                    changelog: true,
                    mcVersion: true,
                    forgeVersion: true,
                    releaseDate: true,
                    status: true,

                    version: true,
                    files: {
                        path: true,
                        file: {
                            type: true
                        }
                    }
                }
            });
            return c.json(serializeCollection('modpackVersion', versions), 200);
        } catch (error: any) {
            console.error(`[CONTROLLER_EXPLORE] Error in getModpackVersions for ID ${modpackId}:`, error);
            const statusCode = error.statusCode || 500;
            return c.json(serializeError({
                status: statusCode.toString(),
                title: error.name || 'Modpack Versions Error',
                detail: error.message || "Failed to fetch modpack versions."
            }), statusCode);
        }
    }

    static async getModpackVersionManifest(c: Context): Promise<Response> {
        const modpackId = c.req.param('modpackId');
        const versionId = c.req.param('versionId');

        try {
            const mpVersion = await ModpackVersion.findOne({
                where: { id: versionId, modpackId },
                relations: ['files', 'files.file'],
                select: {
                    id: true,
                    changelog: true,
                    mcVersion: true,
                    forgeVersion: true,
                    releaseDate: true,
                    status: true,
                    version: true,
                    files: {
                        path: true,
                        fileHash: true,
                        file: {
                            type: true,
                            size: true,
                        }
                    }
                }
            });
            if (!mpVersion) {
                return c.json(serializeError({
                    status: '404',
                    title: 'Not Found',
                    detail: "Modpack version not found.",
                }), 404);
            }

            // Generar manifiesto con URLs de descarga
            const getDownloadUrl = (hash: string) => new URL(`${hash.slice(0, 2)}/${hash.slice(2, 4)}/${hash}`, DOWNLOAD_PREFIX_URL).toString();
            const manifest = {
                ...mpVersion,
                files: mpVersion.files.map(file => ({
                    ...file,
                    downloadUrl: getDownloadUrl(file.fileHash)
                }))
            };

            return c.json(manifest, 200);
        } catch (error: any) {
            console.error(`[CONTROLLER_EXPLORE] Error in getModpackVersionManifest for ID ${modpackId} and Version ${versionId}:`, error);
            const statusCode = error.statusCode || 500;
            return c.json(serializeError({
                status: statusCode.toString(),
                title: error.name || 'Modpack Version Error',
                detail: error.message || "Failed to fetch modpack version."
            }), statusCode);
        }
    }
}