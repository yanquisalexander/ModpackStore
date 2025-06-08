import { client as db } from "@/db/client";
import { FavoritesTable } from "@/db/schema";
import { User } from "./User.model";
import { Modpack } from "./Modpack.model";

export class Favorite {
    user: User;
    modpack: Modpack;

    constructor(user: User, modpack: Modpack) {
        this.user = user;
        this.modpack = modpack;
    }

    static async addFavorite(userId: number, modpackId: number): Promise<Favorite> {
        const [user, modpack] = await Promise.all([
            User.findById(userId),
            Modpack.findById(modpackId),
        ]);

        if (!user || !modpack) {
            throw new Error("User or Modpack not found");
        }

        await db.insert(FavoritesTable).values({ user_id: userId, modpack_id: modpackId });
        return new Favorite(user, modpack);
    }
}
