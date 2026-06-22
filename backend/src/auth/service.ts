import { sign, verify } from "@hono/hono/jwt";
import {
    APIError,
    DiscordAuthError,
    ValidationError,
    UnauthorizedError,
    NotFoundError,
} from "@/lib/errors/index.ts";
import { db } from "@/db/client.ts";
import { users, sessions, bansTable, creatorUsersTable, creatorsTable } from "@/db/schema.ts";
import { eq, and } from "drizzle-orm";
import {
    getOAuthUrl as getDiscordOAuthUrl,
    exchangeCodeForToken,
    getDiscordUser,
} from "@/services/discord.ts";
import { userService } from "@/services/user.service.ts";
import { sessionKV } from "@/auth/kv-session.ts";

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

interface CreatorMembership {
    creatorId: string;
    role: string;
    displayName: string;
    slug: string;
    status: string;
}

export interface UserPublicProfile {
    id: string;
    username: string;
    email: string;
    avatarUrl: string | null;
    role: string;
    isBanned: boolean;
    createdAt: Date;
    updatedAt: Date;
    creatorMemberships: CreatorMembership[];
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

    async handleDiscordCallback(code: string, redirectUri?: string): Promise<AuthTokens> {
        if (!code) {
            throw new ValidationError("Authorization code is required", "MISSING_CODE");
        }

        let discordToken: Awaited<ReturnType<typeof exchangeCodeForToken>>;
        let discordUser: Awaited<ReturnType<typeof getDiscordUser>>;
        try {
            discordToken = await exchangeCodeForToken(code, redirectUri);
            discordUser = await getDiscordUser(discordToken.access_token);
        } catch (err) {
            throw new DiscordAuthError(
                err instanceof Error ? err.message : "Discord OAuth failed",
                "DISCORD_AUTH_FAILED",
            );
        }

        const user = await userService.upsertDiscordUser({
            discordId: discordUser.id,
            username: discordUser.username,
            email: discordUser.email,
            avatar: discordUser.avatar,
        });

        if (discordToken.access_token && discordToken.refresh_token) {
            await userService.updateDiscordTokens(
                user.id,
                discordToken.access_token,
                discordToken.refresh_token,
            );
        }

        const [session] = await db.insert(sessions)
            .values({ userId: user.id })
            .returning();

        // Dual-write: save session to KV for fast reads
        await sessionKV.set(session.id, user.id);

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

        // KV-first session check
        const sessionCache = await sessionKV.get(sessionId);
        if (!sessionCache || sessionCache.userId !== userId) {
            // KV miss or mismatch: fallback to PostgreSQL
            const [session] = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1);
            if (!session || session.userId !== userId) {
                throw new UnauthorizedError("Invalid session or user", "INVALID_SESSION");
            }
            // Repopulate KV
            await sessionKV.set(sessionId, userId);
        }

        // Single query: just fetch user (session already validated via KV or PG fallback)
        const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
        if (!user) {
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

    async getAuthenticatedUserProfile(userId: string): Promise<UserPublicProfile> {
        const [user] = await db.select()
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);
        if (!user) {
            throw new NotFoundError("User not found", "USER_NOT_FOUND");
        }

        const [activeBan] = await db.select()
            .from(bansTable)
            .where(and(eq(bansTable.userId, userId), eq(bansTable.isActive, true)))
            .limit(1);

        const memberships = await db.select({
            creatorId: creatorUsersTable.creatorId,
            role: creatorUsersTable.role,
            displayName: creatorsTable.displayName,
            slug: creatorsTable.slug,
            status: creatorsTable.status,
        })
            .from(creatorUsersTable)
            .innerJoin(creatorsTable, eq(creatorUsersTable.creatorId, creatorsTable.id))
            .where(eq(creatorUsersTable.userId, userId));

        return {
            id: user.id,
            username: user.username,
            email: user.email,
            avatarUrl: user.avatarUrl,
            role: user.role,
            isBanned: !!activeBan,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
            creatorMemberships: memberships,
        };
    },

    async logout(sessionId: string): Promise<void> {
        await db.delete(sessions).where(eq(sessions.id, sessionId));
        await sessionKV.delete(sessionId);
    },
};
