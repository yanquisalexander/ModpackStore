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
exports.Category = exports.updateCategorySchema = exports.createCategorySchema = void 0;
const zod_1 = require("zod");
const client_1 = require("@/db/client");
const schema_1 = require("@/db/schema");
const drizzle_orm_1 = require("drizzle-orm");
// Esquemas de validación
exports.createCategorySchema = zod_1.z.object({
    name: zod_1.z.string().min(1, "Name is required").max(100, "Name too long"),
    shortDescription: zod_1.z.string().max(200, "Short description too long").optional(),
    description: zod_1.z.string().max(1000, "Description too long").optional(),
    iconUrl: zod_1.z.string().url("Invalid icon URL").optional(),
});
exports.updateCategorySchema = exports.createCategorySchema.partial();
class Category {
    constructor(data) {
        this.id = data.id;
        this.name = data.name;
        this.shortDescription = data.shortDescription;
        this.description = data.description;
        this.iconUrl = data.iconUrl;
        this.createdAt = data.createdAt;
    }
    // Static method for creation
    static create(data) {
        return __awaiter(this, void 0, void 0, function* () {
            // Using safeParse for better error handling if needed, though parse throws and can be caught upstream.
            const validationResult = exports.createCategorySchema.safeParse(data);
            if (!validationResult.success) {
                // Or handle error more specifically, e.g., throw new CustomValidationError(...)
                throw new Error(`Invalid category data: ${JSON.stringify(validationResult.error.format())}`);
            }
            const [insertedRecord] = yield client_1.client
                .insert(schema_1.CategoriesTable)
                .values(validationResult.data)
                .returning();
            if (!insertedRecord) {
                throw new Error("Failed to create category: No record returned.");
            }
            return new Category(insertedRecord);
        });
    }
    // Static method for finding by ID
    static findById(id) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!(id === null || id === void 0 ? void 0 : id.trim()))
                return null;
            try {
                const [record] = yield client_1.client
                    .select()
                    .from(schema_1.CategoriesTable)
                    .where((0, drizzle_orm_1.eq)(schema_1.CategoriesTable.id, id));
                return record ? new Category(record) : null;
            }
            catch (error) {
                console.error(`Error finding category by ID ${id}:`, error);
                return null; // Or throw, depending on desired error handling strategy
            }
        });
    }
    // Static method for finding by name
    static findByName(name) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!(name === null || name === void 0 ? void 0 : name.trim()))
                return null;
            try {
                const [record] = yield client_1.client
                    .select()
                    .from(schema_1.CategoriesTable)
                    .where((0, drizzle_orm_1.eq)(schema_1.CategoriesTable.name, name));
                return record ? new Category(record) : null;
            }
            catch (error) {
                console.error(`Error finding category by name ${name}:`, error);
                return null;
            }
        });
    }
    // Static method for finding all categories
    static findAll() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const records = yield client_1.client.select().from(schema_1.CategoriesTable);
                return records.map(record => new Category(record));
            }
            catch (error) {
                console.error("Error finding all categories:", error);
                return [];
            }
        });
    }
    // Static method for updates
    static update(id, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const validationResult = exports.updateCategorySchema.safeParse(data);
            if (!validationResult.success) {
                throw new Error(`Invalid category update data: ${JSON.stringify(validationResult.error.format())}`);
            }
            if (Object.keys(validationResult.data).length === 0) {
                // If there's nothing to update after validation (e.g. empty object passed)
                // Depending on desired behavior, either throw error or return current state
                const currentCategory = yield Category.findById(id);
                if (!currentCategory)
                    throw new Error("Category not found for update with empty payload.");
                return currentCategory;
            }
            const [updatedRecord] = yield client_1.client
                .update(schema_1.CategoriesTable)
                .set(validationResult.data)
                .where((0, drizzle_orm_1.eq)(schema_1.CategoriesTable.id, id))
                .returning();
            if (!updatedRecord) {
                throw new Error("Category not found or update failed.");
            }
            return new Category(updatedRecord);
        });
    }
    // Instance method for saving
    save() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            const dataToSave = {
                name: this.name,
                shortDescription: (_a = this.shortDescription) !== null && _a !== void 0 ? _a : undefined,
                description: (_b = this.description) !== null && _b !== void 0 ? _b : undefined,
                iconUrl: (_c = this.iconUrl) !== null && _c !== void 0 ? _c : undefined,
            };
            const updatedCategory = yield Category.update(this.id, dataToSave);
            // Update current instance properties
            this.name = updatedCategory.name;
            this.shortDescription = updatedCategory.shortDescription;
            this.description = updatedCategory.description;
            this.iconUrl = updatedCategory.iconUrl;
            // Note: `id` and `createdAt` are readonly and should not change.
            return this;
        });
    }
    // Instance method for deletion
    delete() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield client_1.client
                    .delete(schema_1.CategoriesTable)
                    .where((0, drizzle_orm_1.eq)(schema_1.CategoriesTable.id, this.id));
            }
            catch (error) {
                console.error(`Failed to delete category ${this.id}:`, error);
                throw new Error(`Failed to delete category: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        });
    }
    // Instance method to check existence (uses its own ID)
    exists() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const [category] = yield client_1.client
                    .select({ id: schema_1.CategoriesTable.id })
                    .from(schema_1.CategoriesTable)
                    .where((0, drizzle_orm_1.eq)(schema_1.CategoriesTable.id, this.id));
                return !!category;
            }
            catch (error) {
                console.error(`Error checking existence for category ${this.id}:`, error);
                return false; // Or throw
            }
        });
    }
    // Serialization for JSON
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            shortDescription: this.shortDescription,
            description: this.description,
            iconUrl: this.iconUrl,
            createdAt: this.createdAt,
        };
    }
    // Serialization for public API
    toPublic() {
        // For Category, toJSON and toPublic might be the same if no sensitive fields.
        return this.toJSON();
    }
}
exports.Category = Category;
