import { Request, Response, NextFunction } from 'express';
import { Modpack, NewModpack, ModpackUpdateData, ModpackStatus, newModpackSchema, modpackUpdateSchema, ModpackVisibility } from '@/models/Modpack.model';
import { ModpackVersion, NewModpackVersion, ModpackVersionStatus, newModpackVersionSchema } from '@/models/ModpackVersion.model'; // Added
import { client as db } from '@/db/client';
import { ModpacksTable, ModpackVersionsTable, PublisherMembersTable, ScopesTable } from '@/db/schema'; // Added ModpackVersionsTable
import { and, eq, or, sql, inArray, desc, not } from 'drizzle-orm';

// Extend Express Request type
interface AuthenticatedRequest extends Request {
    user?: { id: string };
    params: {
        modpackId?: string;
        versionId?: string; // Added versionId for version routes
    };
    body: any; // Define more specific types if possible
}

import { UserModpacksService } from '@/services/userModpacks.service'; // Import the new service

export class UserModpacksController {
    // POST /v1/modpacks
    static async createModpack(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
        if (!req.user || !req.user.id) { // Auth check
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        const userId = req.user.id;

        // Zod schema expects creatorUserId and status, but these should be set by the system/service logic,
        // not directly from client input for this particular endpoint.
        // The service will add creatorUserId. Status defaults in schema or service.
        const { publisherId, name, slug, iconUrl, bannerUrl, shortDescription, description, visibility, trailerUrl, password, showUserAsPublisher } = req.body;

        const validationInput = {
            publisherId, name, slug, iconUrl, bannerUrl, shortDescription, description, visibility,
            trailerUrl, password, showUserAsPublisher,
            creatorUserId: userId, // Add creatorUserId here for validation against newModpackSchema
                                 // It won't be directly used from client if service overwrites, but good for schema check.
            // status: ModpackStatus.DRAFT // Default is handled by schema or service.
        };

        const parseResult = newModpackSchema.safeParse(validationInput);

        if (!parseResult.success) {
            res.status(400).json({ message: 'Validation failed', errors: parseResult.error.format() });
            return;
        }

        try {
            // Pass only client-provided data to the service, service will handle creatorUserId and status defaults.
            const clientProvidedData = { publisherId, name, slug, iconUrl, bannerUrl, shortDescription, description, visibility, trailerUrl, password, showUserAsPublisher };
            const newModpackJson = await UserModpacksService.createModpack(clientProvidedData as NewModpack, userId);
            res.status(201).json(newModpackJson);
        } catch (error: any) {
            console.error('[CONTROLLER_USER_MODPACKS] Error creating modpack:', error);
            const statusCode = error.statusCode || 500;
            const responseError: { message: string; field?: string } = { message: error.message || 'Failed to create modpack' };
            if (error.field) {
                responseError.field = error.field;
            }
            res.status(statusCode).json(responseError);
        }
    }

    // PATCH /v1/modpacks/:modpackId
    static async updateModpack(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
        if (!req.user || !req.user.id) { // Auth check
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        const userId = req.user.id;
        const { modpackId } = req.params;

        if (!modpackId) {
            res.status(400).json({ message: 'Modpack ID is required in URL parameters.' });
            return;
        }

        // Exclude fields not allowed for direct update or handled by other processes
        const { publisherId, creatorUserId, slug, status, ...clientPayload } = req.body;

        const parseResult = modpackUpdateSchema.safeParse(clientPayload);
        if (!parseResult.success) {
            res.status(400).json({ message: 'Validation failed', errors: parseResult.error.format() });
            return;
        }

        if (Object.keys(parseResult.data).length === 0) {
             return res.status(400).json({ message: "Request body is empty or contains no updatable fields for modpack."});
        }

        try {
            const updatedModpackJson = await UserModpacksService.updateModpack(modpackId, parseResult.data, userId);
            res.status(200).json(updatedModpackJson);
        } catch (error: any) {
            console.error('[CONTROLLER_USER_MODPACKS] Error updating modpack:', error);
            const statusCode = error.statusCode || 500;
            res.status(statusCode).json({ message: error.message || 'Failed to update modpack' });
        }
    }

    // DELETE /v1/modpacks/:modpackId
    static async deleteModpack(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
        if (!req.user || !req.user.id) { // Auth check
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        const userId = req.user.id;
        const { modpackId } = req.params;

        if (!modpackId) {
            res.status(400).json({ message: 'Modpack ID is required in URL parameters.' });
            return;
        }

        try {
            const success = await UserModpacksService.deleteModpack(modpackId, userId);
            if (!success) {
                // Service returns false if modpack wasn't found for deletion (already handled idempotency for DELETED status)
                res.status(404).json({ message: 'Modpack not found or could not be deleted.' });
                return;
            }
            res.status(200).json({ message: 'Modpack successfully marked as deleted.' });
        } catch (error: any) {
            console.error('[CONTROLLER_USER_MODPACKS] Error deleting modpack:', error);
            const statusCode = error.statusCode || 500;
            res.status(statusCode).json({ message: error.message || 'Failed to delete modpack' });
        }
    }

    // GET /v1/modpacks
    static async listUserModpacks(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
        if (!req.user || !req.user.id) { // Auth check
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        const userId = req.user.id;

        try {
            const modpacksJson = await UserModpacksService.listUserModpacks(userId);
            res.status(200).json(modpacksJson);
        } catch (error: any) {
            console.error('[CONTROLLER_USER_MODPACKS] Error listing user modpacks:', error);
            res.status(error.statusCode || 500).json({ message: error.message || 'Failed to list modpacks' });
        }
    }

    // POST /v1/modpacks/:modpackId/versions
    static async createModpackVersion(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
        if (!req.user || !req.user.id) { // Auth check
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        const userId = req.user.id;
        const { modpackId } = req.params;
        const { version, mcVersion, forgeVersion, changelog } = req.body;

        if (!modpackId) {
            res.status(400).json({ message: 'Modpack ID is required in URL parameters.' });
            return;
        }

        // Prepare data for service, which expects a structure without modpackId/createdBy
        const versionPayload = { version, mcVersion, forgeVersion, changelog };

        // Zod validation for client-provided data.
        // newModpackVersionSchema includes modpackId and createdBy, so we validate against a partial version or ensure service handles this.
        // For safety, we construct the full object for validation against the complete schema.
        const fullDataForValidation = { ...versionPayload, modpackId, createdBy: userId };
        const parseResult = newModpackVersionSchema.safeParse(fullDataForValidation);

        if (!parseResult.success) {
            res.status(400).json({ message: 'Validation failed for modpack version', errors: parseResult.error.format() });
            return;
        }

        try {
            // Pass only the client-provided parts to the service. Service will add modpackId and createdBy.
            const newVersionJson = await UserModpacksService.createModpackVersion(modpackId, versionPayload, userId);
            res.status(201).json(newVersionJson);
        } catch (error: any) {
            console.error('[CONTROLLER_USER_MODPACKS] Error creating modpack version:', error);
            res.status(error.statusCode || 500).json({ message: error.message || 'Failed to create modpack version.' });
        }
    }

    // PATCH /v1/versions/:versionId
    static async updateModpackVersion(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
        if (!req.user || !req.user.id) { // Auth check
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        const userId = req.user.id;
        const { versionId } = req.params;

        // Only allow specific fields to be updated.
        // modpackVersionUpdateSchema should define these.
        const { mcVersion, forgeVersion, changelog, status, releaseDate } = req.body;
        const clientPayload = { mcVersion, forgeVersion, changelog, status, releaseDate };


        if (!versionId) {
            res.status(400).json({ message: 'Version ID is required in URL parameters.' });
            return;
        }

        const parseResult = modpackVersionUpdateSchema.safeParse(clientPayload);
        if (!parseResult.success) {
            res.status(400).json({ message: 'Validation failed for modpack version update', errors: parseResult.error.format() });
            return;
        }

        if (Object.keys(parseResult.data).length === 0) {
             return res.status(400).json({ message: "Request body is empty or contains no updatable fields for modpack version."});
        }

        try {
            const updatedVersionJson = await UserModpacksService.updateModpackVersion(versionId, parseResult.data, userId);
            res.status(200).json(updatedVersionJson);
        } catch (error: any) {
            console.error('[CONTROLLER_USER_MODPACKS] Error updating modpack version:', error);
            res.status(error.statusCode || 500).json({ message: error.message || 'Failed to update modpack version.' });
        }
    }

    // POST /v1/versions/:versionId/publish
    static async publishModpackVersion(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
        if (!req.user || !req.user.id) { // Auth check
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        const userId = req.user.id;
        const { versionId } = req.params;

        if (!versionId) {
            res.status(400).json({ message: 'Version ID is required in URL parameters.' });
            return;
        }

        try {
            const publishedVersionJson = await UserModpacksService.publishModpackVersion(versionId, userId);
            res.status(200).json(publishedVersionJson);
        } catch (error: any) {
            console.error('[CONTROLLER_USER_MODPACKS] Error publishing modpack version:', error);
            res.status(error.statusCode || 500).json({ message: error.message || 'Failed to publish modpack version.' });
        }
    }

    // GET /v1/modpacks/:modpackId/versions
    static async listModpackVersions(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
        if (!req.user || !req.user.id) { // Auth check
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        const userId = req.user.id; // For potential authorization/filtering in service
        const { modpackId } = req.params;

        if (!modpackId) {
            res.status(400).json({ message: 'Modpack ID is required in URL parameters.' });
            return;
        }

        try {
            const versionsJson = await UserModpacksService.listModpackVersions(modpackId, userId);
            res.status(200).json(versionsJson);
        } catch (error: any) {
            console.error('[CONTROLLER_USER_MODPACKS] Error listing modpack versions:', error);
            res.status(error.statusCode || 500).json({ message: error.message || 'Failed to list modpack versions.' });
        }
    }
}
