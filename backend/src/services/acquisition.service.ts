import { db } from "@/db/client.ts";
import {
    modpackAcquisitionsTable,
    modpacksTable,
    creatorsTable,
    users,
    AcquisitionMethod,
    AcquisitionStatus,
    ModpackVisibility,
} from "@/db/schema.ts";
import { eq, and, ne } from "drizzle-orm";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors/index.ts";
import { log } from "@/lib/logger.ts";
import * as bcrypt from "npm:bcryptjs";
import { hasAccess as checkWhitelistAccess } from "@/services/whitelist.service.ts";

export async function checkAccess(
    userId: string,
    modpackId: string,
): Promise<{ hasAccess: boolean; acquisition?: typeof modpackAcquisitionsTable.$inferSelect; reason?: string }> {
    // Parallel queries: modpack visibility + acquisition status (independent of each other)
    const [modpackResult, acquisitionResult] = await Promise.all([
        db.select({
            visibility: modpacksTable.visibility,
            acquisitionMethod: modpacksTable.acquisitionMethod,
            twitchCreatorIds: modpacksTable.twitchCreatorIds,
        })
            .from(modpacksTable)
            .where(eq(modpacksTable.id, modpackId))
            .limit(1),
        db.select()
            .from(modpackAcquisitionsTable)
            .where(and(
                eq(modpackAcquisitionsTable.userId, userId),
                eq(modpackAcquisitionsTable.modpackId, modpackId),
                eq(modpackAcquisitionsTable.status, AcquisitionStatus.ACTIVE),
            ))
            .limit(1),
    ]);

    const modpack = modpackResult[0];
    const acquisition = acquisitionResult[0];

    if (!modpack) return { hasAccess: false, reason: "Modpack not found" };

    if (modpack.visibility === ModpackVisibility.WHITELIST) {
        const whitelisted = await checkWhitelistAccess(modpackId, userId);
        if (!whitelisted) return { hasAccess: false, reason: "Not whitelisted" };
        return { hasAccess: true };
    }

    if (!acquisition) {
        return { hasAccess: false, reason: "No acquisition found" };
    }

    if (acquisition.method === AcquisitionMethod.TWITCH_SUB) {
        // Parallel queries for Twitch sub check (independent of each other)
        const [userResult] = await db.select({
            twitchId: users.twitchId,
            twitchAccessToken: users.twitchAccessToken,
            twitchRefreshToken: users.twitchRefreshToken,
            id: users.id,
        })
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);

        if (!userResult) {
            return { hasAccess: false, reason: "User not found" };
        }

        const hasActiveSub = await checkTwitchSubscription(userResult, modpack.twitchCreatorIds as string[]);
        if (!hasActiveSub) {
            await db.update(modpackAcquisitionsTable)
                .set({ status: AcquisitionStatus.SUSPENDED, updatedAt: new Date() })
                .where(eq(modpackAcquisitionsTable.id, acquisition.id));

            return { hasAccess: false, acquisition, reason: "Twitch subscription expired" };
        }
    }

    return { hasAccess: true, acquisition };
}

async function checkTwitchSubscription(
    user: { twitchId: string | null; twitchAccessToken: string | null; twitchRefreshToken: string | null; id: string },
    channelIds: string[],
): Promise<boolean> {
    if (!user.twitchId || !user.twitchAccessToken) return false;
    if (!channelIds || !Array.isArray(channelIds) || channelIds.length === 0) return false;

    const clientId = Deno.env.get("TWITCH_CLIENT_ID")!;

    for (const channelId of channelIds) {
        try {
            const res = await fetch(
                `https://api.twitch.tv/helix/subscriptions/user?broadcaster_id=${channelId}&user_id=${user.twitchId}`,
                {
                    headers: {
                        Authorization: `Bearer ${user.twitchAccessToken}`,
                        "Client-Id": clientId,
                    },
                },
            );

            if (res.ok) {
                const data = await res.json();
                if (data.data && data.data.length > 0) {
                    return true;
                }
            } else if (res.status === 401) {
                const refreshed = await refreshTwitchToken(user);
                if (refreshed) {
                    return checkTwitchSubscription(
                        { ...user, twitchAccessToken: refreshed.accessToken, twitchRefreshToken: refreshed.refreshToken },
                        channelIds,
                    );
                }
                return false;
            }
        } catch (err) {
            log(`[TWITCH] Error checking subscription for channel ${channelId}:`, err);
            continue;
        }
    }

    return false;
}

async function refreshTwitchToken(user: { twitchRefreshToken: string | null; id: string }): Promise<{ accessToken: string; refreshToken: string } | null> {
    if (!user.twitchRefreshToken) return null;

    const clientId = Deno.env.get("TWITCH_CLIENT_ID")!;
    const clientSecret = Deno.env.get("TWITCH_CLIENT_SECRET")!;

    try {
        const res = await fetch("https://id.twitch.tv/oauth2/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                grant_type: "refresh_token",
                refresh_token: user.twitchRefreshToken,
            }),
        });

        if (!res.ok) return null;

        const data = await res.json();
        const newAccessToken = data.access_token;
        const newRefreshToken = data.refresh_token ?? user.twitchRefreshToken;

        await db.update(users)
            .set({
                twitchAccessToken: newAccessToken,
                twitchRefreshToken: newRefreshToken,
            })
            .where(eq(users.id, user.id));

        return { accessToken: newAccessToken, refreshToken: newRefreshToken };
    } catch {
        return null;
    }
}

export async function acquireFree(userId: string, modpackId: string) {
    const [modpack] = await db.select().from(modpacksTable).where(eq(modpacksTable.id, modpackId)).limit(1);
    if (!modpack) throw new NotFoundError("Modpack not found", "MODPACK_NOT_FOUND");
    if (modpack.acquisitionMethod !== AcquisitionMethod.FREE) {
        throw new ValidationError("This modpack is not free", "NOT_FREE");
    }

    return createAcquisition(userId, modpackId, AcquisitionMethod.FREE);
}

export async function acquirePassword(userId: string, modpackId: string, password: string) {
    const [modpack] = await db.select().from(modpacksTable).where(eq(modpacksTable.id, modpackId)).limit(1);
    if (!modpack) throw new NotFoundError("Modpack not found", "MODPACK_NOT_FOUND");
    if (modpack.acquisitionMethod !== AcquisitionMethod.PASSWORD) {
        throw new ValidationError("This modpack does not require a password", "NOT_PASSWORD_PROTECTED");
    }

    if (!modpack.password) {
        throw new ValidationError("Modpack has no password set", "NO_PASSWORD");
    }

    const valid = await bcrypt.compare(password, modpack.password);
    if (!valid) {
        throw new ForbiddenError("Incorrect password", "INVALID_PASSWORD");
    }

    return createAcquisition(userId, modpackId, AcquisitionMethod.PASSWORD);
}

export async function acquireTwitch(userId: string, modpackId: string) {
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) throw new NotFoundError("User not found", "USER_NOT_FOUND");

    const [modpack] = await db.select().from(modpacksTable).where(eq(modpacksTable.id, modpackId)).limit(1);
    if (!modpack) throw new NotFoundError("Modpack not found", "MODPACK_NOT_FOUND");
    if (modpack.acquisitionMethod !== AcquisitionMethod.TWITCH_SUB) {
        throw new ValidationError("This modpack does not support Twitch acquisition", "NOT_TWITCH");
    }

    if (!user.twitchId) {
        throw new ValidationError("Twitch account must be linked first", "TWITCH_NOT_LINKED");
    }

    const hasSub = await checkTwitchSubscription(user, modpack.twitchCreatorIds as string[]);
    if (!hasSub) {
        throw new ForbiddenError("Active Twitch subscription required", "NO_TWITCH_SUB");
    }

    return createAcquisition(userId, modpackId, AcquisitionMethod.TWITCH_SUB);
}

async function createAcquisition(
    userId: string,
    modpackId: string,
    method: string,
) {
    const [existing] = await db.select()
        .from(modpackAcquisitionsTable)
        .where(and(
            eq(modpackAcquisitionsTable.userId, userId),
            eq(modpackAcquisitionsTable.modpackId, modpackId),
        ))
        .limit(1);

    if (existing) {
        if (existing.status === AcquisitionStatus.ACTIVE) {
            return existing;
        }
        const [updated] = await db.update(modpackAcquisitionsTable)
            .set({
                status: AcquisitionStatus.ACTIVE,
                method: method as any,
                updatedAt: new Date(),
            })
            .where(eq(modpackAcquisitionsTable.id, existing.id))
            .returning();
        return updated;
    }

    const [acquisition] = await db.insert(modpackAcquisitionsTable)
        .values({
            userId,
            modpackId,
            method: method as any,
            status: AcquisitionStatus.ACTIVE,
        })
        .returning();

    return acquisition;
}

export async function revokeAccess(userId: string, modpackId: string) {
    const [existing] = await db.select()
        .from(modpackAcquisitionsTable)
        .where(and(
            eq(modpackAcquisitionsTable.userId, userId),
            eq(modpackAcquisitionsTable.modpackId, modpackId),
        ))
        .limit(1);

    if (!existing) return false;

    await db.update(modpackAcquisitionsTable)
        .set({ status: AcquisitionStatus.REVOKED, updatedAt: new Date() })
        .where(eq(modpackAcquisitionsTable.id, existing.id));

    return true;
}

export async function getUserAcquisitions(userId: string) {
    return db.select({
        acquisition: modpackAcquisitionsTable,
        modpack: {
            id: modpacksTable.id,
            name: modpacksTable.name,
            slug: modpacksTable.slug,
            iconUrl: modpacksTable.iconUrl,
            bannerUrl: modpacksTable.bannerUrl,
            creatorId: modpacksTable.creatorId,
            creatorName: creatorsTable.displayName,
        },
    })
        .from(modpackAcquisitionsTable)
        .innerJoin(modpacksTable, eq(modpackAcquisitionsTable.modpackId, modpacksTable.id))
        .innerJoin(creatorsTable, eq(modpacksTable.creatorId, creatorsTable.id))
        .where(and(
            eq(modpackAcquisitionsTable.userId, userId),
            ne(modpacksTable.visibility, ModpackVisibility.WHITELIST),
        ))
        .orderBy(modpackAcquisitionsTable.createdAt);
}

export async function getModpackAccessInfo(modpackId: string) {
    const [modpack] = await db.select({
        acquisitionMethod: modpacksTable.acquisitionMethod,
        requiresTwitchSubscription: modpacksTable.requiresTwitchSubscription,
        twitchChannels: modpacksTable.twitchChannels,
        visibility: modpacksTable.visibility,
    })
        .from(modpacksTable)
        .where(eq(modpacksTable.id, modpackId))
        .limit(1);

    if (!modpack) throw new NotFoundError("Modpack not found", "MODPACK_NOT_FOUND");

    return {
        acquisitionMethod: modpack.acquisitionMethod,
        visibility: modpack.visibility,
        isFree: modpack.acquisitionMethod === AcquisitionMethod.FREE,
        requiresPassword: modpack.acquisitionMethod === AcquisitionMethod.PASSWORD,
        requiresTwitchSubscription: modpack.acquisitionMethod === AcquisitionMethod.TWITCH_SUB,
        twitchChannels: modpack.twitchChannels,
    };
}
