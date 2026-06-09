import { z } from "zod";
import { client as db } from "@/db/client";
// Assuming LikesTable exists in "@/db/schema" with userId and modpackId columns
import { LikesTable, UsersTable, ModpacksTable } from "@/db/schema"; // Added UsersTable, ModpacksTable for completeness
import { User } from "./User.model";
import { Modpack } from "./Modpack.model";
import { and, eq } from "drizzle-orm";

// Zod schema for Like data
export const likeSchema = z.object({
  userId: z.string().uuid("Invalid User ID format"),
  modpackId: z.string().uuid("Invalid Modpack ID format"),
});
type LikeInput = z.infer<typeof likeSchema>;

export class Like {
    readonly user: User;
    readonly modpack: Modpack;

    constructor(user: User, modpack: Modpack) {
        this.user = user;
        this.modpack = modpack;
    }

    // Static method to add a like
    static async add(data: LikeInput): Promise<Like | null> {
        const validationResult = likeSchema.safeParse(data);
        if (!validationResult.success) {
            console.error("Invalid like data:", validationResult.error.format());
            throw new Error(`Invalid like data: ${JSON.stringify(validationResult.error.format())}`);
        }

        const { userId, modpackId } = validationResult.data;

        const user = await User.findById(userId);
        if (!user) {
            throw new Error(`User with ID ${userId} not found.`);
        }
        const modpack = await Modpack.findById(modpackId);
        if (!modpack) {
            throw new Error(`Modpack with ID ${modpackId} not found.`);
        }

        try {
            // Adjust column names if LikesTable schema is different
            await db.insert(LikesTable)
                    .values({ userId, modpackId })
                    .onConflictDoNothing(); // Assumes primary key on (userId, modpackId) or unique constraint

            return new Like(user, modpack);
        } catch (error) {
            console.error(`Failed to add like for user ${userId} and modpack ${modpackId}:`, error);
            throw new Error(`Could not add like: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
    }

    // Static method to remove a like
    static async remove(data: LikeInput): Promise<boolean> {
        const validationResult = likeSchema.safeParse(data);
        if (!validationResult.success) {
            console.error("Invalid like data for removal:", validationResult.error.format());
            throw new Error(`Invalid like data for removal: ${JSON.stringify(validationResult.error.format())}`);
        }
        const { userId, modpackId } = validationResult.data;

        try {
            const result = await db.delete(LikesTable)
                .where(and(eq(LikesTable.userId, userId), eq(LikesTable.modpackId, modpackId)));

            return result.rowCount > 0;
        } catch (error) {
            console.error(`Failed to remove like for user ${userId} and modpack ${modpackId}:`, error);
            throw new Error(`Could not remove like: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
    }

    // Static method to find if a specific like exists
    static async findByUserAndModpack(userId: string, modpackId: string): Promise<Like | null> {
        const validationResult = likeSchema.safeParse({ userId, modpackId });
         if (!validationResult.success) {
            console.error("Invalid IDs for findByUserAndModpack (Like):", validationResult.error.format());
            return null;
        }

        const { userId: validUserId, modpackId: validModpackId } = validationResult.data;

        try {
            // Adjust if LikesTable is not queryable via db.query
            const likeRecord = await db.query.LikesTable.findFirst({
                where: and(eq(LikesTable.userId, validUserId), eq(LikesTable.modpackId, validModpackId)),
            });

            if (!likeRecord) {
                return null;
            }

            const user = await User.findById(validUserId);
            const modpack = await Modpack.findById(validModpackId);

            if (!user || !modpack) {
                console.error("Data inconsistency: Like record exists but User or Modpack not found.");
                return null;
            }
            return new Like(user, modpack);

        } catch (error) {
            console.error(`Error finding like by user ${validUserId} and modpack ${validModpackId}:`, error);
            return null;
        }
    }

    // Static method to find all likes for a user (returns liked modpacks wrapped in Like objects)
    static async findByUser(userId: string): Promise<Like[]> {
        if (!z.string().uuid().safeParse(userId).success) {
             console.error("Invalid User ID format for findByUser (Like):", userId);
             return [];
        }

        const user = await User.findById(userId);
        if (!user) return [];

        try {
            // Adjust if LikesTable is not queryable via db.query
            const likeRecords = await db.query.LikesTable.findMany({
                where: eq(LikesTable.userId, userId),
            });

            const likes: Like[] = [];
            for (const likeRecord of likeRecords) {
                const modpack = await Modpack.findById(likeRecord.modpackId);
                if (modpack) {
                    likes.push(new Like(user, modpack));
                } else {
                    console.warn(`Modpack with ID ${likeRecord.modpackId} not found for like by user ${userId}`);
                }
            }
            return likes;
        } catch (error) {
            console.error(`Error finding likes by user ${userId}:`, error);
            return [];
        }
    }

    // Static method to find all likes for a modpack (returns liking users wrapped in Like objects)
    static async findByModpack(modpackId: string): Promise<Like[]> {
         if (!z.string().uuid().safeParse(modpackId).success) {
             console.error("Invalid Modpack ID format for findByModpack (Like):", modpackId);
             return [];
        }

        const modpack = await Modpack.findById(modpackId);
        if (!modpack) return [];

        try {
            // Adjust if LikesTable is not queryable via db.query
            const likeRecords = await db.query.LikesTable.findMany({
                where: eq(LikesTable.modpackId, modpackId),
            });

            const likes: Like[] = [];
            for (const likeRecord of likeRecords) {
                const user = await User.findById(likeRecord.userId);
                if (user) {
                    likes.push(new Like(user, modpack));
                } else {
                     console.warn(`User with ID ${likeRecord.userId} not found for like of modpack ${modpackId}`);
                }
            }
            return likes;
        } catch (error) {
            console.error(`Error finding likes by modpack ${modpackId}:`, error);
            return [];
        }
    }
}
