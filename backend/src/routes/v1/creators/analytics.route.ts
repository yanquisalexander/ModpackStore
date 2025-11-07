import { Hono } from "hono";
import { AuthVariables, requireAuth, requireCreatorAccess, isOrganizationMember, USER_CONTEXT_KEY } from "@/middlewares/auth.middleware";
import { AnalyticsService } from "@/services/analytics.service";
import { APIError } from "@/lib/APIError";
import { Modpack } from "@/entities/Modpack";
import { ModpackVersion } from "@/entities/ModpackVersion";
import { ModpackDownload } from "@/entities/ModpackDownload";
import { ModpackAcquisition } from "@/entities/ModpackAcquisition";
import { User } from "@/entities/User";
import { Context } from "hono";

export const AnalyticsRoute = new Hono();

// All analytics routes require authentication and creator access
AnalyticsRoute.use(requireAuth, requireCreatorAccess);

const analyticsService = new AnalyticsService();

/**
 * GET /creators/publishers/:publisherId/analytics/overview
 * Get global analytics overview for all modpacks in a publisher
 */
AnalyticsRoute.get(
    "/publishers/:publisherId/analytics/overview",
    isOrganizationMember,
    async (c: Context<{ Variables: AuthVariables }>) => {
        const { publisherId } = c.req.param();

        try {
            const overview = await analyticsService.getPublisherOverview(publisherId);
            return c.json({ success: true, data: overview });
        } catch (error) {
            console.error("Error fetching publisher overview:", error);
            throw new APIError(500, "Failed to fetch analytics overview");
        }
    }
);

/**
 * GET /creators/publishers/:publisherId/analytics/modpacks/:modpackId
 * Get detailed analytics for a specific modpack
 */
AnalyticsRoute.get(
    "/publishers/:publisherId/analytics/modpacks/:modpackId",
    isOrganizationMember,
    async (c: Context<{ Variables: AuthVariables }>) => {
        const { publisherId, modpackId } = c.req.param();

        // Verify modpack belongs to publisher
        const modpack = await Modpack.findOne({
            where: { id: modpackId, publisherId }
        });

        if (!modpack) {
            throw new APIError(404, "Modpack not found");
        }

        try {
            const analytics = await analyticsService.getModpackAnalytics(modpackId);
            return c.json({ success: true, data: analytics });
        } catch (error) {
            console.error("Error fetching modpack analytics:", error);
            throw new APIError(500, "Failed to fetch modpack analytics");
        }
    }
);

/**
 * GET /creators/publishers/:publisherId/analytics/modpacks/:modpackId/versions/:versionId
 * Get analytics for a specific version
 */
AnalyticsRoute.get(
    "/publishers/:publisherId/analytics/modpacks/:modpackId/versions/:versionId",
    isOrganizationMember,
    async (c: Context<{ Variables: AuthVariables }>) => {
        const { publisherId, modpackId, versionId } = c.req.param();

        // Verify modpack belongs to publisher and version belongs to modpack
        const modpack = await Modpack.findOne({
            where: { id: modpackId, publisherId }
        });

        if (!modpack) {
            throw new APIError(404, "Modpack not found");
        }

        const version = await ModpackVersion.findOne({
            where: { id: versionId, modpackId }
        });

        if (!version) {
            throw new APIError(404, "Version not found");
        }

        try {
            const analytics = await analyticsService.getVersionAnalytics(versionId);
            return c.json({ success: true, data: analytics });
        } catch (error) {
            console.error("Error fetching version analytics:", error);
            throw new APIError(500, "Failed to fetch version analytics");
        }
    }
);

/**
 * GET /creators/publishers/:publisherId/analytics/modpacks/:modpackId/downloads-timeline
 * Get downloads timeline for a modpack
 * Query params: startDate (ISO date), endDate (ISO date)
 */
AnalyticsRoute.get(
    "/publishers/:publisherId/analytics/modpacks/:modpackId/downloads-timeline",
    isOrganizationMember,
    async (c: Context<{ Variables: AuthVariables }>) => {
        const { publisherId, modpackId } = c.req.param();
        const startDateParam = c.req.query("startDate");
        const endDateParam = c.req.query("endDate");

        // Verify modpack belongs to publisher
        const modpack = await Modpack.findOne({
            where: { id: modpackId, publisherId }
        });

        if (!modpack) {
            throw new APIError(404, "Modpack not found");
        }

        let startDate: Date | undefined;
        let endDate: Date | undefined;

        if (startDateParam) {
            startDate = new Date(startDateParam);
            if (isNaN(startDate.getTime())) {
                throw new APIError(400, "Invalid startDate format");
            }
        }

        if (endDateParam) {
            endDate = new Date(endDateParam);
            if (isNaN(endDate.getTime())) {
                throw new APIError(400, "Invalid endDate format");
            }
        }

        try {
            const timeline = await analyticsService.getDownloadsTimeline(modpackId, startDate, endDate);
            return c.json({ success: true, data: timeline });
        } catch (error) {
            console.error("Error fetching downloads timeline:", error);
            throw new APIError(500, "Failed to fetch downloads timeline");
        }
    }
);

/**
 * GET /creators/publishers/:publisherId/analytics/modpacks/:modpackId/votes-timeline
 * Get votes evolution timeline for a modpack
 * Query params: startDate (ISO date), endDate (ISO date), cumulative (boolean)
 */
AnalyticsRoute.get(
    "/publishers/:publisherId/analytics/modpacks/:modpackId/votes-timeline",
    isOrganizationMember,
    async (c: Context<{ Variables: AuthVariables }>) => {
        const { publisherId, modpackId } = c.req.param();
        const startDateParam = c.req.query("startDate");
        const endDateParam = c.req.query("endDate");
        const cumulativeParam = c.req.query("cumulative");

        // Verify modpack belongs to publisher
        const modpack = await Modpack.findOne({
            where: { id: modpackId, publisherId }
        });

        if (!modpack) {
            throw new APIError(404, "Modpack not found");
        }

        let startDate: Date | undefined;
        let endDate: Date | undefined;

        if (startDateParam) {
            startDate = new Date(startDateParam);
            if (isNaN(startDate.getTime())) {
                throw new APIError(400, "Invalid startDate format");
            }
        }

        if (endDateParam) {
            endDate = new Date(endDateParam);
            if (isNaN(endDate.getTime())) {
                throw new APIError(400, "Invalid endDate format");
            }
        }

        const cumulative = cumulativeParam === "true";

        try {
            const timeline = cumulative
                ? await analyticsService.getCumulativeVotesTimeline(modpackId, startDate, endDate)
                : await analyticsService.getVotesTimeline(modpackId, startDate, endDate);

            return c.json({ success: true, data: timeline });
        } catch (error) {
            console.error("Error fetching votes timeline:", error);
            throw new APIError(500, "Failed to fetch votes timeline");
        }
    }
);

/**
 * POST /creators/track/install/:modpackId/:versionId
 * Track a modpack installation
 * This endpoint is called by the client when a user installs a modpack
 * Only users with active acquisition/access can track installations
 */
AnalyticsRoute.post(
    "/track/install/:modpackId/:versionId",
    requireAuth,
    async (c: Context<{ Variables: AuthVariables }>) => {
        const { modpackId, versionId } = c.req.param();
        const user = c.get(USER_CONTEXT_KEY) as User;

        // Verify modpack and version exist
        const modpack = await Modpack.findOne({
            where: { id: modpackId }
        });

        if (!modpack) {
            throw new APIError(404, "Modpack not found");
        }

        const version = await ModpackVersion.findOne({
            where: { id: versionId, modpackId }
        });

        if (!version) {
            throw new APIError(404, "Version not found");
        }

        // Verify user has access to the modpack
        // Check if user has an active acquisition for this modpack
        const acquisition = await ModpackAcquisition.findActiveUserAcquisition(user.id, modpackId);
        
        // For free modpacks without password, allow tracking without acquisition
        const isFreeModpack = modpack.acquisitionMethod === 'free' && !modpack.password;
        
        if (!isFreeModpack && !acquisition) {
            throw new APIError(403, "User does not have access to this modpack");
        }

        try {
            // Extract client info from request
            const clientIp = c.req.header("x-forwarded-for") || c.req.header("x-real-ip") || undefined;
            const userAgent = c.req.header("user-agent") || undefined;

            // Track the download
            const download = await ModpackDownload.trackDownload(
                user.id,
                modpackId,
                versionId,
                clientIp,
                userAgent
            );

            return c.json({
                success: true,
                message: "Installation tracked successfully",
                downloadId: download.id
            });
        } catch (error) {
            console.error("Error tracking download:", error);
            throw new APIError(500, "Failed to track installation");
        }
    }
);
