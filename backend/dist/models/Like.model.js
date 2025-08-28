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
exports.Like = exports.likeSchema = void 0;
const zod_1 = require("zod");
const client_1 = require("@/db/client");
// Assuming LikesTable exists in "@/db/schema" with userId and modpackId columns
const schema_1 = require("@/db/schema"); // Added UsersTable, ModpacksTable for completeness
const User_model_1 = require("./User.model");
const Modpack_model_1 = require("./Modpack.model");
const drizzle_orm_1 = require("drizzle-orm");
// Zod schema for Like data
exports.likeSchema = zod_1.z.object({
    userId: zod_1.z.string().uuid("Invalid User ID format"),
    modpackId: zod_1.z.string().uuid("Invalid Modpack ID format"),
});
class Like {
    constructor(user, modpack) {
        this.user = user;
        this.modpack = modpack;
    }
    // Static method to add a like
    static add(data) {
        return __awaiter(this, void 0, void 0, function* () {
            const validationResult = exports.likeSchema.safeParse(data);
            if (!validationResult.success) {
                console.error("Invalid like data:", validationResult.error.format());
                throw new Error(`Invalid like data: ${JSON.stringify(validationResult.error.format())}`);
            }
            const { userId, modpackId } = validationResult.data;
            const user = yield User_model_1.User.findById(userId);
            if (!user) {
                throw new Error(`User with ID ${userId} not found.`);
            }
            const modpack = yield Modpack_model_1.Modpack.findById(modpackId);
            if (!modpack) {
                throw new Error(`Modpack with ID ${modpackId} not found.`);
            }
            try {
                // Adjust column names if LikesTable schema is different
                yield client_1.client.insert(schema_1.LikesTable)
                    .values({ userId, modpackId })
                    .onConflictDoNothing(); // Assumes primary key on (userId, modpackId) or unique constraint
                return new Like(user, modpack);
            }
            catch (error) {
                console.error(`Failed to add like for user ${userId} and modpack ${modpackId}:`, error);
                throw new Error(`Could not add like: ${error instanceof Error ? error.message : "Unknown error"}`);
            }
        });
    }
    // Static method to remove a like
    static remove(data) {
        return __awaiter(this, void 0, void 0, function* () {
            const validationResult = exports.likeSchema.safeParse(data);
            if (!validationResult.success) {
                console.error("Invalid like data for removal:", validationResult.error.format());
                throw new Error(`Invalid like data for removal: ${JSON.stringify(validationResult.error.format())}`);
            }
            const { userId, modpackId } = validationResult.data;
            try {
                const result = yield client_1.client.delete(schema_1.LikesTable)
                    .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.LikesTable.userId, userId), (0, drizzle_orm_1.eq)(schema_1.LikesTable.modpackId, modpackId)));
                return result.rowCount > 0;
            }
            catch (error) {
                console.error(`Failed to remove like for user ${userId} and modpack ${modpackId}:`, error);
                throw new Error(`Could not remove like: ${error instanceof Error ? error.message : "Unknown error"}`);
            }
        });
    }
    // Static method to find if a specific like exists
    static findByUserAndModpack(userId, modpackId) {
        return __awaiter(this, void 0, void 0, function* () {
            const validationResult = exports.likeSchema.safeParse({ userId, modpackId });
            if (!validationResult.success) {
                console.error("Invalid IDs for findByUserAndModpack (Like):", validationResult.error.format());
                return null;
            }
            const { userId: validUserId, modpackId: validModpackId } = validationResult.data;
            try {
                // Adjust if LikesTable is not queryable via db.query
                const likeRecord = yield client_1.client.query.LikesTable.findFirst({
                    where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.LikesTable.userId, validUserId), (0, drizzle_orm_1.eq)(schema_1.LikesTable.modpackId, validModpackId)),
                });
                if (!likeRecord) {
                    return null;
                }
                const user = yield User_model_1.User.findById(validUserId);
                const modpack = yield Modpack_model_1.Modpack.findById(validModpackId);
                if (!user || !modpack) {
                    console.error("Data inconsistency: Like record exists but User or Modpack not found.");
                    return null;
                }
                return new Like(user, modpack);
            }
            catch (error) {
                console.error(`Error finding like by user ${validUserId} and modpack ${validModpackId}:`, error);
                return null;
            }
        });
    }
    // Static method to find all likes for a user (returns liked modpacks wrapped in Like objects)
    static findByUser(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!zod_1.z.string().uuid().safeParse(userId).success) {
                console.error("Invalid User ID format for findByUser (Like):", userId);
                return [];
            }
            const user = yield User_model_1.User.findById(userId);
            if (!user)
                return [];
            try {
                // Adjust if LikesTable is not queryable via db.query
                const likeRecords = yield client_1.client.query.LikesTable.findMany({
                    where: (0, drizzle_orm_1.eq)(schema_1.LikesTable.userId, userId),
                });
                const likes = [];
                for (const likeRecord of likeRecords) {
                    const modpack = yield Modpack_model_1.Modpack.findById(likeRecord.modpackId);
                    if (modpack) {
                        likes.push(new Like(user, modpack));
                    }
                    else {
                        console.warn(`Modpack with ID ${likeRecord.modpackId} not found for like by user ${userId}`);
                    }
                }
                return likes;
            }
            catch (error) {
                console.error(`Error finding likes by user ${userId}:`, error);
                return [];
            }
        });
    }
    // Static method to find all likes for a modpack (returns liking users wrapped in Like objects)
    static findByModpack(modpackId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!zod_1.z.string().uuid().safeParse(modpackId).success) {
                console.error("Invalid Modpack ID format for findByModpack (Like):", modpackId);
                return [];
            }
            const modpack = yield Modpack_model_1.Modpack.findById(modpackId);
            if (!modpack)
                return [];
            try {
                // Adjust if LikesTable is not queryable via db.query
                const likeRecords = yield client_1.client.query.LikesTable.findMany({
                    where: (0, drizzle_orm_1.eq)(schema_1.LikesTable.modpackId, modpackId),
                });
                const likes = [];
                for (const likeRecord of likeRecords) {
                    const user = yield User_model_1.User.findById(likeRecord.userId);
                    if (user) {
                        likes.push(new Like(user, modpack));
                    }
                    else {
                        console.warn(`User with ID ${likeRecord.userId} not found for like of modpack ${modpackId}`);
                    }
                }
                return likes;
            }
            catch (error) {
                console.error(`Error finding likes by modpack ${modpackId}:`, error);
                return [];
            }
        });
    }
}
exports.Like = Like;
