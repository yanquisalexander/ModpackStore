import { client as db } from "@/db/client";
import { LikesTable } from "@/db/schema";
import { User } from "./User.model";
import { Modpack } from "./Modpack.model";

export class Like {
    user: User;
    modpack: Modpack;

    constructor(user: User, modpack: Modpack) {
        this.user = user;
        this.modpack = modpack;
    }

    static async addLike(userId: number, modpackId: number): Promise<Like> {
        const [user, modpack] = await Promise.all([
            User.findById(userId),
            Modpack.findById(modpackId),
        ]);

        if (!user || !modpack) {
            throw new Error("User or Modpack not found");
        }

        await db.insert(LikesTable).values({ user_id: userId, modpack_id: modpackId });
        return new Like(user, modpack);
    }
}
