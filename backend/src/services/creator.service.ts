import { db } from "@/db/client.ts";
import { creatorsTable, creatorUsersTable, users, modpacksTable, CreatorRole, CreatorStatus, ModpackVisibility, ModpackStatus } from "@/db/schema.ts";
import { eq, and, inArray, count, desc } from "drizzle-orm";
import { ValidationError, NotFoundError } from "@/lib/errors/index.ts";
import { uploadObject, getCreatorImageKey, getCreatorImageUrl } from "@/lib/r2.ts";

export async function createCreator(
    userId: string,
    data: { displayName: string; description?: string; discordUrl?: string; logoUrl?: string; bannerUrl?: string },
) {
    if (!data.displayName?.trim()) {
        throw new ValidationError("Display name is required", "MISSING_DISPLAY_NAME");
    }

    const slug = data.displayName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

    const [creator] = await db.insert(creatorsTable)
        .values({
            displayName: data.displayName,
            slug,
            description: data.description ?? null,
            discordUrl: data.discordUrl ?? null,
            logoUrl: data.logoUrl ?? null,
            bannerUrl: data.bannerUrl ?? null,
            status: CreatorStatus.PENDING,
        })
        .returning();

    await db.insert(cu)
        .values({ creatorId: creator.id, userId, role: CreatorRole.OWNER })
        .returning();

    return creator;
}

const cu = creatorUsersTable

export async function getCreatorsByUser(userId: string) {
    const memberships = await db.select()
        .from(cu)
        .where(eq(cu.userId, userId));

    if (memberships.length === 0) return [];

    const creatorIds = memberships.map((m) => m.creatorId);
    const creatorList = await db.select()
        .from(creatorsTable)
        .where(inArray(creatorsTable.id, creatorIds));

    return creatorList.map((creator) => {
        const membership = memberships.find((m) => m.creatorId === creator.id)!;
        return { ...creator, role: membership.role };
    });
}

export async function getCreatorById(creatorId: string, userId?: string) {
    const [creator] = await db.select()
        .from(creatorsTable)
        .where(eq(creatorsTable.id, creatorId))
        .limit(1);

    if (!creator) throw new NotFoundError("Creator not found", "CREATOR_NOT_FOUND");

    if (creator.status === CreatorStatus.APPROVED) return creator;

    if (!userId) throw new NotFoundError("Creator not found", "CREATOR_NOT_FOUND");

    const [membership] = await db.select()
        .from(cu)
        .where(and(eq(cu.userId, userId), eq(cu.creatorId, creatorId)))
        .limit(1);

    if (!membership) throw new NotFoundError("Creator not found", "CREATOR_NOT_FOUND");

    return creator;
}

export async function updateCreator(
    creatorId: string,
    data: { displayName?: string; description?: string; discordUrl?: string; logoUrl?: string; bannerUrl?: string },
) {
    const updateData: Record<string, unknown> = { ...data, updatedAt: new Date() };

    if (data.displayName) {
        updateData.nameLastChangedAt = new Date();
    }

    const [creator] = await db.update(creatorsTable)
        .set(updateData)
        .where(eq(creatorsTable.id, creatorId))
        .returning();

    if (!creator) throw new NotFoundError("Creator not found", "CREATOR_NOT_FOUND");
    return creator;
}

export async function getCreatorMembers(creatorId: string) {
    return db.select({
        userId: cu.userId,
        role: cu.role,
        username: users.username,
        email: users.email,
        avatarUrl: users.avatarUrl,
        joinedAt: cu.createdAt,
    })
        .from(cu)
        .innerJoin(users, eq(users.id, cu.userId))
        .where(eq(cu.creatorId, creatorId));
}

export async function addMember(creatorId: string, targetUserId: string, role: CreatorRole) {
    const [existing] = await db.select()
        .from(cu)
        .where(and(eq(cu.creatorId, creatorId), eq(cu.userId, targetUserId)))
        .limit(1);

    if (existing) throw new ValidationError("User is already a member", "ALREADY_MEMBER");

    const [user] = await db.select().from(users).where(eq(users.id, targetUserId)).limit(1);
    if (!user) throw new NotFoundError("User not found", "USER_NOT_FOUND");

    const [membership] = await db.insert(cu)
        .values({ creatorId, userId: targetUserId, role })
        .returning();

    return membership;
}

export async function updateMemberRole(creatorId: string, targetUserId: string, role: CreatorRole) {
    const [existing] = await db.select()
        .from(cu)
        .where(and(eq(cu.creatorId, creatorId), eq(cu.userId, targetUserId)))
        .limit(1);

    if (!existing) throw new NotFoundError("Member not found", "MEMBER_NOT_FOUND");

    const [membership] = await db.update(cu)
        .set({ role, updatedAt: new Date() })
        .where(and(eq(cu.creatorId, creatorId), eq(cu.userId, targetUserId)))
        .returning();

    return membership;
}

export async function removeMember(creatorId: string, targetUserId: string) {
    const [existing] = await db.select()
        .from(cu)
        .where(and(eq(cu.creatorId, creatorId), eq(cu.userId, targetUserId)))
        .limit(1);

    if (!existing) throw new NotFoundError("Member not found", "MEMBER_NOT_FOUND");

    const [ownerCount] = await db.select({ value: count() })
        .from(cu)
        .where(and(eq(cu.creatorId, creatorId), eq(cu.role, CreatorRole.OWNER)));

    if (existing.role === CreatorRole.OWNER && Number(ownerCount.value) <= 1) {
        throw new ValidationError("Cannot remove the last owner", "LAST_OWNER");
    }

    await db.delete(cu)
        .where(and(eq(cu.creatorId, creatorId), eq(cu.userId, targetUserId)));
}

// ── Profile ─────────────────────────────────────────

export async function getCreatorProfile(creatorId: string) {
    const [creator] = await db.select()
        .from(creatorsTable)
        .where(eq(creatorsTable.id, creatorId))
        .limit(1);

    if (!creator) throw new NotFoundError("Creator not found", "CREATOR_NOT_FOUND");

    const now = new Date();
    const nextNameChangeAvailable = creator.nameLastChangedAt
        ? new Date(creator.nameLastChangedAt.getTime() + 30 * 24 * 60 * 60 * 1000)
        : null;

    return {
        id: creator.id,
        displayName: creator.displayName,
        slug: creator.slug,
        description: creator.description,
        logoUrl: creator.logoUrl,
        bannerUrl: creator.bannerUrl,
        discordUrl: creator.discordUrl,
        verified: creator.verified,
        partner: creator.partner,
        nameLastChangedAt: creator.nameLastChangedAt?.toISOString() ?? null,
        nextNameChangeAvailable: nextNameChangeAvailable && nextNameChangeAvailable > now
            ? nextNameChangeAvailable.toISOString()
            : null,
    };
}

export async function updateCreatorProfile(
    creatorId: string,
    data: {
        displayName?: string;
        description?: string | null;
        logoUrl?: string | null;
        bannerUrl?: string | null;
        discordUrl?: string | null;
    },
) {
    const creator = await getCreatorById(creatorId);

    const updateData: Record<string, unknown> = {
        updatedAt: new Date(),
    };

    if (data.description !== undefined) updateData.description = data.description;
    if (data.logoUrl !== undefined) updateData.logoUrl = data.logoUrl;
    if (data.bannerUrl !== undefined) updateData.bannerUrl = data.bannerUrl;
    if (data.discordUrl !== undefined) updateData.discordUrl = data.discordUrl;

    if (data.displayName !== undefined) {
        const trimmed = data.displayName.trim();
        if (trimmed.length < 2) {
            throw new ValidationError("Display name must be at least 2 characters", "SHORT_DISPLAY_NAME");
        }

        if (trimmed !== creator.displayName) {
            const now = new Date();
            if (creator.nameLastChangedAt) {
                const cooldownEnd = new Date(creator.nameLastChangedAt.getTime() + 30 * 24 * 60 * 60 * 1000);
                if (now < cooldownEnd) {
                    const daysLeft = Math.ceil((cooldownEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
                    throw new ValidationError(
                        `You can change your name again in ${daysLeft} days`,
                        "NAME_COOLDOWN",
                    );
                }
            }

            const slug = trimmed
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-|-$/g, "");

            updateData.displayName = trimmed;
            updateData.slug = slug;
            updateData.nameLastChangedAt = now;
        }
    }

    const [updated] = await db.update(creatorsTable)
        .set(updateData)
        .where(eq(creatorsTable.id, creatorId))
        .returning();

    if (!updated) throw new NotFoundError("Creator not found", "CREATOR_NOT_FOUND");

    return getCreatorProfile(creatorId);
}

export async function getPublicCreatorProfile(slug: string) {
    const [creator] = await db.select()
        .from(creatorsTable)
        .where(and(
            eq(creatorsTable.slug, slug),
            eq(creatorsTable.status, CreatorStatus.APPROVED),
        ))
        .limit(1);

    if (!creator) throw new NotFoundError("Creator not found", "CREATOR_NOT_FOUND");

    const [memberResult] = await db.select({ value: count() })
        .from(cu)
        .where(eq(cu.creatorId, creator.id));

    const [modpackResult] = await db.select({ value: count() })
        .from(modpacksTable)
        .where(and(
            eq(modpacksTable.creatorId, creator.id),
            eq(modpacksTable.visibility, ModpackVisibility.PUBLIC),
            eq(modpacksTable.status, ModpackStatus.PUBLISHED),
        ));

    const modpacks = await db.select({
        id: modpacksTable.id,
        name: modpacksTable.name,
        slug: modpacksTable.slug,
        bannerUrl: modpacksTable.bannerUrl,
        visibility: modpacksTable.visibility,
        shortDescription: modpacksTable.shortDescription,
    })
        .from(modpacksTable)
        .where(and(
            eq(modpacksTable.creatorId, creator.id),
            eq(modpacksTable.visibility, ModpackVisibility.PUBLIC),
            eq(modpacksTable.status, ModpackStatus.PUBLISHED),
        ))
        .orderBy(desc(modpacksTable.createdAt));

    const creatorInfo = {
        id: creator.id,
        name: creator.displayName,
        slug: creator.slug,
        verified: creator.verified,
        partner: creator.partner,
    };

    return {
        id: creator.id,
        displayName: creator.displayName,
        slug: creator.slug,
        description: creator.description,
        logoUrl: creator.logoUrl,
        bannerUrl: creator.bannerUrl,
        discordUrl: creator.discordUrl,
        verified: creator.verified,
        partner: creator.partner,
        memberCount: Number(memberResult.value),
        modpackCount: Number(modpackResult.value),
        modpacks: modpacks.map(m => ({
            id: m.id,
            name: m.name,
            slug: m.slug,
            bannerUrl: m.bannerUrl,
            visibility: m.visibility,
            shortDescription: m.shortDescription,
            creator: creatorInfo,
        })),
    };
}

export async function uploadCreatorImage(
    creatorId: string,
    type: 'logo' | 'banner',
    file: File,
): Promise<string> {
    const bytes = new Uint8Array(await file.arrayBuffer());
    await uploadObject(getCreatorImageKey(creatorId, type), bytes, file.type);
    const url = getCreatorImageUrl(creatorId, type);
    return url;
}
