import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, BaseEntity, Index, Unique } from "typeorm";
import { Modpack } from "./Modpack";
import { User } from "./User";

@Entity({ name: "modpack_whitelists" })
@Index(["modpackId", "userId"])
@Unique(["modpackId", "userId"])
export class ModpackWhitelist extends BaseEntity {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column({ name: "modpack_id", type: "uuid" })
    modpackId: string;

    @Column({ name: "user_id", type: "uuid" })
    userId: string;

    @Column({ name: "added_by_user_id", type: "uuid" })
    addedByUserId: string;

    @Column({ name: "notes", type: "text", nullable: true })
    notes?: string | null;

    @CreateDateColumn({ name: "created_at" })
    createdAt: Date;

    // Relations
    @ManyToOne(() => Modpack, modpack => modpack.whitelists, { onDelete: "CASCADE" })
    @JoinColumn({ name: "modpack_id" })
    modpack: Modpack;

    @ManyToOne(() => User, { onDelete: "CASCADE" })
    @JoinColumn({ name: "user_id" })
    user: User;

    @ManyToOne(() => User, { onDelete: "CASCADE" })
    @JoinColumn({ name: "added_by_user_id" })
    addedBy: User;

    // Static helper methods
    static async isUserWhitelisted(modpackId: string, userId: string): Promise<boolean> {
        const entry = await ModpackWhitelist.findOne({
            where: { modpackId, userId }
        });
        return !!entry;
    }

    static async getUserWhitelistedModpacks(userId: string): Promise<string[]> {
        const entries = await ModpackWhitelist.find({
            where: { userId },
            select: ['modpackId']
        });
        return entries.map(entry => entry.modpackId);
    }

    static async getModpackWhitelistedUsers(modpackId: string): Promise<User[]> {
        const entries = await ModpackWhitelist.find({
            where: { modpackId },
            relations: ['user']
        });
        return entries.map(entry => entry.user);
    }

    static async addUserToWhitelist(
        modpackId: string,
        userId: string,
        addedByUserId: string,
        notes?: string
    ): Promise<ModpackWhitelist> {
        // Check if already exists
        const existing = await ModpackWhitelist.findOne({
            where: { modpackId, userId }
        });

        if (existing) {
            return existing;
        }

        const whitelist = new ModpackWhitelist();
        whitelist.modpackId = modpackId;
        whitelist.userId = userId;
        whitelist.addedByUserId = addedByUserId;
        whitelist.notes = notes || null;

        return await whitelist.save();
    }

    static async removeUserFromWhitelist(modpackId: string, userId: string): Promise<boolean> {
        const result = await ModpackWhitelist.delete({ modpackId, userId });
        return (result.affected || 0) > 0;
    }

    static async getWhitelistCount(modpackId: string): Promise<number> {
        return await ModpackWhitelist.count({ where: { modpackId } });
    }
}
