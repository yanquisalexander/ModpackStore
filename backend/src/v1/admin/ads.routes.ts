import { Hono } from "@hono/hono";
import type { Context } from "@hono/hono";
import { requireAuth, requireAdmin } from "@/auth/middleware.ts";
import { adsService } from "@/services/ads.service.ts";
import { AdStatus } from "@/db/schema.ts";

const adminAdsRoutes = new Hono();

// All admin routes require authentication and admin role
adminAdsRoutes.use("*", requireAuth, requireAdmin);

/**
 * List all campaigns with metrics
 */
adminAdsRoutes.get("/", async (c: Context) => {
    const campaigns = await adsService.getAllCampaigns();
    return c.json({ data: campaigns });
});

/**
 * Create a new campaign
 */
adminAdsRoutes.post("/", async (c: Context) => {
    try {
        const body = await c.req.json();
        const userId = c.get("userId");

        const campaign = await adsService.createCampaign({
            ...body,
            createdBy: userId,
            startAt: body.startAt ? new Date(body.startAt) : new Date(),
            endAt: body.endAt ? new Date(body.endAt) : null,
        });

        return c.json({ data: campaign }, 201);
    } catch (err: any) {
        console.error("[ADMIN_ADS] Error creating campaign:", err);
        return c.json({ error: err.message || "Failed to create campaign" }, 400);
    }
});

/**
 * Update an existing campaign
 */
adminAdsRoutes.patch("/:id", async (c: Context) => {
    try {
        const id = c.req.param("id")!;
        const body = await c.req.json();

        const updated = await adsService.updateCampaign(id, {
            ...body,
            endAt: body.endAt ? new Date(body.endAt) : undefined,
        });

        return c.json({ data: updated });
    } catch (err: any) {
        console.error("[ADMIN_ADS] Error updating campaign:", err);
        return c.json({ error: err.message || "Failed to update campaign" }, 400);
    }
});

/**
 * Get detailed campaign analytics
 */
adminAdsRoutes.get("/:id/analytics", async (c: Context) => {
    try {
        const id = c.req.param("id")!;
        const from = c.req.query("from");
        const to = c.req.query("to");
        const analytics = await adsService.getCampaignAnalytics(id, from, to);
        return c.json({ data: analytics });
    } catch (err: any) {
        return c.json({ error: err.message || "Failed to get analytics" }, 400);
    }
});

/**
 * Approve a pending creator campaign
 */
adminAdsRoutes.post("/:id/approve", async (c: Context) => {
    try {
        const id = c.req.param("id")!;
        const body = await c.req.json().catch(() => ({}));

        const updated = await adsService.updateCampaign(id, {
            status: AdStatus.ACTIVE,
            paymentNotes: body.paymentNotes || undefined,
        });

        return c.json({ data: updated, message: "Campaña aprobada y activada" });
    } catch (err: any) {
        return c.json({ error: err.message || "Failed to approve campaign" }, 400);
    }
});

/**
 * Reject a pending creator campaign
 */
adminAdsRoutes.post("/:id/reject", async (c: Context) => {
    try {
        const id = c.req.param("id")!;
        const body = await c.req.json().catch(() => ({}));

        const updated = await adsService.updateCampaign(id, {
            status: AdStatus.REJECTED,
            paymentNotes: body.reason || "Rechazada por el administrador",
        });

        return c.json({ data: updated, message: "Campaña rechazada" });
    } catch (err: any) {
        return c.json({ error: err.message || "Failed to reject campaign" }, 400);
    }
});

export default adminAdsRoutes;
