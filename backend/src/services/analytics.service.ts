import { ModpackDownload } from "@/entities/ModpackDownload";
import { ModpackVote } from "@/entities/ModpackVote";
import { Modpack } from "@/entities/Modpack";
import { ModpackVersion } from "@/entities/ModpackVersion";
import { Between, In, MoreThanOrEqual, LessThanOrEqual } from "typeorm";

export interface AnalyticsOverview {
    totalDownloads: number;
    totalModpacks: number;
    totalLikes: number;
    totalDislikes: number;
    topModpacks: Array<{
        modpackId: string;
        name: string;
        downloads: number;
        likes: number;
        dislikes: number;
    }>;
}

export interface ModpackAnalytics {
    modpackId: string;
    name: string;
    totalDownloads: number;
    likes: number;
    dislikes: number;
    netScore: number;
    downloadsByVersion: Array<{
        versionId: string;
        version: string;
        downloads: number;
    }>;
    recentDownloads: Array<{
        userId: string;
        username: string;
        versionId: string;
        version: string;
        downloadedAt: Date;
    }>;
}

export interface VersionAnalytics {
    versionId: string;
    version: string;
    downloads: number;
    mcVersion: string;
    loaderType?: string;
    loaderVersion?: string;
    publishedAt?: Date;
}

export interface TimelineData {
    date: string;
    downloads: number;
}

export interface VotesTimelineData {
    date: string;
    likes: number;
    dislikes: number;
    netScore: number;
}

export class AnalyticsService {
    /**
     * Get overview analytics for all modpacks in a publisher
     */
    async getPublisherOverview(publisherId: string): Promise<AnalyticsOverview> {
        // Get all modpacks for the publisher
        const modpacks = await Modpack.find({
            where: { publisherId },
            select: ["id", "name"]
        });

        const modpackIds = modpacks.map(m => m.id);

        if (modpackIds.length === 0) {
            return {
                totalDownloads: 0,
                totalModpacks: 0,
                totalLikes: 0,
                totalDislikes: 0,
                topModpacks: []
            };
        }

        // Get total downloads
        const totalDownloads = await ModpackDownload.count({
            where: { modpackId: In(modpackIds) }
        });

        // Get vote counts
        const votes = await ModpackVote.find({
            where: { modpackId: In(modpackIds) }
        });

        const totalLikes = votes.filter(v => v.vote === 1).length;
        const totalDislikes = votes.filter(v => v.vote === -1).length;

        // Get top modpacks by downloads
        const downloadsByModpack = await ModpackDownload.createQueryBuilder("download")
            .select("download.modpackId", "modpackId")
            .addSelect("COUNT(download.id)", "downloads")
            .where("download.modpackId IN (:...modpackIds)", { modpackIds })
            .groupBy("download.modpackId")
            .orderBy("downloads", "DESC")
            .limit(5)
            .getRawMany();

        // Get vote counts for top modpacks
        const topModpackIds = downloadsByModpack.map((d: any) => d.modpackId);
        const topModpacksVotes = await ModpackVote.find({
            where: { modpackId: In(topModpackIds) }
        });

        const votesByModpack = new Map<string, { likes: number; dislikes: number }>();
        for (const vote of topModpacksVotes) {
            if (!votesByModpack.has(vote.modpackId)) {
                votesByModpack.set(vote.modpackId, { likes: 0, dislikes: 0 });
            }
            const counts = votesByModpack.get(vote.modpackId)!;
            if (vote.vote === 1) counts.likes++;
            else if (vote.vote === -1) counts.dislikes++;
        }

        // Build top modpacks array
        const topModpacks = await Promise.all(
            downloadsByModpack.map(async (d: any) => {
                const modpack = modpacks.find(m => m.id === d.modpackId);
                const voteCounts = votesByModpack.get(d.modpackId) || { likes: 0, dislikes: 0 };
                return {
                    modpackId: d.modpackId,
                    name: modpack?.name || "Unknown",
                    downloads: parseInt(d.downloads),
                    likes: voteCounts.likes,
                    dislikes: voteCounts.dislikes
                };
            })
        );

        return {
            totalDownloads,
            totalModpacks: modpacks.length,
            totalLikes,
            totalDislikes,
            topModpacks
        };
    }

    /**
     * Get detailed analytics for a specific modpack
     */
    async getModpackAnalytics(modpackId: string): Promise<ModpackAnalytics> {
        // Get modpack details
        const modpack = await Modpack.findOne({
            where: { id: modpackId },
            select: ["id", "name"]
        });

        if (!modpack) {
            throw new Error("Modpack not found");
        }

        // Get total downloads
        const totalDownloads = await ModpackDownload.getTotalDownloads(modpackId);

        // Get vote counts
        const { likes, dislikes } = await ModpackVote.getVoteCounts(modpackId);

        // Get downloads by version
        const downloadsByVersion = await ModpackDownload.getDownloadsByVersion(modpackId);

        // Get recent downloads with user and version info
        const recentDownloadsRaw = await ModpackDownload.find({
            where: { modpackId },
            relations: ["user", "version"],
            order: { createdAt: "DESC" },
            take: 10
        });

        const recentDownloads = recentDownloadsRaw.map(d => ({
            userId: d.userId,
            username: d.user?.username || "Unknown",
            versionId: d.versionId,
            version: d.version?.version || "Unknown",
            downloadedAt: d.createdAt
        }));

        return {
            modpackId,
            name: modpack.name,
            totalDownloads,
            likes,
            dislikes,
            netScore: likes - dislikes,
            downloadsByVersion,
            recentDownloads
        };
    }

    /**
     * Get analytics for a specific version
     */
    async getVersionAnalytics(versionId: string): Promise<VersionAnalytics> {
        const version = await ModpackVersion.findOne({
            where: { id: versionId },
            select: ["id", "version", "mcVersion", "loaderType", "loaderVersion", "releaseDate"]
        });

        if (!version) {
            throw new Error("Version not found");
        }

        const downloads = await ModpackDownload.getVersionDownloads(versionId);

        return {
            versionId: version.id,
            version: version.version,
            downloads,
            mcVersion: version.mcVersion,
            loaderType: version.loaderType,
            loaderVersion: version.loaderVersion || undefined,
            publishedAt: version.releaseDate || undefined
        };
    }

    /**
     * Get downloads timeline for a modpack
     */
    async getDownloadsTimeline(
        modpackId: string,
        startDate?: Date,
        endDate?: Date
    ): Promise<TimelineData[]> {
        return await ModpackDownload.getDownloadsTimeline(modpackId, startDate, endDate);
    }

    /**
     * Get votes timeline for a modpack
     */
    async getVotesTimeline(
        modpackId: string,
        startDate?: Date,
        endDate?: Date
    ): Promise<VotesTimelineData[]> {
        let query = ModpackVote.createQueryBuilder("vote")
            .select("DATE(vote.created_at)", "date")
            .addSelect("SUM(CASE WHEN vote.vote = 1 THEN 1 ELSE 0 END)", "likes")
            .addSelect("SUM(CASE WHEN vote.vote = -1 THEN 1 ELSE 0 END)", "dislikes")
            .where("vote.modpackId = :modpackId", { modpackId });

        if (startDate) {
            query = query.andWhere("vote.created_at >= :startDate", { startDate });
        }

        if (endDate) {
            query = query.andWhere("vote.created_at <= :endDate", { endDate });
        }

        const result = await query
            .groupBy("DATE(vote.created_at)")
            .orderBy("date", "ASC")
            .getRawMany();

        return result.map((r: any) => ({
            date: r.date,
            likes: parseInt(r.likes) || 0,
            dislikes: parseInt(r.dislikes) || 0,
            netScore: parseInt(r.likes || 0) - parseInt(r.dislikes || 0)
        }));
    }

    /**
     * Get cumulative votes timeline (running total over time)
     */
    async getCumulativeVotesTimeline(
        modpackId: string,
        startDate?: Date,
        endDate?: Date
    ): Promise<VotesTimelineData[]> {
        let query = ModpackVote.createQueryBuilder("vote")
            .select("DATE(vote.created_at)", "date")
            .addSelect("vote.vote", "vote")
            .where("vote.modpackId = :modpackId", { modpackId });

        if (startDate) {
            query = query.andWhere("vote.created_at >= :startDate", { startDate });
        }

        if (endDate) {
            query = query.andWhere("vote.created_at <= :endDate", { endDate });
        }

        const votes = await query.orderBy("date", "ASC").getRawMany();

        // Calculate cumulative totals
        const dailyVotes = new Map<string, { likes: number; dislikes: number }>();
        
        for (const vote of votes) {
            const date = vote.date;
            if (!dailyVotes.has(date)) {
                dailyVotes.set(date, { likes: 0, dislikes: 0 });
            }
            const counts = dailyVotes.get(date)!;
            if (vote.vote === 1) counts.likes++;
            else if (vote.vote === -1) counts.dislikes++;
        }

        let cumulativeLikes = 0;
        let cumulativeDislikes = 0;

        return Array.from(dailyVotes.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([date, counts]) => {
                cumulativeLikes += counts.likes;
                cumulativeDislikes += counts.dislikes;
                return {
                    date,
                    likes: cumulativeLikes,
                    dislikes: cumulativeDislikes,
                    netScore: cumulativeLikes - cumulativeDislikes
                };
            });
    }
}
