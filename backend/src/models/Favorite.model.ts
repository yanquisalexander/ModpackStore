import { z } from "zod";
import { client as db } from "@/db/client";
// Assuming FavoritesTable exists in "@/db/schema" with userId and modpackId columns
// If the actual table name or column names are different, this will need adjustment.
import { FavoritesTable, UsersTable, ModpacksTable } from "@/db/schema";
import { User } from "./User.model";
import { Modpack } from "./Modpack.model";
import { and, eq } from "drizzle-orm";

// Zod schema for Favorite data (primarily for input validation)
export const favoriteSchema = z.object({
  userId: z.string().uuid("Invalid User ID format"),
  modpackId: z.string().uuid("Invalid Modpack ID format"),
});
type FavoriteInput = z.infer<typeof favoriteSchema>;

export class Favorite {
    readonly user: User;
    readonly modpack: Modpack;
    // No direct persisted properties like 'id' or 'createdAt' for the favorite itself.

    constructor(user: User, modpack: Modpack) {
        this.user = user;
        this.modpack = modpack;
    }

    // Static method to add a favorite
    static async add(data: FavoriteInput): Promise<Favorite | null> {
        const validationResult = favoriteSchema.safeParse(data);
        if (!validationResult.success) {
            console.error("Invalid favorite data:", validationResult.error.format());
            // Consider throwing a custom validation error
            throw new Error(`Invalid favorite data: ${JSON.stringify(validationResult.error.format())}`);
        }

        const { userId, modpackId } = validationResult.data;

        // Check if user and modpack exist
        const user = await User.findById(userId);
        if (!user) {
            throw new Error(`User with ID ${userId} not found.`);
        }
        const modpack = await Modpack.findById(modpackId);
        if (!modpack) {
            throw new Error(`Modpack with ID ${modpackId} not found.`);
        }

        try {
            // Using column names as per typical Drizzle/SQL conventions. Adjust if schema is different.
            await db.insert(FavoritesTable)
                    .values({ userId, modpackId })
                    .onConflictDoNothing(); // Assumes primary key on (userId, modpackId) or unique constraint

            return new Favorite(user, modpack);
        } catch (error) {
            console.error(`Failed to add favorite for user ${userId} and modpack ${modpackId}:`, error);
            // Depending on the error, you might want to throw or return null
            // For example, if it's a DB connection error vs. a non-unique error not caught by onConflictDoNothing
            throw new Error(`Could not add favorite: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
    }

    // Static method to remove a favorite
    static async remove(data: FavoriteInput): Promise<boolean> {
        const validationResult = favoriteSchema.safeParse(data);
        if (!validationResult.success) {
            console.error("Invalid favorite data for removal:", validationResult.error.format());
            throw new Error(`Invalid favorite data for removal: ${JSON.stringify(validationResult.error.format())}`);
        }
        const { userId, modpackId } = validationResult.data;

        try {
            const result = await db.delete(FavoritesTable)
                .where(and(eq(FavoritesTable.userId, userId), eq(FavoritesTable.modpackId, modpackId)));

            return result.rowCount > 0;
        } catch (error) {
            console.error(`Failed to remove favorite for user ${userId} and modpack ${modpackId}:`, error);
            throw new Error(`Could not remove favorite: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
    }

    // Static method to find if a specific favorite exists
    static async findByUserAndModpack(userId: string, modpackId: string): Promise<Favorite | null> {
        const validationResult = favoriteSchema.safeParse({ userId, modpackId });
         if (!validationResult.success) {
            // Log or handle error appropriately
            console.error("Invalid IDs for findByUserAndModpack:", validationResult.error.format());
            return null;
        }

        const { userId: validUserId, modpackId: validModpackId } = validationResult.data;

        try {
            const favoriteRecord = await db.query.FavoritesTable.findFirst({
                where: and(eq(FavoritesTable.userId, validUserId), eq(FavoritesTable.modpackId, validModpackId)),
            });

            if (!favoriteRecord) {
                return null;
            }

            // If record exists, fetch the full User and Modpack objects
            const user = await User.findById(validUserId);
            const modpack = await Modpack.findById(validModpackId);

            if (!user || !modpack) {
                // This case should ideally not happen if a favoriteRecord exists, implies data inconsistency
                console.error("Data inconsistency: Favorite record exists but User or Modpack not found.");
                return null;
            }
            return new Favorite(user, modpack);

        } catch (error) {
            console.error(`Error finding favorite by user ${validUserId} and modpack ${validModpackId}:`, error);
            return null; // Or throw
        }
    }

    // Static method to find all favorites for a user
    static async findByUser(userId: string): Promise<Favorite[]> {
        if (!z.string().uuid().safeParse(userId).success) {
             console.error("Invalid User ID format for findByUser:", userId);
             return [];
        }

        try {
            const user = await User.findById(userId);
            if (!user) return []; // Or throw new Error("User not found");

            const favoriteRecords = await db.query.FavoritesTable.findMany({
                where: eq(FavoritesTable.userId, userId),
                with: {
                    // Assuming relation names 'modpack' in FavoritesTable that links to ModpacksTable
                    // This depends on how relations are defined in your schema.ts for FavoritesTable
                    // If FavoritesTable is not a full Drizzle table with relations, manual join is needed.
                    // For now, let's assume direct modpack fetching or manual join.
                    // modpack: true // This would be ideal if relations are set up.
                }
            });

            const favorites: Favorite[] = [];
            for (const favRecord of favoriteRecords) {
                // If relations are not set up to automatically fetch related modpack:
                const modpack = await Modpack.findById(favRecord.modpackId);
                if (modpack) {
                    favorites.push(new Favorite(user, modpack));
                } else {
                    console.warn(`Modpack with ID ${favRecord.modpackId} not found for favorite of user ${userId}`);
                }
            }
            return favorites;
        } catch (error) {
            console.error(`Error finding favorites by user ${userId}:`, error);
            return []; // Or throw
        }
    }

    // Static method to find all favorites for a modpack
    static async findByModpack(modpackId: string): Promise<Favorite[]> {
         if (!z.string().uuid().safeParse(modpackId).success) {
             console.error("Invalid Modpack ID format for findByModpack:", modpackId);
             return [];
        }

        try {
            const modpack = await Modpack.findById(modpackId);
            if (!modpack) return []; // Or throw new Error("Modpack not found");

            const favoriteRecords = await db.query.FavoritesTable.findMany({
                where: eq(FavoritesTable.modpackId, modpackId),
                 // with: { user: true } // Similar to above, depends on schema relations
            });

            const favorites: Favorite[] = [];
            for (const favRecord of favoriteRecords) {
                const user = await User.findById(favRecord.userId);
                if (user) {
                    favorites.push(new Favorite(user, modpack));
                } else {
                     console.warn(`User with ID ${favRecord.userId} not found for favorite of modpack ${modpackId}`);
                }
            }
            return favorites;
        } catch (error) {
            console.error(`Error finding favorites by modpack ${modpackId}:`, error);
            return []; // Or throw
        }
    }
}
