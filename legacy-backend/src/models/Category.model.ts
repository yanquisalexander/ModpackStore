import { z } from "zod";
import { client as db } from "@/db/client";
import { CategoriesTable } from "@/db/schema";
import { eq } from "drizzle-orm";

// Tipos inferidos del schema
type CategoryInsert = typeof CategoriesTable.$inferInsert;
type CategorySelect = typeof CategoriesTable.$inferSelect;

// Esquemas de validación
export const createCategorySchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
  shortDescription: z.string().max(200, "Short description too long").optional(),
  description: z.string().max(1000, "Description too long").optional(),
  iconUrl: z.string().url("Invalid icon URL").optional(),
});

export const updateCategorySchema = createCategorySchema.partial();

export class Category {
  readonly id: string;
  name: string;
  shortDescription: string | null;
  description: string | null;
  iconUrl: string | null;
  readonly createdAt: Date;

  constructor(data: CategorySelect) {
    this.id = data.id;
    this.name = data.name;
    this.shortDescription = data.shortDescription;
    this.description = data.description;
    this.iconUrl = data.iconUrl;
    this.createdAt = data.createdAt;
  }

  // Static method for creation
  static async create(data: z.infer<typeof createCategorySchema>): Promise<Category> {
    // Using safeParse for better error handling if needed, though parse throws and can be caught upstream.
    const validationResult = createCategorySchema.safeParse(data);
    if (!validationResult.success) {
      // Or handle error more specifically, e.g., throw new CustomValidationError(...)
      throw new Error(`Invalid category data: ${JSON.stringify(validationResult.error.format())}`);
    }

    const [insertedRecord] = await db
      .insert(CategoriesTable)
      .values(validationResult.data)
      .returning();

    if (!insertedRecord) {
        throw new Error("Failed to create category: No record returned.");
    }
    return new Category(insertedRecord);
  }

  // Static method for finding by ID
  static async findById(id: string): Promise<Category | null> {
    if (!id?.trim()) return null;
    try {
      const [record] = await db
        .select()
        .from(CategoriesTable)
        .where(eq(CategoriesTable.id, id));
      return record ? new Category(record) : null;
    } catch (error) {
      console.error(`Error finding category by ID ${id}:`, error);
      return null; // Or throw, depending on desired error handling strategy
    }
  }

  // Static method for finding by name
  static async findByName(name: string): Promise<Category | null> {
    if (!name?.trim()) return null;
    try {
      const [record] = await db
        .select()
        .from(CategoriesTable)
        .where(eq(CategoriesTable.name, name));
      return record ? new Category(record) : null;
    } catch (error)
    {
      console.error(`Error finding category by name ${name}:`, error);
      return null;
    }
  }

  // Static method for finding all categories
  static async findAll(): Promise<Category[]> {
    try {
      const records = await db.select().from(CategoriesTable);
      return records.map(record => new Category(record));
    } catch (error) {
      console.error("Error finding all categories:", error);
      return [];
    }
  }

  // Static method for updates
  static async update(id: string, data: z.infer<typeof updateCategorySchema>): Promise<Category> {
    const validationResult = updateCategorySchema.safeParse(data);
    if (!validationResult.success) {
      throw new Error(`Invalid category update data: ${JSON.stringify(validationResult.error.format())}`);
    }
    if (Object.keys(validationResult.data).length === 0) {
      // If there's nothing to update after validation (e.g. empty object passed)
      // Depending on desired behavior, either throw error or return current state
      const currentCategory = await Category.findById(id);
      if (!currentCategory) throw new Error("Category not found for update with empty payload.");
      return currentCategory;
    }

    const [updatedRecord] = await db
      .update(CategoriesTable)
      .set(validationResult.data)
      .where(eq(CategoriesTable.id, id))
      .returning();

    if (!updatedRecord) {
      throw new Error("Category not found or update failed.");
    }
    return new Category(updatedRecord);
  }

  // Instance method for saving
  async save(): Promise<Category> {
    const dataToSave: z.infer<typeof updateCategorySchema> = {
      name: this.name,
      shortDescription: this.shortDescription ?? undefined,
      description: this.description ?? undefined,
      iconUrl: this.iconUrl ?? undefined,
    };

    const updatedCategory = await Category.update(this.id, dataToSave);
    // Update current instance properties
    this.name = updatedCategory.name;
    this.shortDescription = updatedCategory.shortDescription;
    this.description = updatedCategory.description;
    this.iconUrl = updatedCategory.iconUrl;
    // Note: `id` and `createdAt` are readonly and should not change.
    return this;
  }

  // Instance method for deletion
  async delete(): Promise<void> {
    try {
      await db
        .delete(CategoriesTable)
        .where(eq(CategoriesTable.id, this.id));
    } catch (error) {
      console.error(`Failed to delete category ${this.id}:`, error);
      throw new Error(`Failed to delete category: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Instance method to check existence (uses its own ID)
  async exists(): Promise<boolean> {
    try {
      const [category] = await db
        .select({ id: CategoriesTable.id })
        .from(CategoriesTable)
        .where(eq(CategoriesTable.id, this.id));
      return !!category;
    } catch (error) {
      console.error(`Error checking existence for category ${this.id}:`, error);
      return false; // Or throw
    }
  }

  // Serialization for JSON
  toJSON(): CategorySelect {
    return {
      id: this.id,
      name: this.name,
      shortDescription: this.shortDescription,
      description: this.description,
      iconUrl: this.iconUrl,
      createdAt: this.createdAt,
    };
  }

  // Serialization for public API
  toPublic() {
    // For Category, toJSON and toPublic might be the same if no sensitive fields.
    return this.toJSON();
  }
}