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
  private data: CategorySelect;

  constructor(data: CategorySelect) {
    this.data = data;
  }

  // Getters para acceso a propiedades
  get id() { return this.data.id; }
  get name() { return this.data.name; }
  get shortDescription() { return this.data.shortDescription; }
  get description() { return this.data.description; }
  get iconUrl() { return this.data.iconUrl; }
  get createdAt() { return this.data.createdAt; }

  // Crear nueva categoría
  static async create(data: z.infer<typeof createCategorySchema>): Promise<Category> {
    const parsed = createCategorySchema.parse(data);

    const [inserted] = await db
      .insert(CategoriesTable)
      .values(parsed)
      .returning();

    return new Category(inserted);
  }

  // Buscar por ID
  static async findById(id: string): Promise<Category | null> {
    const [category] = await db
      .select()
      .from(CategoriesTable)
      .where(eq(CategoriesTable.id, id));

    return category ? new Category(category) : null;
  }

  // Buscar por slug/nombre
  static async findByName(name: string): Promise<Category | null> {
    const [category] = await db
      .select()
      .from(CategoriesTable)
      .where(eq(CategoriesTable.name, name));

    return category ? new Category(category) : null;
  }

  // Obtener todas las categorías
  static async findAll(): Promise<Category[]> {
    const categories = await db.select().from(CategoriesTable);
    return categories.map(cat => new Category(cat));
  }

  // Actualizar categoría
  async update(data: z.infer<typeof updateCategorySchema>): Promise<Category> {
    const parsed = updateCategorySchema.parse(data);

    const [updated] = await db
      .update(CategoriesTable)
      .set(parsed)
      .where(eq(CategoriesTable.id, this.data.id))
      .returning();

    this.data = updated;
    return this;
  }

  // Eliminar categoría
  async delete(): Promise<void> {
    await db
      .delete(CategoriesTable)
      .where(eq(CategoriesTable.id, this.data.id));
  }

  // Verificar si existe
  async exists(): Promise<boolean> {
    const [category] = await db
      .select({ id: CategoriesTable.id })
      .from(CategoriesTable)
      .where(eq(CategoriesTable.id, this.data.id));

    return !!category;
  }

  // Serializar para JSON
  toJSON(): CategorySelect {
    return { ...this.data };
  }

  // Serializar para API pública (sin campos sensibles si los hubiera)
  toPublic() {
    return {
      id: this.data.id,
      name: this.data.name,
      shortDescription: this.data.shortDescription,
      description: this.data.description,
      iconUrl: this.data.iconUrl,
      createdAt: this.data.createdAt,
    };
  }
}