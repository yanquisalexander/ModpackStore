import { db } from "@/db/client.ts";
import {
    adCampaignsTable,
    adAnalyticsDailyTable,
    modpacksTable,
    creatorsTable,
    users,
    AdPlacement,
    AdStatus,
    AdType,
    UserRole,
} from "@/db/schema.ts";
import { eq, and, or, isNull, lte, gte, sql, desc, inArray } from "drizzle-orm";

// In-memory anti-fraud / deduplication cache (30s for impressions, 5s for clicks)
const impressionCache = new Map<string, number>();
const clickCache = new Map<string, number>();

// Clean up stale cache keys every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [key, timestamp] of impressionCache.entries()) {
        if (now - timestamp > 60_000) impressionCache.delete(key);
    }
    for (const [key, timestamp] of clickCache.entries()) {
        if (now - timestamp > 30_000) clickCache.delete(key);
    }
}, 300_000);

export interface AdPayload {
    id: string;
    name: string;
    type: string;
    placement: string;
    title: string;
    subtitle: string | null;
    badgeText: string;
    ctaText: string;
    mediaUrl: string;
    targetModpackId: string | null;
    targetUrl: string | null;
    modpack?: {
        id: string;
        name: string;
        slug: string;
        iconUrl: string;
        bannerUrl: string;
    } | null;
    creator?: {
        id: string;
        name: string;
        slug: string;
        logoUrl: string | null;
    } | null;
}

function getTodayString(): string {
    const now = new Date();
    return now.toISOString().split("T")[0]; // YYYY-MM-DD
}

function selectWeightedRandom<T extends { weight: number }>(items: T[]): T | null {
    if (items.length === 0) return null;
    if (items.length === 1) return items[0];

    const totalWeight = items.reduce((sum, item) => sum + Math.max(1, item.weight || 1), 0);
    let random = Math.random() * totalWeight;

    for (const item of items) {
        random -= Math.max(1, item.weight || 1);
        if (random <= 0) return item;
    }
    return items[items.length - 1];
}

export function attachTrackingUtms(
    rawUrl: string | null | undefined,
    campaign: { name?: string; placement?: string; id?: string }
): string | null {
    if (!rawUrl) return null;
    try {
        const parsed = new URL(rawUrl);
        if (!parsed.searchParams.has("utm_source")) {
            parsed.searchParams.set("utm_source", "modpackstore");
        }
        if (!parsed.searchParams.has("utm_medium") && campaign.placement) {
            parsed.searchParams.set("utm_medium", campaign.placement);
        }
        if (!parsed.searchParams.has("utm_campaign")) {
            const slug = (campaign.name || campaign.id || "ad")
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-|-$/g, "");
            parsed.searchParams.set("utm_campaign", slug || "campaign");
        }
        if (!parsed.searchParams.has("utm_content") && campaign.id) {
            parsed.searchParams.set("utm_content", campaign.id);
        }
        return parsed.toString();
    } catch {
        return rawUrl;
    }
}

export const adsService = {
    /**
     * Check if a user is exempt from seeing ads (ModpackStore+ or Admin)
     */
    async isUserAdFree(userId?: string): Promise<boolean> {
        if (!userId) return false;
        const [user] = await db
            .select({
                role: users.role,
                isPlus: users.isPlus,
                adFree: users.adFree,
                patreonId: users.patreonId,
                patreonAccessToken: users.patreonAccessToken,
            })
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);

        if (!user) return false;

        const isAdmin = user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN;
        const hasActivePatreon = Boolean(user.patreonId && user.patreonAccessToken);
        return Boolean(user.adFree || user.isPlus || isAdmin || hasActivePatreon);
    },

    /**
     * Serve an ad for a specific placement.
     * Applies ad-free check, active window check, weighted rotation and fallback to house ads.
     */
    async serveAd(placement: string, userId?: string): Promise<AdPayload | null> {
        if (userId && (await this.isUserAdFree(userId))) {
            return null;
        }

        const now = new Date();

        // Query active campaigns for this placement
        const campaigns = await db
            .select({
                id: adCampaignsTable.id,
                name: adCampaignsTable.name,
                type: adCampaignsTable.type,
                placement: adCampaignsTable.placement,
                title: adCampaignsTable.title,
                subtitle: adCampaignsTable.subtitle,
                badgeText: adCampaignsTable.badgeText,
                ctaText: adCampaignsTable.ctaText,
                mediaUrl: adCampaignsTable.mediaUrl,
                targetModpackId: adCampaignsTable.targetModpackId,
                targetUrl: adCampaignsTable.targetUrl,
                weight: adCampaignsTable.weight,
                maxImpressions: adCampaignsTable.maxImpressions,
                maxClicks: adCampaignsTable.maxClicks,
                modpack: {
                    id: modpacksTable.id,
                    name: modpacksTable.name,
                    slug: modpacksTable.slug,
                    iconUrl: modpacksTable.iconUrl,
                    bannerUrl: modpacksTable.bannerUrl,
                },
                creator: {
                    id: creatorsTable.id,
                    name: creatorsTable.displayName,
                    slug: creatorsTable.slug,
                    logoUrl: creatorsTable.logoUrl,
                },
            })
            .from(adCampaignsTable)
            .leftJoin(modpacksTable, eq(adCampaignsTable.targetModpackId, modpacksTable.id))
            .leftJoin(creatorsTable, eq(adCampaignsTable.creatorId, creatorsTable.id))
            .where(
                and(
                    eq(adCampaignsTable.placement, placement as AdPlacement),
                    eq(adCampaignsTable.status, AdStatus.ACTIVE),
                    lte(adCampaignsTable.startAt, now),
                    or(isNull(adCampaignsTable.endAt), gte(adCampaignsTable.endAt, now)),
                ),
            );

        if (campaigns.length === 0) {
            return null;
        }

        // Check and filter out campaigns that reached their max impressions or clicks
        const cappedCampaignIds = campaigns
            .filter((c) => c.maxImpressions != null || c.maxClicks != null)
            .map((c) => c.id);

        let validCampaigns = campaigns;
        if (cappedCampaignIds.length > 0) {
            const usageRows = await db
                .select({
                    campaignId: adAnalyticsDailyTable.campaignId,
                    totalImpressions: sql<number>`COALESCE(SUM(${adAnalyticsDailyTable.impressions}), 0)::int`,
                    totalClicks: sql<number>`COALESCE(SUM(${adAnalyticsDailyTable.clicks}), 0)::int`,
                })
                .from(adAnalyticsDailyTable)
                .where(inArray(adAnalyticsDailyTable.campaignId, cappedCampaignIds))
                .groupBy(adAnalyticsDailyTable.campaignId);

            const usageMap = new Map(usageRows.map((r) => [r.campaignId, r]));
            const expiredIds: string[] = [];

            validCampaigns = campaigns.filter((c) => {
                if (c.maxImpressions == null && c.maxClicks == null) return true;
                const usage = usageMap.get(c.id);
                const imps = usage?.totalImpressions || 0;
                const clks = usage?.totalClicks || 0;
                if ((c.maxImpressions != null && imps >= c.maxImpressions) ||
                    (c.maxClicks != null && clks >= c.maxClicks)) {
                    expiredIds.push(c.id);
                    return false;
                }
                return true;
            });

            if (expiredIds.length > 0) {
                db.update(adCampaignsTable)
                    .set({ status: AdStatus.COMPLETED, updatedAt: new Date() })
                    .where(inArray(adCampaignsTable.id, expiredIds))
                    .catch((err) => console.error("[ADS] Failed to complete expired campaigns:", err));
            }
        }

        if (validCampaigns.length === 0) {
            return null;
        }

        // Divide into paid campaigns and house ads
        const paidCampaigns = validCampaigns.filter((c) => c.type !== AdType.HOUSE);
        const houseCampaigns = validCampaigns.filter((c) => c.type === AdType.HOUSE);

        // Pick from paid campaigns if any exist, otherwise fallback to house ads
        const pool = paidCampaigns.length > 0 ? paidCampaigns : houseCampaigns;
        const selected = selectWeightedRandom(pool);

        if (!selected) return null;

        const targetUrl = attachTrackingUtms(selected.targetUrl, {
            name: selected.name,
            placement: selected.placement,
            id: selected.id,
        });

        return {
            id: selected.id,
            name: selected.name,
            type: selected.type,
            placement: selected.placement,
            title: selected.title,
            subtitle: selected.subtitle,
            badgeText: selected.badgeText,
            ctaText: selected.ctaText,
            mediaUrl: selected.mediaUrl,
            targetModpackId: selected.targetModpackId,
            targetUrl,
            modpack: selected.modpack?.id ? selected.modpack : null,
            creator: selected.creator?.id ? selected.creator : null,
        };
    },

    /**
     * Get active featured ads for hero carousel
     */
    async getFeaturedSlides(userId?: string): Promise<any[]> {
        if (userId && (await this.isUserAdFree(userId))) {
            return [];
        }

        const now = new Date();
        const rows = await db
            .select({
                id: adCampaignsTable.id,
                name: adCampaignsTable.name,
                title: adCampaignsTable.title,
                description: adCampaignsTable.subtitle,
                badgeText: adCampaignsTable.badgeText,
                ctaText: adCampaignsTable.ctaText,
                bannerUrl: adCampaignsTable.mediaUrl,
                targetModpackId: adCampaignsTable.targetModpackId,
                targetUrl: adCampaignsTable.targetUrl,
                maxImpressions: adCampaignsTable.maxImpressions,
                maxClicks: adCampaignsTable.maxClicks,
                isSponsored: sql<boolean>`true`,
                modpack: {
                    id: modpacksTable.id,
                    name: modpacksTable.name,
                    slug: modpacksTable.slug,
                    iconUrl: modpacksTable.iconUrl,
                },
            })
            .from(adCampaignsTable)
            .leftJoin(modpacksTable, eq(adCampaignsTable.targetModpackId, modpacksTable.id))
            .where(
                and(
                    eq(adCampaignsTable.placement, AdPlacement.HERO_CAROUSEL),
                    eq(adCampaignsTable.status, AdStatus.ACTIVE),
                    lte(adCampaignsTable.startAt, now),
                    or(isNull(adCampaignsTable.endAt), gte(adCampaignsTable.endAt, now)),
                ),
            )
            .orderBy(desc(adCampaignsTable.weight))
            .limit(5);

        return rows.map((r) => ({
            id: r.targetModpackId || r.id,
            campaignId: r.id,
            name: r.title,
            shortDescription: r.description,
            bannerUrl: r.bannerUrl,
            iconUrl: r.modpack?.iconUrl || r.bannerUrl,
            isSponsored: true,
            badgeText: r.badgeText,
            ctaText: r.ctaText,
            targetUrl: attachTrackingUtms(r.targetUrl, {
                name: r.name,
                placement: AdPlacement.HERO_CAROUSEL,
                id: r.id,
            }),
            targetModpackId: r.targetModpackId,
        }));
    },

    /**
     * Track a verified impression with anti-fraud deduplication window (30 seconds)
     */
    async trackImpression(campaignId: string, deviceId: string = "anonymous"): Promise<boolean> {
        const cacheKey = `${campaignId}:${deviceId}`;
        const lastSeen = impressionCache.get(cacheKey);
        const now = Date.now();

        if (lastSeen && now - lastSeen < 30_000) {
            // Deduplicated
            return false;
        }
        impressionCache.set(cacheKey, now);

        const today = getTodayString();

        await db
            .insert(adAnalyticsDailyTable)
            .values({
                campaignId,
                date: today,
                impressions: 1,
                clicks: 0,
            })
            .onConflictDoUpdate({
                target: [adAnalyticsDailyTable.campaignId, adAnalyticsDailyTable.date],
                set: {
                    impressions: sql`${adAnalyticsDailyTable.impressions} + 1`,
                    updatedAt: new Date(),
                },
            });

        return true;
    },

    /**
     * Track an ad click with anti-fraud deduplication window (5 seconds)
     */
    async trackClick(campaignId: string, deviceId: string = "anonymous"): Promise<boolean> {
        const cacheKey = `${campaignId}:${deviceId}`;
        const lastSeen = clickCache.get(cacheKey);
        const now = Date.now();

        if (lastSeen && now - lastSeen < 5_000) {
            return false;
        }
        clickCache.set(cacheKey, now);

        const today = getTodayString();

        await db
            .insert(adAnalyticsDailyTable)
            .values({
                campaignId,
                date: today,
                impressions: 0,
                clicks: 1,
            })
            .onConflictDoUpdate({
                target: [adAnalyticsDailyTable.campaignId, adAnalyticsDailyTable.date],
                set: {
                    clicks: sql`${adAnalyticsDailyTable.clicks} + 1`,
                    updatedAt: new Date(),
                },
            });

        return true;
    },

    /**
     * Get campaigns for admin dashboard with aggregated performance metrics
     */
    async getAllCampaigns() {
        const campaigns = await db
            .select({
                id: adCampaignsTable.id,
                name: adCampaignsTable.name,
                type: adCampaignsTable.type,
                placement: adCampaignsTable.placement,
                status: adCampaignsTable.status,
                title: adCampaignsTable.title,
                subtitle: adCampaignsTable.subtitle,
                badgeText: adCampaignsTable.badgeText,
                ctaText: adCampaignsTable.ctaText,
                mediaUrl: adCampaignsTable.mediaUrl,
                weight: adCampaignsTable.weight,
                targetModpackId: adCampaignsTable.targetModpackId,
                targetUrl: adCampaignsTable.targetUrl,
                paymentMethod: adCampaignsTable.paymentMethod,
                paymentNotes: adCampaignsTable.paymentNotes,
                creatorId: adCampaignsTable.creatorId,
                startAt: adCampaignsTable.startAt,
                endAt: adCampaignsTable.endAt,
                createdAt: adCampaignsTable.createdAt,
                creatorName: creatorsTable.displayName,
                modpackName: modpacksTable.name,
            })
            .from(adCampaignsTable)
            .leftJoin(creatorsTable, eq(adCampaignsTable.creatorId, creatorsTable.id))
            .leftJoin(modpacksTable, eq(adCampaignsTable.targetModpackId, modpacksTable.id))
            .orderBy(desc(adCampaignsTable.createdAt));

        // Get analytics sums for all campaigns
        const analyticsRows = await db
            .select({
                campaignId: adAnalyticsDailyTable.campaignId,
                totalImpressions: sql<number>`COALESCE(SUM(${adAnalyticsDailyTable.impressions}), 0)::int`,
                totalClicks: sql<number>`COALESCE(SUM(${adAnalyticsDailyTable.clicks}), 0)::int`,
            })
            .from(adAnalyticsDailyTable)
            .groupBy(adAnalyticsDailyTable.campaignId);

        const statsMap = new Map(analyticsRows.map((r) => [r.campaignId, r]));

        return campaigns.map((c) => {
            const stats = statsMap.get(c.id);
            const totalImpressions = stats?.totalImpressions || 0;
            const totalClicks = stats?.totalClicks || 0;
            const ctr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : "0.00";

            return {
                ...c,
                totalImpressions,
                totalClicks,
                ctr: `${ctr}%`,
            };
        });
    },

    /**
     * Get campaigns for a specific creator organization
     */
    async getCreatorCampaigns(creatorId: string) {
        const campaigns = await db
            .select({
                id: adCampaignsTable.id,
                name: adCampaignsTable.name,
                type: adCampaignsTable.type,
                placement: adCampaignsTable.placement,
                status: adCampaignsTable.status,
                title: adCampaignsTable.title,
                subtitle: adCampaignsTable.subtitle,
                badgeText: adCampaignsTable.badgeText,
                ctaText: adCampaignsTable.ctaText,
                mediaUrl: adCampaignsTable.mediaUrl,
                targetModpackId: adCampaignsTable.targetModpackId,
                targetUrl: adCampaignsTable.targetUrl,
                paymentMethod: adCampaignsTable.paymentMethod,
                startAt: adCampaignsTable.startAt,
                endAt: adCampaignsTable.endAt,
                createdAt: adCampaignsTable.createdAt,
                modpackName: modpacksTable.name,
            })
            .from(adCampaignsTable)
            .leftJoin(modpacksTable, eq(adCampaignsTable.targetModpackId, modpacksTable.id))
            .where(eq(adCampaignsTable.creatorId, creatorId))
            .orderBy(desc(adCampaignsTable.createdAt));

        const analyticsRows = await db
            .select({
                campaignId: adAnalyticsDailyTable.campaignId,
                totalImpressions: sql<number>`COALESCE(SUM(${adAnalyticsDailyTable.impressions}), 0)::int`,
                totalClicks: sql<number>`COALESCE(SUM(${adAnalyticsDailyTable.clicks}), 0)::int`,
            })
            .from(adAnalyticsDailyTable)
            .groupBy(adAnalyticsDailyTable.campaignId);

        const statsMap = new Map(analyticsRows.map((r) => [r.campaignId, r]));

        return campaigns.map((c) => {
            const stats = statsMap.get(c.id);
            const totalImpressions = stats?.totalImpressions || 0;
            const totalClicks = stats?.totalClicks || 0;
            const ctr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : "0.00";

            return {
                ...c,
                totalImpressions,
                totalClicks,
                ctr: `${ctr}%`,
            };
        });
    },

    /**
     * Check if a modpack already has an active or pending campaign
     */
    async hasActiveModpackCampaign(modpackId: string): Promise<boolean> {
        const now = new Date();
        const existing = await db
            .select({ id: adCampaignsTable.id })
            .from(adCampaignsTable)
            .where(
                and(
                    eq(adCampaignsTable.targetModpackId, modpackId),
                    inArray(adCampaignsTable.status, [AdStatus.ACTIVE, AdStatus.PENDING_APPROVAL]),
                    or(isNull(adCampaignsTable.endAt), gte(adCampaignsTable.endAt, now)),
                ),
            )
            .limit(1);

        return existing.length > 0;
    },

    /**
     * Create a new campaign (Admin or Creator)
     */
    async createCampaign(data: {
        name: string;
        type: AdType;
        placement: AdPlacement;
        status?: AdStatus;
        title: string;
        subtitle?: string | null;
        badgeText?: string;
        ctaText?: string;
        mediaUrl: string;
        weight?: number;
        targetModpackId?: string | null;
        targetUrl?: string | null;
        paymentMethod?: string | null;
        paymentNotes?: string | null;
        creatorId?: string | null;
        createdBy?: string | null;
        startAt?: Date;
        endAt?: Date | null;
    }) {
        if (data.targetModpackId) {
            const alreadyActive = await this.hasActiveModpackCampaign(data.targetModpackId);
            if (alreadyActive) {
                throw new Error("Este modpack ya cuenta con una campaña activa o en espera de aprobación.");
            }
        }

        const [inserted] = await db
            .insert(adCampaignsTable)
            .values({
                name: data.name,
                type: data.type,
                placement: data.placement,
                status: data.status || AdStatus.ACTIVE,
                title: data.title,
                subtitle: data.subtitle || null,
                badgeText: data.badgeText || "Patrocinado",
                ctaText: data.ctaText || "Ver más",
                mediaUrl: data.mediaUrl,
                weight: data.weight ?? 1,
                targetModpackId: data.targetModpackId || null,
                targetUrl: data.targetUrl || null,
                paymentMethod: data.paymentMethod || null,
                paymentNotes: data.paymentNotes || null,
                creatorId: data.creatorId || null,
                createdBy: data.createdBy || null,
                startAt: data.startAt || new Date(),
                endAt: data.endAt || null,
            })
            .returning();

        return inserted;
    },

    /**
     * Update campaign status or metadata
     */
    async updateCampaign(campaignId: string, updates: Partial<{
        name: string;
        status: AdStatus;
        weight: number;
        title: string;
        subtitle: string | null;
        badgeText: string;
        ctaText: string;
        mediaUrl: string;
        targetUrl: string | null;
        paymentNotes: string | null;
        endAt: Date | null;
    }>) {
        const [existing] = await db
            .select({ type: adCampaignsTable.type })
            .from(adCampaignsTable)
            .where(eq(adCampaignsTable.id, campaignId))
            .limit(1);

        if (!existing) return null;

        // If not a house ad, only allow updating status, weight, paymentNotes, endAt
        let allowedUpdates = updates;
        if (existing.type !== AdType.HOUSE) {
            allowedUpdates = {
                status: updates.status,
                weight: updates.weight,
                paymentNotes: updates.paymentNotes,
                endAt: updates.endAt,
            };
        }

        const [updated] = await db
            .update(adCampaignsTable)
            .set({
                ...allowedUpdates,
                updatedAt: new Date(),
            })
            .where(eq(adCampaignsTable.id, campaignId))
            .returning();

        return updated;
    },

    /**
     * Get detailed analytics for a campaign within an optional date range
     */
    async getCampaignAnalytics(
        campaignId: string,
        from?: string,
        to?: string,
        creatorId?: string,
    ) {
        const conditions = [eq(adCampaignsTable.id, campaignId)];
        if (creatorId) {
            conditions.push(eq(adCampaignsTable.creatorId, creatorId));
        }

        const [campaign] = await db
            .select({
                id: adCampaignsTable.id,
                name: adCampaignsTable.name,
                type: adCampaignsTable.type,
                placement: adCampaignsTable.placement,
                status: adCampaignsTable.status,
                title: adCampaignsTable.title,
                subtitle: adCampaignsTable.subtitle,
                badgeText: adCampaignsTable.badgeText,
                ctaText: adCampaignsTable.ctaText,
                mediaUrl: adCampaignsTable.mediaUrl,
                targetModpackId: adCampaignsTable.targetModpackId,
                targetUrl: adCampaignsTable.targetUrl,
                maxImpressions: adCampaignsTable.maxImpressions,
                maxClicks: adCampaignsTable.maxClicks,
                startAt: adCampaignsTable.startAt,
                endAt: adCampaignsTable.endAt,
                createdAt: adCampaignsTable.createdAt,
                creatorId: adCampaignsTable.creatorId,
                creatorName: creatorsTable.displayName,
                modpackName: modpacksTable.name,
            })
            .from(adCampaignsTable)
            .leftJoin(creatorsTable, eq(adCampaignsTable.creatorId, creatorsTable.id))
            .leftJoin(modpacksTable, eq(adCampaignsTable.targetModpackId, modpacksTable.id))
            .where(and(...conditions))
            .limit(1);

        if (!campaign) {
            throw new Error("Campaña no encontrada o no tienes permisos para verla.");
        }

        const trackedTargetUrl = attachTrackingUtms(campaign.targetUrl, {
            name: campaign.name,
            placement: campaign.placement,
            id: campaign.id,
        });

        const today = new Date();
        const defaultFrom = new Date(today);
        defaultFrom.setDate(today.getDate() - 29); // 30 days default

        const fromDateStr = from || defaultFrom.toISOString().split("T")[0];
        const toDateStr = to || today.toISOString().split("T")[0];

        const dailyRows = await db
            .select({
                date: adAnalyticsDailyTable.date,
                impressions: adAnalyticsDailyTable.impressions,
                clicks: adAnalyticsDailyTable.clicks,
            })
            .from(adAnalyticsDailyTable)
            .where(
                and(
                    eq(adAnalyticsDailyTable.campaignId, campaignId),
                    gte(adAnalyticsDailyTable.date, fromDateStr),
                    lte(adAnalyticsDailyTable.date, toDateStr),
                ),
            )
            .orderBy(adAnalyticsDailyTable.date);

        const dailyMap = new Map(dailyRows.map((r) => [r.date, r]));

        const daily: Array<{ date: string; impressions: number; clicks: number; ctr: string }> = [];
        const start = new Date(fromDateStr + "T00:00:00Z");
        const end = new Date(toDateStr + "T00:00:00Z");

        const curr = new Date(start);
        let safetyCount = 0;
        while (curr <= end && safetyCount < 366) {
            const dateStr = curr.toISOString().split("T")[0];
            const data = dailyMap.get(dateStr);
            const imps = data?.impressions || 0;
            const clks = data?.clicks || 0;
            const ctr = imps > 0 ? ((clks / imps) * 100).toFixed(2) + "%" : "0.00%";
            daily.push({
                date: dateStr,
                impressions: imps,
                clicks: clks,
                ctr,
            });
            curr.setUTCDate(curr.getUTCDate() + 1);
            safetyCount++;
        }

        const totalImpressions = daily.reduce((sum, d) => sum + d.impressions, 0);
        const totalClicks = daily.reduce((sum, d) => sum + d.clicks, 0);
        const overallCtr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) + "%" : "0.00%";

        return {
            campaign: {
                ...campaign,
                trackedTargetUrl,
            },
            period: {
                from: fromDateStr,
                to: toDateStr,
            },
            totals: {
                impressions: totalImpressions,
                clicks: totalClicks,
                ctr: overallCtr,
            },
            daily,
        };
    },

    /**
     * Seed initial default House Ads if database has none
     */
    async seedDefaultHouseAds() {
        // Check if there is at least one hero_carousel ad, if not, insert one
        const heroExisting = await db
            .select()
            .from(adCampaignsTable)
            .where(eq(adCampaignsTable.placement, AdPlacement.HERO_CAROUSEL))
            .limit(1);

        if (heroExisting.length === 0) {
            await db.insert(adCampaignsTable).values({
                name: "House Ad - Bienvenido a Modpack Store",
                type: AdType.HOUSE,
                placement: AdPlacement.HERO_CAROUSEL,
                status: AdStatus.ACTIVE,
                title: "Descubre miles de Modpacks",
                subtitle: "Instala y juega con un solo clic. Comunidad, servidores y creadores en un mismo lugar.",
                badgeText: "Destacado",
                ctaText: "Explorar",
                mediaUrl: "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=1600&q=80",
                targetUrl: "https://modpackstore.com",
                weight: 10,
            });
            console.log("[ADS] Hero Carousel default House Ad seeded.");
        }

        const bannerExisting = await db
            .select()
            .from(adCampaignsTable)
            .where(eq(adCampaignsTable.placement, AdPlacement.EXPLORE_BANNER))
            .limit(1);

        if (bannerExisting.length === 0) {
            await db.insert(adCampaignsTable).values([
                {
                    name: "House Ad - Modpack Store Plus",
                    type: AdType.HOUSE,
                    placement: AdPlacement.EXPLORE_BANNER,
                    status: AdStatus.ACTIVE,
                    title: "Desbloquea Modpack Store+",
                    subtitle: "Instancias ilimitadas, descargas sin esperas y soporte prioritario uniéndote a nuestro Patreon.",
                    badgeText: "Modpack Store+",
                    ctaText: "Suscribirme",
                    mediaUrl: "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=1200&q=80",
                    targetUrl: "https://patreon.com/modpackstore",
                    weight: 5,
                },
                {
                    name: "House Ad - Únete a la Comunidad",
                    type: AdType.HOUSE,
                    placement: AdPlacement.EXPLORE_BANNER,
                    status: AdStatus.ACTIVE,
                    title: "Comunidad Oficial de Discord",
                    subtitle: "Encuentra amigos con quienes jugar tus modpacks favoritos y participa en eventos semanales.",
                    badgeText: "Comunidad",
                    ctaText: "Unirse a Discord",
                    mediaUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&q=80",
                    targetUrl: "https://discord.gg/modpackstore",
                    weight: 3,
                },
            ]);
            console.log("[ADS] Explore Banner default House Ads seeded.");
        }

        const sidebarExisting = await db
            .select()
            .from(adCampaignsTable)
            .where(eq(adCampaignsTable.placement, AdPlacement.MODPACK_SIDEBAR))
            .limit(1);

        if (sidebarExisting.length === 0) {
            await db.insert(adCampaignsTable).values({
                name: "House Ad - Publica tu Modpack",
                type: AdType.HOUSE,
                placement: AdPlacement.MODPACK_SIDEBAR,
                status: AdStatus.ACTIVE,
                title: "¿Eres Creador de Contenido?",
                subtitle: "Publica y gestiona tus modpacks gratis con análisis en tiempo real.",
                badgeText: "Creadores",
                ctaText: "Comenzar",
                mediaUrl: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=600&q=80",
                targetUrl: "https://modpackstore.com/creators",
                weight: 4,
            });
            console.log("[ADS] Modpack Sidebar default House Ad seeded.");
        }
    },
};
