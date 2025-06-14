import { z } from "zod";
import { client as db } from "@/db/client";
import { ModpackVersionFilesTable, ModpackVersionIndividualFilesTable } from "@/db/schema";
import { ModpackVersion } from "./ModpackVersion.model";
import { eq } from "drizzle-orm";

// ============================================================================
// ModpackVersionFile.model.ts - CORRECTED
// ============================================================================


type ModpackVersionFileType = typeof ModpackVersionFilesTable.$inferSelect;
type NewModpackVersionFile = typeof ModpackVersionFilesTable.$inferInsert;

export const newModpackVersionFileSchema = z.object({
    modpackVersionId: z.string().uuid(),
    type: z.enum(['mods', 'configs', 'resources', 'full_pack']),
    hash: z.string().min(1),
    size: z.number().int().min(0).optional(), // Made optional in schema, implies can be null in DB or not provided
});

export const modpackVersionFileUpdateSchema = z.object({
    type: z.enum(['mods', 'configs', 'resources', 'full_pack']).optional(),
    size: z.number().int().min(0).optional().nullable(), // Allowing size to be explicitly set to null or updated
});
type ModpackVersionFileUpdateInput = z.infer<typeof modpackVersionFileUpdateSchema>;

export class ModpackVersionFile {
    readonly id: number;
    readonly modpackVersionId: string;
    readonly hash: string;
    readonly createdAt: Date;

    type: string;
    size: number | null;

    // Cached relations
    private _modpackVersion?: ModpackVersion | null;
    private _individualFiles?: any[];

    constructor(data: ModpackVersionFileType) {
        // Immutable fields
        this.id = data.id;
        this.modpackVersionId = data.modpackVersionId;
        this.hash = data.hash;
        this.createdAt = data.createdAt;

        // Mutable fields
        this.type = data.type;
        this.size = data.size;
    }

    static async create(data: z.infer<typeof newModpackVersionFileSchema>): Promise<ModpackVersionFile> {
        const parsed = newModpackVersionFileSchema.safeParse(data);
        if (!parsed.success) {
            throw new Error(`Invalid modpack version file data: ${JSON.stringify(parsed.error.format())}`);
        }

        // Verify modpack version exists
        const modpackVersion = await ModpackVersion.findById(parsed.data.modpackVersionId);
        if (!modpackVersion) {
            throw new Error("Modpack version not found");
        }

        const now = new Date();

        try {
            const [inserted] = await db
                .insert(ModpackVersionFilesTable)
                .values({
                    ...parsed.data,
                    createdAt: now,
                })
                .returning();

            return new ModpackVersionFile(inserted);
        } catch (error) {
            throw new Error(`Failed to create modpack version file: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    static async findById(id: number): Promise<ModpackVersionFile | null> {
        if (!id) return null;

        try {
            const [file] = await db.select().from(ModpackVersionFilesTable).where(eq(ModpackVersionFilesTable.id, id));
            return file ? new ModpackVersionFile(file) : null;
        } catch (error) {
            console.error(`Error finding modpack version file by ID ${id}:`, error);
            return null;
        }
    }

    static async findByHash(hash: string): Promise<ModpackVersionFile | null> {
        if (!hash?.trim()) return null;

        try {
            const [file] = await db.select().from(ModpackVersionFilesTable).where(eq(ModpackVersionFilesTable.hash, hash));
            return file ? new ModpackVersionFile(file) : null;
        } catch (error) {
            console.error(`Error finding modpack version file by hash ${hash}:`, error);
            return null;
        }
    }

    // Static method for updates
    static async update(id: number, data: ModpackVersionFileUpdateInput): Promise<ModpackVersionFile> {
        const validationResult = modpackVersionFileUpdateSchema.safeParse(data);
        if (!validationResult.success) {
            throw new Error(`Invalid modpack version file update data: ${JSON.stringify(validationResult.error.format())}`);
        }

        if (Object.keys(validationResult.data).length === 0) {
            const currentFile = await ModpackVersionFile.findById(id);
            if (!currentFile) throw new Error("ModpackVersionFile not found for update with empty payload.");
            return currentFile;
        }

        try {
            const [updatedRecord] = await db
                .update(ModpackVersionFilesTable)
                .set(validationResult.data) // No `updatedAt` field in ModpackVersionFilesTable
                .where(eq(ModpackVersionFilesTable.id, id))
                .returning();

            if (!updatedRecord) {
                throw new Error("ModpackVersionFile not found or update failed.");
            }
            return new ModpackVersionFile(updatedRecord);
        } catch (error) {
            console.error(`Failed to update modpack version file ${id}:`, error);
            throw new Error(`Failed to update modpack version file: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    // Instance method for saving current state
    async save(): Promise<ModpackVersionFile> {
        const dataToSave: ModpackVersionFileUpdateInput = {
            type: this.type as 'mods' | 'configs' | 'resources' | 'full_pack', // Cast needed if this.type is just string
            size: this.size,
        };

        const updatedFile = await ModpackVersionFile.update(this.id, dataToSave);
        // Update current instance properties
        this.type = updatedFile.type;
        this.size = updatedFile.size;
        return this;
    }

    // Instance method for deletion
    async delete(): Promise<void> {
        try {
            await db.delete(ModpackVersionFilesTable).where(eq(ModpackVersionFilesTable.id, this.id));
        } catch (error) {
            console.error(`Failed to delete modpack version file ${this.id}:`, error);
            throw new Error(`Failed to delete modpack version file: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    async getModpackVersion(): Promise<ModpackVersion | null> {
        if (this._modpackVersion) {
            return this._modpackVersion;
        }


        this._modpackVersion = await ModpackVersion.findById(this.modpackVersionId) || null
        if (!this._modpackVersion) {
            console.warn(`Modpack version not found for file ${this.id}`);
        }
        return this._modpackVersion || null;
    }

    async getIndividualFiles() {
        if (this._individualFiles) {
            return this._individualFiles;
        }

        try {
            const files = await db
                .select()
                .from(ModpackVersionIndividualFilesTable)
                .where(eq(ModpackVersionIndividualFilesTable.modpackVersionFileId, this.id));

            this._individualFiles = files;
            return this._individualFiles;
        } catch (error) {
            console.error(`Error getting individual files for file ${this.id}:`, error);
            return [];
        }
    }

    toJson(): ModpackVersionFileType {
        return {
            id: this.id,
            modpackVersionId: this.modpackVersionId,
            type: this.type,
            hash: this.hash,
            size: this.size,
            createdAt: this.createdAt,
        };
    }

    // Utility methods
    getDownloadUrl(): string {
        return `/api/download/${this.hash}`;
    }

    formatSize(): string {
        if (!this.size) return 'Unknown size';

        const units = ['B', 'KB', 'MB', 'GB'];
        let size = this.size;
        let unitIndex = 0;

        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }

        return `${size.toFixed(1)} ${units[unitIndex]}`;
    }
}