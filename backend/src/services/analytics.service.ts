import { ModpackDownload } from "@/entities/ModpackDownload";
import { ModpackVote } from "@/entities/ModpackVote";
import { Modpack } from "@/entities/Modpack";
import { ModpackVersion } from "@/entities/ModpackVersion";
import { Publisher } from "@/entities/Publisher";
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

export interface RetentionMetrics {
    averageRetentionDays: number;
    retentionByModpack: Array<{
        modpackName: string;
        averageRetentionDays: number;
        totalUsers: number;
    }>;
    retentionTrend: Array<{
        date: string;
        averageRetention: number;
    }>;
}

export interface UpdateMetrics {
    adoptionRate: number;
    updateAdoptionByVersion: Array<{
        version: string;
        adoptionRate: number;
        totalUsers: number;
    }>;
    updateTrend: Array<{
        date: string;
        updatesAdopted: number;
        totalAvailable: number;
    }>;
}

export interface ComparativeMetrics {
    downloadsVsPlatform: {
        yourDownloads: number;
        platformAverage: number;
        percentile: number;
    };
    retentionVsPlatform: {
        yourRetention: number;
        platformAverage: number;
        percentile: number;
    };
    updateAdoptionVsPlatform: {
        yourAdoption: number;
        platformAverage: number;
        percentile: number;
    };
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
            .select("vote.created_at::date", "date")
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
            .groupBy("vote.created_at::date")
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
            .select("vote.created_at::date", "date")
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

    /**
     * Calculate retention metrics for a publisher
     */
    async getRetentionMetrics(publisherId: string, startDate: Date, endDate: Date): Promise<RetentionMetrics> {
        // Get all modpacks for the publisher
        const modpacks = await Modpack.find({
            where: { publisherId },
            select: ["id", "name"]
        });

        const modpackIds = modpacks.map(m => m.id);

        if (modpackIds.length === 0) {
            return {
                averageRetentionDays: 0,
                retentionByModpack: [],
                retentionTrend: []
            };
        }

        // Calculate retention by modpack
        const retentionByModpack = await Promise.all(
            modpacks.map(async (modpack) => {
                // Get all downloads for this modpack in the date range
                const downloads = await ModpackDownload.find({
                    where: {
                        modpackId: modpack.id,
                        createdAt: Between(startDate, endDate)
                    },
                    order: { createdAt: 'ASC' }
                });

                if (downloads.length === 0) {
                    return {
                        modpackName: modpack.name,
                        averageRetentionDays: 0,
                        totalUsers: 0
                    };
                }

                // Group downloads by user
                const userDownloads = downloads.reduce((acc, download) => {
                    if (!acc[download.userId]) {
                        acc[download.userId] = [];
                    }
                    acc[download.userId].push(download);
                    return acc;
                }, {} as Record<string, typeof downloads>);

                // Calculate retention for each user
                const userRetentions = Object.values(userDownloads).map((userDl) => {
                    const firstDownload = userDl[0].createdAt;
                    const lastDownload = userDl[userDl.length - 1].createdAt;
                    const retentionMs = lastDownload.getTime() - firstDownload.getTime();
                    return retentionMs / (1000 * 60 * 60 * 24); // Convert to days
                });

                const averageRetention = userRetentions.length > 0
                    ? userRetentions.reduce((sum, r) => sum + r, 0) / userRetentions.length
                    : 0;

                return {
                    modpackName: modpack.name,
                    averageRetentionDays: averageRetention,
                    totalUsers: Object.keys(userDownloads).length
                };
            })
        );

        // Calculate overall average retention
        const totalUsers = retentionByModpack.reduce((sum, m) => sum + m.totalUsers, 0);
        const weightedRetention = retentionByModpack.reduce((sum, m) => sum + (m.averageRetentionDays * m.totalUsers), 0);
        const averageRetentionDays = totalUsers > 0 ? weightedRetention / totalUsers : 0;

        // Generate retention trend (simplified - would need more complex logic for real trend)
        const retentionTrend = this.generateRetentionTrend(startDate, endDate, averageRetentionDays);

        return {
            averageRetentionDays,
            retentionByModpack,
            retentionTrend
        };
    }

    /**
     * Calculate update adoption metrics for a publisher
     */
    async getUpdateMetrics(publisherId: string, startDate: Date, endDate: Date): Promise<UpdateMetrics> {
        // Get all modpacks for the publisher
        const modpacks = await Modpack.find({
            where: { publisherId },
            relations: ['versions'],
            select: ["id", "name"]
        });

        const modpackIds = modpacks.map(m => m.id);

        if (modpackIds.length === 0) {
            return {
                adoptionRate: 0,
                updateAdoptionByVersion: [],
                updateTrend: []
            };
        }

        // Get all versions for these modpacks
        const versions = await ModpackVersion.find({
            where: { modpackId: In(modpackIds) },
            order: { createdAt: 'DESC' }
        });

        // Calculate adoption by version
        const updateAdoptionByVersion = await Promise.all(
            versions.slice(0, 5).map(async (version) => { // Top 5 versions
                const versionDownloads = await ModpackDownload.count({
                    where: {
                        versionId: version.id,
                        createdAt: Between(startDate, endDate)
                    }
                });

                // Get total downloads for this modpack
                const modpackDownloads = await ModpackDownload.count({
                    where: {
                        modpackId: version.modpackId,
                        createdAt: Between(startDate, endDate)
                    }
                });

                const adoptionRate = modpackDownloads > 0 ? versionDownloads / modpackDownloads : 0;

                return {
                    version: version.version,
                    adoptionRate,
                    totalUsers: versionDownloads
                };
            })
        );

        // Calculate overall adoption rate
        const totalAdopted = updateAdoptionByVersion.reduce((sum, v) => sum + v.totalUsers, 0);
        const totalAvailable = updateAdoptionByVersion.reduce((sum, v) => sum + (v.totalUsers / Math.max(v.adoptionRate, 0.01)), 0);
        const adoptionRate = totalAvailable > 0 ? totalAdopted / totalAvailable : 0;

        // Generate update trend
        const updateTrend = this.generateUpdateTrend(startDate, endDate);

        return {
            adoptionRate,
            updateAdoptionByVersion,
            updateTrend
        };
    }

    /**
     * Calculate comparative metrics against platform averages
     */
    async getComparativeMetrics(publisherId: string, startDate: Date, endDate: Date): Promise<ComparativeMetrics> {
        // Get publisher's actual metrics
        const publisherModpacks = await Modpack.find({ where: { publisherId }, select: ["id"] });
        const publisherModpackIds = publisherModpacks.map(m => m.id);

        // Calculate publisher's actual downloads
        const publisherDownloads = await ModpackDownload.count({
            where: {
                modpackId: In(publisherModpackIds),
                createdAt: Between(startDate, endDate)
            }
        });

        // Calculate publisher's actual retention
        const publisherRetention = await this.calculatePublisherRetention(publisherId, startDate, endDate);

        // Calculate publisher's actual update adoption
        const publisherAdoption = await this.calculatePublisherUpdateAdoption(publisherId, startDate, endDate);

        // Calculate real platform averages from ALL publishers
        const platformMetrics = await this.calculatePlatformAverages(startDate, endDate);

        // Calculate real percentiles
        const downloadsPercentile = await this.calculatePercentile('downloads', publisherDownloads, startDate, endDate);
        const retentionPercentile = await this.calculatePercentile('retention', publisherRetention, startDate, endDate);
        const adoptionPercentile = await this.calculatePercentile('adoption', publisherAdoption, startDate, endDate);

        return {
            downloadsVsPlatform: {
                yourDownloads: publisherDownloads,
                platformAverage: platformMetrics.averageDownloads,
                percentile: downloadsPercentile
            },
            retentionVsPlatform: {
                yourRetention: publisherRetention,
                platformAverage: platformMetrics.averageRetention,
                percentile: retentionPercentile
            },
            updateAdoptionVsPlatform: {
                yourAdoption: publisherAdoption,
                platformAverage: platformMetrics.averageAdoption,
                percentile: adoptionPercentile
            }
        };
    }

    /**
     * Calculate real platform averages from all publishers
     */
    private async calculatePlatformAverages(startDate: Date, endDate: Date): Promise<{
        averageDownloads: number;
        averageRetention: number;
        averageAdoption: number;
    }> {
        // Get all publishers
        const allPublishers = await Publisher.find({ select: ["id"] });

        if (allPublishers.length === 0) {
            return { averageDownloads: 0, averageRetention: 0, averageAdoption: 0 };
        }

        // Calculate averages for each publisher
        const publisherMetrics = await Promise.all(
            allPublishers.map(async (publisher: Publisher) => ({
                downloads: await ModpackDownload.count({
                    where: {
                        modpackId: In(
                            (await Modpack.find({ where: { publisherId: publisher.id }, select: ["id"] })).map(m => m.id)
                        ),
                        createdAt: Between(startDate, endDate)
                    }
                }),
                retention: await this.calculatePublisherRetention(publisher.id, startDate, endDate),
                adoption: await this.calculatePublisherUpdateAdoption(publisher.id, startDate, endDate)
            }))
        );

        // Calculate platform averages
        const totalDownloads = publisherMetrics.reduce((sum: number, p: any) => sum + p.downloads, 0);
        const totalRetention = publisherMetrics.reduce((sum: number, p: any) => sum + p.retention, 0);
        const totalAdoption = publisherMetrics.reduce((sum: number, p: any) => sum + p.adoption, 0);

        return {
            averageDownloads: totalDownloads / allPublishers.length,
            averageRetention: totalRetention / allPublishers.length,
            averageAdoption: totalAdoption / allPublishers.length
        };
    }

    /**
     * Calculate publisher retention
     */
    private async calculatePublisherRetention(publisherId: string, startDate: Date, endDate: Date): Promise<number> {
        const retentionMetrics = await this.getRetentionMetrics(publisherId, startDate, endDate);
        return retentionMetrics.averageRetentionDays;
    }

    /**
     * Calculate publisher update adoption
     */
    private async calculatePublisherUpdateAdoption(publisherId: string, startDate: Date, endDate: Date): Promise<number> {
        const updateMetrics = await this.getUpdateMetrics(publisherId, startDate, endDate);
        return updateMetrics.adoptionRate;
    }

    /**
     * Calculate percentile for a metric
     */
    private async calculatePercentile(metric: 'downloads' | 'retention' | 'adoption', value: number, startDate: Date, endDate: Date): Promise<number> {
        // Get all publishers' values for this metric
        const allPublishers = await Publisher.find({ select: ["id"] });
        const allValues = await Promise.all(
            allPublishers.map(async (publisher: Publisher) => {
                switch (metric) {
                    case 'downloads':
                        return ModpackDownload.count({
                            where: {
                                modpackId: In(
                                    (await Modpack.find({ where: { publisherId: publisher.id }, select: ["id"] })).map(m => m.id)
                                ),
                                createdAt: Between(startDate, endDate)
                            }
                        });
                    case 'retention':
                        return this.calculatePublisherRetention(publisher.id, startDate, endDate);
                    case 'adoption':
                        return this.calculatePublisherUpdateAdoption(publisher.id, startDate, endDate);
                }
            })
        );

        // Sort values and find percentile
        const sortedValues = allValues.sort((a: number, b: number) => a - b);
        const index = sortedValues.findIndex((v: number) => v >= value);
        return Math.round((index / sortedValues.length) * 100);
    }

    /**
     * Get comprehensive analytics data for a publisher (combines all metrics)
     */
    async getComprehensiveAnalytics(publisherId: string, period: string = '30d'): Promise<{
        retention: RetentionMetrics;
        updates: UpdateMetrics;
        comparative: ComparativeMetrics;
    }> {
        // Calculate date range
        const endDate = new Date();
        const startDate = new Date();

        switch (period) {
            case '7d':
                startDate.setDate(endDate.getDate() - 7);
                break;
            case '30d':
                startDate.setDate(endDate.getDate() - 30);
                break;
            case '90d':
                startDate.setDate(endDate.getDate() - 90);
                break;
            case '1y':
                startDate.setFullYear(endDate.getFullYear() - 1);
                break;
            default:
                startDate.setDate(endDate.getDate() - 30);
        }

        // Get all metrics in parallel
        const [retention, updates, comparative] = await Promise.all([
            this.getRetentionMetrics(publisherId, startDate, endDate),
            this.getUpdateMetrics(publisherId, startDate, endDate),
            this.getComparativeMetrics(publisherId, startDate, endDate)
        ]);

        return { retention, updates, comparative };
    }

    /**
     * Generate a simplified retention trend for the given period
     */
    private generateRetentionTrend(startDate: Date, endDate: Date, averageRetentionDays: number): Array<{ date: string, averageRetention: number }> {
        const trend: Array<{ date: string, averageRetention: number }> = [];
        const currentDate = new Date(startDate);

        while (currentDate <= endDate) {
            trend.push({
                date: currentDate.toISOString().split('T')[0], // Format as YYYY-MM-DD
                averageRetention: averageRetentionDays
            });
            currentDate.setDate(currentDate.getDate() + 1);
        }

        return trend;
    }

    /**
     * Generate a simplified update trend for the given period
     */
    private generateUpdateTrend(startDate: Date, endDate: Date): Array<{ date: string, updatesAdopted: number, totalAvailable: number }> {
        const trend: Array<{ date: string, updatesAdopted: number, totalAvailable: number }> = [];
        const currentDate = new Date(startDate);

        while (currentDate <= endDate) {
            trend.push({
                date: currentDate.toISOString().split('T')[0], // Format as YYYY-MM-DD
                updatesAdopted: 0,
                totalAvailable: 0
            });
            currentDate.setDate(currentDate.getDate() + 1);
        }

        return trend;
    }
}
