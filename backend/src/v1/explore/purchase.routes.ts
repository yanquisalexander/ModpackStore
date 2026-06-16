import { Hono } from "@hono/hono";
import type { Context } from "@hono/hono";
import { requireAuth, optionalAuth, type AuthVariables } from "@/auth/middleware.ts";
import { db } from "@/db/client.ts";
import { AcquisitionMethod, modpacksTable } from "@/db/schema.ts";
import { eq } from "drizzle-orm";
import {
    acquireFree,
    acquirePassword,
    acquireTwitch,
    getUserAcquisitions,
    getModpackAccessInfo,
} from "@/services/acquisition.service.ts";
import { NotFoundError, ForbiddenError, ValidationError } from "@/lib/errors/index.ts";
import { log } from "@/lib/logger.ts";

const app = new Hono<{ Variables: AuthVariables }>();

// ── Get modpack access info ─────────────────────────

app.get("/modpacks/:modpackId/access", optionalAuth, async (c) => {
    const modpackId = c.req.param("modpackId")!;

    try {
        const info = await getModpackAccessInfo(modpackId);
        return c.json({ data: info }, 200);
    } catch (error) {
        if (error instanceof NotFoundError) {
            return c.json({ errors: [{ status: "404", title: "Not Found", detail: error.message }] }, 404);
        }
        log("[PURCHASE] Error in getAccessInfo:", error);
        return c.json({ errors: [{ status: "500", title: "Internal Server Error", detail: "Failed to get access info." }] }, 500);
    }
});

// ── Acquire free modpack ────────────────────────────

app.post("/modpacks/:modpackId/acquire/free", requireAuth, async (c) => {
    const userId = c.get("userId");
    const modpackId = c.req.param("modpackId")!;

    try {
        const acquisition = await acquireFree(userId, modpackId);
        return c.json({ data: acquisition }, 201);
    } catch (error) {
        if (error instanceof NotFoundError) {
            return c.json({ errors: [{ status: "404", title: "Not Found", detail: error.message }] }, 404);
        }
        if (error instanceof ValidationError) {
            return c.json({ errors: [{ status: "400", title: "Bad Request", detail: error.message }] }, 400);
        }
        log("[PURCHASE] Error in acquireFree:", error);
        return c.json({ errors: [{ status: "500", title: "Internal Server Error", detail: "Failed to acquire modpack." }] }, 500);
    }
});

// ── Acquire with password ───────────────────────────

app.post("/modpacks/:modpackId/acquire/password", requireAuth, async (c) => {
    const userId = c.get("userId");
    const modpackId = c.req.param("modpackId")!;
    const { password } = await c.req.json().catch(() => ({}));

    if (!password) {
        return c.json({ errors: [{ status: "400", title: "Bad Request", detail: "Password is required." }] }, 400);
    }

    try {
        const acquisition = await acquirePassword(userId, modpackId, password);
        return c.json({ data: acquisition }, 201);
    } catch (error) {
        if (error instanceof NotFoundError) {
            return c.json({ errors: [{ status: "404", title: "Not Found", detail: error.message }] }, 404);
        }
        if (error instanceof ValidationError) {
            return c.json({ errors: [{ status: "400", title: "Bad Request", detail: error.message }] }, 400);
        }
        if (error instanceof ForbiddenError) {
            return c.json({ errors: [{ status: "403", title: "Forbidden", detail: error.message }] }, 403);
        }
        log("[PURCHASE] Error in acquirePassword:", error);
        return c.json({ errors: [{ status: "500", title: "Internal Server Error", detail: "Failed to acquire modpack." }] }, 500);
    }
});

// ── Acquire with Twitch subscription ────────────────

app.post("/modpacks/:modpackId/acquire/twitch", requireAuth, async (c) => {
    const userId = c.get("userId");
    const modpackId = c.req.param("modpackId")!;

    try {
        const acquisition = await acquireTwitch(userId, modpackId);
        return c.json({ data: acquisition }, 201);
    } catch (error) {
        if (error instanceof NotFoundError) {
            return c.json({ errors: [{ status: "404", title: "Not Found", detail: error.message }] }, 404);
        }
        if (error instanceof ValidationError) {
            return c.json({ errors: [{ status: "400", title: "Bad Request", detail: error.message }] }, 400);
        }
        if (error instanceof ForbiddenError) {
            return c.json({ errors: [{ status: "403", title: "Forbidden", detail: error.message }] }, 403);
        }
        log("[PURCHASE] Error in acquireTwitch:", error);
        return c.json({ errors: [{ status: "500", title: "Internal Server Error", detail: "Failed to acquire modpack." }] }, 500);
    }
});

// ── List user acquisitions (library) ────────────────

app.get("/user/acquisitions", requireAuth, async (c) => {
    const userId = c.get("userId");

    try {
        const acquisitions = await getUserAcquisitions(userId);
        return c.json({ data: acquisitions }, 200);
    } catch (error) {
        log("[PURCHASE] Error in getUserAcquisitions:", error);
        return c.json({ errors: [{ status: "500", title: "Internal Server Error", detail: "Failed to list acquisitions." }] }, 500);
    }
});

export default app;
