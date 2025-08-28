"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserModpacksService = void 0;
const Modpack_model_1 = require("@/models/Modpack.model");
const ModpackVersion_model_1 = require("@/models/ModpackVersion.model");
const client_1 = require("@/db/client");
const schema_1 = require("@/db/schema");
const drizzle_orm_1 = require("drizzle-orm");
class UserModpacksService {
    static createModpack(data, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(`[SERVICE_USER_MODPACKS] User ${userId} creating modpack "${data.name}"`);
            // Schema validation should be done in controller before this call,
            // but service can re-validate if it's a public API.
            // For now, assume data is validated.
            // Ensure creatorUserId is correctly set, even if part of schema (belt and braces)
            const modpackDataWithCreator = Object.assign(Object.assign({}, data), { creatorUserId: userId, status: data.status || Modpack_model_1.ModpackStatus.DRAFT });
            try {
                const newModpackInstance = yield Modpack_model_1.Modpack.create(modpackDataWithCreator);
                console.log(`[SERVICE_USER_MODPACKS] Modpack "${newModpackInstance.name}" (ID: ${newModpackInstance.id}) created.`);
                return newModpackInstance.toJson();
            }
            catch (error) {
                // Handle specific errors like slug conflict from the model
                if (error.message.includes('slug') && error.message.includes('already exists')) {
                    const serviceError = new Error(error.message);
                    serviceError.statusCode = 409;
                    serviceError.field = 'slug';
                    throw serviceError;
                }
                console.error('[SERVICE_USER_MODPACKS] Error in createModpack:', error);
                throw error; // Re-throw for controller to handle
            }
        });
    }
    static listUserModpacks(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(`[SERVICE_USER_MODPACKS] Listing modpacks for user ${userId}`);
            const memberships = yield client_1.client.query.PublisherMembersTable.findMany({
                where: (0, drizzle_orm_1.eq)(schema_1.PublisherMembersTable.userId, userId),
                columns: { id: true, publisherId: true }
            });
            if (memberships.length === 0) {
                console.log(`[SERVICE_USER_MODPACKS] User ${userId} has no publisher memberships.`);
                return [];
            }
            const memberIds = memberships.map(m => m.id);
            const relevantScopes = yield client_1.client.query.ScopesTable.findMany({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.inArray)(schema_1.ScopesTable.publisherMemberId, memberIds), (0, drizzle_orm_1.or)(// User needs at least one of these permissions to be considered managing a modpack/publisher
                (0, drizzle_orm_1.eq)(schema_1.ScopesTable.canCreateModpacks, true), (0, drizzle_orm_1.eq)(schema_1.ScopesTable.canEditModpacks, true), (0, drizzle_orm_1.eq)(schema_1.ScopesTable.canDeleteModpacks, true), (0, drizzle_orm_1.eq)(schema_1.ScopesTable.canPublishVersions, true))),
                columns: { publisherId: true, modpackId: true }
            });
            if (relevantScopes.length === 0) {
                console.log(`[SERVICE_USER_MODPACKS] User ${userId} has no relevant management scopes.`);
                return [];
            }
            const manageablePublisherIds = new Set();
            const manageableModpackIds = new Set();
            relevantScopes.forEach(scope => {
                if (scope.publisherId && !scope.modpackId) { // Org-level permission
                    manageablePublisherIds.add(scope.publisherId);
                }
                else if (scope.modpackId) { // Modpack-specific permission
                    manageableModpackIds.add(scope.modpackId);
                }
            });
            console.log(`[SERVICE_USER_MODPACKS] User ${userId} can manage publisher IDs: [${Array.from(manageablePublisherIds).join(', ')}] and modpack IDs: [${Array.from(manageableModpackIds).join(', ')}]`);
            const queryConditions = [];
            if (manageablePublisherIds.size > 0) {
                queryConditions.push((0, drizzle_orm_1.inArray)(schema_1.ModpacksTable.publisherId, Array.from(manageablePublisherIds)));
            }
            if (manageableModpackIds.size > 0) {
                queryConditions.push((0, drizzle_orm_1.inArray)(schema_1.ModpacksTable.id, Array.from(manageableModpackIds)));
            }
            if (queryConditions.length === 0) {
                console.log(`[SERVICE_USER_MODPACKS] No publishers or specific modpacks found for user ${userId} to manage.`);
                return [];
            }
            const modpackEntities = yield client_1.client.query.ModpacksTable.findMany({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.or)(...queryConditions), (0, drizzle_orm_1.not)((0, drizzle_orm_1.eq)(schema_1.ModpacksTable.status, Modpack_model_1.ModpackStatus.DELETED))),
                orderBy: (0, drizzle_orm_1.desc)(schema_1.ModpacksTable.updatedAt)
            });
            console.log(`[SERVICE_USER_MODPACKS] Found ${modpackEntities.length} modpacks for user ${userId}.`);
            const modpacks = modpackEntities.map(entity => new Modpack_model_1.Modpack(entity));
            return modpacks.map(m => m.toJson());
        });
    }
    static updateModpack(modpackId, data, // Data already validated by controller
    userId // For authorization checks (TODO)
    ) {
        return __awaiter(this, void 0, void 0, function* () {
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
            const existingModpack = yield Modpack_model_1.Modpack.findById(modpackId);
            if (!existingModpack) {
                const serviceError = new Error('Modpack not found.');
                serviceError.statusCode = 404;
                throw serviceError;
            }
            // The modpackUpdateSchema from model already omits critical fields like slug, publisherId etc.
            // The controller also strips some fields before validation.
            // Call the static update method on the Modpack model
            const updatedModpackInstance = yield Modpack_model_1.Modpack.update(modpackId, data);
            console.log(`[SERVICE_USER_MODPACKS] Modpack ID: ${modpackId} updated successfully.`);
            return updatedModpackInstance.toJson();
        });
    }
    static deleteModpack(modpackId, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(`[SERVICE_USER_MODPACKS] User ${userId} attempting to delete modpack ID: ${modpackId}`);
            // Authorization: Check permission similar to updateModpack
            // const hasPermission = await checkUserPermissionForModpack(userId, modpackId, 'canDeleteModpacks');
            // if (!hasPermission) { /* ... throw 403 error ... */ }
            const modpack = yield Modpack_model_1.Modpack.findById(modpackId);
            if (!modpack) {
                // If modpack not found, it's effectively "deleted" from user's perspective or can't be acted upon.
                // Depending on desired idempotency, either throw 404 or return true/false.
                // Returning false indicates the operation didn't result in a deletion because it wasn't found.
                console.warn(`[SERVICE_USER_MODPACKS] Modpack ID: ${modpackId} not found for deletion.`);
                return false;
            }
            if (modpack.status === Modpack_model_1.ModpackStatus.DELETED) {
                console.log(`[SERVICE_USER_MODPACKS] Modpack ID: ${modpackId} is already marked as deleted.`);
                return true; // Idempotent: already deleted
            }
            yield modpack.delete(); // This changes status to DELETED
            console.log(`[SERVICE_USER_MODPACKS] Modpack ID: ${modpackId} successfully marked as deleted.`);
            return true;
        });
    }
    // == Modpack Version Management ==
    static createModpackVersion(modpackIdFromParams, data, // Data from client
    userId) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(`[SERVICE_USER_MODPACKS] User ${userId} creating version for modpack ID: ${modpackIdFromParams}`);
            const parentModpack = yield Modpack_model_1.Modpack.findById(modpackIdFromParams);
            if (!parentModpack) {
                const serviceError = new Error('Parent modpack not found.');
                serviceError.statusCode = 404;
                throw serviceError;
            }
            if (parentModpack.status === Modpack_model_1.ModpackStatus.DELETED) {
                const serviceError = new Error('Cannot add versions to a deleted modpack.');
                serviceError.statusCode = 400;
                throw serviceError;
            }
            // Authorization: Check if userId can create versions for this modpack (e.g., via checkUserPermissionForModpack)
            // if (!await checkUserPermissionForModpack(userId, modpackIdFromParams, 'canPublishVersions')) { /* ... throw 403 ... */ }
            const versionDataForModel = Object.assign(Object.assign({}, data), { modpackId: modpackIdFromParams, createdBy: userId });
            // The newModpackVersionSchema in ModpackVersion.model should validate this structure fully.
            // Controller should have already done a safeParse with a similar structure.
            const newVersionInstance = yield ModpackVersion_model_1.ModpackVersion.create(versionDataForModel);
            console.log(`[SERVICE_USER_MODPACKS] Version "${newVersionInstance.version}" (ID: ${newVersionInstance.id}) created for modpack ${modpackIdFromParams}.`);
            return newVersionInstance.toJson();
        });
    }
    static updateModpackVersion(versionId, data, // Validated by controller
    userId) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(`[SERVICE_USER_MODPACKS] User ${userId} updating version ID: ${versionId}`);
            const modpackVersion = yield ModpackVersion_model_1.ModpackVersion.findById(versionId);
            if (!modpackVersion) {
                const serviceError = new Error('Modpack version not found.');
                serviceError.statusCode = 404;
                throw serviceError;
            }
            if (modpackVersion.status !== ModpackVersion_model_1.ModpackVersionStatus.DRAFT) {
                const serviceError = new Error('Only draft versions can be updated.');
                serviceError.statusCode = 403;
                throw serviceError;
            }
            // Authorization: Check if user can edit this version (likely tied to parent modpack's canPublishVersions or canEditModpacks)
            // if (!await checkUserPermissionForModpack(userId, modpackVersion.modpackId, 'canPublishVersions')) { /* ... throw 403 ... */ }
            // ModpackVersion model's static update method
            const updatedVersionInstance = yield ModpackVersion_model_1.ModpackVersion.update(versionId, data);
            console.log(`[SERVICE_USER_MODPACKS] Version ID: ${versionId} updated successfully.`);
            return updatedVersionInstance.toJson();
        });
    }
    static publishModpackVersion(versionId, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(`[SERVICE_USER_MODPACKS] User ${userId} publishing version ID: ${versionId}`);
            const modpackVersion = yield ModpackVersion_model_1.ModpackVersion.findById(versionId);
            if (!modpackVersion) {
                const serviceError = new Error('Modpack version not found.');
                serviceError.statusCode = 404;
                throw serviceError;
            }
            if (modpackVersion.status === ModpackVersion_model_1.ModpackVersionStatus.PUBLISHED) {
                const serviceError = new Error('Version is already published.');
                serviceError.statusCode = 400;
                throw serviceError;
            }
            if (modpackVersion.status !== ModpackVersion_model_1.ModpackVersionStatus.DRAFT) {
                const serviceError = new Error('Only draft versions can be published.');
                serviceError.statusCode = 400;
                throw serviceError;
            }
            // Authorization: Check if user can publish this version
            // if (!await checkUserPermissionForModpack(userId, modpackVersion.modpackId, 'canPublishVersions')) { /* ... throw 403 ... */ }
            // TODO: Add file validation logic here before publishing (e.g., ensure files are uploaded)
            const updateData = {
                status: ModpackVersion_model_1.ModpackVersionStatus.PUBLISHED,
                releaseDate: new Date(),
            };
            const publishedVersion = yield ModpackVersion_model_1.ModpackVersion.update(versionId, updateData);
            // Update parent modpack's updatedAt timestamp
            const parentModpack = yield Modpack_model_1.Modpack.findById(modpackVersion.modpackId);
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
                yield client_1.client.update(schema_1.ModpacksTable)
                    .set({ updatedAt: new Date() }) // Directly set updatedAt
                    .where((0, drizzle_orm_1.eq)(schema_1.ModpacksTable.id, parentModpack.id));
                console.log(`[SERVICE_USER_MODPACKS] Parent modpack ${parentModpack.id} updatedAt timestamp touched.`);
            }
            console.log(`[SERVICE_USER_MODPACKS] Version ID: ${versionId} published successfully.`);
            return publishedVersion.toJson();
        });
    }
    static uploadModpackVersionFile(versionId, file, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(`[SERVICE_USER_MODPACKS] User ${userId} uploading file for version ID: ${versionId}`);
            const modpackVersion = yield ModpackVersion_model_1.ModpackVersion.findById(versionId);
            if (!modpackVersion) {
                const serviceError = new Error('Modpack version not found.');
                serviceError.statusCode = 404;
                throw serviceError;
            }
            if (modpackVersion.status !== ModpackVersion_model_1.ModpackVersionStatus.DRAFT) {
                const serviceError = new Error('Files can only be uploaded to draft versions.');
                serviceError.statusCode = 400;
                throw serviceError;
            }
            // Authorization: Check if user can upload files to this version
            // if (!await checkUserPermissionForModpack(userId, modpackVersion.modpackId, 'canPublishVersions')) { /* ... throw 403 ... */ }
            // Import the ModpackFileUploadService
            const { ModpackFileUploadService, FileType } = yield Promise.resolve().then(() => __importStar(require('./modpackFileUpload')));
            // Create an instance of the upload service
            const uploadService = new ModpackFileUploadService(process.env.R2_REGION || 'auto', process.env.R2_BUCKET_NAME || 'modpackstore', process.env.R2_ENDPOINT);
            try {
                // Determine file type based on the field name
                let fileType = FileType.MODS; // Default to MODS
                // Check the fieldname from multer to determine the file type
                if (file.fieldname === 'configsFile') {
                    fileType = FileType.CONFIGS;
                }
                else if (file.fieldname === 'resourcesFile') {
                    fileType = FileType.RESOURCES;
                }
                // Upload the file
                const uploadResult = yield uploadService.uploadFile(userId, modpackVersion.modpackId, versionId, fileType, file.buffer);
                console.log(`[SERVICE_USER_MODPACKS] File uploaded successfully for version ID: ${versionId}. Result:`, uploadResult);
                // Return the updated version
                return modpackVersion.toJson();
            }
            catch (error) {
                console.error(`[SERVICE_USER_MODPACKS] Error uploading file for version ID: ${versionId}:`, error);
                throw error;
            }
        });
    }
    static listModpackVersions(modpackId, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(`[SERVICE_USER_MODPACKS] User ${userId} listing versions for modpack ID: ${modpackId}`);
            const parentModpack = yield Modpack_model_1.Modpack.findById(modpackId);
            if (!parentModpack) {
                const serviceError = new Error('Modpack not found.');
                serviceError.statusCode = 404;
                throw serviceError;
            }
            // Don't show versions if parent modpack is conceptually inaccessible or deleted
            if (parentModpack.status === Modpack_model_1.ModpackStatus.DELETED) {
                const serviceError = new Error('Modpack not found (or has been deleted).');
                serviceError.statusCode = 404; // Or 410 Gone
                throw serviceError;
            }
            // Authorization: Check if user can view these versions (usually if they can view the modpack)
            // For now, assumed if they can get the parentModpack, they can list versions.
            const versions = yield client_1.client.query.ModpackVersionsTable.findMany({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.ModpackVersionsTable.modpackId, modpackId), (0, drizzle_orm_1.not)((0, drizzle_orm_1.eq)(schema_1.ModpackVersionsTable.status, ModpackVersion_model_1.ModpackVersionStatus.ARCHIVED))),
                orderBy: (0, drizzle_orm_1.desc)(schema_1.ModpackVersionsTable.createdAt)
            });
            const versionModels = versions.map(v => new ModpackVersion_model_1.ModpackVersion(v));
            console.log(`[SERVICE_USER_MODPACKS] Found ${versionModels.length} versions for modpack ID: ${modpackId}.`);
            return versionModels.map(vm => vm.toJson());
        });
    }
}
exports.UserModpacksService = UserModpacksService;
