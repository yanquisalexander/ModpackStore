import { Context } from 'hono';
import { Category, createCategorySchema, updateCategorySchema } from '@/models/Category.model';
import { serializeResource, serializeError } from '@/utils/jsonapi';
import { APIError } from '@/lib/APIError';

export class AdminCategoriesController {
    static async listCategories(c: Context): Promise<Response> {
        try {
            const categories = await Category.findAll();
            return c.json(serializeResource('categories', categories.map(cat => cat.toJSON())), 200);
        } catch (error: any) {
            console.error("[CONTROLLER_ADMIN_CATEGORIES] Error listing categories:", error);
            if (error instanceof APIError) throw error;
            throw new APIError(500, "Error listing categories", error.message);
        }
    }

    static async getCategory(c: Context): Promise<Response> {
        try {
            const categoryId = c.req.param('categoryId');
            if (!categoryId) {
                return c.json(serializeError({
                    status: '400',
                    title: 'Bad Request',
                    detail: 'Category ID is required'
                }), 400);
            }

            const category = await Category.findById(categoryId);
            if (!category) {
                return c.json(serializeError({
                    status: '404',
                    title: 'Not Found',
                    detail: 'Category not found'
                }), 404);
            }

            return c.json(serializeResource('category', category.toJSON()), 200);
        } catch (error: any) {
            console.error("[CONTROLLER_ADMIN_CATEGORIES] Error getting category:", error);
            if (error instanceof APIError) throw error;
            throw new APIError(500, "Error getting category", error.message);
        }
    }

    static async createCategory(c: Context): Promise<Response> {
        try {
            // TODO: MIGRATE_MIDDLEWARE - This relies on 'c.get('user')' which comes from requireAuth/validateAdmin middleware
            const user = c.get('user') as { id: string } | undefined;
            if (!user || !user.id) {
                throw new APIError(401, 'Unauthorized', 'Admin privileges required.');
            }

            const body = await c.req.json();
            const validationResult = createCategorySchema.safeParse(body);

            if (!validationResult.success) {
                return c.json(serializeError({
                    status: '400',
                    title: 'Validation Error',
                    detail: "Invalid request body for creating category",
                    meta: { errors: validationResult.error.flatten().fieldErrors }
                }), 400);
            }

            // Check if category with same name already exists
            const existingCategory = await Category.findByName(validationResult.data.name);
            if (existingCategory) {
                return c.json(serializeError({
                    status: '409',
                    title: 'Conflict',
                    detail: 'A category with this name already exists'
                }), 409);
            }

            const category = await Category.create(validationResult.data);
            return c.json(serializeResource('category', category.toJSON()), 201);
        } catch (error: any) {
            console.error("[CONTROLLER_ADMIN_CATEGORIES] Error creating category:", error);
            if (error instanceof APIError) throw error;
            throw new APIError(error.statusCode || 500, error.message || "Error creating category", error.errorCode);
        }
    }

    static async updateCategory(c: Context): Promise<Response> {
        try {
            // TODO: MIGRATE_MIDDLEWARE - This relies on 'c.get('user')' which comes from requireAuth/validateAdmin middleware
            const user = c.get('user') as { id: string } | undefined;
            if (!user || !user.id) {
                throw new APIError(401, 'Unauthorized', 'Admin privileges required.');
            }

            const categoryId = c.req.param('categoryId');
            if (!categoryId) {
                return c.json(serializeError({
                    status: '400',
                    title: 'Bad Request',
                    detail: 'Category ID is required'
                }), 400);
            }

            const body = await c.req.json();
            const validationResult = updateCategorySchema.safeParse(body);

            if (!validationResult.success) {
                return c.json(serializeError({
                    status: '400',
                    title: 'Validation Error',
                    detail: "Invalid request body for updating category",
                    meta: { errors: validationResult.error.flatten().fieldErrors }
                }), 400);
            }

            // Check if category exists
            const existingCategory = await Category.findById(categoryId);
            if (!existingCategory) {
                return c.json(serializeError({
                    status: '404',
                    title: 'Not Found',
                    detail: 'Category not found'
                }), 404);
            }

            // Check if new name conflicts with existing category (if name is being changed)
            if (validationResult.data.name && validationResult.data.name !== existingCategory.name) {
                const categoryWithSameName = await Category.findByName(validationResult.data.name);
                if (categoryWithSameName) {
                    return c.json(serializeError({
                        status: '409',
                        title: 'Conflict',
                        detail: 'A category with this name already exists'
                    }), 409);
                }
            }

            const updatedCategory = await Category.update(categoryId, validationResult.data);
            return c.json(serializeResource('category', updatedCategory.toJSON()), 200);
        } catch (error: any) {
            console.error("[CONTROLLER_ADMIN_CATEGORIES] Error updating category:", error);
            if (error instanceof APIError) throw error;
            throw new APIError(error.statusCode || 500, error.message || "Error updating category", error.errorCode);
        }
    }

    static async deleteCategory(c: Context): Promise<Response> {
        try {
            // TODO: MIGRATE_MIDDLEWARE - This relies on 'c.get('user')' which comes from requireAuth/validateAdmin middleware
            const user = c.get('user') as { id: string } | undefined;
            if (!user || !user.id) {
                throw new APIError(401, 'Unauthorized', 'Admin privileges required.');
            }

            const categoryId = c.req.param('categoryId');
            if (!categoryId) {
                return c.json(serializeError({
                    status: '400',
                    title: 'Bad Request',
                    detail: 'Category ID is required'
                }), 400);
            }

            const category = await Category.findById(categoryId);
            if (!category) {
                return c.json(serializeError({
                    status: '404',
                    title: 'Not Found',
                    detail: 'Category not found'
                }), 404);
            }

            await category.delete();
            return c.json({ message: 'Category deleted successfully' }, 200);
        } catch (error: any) {
            console.error("[CONTROLLER_ADMIN_CATEGORIES] Error deleting category:", error);
            if (error instanceof APIError) throw error;
            throw new APIError(error.statusCode || 500, error.message || "Error deleting category", error.errorCode);
        }
    }

    static async getPublisherSelectableCategories(c: Context): Promise<Response> {
        try {
            const categories = await Category.findPublisherSelectable();
            return c.json(serializeResource('categories', categories.map(cat => cat.toJSON())), 200);
        } catch (error: any) {
            console.error("[CONTROLLER_ADMIN_CATEGORIES] Error getting publisher selectable categories:", error);
            if (error instanceof APIError) throw error;
            throw new APIError(500, "Error getting publisher selectable categories", error.message);
        }
    }

    static async getPrimaryAllowedCategories(c: Context): Promise<Response> {
        try {
            const categories = await Category.findPrimaryAllowed();
            return c.json(serializeResource('categories', categories.map(cat => cat.toJSON())), 200);
        } catch (error: any) {
            console.error("[CONTROLLER_ADMIN_CATEGORIES] Error getting primary allowed categories:", error);
            if (error instanceof APIError) throw error;
            throw new APIError(500, "Error getting primary allowed categories", error.message);
        }
    }
}