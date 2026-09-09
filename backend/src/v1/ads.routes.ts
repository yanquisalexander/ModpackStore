import { Hono } from "@hono/hono";
import { adsService } from "@/services/ads.service.ts";
import { optionalAuth, type AuthVariables } from "@/auth/middleware.ts";
import type { Context } from "@hono/hono";

const adsRoutes = new Hono();

/**
 * Serve an ad for a given placement.
 * Query params:
 *   - placement: string (required) e.g. 'explore_banner', 'hero_carousel', 'modpack_sidebar'
 */
adsRoutes.get("/serve", optionalAuth, async (c: Context<{ Variables: AuthVariables }>) => {
    const placement = c.req.query("placement");
    if (!placement) {
        return c.json({ error: "Placement is required" }, 400);
    }

    const userId = c.get("userId");
    const ad = await adsService.serveAd(placement, userId);

    return c.json({ data: ad });
});

/**
 * Track an ad impression
 */
adsRoutes.post("/track/impression", async (c) => {
    try {
        const body = await c.req.json();
        const { campaignId, deviceId } = body;

        if (!campaignId) {
            return c.json({ error: "campaignId is required" }, 400);
        }

        const tracked = await adsService.trackImpression(campaignId, deviceId || "anonymous");
        return c.json({ success: true, tracked });
    } catch (err) {
        console.error("[ADS] Error tracking impression:", err);
        return c.json({ success: false }, 500);
    }
});

/**
 * Track an ad click
 */
adsRoutes.post("/track/click", async (c) => {
    try {
        const body = await c.req.json();
        const { campaignId, deviceId } = body;

        if (!campaignId) {
            return c.json({ error: "campaignId is required" }, 400);
        }

        const tracked = await adsService.trackClick(campaignId, deviceId || "anonymous");
        return c.json({ success: true, tracked });
    } catch (err) {
        console.error("[ADS] Error tracking click:", err);
        return c.json({ success: false }, 500);
    }
});

export default adsRoutes;
