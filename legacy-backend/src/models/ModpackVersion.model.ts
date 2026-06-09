import { z } from "zod";
import { client as db } from "@/db/client";
import { ModpackVersionFilesTable, ModpackVersionsTable } from "@/db/schema";
import { Modpack } from "./Modpack.model";
import { eq } from "drizzle-orm";

// ============================================================================
// ModpackVersion.model.ts - CORRECTED
// ============================================================================


type ModpackVersionType = typeof ModpackVersionsTable.$inferSelect;
type NewModpackVersion = typeof ModpackVersionsTable.$inferInsert;

export enum ModpackVersionStatus {
	DRAFT = 'draft',
	PUBLISHED = 'published',
	ARCHIVED = 'archived',
}

export const newModpackVersionSchema = z.object({
  modpackId: z.string().uuid(),
  version: z.string().min(1),
  mcVersion: z.string().min(1),
  forgeVersion: z.string().optional(),
  changelog: z.string().min(1),
  status: z.nativeEnum(ModpackVersionStatus).default(ModpackVersionStatus.DRAFT).optional(),
  createdBy: z.string().uuid(),
});

export const modpackVersionUpdateSchema = newModpackVersionSchema.partial().omit({
  modpackId: true, // Generally, a version shouldn't move between modpacks
  createdBy: true, // Creator should not change
  version: true, // Version number itself is often immutable; changes imply a new version.
}).extend({
  releaseDate: z.date().nullable().optional(),
  // status can be updated via this schema.
});
type ModpackVersionUpdateInput = z.infer<typeof modpackVersionUpdateSchema>;


export class ModpackVersion {
  readonly id: string;
  readonly modpackId: string;
  readonly createdBy: string;
  releaseDate: Date | null; // Made nullable
  readonly createdAt: Date;

  version: string;
  mcVersion: string;
  forgeVersion: string | null;
  changelog: string;
  status: ModpackVersionStatus; // Added status
  updatedAt: Date;

  // Cached relations
  private _modpack?: Modpack | null;
  private _files?: any[];

  constructor(data: ModpackVersionType) {
    // Immutable fields
    this.id = data.id;
    this.modpackId = data.modpackId;
    this.createdBy = data.createdBy;
    this.releaseDate = data.releaseDate; // Will be null initially
    this.createdAt = data.createdAt;

    // Mutable fields
    this.version = data.version;
    this.mcVersion = data.mcVersion;
    this.forgeVersion = data.forgeVersion;
    this.changelog = data.changelog;
    this.status = data.status as ModpackVersionStatus; // Initialize status
    this.updatedAt = data.updatedAt;
  }

  static async create(data: z.infer<typeof newModpackVersionSchema>): Promise<ModpackVersion> {
    const parsed = newModpackVersionSchema.safeParse(data);
    if (!parsed.success) {
      throw new Error(`Invalid modpack version data: ${JSON.stringify(parsed.error.format())}`);
    }

    // Verify modpack exists
    const modpack = await Modpack.findById(parsed.data.modpackId);
    if (!modpack) {
      throw new Error("Modpack not found");
    }

    const now = new Date();

    try {
      const [inserted] = await db
        .insert(ModpackVersionsTable)
        .values({
          ...parsed.data,
          // releaseDate is not set on creation, will be null by default in DB
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      return new ModpackVersion(inserted);
    } catch (error) {
      throw new Error(`Failed to create modpack version: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static async findById(id: string): Promise<ModpackVersion | null> {
    if (!id?.trim()) return null;

    try {
      const [version] = await db.select().from(ModpackVersionsTable).where(eq(ModpackVersionsTable.id, id));
      return version ? new ModpackVersion(version) : null;
    } catch (error) {
      console.error(`Error finding modpack version by ID ${id}:`, error);
      return null;
    }
  }

  static async findById(id: string): Promise<ModpackVersion | null> {
    if (!id?.trim()) return null;

    try {
      const [version] = await db.select().from(ModpackVersionsTable).where(eq(ModpackVersionsTable.id, id));
      return version ? new ModpackVersion(version) : null;
    } catch (error) {
      console.error(`Error finding modpack version by ID ${id}:`, error);
      return null;
    }
  }

  // Static method for updates
  static async update(id: string, data: ModpackVersionUpdateInput): Promise<ModpackVersion> {
    const validationResult = modpackVersionUpdateSchema.safeParse(data);
    if (!validationResult.success) {
      throw new Error(`Invalid modpack version update data: ${JSON.stringify(validationResult.error.format())}`);
    }

    if (Object.keys(validationResult.data).length === 0) {
      const currentVersion = await ModpackVersion.findById(id);
      if (!currentVersion) throw new Error("ModpackVersion not found for update with empty payload.");
      return currentVersion;
    }

    const updatePayload = {
      ...validationResult.data,
      updatedAt: new Date(),
    };

    try {
      const [updatedRecord] = await db
        .update(ModpackVersionsTable)
        .set(updatePayload)
        .where(eq(ModpackVersionsTable.id, id))
        .returning();

      if (!updatedRecord) {
        throw new Error("ModpackVersion not found or update failed.");
      }
      return new ModpackVersion(updatedRecord);
    } catch (error) {
      console.error(`Failed to update modpack version ${id}:`, error);
      throw new Error(`Failed to update modpack version: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Instance method for saving current state
  async save(): Promise<ModpackVersion> {
    const dataToSave: ModpackVersionUpdateInput = {
      // Fields from modpackVersionUpdateSchema
      mcVersion: this.mcVersion,
      forgeVersion: this.forgeVersion ?? undefined,
      changelog: this.changelog,
      status: this.status,
      releaseDate: this.releaseDate,
      // 'version' field is omitted as it's often immutable. If it were mutable:
      // version: this.version,
    };

    const updatedVersion = await ModpackVersion.update(this.id, dataToSave);
    // Update current instance properties from the successfully saved data
    Object.assign(this, updatedVersion);
    return this;
  }

  // Instance method for soft deletion (setting status to ARCHIVED)
  async delete(): Promise<void> {
    try {
      const updatedVersion = await ModpackVersion.update(this.id, { status: ModpackVersionStatus.ARCHIVED });
      this.status = updatedVersion.status;
      this.updatedAt = updatedVersion.updatedAt; // Ensure updatedAt is also updated on the instance
    } catch (error) {
      // Log the specific error from the update attempt if needed
      throw new Error(`Failed to soft-delete modpack version ${this.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getModpack(): Promise<Modpack | null> {
    if (this._modpack) {
      return this._modpack;
    }

    this._modpack = await Modpack.findById(this.modpackId);
    return this._modpack;
  }

  async getFiles() {
    if (this._files) {
      return this._files;
    }

    try {
      const files = await db
        .select()
        .from(ModpackVersionFilesTable)
        .where(eq(ModpackVersionFilesTable.modpackVersionId, this.id));

      this._files = files;
      return this._files;
    } catch (error) {
      console.error(`Error getting files for version ${this.id}:`, error);
      return [];
    }
  }

  toJson(): ModpackVersionType {
    return {
      id: this.id,
      modpackId: this.modpackId,
      version: this.version,
      mcVersion: this.mcVersion,
      forgeVersion: this.forgeVersion,
      changelog: this.changelog,
      status: this.status, // Added status
      releaseDate: this.releaseDate,
      createdBy: this.createdBy,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}