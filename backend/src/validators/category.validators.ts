import { z } from "zod";

export const createCategorySchema = z.object({
    name: z.string()
        .min(1, "Name is required")
        .max(100, "Name too long")
        .trim(),
    shortDescription: z.string()
        .max(200, "Short description too long")
        .trim()
        .optional()
        .nullable(),
    description: z.string()
        .max(1000, "Description too long")
        .trim()
        .optional()
        .nullable(),
    iconUrl: z.string()
        .url("Invalid icon URL")
        .optional()
        .nullable(),
    displayOrder: z.number()
        .int("Display order must be an integer")
        .min(0, "Display order cannot be negative")
        .optional(),
    isAdminOnly: z.boolean()
        .optional(),
    isSelectable: z.boolean()
        .optional(),
    isAutomatic: z.boolean()
        .optional()
});

export const updateCategorySchema = createCategorySchema.partial();

export const assignCategorySchema = z.object({
    categoryId: z.string()
        .uuid("Invalid category ID"),
    isPrimary: z.boolean()
        .optional()
        .default(false)
});

export const reorderCategoriesSchema = z.object({
    categories: z.array(
        z.object({
            id: z.string().uuid("Invalid category ID"),
            displayOrder: z.number().int().min(0)
        })
    ).min(1, "At least one category is required")
});

export const categoryQuerySchema = z.object({
    includeAdminOnly: z.string()
        .transform(val => val === 'true')
        .optional(),
    onlySelectable: z.string()
        .transform(val => val === 'true')
        .optional(),
    includeAutomatic: z.string()
        .transform(val => val === 'true')
        .optional()
});

export type CreateCategoryRequest = z.infer<typeof createCategorySchema>;
export type UpdateCategoryRequest = z.infer<typeof updateCategorySchema>;
export type AssignCategoryRequest = z.infer<typeof assignCategorySchema>;
export type ReorderCategoriesRequest = z.infer<typeof reorderCategoriesSchema>;
export type CategoryQueryParams = z.infer<typeof categoryQuerySchema>;