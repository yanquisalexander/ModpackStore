import { db } from "@/db/client.ts";
import {
    creatorsTable,
    creatorUsersTable,
    users,
    CreatorStatus,
    CreatorRole,
    type UserRole,
} from "@/db/schema.ts";
import { eq, and, or, ilike, desc, count, sql } from "drizzle-orm";
import { NotFoundError, ValidationError } from "@/lib/errors/index.ts";

// ── Existing ───────────────────────────────────────

export async function getPendingCreators() {
    return db.select()
        .from(creatorsTable)
        .where(eq(creatorsTable.status, CreatorStatus.PENDING));
}

export async function approveCreator(creatorId: string) {
    const [creator] = await db.update(creatorsTable)
        .set({ status: CreatorStatus.APPROVED, updatedAt: new Date() })
        .where(eq(creatorsTable.id, creatorId))
        .returning();

    if (!creator) throw new NotFoundError("Creator not found", "CREATOR_NOT_FOUND");
    return creator;
}

export async function rejectCreator(creatorId: string) {
    const [creator] = await db.update(creatorsTable)
        .set({ status: CreatorStatus.REJECTED, updatedAt: new Date() })
        .where(eq(creatorsTable.id, creatorId))
        .returning();

    if (!creator) throw new NotFoundError("Creator not found", "CREATOR_NOT_FOUND");
    return creator;
}

// ── List creators (paginated) ──────────────────────

interface ListCreatorsParams {
    page?: number;
    limit?: number;
    search?: string;
    verified?: boolean;
    partnered?: boolean;
    status?: string;
    banned?: boolean;
    sortBy?: string;
    sortOrder?: string;
}

export async function listCreators(params: ListCreatorsParams = {}) {
    const {
        page = 1,
        limit = 20,
        search,
        verified,
        partnered,
        status,
        banned,
        sortBy = "createdAt",
        sortOrder = "DESC",
    } = params;

    const conditions: ReturnType<typeof eq>[] = [];

    if (search) {
        conditions.push(
            or(
                ilike(creatorsTable.displayName, `%${search}%`),
                ilike(creatorsTable.slug, `%${search}%`),
            ) as any,
        );
    }

    if (verified !== undefined) {
        conditions.push(eq(creatorsTable.verified, verified));
    }

    if (partnered !== undefined) {
        conditions.push(eq(creatorsTable.partner, partnered));
    }

    if (status) {
        conditions.push(eq(creatorsTable.status, status as any));
    }

    if (banned !== undefined) {
        conditions.push(eq(creatorsTable.banned, banned));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const offset = (page - 1) * limit;

    const sortColumn = sortBy === "displayName" ? creatorsTable.displayName
        : sortBy === "updatedAt" ? creatorsTable.updatedAt
        : creatorsTable.createdAt;

    const orderByClause = sortOrder.toUpperCase() === "ASC"
        ? sortColumn
        : desc(sortColumn);

    const rows = await db.select({
        id: creatorsTable.id,
        displayName: creatorsTable.displayName,
        slug: creatorsTable.slug,
        description: creatorsTable.description,
        bannerUrl: creatorsTable.bannerUrl,
        logoUrl: creatorsTable.logoUrl,
        discordUrl: creatorsTable.discordUrl,
        status: creatorsTable.status,
        verified: creatorsTable.verified,
        partner: creatorsTable.partner,
        hostingPartner: creatorsTable.hostingPartner,
        banned: creatorsTable.banned,
        createdAt: creatorsTable.createdAt,
        updatedAt: creatorsTable.updatedAt,
        memberCount: sql<number>`(SELECT count(*) FROM ${creatorUsersTable} WHERE ${creatorUsersTable.creatorId} = ${creatorsTable.id})`,
        modpackCount: sql<number>`0`,
    })
        .from(creatorsTable)
        .where(where)
        .orderBy(orderByClause)
        .limit(limit)
        .offset(offset);

    const [totalResult] = await db.select({ value: count() })
        .from(creatorsTable)
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

// ── Get single creator detail ──────────────────────

export async function getCreatorDetail(creatorId: string) {
    const [creator] = await db.select()
        .from(creatorsTable)
        .where(eq(creatorsTable.id, creatorId))
        .limit(1);

    if (!creator) throw new NotFoundError("Creator not found", "CREATOR_NOT_FOUND");

    const members = await db.select({
        userId: creatorUsersTable.userId,
        role: creatorUsersTable.role,
        username: users.username,
        email: users.email,
        avatarUrl: users.avatarUrl,
        joinedAt: creatorUsersTable.createdAt,
    })
        .from(creatorUsersTable)
        .innerJoin(users, eq(users.id, creatorUsersTable.userId))
        .where(eq(creatorUsersTable.creatorId, creatorId));

    const [modpackCountResult] = await db.select({ value: count() })
        .from(creatorsTable)
        .where(eq(creatorsTable.id, creatorId));

    const modpackCount = Number(modpackCountResult.value);

    return { ...creator, members, modpackCount };
}

// ── Create creator (admin) ─────────────────────────

interface CreateCreatorData {
    displayName: string;
    description?: string;
    bannerUrl?: string;
    logoUrl?: string;
    discordUrl?: string;
}

export async function createCreatorAdmin(data: CreateCreatorData) {
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
            bannerUrl: data.bannerUrl ?? null,
            logoUrl: data.logoUrl ?? null,
            discordUrl: data.discordUrl ?? null,
            status: CreatorStatus.APPROVED,
        })
        .returning();

    return creator;
}

// ── Update creator (admin) ─────────────────────────

interface UpdateCreatorData {
    displayName?: string;
    description?: string | null;
    bannerUrl?: string | null;
    logoUrl?: string | null;
    discordUrl?: string | null;
    status?: string;
    verified?: boolean;
    partner?: boolean;
    hostingPartner?: boolean;
    banned?: boolean;
}

export async function updateCreatorAdmin(creatorId: string, data: UpdateCreatorData) {
    const [existing] = await db.select()
        .from(creatorsTable)
        .where(eq(creatorsTable.id, creatorId))
        .limit(1);

    if (!existing) throw new NotFoundError("Creator not found", "CREATOR_NOT_FOUND");

    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (data.displayName !== undefined) updateData.displayName = data.displayName;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.bannerUrl !== undefined) updateData.bannerUrl = data.bannerUrl;
    if (data.logoUrl !== undefined) updateData.logoUrl = data.logoUrl;
    if (data.discordUrl !== undefined) updateData.discordUrl = data.discordUrl;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.verified !== undefined) updateData.verified = data.verified;
    if (data.partner !== undefined) updateData.partner = data.partner;
    if (data.hostingPartner !== undefined) updateData.hostingPartner = data.hostingPartner;
    if (data.banned !== undefined) updateData.banned = data.banned;

    const [creator] = await db.update(creatorsTable)
        .set(updateData)
        .where(eq(creatorsTable.id, creatorId))
        .returning();

    return creator;
}

// ── Delete creator (soft-delete: banned = true) ────

export async function deleteCreatorAdmin(creatorId: string) {
    const [existing] = await db.select()
        .from(creatorsTable)
        .where(eq(creatorsTable.id, creatorId))
        .limit(1);

    if (!existing) throw new NotFoundError("Creator not found", "CREATOR_NOT_FOUND");

    await db.update(creatorsTable)
        .set({ banned: true, updatedAt: new Date() })
        .where(eq(creatorsTable.id, creatorId));
}

// ── Members (re-exported from creator.service for admin routes) ──

export {
    getCreatorMembers,
    addMember,
    updateMemberRole,
    removeMember,
} from "./creator.service.ts";
