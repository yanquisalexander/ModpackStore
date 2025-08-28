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
exports.Favorite = exports.favoriteSchema = void 0;
const zod_1 = require("zod");
const client_1 = require("@/db/client");
// Assuming FavoritesTable exists in "@/db/schema" with userId and modpackId columns
// If the actual table name or column names are different, this will need adjustment.
const schema_1 = require("@/db/schema");
const User_model_1 = require("./User.model");
const Modpack_model_1 = require("./Modpack.model");
const drizzle_orm_1 = require("drizzle-orm");
// Zod schema for Favorite data (primarily for input validation)
exports.favoriteSchema = zod_1.z.object({
    userId: zod_1.z.string().uuid("Invalid User ID format"),
    modpackId: zod_1.z.string().uuid("Invalid Modpack ID format"),
});
class Favorite {
    // No direct persisted properties like 'id' or 'createdAt' for the favorite itself.
    constructor(user, modpack) {
        this.user = user;
        this.modpack = modpack;
    }
    // Static method to add a favorite
    static add(data) {
        return __awaiter(this, void 0, void 0, function* () {
            const validationResult = exports.favoriteSchema.safeParse(data);
            if (!validationResult.success) {
                console.error("Invalid favorite data:", validationResult.error.format());
                // Consider throwing a custom validation error
                throw new Error(`Invalid favorite data: ${JSON.stringify(validationResult.error.format())}`);
            }
            const { userId, modpackId } = validationResult.data;
            // Check if user and modpack exist
            const user = yield User_model_1.User.findById(userId);
            if (!user) {
                throw new Error(`User with ID ${userId} not found.`);
            }
            const modpack = yield Modpack_model_1.Modpack.findById(modpackId);
            if (!modpack) {
                throw new Error(`Modpack with ID ${modpackId} not found.`);
            }
            try {
                // Using column names as per typical Drizzle/SQL conventions. Adjust if schema is different.
                yield client_1.client.insert(schema_1.FavoritesTable)
                    .values({ userId, modpackId })
                    .onConflictDoNothing(); // Assumes primary key on (userId, modpackId) or unique constraint
                return new Favorite(user, modpack);
            }
            catch (error) {
                console.error(`Failed to add favorite for user ${userId} and modpack ${modpackId}:`, error);
                // Depending on the error, you might want to throw or return null
                // For example, if it's a DB connection error vs. a non-unique error not caught by onConflictDoNothing
                throw new Error(`Could not add favorite: ${error instanceof Error ? error.message : "Unknown error"}`);
            }
        });
    }
    // Static method to remove a favorite
    static remove(data) {
        return __awaiter(this, void 0, void 0, function* () {
            const validationResult = exports.favoriteSchema.safeParse(data);
            if (!validationResult.success) {
                console.error("Invalid favorite data for removal:", validationResult.error.format());
                throw new Error(`Invalid favorite data for removal: ${JSON.stringify(validationResult.error.format())}`);
            }
            const { userId, modpackId } = validationResult.data;
            try {
                const result = yield client_1.client.delete(schema_1.FavoritesTable)
                    .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.FavoritesTable.userId, userId), (0, drizzle_orm_1.eq)(schema_1.FavoritesTable.modpackId, modpackId)));
                return result.rowCount > 0;
            }
            catch (error) {
                console.error(`Failed to remove favorite for user ${userId} and modpack ${modpackId}:`, error);
                throw new Error(`Could not remove favorite: ${error instanceof Error ? error.message : "Unknown error"}`);
            }
        });
    }
    // Static method to find if a specific favorite exists
    static findByUserAndModpack(userId, modpackId) {
        return __awaiter(this, void 0, void 0, function* () {
            const validationResult = exports.favoriteSchema.safeParse({ userId, modpackId });
            if (!validationResult.success) {
                // Log or handle error appropriately
                console.error("Invalid IDs for findByUserAndModpack:", validationResult.error.format());
                return null;
            }
            const { userId: validUserId, modpackId: validModpackId } = validationResult.data;
            try {
                const favoriteRecord = yield client_1.client.query.FavoritesTable.findFirst({
                    where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.FavoritesTable.userId, validUserId), (0, drizzle_orm_1.eq)(schema_1.FavoritesTable.modpackId, validModpackId)),
                });
                if (!favoriteRecord) {
                    return null;
                }
                // If record exists, fetch the full User and Modpack objects
                const user = yield User_model_1.User.findById(validUserId);
                const modpack = yield Modpack_model_1.Modpack.findById(validModpackId);
                if (!user || !modpack) {
                    // This case should ideally not happen if a favoriteRecord exists, implies data inconsistency
                    console.error("Data inconsistency: Favorite record exists but User or Modpack not found.");
                    return null;
                }
                return new Favorite(user, modpack);
            }
            catch (error) {
                console.error(`Error finding favorite by user ${validUserId} and modpack ${validModpackId}:`, error);
                return null; // Or throw
            }
        });
    }
    // Static method to find all favorites for a user
    static findByUser(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!zod_1.z.string().uuid().safeParse(userId).success) {
                console.error("Invalid User ID format for findByUser:", userId);
                return [];
            }
            try {
                const user = yield User_model_1.User.findById(userId);
                if (!user)
                    return []; // Or throw new Error("User not found");
                const favoriteRecords = yield client_1.client.query.FavoritesTable.findMany({
                    where: (0, drizzle_orm_1.eq)(schema_1.FavoritesTable.userId, userId),
                    with: {
                    // Assuming relation names 'modpack' in FavoritesTable that links to ModpacksTable
                    // This depends on how relations are defined in your schema.ts for FavoritesTable
                    // If FavoritesTable is not a full Drizzle table with relations, manual join is needed.
                    // For now, let's assume direct modpack fetching or manual join.
                    // modpack: true // This would be ideal if relations are set up.
                    }
                });
                const favorites = [];
                for (const favRecord of favoriteRecords) {
                    // If relations are not set up to automatically fetch related modpack:
                    const modpack = yield Modpack_model_1.Modpack.findById(favRecord.modpackId);
                    if (modpack) {
                        favorites.push(new Favorite(user, modpack));
                    }
                    else {
                        console.warn(`Modpack with ID ${favRecord.modpackId} not found for favorite of user ${userId}`);
                    }
                }
                return favorites;
            }
            catch (error) {
                console.error(`Error finding favorites by user ${userId}:`, error);
                return []; // Or throw
            }
        });
    }
    // Static method to find all favorites for a modpack
    static findByModpack(modpackId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!zod_1.z.string().uuid().safeParse(modpackId).success) {
                console.error("Invalid Modpack ID format for findByModpack:", modpackId);
                return [];
            }
            try {
                const modpack = yield Modpack_model_1.Modpack.findById(modpackId);
                if (!modpack)
                    return []; // Or throw new Error("Modpack not found");
                const favoriteRecords = yield client_1.client.query.FavoritesTable.findMany({
                    where: (0, drizzle_orm_1.eq)(schema_1.FavoritesTable.modpackId, modpackId),
                    // with: { user: true } // Similar to above, depends on schema relations
                });
                const favorites = [];
                for (const favRecord of favoriteRecords) {
                    const user = yield User_model_1.User.findById(favRecord.userId);
                    if (user) {
                        favorites.push(new Favorite(user, modpack));
                    }
                    else {
                        console.warn(`User with ID ${favRecord.userId} not found for favorite of modpack ${modpackId}`);
                    }
                }
                return favorites;
            }
            catch (error) {
                console.error(`Error finding favorites by modpack ${modpackId}:`, error);
                return []; // Or throw
            }
        });
    }
}
exports.Favorite = Favorite;
