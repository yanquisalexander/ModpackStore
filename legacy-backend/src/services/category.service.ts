import { AppDataSource } from "../db/data-source";
import { Category } from "../entities/Category";
import { ModpackCategory } from "../entities/ModpackCategory";
import { Repository } from "typeorm";

export interface CreateCategoryData {
    name: string;
    shortDescription?: string;
    description?: string;
    iconUrl?: string;
    displayOrder?: number;
    isAdminOnly?: boolean;
    isSelectable?: boolean;
    isAutomatic?: boolean;
}

export interface UpdateCategoryData {
    name?: string;
    shortDescription?: string;
    description?: string;
    iconUrl?: string;
    displayOrder?: number;
    isAdminOnly?: boolean;
    isSelectable?: boolean;
    isAutomatic?: boolean;
}

export interface CategoryListOptions {
    includeAdminOnly?: boolean;
    onlySelectable?: boolean;
    includeAutomatic?: boolean;
}

export class CategoryService {
    private categoryRepository: Repository<Category>;
    private modpackCategoryRepository: Repository<ModpackCategory>;

    constructor() {
        this.categoryRepository = AppDataSource.getRepository(Category);
        this.modpackCategoryRepository = AppDataSource.getRepository(ModpackCategory);
    }

    /**
     * Create a new category
     */
    async createCategory(data: CreateCategoryData): Promise<Category> {
        // Check if category with this name already exists
        const existing = await this.categoryRepository.findOne({
            where: { name: data.name }
        });

        if (existing) {
            throw new Error(`Category with name "${data.name}" already exists`);
        }

        const category = this.categoryRepository.create({
            name: data.name,
            shortDescription: data.shortDescription,
            description: data.description,
            iconUrl: data.iconUrl,
            displayOrder: data.displayOrder || 0,
            isAdminOnly: data.isAdminOnly || false,
            isSelectable: data.isSelectable !== false, // Default to true
            isAutomatic: data.isAutomatic || false
        });

        return await this.categoryRepository.save(category);
    }

    /**
     * Get category by ID
     */
    async getCategoryById(id: string): Promise<Category | null> {
        return await this.categoryRepository.findOne({
            where: { id },
            relations: ["modpacks", "modpacks.modpack"]
        });
    }

    /**
     * Get category by name
     */
    async getCategoryByName(name: string): Promise<Category | null> {
        return await this.categoryRepository.findOne({
            where: { name }
        });
    }

    /**
     * Get all categories with filtering options
     */
    async getAllCategories(options: CategoryListOptions = {}): Promise<Category[]> {
        const queryBuilder = this.categoryRepository.createQueryBuilder("category");

        // Apply filters
        if (!options.includeAdminOnly) {
            queryBuilder.andWhere("category.isAdminOnly = :isAdminOnly", { isAdminOnly: false });
        }

        if (options.onlySelectable) {
            queryBuilder.andWhere("category.isSelectable = :isSelectable", { isSelectable: true });
        }

        if (!options.includeAutomatic) {
            queryBuilder.andWhere("category.isAutomatic = :isAutomatic", { isAutomatic: false });
        }

        // Order by display order and then by name
        queryBuilder.orderBy("category.displayOrder", "ASC")
                    .addOrderBy("category.name", "ASC");

        return await queryBuilder.getMany();
    }

    /**
     * Update a category
     */
    async updateCategory(id: string, data: UpdateCategoryData): Promise<Category> {
        const category = await this.categoryRepository.findOne({ where: { id } });
        
        if (!category) {
            throw new Error("Category not found");
        }

        // Check for name conflicts if name is being updated
        if (data.name && data.name !== category.name) {
            const existing = await this.categoryRepository.findOne({
                where: { name: data.name }
            });

            if (existing) {
                throw new Error(`Category with name "${data.name}" already exists`);
            }
        }

        // Update fields
        Object.assign(category, data);

        return await this.categoryRepository.save(category);
    }

    /**
     * Delete a category
     */
    async deleteCategory(id: string): Promise<void> {
        const category = await this.categoryRepository.findOne({
            where: { id },
            relations: ["modpacks"]
        });

        if (!category) {
            throw new Error("Category not found");
        }

        // Check if category is in use
        if (category.modpacks && category.modpacks.length > 0) {
            throw new Error("Cannot delete category that is assigned to modpacks");
        }

        await this.categoryRepository.remove(category);
    }

    /**
     * Get categories for publisher selection (excludes admin-only and automatic)
     */
    async getCategoriesForPublishers(): Promise<Category[]> {
        return await this.getAllCategories({
            includeAdminOnly: false,
            onlySelectable: true,
            includeAutomatic: false
        });
    }

    /**
     * Get categories for admin management (includes all)
     */
    async getCategoriesForAdmin(): Promise<Category[]> {
        return await this.getAllCategories({
            includeAdminOnly: true,
            includeAutomatic: true
        });
    }

    /**
     * Assign category to modpack
     */
    async assignCategoryToModpack(modpackId: string, categoryId: string, isPrimary: boolean = false): Promise<ModpackCategory> {
        // Check if assignment already exists
        const existing = await this.modpackCategoryRepository.findOne({
            where: {
                modpackId,
                categoryId
            }
        });

        if (existing) {
            // Update if needed
            if (existing.isPrimary !== isPrimary) {
                existing.isPrimary = isPrimary;
                return await this.modpackCategoryRepository.save(existing);
            }
            return existing;
        }

        // If this is a primary category, ensure no other primary exists for this modpack
        if (isPrimary) {
            await this.modpackCategoryRepository.update(
                { modpackId },
                { isPrimary: false }
            );
        }

        const modpackCategory = this.modpackCategoryRepository.create({
            modpackId,
            categoryId,
            isPrimary
        });

        return await this.modpackCategoryRepository.save(modpackCategory);
    }

    /**
     * Remove category from modpack
     */
    async removeCategoryFromModpack(modpackId: string, categoryId: string): Promise<void> {
        await this.modpackCategoryRepository.delete({
            modpackId,
            categoryId
        });
    }

    /**
     * Set primary category for modpack
     */
    async setPrimaryCategory(modpackId: string, categoryId: string): Promise<void> {
        // Remove primary flag from all categories for this modpack
        await this.modpackCategoryRepository.update(
            { modpackId },
            { isPrimary: false }
        );

        // Set the new primary category
        await this.assignCategoryToModpack(modpackId, categoryId, true);
    }

    /**
     * Get modpack categories with details
     */
    async getModpackCategories(modpackId: string): Promise<ModpackCategory[]> {
        return await this.modpackCategoryRepository.find({
            where: { modpackId },
            relations: ["category"],
            order: { isPrimary: "DESC", category: { displayOrder: "ASC" } }
        });
    }

    /**
     * Get modpack primary category
     */
    async getModpackPrimaryCategory(modpackId: string): Promise<Category | null> {
        const modpackCategory = await this.modpackCategoryRepository.findOne({
            where: { modpackId, isPrimary: true },
            relations: ["category"]
        });

        return modpackCategory?.category || null;
    }

    /**
     * Reorder categories
     */
    async reorderCategories(categoryOrders: { id: string; displayOrder: number }[]): Promise<void> {
        for (const { id, displayOrder } of categoryOrders) {
            await this.categoryRepository.update(id, { displayOrder });
        }
    }

    /**
     * Create default/automatic categories if they don't exist
     */
    async ensureDefaultCategories(): Promise<void> {
        const defaultCategories = [
            {
                name: "Nuevos modpacks",
                shortDescription: "Modpacks recientemente publicados",
                isAutomatic: true,
                isAdminOnly: true,
                isSelectable: false,
                displayOrder: 100
            },
            {
                name: "Uncategorized",
                shortDescription: "Modpacks sin categoría asignada",
                isAutomatic: true,
                isAdminOnly: true,
                isSelectable: false,
                displayOrder: 999
            }
        ];

        for (const categoryData of defaultCategories) {
            const existing = await this.getCategoryByName(categoryData.name);
            if (!existing) {
                await this.createCategory(categoryData);
            }
        }
    }
}