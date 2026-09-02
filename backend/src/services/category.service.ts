import { db } from "@/db/client.ts";
import { categoriesTable, modpackCategoriesTable } from "@/db/schema.ts";
import { eq, asc, inArray } from "drizzle-orm";
import { NotFoundError, ValidationError } from "@/lib/errors/index.ts";

// ── Category CRUD ─────────────────────────────────

export async function createCategory(data: {
    name: string;
    shortDescription?: string;
    description?: string;
    iconUrl?: string;
    displayOrder?: number;
    isAdminOnly?: boolean;
    isSelectable?: boolean;
    isAutomatic?: boolean;
}) {
    if (!data.name?.trim()) {
        throw new ValidationError("Name is required", "MISSING_NAME");
    }

    const [existing] = await db.select()
        .from(categoriesTable)
        .where(eq(categoriesTable.name, data.name.trim()))
        .limit(1);

    if (existing) {
        throw new ValidationError("A category with this name already exists", "CATEGORY_NAME_TAKEN");
    }

    const [category] = await db.insert(categoriesTable)
        .values({
            name: data.name.trim(),
            shortDescription: data.shortDescription ?? null,
            description: data.description ?? null,
            iconUrl: data.iconUrl ?? null,
            displayOrder: data.displayOrder ?? 0,
            isAdminOnly: data.isAdminOnly ?? false,
            isSelectable: data.isSelectable ?? true,
            isAutomatic: data.isAutomatic ?? false,
        })
        .returning();

    return category;
}

export async function getCategoryById(id: string) {
    const [category] = await db.select()
        .from(categoriesTable)
        .where(eq(categoriesTable.id, id))
        .limit(1);

    if (!category) throw new NotFoundError("Category not found", "CATEGORY_NOT_FOUND");
    return category;
}

export async function updateCategory(id: string, data: Partial<{
    name: string;
    shortDescription: string;
    description: string;
    iconUrl: string;
    displayOrder: number;
    isAdminOnly: boolean;
    isSelectable: boolean;
}>) {
    await getCategoryById(id);

    if (data.name) {
        const [existing] = await db.select()
            .from(categoriesTable)
            .where(eq(categoriesTable.name, data.name.trim()))
            .limit(1);

        if (existing && existing.id !== id) {
            throw new ValidationError("A category with this name already exists", "CATEGORY_NAME_TAKEN");
        }
    }

    const [category] = await db.update(categoriesTable)
        .set({
            ...data,
            name: data.name?.trim(),
        })
        .where(eq(categoriesTable.id, id))
        .returning();

    return category;
}

export async function deleteCategory(id: string) {
    await getCategoryById(id);

    const [assigned] = await db.select()
        .from(modpackCategoriesTable)
        .where(eq(modpackCategoriesTable.categoryId, id))
        .limit(1);

    if (assigned) {
        throw new ValidationError("Cannot delete category: it is assigned to one or more modpacks", "CATEGORY_IN_USE");
    }

    await db.delete(categoriesTable).where(eq(categoriesTable.id, id));
}

export async function getAllCategories(options?: {
    includeAdminOnly?: boolean;
    onlySelectable?: boolean;
    includeAutomatic?: boolean;
}) {
    let query = db.select().from(categoriesTable).orderBy(asc(categoriesTable.displayOrder));

    // Drizzle doesn't support dynamic where chains easily, so we fetch all and filter
    const rows = await query;

    return rows.filter((cat) => {
        if (!options?.includeAdminOnly && cat.isAdminOnly) return false;
        if (options?.onlySelectable && !cat.isSelectable) return false;
        if (!options?.includeAutomatic && cat.isAutomatic) return false;
        return true;
    });
}

export async function getCategoriesForPublishers() {
    return getAllCategories({ onlySelectable: true, includeAdminOnly: false, includeAutomatic: false });
}

export async function getCategoriesForAdmin() {
    return getAllCategories({ includeAdminOnly: true, includeAutomatic: true });
}

// ── Modpack-Category Assignment ───────────────────

export async function assignCategoryToModpack(modpackId: string, categoryId: string, isPrimary: boolean = false) {
    await getCategoryById(categoryId);

    if (isPrimary) {
        await db.update(modpackCategoriesTable)
            .set({ isPrimary: false })
            .where(eq(modpackCategoriesTable.modpackId, modpackId));
    }

    const [existing] = await db.select()
        .from(modpackCategoriesTable)
        .where(
            eq(modpackCategoriesTable.modpackId, modpackId) &&
            eq(modpackCategoriesTable.categoryId, categoryId)
        )
        .limit(1);

    if (existing) {
        if (isPrimary && !existing.isPrimary) {
            const [updated] = await db.update(modpackCategoriesTable)
                .set({ isPrimary: true })
                .where(eq(modpackCategoriesTable.id, existing.id))
                .returning();
            return updated;
        }
        return existing;
    }

    const [entry] = await db.insert(modpackCategoriesTable)
        .values({ modpackId, categoryId, isPrimary })
        .returning();

    return entry;
}

export async function removeCategoryFromModpack(modpackId: string, categoryId: string) {
    await db.delete(modpackCategoriesTable)
        .where(
            eq(modpackCategoriesTable.modpackId, modpackId) &&
            eq(modpackCategoriesTable.categoryId, categoryId)
        );
}

export async function setPrimaryCategory(modpackId: string, categoryId: string) {
    await db.update(modpackCategoriesTable)
        .set({ isPrimary: false })
        .where(eq(modpackCategoriesTable.modpackId, modpackId));

    const [existing] = await db.select()
        .from(modpackCategoriesTable)
        .where(
            eq(modpackCategoriesTable.modpackId, modpackId) &&
            eq(modpackCategoriesTable.categoryId, categoryId)
        )
        .limit(1);

    if (existing) {
        const [updated] = await db.update(modpackCategoriesTable)
            .set({ isPrimary: true })
            .where(eq(modpackCategoriesTable.id, existing.id))
            .returning();
        return updated;
    }

    const [entry] = await db.insert(modpackCategoriesTable)
        .values({ modpackId, categoryId, isPrimary: true })
        .returning();

    return entry;
}

export async function getModpackCategories(modpackId: string) {
    const rows = await db.select({
        id: categoriesTable.id,
        name: categoriesTable.name,
        shortDescription: categoriesTable.shortDescription,
        description: categoriesTable.description,
        iconUrl: categoriesTable.iconUrl,
        displayOrder: categoriesTable.displayOrder,
        isPrimary: modpackCategoriesTable.isPrimary,
    })
        .from(modpackCategoriesTable)
        .innerJoin(categoriesTable, eq(modpackCategoriesTable.categoryId, categoriesTable.id))
        .where(eq(modpackCategoriesTable.modpackId, modpackId))
        .orderBy(asc(categoriesTable.displayOrder));

    return rows;
}

export async function setModpackCategories(modpackId: string, categoryIds: string[], primaryCategoryId?: string) {
    await db.delete(modpackCategoriesTable)
        .where(eq(modpackCategoriesTable.modpackId, modpackId));

    if (categoryIds.length === 0) return [];

    const entries = await db.insert(modpackCategoriesTable)
        .values(categoryIds.map((categoryId) => ({
            modpackId,
            categoryId,
            isPrimary: primaryCategoryId ? categoryId === primaryCategoryId : false,
        })))
        .returning();

    return entries;
}

export async function reorderCategories(orders: Array<{ id: string; displayOrder: number }>) {
    for (const { id, displayOrder } of orders) {
        await db.update(categoriesTable)
            .set({ displayOrder })
            .where(eq(categoriesTable.id, id));
    }
}
