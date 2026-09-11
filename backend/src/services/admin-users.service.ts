import { db } from "@/db/client.ts";
import { users, bansTable, UserRole } from "@/db/schema.ts";
import { eq, and, or, ilike, desc, count, sql } from "drizzle-orm";
import { NotFoundError, ValidationError } from "@/lib/errors/index.ts";

interface ListUsersParams {
    page?: number;
    limit?: number;
    search?: string;
    role?: string;
    sortBy?: string;
    sortOrder?: string;
}

interface CreateUserData {
    username: string;
    email: string;
    role?: string;
    avatarUrl?: string;
}

interface UpdateUserData {
    username?: string;
    email?: string;
    role?: string;
    avatarUrl?: string;
}

export async function getAllUsers(params: ListUsersParams = {}) {
    const {
        page = 1,
        limit = 20,
        search,
        role,
        sortBy = "createdAt",
        sortOrder = "DESC",
    } = params;

    const conditions: ReturnType<typeof eq>[] = [];

    if (search) {
        conditions.push(
            or(
                ilike(users.username, `%${search}%`),
                ilike(users.email, `%${search}%`),
            ) as any,
        );
    }

    if (role && role !== "all") {
        conditions.push(eq(users.role, role as any));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const offset = (page - 1) * limit;

    const sortColumn = sortBy === "username" ? users.username
        : sortBy === "email" ? users.email
        : sortBy === "updatedAt" ? users.updatedAt
        : users.createdAt;

    const orderByClause = sortOrder.toUpperCase() === "ASC"
        ? sortColumn
        : desc(sortColumn);

    const rows = await db.select({
        id: users.id,
        username: users.username,
        email: users.email,
        avatarUrl: users.avatarUrl,
        role: users.role,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        isBanned: sql<boolean>`EXISTS(SELECT 1 FROM ${bansTable} WHERE ${bansTable.userId} = ${users.id} AND ${bansTable.isActive} = ${sql.raw('true')})`,
    })
        .from(users)
        .where(where)
        .orderBy(orderByClause)
        .limit(limit)
        .offset(offset);

    const [totalResult] = await db.select({ value: count() })
        .from(users)
        .where(where);

    const total = Number(totalResult.value);

    return {
        data: rows,
        meta: {
            total,
            page,
            totalPages: Math.ceil(total / limit),
        },
    };
}

export async function getUserById(userId: string) {
    const [user] = await db.select({
        id: users.id,
        username: users.username,
        email: users.email,
        avatarUrl: users.avatarUrl,
        role: users.role,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
    })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

    return user ?? null;
}

export async function createUser(data: CreateUserData) {
    const { username, email, role, avatarUrl } = data;

    if (!username?.trim()) {
        throw new ValidationError("Username is required", "MISSING_USERNAME");
    }
    if (!email?.trim()) {
        throw new ValidationError("Email is required", "MISSING_EMAIL");
    }

    const validRole = role && Object.values(UserRole).includes(role as UserRole)
        ? role as UserRole
        : UserRole.USER;

    const [user] = await db.insert(users)
        .values({
            username: username.trim(),
            email: email.trim(),
            role: validRole,
            avatarUrl: avatarUrl ?? null,
        })
        .returning({
            id: users.id,
            username: users.username,
            email: users.email,
            avatarUrl: users.avatarUrl,
            role: users.role,
            createdAt: users.createdAt,
            updatedAt: users.updatedAt,
        });

    return user;
}

export async function updateUser(userId: string, data: UpdateUserData) {
    const [existing] = await db.select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

    if (!existing) throw new NotFoundError("User not found", "USER_NOT_FOUND");

    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (data.username !== undefined) updateData.username = data.username;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.avatarUrl !== undefined) updateData.avatarUrl = data.avatarUrl;
    if (data.role !== undefined) updateData.role = data.role;

    const [user] = await db.update(users)
        .set(updateData)
        .where(eq(users.id, userId))
        .returning({
            id: users.id,
            username: users.username,
            email: users.email,
            avatarUrl: users.avatarUrl,
            role: users.role,
            createdAt: users.createdAt,
            updatedAt: users.updatedAt,
        });

    return user;
}

export async function deleteUser(userId: string) {
    const [existing] = await db.select({ id: users.id })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

    if (!existing) throw new NotFoundError("User not found", "USER_NOT_FOUND");

    await db.delete(users)
        .where(eq(users.id, userId));
}

export async function getUserStats() {
    const [totalResult] = await db.select({ value: count() })
        .from(users);

    const totalUsers = Number(totalResult.value);

    const roles = Object.values(UserRole);
    const usersByRole: Record<string, number> = {};

    for (const role of roles) {
        const [result] = await db.select({ value: count() })
            .from(users)
            .where(eq(users.role, role as any));
        usersByRole[role] = Number(result.value);
    }

    const recentUsers = await db.select({
        id: users.id,
        username: users.username,
        email: users.email,
        role: users.role,
        avatarUrl: users.avatarUrl,
        createdAt: users.createdAt,
    })
        .from(users)
        .orderBy(desc(users.createdAt))
        .limit(5);

    return {
        data: {
            totalUsers,
            usersByRole,
            recentUsers,
        },
    };
}
