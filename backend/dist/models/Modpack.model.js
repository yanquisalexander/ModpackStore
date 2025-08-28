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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Modpack = exports.modpackUpdateSchema = exports.newModpackSchema = exports.ModpackStatus = exports.ModpackVisibility = void 0;
// src/models/Modpack.model.ts
const zod_1 = require("zod");
const client_1 = require("@/db/client");
const drizzle_orm_1 = require("drizzle-orm");
const schema_1 = require("@/db/schema");
// ModpackUpdateData is now inferred from modpackUpdateSchema
// Enums
var ModpackVisibility;
(function (ModpackVisibility) {
    ModpackVisibility["PUBLIC"] = "public";
    ModpackVisibility["PRIVATE"] = "private";
    ModpackVisibility["PATREON"] = "patreon";
})(ModpackVisibility || (exports.ModpackVisibility = ModpackVisibility = {}));
var ModpackStatus;
(function (ModpackStatus) {
    ModpackStatus["DRAFT"] = "draft";
    ModpackStatus["PUBLISHED"] = "published";
    ModpackStatus["ARCHIVED"] = "archived";
    ModpackStatus["DELETED"] = "deleted";
})(ModpackStatus || (exports.ModpackStatus = ModpackStatus = {}));
exports.newModpackSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100),
    shortDescription: zod_1.z.string().max(200).optional(),
    description: zod_1.z.string().optional(),
    slug: zod_1.z.string().min(1).max(50).regex(/^[a-z0-9-]+$/),
    iconUrl: zod_1.z.string(),
    bannerUrl: zod_1.z.string(),
    trailerUrl: zod_1.z.string().optional(),
    password: zod_1.z.string().optional(),
    visibility: zod_1.z.nativeEnum(ModpackVisibility),
    status: zod_1.z.nativeEnum(ModpackStatus).default(ModpackStatus.DRAFT).optional(),
    publisherId: zod_1.z.string().uuid(),
    showUserAsPublisher: zod_1.z.boolean().default(false),
    creatorUserId: zod_1.z.string().uuid().optional(),
});
exports.modpackUpdateSchema = exports.newModpackSchema.omit({ slug: true }).partial().extend({
    status: zod_1.z.nativeEnum(ModpackStatus).optional(),
});
class Modpack {
    constructor(data) {
        var _a;
        // Immutable fields
        this.id = data.id;
        this.slug = data.slug;
        this.publisherId = data.publisherId;
        this.createdAt = data.createdAt;
        // Mutable fields
        this.name = data.name;
        this.shortDescription = data.shortDescription;
        this.description = data.description;
        this.iconUrl = data.iconUrl;
        this.bannerUrl = data.bannerUrl;
        this.trailerUrl = data.trailerUrl;
        this.password = data.password;
        this.visibility = data.visibility;
        this.status = data.status;
        this.showUserAsPublisher = (_a = data.showUserAsPublisher) !== null && _a !== void 0 ? _a : false;
        this.creatorUserId = data.creatorUserId;
        this.updatedAt = data.updatedAt;
    }
    // Static factory methods
    static create(data) {
        return __awaiter(this, void 0, void 0, function* () {
            const parsed = exports.newModpackSchema.safeParse(data);
            if (!parsed.success) {
                throw new Error(`Invalid modpack data: ${JSON.stringify(parsed.error.format())}`);
            }
            // Check if slug is already taken
            const existingModpack = yield Modpack.findBySlug(parsed.data.slug);
            if (existingModpack) {
                throw new Error(`Modpack with slug '${parsed.data.slug}' already exists`);
            }
            const now = new Date();
            try {
                const [inserted] = yield client_1.client
                    .insert(schema_1.ModpacksTable)
                    .values(Object.assign(Object.assign({}, parsed.data), { createdAt: now, updatedAt: now }))
                    .returning();
                return new Modpack(inserted);
            }
            catch (error) {
                throw new Error(`Failed to create modpack: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        });
    }
    // Query methods
    static findById(id) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!(id === null || id === void 0 ? void 0 : id.trim()))
                return null;
            try {
                const [modpack] = yield client_1.client.select().from(schema_1.ModpacksTable).where((0, drizzle_orm_1.eq)(schema_1.ModpacksTable.id, id));
                return modpack ? new Modpack(modpack) : null;
            }
            catch (error) {
                console.error(`Error finding modpack by ID ${id}:`, error);
                return null;
            }
        });
    }
    static findBySlug(slug) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!(slug === null || slug === void 0 ? void 0 : slug.trim()))
                return null;
            try {
                const [modpack] = yield client_1.client.select().from(schema_1.ModpacksTable).where((0, drizzle_orm_1.eq)(schema_1.ModpacksTable.slug, slug));
                return modpack ? new Modpack(modpack) : null;
            }
            catch (error) {
                console.error(`Error finding modpack by slug ${slug}:`, error);
                return null;
            }
        });
    }
    static findByPublisher(publisherId_1) {
        return __awaiter(this, arguments, void 0, function* (publisherId, limit = 20, offset = 0) {
            if (!(publisherId === null || publisherId === void 0 ? void 0 : publisherId.trim()))
                return [];
            try {
                const modpacks = yield client_1.client
                    .select()
                    .from(schema_1.ModpacksTable)
                    .where((0, drizzle_orm_1.eq)(schema_1.ModpacksTable.publisherId, publisherId))
                    .orderBy((0, drizzle_orm_1.desc)(schema_1.ModpacksTable.updatedAt))
                    .limit(limit)
                    .offset(offset);
                return modpacks.map(modpack => new Modpack(modpack));
            }
            catch (error) {
                console.error(`Error finding modpacks by publisher ${publisherId}:`, error);
                return [];
            }
        });
    }
    static findPublic() {
        return __awaiter(this, arguments, void 0, function* (limit = 20, offset = 0) {
            try {
                const modpacks = yield client_1.client
                    .select()
                    .from(schema_1.ModpacksTable)
                    .where((0, drizzle_orm_1.eq)(schema_1.ModpacksTable.visibility, ModpackVisibility.PUBLIC))
                    .orderBy((0, drizzle_orm_1.desc)(schema_1.ModpacksTable.updatedAt))
                    .limit(limit)
                    .offset(offset);
                return modpacks.map(modpack => new Modpack(modpack));
            }
            catch (error) {
                console.error("Error finding public modpacks:", error);
                return [];
            }
        });
    }
    static getCompleteModpack(id) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!(id === null || id === void 0 ? void 0 : id.trim()))
                return null;
            try {
                const modpack = yield client_1.client.query.ModpacksTable.findFirst({
                    where: (0, drizzle_orm_1.eq)(schema_1.ModpacksTable.id, id),
                    with: {
                        publisher: true,
                        creatorUser: true,
                        categories: {
                            with: {
                                category: true
                            }
                        },
                        versions: {
                            orderBy: (0, drizzle_orm_1.desc)(schema_1.ModpackVersionsTable.createdAt),
                            limit: 10,
                            with: {
                                createdByUser: true,
                                files: true
                            }
                        }
                    }
                });
                return modpack !== null && modpack !== void 0 ? modpack : null;
            }
            catch (error) {
                console.error(`Error getting complete modpack ${id}:`, error);
                return null;
            }
        });
    }
    // Static method for updates
    static update(id, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const parsedData = exports.modpackUpdateSchema.safeParse(data);
            if (!parsedData.success) {
                throw new Error(`Invalid modpack update data: ${JSON.stringify(parsedData.error.format())}`);
            }
            const updatePayload = Object.assign(Object.assign({}, parsedData.data), { updatedAt: new Date() });
            try {
                const [updatedModpackRecord] = yield client_1.client
                    .update(schema_1.ModpacksTable)
                    .set(updatePayload)
                    .where((0, drizzle_orm_1.eq)(schema_1.ModpacksTable.id, id))
                    .returning();
                if (!updatedModpackRecord) {
                    throw new Error("Modpack not found or update failed");
                }
                return new Modpack(updatedModpackRecord);
            }
            catch (error) {
                console.error(`Failed to update modpack ${id}:`, error);
                throw new Error(`Failed to update modpack: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        });
    }
    // Instance methods
    save() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e;
            const dataToSave = {
                name: this.name,
                shortDescription: (_a = this.shortDescription) !== null && _a !== void 0 ? _a : undefined,
                description: (_b = this.description) !== null && _b !== void 0 ? _b : undefined,
                iconUrl: this.iconUrl,
                bannerUrl: this.bannerUrl,
                trailerUrl: (_c = this.trailerUrl) !== null && _c !== void 0 ? _c : undefined,
                password: (_d = this.password) !== null && _d !== void 0 ? _d : undefined,
                visibility: this.visibility,
                status: this.status,
                publisherId: this.publisherId, // publisherId is part of newModpackSchema, so it's in modpackUpdateSchema
                showUserAsPublisher: this.showUserAsPublisher,
                creatorUserId: (_e = this.creatorUserId) !== null && _e !== void 0 ? _e : undefined,
            };
            // Note: slug is not part of modpackUpdateSchema, so it's not included in dataToSave.
            const updatedModpack = yield Modpack.update(this.id, dataToSave);
            // Update current instance properties from the successfully saved modpack data
            Object.assign(this, updatedModpack);
            return this;
        });
    }
    delete() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Soft delete by updating status using the new static update method
                const updatedModpack = yield Modpack.update(this.id, { status: ModpackStatus.DELETED });
                this.status = updatedModpack.status;
                this.updatedAt = updatedModpack.updatedAt;
            }
            catch (error) {
                throw new Error(`Failed to delete modpack: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        });
    }
    getVersions() {
        return __awaiter(this, arguments, void 0, function* (limit = 10, offset = 0) {
            try {
                const versions = yield client_1.client
                    .select()
                    .from(schema_1.ModpackVersionsTable)
                    .where((0, drizzle_orm_1.eq)(schema_1.ModpackVersionsTable.modpackId, this.id))
                    .orderBy((0, drizzle_orm_1.desc)(schema_1.ModpackVersionsTable.createdAt))
                    .limit(limit)
                    .offset(offset);
                return versions;
            }
            catch (error) {
                console.error(`Error getting versions for modpack ${this.id}:`, error);
                return [];
            }
        });
    }
    getLatestVersion() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this._latestVersion) {
                return this._latestVersion;
            }
            try {
                const [version] = yield client_1.client
                    .select()
                    .from(schema_1.ModpackVersionsTable)
                    .where((0, drizzle_orm_1.eq)(schema_1.ModpackVersionsTable.modpackId, this.id))
                    .orderBy((0, drizzle_orm_1.desc)(schema_1.ModpackVersionsTable.createdAt))
                    .limit(1);
                this._latestVersion = version || null;
                return this._latestVersion;
            }
            catch (error) {
                console.error(`Error getting latest version for modpack ${this.id}:`, error);
                return null;
            }
        });
    }
    getCategories() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this._categories) {
                return this._categories;
            }
            try {
                const categories = yield client_1.client
                    .select({
                    id: schema_1.CategoriesTable.id,
                    name: schema_1.CategoriesTable.name,
                    shortDescription: schema_1.CategoriesTable.shortDescription,
                    description: schema_1.CategoriesTable.description,
                    iconUrl: schema_1.CategoriesTable.iconUrl,
                })
                    .from(schema_1.ModpackCategoriesTable)
                    .innerJoin(schema_1.CategoriesTable, (0, drizzle_orm_1.eq)(schema_1.ModpackCategoriesTable.categoryId, schema_1.CategoriesTable.id))
                    .where((0, drizzle_orm_1.eq)(schema_1.ModpackCategoriesTable.modpackId, this.id));
                this._categories = categories;
                return this._categories;
            }
            catch (error) {
                console.error(`Error getting categories for modpack ${this.id}:`, error);
                return [];
            }
        });
    }
    addCategory(categoryId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield client_1.client.insert(schema_1.ModpackCategoriesTable).values({
                    modpackId: this.id,
                    categoryId: categoryId,
                });
                this._categories = undefined; // Clear cache
            }
            catch (error) {
                throw new Error(`Failed to add category: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        });
    }
    removeCategory(categoryId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield client_1.client.delete(schema_1.ModpackCategoriesTable).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.ModpackCategoriesTable.modpackId, this.id), (0, drizzle_orm_1.eq)(schema_1.ModpackCategoriesTable.categoryId, categoryId)));
                this._categories = undefined; // Clear cache
            }
            catch (error) {
                throw new Error(`Failed to remove category: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        });
    }
    // Business logic methods
    isPublic() {
        return this.visibility === ModpackVisibility.PUBLIC;
    }
    isPrivate() {
        return this.visibility === ModpackVisibility.PRIVATE;
    }
    isPatreonOnly() {
        return this.visibility === ModpackVisibility.PATREON;
    }
    requiresPassword() {
        return !!this.password;
    }
    canUserAccess(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isPublic())
                return true;
            if (!userId)
                return false;
            // Check if user is the creator
            if (this.creatorUserId === userId)
                return true;
            // Check if user is member of the publisher organization
            // This would need to be implemented based on your publisher membership logic
            // For now, returning false for private modpacks
            return false;
        });
    }
    validatePassword(password) {
        if (!this.requiresPassword())
            return true;
        return this.password === password;
    }
    // Serialization methods
    toJson() {
        return {
            id: this.id,
            name: this.name,
            shortDescription: this.shortDescription,
            description: this.description,
            slug: this.slug,
            iconUrl: this.iconUrl,
            bannerUrl: this.bannerUrl,
            trailerUrl: this.trailerUrl,
            password: this.password,
            visibility: this.visibility,
            status: this.status,
            publisherId: this.publisherId,
            showUserAsPublisher: this.showUserAsPublisher,
            creatorUserId: this.creatorUserId,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
        };
    }
    toPublicJson() {
        const _a = this.toJson(), { password, status } = _a, publicData = __rest(_a, ["password", "status"]);
        return publicData;
    }
    // Utility methods
    getDisplayName() {
        return this.name;
    }
    getUrl() {
        return `/modpack/${this.slug}`;
    }
    hasTrailer() {
        return !!this.trailerUrl;
    }
}
exports.Modpack = Modpack;
