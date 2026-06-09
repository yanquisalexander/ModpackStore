import { Context } from "hono";
import { CategoryService, CreateCategoryData, UpdateCategoryData } from "../services/category.service";
import { 
    CreateCategoryRequest, 
    UpdateCategoryRequest, 
    AssignCategoryRequest,
    ReorderCategoriesRequest,
    CategoryQueryParams 
} from "../validators/category.validators";

export class CategoryController {
    private static categoryService = new CategoryService();

    /**
     * Get all categories (for admin)
     */
    static async getAllCategories(c: Context) {
        try {
            const query = c.req.valid('query') as CategoryQueryParams;
            
            const categories = await CategoryController.categoryService.getAllCategories({
                includeAdminOnly: query.includeAdminOnly,
                onlySelectable: query.onlySelectable,
                includeAutomatic: query.includeAutomatic
            });

            return c.json({
                success: true,
                data: categories,
                meta: {
                    total: categories.length
                }
            });
        } catch (error) {
            console.error('Error getting categories:', error);
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Failed to get categories'
            }, 500);
        }
    }

    /**
     * Get categories for publishers (excludes admin-only)
     */
    static async getCategoriesForPublishers(c: Context) {
        try {
            const categories = await CategoryController.categoryService.getCategoriesForPublishers();

            return c.json({
                success: true,
                data: categories,
                meta: {
                    total: categories.length
                }
            });
        } catch (error) {
            console.error('Error getting publisher categories:', error);
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Failed to get categories'
            }, 500);
        }
    }

    /**
     * Get category by ID
     */
    static async getCategoryById(c: Context) {
        try {
            const categoryId = c.req.param('categoryId');
            
            if (!categoryId) {
                return c.json({
                    success: false,
                    error: 'Category ID is required'
                }, 400);
            }

            const category = await CategoryController.categoryService.getCategoryById(categoryId);

            if (!category) {
                return c.json({
                    success: false,
                    error: 'Category not found'
                }, 404);
            }

            return c.json({
                success: true,
                data: category
            });
        } catch (error) {
            console.error('Error getting category:', error);
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Failed to get category'
            }, 500);
        }
    }

    /**
     * Create a new category
     */
    static async createCategory(c: Context) {
        try {
            const data = c.req.valid('json') as CreateCategoryRequest;

            const categoryData: CreateCategoryData = {
                name: data.name,
                shortDescription: data.shortDescription || undefined,
                description: data.description || undefined,
                iconUrl: data.iconUrl || undefined,
                displayOrder: data.displayOrder || 0,
                isAdminOnly: data.isAdminOnly || false,
                isSelectable: data.isSelectable !== false,
                isAutomatic: data.isAutomatic || false
            };

            const category = await CategoryController.categoryService.createCategory(categoryData);

            return c.json({
                success: true,
                data: category,
                message: 'Category created successfully'
            }, 201);
        } catch (error) {
            console.error('Error creating category:', error);
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Failed to create category'
            }, 400);
        }
    }

    /**
     * Update a category
     */
    static async updateCategory(c: Context) {
        try {
            const categoryId = c.req.param('categoryId');
            const data = c.req.valid('json') as UpdateCategoryRequest;

            if (!categoryId) {
                return c.json({
                    success: false,
                    error: 'Category ID is required'
                }, 400);
            }

            const updateData: UpdateCategoryData = {};
            
            // Only include fields that are provided
            if (data.name !== undefined) updateData.name = data.name;
            if (data.shortDescription !== undefined) updateData.shortDescription = data.shortDescription || undefined;
            if (data.description !== undefined) updateData.description = data.description || undefined;
            if (data.iconUrl !== undefined) updateData.iconUrl = data.iconUrl || undefined;
            if (data.displayOrder !== undefined) updateData.displayOrder = data.displayOrder;
            if (data.isAdminOnly !== undefined) updateData.isAdminOnly = data.isAdminOnly;
            if (data.isSelectable !== undefined) updateData.isSelectable = data.isSelectable;
            if (data.isAutomatic !== undefined) updateData.isAutomatic = data.isAutomatic;

            const category = await CategoryController.categoryService.updateCategory(categoryId, updateData);

            return c.json({
                success: true,
                data: category,
                message: 'Category updated successfully'
            });
        } catch (error) {
            console.error('Error updating category:', error);
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Failed to update category'
            }, 400);
        }
    }

    /**
     * Delete a category
     */
    static async deleteCategory(c: Context) {
        try {
            const categoryId = c.req.param('categoryId');

            if (!categoryId) {
                return c.json({
                    success: false,
                    error: 'Category ID is required'
                }, 400);
            }

            await CategoryController.categoryService.deleteCategory(categoryId);

            return c.json({
                success: true,
                message: 'Category deleted successfully'
            });
        } catch (error) {
            console.error('Error deleting category:', error);
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Failed to delete category'
            }, 400);
        }
    }

    /**
     * Reorder categories
     */
    static async reorderCategories(c: Context) {
        try {
            const data = c.req.valid('json') as ReorderCategoriesRequest;

            await CategoryController.categoryService.reorderCategories(data.categories);

            return c.json({
                success: true,
                message: 'Categories reordered successfully'
            });
        } catch (error) {
            console.error('Error reordering categories:', error);
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Failed to reorder categories'
            }, 400);
        }
    }

    /**
     * Assign category to modpack
     */
    static async assignCategoryToModpack(c: Context) {
        try {
            const modpackId = c.req.param('modpackId');
            const data = c.req.valid('json') as AssignCategoryRequest;

            if (!modpackId) {
                return c.json({
                    success: false,
                    error: 'Modpack ID is required'
                }, 400);
            }

            const modpackCategory = await CategoryController.categoryService.assignCategoryToModpack(
                modpackId,
                data.categoryId,
                data.isPrimary
            );

            return c.json({
                success: true,
                data: modpackCategory,
                message: 'Category assigned to modpack successfully'
            });
        } catch (error) {
            console.error('Error assigning category to modpack:', error);
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Failed to assign category'
            }, 400);
        }
    }

    /**
     * Remove category from modpack
     */
    static async removeCategoryFromModpack(c: Context) {
        try {
            const modpackId = c.req.param('modpackId');
            const categoryId = c.req.param('categoryId');

            if (!modpackId || !categoryId) {
                return c.json({
                    success: false,
                    error: 'Modpack ID and Category ID are required'
                }, 400);
            }

            await CategoryController.categoryService.removeCategoryFromModpack(modpackId, categoryId);

            return c.json({
                success: true,
                message: 'Category removed from modpack successfully'
            });
        } catch (error) {
            console.error('Error removing category from modpack:', error);
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Failed to remove category'
            }, 400);
        }
    }

    /**
     * Set primary category for modpack
     */
    static async setPrimaryCategory(c: Context) {
        try {
            const modpackId = c.req.param('modpackId');
            const data = c.req.valid('json') as AssignCategoryRequest;

            if (!modpackId) {
                return c.json({
                    success: false,
                    error: 'Modpack ID is required'
                }, 400);
            }

            await CategoryController.categoryService.setPrimaryCategory(modpackId, data.categoryId);

            return c.json({
                success: true,
                message: 'Primary category set successfully'
            });
        } catch (error) {
            console.error('Error setting primary category:', error);
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Failed to set primary category'
            }, 400);
        }
    }

    /**
     * Get modpack categories
     */
    static async getModpackCategories(c: Context) {
        try {
            const modpackId = c.req.param('modpackId');

            if (!modpackId) {
                return c.json({
                    success: false,
                    error: 'Modpack ID is required'
                }, 400);
            }

            const categories = await CategoryController.categoryService.getModpackCategories(modpackId);

            return c.json({
                success: true,
                data: categories,
                meta: {
                    total: categories.length,
                    primary: categories.find(cat => cat.isPrimary)?.category || null
                }
            });
        } catch (error) {
            console.error('Error getting modpack categories:', error);
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Failed to get modpack categories'
            }, 500);
        }
    }

    /**
     * Initialize default categories
     */
    static async initializeDefaultCategories(c: Context) {
        try {
            await CategoryController.categoryService.ensureDefaultCategories();

            return c.json({
                success: true,
                message: 'Default categories initialized successfully'
            });
        } catch (error) {
            console.error('Error initializing default categories:', error);
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Failed to initialize default categories'
            }, 500);
        }
    }
}