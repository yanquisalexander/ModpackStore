import {
    Modpack,
    NewModpack,
    ModpackUpdateData,
    ModpackStatus,
    newModpackSchema,
    modpackUpdateSchema
} from '@/models/Modpack.model';
import {
    ModpackVersion,
    NewModpackVersion,
    ModpackVersionStatus,
    newModpackVersionSchema,
    modpackVersionUpdateSchema // Assuming this was added in ModpackVersion model refactor
} from '@/models/ModpackVersion.model';
import { client as db } from '@/db/client';
import { ModpacksTable, ModpackVersionsTable, PublisherMembersTable, ScopesTable } from '@/db/schema';
import { and, eq, or, inArray, desc, not } from 'drizzle-orm';
import { z } from 'zod';

// TODO: Replace console.log with a dedicated logger solution throughout the service.
// TODO: Implement comprehensive authorization checks in each method (e.g., using a helper like `checkUserPermission`).

// For listUserModpacks to avoid direct DB types in return if transforming
interface ModpackJson extends ReturnType<Modpack['toJson']> {}
interface ModpackVersionJson extends ReturnType<ModpackVersion['toJson']> {}


export class UserModpacksService {
    static async createModpack(
        data: z.infer<typeof newModpackSchema>,
        userId: string
    ): Promise<ModpackJson> {
        console.log(`[SERVICE_USER_MODPACKS] User ${userId} creating modpack "${data.name}"`);
        // Schema validation should be done in controller before this call,
        // but service can re-validate if it's a public API.
        // For now, assume data is validated.

        // Ensure creatorUserId is correctly set, even if part of schema (belt and braces)
        const modpackDataWithCreator: NewModpack = {
            ...data,
            creatorUserId: userId,
            status: data.status || ModpackStatus.DRAFT, // Ensure default if not provided
        };

        try {
            const newModpackInstance = await Modpack.create(modpackDataWithCreator);
            console.log(`[SERVICE_USER_MODPACKS] Modpack "${newModpackInstance.name}" (ID: ${newModpackInstance.id}) created.`);
            return newModpackInstance.toJson();
        } catch (error: any) {
            // Handle specific errors like slug conflict from the model
            if (error.message.includes('slug') && error.message.includes('already exists')) {
                const serviceError = new Error(error.message);
                (serviceError as any).statusCode = 409;
                (serviceError as any).field = 'slug';
                throw serviceError;
            }
            console.error('[SERVICE_USER_MODPACKS] Error in createModpack:', error);
            throw error; // Re-throw for controller to handle
        }
    }

    static async listUserModpacks(userId: string): Promise<ModpackJson[]> {
        console.log(`[SERVICE_USER_MODPACKS] Listing modpacks for user ${userId}`);
        const memberships = await db.query.PublisherMembersTable.findMany({
            where: eq(PublisherMembersTable.userId, userId),
            columns: { id: true, publisherId: true }
        });

        if (memberships.length === 0) {
            console.log(`[SERVICE_USER_MODPACKS] User ${userId} has no publisher memberships.`);
            return [];
        }

        const memberIds = memberships.map(m => m.id);

        const relevantScopes = await db.query.ScopesTable.findMany({
            where: and(
                inArray(ScopesTable.publisherMemberId, memberIds),
                or( // User needs at least one of these permissions to be considered managing a modpack/publisher
                    eq(ScopesTable.canCreateModpacks, true),
                    eq(ScopesTable.canEditModpacks, true),
                    eq(ScopesTable.canDeleteModpacks, true),
                    eq(ScopesTable.canPublishVersions, true)
                )
            ),
            columns: { publisherId: true, modpackId: true }
        });

        if (relevantScopes.length === 0) {
            console.log(`[SERVICE_USER_MODPACKS] User ${userId} has no relevant management scopes.`);
            return [];
        }

        const manageablePublisherIds = new Set<string>();
        const manageableModpackIds = new Set<string>();

        relevantScopes.forEach(scope => {
            if (scope.publisherId && !scope.modpackId) { // Org-level permission
                manageablePublisherIds.add(scope.publisherId);
            } else if (scope.modpackId) { // Modpack-specific permission
                manageableModpackIds.add(scope.modpackId);
            }
        });

        console.log(`[SERVICE_USER_MODPACKS] User ${userId} can manage publisher IDs: [${Array.from(manageablePublisherIds).join(', ')}] and modpack IDs: [${Array.from(manageableModpackIds).join(', ')}]`);

        const queryConditions = [];
        if (manageablePublisherIds.size > 0) {
            queryConditions.push(inArray(ModpacksTable.publisherId, Array.from(manageablePublisherIds)));
        }
        if (manageableModpackIds.size > 0) {
            queryConditions.push(inArray(ModpacksTable.id, Array.from(manageableModpackIds)));
        }

        if (queryConditions.length === 0) {
             console.log(`[SERVICE_USER_MODPACKS] No publishers or specific modpacks found for user ${userId} to manage.`);
            return [];
        }

        const modpackEntities = await db.query.ModpacksTable.findMany({
            where: and(
                or(...queryConditions),
                not(eq(ModpacksTable.status, ModpackStatus.DELETED))
            ),
            orderBy: desc(ModpacksTable.updatedAt)
        });

        console.log(`[SERVICE_USER_MODPACKS] Found ${modpackEntities.length} modpacks for user ${userId}.`);
        const modpacks = modpackEntities.map(entity => new Modpack(entity));
        return modpacks.map(m => m.toJson());
    }

    static async updateModpack(
        modpackId: string,
        data: z.infer<typeof modpackUpdateSchema>, // Data already validated by controller
        userId: string // For authorization checks (TODO)
    ): Promise<ModpackJson> {
        console.log(`[SERVICE_USER_MODPACKS] User ${userId} updating modpack ID: ${modpackId}`);

        // Authorization: Check if userId is allowed to update this modpackId
        // This would typically involve checking against PublisherMember, Scopes, or if user is creatorUserId
        // For now, this is a placeholder for actual permission check.
        // const hasPermission = await checkUserPermissionForModpack(userId, modpackId, 'canEditModpacks');
        // if (!hasPermission) {
        //     const serviceError = new Error('Forbidden: You do not have permission to update this modpack.');
        //     (serviceError as any).statusCode = 403;
        //     throw serviceError;
        // }

        // Ensure the modpack exists before attempting to update
        const existingModpack = await Modpack.findById(modpackId);
        if (!existingModpack) {
            const serviceError = new Error('Modpack not found.');
            (serviceError as any).statusCode = 404;
            throw serviceError;
        }

        // The modpackUpdateSchema from model already omits critical fields like slug, publisherId etc.
        // The controller also strips some fields before validation.
        // Call the static update method on the Modpack model
        const updatedModpackInstance = await Modpack.update(modpackId, data);
        console.log(`[SERVICE_USER_MODPACKS] Modpack ID: ${modpackId} updated successfully.`);
        return updatedModpackInstance.toJson();
    }

    static async deleteModpack(modpackId: string, userId: string): Promise<boolean> {
        console.log(`[SERVICE_USER_MODPACKS] User ${userId} attempting to delete modpack ID: ${modpackId}`);

        // Authorization: Check permission similar to updateModpack
        // const hasPermission = await checkUserPermissionForModpack(userId, modpackId, 'canDeleteModpacks');
        // if (!hasPermission) { /* ... throw 403 error ... */ }

        const modpack = await Modpack.findById(modpackId);
        if (!modpack) {
            // If modpack not found, it's effectively "deleted" from user's perspective or can't be acted upon.
            // Depending on desired idempotency, either throw 404 or return true/false.
            // Returning false indicates the operation didn't result in a deletion because it wasn't found.
            console.warn(`[SERVICE_USER_MODPACKS] Modpack ID: ${modpackId} not found for deletion.`);
            return false;
        }

        if (modpack.status === ModpackStatus.DELETED) {
            console.log(`[SERVICE_USER_MODPACKS] Modpack ID: ${modpackId} is already marked as deleted.`);
            return true; // Idempotent: already deleted
        }

        await modpack.delete(); // This changes status to DELETED
        console.log(`[SERVICE_USER_MODPACKS] Modpack ID: ${modpackId} successfully marked as deleted.`);
        return true;
    }

    // == Modpack Version Management ==

    static async createModpackVersion(
        modpackIdFromParams: string,
        data: Omit<z.infer<typeof newModpackVersionSchema>, 'modpackId' | 'createdBy'>, // Data from client
        userId: string
    ): Promise<ModpackVersionJson> {
        console.log(`[SERVICE_USER_MODPACKS] User ${userId} creating version for modpack ID: ${modpackIdFromParams}`);

        const parentModpack = await Modpack.findById(modpackIdFromParams);
        if (!parentModpack) {
            const serviceError = new Error('Parent modpack not found.');
            (serviceError as any).statusCode = 404;
            throw serviceError;
        }
        if (parentModpack.status === ModpackStatus.DELETED) {
            const serviceError = new Error('Cannot add versions to a deleted modpack.');
            (serviceError as any).statusCode = 400;
            throw serviceError;
        }

        // Authorization: Check if userId can create versions for this modpack (e.g., via checkUserPermissionForModpack)
        // if (!await checkUserPermissionForModpack(userId, modpackIdFromParams, 'canPublishVersions')) { /* ... throw 403 ... */ }


        const versionDataForModel: z.infer<typeof newModpackVersionSchema> = {
            ...data,
            modpackId: modpackIdFromParams,
            createdBy: userId,
            // status will default to DRAFT as per ModpackVersion's newModpackVersionSchema
        };

        // The newModpackVersionSchema in ModpackVersion.model should validate this structure fully.
        // Controller should have already done a safeParse with a similar structure.
        const newVersionInstance = await ModpackVersion.create(versionDataForModel);
        console.log(`[SERVICE_USER_MODPACKS] Version "${newVersionInstance.version}" (ID: ${newVersionInstance.id}) created for modpack ${modpackIdFromParams}.`);
        return newVersionInstance.toJson();
    }

    static async updateModpackVersion(
        versionId: string,
        data: z.infer<typeof modpackVersionUpdateSchema>, // Validated by controller
        userId: string
    ): Promise<ModpackVersionJson> {
        console.log(`[SERVICE_USER_MODPACKS] User ${userId} updating version ID: ${versionId}`);

        const modpackVersion = await ModpackVersion.findById(versionId);
        if (!modpackVersion) {
            const serviceError = new Error('Modpack version not found.');
            (serviceError as any).statusCode = 404;
            throw serviceError;
        }

        if (modpackVersion.status !== ModpackVersionStatus.DRAFT) {
            const serviceError = new Error('Only draft versions can be updated.');
            (serviceError as any).statusCode = 403;
            throw serviceError;
        }

        // Authorization: Check if user can edit this version (likely tied to parent modpack's canPublishVersions or canEditModpacks)
        // if (!await checkUserPermissionForModpack(userId, modpackVersion.modpackId, 'canPublishVersions')) { /* ... throw 403 ... */ }

        // ModpackVersion model's static update method
        const updatedVersionInstance = await ModpackVersion.update(versionId, data);
        console.log(`[SERVICE_USER_MODPACKS] Version ID: ${versionId} updated successfully.`);
        return updatedVersionInstance.toJson();
    }

    static async publishModpackVersion(versionId: string, userId: string): Promise<ModpackVersionJson> {
        console.log(`[SERVICE_USER_MODPACKS] User ${userId} publishing version ID: ${versionId}`);

        const modpackVersion = await ModpackVersion.findById(versionId);
        if (!modpackVersion) {
            const serviceError = new Error('Modpack version not found.');
            (serviceError as any).statusCode = 404;
            throw serviceError;
        }

        if (modpackVersion.status === ModpackVersionStatus.PUBLISHED) {
            const serviceError = new Error('Version is already published.');
            (serviceError as any).statusCode = 400;
            throw serviceError;
        }
        if (modpackVersion.status !== ModpackVersionStatus.DRAFT) {
            const serviceError = new Error('Only draft versions can be published.');
            (serviceError as any).statusCode = 400;
            throw serviceError;
        }

        // Authorization: Check if user can publish this version
        // if (!await checkUserPermissionForModpack(userId, modpackVersion.modpackId, 'canPublishVersions')) { /* ... throw 403 ... */ }

        // TODO: Add file validation logic here before publishing (e.g., ensure files are uploaded)

        const updateData: z.infer<typeof modpackVersionUpdateSchema> = {
            status: ModpackVersionStatus.PUBLISHED,
            releaseDate: new Date(),
        };
        const publishedVersion = await ModpackVersion.update(versionId, updateData);

        // Update parent modpack's updatedAt timestamp
        const parentModpack = await Modpack.findById(modpackVersion.modpackId);
        if (parentModpack) {
            // Modpack.update requires a data payload. If just touching updatedAt,
            // and if PublishersTable had updatedAt, it would be `await Modpack.update(parentModpack.id, { updatedAt: new Date() });`
            // Since ModpacksTable *does* have updatedAt, but Publisher model's update schema might not list it explicitly for this action:
            // A simple way is to call save if it correctly sets updatedAt.
            // Or, use a specific method if available, or a minimal direct update.
            // For now, assuming a direct update is okay if no other fields need changing.
            // This should ideally be `parentModpack.save()` if save handles updatedAt.
            // Or `Modpack.update(parentModpack.id, {});` if that correctly touches updatedAt.
            // The most robust way is Modpack.update(parentModpack.id, { someFieldToUpdateToItself: parentModpack.name }) if no direct "touch" method.
            // Given Modpack.update sets updatedAt, an empty valid payload would work if the schema allows.
            // Let's assume Modpack.update can be called with an empty valid object or specific logic handles this.
            // For now, we'll use the model's static update method with an empty data object,
            // This direct DB call is used to ensure `updatedAt` is updated on the parent modpack.
            // Ideally, this would be `await Modpack.update(parentModpack.id, {});` if the model's
            // update method robustly handles "touching" a record, or `await parentModpack.save()`
            // if `parentModpack` was a full instance and save could guarantee only `updatedAt` changes.
            // The current static `Modpack.update` might not update if the payload is empty after validation.
            await db.update(ModpacksTable)
                .set({ updatedAt: new Date() }) // Directly set updatedAt
                .where(eq(ModpacksTable.id, parentModpack.id));
            console.log(`[SERVICE_USER_MODPACKS] Parent modpack ${parentModpack.id} updatedAt timestamp touched.`);
        }
        console.log(`[SERVICE_USER_MODPACKS] Version ID: ${versionId} published successfully.`);
        return publishedVersion.toJson();
    }

    static async listModpackVersions(modpackId: string, userId: string): Promise<ModpackVersionJson[]> {
        console.log(`[SERVICE_USER_MODPACKS] User ${userId} listing versions for modpack ID: ${modpackId}`);

        const parentModpack = await Modpack.findById(modpackId);
        if (!parentModpack) {
            const serviceError = new Error('Modpack not found.');
            (serviceError as any).statusCode = 404;
            throw serviceError;
        }
        // Don't show versions if parent modpack is conceptually inaccessible or deleted
        if (parentModpack.status === ModpackStatus.DELETED) {
            const serviceError = new Error('Modpack not found (or has been deleted).');
            (serviceError as any).statusCode = 404; // Or 410 Gone
            throw serviceError;
        }

        // Authorization: Check if user can view these versions (usually if they can view the modpack)
        // For now, assumed if they can get the parentModpack, they can list versions.

        const versions = await db.query.ModpackVersionsTable.findMany({
            where: and(
                eq(ModpackVersionsTable.modpackId, modpackId),
                not(eq(ModpackVersionsTable.status, ModpackVersionStatus.ARCHIVED))
            ),
            orderBy: desc(ModpackVersionsTable.createdAt)
        });

        const versionModels = versions.map(v => new ModpackVersion(v));
        console.log(`[SERVICE_USER_MODPACKS] Found ${versionModels.length} versions for modpack ID: ${modpackId}.`);
        return versionModels.map(vm => vm.toJson());
    }
}
