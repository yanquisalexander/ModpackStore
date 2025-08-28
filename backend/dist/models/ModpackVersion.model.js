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
exports.ModpackVersion = exports.modpackVersionUpdateSchema = exports.newModpackVersionSchema = exports.ModpackVersionStatus = void 0;
const zod_1 = require("zod");
const client_1 = require("@/db/client");
const schema_1 = require("@/db/schema");
const Modpack_model_1 = require("./Modpack.model");
const drizzle_orm_1 = require("drizzle-orm");
var ModpackVersionStatus;
(function (ModpackVersionStatus) {
    ModpackVersionStatus["DRAFT"] = "draft";
    ModpackVersionStatus["PUBLISHED"] = "published";
    ModpackVersionStatus["ARCHIVED"] = "archived";
})(ModpackVersionStatus || (exports.ModpackVersionStatus = ModpackVersionStatus = {}));
exports.newModpackVersionSchema = zod_1.z.object({
    modpackId: zod_1.z.string().uuid(),
    version: zod_1.z.string().min(1),
    mcVersion: zod_1.z.string().min(1),
    forgeVersion: zod_1.z.string().optional(),
    changelog: zod_1.z.string().min(1),
    status: zod_1.z.nativeEnum(ModpackVersionStatus).default(ModpackVersionStatus.DRAFT).optional(),
    createdBy: zod_1.z.string().uuid(),
});
exports.modpackVersionUpdateSchema = exports.newModpackVersionSchema.partial().omit({
    modpackId: true, // Generally, a version shouldn't move between modpacks
    createdBy: true, // Creator should not change
    version: true, // Version number itself is often immutable; changes imply a new version.
}).extend({
    releaseDate: zod_1.z.date().nullable().optional(),
    // status can be updated via this schema.
});
class ModpackVersion {
    constructor(data) {
        // Immutable fields
        this.id = data.id;
        this.modpackId = data.modpackId;
        this.createdBy = data.createdBy;
        this.releaseDate = data.releaseDate; // Will be null initially
        this.createdAt = data.createdAt;
        // Mutable fields
        this.version = data.version;
        this.mcVersion = data.mcVersion;
        this.forgeVersion = data.forgeVersion;
        this.changelog = data.changelog;
        this.status = data.status; // Initialize status
        this.updatedAt = data.updatedAt;
    }
    static create(data) {
        return __awaiter(this, void 0, void 0, function* () {
            const parsed = exports.newModpackVersionSchema.safeParse(data);
            if (!parsed.success) {
                throw new Error(`Invalid modpack version data: ${JSON.stringify(parsed.error.format())}`);
            }
            // Verify modpack exists
            const modpack = yield Modpack_model_1.Modpack.findById(parsed.data.modpackId);
            if (!modpack) {
                throw new Error("Modpack not found");
            }
            const now = new Date();
            try {
                const [inserted] = yield client_1.client
                    .insert(schema_1.ModpackVersionsTable)
                    .values(Object.assign(Object.assign({}, parsed.data), { 
                    // releaseDate is not set on creation, will be null by default in DB
                    createdAt: now, updatedAt: now }))
                    .returning();
                return new ModpackVersion(inserted);
            }
            catch (error) {
                throw new Error(`Failed to create modpack version: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        });
    }
    static findById(id) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!(id === null || id === void 0 ? void 0 : id.trim()))
                return null;
            try {
                const [version] = yield client_1.client.select().from(schema_1.ModpackVersionsTable).where((0, drizzle_orm_1.eq)(schema_1.ModpackVersionsTable.id, id));
                return version ? new ModpackVersion(version) : null;
            }
            catch (error) {
                console.error(`Error finding modpack version by ID ${id}:`, error);
                return null;
            }
        });
    }
    static findById(id) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!(id === null || id === void 0 ? void 0 : id.trim()))
                return null;
            try {
                const [version] = yield client_1.client.select().from(schema_1.ModpackVersionsTable).where((0, drizzle_orm_1.eq)(schema_1.ModpackVersionsTable.id, id));
                return version ? new ModpackVersion(version) : null;
            }
            catch (error) {
                console.error(`Error finding modpack version by ID ${id}:`, error);
                return null;
            }
        });
    }
    // Static method for updates
    static update(id, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const validationResult = exports.modpackVersionUpdateSchema.safeParse(data);
            if (!validationResult.success) {
                throw new Error(`Invalid modpack version update data: ${JSON.stringify(validationResult.error.format())}`);
            }
            if (Object.keys(validationResult.data).length === 0) {
                const currentVersion = yield ModpackVersion.findById(id);
                if (!currentVersion)
                    throw new Error("ModpackVersion not found for update with empty payload.");
                return currentVersion;
            }
            const updatePayload = Object.assign(Object.assign({}, validationResult.data), { updatedAt: new Date() });
            try {
                const [updatedRecord] = yield client_1.client
                    .update(schema_1.ModpackVersionsTable)
                    .set(updatePayload)
                    .where((0, drizzle_orm_1.eq)(schema_1.ModpackVersionsTable.id, id))
                    .returning();
                if (!updatedRecord) {
                    throw new Error("ModpackVersion not found or update failed.");
                }
                return new ModpackVersion(updatedRecord);
            }
            catch (error) {
                console.error(`Failed to update modpack version ${id}:`, error);
                throw new Error(`Failed to update modpack version: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        });
    }
    // Instance method for saving current state
    save() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const dataToSave = {
                // Fields from modpackVersionUpdateSchema
                mcVersion: this.mcVersion,
                forgeVersion: (_a = this.forgeVersion) !== null && _a !== void 0 ? _a : undefined,
                changelog: this.changelog,
                status: this.status,
                releaseDate: this.releaseDate,
                // 'version' field is omitted as it's often immutable. If it were mutable:
                // version: this.version,
            };
            const updatedVersion = yield ModpackVersion.update(this.id, dataToSave);
            // Update current instance properties from the successfully saved data
            Object.assign(this, updatedVersion);
            return this;
        });
    }
    // Instance method for soft deletion (setting status to ARCHIVED)
    delete() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const updatedVersion = yield ModpackVersion.update(this.id, { status: ModpackVersionStatus.ARCHIVED });
                this.status = updatedVersion.status;
                this.updatedAt = updatedVersion.updatedAt; // Ensure updatedAt is also updated on the instance
            }
            catch (error) {
                // Log the specific error from the update attempt if needed
                throw new Error(`Failed to soft-delete modpack version ${this.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        });
    }
    getModpack() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this._modpack) {
                return this._modpack;
            }
            this._modpack = yield Modpack_model_1.Modpack.findById(this.modpackId);
            return this._modpack;
        });
    }
    getFiles() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this._files) {
                return this._files;
            }
            try {
                const files = yield client_1.client
                    .select()
                    .from(schema_1.ModpackVersionFilesTable)
                    .where((0, drizzle_orm_1.eq)(schema_1.ModpackVersionFilesTable.modpackVersionId, this.id));
                this._files = files;
                return this._files;
            }
            catch (error) {
                console.error(`Error getting files for version ${this.id}:`, error);
                return [];
            }
        });
    }
    toJson() {
        return {
            id: this.id,
            modpackId: this.modpackId,
            version: this.version,
            mcVersion: this.mcVersion,
            forgeVersion: this.forgeVersion,
            changelog: this.changelog,
            status: this.status, // Added status
            releaseDate: this.releaseDate,
            createdBy: this.createdBy,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
        };
    }
}
exports.ModpackVersion = ModpackVersion;
