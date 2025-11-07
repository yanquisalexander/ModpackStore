import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, BaseEntity, Index } from "typeorm";
import { User } from "./User";
import { Modpack } from "./Modpack";
import { ModpackVersion } from "./ModpackVersion";

/**
 * ModpackDownload entity tracks real installations of modpacks.
 * Unlike ModpackAcquisition which tracks purchases/access rights,
 * this tracks when a user actually installs a modpack on their client.
 */
@Entity({ name: "modpack_downloads" })
@Index(["modpackId", "createdAt"])
@Index(["versionId", "createdAt"])
@Index(["userId", "createdAt"])
@Index(["modpackId", "versionId", "createdAt"])
export class ModpackDownload extends BaseEntity {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column({ name: "user_id", type: "uuid" })
    userId: string;

    @Column({ name: "modpack_id", type: "uuid" })
    modpackId: string;

    @Column({ name: "version_id", type: "uuid" })
    versionId: string;

    @Column({ name: "client_ip", type: "text", nullable: true })
    clientIp?: string;

    @Column({ name: "user_agent", type: "text", nullable: true })
    userAgent?: string;

    @CreateDateColumn({ name: "created_at" })
    createdAt: Date;

    // Relations
    @ManyToOne(() => User, { onDelete: "CASCADE" })
    @JoinColumn({ name: "user_id" })
    user: User;

    @ManyToOne(() => Modpack, { onDelete: "CASCADE" })
    @JoinColumn({ name: "modpack_id" })
    modpack: Modpack;

    @ManyToOne(() => ModpackVersion, { onDelete: "CASCADE" })
    @JoinColumn({ name: "version_id" })
    version: ModpackVersion;

    /**
     * Get total downloads for a modpack
     */
    static async getTotalDownloads(modpackId: string): Promise<number> {
        return await this.count({ where: { modpackId } });
    }

    /**
     * Get total downloads for a specific version
     */
    static async getVersionDownloads(versionId: string): Promise<number> {
        return await this.count({ where: { versionId } });
    }

    /**
     * Get downloads grouped by version for a modpack
     */
    static async getDownloadsByVersion(modpackId: string): Promise<Array<{ versionId: string; version: string; downloads: number }>> {
        const result = await this.createQueryBuilder("download")
            .leftJoin("download.version", "version")
            .select("download.versionId", "versionId")
            .addSelect("version.version", "version")
            .addSelect("COUNT(download.id)", "downloads")
            .where("download.modpackId = :modpackId", { modpackId })
            .groupBy("download.versionId")
            .addGroupBy("version.version")
            .orderBy("downloads", "DESC")
            .getRawMany();

        return result.map((r: any) => ({
            versionId: r.versionId,
            version: r.version,
            downloads: parseInt(r.downloads)
        }));
    }

    /**
     * Get downloads over time (time series data)
     */
    static async getDownloadsTimeline(
        modpackId: string,
        startDate?: Date,
        endDate?: Date
    ): Promise<Array<{ date: string; downloads: number }>> {
        let query = this.createQueryBuilder("download")
            .select("download.created_at::date", "date")
            .addSelect("COUNT(download.id)", "downloads")
            .where("download.modpackId = :modpackId", { modpackId });

        if (startDate) {
            query = query.andWhere("download.created_at >= :startDate", { startDate });
        }

        if (endDate) {
            query = query.andWhere("download.created_at <= :endDate", { endDate });
        }

        const result = await query
            .groupBy("download.created_at::date")
            .orderBy("date", "ASC")
            .getRawMany();

        return result.map((r: any) => ({
            date: r.date,
            downloads: parseInt(r.downloads)
        }));
    }

    /**
     * Get recent downloads for a modpack
     */
    static async getRecentDownloads(modpackId: string, limit: number = 10): Promise<ModpackDownload[]> {
        return await this.find({
            where: { modpackId },
            relations: ["user", "version"],
            order: { createdAt: "DESC" },
            take: limit
        });
    }

    /**
     * Track a new download/installation
     */
    static async trackDownload(
        userId: string,
        modpackId: string,
        versionId: string,
        clientIp?: string,
        userAgent?: string
    ): Promise<ModpackDownload> {
        const download = this.create({
            userId,
            modpackId,
            versionId,
            clientIp,
            userAgent
        });

        return await download.save();
    }
}
