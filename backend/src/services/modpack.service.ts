import { db } from "@/db/client.ts";
import { modpacksTable, ModpackStatus, ModpackVisibility } from "@/db/schema.ts";
import { eq } from "drizzle-orm";
import { NotFoundError, ValidationError } from "@/lib/errors/index.ts";

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

    const [modpack] = await db.insert(modpacksTable)
        .values({
            name: data.name,
            shortDescription: data.shortDescription,
            description: data.description ?? null,
            slug,
            iconUrl: data.iconUrl ?? "",
            bannerUrl: data.bannerUrl ?? "",
            visibility: data.visibility ?? ModpackVisibility.PRIVATE,
            creatorId,
            creatorUserId: userId,
            status: ModpackStatus.DRAFT,
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
        isPaid: modpacksTable.isPaid,
        price: modpacksTable.price,
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
    }>,
) {
    const [modpack] = await db.update(modpacksTable)
        .set({ ...data, updatedAt: new Date() })
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
