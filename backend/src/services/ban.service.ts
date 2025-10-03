import { Repository } from "typeorm";
import { IsNull } from "typeorm";
import { Ban } from "../entities/Ban";
import { User } from "../entities/User";
import { AppDataSource } from "../db/data-source";

export class BanService {
    private static banRepository: Repository<Ban> = AppDataSource.getRepository(Ban);

    /**
     * Get active ban for a user
     */
    static async getActiveBan(userId: string): Promise<Ban | null> {
        return await this.banRepository.findOne({
            where: { userId, unbanDate: IsNull() },
            relations: ["admin"],
            order: { banDate: "DESC" }
        });
    }

    /**
     * Check if a user is banned
     */
    static async isBanned(userId: string): Promise<boolean> {
        const activeBan = await this.getActiveBan(userId);
        return activeBan !== null;
    }

    /**
     * Get ban history for a user
     */
    static async getBanHistory(userId: string): Promise<Ban[]> {
        return await this.banRepository.find({
            where: { userId },
            relations: ["admin", "unbannedBy"],
            order: { banDate: "DESC" }
        });
    }

    /**
     * Get active ban with user details
     */
    static async getActiveBanWithDetails(userId: string): Promise<Ban | null> {
        const activeBan = await this.getActiveBan(userId);
        return activeBan;
    }
}