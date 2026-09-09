import { Hono } from "@hono/hono";
import type { Context } from "@hono/hono";
import { requireAuth, type AuthVariables } from "@/auth/middleware.ts";
import { requireCreatorAccess, requireCreatorRole } from "@/middlewares/creator.middleware.ts";
import { adsService } from "@/services/ads.service.ts";
import { AdPlacement, AdStatus, AdType, CreatorRole } from "@/db/schema.ts";

const creatorAdsRoutes = new Hono<{ Variables: AuthVariables }>();

/**
 * List campaigns belonging to this creator
 */
creatorAdsRoutes.get(
    "/",
    requireAuth,
    requireCreatorAccess,
    async (c: Context<{ Variables: AuthVariables }>) => {
        const creatorId = c.req.param("creatorId")!;
        const campaigns = await adsService.getCreatorCampaigns(creatorId);
        return c.json({ data: campaigns });
    },
);

/**
 * Get detailed analytics for a creator's campaign
 */
creatorAdsRoutes.get(
    "/:id/analytics",
    requireAuth,
    requireCreatorAccess,
    async (c: Context<{ Variables: AuthVariables }>) => {
        try {
            const creatorId = c.req.param("creatorId")!;
            const id = c.req.param("id")!;
            const from = c.req.query("from");
            const to = c.req.query("to");
            const analytics = await adsService.getCampaignAnalytics(id, from, to, creatorId);
            return c.json({ data: analytics });
        } catch (err: any) {
            return c.json({ error: err.message || "Failed to get campaign analytics" }, 400);
        }
    },
);

/**
 * Request a new sponsored campaign (created in pending_approval status)
 */
creatorAdsRoutes.post(
    "/",
    requireAuth,
    requireCreatorRole(CreatorRole.OWNER, CreatorRole.ADMIN),
    async (c: Context<{ Variables: AuthVariables }>) => {
        try {
            const creatorId = c.req.param("creatorId")!;
            const userId = c.get("userId");
            const body = await c.req.json();

            if (!body.title || !body.mediaUrl || !body.placement) {
                return c.json({ error: "title, mediaUrl y placement son requeridos" }, 400);
            }

            const campaign = await adsService.createCampaign({
                name: body.name || `Campaña: ${body.title}`,
                type: body.type || AdType.CREATOR_MODPACK,
                placement: body.placement as AdPlacement,
                status: AdStatus.PENDING_APPROVAL, // Manual approval required
                title: body.title,
                subtitle: body.subtitle || null,
                badgeText: body.badgeText || "Destacado",
                ctaText: body.ctaText || "Ver Modpack",
                mediaUrl: body.mediaUrl,
                weight: body.weight ? Number(body.weight) : 1,
                targetModpackId: body.targetModpackId || null,
                targetUrl: body.targetUrl || null,
                paymentMethod: "paypal",
                paymentNotes: body.paymentNotes || "Solicitud de creador enviada para revisión",
                creatorId,
                createdBy: userId,
                startAt: body.startAt ? new Date(body.startAt) : new Date(),
                endAt: body.endAt ? new Date(body.endAt) : null,
            });

            return c.json({
                data: campaign,
                message: "Solicitud de campaña enviada con éxito. Será revisada por el equipo de administración.",
            }, 201);
        } catch (err: any) {
            console.error("[CREATOR_ADS] Error requesting campaign:", err);
            return c.json({ error: err.message || "Failed to create campaign request" }, 400);
        }
    },
);

export default creatorAdsRoutes;
