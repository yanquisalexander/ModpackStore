import { sign, verify } from "@hono/hono/jwt";
import {
  APIError,
  DiscordAuthError,
  ValidationError,
  UnauthorizedError,
  NotFoundError,
} from "@/lib/errors/index.ts";
import { memoryStore } from "@/db/memory-store.ts";
import {
  getOAuthUrl as getDiscordOAuthUrl,
  exchangeCodeForToken,
  getDiscordUser,
} from "@/services/discord.ts";
import { userService } from "@/services/user.service.ts";

const JWT_SECRET = Deno.env.get("JWT_SECRET")!;
const ACCESS_TOKEN_EXPIRES_IN = 4 * 60 * 60; // 4 hours
const REFRESH_TOKEN_EXPIRES_IN = 15 * 24 * 60 * 60; // 15 days

export interface JwtPayload {
  sub: string;
  sessionId: string;
  iat?: number;
  exp?: number;
}

export interface AuthTokens {
  token_type: "bearer";
  expires_in: number;
  access_token: string;
  refresh_token: string;
}

export interface UserPublicProfile {
  id: string;
  username: string;
  email: string;
  avatarUrl: string | null;
  role: string;
  createdAt: Date;
  updatedAt: Date;
}

function signToken(payload: JwtPayload, expiresIn: number): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return sign(
    { ...payload, iat: now, exp: now + expiresIn },
    JWT_SECRET,
    "HS256",
  );
}

async function verifyToken(token: string): Promise<JwtPayload> {
  try {
    const payload = await verify(token, JWT_SECRET, "HS256");
    return payload as unknown as JwtPayload;
  } catch {
    throw new UnauthorizedError("Invalid or expired token", "INVALID_TOKEN");
  }
}

export const authService = {
  getOAuthUrl(): string {
    return getDiscordOAuthUrl();
  },

  async handleDiscordCallback(code: string): Promise<AuthTokens> {
    if (!code) {
      throw new ValidationError("Authorization code is required", "MISSING_CODE");
    }

    let discordToken: Awaited<ReturnType<typeof exchangeCodeForToken>>;
    let discordUser: Awaited<ReturnType<typeof getDiscordUser>>;
    try {
      discordToken = await exchangeCodeForToken(code);
      discordUser = await getDiscordUser(discordToken.access_token);
    } catch (err) {
      throw new DiscordAuthError(
        err instanceof Error ? err.message : "Discord OAuth failed",
        "DISCORD_AUTH_FAILED",
      );
    }

    const user = userService.upsertDiscordUser({
      discordId: discordUser.id,
      username: discordUser.username,
      email: discordUser.email,
      avatar: discordUser.avatar,
    });

    if (discordToken.access_token && discordToken.refresh_token) {
      userService.updateDiscordTokens(
        user.id,
        discordToken.access_token,
        discordToken.refresh_token,
      );
    }

    const session = memoryStore.createSession(user.id);

    const accessToken = await signToken(
      { sub: user.id, sessionId: session.id },
      ACCESS_TOKEN_EXPIRES_IN,
    );
    const refreshToken = await signToken(
      { sub: user.id, sessionId: session.id },
      REFRESH_TOKEN_EXPIRES_IN,
    );

    return {
      token_type: "bearer",
      expires_in: ACCESS_TOKEN_EXPIRES_IN,
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  },

  async refreshAuthTokens(refreshTokenString: string): Promise<AuthTokens> {
    if (!refreshTokenString) {
      throw new ValidationError("Refresh token is required", "MISSING_REFRESH_TOKEN");
    }

    const decoded = await verifyToken(refreshTokenString);
    const { sub: userId, sessionId } = decoded;

    const user = memoryStore.findUserById(userId);
    const session = memoryStore.findSessionById(sessionId);

    if (!user || !session || session.userId !== user.id) {
      throw new UnauthorizedError("Invalid session or user", "INVALID_SESSION");
    }

    const newAccessToken = await signToken(
      { sub: userId, sessionId },
      ACCESS_TOKEN_EXPIRES_IN,
    );
    const newRefreshToken = await signToken(
      { sub: userId, sessionId },
      REFRESH_TOKEN_EXPIRES_IN,
    );

    return {
      token_type: "bearer",
      expires_in: ACCESS_TOKEN_EXPIRES_IN,
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
    };
  },

  getAuthenticatedUserProfile(userId: string): UserPublicProfile {
    const user = memoryStore.findUserById(userId);
    if (!user) {
      throw new NotFoundError("User not found", "USER_NOT_FOUND");
    }

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      avatarUrl: user.avatarUrl,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  },

  logout(sessionId: string): void {
    memoryStore.deleteSessionById(sessionId);
  },
};
