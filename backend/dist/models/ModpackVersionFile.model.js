"use strict";
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
exports.ModpackVersionFile = exports.modpackVersionFileUpdateSchema = exports.newModpackVersionFileSchema = void 0;
const zod_1 = require("zod");
const client_1 = require("@/db/client");
const schema_1 = require("@/db/schema");
const ModpackVersion_model_1 = require("./ModpackVersion.model");
const drizzle_orm_1 = require("drizzle-orm");
exports.newModpackVersionFileSchema = zod_1.z.object({
    modpackVersionId: zod_1.z.string().uuid(),
    type: zod_1.z.enum(['mods', 'configs', 'resources', 'full_pack']),
    hash: zod_1.z.string().min(1),
    size: zod_1.z.number().int().min(0).optional(), // Made optional in schema, implies can be null in DB or not provided
});
exports.modpackVersionFileUpdateSchema = zod_1.z.object({
    type: zod_1.z.enum(['mods', 'configs', 'resources', 'full_pack']).optional(),
    size: zod_1.z.number().int().min(0).optional().nullable(), // Allowing size to be explicitly set to null or updated
});
class ModpackVersionFile {
    constructor(data) {
        // Immutable fields
        this.id = data.id;
        this.modpackVersionId = data.modpackVersionId;
        this.hash = data.hash;
        this.createdAt = data.createdAt;
        // Mutable fields
        this.type = data.type;
        this.size = data.size;
    }
    static create(data) {
        return __awaiter(this, void 0, void 0, function* () {
            const parsed = exports.newModpackVersionFileSchema.safeParse(data);
            if (!parsed.success) {
                throw new Error(`Invalid modpack version file data: ${JSON.stringify(parsed.error.format())}`);
            }
            // Verify modpack version exists
            const modpackVersion = yield ModpackVersion_model_1.ModpackVersion.findById(parsed.data.modpackVersionId);
            if (!modpackVersion) {
                throw new Error("Modpack version not found");
            }
            const now = new Date();
            try {
                const [inserted] = yield client_1.client
                    .insert(schema_1.ModpackVersionFilesTable)
                    .values(Object.assign(Object.assign({}, parsed.data), { createdAt: now }))
                    .returning();
                return new ModpackVersionFile(inserted);
            }
            catch (error) {
                throw new Error(`Failed to create modpack version file: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        });
    }
    static findById(id) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!id)
                return null;
            try {
                const [file] = yield client_1.client.select().from(schema_1.ModpackVersionFilesTable).where((0, drizzle_orm_1.eq)(schema_1.ModpackVersionFilesTable.id, id));
                return file ? new ModpackVersionFile(file) : null;
            }
            catch (error) {
                console.error(`Error finding modpack version file by ID ${id}:`, error);
                return null;
            }
        });
    }
    static findByHash(hash) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!(hash === null || hash === void 0 ? void 0 : hash.trim()))
                return null;
            try {
                const [file] = yield client_1.client.select().from(schema_1.ModpackVersionFilesTable).where((0, drizzle_orm_1.eq)(schema_1.ModpackVersionFilesTable.hash, hash));
                return file ? new ModpackVersionFile(file) : null;
            }
            catch (error) {
                console.error(`Error finding modpack version file by hash ${hash}:`, error);
                return null;
            }
        });
    }
    // Static method for updates
    static update(id, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const validationResult = exports.modpackVersionFileUpdateSchema.safeParse(data);
            if (!validationResult.success) {
                throw new Error(`Invalid modpack version file update data: ${JSON.stringify(validationResult.error.format())}`);
            }
            if (Object.keys(validationResult.data).length === 0) {
                const currentFile = yield ModpackVersionFile.findById(id);
                if (!currentFile)
                    throw new Error("ModpackVersionFile not found for update with empty payload.");
                return currentFile;
            }
            try {
                const [updatedRecord] = yield client_1.client
                    .update(schema_1.ModpackVersionFilesTable)
                    .set(validationResult.data) // No `updatedAt` field in ModpackVersionFilesTable
                    .where((0, drizzle_orm_1.eq)(schema_1.ModpackVersionFilesTable.id, id))
                    .returning();
                if (!updatedRecord) {
                    throw new Error("ModpackVersionFile not found or update failed.");
                }
                return new ModpackVersionFile(updatedRecord);
            }
            catch (error) {
                console.error(`Failed to update modpack version file ${id}:`, error);
                throw new Error(`Failed to update modpack version file: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        });
    }
    // Instance method for saving current state
    save() {
        return __awaiter(this, void 0, void 0, function* () {
            const dataToSave = {
                type: this.type, // Cast needed if this.type is just string
                size: this.size,
            };
            const updatedFile = yield ModpackVersionFile.update(this.id, dataToSave);
            // Update current instance properties
            this.type = updatedFile.type;
            this.size = updatedFile.size;
            return this;
        });
    }
    // Instance method for deletion
    delete() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield client_1.client.delete(schema_1.ModpackVersionFilesTable).where((0, drizzle_orm_1.eq)(schema_1.ModpackVersionFilesTable.id, this.id));
            }
            catch (error) {
                console.error(`Failed to delete modpack version file ${this.id}:`, error);
                throw new Error(`Failed to delete modpack version file: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        });
    }
    getModpackVersion() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this._modpackVersion) {
                return this._modpackVersion;
            }
            this._modpackVersion = (yield ModpackVersion_model_1.ModpackVersion.findById(this.modpackVersionId)) || null;
            if (!this._modpackVersion) {
                console.warn(`Modpack version not found for file ${this.id}`);
            }
            return this._modpackVersion || null;
        });
    }
    getIndividualFiles() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this._individualFiles) {
                return this._individualFiles;
            }
            try {
                const files = yield client_1.client
                    .select()
                    .from(schema_1.ModpackVersionIndividualFilesTable)
                    .where((0, drizzle_orm_1.eq)(schema_1.ModpackVersionIndividualFilesTable.modpackVersionFileId, this.id));
                this._individualFiles = files;
                return this._individualFiles;
            }
            catch (error) {
                console.error(`Error getting individual files for file ${this.id}:`, error);
                return [];
            }
        });
    }
    toJson() {
        return {
            id: this.id,
            modpackVersionId: this.modpackVersionId,
            type: this.type,
            hash: this.hash,
            size: this.size,
            createdAt: this.createdAt,
        };
    }
    // Utility methods
    getDownloadUrl() {
        return `/api/download/${this.hash}`;
    }
    formatSize() {
        if (!this.size)
            return 'Unknown size';
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = this.size;
        let unitIndex = 0;
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }
        return `${size.toFixed(1)} ${units[unitIndex]}`;
    }
}
exports.ModpackVersionFile = ModpackVersionFile;
