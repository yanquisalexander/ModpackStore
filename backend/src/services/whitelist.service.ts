import { db } from "@/db/client.ts";
import { modpackWhitelistsTable, modpacksTable, creatorsTable, users, ModpackVisibility, ModpackStatus } from "@/db/schema.ts";
import { eq, and, inArray, count } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { NotFoundError, ValidationError } from "@/lib/errors/index.ts";

export async function hasAccess(modpackId: string, userId?: string): Promise<boolean> {
    const [modpack] = await db.select({ visibility: modpacksTable.visibility })
        .from(modpacksTable)
        .where(eq(modpacksTable.id, modpackId))
        .limit(1);

    if (!modpack) return false;
    if (modpack.visibility !== ModpackVisibility.WHITELIST) return true;
    if (!userId) return false;

    const [entry] = await db.select({ id: modpackWhitelistsTable.id })
        .from(modpackWhitelistsTable)
        .where(and(
            eq(modpackWhitelistsTable.modpackId, modpackId),
            eq(modpackWhitelistsTable.userId, userId),
        ))
        .limit(1);

    return !!entry;
}

export async function addToWhitelist(
    modpackId: string,
    userId: string,
    addedByUserId?: string,
    notes?: string,
) {
    const [modpack] = await db.select({ visibility: modpacksTable.visibility })
        .from(modpacksTable)
        .where(eq(modpacksTable.id, modpackId))
        .limit(1);

    if (!modpack) {
        throw new NotFoundError("Modpack not found", "MODPACK_NOT_FOUND");
    }

    if (modpack.visibility !== ModpackVisibility.WHITELIST) {
        throw new ValidationError("Whitelist can only be managed for whitelist-visibility modpacks", "NOT_WHITELIST_VISIBILITY");
    }

    const [existing] = await db.select()
        .from(modpackWhitelistsTable)
        .where(and(
            eq(modpackWhitelistsTable.modpackId, modpackId),
            eq(modpackWhitelistsTable.userId, userId),
        ))
        .limit(1);

    if (existing) {
        throw new ValidationError("User is already whitelisted for this modpack", "ALREADY_WHITELISTED");
    }

    const [entry] = await db.insert(modpackWhitelistsTable)
        .values({ modpackId, userId, addedByUserId: addedByUserId ?? null, notes: notes ?? null })
        .returning();

    return entry;
}

export async function removeFromWhitelist(modpackId: string, userId: string) {
    const [existing] = await db.select()
        .from(modpackWhitelistsTable)
        .where(and(
            eq(modpackWhitelistsTable.modpackId, modpackId),
            eq(modpackWhitelistsTable.userId, userId),
        ))
        .limit(1);

    if (!existing) {
        throw new NotFoundError("User is not whitelisted for this modpack", "NOT_WHITELISTED");
    }

    await db.delete(modpackWhitelistsTable)
        .where(and(
            eq(modpackWhitelistsTable.modpackId, modpackId),
            eq(modpackWhitelistsTable.userId, userId),
        ));

    return true;
}

export async function getWhitelistedUsers(modpackId: string) {
    return db.select({
        id: users.id,
        username: users.username,
        avatarUrl: users.avatarUrl,
        notes: modpackWhitelistsTable.notes,
        createdAt: modpackWhitelistsTable.createdAt,
    })
        .from(modpackWhitelistsTable)
        .innerJoin(users, eq(users.id, modpackWhitelistsTable.userId))
        .where(eq(modpackWhitelistsTable.modpackId, modpackId))
        .orderBy(modpackWhitelistsTable.createdAt);
}

export async function getWhitelistStats(modpackId: string) {
    const [result] = await db.select({ value: count() })
        .from(modpackWhitelistsTable)
        .where(eq(modpackWhitelistsTable.modpackId, modpackId));

    return {
        totalWhitelisted: Number(result?.value ?? 0),
        maxAllowed: -1,
        remainingSlots: -1,
    };
}

export async function bulkAddToWhitelist(
    modpackId: string,
    userIds: string[],
    addedByUserId: string,
    notes?: string,
) {
    const [modpack] = await db.select({ visibility: modpacksTable.visibility })
        .from(modpacksTable)
        .where(eq(modpacksTable.id, modpackId))
        .limit(1);

    if (!modpack) {
        throw new NotFoundError("Modpack not found", "MODPACK_NOT_FOUND");
    }

    if (modpack.visibility !== ModpackVisibility.WHITELIST) {
        throw new ValidationError("Whitelist can only be managed for whitelist-visibility modpacks", "NOT_WHITELIST_VISIBILITY");
    }

    let added = 0;
    const errors: string[] = [];

    for (const userId of userIds) {
        try {
            const [existing] = await db.select()
                .from(modpackWhitelistsTable)
                .where(and(
                    eq(modpackWhitelistsTable.modpackId, modpackId),
                    eq(modpackWhitelistsTable.userId, userId),
                ))
                .limit(1);

            if (existing) {
                errors.push(`User ${userId} is already whitelisted`);
                continue;
            }

            await db.insert(modpackWhitelistsTable)
                .values({ modpackId, userId, addedByUserId, notes: notes ?? null })
                .returning();

            added++;
        } catch (err) {
            errors.push(err instanceof Error ? err.message : "Unknown error");
        }
    }

    return { added, failed: userIds.length - added, errors };
}

export async function clearWhitelist(modpackId: string) {
    const result = await db.delete(modpackWhitelistsTable)
        .where(eq(modpackWhitelistsTable.modpackId, modpackId))
        .returning({ id: modpackWhitelistsTable.id });

    return result.length;
}

const addedByUsers = alias(users, "added_by_users");

export async function exportWhitelist(modpackId: string) {
    const entries = await db.select({
        userId: users.id,
        username: users.username,
        discordId: users.discordId,
        addedAt: modpackWhitelistsTable.createdAt,
        addedByUsername: addedByUsers.username,
    })
        .from(modpackWhitelistsTable)
        .innerJoin(users, eq(users.id, modpackWhitelistsTable.userId))
        .leftJoin(addedByUsers, eq(addedByUsers.id, modpackWhitelistsTable.addedByUserId))
        .where(eq(modpackWhitelistsTable.modpackId, modpackId))
        .orderBy(modpackWhitelistsTable.createdAt);

    return entries;
}

export async function getUserWhitelistedModpacks(userId: string) {
    const whitelistEntries = await db.select({ modpackId: modpackWhitelistsTable.modpackId })
        .from(modpackWhitelistsTable)
        .where(eq(modpackWhitelistsTable.userId, userId));

    if (whitelistEntries.length === 0) return [];

    const modpackIds = whitelistEntries.map((e) => e.modpackId);

    const modpacks = await db.select({
        id: modpacksTable.id,
        name: modpacksTable.name,
        slug: modpacksTable.slug,
        shortDescription: modpacksTable.shortDescription,
        iconUrl: modpacksTable.iconUrl,
        bannerUrl: modpacksTable.bannerUrl,
        creatorId: creatorsTable.id,
        creatorName: creatorsTable.displayName,
        creatorLogoUrl: creatorsTable.logoUrl,
    })
        .from(modpacksTable)
        .innerJoin(creatorsTable, eq(creatorsTable.id, modpacksTable.creatorId))
        .where(and(
            inArray(modpacksTable.id, modpackIds),
            eq(modpacksTable.visibility, ModpackVisibility.WHITELIST),
            eq(modpacksTable.status, ModpackStatus.PUBLISHED),
        ));

    return modpacks.map((mp) => ({
        id: mp.id,
        name: mp.name,
        slug: mp.slug,
        shortDescription: mp.shortDescription,
        iconUrl: mp.iconUrl,
        bannerUrl: mp.bannerUrl,
        creator: {
            id: mp.creatorId,
            name: mp.creatorName,
            logoUrl: mp.creatorLogoUrl,
        },
        latestVersion: null,
    }));
}
