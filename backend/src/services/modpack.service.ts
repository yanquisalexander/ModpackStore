import { db } from "@/db/client.ts";
import { modpacksTable, modpackCategoriesTable, categoriesTable, ModpackStatus, ModpackVisibility, AcquisitionMethod } from "@/db/schema.ts";
import { eq, inArray } from "drizzle-orm";
import { NotFoundError, ValidationError } from "@/lib/errors/index.ts";
import * as bcrypt from "npm:bcryptjs";
import { setModpackCategories } from "@/services/category.service.ts";

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
        iconUrlResized?: string;
        bannerUrl?: string;
        bannerUrlResized?: string;
        acquisitionMethod?: string;
        password?: string;
        requiresTwitchSubscription?: boolean;
        twitchCreatorIds?: string[];
        twitchChannels?: Array<{ id: string; username: string; displayName: string }>;
        categoryIds?: string[];
        primaryCategoryId?: string;
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
            iconUrlResized: data.iconUrlResized ?? null,
            bannerUrl: data.bannerUrl ?? "",
            bannerUrlResized: data.bannerUrlResized ?? null,
            visibility,
            creatorId,
            creatorUserId: userId,
            status: ModpackStatus.DRAFT,
            acquisitionMethod: data.acquisitionMethod ?? "free",
            requiresTwitchSubscription: data.requiresTwitchSubscription ?? false,
            twitchCreatorIds: data.twitchCreatorIds ?? null,
            twitchChannels: data.twitchChannels ?? null,
            password: hashedPassword,
        })
        .returning();

    if (data.categoryIds && data.categoryIds.length > 0) {
        await setModpackCategories(modpack.id, data.categoryIds, data.primaryCategoryId);
    }

    return modpack;
}

export async function getModpacksByCreator(creatorId: string) {
    const modpacks = await db.select({
        id: modpacksTable.id,
        name: modpacksTable.name,
        slug: modpacksTable.slug,
        description: modpacksTable.description,
        shortDescription: modpacksTable.shortDescription,
        iconUrl: modpacksTable.iconUrl,
        iconUrlResized: modpacksTable.iconUrlResized,
        bannerUrl: modpacksTable.bannerUrl,
        bannerUrlResized: modpacksTable.bannerUrlResized,
        visibility: modpacksTable.visibility,
        status: modpacksTable.status,
        creatorId: modpacksTable.creatorId,
        acquisitionMethod: modpacksTable.acquisitionMethod,
        password: modpacksTable.password,
        requiresTwitchSubscription: modpacksTable.requiresTwitchSubscription,
        twitchCreatorIds: modpacksTable.twitchCreatorIds,
        twitchChannels: modpacksTable.twitchChannels,
        prelaunchAppearance: modpacksTable.prelaunchAppearance,
        updatedAt: modpacksTable.updatedAt,
        createdAt: modpacksTable.createdAt,
    })
        .from(modpacksTable)
        .where(eq(modpacksTable.creatorId, creatorId))
        .orderBy(modpacksTable.updatedAt);

    // Fetch categories for all modpacks in a single query
    const modpackIds = modpacks.map(m => m.id);
    if (modpackIds.length > 0) {
        const catRows = await db.select({
            modpackId: modpackCategoriesTable.modpackId,
            categoryId: modpackCategoriesTable.categoryId,
            isPrimary: modpackCategoriesTable.isPrimary,
            name: categoriesTable.name,
        })
            .from(modpackCategoriesTable)
            .innerJoin(categoriesTable, eq(modpackCategoriesTable.categoryId, categoriesTable.id))
            .where(inArray(modpackCategoriesTable.modpackId, modpackIds));

        for (const modpack of modpacks) {
            modpack.categories = catRows
                .filter(c => c.modpackId === modpack.id)
                .map(c => ({ categoryId: c.categoryId, isPrimary: c.isPrimary, name: c.name }));
        }
    } else {
        for (const modpack of modpacks) {
            modpack.categories = [];
        }
    }

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
        iconUrlResized: string;
        bannerUrl: string;
        bannerUrlResized: string;
        status: ModpackStatus;
        acquisitionMethod: string;
        password: string;
        requiresTwitchSubscription: boolean;
        twitchCreatorIds: string[];
        twitchChannels: Array<{ id: string; username: string; displayName: string }>;
        categoryIds: string[];
        primaryCategoryId: string;
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

    if (data.categoryIds !== undefined) {
        await setModpackCategories(modpackId, data.categoryIds, data.primaryCategoryId);
    }

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
