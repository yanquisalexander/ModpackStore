import { Hono } from "@hono/hono";
import type { Context } from "@hono/hono";
import { authService } from "@/auth/service.ts";
import { requireAuth, type AuthVariables } from "@/auth/middleware.ts";
import {
    getOAuthUrl,
    linkTwitchToUser,
    unlinkTwitchFromUser,
    getTwitchLinkStatus,
} from "@/services/twitch.service.ts";
import { ForbiddenError, NotFoundError } from "@/lib/errors/index.ts";
import { log } from "@/lib/logger.ts";
import { getUserFlags } from "@/services/userFlags.service.ts";
import { db } from "@/db/client.ts";
import { users } from "@/db/schema.ts";
import { eq } from "drizzle-orm";

const authRoutes = new Hono();

authRoutes.get("/discord/url", (c) => {
  const url = authService.getOAuthUrl();
  return c.json({ url });
});

authRoutes.get("/discord/callback", async (c) => {
  const code = c.req.query("code");
  const redirect_uri = c.req.query("redirect_uri");
  const tokens = await authService.handleDiscordCallback(code ?? "", redirect_uri);
  return c.json(tokens);
});

authRoutes.post("/refresh", async (c) => {
  const { refresh_token } = await c.req.json();
  const tokens = await authService.refreshAuthTokens(refresh_token);
  return c.json(tokens);
});

authRoutes.get(
  "/me",
  requireAuth,
  async (c: Context<{ Variables: AuthVariables }>) => {
    const user = c.get("user");
    const profile = await authService.getAuthenticatedUserProfile(user.id);
    return c.json(profile);
  },
);

authRoutes.post(
  "/logout",
  requireAuth,
  async (c: Context<{ Variables: AuthVariables }>) => {
    const jwtPayload = c.get("jwtPayload");
    await authService.logout(jwtPayload.sessionId);
    return c.body(null, 204);
  },
);

// ── Twitch ──────────────────────────────────────────

authRoutes.get(
    "/twitch/url",
    requireAuth,
    async (c: Context<{ Variables: AuthVariables }>) => {
        const url = getOAuthUrl();
        return c.json({ url });
    },
);

authRoutes.post(
    "/twitch/link",
    requireAuth,
    async (c: Context<{ Variables: AuthVariables }>) => {
        const userId = c.get("userId");
        const { code } = await c.req.json();

        if (!code) {
            return c.json({ errors: [{ status: "400", title: "Bad Request", detail: "Authorization code is required." }] }, 400);
        }

        try {
            await linkTwitchToUser(userId, code);
            return c.json({ status: "linked" }, 200);
        } catch (error) {
            if (error instanceof ForbiddenError) {
                return c.json({ errors: [{ status: "403", title: "Forbidden", detail: error.message }] }, 403);
            }
            log("[AUTH] Twitch link error:", error);
            return c.json({ errors: [{ status: "500", title: "Internal Server Error", detail: "Failed to link Twitch account." }] }, 500);
        }
    },
);

authRoutes.post(
    "/twitch/unlink",
    requireAuth,
    async (c: Context<{ Variables: AuthVariables }>) => {
        const userId = c.get("userId");

        try {
            await unlinkTwitchFromUser(userId);
            return c.json({ status: "unlinked" }, 200);
        } catch (error) {
            log("[AUTH] Twitch unlink error:", error);
            return c.json({ errors: [{ status: "500", title: "Internal Server Error", detail: "Failed to unlink Twitch account." }] }, 500);
        }
    },
);

authRoutes.get(
    "/twitch/status",
    requireAuth,
    async (c: Context<{ Variables: AuthVariables }>) => {
        const userId = c.get("userId");

        try {
            const status = await getTwitchLinkStatus(userId);
            return c.json({ data: status }, 200);
        } catch (error) {
            log("[AUTH] Twitch status error:", error);
            return c.json({ errors: [{ status: "500", title: "Internal Server Error", detail: "Failed to get Twitch status." }] }, 500);
        }
    },
);

// ── Modpack Store+ / User Flags ─────────────────────────

authRoutes.get(
    "/flags",
    requireAuth,
    async (c: Context<{ Variables: AuthVariables }>) => {
        const userId = c.get("userId");
        const flags = await getUserFlags(userId);
        return c.json({ data: flags }, 200);
    },
);

// ── Terms and Conditions ───────────────────────────────

authRoutes.post(
    "/accept-tos",
    requireAuth,
    async (c: Context<{ Variables: AuthVariables }>) => {
        const userId = c.get("userId");
        const now = new Date();

        await db.update(users).set({ tosAcceptedAt: now }).where(eq(users.id, userId));

        return c.json({
            data: {
                tosAcceptedAt: now.toISOString(),
            },
        });
    },
);

export default authRoutes;

