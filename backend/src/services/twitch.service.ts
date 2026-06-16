import { db } from "@/db/client.ts";
import { users } from "@/db/schema.ts";
import { eq } from "drizzle-orm";
import { ForbiddenError, NotFoundError } from "@/lib/errors/index.ts";
import { log } from "@/lib/logger.ts";

const CLIENT_ID = Deno.env.get("TWITCH_CLIENT_ID")!;
const CLIENT_SECRET = Deno.env.get("TWITCH_CLIENT_SECRET")!;
const REDIRECT_URI = Deno.env.get("TWITCH_REDIRECT_URI") || "http://localhost:1958/callback";
const SCOPES = ["user:read:subscriptions"];

export function getOAuthUrl(state?: string): string {
    const params = new URLSearchParams({
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        response_type: "code",
        scope: SCOPES.join(" "),
        force_verify: "true",
    });

    if (state) params.set("state", state);

    return `https://id.twitch.tv/oauth2/authorize?${params.toString()}`;
}

export async function exchangeCodeForToken(code: string) {
    const res = await fetch("https://id.twitch.tv/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            code,
            grant_type: "authorization_code",
            redirect_uri: REDIRECT_URI,
        }),
    });

    if (!res.ok) {
        const err = await res.text();
        log("[TWITCH] Token exchange failed:", err);
        throw new ForbiddenError("Failed to exchange Twitch code", "TWITCH_AUTH_FAILED");
    }

    const data = await res.json() as {
        access_token: string;
        refresh_token: string;
        expires_in: number;
    };

    // Get Twitch user info
    const userRes = await fetch("https://api.twitch.tv/helix/users", {
        headers: {
            Authorization: `Bearer ${data.access_token}`,
            "Client-Id": CLIENT_ID,
        },
    });

    if (!userRes.ok) {
        throw new ForbiddenError("Failed to get Twitch user", "TWITCH_USER_FAILED");
    }

    const userData = await userRes.json() as {
        data: Array<{
            id: string;
            login: string;
            display_name: string;
            profile_image_url: string;
        }>;
    };

    const twitchUser = userData.data?.[0];
    if (!twitchUser) {
        throw new NotFoundError("Twitch user not found", "TWITCH_USER_NOT_FOUND");
    }

    return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        twitchId: twitchUser.id,
        twitchUsername: twitchUser.login,
        twitchDisplayName: twitchUser.display_name,
        twitchAvatarUrl: twitchUser.profile_image_url,
    };
}

export async function linkTwitchToUser(userId: string, code: string) {
    const tokens = await exchangeCodeForToken(code);

    // Check if Twitch ID already linked to another user
    const [existingUser] = await db.select()
        .from(users)
        .where(eq(users.twitchId, tokens.twitchId))
        .limit(1);

    if (existingUser && existingUser.id !== userId) {
        throw new ForbiddenError("This Twitch account is already linked to another user", "TWITCH_ALREADY_LINKED");
    }

    await db.update(users)
        .set({
            twitchId: tokens.twitchId,
            twitchAccessToken: tokens.accessToken,
            twitchRefreshToken: tokens.refreshToken,
            twitchDisplayName: tokens.twitchDisplayName,
            twitchAvatarUrl: tokens.twitchAvatarUrl,
        })
        .where(eq(users.id, userId));

    log(`[TWITCH] User ${userId} linked to Twitch: ${tokens.twitchDisplayName} (${tokens.twitchId})`);
}

export async function unlinkTwitchFromUser(userId: string) {
    await db.update(users)
        .set({
            twitchId: null,
            twitchAccessToken: null,
            twitchRefreshToken: null,
            twitchDisplayName: null,
            twitchAvatarUrl: null,
        })
        .where(eq(users.id, userId));

    log(`[TWITCH] User ${userId} unlinked from Twitch`);
}

export async function getTwitchLinkStatus(userId: string) {
    const [user] = await db.select({
        twitchId: users.twitchId,
        twitchDisplayName: users.twitchDisplayName,
        twitchAvatarUrl: users.twitchAvatarUrl,
    })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

    return {
        linked: !!user?.twitchId,
        twitchDisplayName: user?.twitchDisplayName ?? null,
        twitchAvatarUrl: user?.twitchAvatarUrl ?? null,
    };
}
