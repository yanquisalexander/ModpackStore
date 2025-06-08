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

export const newModpackVersionSchema = z.object({
  modpackId: z.string().uuid(),
  version: z.string().min(1),
  mcVersion: z.string().min(1),
  forgeVersion: z.string().optional(),
  changelog: z.string().min(1),
  createdBy: z.string().uuid(),
});

export class ModpackVersion {
  readonly id: string;
  readonly modpackId: string;
  readonly createdBy: string;
  readonly releaseDate: Date;
  readonly createdAt: Date;

  version: string;
  mcVersion: string;
  forgeVersion: string | null;
  changelog: string;
  updatedAt: Date;

  // Cached relations
  private _modpack?: Modpack | null;
  private _files?: any[];

  constructor(data: ModpackVersionType) {
    // Immutable fields
    this.id = data.id;
    this.modpackId = data.modpackId;
    this.createdBy = data.createdBy;
    this.releaseDate = data.releaseDate;
    this.createdAt = data.createdAt;

    // Mutable fields
    this.version = data.version;
    this.mcVersion = data.mcVersion;
    this.forgeVersion = data.forgeVersion;
    this.changelog = data.changelog;
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
          releaseDate: now,
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
      releaseDate: this.releaseDate,
      createdBy: this.createdBy,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}