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

export class UserModpacksController {
    // POST /v1/modpacks
    static async createModpack(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
        if (!req.user) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        // Destructure all expected fields from body for validation
        const {
            publisherId,
            name,
            slug,
            iconUrl,
            bannerUrl,
            shortDescription,
            description,
            visibility,
            trailerUrl, // Added missing fields from schema
            password,
            showUserAsPublisher
        } = req.body;

        const parseResult = newModpackSchema.safeParse({
            name,
            slug,
            iconUrl,
            bannerUrl,
            shortDescription,
            description,
            visibility, // Ensure this matches ModpackVisibility enum
            publisherId,
            creatorUserId: req.user.id, // Will be set by the system
            status: ModpackStatus.DRAFT, // Will be set by the system
            trailerUrl,
            password,
            showUserAsPublisher
        });

        if (!parseResult.success) {
            res.status(400).json({ message: 'Validation failed', errors: parseResult.error.format() });
            return;
        }

        try {
            // Use validated data, ensuring system-set fields are correct
            const modpackData: NewModpack = {
                ...parseResult.data,
                // creatorUserId: req.user.id, // Already set by schema default or parseResult
                // status: ModpackStatus.DRAFT, // Already set by schema default or parseResult
            };

            const newModpackInstance = await Modpack.create(modpackData);
            res.status(201).json(newModpackInstance.toJson());
        } catch (error: any) {
            if (error.message.includes('slug') && error.message.includes('already exists')) {
                res.status(409).json({ message: error.message, field: 'slug' });
            } else if (error.message.includes('Invalid modpack data')) {
                res.status(400).json({ message: error.message });
            }
            else {
                console.error('Error creating modpack:', error);
                res.status(500).json({ message: 'Failed to create modpack' });
            }
        }
    }

    // PATCH /v1/modpacks/:modpackId
    static async updateModpack(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
        if (!req.user) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        const { modpackId } = req.params;
        if (!modpackId) {
            res.status(400).json({ message: 'Modpack ID is required.' });
            return;
        }

        const modpack = await Modpack.findById(modpackId);
        if (!modpack) {
            res.status(404).json({ message: 'Modpack not found' });
            return;
        }

        // User should not be able to change these critical fields via this endpoint
        const { publisherId, creatorUserId, slug, status, ...updatePayload } = req.body;
        // Also explicitly excluding status, as it should be changed via dedicated actions (e.g. publish)

        const parseResult = modpackUpdateSchema.safeParse(updatePayload);

        if (!parseResult.success) {
            res.status(400).json({ message: 'Validation failed', errors: parseResult.error.format() });
            return;
        }

        try {
            const dataToUpdate: Partial<Omit<NewModpack, "id" | "createdAt" | "publisherId" | "creatorUserId" | "slug" | "status">> = parseResult.data;

            const updatedModpack = await modpack.update(dataToUpdate as ModpackUpdateData); // Cast needed if type mismatch
            res.status(200).json(updatedModpack.toJson());
        } catch (error: any) {
             if (error.message.includes('Invalid modpack data')) {
                res.status(400).json({ message: error.message });
            } else {
                console.error('Error updating modpack:', error);
                res.status(500).json({ message: 'Failed to update modpack' });
            }
        }
    }

    // DELETE /v1/modpacks/:modpackId
    static async deleteModpack(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
        if (!req.user) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        const { modpackId } = req.params;
         if (!modpackId) {
            res.status(400).json({ message: 'Modpack ID is required.' });
            return;
        }

        const modpack = await Modpack.findById(modpackId);
        if (!modpack) {
            res.status(404).json({ message: 'Modpack not found' });
            return;
        }

        if (modpack.status === ModpackStatus.DELETED) {
            // Idempotency: if already deleted, report success or specific status
            res.status(200).json({ message: 'Modpack already marked as deleted' });
            return;
        }

        try {
            await modpack.delete(); // This now calls update with status: DELETED
            res.status(200).json({ message: 'Modpack successfully marked as deleted' });
        } catch (error: any) {
            console.error('Error deleting modpack:', error);
            res.status(500).json({ message: 'Failed to delete modpack' });
        }
    }

    // GET /v1/modpacks
    static async listUserModpacks(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
        if (!req.user) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        const userId = req.user.id;

        try {
            const memberships = await db.query.PublisherMembersTable.findMany({
                where: eq(PublisherMembersTable.userId, userId),
                columns: { id: true, publisherId: true } // Only need id for scope lookup
            });

            if (memberships.length === 0) {
                res.status(200).json([]);
                return;
            }

            const memberIds = memberships.map(m => m.id);

            const relevantScopes = await db.query.ScopesTable.findMany({
                where: and(
                    inArray(ScopesTable.publisherMemberId, memberIds),
                    or(
                        eq(ScopesTable.canCreateModpacks, true),
                        eq(ScopesTable.canEditModpacks, true),
                        eq(ScopesTable.canDeleteModpacks, true),
                        eq(ScopesTable.canPublishVersions, true)
                    )
                ),
                columns: { publisherId: true, modpackId: true }
            });

            const manageablePublisherIds = new Set<string>();
            const manageableModpackIds = new Set<string>();

            relevantScopes.forEach(scope => {
                // If scope has publisherId, it's an org-level permission, user can manage all modpacks under this publisher.
                // If scope has modpackId, it's a modpack-specific permission.
                if (scope.publisherId && !scope.modpackId) {
                    manageablePublisherIds.add(scope.publisherId);
                } else if (scope.modpackId) {
                    manageableModpackIds.add(scope.modpackId);
                }
            });

            let modpackEntities: (typeof ModpacksTable.$inferSelect)[] = [];

            const queryConditions = [];
            if (manageablePublisherIds.size > 0) {
                queryConditions.push(inArray(ModpacksTable.publisherId, Array.from(manageablePublisherIds)));
            }
            if (manageableModpackIds.size > 0) {
                queryConditions.push(inArray(ModpacksTable.id, Array.from(manageableModpackIds)));
            }

            if (queryConditions.length > 0) {
                 modpackEntities = await db.query.ModpacksTable.findMany({
                    where: and(
                        or(...queryConditions), // Spread operator for multiple conditions in 'or'
                        not(eq(ModpacksTable.status, ModpackStatus.DELETED)) // Filter out DELETED
                    ),
                    orderBy: desc(ModpacksTable.updatedAt)
                 });
            }

            // Convert raw DB entities to Modpack model instances for consistent JSON output
            const modpacks = modpackEntities.map(entity => new Modpack(entity));
            res.status(200).json(modpacks.map(m => m.toJson()));

        } catch (error: any) {
            console.error('Error listing user modpacks:', error);
            res.status(500).json({ message: 'Failed to list modpacks' });
        }
    }

    // POST /v1/modpacks/:modpackId/versions
    static async createModpackVersion(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
        if (!req.user) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        const { modpackId } = req.params;
        const { version, mcVersion, forgeVersion, changelog } = req.body;

        if (!modpackId) {
            res.status(400).json({ message: 'Modpack ID is required.' });
            return;
        }

        // Validate that the parent modpack exists
        const parentModpack = await Modpack.findById(modpackId);
        if (!parentModpack) {
            res.status(404).json({ message: 'Parent modpack not found.' });
            return;
        }
        // Potentially check if parent modpack is in a state that allows adding versions (e.g., not DELETED)
        if (parentModpack.status === ModpackStatus.DELETED) {
            res.status(400).json({ message: 'Cannot add versions to a deleted modpack.' });
            return;
        }

        const parseResult = newModpackVersionSchema.safeParse({
            modpackId: modpackId,
            version,
            mcVersion,
            forgeVersion,
            changelog,
            createdBy: req.user.id,
            // status will default to DRAFT as per schema
        });

        if (!parseResult.success) {
            res.status(400).json({ message: 'Validation failed', errors: parseResult.error.format() });
            return;
        }

        try {
            // The schema already includes modpackId, createdBy, and default status
            const newVersion = await ModpackVersion.create(parseResult.data as NewModpackVersion);
            res.status(201).json(newVersion.toJson());
        } catch (error: any) {
            console.error('Error creating modpack version:', error);
            // Check for unique constraint errors if version string should be unique per modpack
            // (This would require a custom check or a DB unique constraint)
            res.status(500).json({ message: 'Failed to create modpack version.' });
        }
    }

    // PATCH /v1/versions/:versionId
    static async updateModpackVersion(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
        if (!req.user) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        const { versionId } = req.params;
        const { mcVersion, forgeVersion, changelog } = req.body; // Only allow updating these fields for a draft

        if (!versionId) {
            res.status(400).json({ message: 'Version ID is required.' });
            return;
        }

        const modpackVersion = await ModpackVersion.findById(versionId);
        if (!modpackVersion) {
            res.status(404).json({ message: 'Modpack version not found.' });
            return;
        }

        if (modpackVersion.status !== ModpackVersionStatus.DRAFT) {
            res.status(403).json({ message: 'Only draft versions can be updated.' });
            return;
        }

        const updateData: Partial<Pick<NewModpackVersion, 'mcVersion' | 'forgeVersion' | 'changelog'>> = {};
        if (mcVersion !== undefined) updateData.mcVersion = mcVersion;
        if (forgeVersion !== undefined) updateData.forgeVersion = forgeVersion;
        if (changelog !== undefined) updateData.changelog = changelog;

        if (mcVersion && typeof mcVersion !== 'string') {
            res.status(400).json({ message: 'mcVersion must be a string.'});
            return;
        }
         if (changelog && typeof changelog !== 'string') {
            res.status(400).json({ message: 'changelog must be a string.'});
            return;
        }

        try {
            // TODO: Implement and use modpackVersion.update(updateData) when available in ModpackVersion.model.ts
            const [updated] = await db.update(ModpackVersionsTable)
                .set({ ...updateData, updatedAt: new Date() })
                .where(eq(ModpackVersionsTable.id, versionId))
                .returning();

            if (!updated) {
                 throw new Error("Update failed or version not found after update.");
            }

            const refreshedVersion = await ModpackVersion.findById(versionId);
            res.status(200).json(refreshedVersion!.toJson());
        } catch (error: any) {
            console.error('Error updating modpack version:', error);
            res.status(500).json({ message: 'Failed to update modpack version.' });
        }
    }

    // POST /v1/versions/:versionId/publish
    static async publishModpackVersion(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
        if (!req.user) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        const { versionId } = req.params;
        if (!versionId) {
            res.status(400).json({ message: 'Version ID is required.' });
            return;
        }

        const modpackVersion = await ModpackVersion.findById(versionId);
        if (!modpackVersion) {
            res.status(404).json({ message: 'Modpack version not found.' });
            return;
        }

        if (modpackVersion.status === ModpackVersionStatus.PUBLISHED) {
            res.status(400).json({ message: 'Version is already published.' });
            return;
        }
        if (modpackVersion.status !== ModpackVersionStatus.DRAFT) {
            res.status(400).json({ message: 'Only draft versions can be published.' });
            return;
        }

        // TODO: Add file validation logic here before publishing

        try {
            // TODO: Use modpackVersion.update() for status change when available
            const [published] = await db.update(ModpackVersionsTable)
                .set({
                    status: ModpackVersionStatus.PUBLISHED,
                    releaseDate: new Date(),
                    updatedAt: new Date()
                })
                .where(eq(ModpackVersionsTable.id, versionId))
                .returning();

            if (!published) {
                throw new Error("Publishing failed or version not found after update.");
            }

            const parentModpack = await Modpack.findById(modpackVersion.modpackId);
            if (parentModpack) {
                // TODO: Use parentModpack.update() when available and if it handles `updatedAt` automatically
                await db.update(ModpacksTable)
                    .set({ updatedAt: new Date() })
                    .where(eq(ModpacksTable.id, parentModpack.id));
            }

            const refreshedVersion = await ModpackVersion.findById(versionId);
            res.status(200).json(refreshedVersion!.toJson());
        } catch (error: any) {
            console.error('Error publishing modpack version:', error);
            res.status(500).json({ message: 'Failed to publish modpack version.' });
        }
    }

    // GET /v1/modpacks/:modpackId/versions
    static async listModpackVersions(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
        if (!req.user) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        const { modpackId } = req.params;
        if (!modpackId) {
            res.status(400).json({ message: 'Modpack ID is required.' });
            return;
        }

        const parentModpack = await Modpack.findById(modpackId);
        if (!parentModpack) {
            res.status(404).json({ message: 'Modpack not found.' });
            return;
        }
        if (parentModpack.status === ModpackStatus.DELETED) {
            res.status(404).json({ message: 'Modpack not found (or has been deleted).' });
            return;
        }

        try {
            const versions = await db.query.ModpackVersionsTable.findMany({
                where: and(
                    eq(ModpackVersionsTable.modpackId, modpackId),
                    not(eq(ModpackVersionsTable.status, ModpackVersionStatus.ARCHIVED)) // Do not list ARCHIVED by default
                ),
                orderBy: desc(ModpackVersionsTable.createdAt)
            });

            const versionModels = versions.map(v => new ModpackVersion(v));
            res.status(200).json(versionModels.map(vm => vm.toJson()));
        } catch (error: any) {
            console.error('Error listing modpack versions:', error);
            res.status(500).json({ message: 'Failed to list modpack versions.' });
        }
    }
}
