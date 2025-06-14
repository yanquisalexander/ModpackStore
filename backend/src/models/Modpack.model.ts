// src/models/Modpack.model.ts
import { z } from "zod";
import { client as db } from "@/db/client";
import { eq, and, desc } from "drizzle-orm";
import {
    ModpacksTable,
    ModpackVersionsTable,
    ModpackCategoriesTable,
    PublishersTable,
    UsersTable,
    CategoriesTable
} from "@/db/schema";

// Types
type ModpackType = typeof ModpacksTable.$inferSelect;
type NewModpack = typeof ModpacksTable.$inferInsert;
// ModpackUpdateData is now inferred from modpackUpdateSchema

// Enums
export enum ModpackVisibility {
    PUBLIC = 'public',
    PRIVATE = 'private',
    PATREON = 'patreon'
}

export enum ModpackStatus {
	DRAFT = 'draft',
	PUBLISHED = 'published',
	ARCHIVED = 'archived',
	DELETED = 'deleted',
}

// Validation schemas
export const newModpackSchema = z.object({
    name: z.string().min(1).max(100),
    shortDescription: z.string().max(200).optional(),
    description: z.string().optional(),
    slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/),
    iconUrl: z.string().url(),
    bannerUrl: z.string().url(),
    trailerUrl: z.string().url().optional(),
    password: z.string().optional(),
    visibility: z.nativeEnum(ModpackVisibility),
    status: z.nativeEnum(ModpackStatus).default(ModpackStatus.DRAFT).optional(),
    publisherId: z.string().uuid(),
    showUserAsPublisher: z.boolean().default(false),
    creatorUserId: z.string().uuid().optional(),
});

export const modpackUpdateSchema = newModpackSchema.omit({ slug: true }).partial().extend({
    status: z.nativeEnum(ModpackStatus).optional(),
});

export class Modpack {
    readonly id: string;
    readonly slug: string;
    readonly publisherId: string;
    readonly createdAt: Date;

    name: string;
    shortDescription: string | null;
    description: string | null;
    iconUrl: string;
    bannerUrl: string;
    trailerUrl: string | null;
    password: string | null;
    visibility: ModpackVisibility;
    status: ModpackStatus;
    showUserAsPublisher: boolean;
    creatorUserId: string | null;
    updatedAt: Date;

    // Cached relations
    private _latestVersion?: any;
    private _categories?: any[];

    constructor(data: ModpackType) {
        // Immutable fields
        this.id = data.id;
        this.slug = data.slug;
        this.publisherId = data.publisherId;
        this.createdAt = data.createdAt;

        // Mutable fields
        this.name = data.name;
        this.shortDescription = data.shortDescription;
        this.description = data.description;
        this.iconUrl = data.iconUrl;
        this.bannerUrl = data.bannerUrl;
        this.trailerUrl = data.trailerUrl;
        this.password = data.password;
        this.visibility = data.visibility as ModpackVisibility;
        this.status = data.status as ModpackStatus;
        this.showUserAsPublisher = data.showUserAsPublisher ?? false;
        this.creatorUserId = data.creatorUserId;
        this.updatedAt = data.updatedAt;
    }

    // Static factory methods
    static async create(data: z.infer<typeof newModpackSchema>): Promise<Modpack> {
        const parsed = newModpackSchema.safeParse(data);
        if (!parsed.success) {
            throw new Error(`Invalid modpack data: ${JSON.stringify(parsed.error.format())}`);
        }

        // Check if slug is already taken
        const existingModpack = await Modpack.findBySlug(parsed.data.slug);
        if (existingModpack) {
            throw new Error(`Modpack with slug '${parsed.data.slug}' already exists`);
        }

        const now = new Date();

        try {
            const [inserted] = await db
                .insert(ModpacksTable)
                .values({
                    ...parsed.data,
                    createdAt: now,
                    updatedAt: now,
                })
                .returning();

            return new Modpack(inserted);
        } catch (error) {
            throw new Error(`Failed to create modpack: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    // Query methods
    static async findById(id: string): Promise<Modpack | null> {
        if (!id?.trim()) return null;

        try {
            const [modpack] = await db.select().from(ModpacksTable).where(eq(ModpacksTable.id, id));
            return modpack ? new Modpack(modpack) : null;
        } catch (error) {
            console.error(`Error finding modpack by ID ${id}:`, error);
            return null;
        }
    }

    static async findBySlug(slug: string): Promise<Modpack | null> {
        if (!slug?.trim()) return null;

        try {
            const [modpack] = await db.select().from(ModpacksTable).where(eq(ModpacksTable.slug, slug));
            return modpack ? new Modpack(modpack) : null;
        } catch (error) {
            console.error(`Error finding modpack by slug ${slug}:`, error);
            return null;
        }
    }

    static async findByPublisher(publisherId: string, limit = 20, offset = 0): Promise<Modpack[]> {
        if (!publisherId?.trim()) return [];

        try {
            const modpacks = await db
                .select()
                .from(ModpacksTable)
                .where(eq(ModpacksTable.publisherId, publisherId))
                .orderBy(desc(ModpacksTable.updatedAt))
                .limit(limit)
                .offset(offset);

            return modpacks.map(modpack => new Modpack(modpack));
        } catch (error) {
            console.error(`Error finding modpacks by publisher ${publisherId}:`, error);
            return [];
        }
    }

    static async findPublic(limit = 20, offset = 0): Promise<Modpack[]> {
        try {
            const modpacks = await db
                .select()
                .from(ModpacksTable)
                .where(eq(ModpacksTable.visibility, ModpackVisibility.PUBLIC))
                .orderBy(desc(ModpacksTable.updatedAt))
                .limit(limit)
                .offset(offset);

            return modpacks.map(modpack => new Modpack(modpack));
        } catch (error) {
            console.error("Error finding public modpacks:", error);
            return [];
        }
    }

    static async getCompleteModpack(id: string) {
        if (!id?.trim()) return null;

        try {
            const modpack = await db.query.ModpacksTable.findFirst({
                where: eq(ModpacksTable.id, id),
                with: {
                    publisher: true,
                    creatorUser: true,
                    categories: {
                        with: {
                            category: true
                        }
                    },
                    versions: {
                        orderBy: desc(ModpackVersionsTable.createdAt),
                        limit: 10,
                        with: {
                            createdByUser: true,
                            files: true
                        }
                    }
                }
            });
            return modpack ?? null;
        } catch (error) {
            console.error(`Error getting complete modpack ${id}:`, error);
            return null;
        }
    }

    // Static method for updates
    static async update(id: string, data: z.infer<typeof modpackUpdateSchema>): Promise<Modpack> {
        const parsedData = modpackUpdateSchema.safeParse(data);
        if (!parsedData.success) {
            throw new Error(`Invalid modpack update data: ${JSON.stringify(parsedData.error.format())}`);
        }

        const updatePayload = {
            ...parsedData.data,
            updatedAt: new Date(),
        };

        try {
            const [updatedModpackRecord] = await db
                .update(ModpacksTable)
                .set(updatePayload)
                .where(eq(ModpacksTable.id, id))
                .returning();

            if (!updatedModpackRecord) {
                throw new Error("Modpack not found or update failed");
            }
            return new Modpack(updatedModpackRecord);
        } catch (error) {
            console.error(`Failed to update modpack ${id}:`, error);
            throw new Error(`Failed to update modpack: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    // Instance methods
    async save(): Promise<Modpack> {
        const dataToSave: z.infer<typeof modpackUpdateSchema> = {
            name: this.name,
            shortDescription: this.shortDescription ?? undefined,
            description: this.description ?? undefined,
            iconUrl: this.iconUrl,
            bannerUrl: this.bannerUrl,
            trailerUrl: this.trailerUrl ?? undefined,
            password: this.password ?? undefined,
            visibility: this.visibility,
            status: this.status,
            publisherId: this.publisherId, // publisherId is part of newModpackSchema, so it's in modpackUpdateSchema
            showUserAsPublisher: this.showUserAsPublisher,
            creatorUserId: this.creatorUserId ?? undefined,
        };

        // Note: slug is not part of modpackUpdateSchema, so it's not included in dataToSave.

        const updatedModpack = await Modpack.update(this.id, dataToSave);
        // Update current instance properties from the successfully saved modpack data
        Object.assign(this, updatedModpack);
        return this;
    }

    async delete(): Promise<void> {
        try {
            // Soft delete by updating status using the new static update method
            const updatedModpack = await Modpack.update(this.id, { status: ModpackStatus.DELETED });
            this.status = updatedModpack.status;
            this.updatedAt = updatedModpack.updatedAt;
        } catch (error) {
            throw new Error(`Failed to delete modpack: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    async getVersions(limit = 10, offset = 0) {
        try {
            const versions = await db
                .select()
                .from(ModpackVersionsTable)
                .where(eq(ModpackVersionsTable.modpackId, this.id))
                .orderBy(desc(ModpackVersionsTable.createdAt))
                .limit(limit)
                .offset(offset);

            return versions;
        } catch (error) {
            console.error(`Error getting versions for modpack ${this.id}:`, error);
            return [];
        }
    }

    async getLatestVersion() {
        if (this._latestVersion) {
            return this._latestVersion;
        }

        try {
            const [version] = await db
                .select()
                .from(ModpackVersionsTable)
                .where(eq(ModpackVersionsTable.modpackId, this.id))
                .orderBy(desc(ModpackVersionsTable.createdAt))
                .limit(1);

            this._latestVersion = version || null;
            return this._latestVersion;
        } catch (error) {
            console.error(`Error getting latest version for modpack ${this.id}:`, error);
            return null;
        }
    }

    async getCategories() {
        if (this._categories) {
            return this._categories;
        }

        try {
            const categories = await db
                .select({
                    id: CategoriesTable.id,
                    name: CategoriesTable.name,
                    shortDescription: CategoriesTable.shortDescription,
                    description: CategoriesTable.description,
                    iconUrl: CategoriesTable.iconUrl,
                })
                .from(ModpackCategoriesTable)
                .innerJoin(CategoriesTable, eq(ModpackCategoriesTable.categoryId, CategoriesTable.id))
                .where(eq(ModpackCategoriesTable.modpackId, this.id));

            this._categories = categories;
            return this._categories;
        } catch (error) {
            console.error(`Error getting categories for modpack ${this.id}:`, error);
            return [];
        }
    }

    async addCategory(categoryId: string): Promise<void> {
        try {
            await db.insert(ModpackCategoriesTable).values({
                modpackId: this.id,
                categoryId: categoryId,
            });
            this._categories = undefined; // Clear cache
        } catch (error) {
            throw new Error(`Failed to add category: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    async removeCategory(categoryId: string): Promise<void> {
        try {
            await db.delete(ModpackCategoriesTable).where(
                and(
                    eq(ModpackCategoriesTable.modpackId, this.id),
                    eq(ModpackCategoriesTable.categoryId, categoryId)
                )
            );
            this._categories = undefined; // Clear cache
        } catch (error) {
            throw new Error(`Failed to remove category: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    // Business logic methods
    isPublic(): boolean {
        return this.visibility === ModpackVisibility.PUBLIC;
    }

    isPrivate(): boolean {
        return this.visibility === ModpackVisibility.PRIVATE;
    }

    isPatreonOnly(): boolean {
        return this.visibility === ModpackVisibility.PATREON;
    }

    requiresPassword(): boolean {
        return !!this.password;
    }

    async canUserAccess(userId?: string): Promise<boolean> {
        if (this.isPublic()) return true;
        if (!userId) return false;

        // Check if user is the creator
        if (this.creatorUserId === userId) return true;

        // Check if user is member of the publisher organization
        // This would need to be implemented based on your publisher membership logic
        // For now, returning false for private modpacks
        return false;
    }

    validatePassword(password: string): boolean {
        if (!this.requiresPassword()) return true;
        return this.password === password;
    }

    // Serialization methods
    toJson(): ModpackType {
        return {
            id: this.id,
            name: this.name,
            shortDescription: this.shortDescription,
            description: this.description,
            slug: this.slug,
            iconUrl: this.iconUrl,
            bannerUrl: this.bannerUrl,
            trailerUrl: this.trailerUrl,
            password: this.password,
            visibility: this.visibility,
            status: this.status,
            publisherId: this.publisherId,
            showUserAsPublisher: this.showUserAsPublisher,
            creatorUserId: this.creatorUserId,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
        };
    }

    toPublicJson(): Omit<ModpackType, 'password' | 'status'> {
        const { password, status, ...publicData } = this.toJson();
        return publicData;
    }

    // Utility methods
    getDisplayName(): string {
        return this.name;
    }

    getUrl(): string {
        return `/modpack/${this.slug}`;
    }

    hasTrailer(): boolean {
        return !!this.trailerUrl;
    }
}
