import { db } from "@/db/client.ts";
import { bansTable, users } from "@/db/schema.ts";
import { eq, and, desc, count, sql } from "drizzle-orm";
import { NotFoundError, ValidationError } from "@/lib/errors/index.ts";

interface BanUserData {
    userId: string;
    adminId: string;
    reason?: string;
}

export async function banUser(data: BanUserData) {
    const { userId, adminId, reason } = data;

    const [existingUser] = await db.select({ id: users.id, role: users.role })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

    if (!existingUser) throw new NotFoundError("User not found", "USER_NOT_FOUND");

    if (existingUser.role === "admin" || existingUser.role === "super_admin") {
        throw new ValidationError("Cannot ban admin users", "CANNOT_BAN_ADMIN");
    }

    const [activeBan] = await db.select()
        .from(bansTable)
        .where(
            and(
                eq(bansTable.userId, userId),
                eq(bansTable.isActive, true),
            ),
        )
        .limit(1);

    if (activeBan) {
        throw new ValidationError("User is already banned", "ALREADY_BANNED");
    }

    const [ban] = await db.insert(bansTable)
        .values({
            userId,
            adminId,
            reason: reason ?? null,
            isActive: true,
        })
        .returning();

    return ban;
}

export async function unbanUser(userId: string, unbanAdminId: string) {
    const [activeBan] = await db.select()
        .from(bansTable)
        .where(
            and(
                eq(bansTable.userId, userId),
                eq(bansTable.isActive, true),
            ),
        )
        .limit(1);

    if (!activeBan) {
        throw new NotFoundError("User is not currently banned", "NOT_BANNED");
    }

    const [ban] = await db.update(bansTable)
        .set({
            isActive: false,
            unbanDate: new Date(),
            unbanAdminId,
        })
        .where(eq(bansTable.id, activeBan.id))
        .returning();

    return ban;
}

export async function getUserBanHistory(userId: string) {
    const [existingUser] = await db.select({ id: users.id })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

    if (!existingUser) throw new NotFoundError("User not found", "USER_NOT_FOUND");

    const rows = await db.select({
        id: bansTable.id,
        userId: bansTable.userId,
        adminId: bansTable.adminId,
        reason: bansTable.reason,
        isActive: bansTable.isActive,
        banDate: bansTable.createdAt,
        unbanDate: bansTable.unbanDate,
        unbanReason: bansTable.unbanReason,
        adminUsername: users.username,
        adminAvatarUrl: users.avatarUrl,
        unbanAdminUsername: sql`NULL::text`,
        unbanAdminAvatarUrl: sql`NULL::text`,
    })
        .from(bansTable)
        .innerJoin(users, eq(users.id, bansTable.adminId))
        .where(eq(bansTable.userId, userId))
        .orderBy(desc(bansTable.createdAt));

    const mapped = rows.map((b) => ({
        id: b.id,
        userId: b.userId,
        user: { id: userId, username: "", avatarUrl: null },
        adminId: b.adminId,
        admin: { id: b.adminId, username: b.adminUsername, avatarUrl: b.adminAvatarUrl },
        reason: b.reason ?? undefined,
        banDate: b.banDate.toISOString(),
        unbanDate: b.unbanDate?.toISOString(),
        isActive: b.isActive,
        unbannedBy: undefined as { id: string; username: string; avatarUrl: string | null } | undefined,
    }));

    return mapped;
}

export async function getAllBans(includeInactive = false) {
    const conditions = includeInactive ? undefined : eq(bansTable.isActive, true);

    const rows = await db.select({
        id: bansTable.id,
        userId: bansTable.userId,
        adminId: bansTable.adminId,
        reason: bansTable.reason,
        isActive: bansTable.isActive,
        banDate: bansTable.createdAt,
        unbanDate: bansTable.unbanDate,
        userUsername: users.username,
        userAvatarUrl: users.avatarUrl,
        adminUsername: users.username,
        adminAvatarUrl: users.avatarUrl,
    })
        .from(bansTable)
        .innerJoin(users, eq(users.id, bansTable.userId))
        .where(conditions)
        .orderBy(desc(bansTable.createdAt));

    return rows;
}

export async function checkUserBanStatus(userId: string) {
    const [activeBan] = await db.select()
        .from(bansTable)
        .where(
            and(
                eq(bansTable.userId, userId),
                eq(bansTable.isActive, true),
            ),
        )
        .limit(1);

    if (!activeBan) {
        return { isBanned: false };
    }

    const [admin] = await db.select({
        id: users.id,
        username: users.username,
        avatarUrl: users.avatarUrl,
    })
        .from(users)
        .where(eq(users.id, activeBan.adminId))
        .limit(1);

    return {
        isBanned: true,
        ban: {
            id: activeBan.id,
            userId: activeBan.userId,
            adminId: activeBan.adminId,
            reason: activeBan.reason ?? undefined,
            banDate: activeBan.createdAt.toISOString(),
            isActive: activeBan.isActive,
            admin: admin ?? { id: activeBan.adminId, username: "", avatarUrl: null },
        },
    };
}
