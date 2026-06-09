import { Hono } from "@hono/hono";
import type { Context } from "@hono/hono";
import { authService } from "@/auth/service.ts";
import { requireAuth, type AuthVariables } from "@/auth/middleware.ts";

const authRoutes = new Hono();

authRoutes.get("/discord/url", (c) => {
  const url = authService.getOAuthUrl();
  return c.json({ url });
});

authRoutes.get("/discord/callback", async (c) => {
  const code = c.req.query("code");
  const tokens = await authService.handleDiscordCallback(code ?? "");
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
  (c: Context<{ Variables: AuthVariables }>) => {
    const user = c.get("user");
    const profile = authService.getAuthenticatedUserProfile(user.id);
    return c.json(profile);
  },
);

authRoutes.post(
  "/logout",
  requireAuth,
  (c: Context<{ Variables: AuthVariables }>) => {
    const jwtPayload = c.get("jwtPayload");
    authService.logout(jwtPayload.sessionId);
    return c.body(null, 204);
  },
);

export default authRoutes;
