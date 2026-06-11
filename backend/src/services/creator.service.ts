import { db } from "@/db/client.ts";
import { creatorsTable, creatorUsersTable, users, CreatorRole, CreatorStatus } from "@/db/schema.ts";
import { eq, and, inArray, count } from "drizzle-orm";
import { ValidationError, NotFoundError } from "@/lib/errors/index.ts";

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
    const [creator] = await db.update(creatorsTable)
        .set({ ...data, updatedAt: new Date() })
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
