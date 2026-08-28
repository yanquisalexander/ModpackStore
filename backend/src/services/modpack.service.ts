import { db } from "@/db/client.ts";
import { modpacksTable, ModpackStatus, ModpackVisibility, AcquisitionMethod } from "@/db/schema.ts";
import { eq } from "drizzle-orm";
import { NotFoundError, ValidationError } from "@/lib/errors/index.ts";
import * as bcrypt from "npm:bcryptjs";

function validateVisibilityConstraints(visibility: string | undefined, acquisitionMethod: string | undefined, password: string | null | undefined) {
    if (visibility === ModpackVisibility.WHITELIST) {
        const method = acquisitionMethod ?? AcquisitionMethod.FREE;
        if (method !== AcquisitionMethod.FREE) {
            throw new ValidationError("Whitelist modpacks must be free", "WHITELIST_NOT_FREE");
        }
        if (password) {
            throw new ValidationError("Whitelist modpacks cannot have a password", "WHITELIST_HAS_PASSWORD");
        }
    }
}

export async function createModpack(
    creatorId: string,
    userId: string,
    data: {
        name: string;
        shortDescription: string;
        description?: string;
        visibility?: ModpackVisibility;
        iconUrl?: string;
        bannerUrl?: string;
        acquisitionMethod?: string;
        password?: string;
        requiresTwitchSubscription?: boolean;
        twitchCreatorIds?: string[];
        twitchChannels?: Array<{ id: string; username: string; displayName: string }>;
    },
) {
    if (!data.name?.trim()) {
        throw new ValidationError("Name is required", "MISSING_NAME");
    }
    if (!data.shortDescription?.trim()) {
        throw new ValidationError("Short description is required", "MISSING_SHORT_DESCRIPTION");
    }

    const slug = data.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 64);

    const [existing] = await db.select()
        .from(modpacksTable)
        .where(eq(modpacksTable.slug, slug))
        .limit(1);

    if (existing) {
        throw new ValidationError("A modpack with this name already exists", "SLUG_TAKEN");
    }

    const visibility = data.visibility ?? ModpackVisibility.PRIVATE;
    const acquisitionMethod = data.acquisitionMethod ?? "free";
    validateVisibilityConstraints(visibility, acquisitionMethod, data.password);

    let hashedPassword: string | null = null;
    if (data.password) {
        hashedPassword = await bcrypt.hash(data.password, 10);
    }

    const [modpack] = await db.insert(modpacksTable)
        .values({
            name: data.name,
            shortDescription: data.shortDescription,
            description: data.description ?? null,
            slug,
            iconUrl: data.iconUrl ?? "",
            bannerUrl: data.bannerUrl ?? "",
            visibility,
            creatorId,
            creatorUserId: userId,
            status: ModpackStatus.DRAFT,
            acquisitionMethod,
            password: hashedPassword,
            requiresTwitchSubscription: data.requiresTwitchSubscription ?? false,
            twitchCreatorIds: data.twitchCreatorIds ? JSON.stringify(data.twitchCreatorIds) : null,
            twitchChannels: data.twitchChannels ? JSON.stringify(data.twitchChannels) : null,
        })
        .returning();

    return modpack;
}

export async function getModpacksByCreator(creatorId: string) {
    const modpacks = await db.select({
        id: modpacksTable.id,
        name: modpacksTable.name,
        slug: modpacksTable.slug,
        shortDescription: modpacksTable.shortDescription,
        iconUrl: modpacksTable.iconUrl,
        bannerUrl: modpacksTable.bannerUrl,
        visibility: modpacksTable.visibility,
        status: modpacksTable.status,
        creatorId: modpacksTable.creatorId,
        acquisitionMethod: modpacksTable.acquisitionMethod,
        requiresTwitchSubscription: modpacksTable.requiresTwitchSubscription,
        twitchCreatorIds: modpacksTable.twitchCreatorIds,
        twitchChannels: modpacksTable.twitchChannels,
        updatedAt: modpacksTable.updatedAt,
        createdAt: modpacksTable.createdAt,
    })
        .from(modpacksTable)
        .where(eq(modpacksTable.creatorId, creatorId))
        .orderBy(modpacksTable.updatedAt);

    return modpacks;
}

export async function getModpackById(modpackId: string) {
    const [modpack] = await db.select()
        .from(modpacksTable)
        .where(eq(modpacksTable.id, modpackId))
        .limit(1);

    if (!modpack) throw new NotFoundError("Modpack not found", "MODPACK_NOT_FOUND");
    return modpack;
}

export async function updateModpack(
    modpackId: string,
    data: Partial<{
        name: string;
        shortDescription: string;
        description: string;
        visibility: ModpackVisibility;
        iconUrl: string;
        bannerUrl: string;
        status: ModpackStatus;
        acquisitionMethod: string;
        password: string;
        requiresTwitchSubscription: boolean;
        twitchCreatorIds: string[];
        twitchChannels: Array<{ id: string; username: string; displayName: string }>;
    }>,
    currentModpack?: typeof modpacksTable.$inferSelect,
) {
    const current = currentModpack ?? await getModpackById(modpackId);

    const newVisibility = data.visibility ?? current.visibility;
    const newAcquisitionMethod = data.acquisitionMethod ?? current.acquisitionMethod;
    const newPassword = data.password !== undefined ? data.password : current.password;
    validateVisibilityConstraints(newVisibility, newAcquisitionMethod, newPassword);

    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    for (const [key, value] of Object.entries(data)) {
        if (key === "password" && value) {
            updateData[key] = await bcrypt.hash(value as string, 10);
        } else if (key === "twitchCreatorIds" || key === "twitchChannels") {
            updateData[key] = value ? JSON.stringify(value) : null;
        } else if (value !== undefined) {
            updateData[key] = value;
        }
    }

    const [modpack] = await db.update(modpacksTable)
        .set(updateData)
        .where(eq(modpacksTable.id, modpackId))
        .returning();

    if (!modpack) throw new NotFoundError("Modpack not found", "MODPACK_NOT_FOUND");
    return modpack;
}

export async function deleteModpack(modpackId: string) {
    const [modpack] = await db.update(modpacksTable)
        .set({ status: ModpackStatus.ARCHIVED, updatedAt: new Date() })
        .where(eq(modpacksTable.id, modpackId))
        .returning();

    if (!modpack) throw new NotFoundError("Modpack not found", "MODPACK_NOT_FOUND");
    return modpack;
}
