import { Request, Response, NextFunction } from 'express';
import { Modpack, NewModpack, ModpackUpdateData, ModpackStatus, newModpackSchema, modpackUpdateSchema, ModpackVisibility } from '@/models/Modpack.model';
import { ModpackVersion, NewModpackVersion, ModpackVersionStatus, newModpackVersionSchema, modpackVersionUpdateSchema } from '@/models/ModpackVersion.model'; // Added modpackVersionUpdateSchema
import { client as db } from '@/db/client';
import { ModpacksTable, ModpackVersionsTable, PublisherMembersTable, ScopesTable } from '@/db/schema';
import { and, eq, or, sql, inArray, desc, not } from 'drizzle-orm';
import { UserModpacksService } from '@/services/userModpacks.service';
import { serializeResource, serializeCollection, serializeError } from '../utils/jsonapi';

// Extend Express Request type
interface AuthenticatedRequest extends Request {
    user?: { id: string };
    params: {
        modpackId?: string;
        versionId?: string;
    };
    body: any;
}

export class UserModpacksController {
    // POST /v1/modpacks
    static async createModpack(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
        if (!req.user || !req.user.id) {
            res.status(401).json(serializeError({ status: '401', title: 'Unauthorized', detail: 'User authentication required.' }));
            return;
        }
        const userId = req.user.id;
        const { publisherId, name, slug, iconUrl, bannerUrl, shortDescription, description, visibility, trailerUrl, password, showUserAsPublisher } = req.body;

        const validationInput = {
            publisherId, name, slug, iconUrl, bannerUrl, shortDescription, description, visibility,
            trailerUrl, password, showUserAsPublisher,
            creatorUserId: userId,
        };

        const parseResult = newModpackSchema.safeParse(validationInput);

        if (!parseResult.success) {
            res.status(400).json(serializeError({
                status: '400',
                title: 'Validation Error',
                detail: 'Invalid modpack data provided.',
                meta: { errors: parseResult.error.format() }
            }));
            return;
        }

        try {
            const clientProvidedData = { publisherId, name, slug, iconUrl, bannerUrl, shortDescription, description, visibility, trailerUrl, password, showUserAsPublisher };
            const newModpack = await UserModpacksService.createModpack(clientProvidedData as NewModpack, userId);
            res.status(201).json(serializeResource('modpack', newModpack));
        } catch (error: any) {
            console.error('[CONTROLLER_USER_MODPACKS] Error creating modpack:', error);
            const statusCode = error.statusCode || 500;
            const errorDetail = error.field ? `${error.message} (field: ${error.field})` : error.message;
            res.status(statusCode).json(serializeError({
                status: statusCode.toString(),
                title: error.name || 'Create Modpack Error',
                detail: errorDetail || 'Failed to create modpack'
            }));
        }
    }

    // PATCH /v1/modpacks/:modpackId
    static async updateModpack(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
        if (!req.user || !req.user.id) {
            res.status(401).json(serializeError({ status: '401', title: 'Unauthorized', detail: 'User authentication required.' }));
            return;
        }
        const userId = req.user.id;
        const { modpackId } = req.params;

        if (!modpackId) { // Should be caught by routing, but good practice
            res.status(400).json(serializeError({ status: '400', title: 'Bad Request', detail: 'Modpack ID is required.' }));
            return;
        }

        const { publisherId, creatorUserId, slug, status, ...clientPayload } = req.body;
        const parseResult = modpackUpdateSchema.safeParse(clientPayload);

        if (!parseResult.success) {
            res.status(400).json(serializeError({
                status: '400',
                title: 'Validation Error',
                detail: 'Invalid modpack update data provided.',
                meta: { errors: parseResult.error.format() }
            }));
            return;
        }

        if (Object.keys(parseResult.data).length === 0) {
            res.status(400).json(serializeError({ status: '400', title: 'Bad Request', detail: "Request body is empty or contains no updatable fields for modpack." }));
            return;
        }

        try {
            const updatedModpack = await UserModpacksService.updateModpack(modpackId, parseResult.data, userId);
            res.status(200).json(serializeResource('modpack', updatedModpack));
        } catch (error: any) {
            console.error('[CONTROLLER_USER_MODPACKS] Error updating modpack:', error);
            const statusCode = error.statusCode || (error.message.includes("not found") ? 404 : 500);
            res.status(statusCode).json(serializeError({
                status: statusCode.toString(),
                title: error.name || (statusCode === 404 ? 'Not Found' : 'Update Modpack Error'),
                detail: error.message || 'Failed to update modpack'
            }));
        }
    }

    // DELETE /v1/modpacks/:modpackId
    static async deleteModpack(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
        if (!req.user || !req.user.id) {
            res.status(401).json(serializeError({ status: '401', title: 'Unauthorized', detail: 'User authentication required.' }));
            return;
        }
        const userId = req.user.id;
        const { modpackId } = req.params;

        if (!modpackId) { // Should be caught by routing
            res.status(400).json(serializeError({ status: '400', title: 'Bad Request', detail: 'Modpack ID is required.' }));
            return;
        }

        try {
            await UserModpacksService.deleteModpack(modpackId, userId);
            res.status(204).send();
        } catch (error: any) {
            console.error('[CONTROLLER_USER_MODPACKS] Error deleting modpack:', error);
            const statusCode = error.statusCode || (error.message.includes("not found") ? 404 : 500);
            res.status(statusCode).json(serializeError({
                status: statusCode.toString(),
                title: error.name || (statusCode === 404 ? 'Not Found' : 'Delete Modpack Error'),
                detail: error.message || 'Failed to delete modpack'
            }));
        }
    }

    // GET /v1/modpacks
    static async listUserModpacks(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
        if (!req.user || !req.user.id) {
            res.status(401).json(serializeError({ status: '401', title: 'Unauthorized', detail: 'User authentication required.' }));
            return;
        }
        const userId = req.user.id;

        try {
            const modpacks = await UserModpacksService.listUserModpacks(userId);
            res.status(200).json(serializeCollection('modpack', modpacks));
        } catch (error: any) {
            console.error('[CONTROLLER_USER_MODPACKS] Error listing user modpacks:', error);
            const statusCode = error.statusCode || 500;
            res.status(statusCode).json(serializeError({
                status: statusCode.toString(),
                title: error.name || 'List Modpacks Error',
                detail: error.message || 'Failed to list modpacks'
            }));
        }
    }

    // POST /v1/modpacks/:modpackId/versions
    static async createModpackVersion(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
        if (!req.user || !req.user.id) {
            res.status(401).json(serializeError({ status: '401', title: 'Unauthorized', detail: 'User authentication required.' }));
            return;
        }
        const userId = req.user.id;
        const { modpackId } = req.params;
        const { version, mcVersion, forgeVersion, changelog } = req.body;

        if (!modpackId) {
            res.status(400).json(serializeError({ status: '400', title: 'Bad Request', detail: 'Modpack ID is required.' }));
            return;
        }

        const versionPayload = { version, mcVersion, forgeVersion, changelog };
        const fullDataForValidation = { ...versionPayload, modpackId, createdBy: userId };
        const parseResult = newModpackVersionSchema.safeParse(fullDataForValidation);

        if (!parseResult.success) {
            res.status(400).json(serializeError({
                status: '400',
                title: 'Validation Error',
                detail: 'Invalid modpack version data provided.',
                meta: { errors: parseResult.error.format() }
            }));
            return;
        }

        try {
            const newVersion = await UserModpacksService.createModpackVersion(modpackId, versionPayload, userId);
            res.status(201).json(serializeResource('modpackVersion', newVersion));
        } catch (error: any) {
            console.error('[CONTROLLER_USER_MODPACKS] Error creating modpack version:', error);
            const statusCode = error.statusCode || 500;
            res.status(statusCode).json(serializeError({
                status: statusCode.toString(),
                title: error.name || 'Create Version Error',
                detail: error.message || 'Failed to create modpack version.'
            }));
        }
    }

    // PATCH /v1/versions/:versionId
    static async updateModpackVersion(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
        if (!req.user || !req.user.id) {
            res.status(401).json(serializeError({ status: '401', title: 'Unauthorized', detail: 'User authentication required.' }));
            return;
        }
        const userId = req.user.id;
        const { versionId } = req.params;
        const { mcVersion, forgeVersion, changelog, status, releaseDate } = req.body;
        const clientPayload = { mcVersion, forgeVersion, changelog, status, releaseDate };

        if (!versionId) {
            res.status(400).json(serializeError({ status: '400', title: 'Bad Request', detail: 'Version ID is required.' }));
            return;
        }

        const parseResult = modpackVersionUpdateSchema.safeParse(clientPayload);
        if (!parseResult.success) {
            res.status(400).json(serializeError({
                status: '400',
                title: 'Validation Error',
                detail: 'Invalid modpack version update data provided.',
                meta: { errors: parseResult.error.format() }
            }));
            return;
        }

        if (Object.keys(parseResult.data).length === 0) {
            res.status(400).json(serializeError({ status: '400', title: 'Bad Request', detail: "Request body is empty or contains no updatable fields for modpack version." }));
            return;
        }

        try {
            const updatedVersion = await UserModpacksService.updateModpackVersion(versionId, parseResult.data, userId);
            res.status(200).json(serializeResource('modpackVersion', updatedVersion));
        } catch (error: any) {
            console.error('[CONTROLLER_USER_MODPACKS] Error updating modpack version:', error);
            const statusCode = error.statusCode || (error.message.includes("not found") ? 404 : 500);
            res.status(statusCode).json(serializeError({
                status: statusCode.toString(),
                title: error.name || (statusCode === 404 ? 'Not Found' : 'Update Version Error'),
                detail: error.message || 'Failed to update modpack version.'
            }));
        }
    }

    // POST /v1/versions/:versionId/publish
    static async publishModpackVersion(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
        if (!req.user || !req.user.id) {
            res.status(401).json(serializeError({ status: '401', title: 'Unauthorized', detail: 'User authentication required.' }));
            return;
        }
        const userId = req.user.id;
        const { versionId } = req.params;

        if (!versionId) {
            res.status(400).json(serializeError({ status: '400', title: 'Bad Request', detail: 'Version ID is required.' }));
            return;
        }

        try {
            const publishedVersion = await UserModpacksService.publishModpackVersion(versionId, userId);
            res.status(200).json(serializeResource('modpackVersion', publishedVersion));
        } catch (error: any) {
            console.error('[CONTROLLER_USER_MODPACKS] Error publishing modpack version:', error);
            const statusCode = error.statusCode || (error.message.includes("not found") ? 404 : 500);
            res.status(statusCode).json(serializeError({
                status: statusCode.toString(),
                title: error.name || (statusCode === 404 ? 'Not Found' : 'Publish Version Error'),
                detail: error.message || 'Failed to publish modpack version.'
            }));
        }
    }

    // GET /v1/modpacks/:modpackId/versions
    static async listModpackVersions(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
        if (!req.user || !req.user.id) {
            res.status(401).json(serializeError({ status: '401', title: 'Unauthorized', detail: 'User authentication required.' }));
            return;
        }
        const userId = req.user.id;
        const { modpackId } = req.params;

        if (!modpackId) {
            res.status(400).json(serializeError({ status: '400', title: 'Bad Request', detail: 'Modpack ID is required.' }));
            return;
        }

        try {
            const versions = await UserModpacksService.listModpackVersions(modpackId, userId);
            res.status(200).json(serializeCollection('modpackVersion', versions));
        } catch (error: any) {
            console.error('[CONTROLLER_USER_MODPACKS] Error listing modpack versions:', error);
            const statusCode = error.statusCode || 500;
            res.status(statusCode).json(serializeError({
                status: statusCode.toString(),
                title: error.name || 'List Versions Error',
                detail: error.message || 'Failed to list modpack versions.'
            }));
        }
    }
}
