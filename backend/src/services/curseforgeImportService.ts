import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import JSZip from 'jszip';
import { CurseForgeAPIClient } from './curseforgeApiClient';
import { uploadToR2, batchUploadToR2 } from './r2UploadService';
import { queue } from './Queue';
import { Modpack } from '@/entities/Modpack';
import { ModpackVersion } from '@/entities/ModpackVersion';
import { ModpackFile } from '@/entities/ModpackFile';
import { ModpackVersionFile } from '@/entities/ModpackVersionFile';
import { CurseForgeManifest, CurseForgeImportResult } from '@/types/curseforge';
import { ModpackStatus, ModpackVersionStatus } from '@/types/enums';
import { In } from 'typeorm';
import { AppDataSource } from '@/db/data-source';

const TEMP_IMPORT_DIR = path.join(__dirname, '../../tmp/curseforge-imports');
if (!fs.existsSync(TEMP_IMPORT_DIR)) fs.mkdirSync(TEMP_IMPORT_DIR, { recursive: true });

export class CurseForgeImportService {
    private apiClient: CurseForgeAPIClient;

    constructor() {
        this.apiClient = new CurseForgeAPIClient();
    }

    /**
     * Import a CurseForge modpack from ZIP buffer
     */
    async importModpack(
        zipBuffer: Buffer,
        publisherId: string,
        createdBy: string,
        options: {
            slug?: string;
            visibility?: string;
            parallelDownloads?: number;
        } = {}
    ): Promise<CurseForgeImportResult> {
        const importId = crypto.randomUUID();
        const workDir = path.join(TEMP_IMPORT_DIR, importId);
        const errors: string[] = [];

        try {
            fs.mkdirSync(workDir, { recursive: true });

            // Extract ZIP and parse manifest
            const { manifest, overrideFiles } = await this.extractAndParseZip(zipBuffer, workDir);

            // Create modpack and version entities
            const { modpack, version } = await this.createModpackEntities(
                manifest,
                publisherId,
                createdBy,
                options.slug
            );

            // Download mods and process files
            const stats = await this.processModpackFiles(
                manifest,
                overrideFiles,
                modpack.id,
                version.id,
                workDir,
                options.parallelDownloads || 5
            );

            // Add failed mod names to errors if any
            if (stats.failedMods > 0) {
                errors.push(`${stats.failedMods} mods could not be downloaded from CurseForge`);
            }

            // Cleanup
            fs.rmSync(workDir, { recursive: true, force: true });

            return {
                modpack: {
                    id: modpack.id,
                    name: modpack.name,
                    version: version.version
                },
                stats,
                errors
            };

        } catch (error) {
            // Cleanup on error
            if (fs.existsSync(workDir)) {
                fs.rmSync(workDir, { recursive: true, force: true });
            }

            // Add error details
            if (error instanceof Error) {
                errors.push(error.message);
            } else {
                errors.push('Unknown error occurred during import');
            }

            throw error;
        }
    }

    /**
     * Extract ZIP and parse manifest.json
     */
    private async extractAndParseZip(
        zipBuffer: Buffer,
        workDir: string
    ): Promise<{ manifest: CurseForgeManifest; overrideFiles: Array<{ path: string; content: Buffer }> }> {
        const zip = await JSZip.loadAsync(zipBuffer);

        // Find and parse manifest.json
        const manifestFile = zip.file('manifest.json');
        if (!manifestFile) {
            throw new Error('manifest.json not found in ZIP file');
        }

        const manifestContent = await manifestFile.async('text');
        let manifest: CurseForgeManifest;

        try {
            manifest = JSON.parse(manifestContent);
        } catch (error) {
            throw new Error('Invalid manifest.json format');
        }

        // Validate manifest
        this.validateManifest(manifest);

        // Extract override files
        const overrideFiles: Array<{ path: string; content: Buffer }> = [];
        const overrideFolderName = manifest.overrides || 'overrides';

        for (const [filePath, zipEntry] of Object.entries(zip.files)) {
            if (filePath.startsWith(overrideFolderName + '/') && !zipEntry.dir) {
                const content = await zipEntry.async('nodebuffer');
                const relativePath = filePath.substring(overrideFolderName.length + 1);
                overrideFiles.push({ path: relativePath, content });
            }
        }

        return { manifest, overrideFiles };
    }

    /**
     * Validate CurseForge manifest structure
     */
    private validateManifest(manifest: CurseForgeManifest): void {
        if (!manifest.name || !manifest.version) {
            throw new Error('Manifest must have name and version');
        }

        if (!manifest.minecraft?.version) {
            throw new Error('Manifest must specify Minecraft version');
        }

        if (!Array.isArray(manifest.files)) {
            throw new Error('Manifest must have files array');
        }

        if (manifest.manifestType !== 'minecraftModpack') {
            throw new Error('Only Minecraft modpack manifests are supported');
        }

        // Validate name length and characters
        if (manifest.name.length > 100) {
            throw new Error('Modpack name cannot exceed 100 characters');
        }

        // Validate version format
        if (!/^\d+\.\d+(\.\d+)?/.test(manifest.version)) {
            throw new Error('Version must follow semantic versioning (e.g., 1.0.0)');
        }

        // Validate Minecraft version format
        if (!/^\d+\.\d+(\.\d+)?/.test(manifest.minecraft.version)) {
            throw new Error('Minecraft version must be valid (e.g., 1.19.2)');
        }

        // Check for reasonable file count
        if (manifest.files.length > 500) {
            throw new Error('Too many mods in modpack (maximum 500 supported)');
        }

        // Validate file entries
        for (const file of manifest.files) {
            if (!file.projectID || !file.fileID) {
                throw new Error('All mod files must have valid projectID and fileID');
            }
            if (file.projectID <= 0 || file.fileID <= 0) {
                throw new Error('ProjectID and fileID must be positive numbers');
            }
        }
    }

    /**
     * Create Modpack and ModpackVersion entities
     */
    private async createModpackEntities(
        manifest: CurseForgeManifest,
        publisherId: string,
        createdBy: string,
        customSlug?: string
    ): Promise<{ modpack: Modpack; version: ModpackVersion }> {
        // Generate slug from name if not provided
        let slug = customSlug || this.generateSlug(manifest.name);

        // Check if slug already exists and generate alternative if needed
        let slugAttempt = 0;
        const originalSlug = slug;
        while (await Modpack.findOne({ where: { slug } })) {
            slugAttempt++;
            slug = `${originalSlug}-${slugAttempt}`;
            if (slugAttempt > 10) {
                throw new Error(`Unable to generate unique slug for modpack '${manifest.name}'`);
            }
        }

        // Create modpack
        const modpack = new Modpack();
        modpack.name = manifest.name;
        modpack.slug = slug;
        modpack.description = `Imported from CurseForge by ${manifest.author}`;
        modpack.shortDescription = `Minecraft ${manifest.minecraft.version} modpack with ${manifest.files.length} mods`;
        modpack.publisherId = publisherId;
        modpack.creatorUserId = createdBy;
        modpack.status = ModpackStatus.DRAFT;
        await modpack.save();

        // Extract forge version from modLoaders
        const forgeLoader = manifest.minecraft.modLoaders.find(loader =>
            loader.primary && loader.id.startsWith('forge-')
        );
        const forgeVersion = forgeLoader?.id.replace('forge-', '') || undefined;

        // Create version
        const version = new ModpackVersion();
        version.version = manifest.version;
        version.mcVersion = manifest.minecraft.version;
        version.forgeVersion = forgeVersion;
        version.changelog = `Imported from CurseForge. Original author: ${manifest.author}. Contains ${manifest.files.length} mods.`;
        version.modpackId = modpack.id;
        version.createdBy = createdBy;
        version.status = ModpackVersionStatus.DRAFT;
        await version.save();

        return { modpack, version };
    }

    /**
     * Process all modpack files (mods + overrides)
     */
    private async processModpackFiles(
        manifest: CurseForgeManifest,
        overrideFiles: Array<{ path: string; content: Buffer }>,
        modpackId: string,
        versionId: string,
        workDir: string,
        concurrency: number
    ): Promise<{ totalMods: number; downloadedMods: number; failedMods: number; overrideFiles: number }> {
        const stats = {
            totalMods: manifest.files.length,
            downloadedMods: 0,
            failedMods: 0,
            overrideFiles: overrideFiles.length
        };

        // Process mods
        if (manifest.files.length > 0) {
            const modStats = await this.downloadAndProcessMods(
                manifest.files,
                modpackId,
                versionId,
                workDir,
                concurrency
            );
            stats.downloadedMods = modStats.downloaded;
            stats.failedMods = modStats.failed;
        }

        // Process override files
        if (overrideFiles.length > 0) {
            await this.processOverrideFiles(overrideFiles, modpackId, versionId);
        }

        return stats;
    }

    /**
     * Download and process mods from CurseForge
     */
    private async downloadAndProcessMods(
        modFiles: Array<{ projectID: number; fileID: number; required: boolean }>,
        modpackId: string,
        versionId: string,
        workDir: string,
        concurrency: number
    ): Promise<{ downloaded: number; failed: number }> {
        const stats = { downloaded: 0, failed: 0 };

        // Create semaphore for concurrency control
        const semaphore = new Semaphore(concurrency);

        const downloadPromises = modFiles.map(async (modFile) => {
            await semaphore.acquire();
            try {
                const fileInfo = await this.apiClient.getFile(modFile.projectID, modFile.fileID);
                if (!fileInfo) {
                    console.error(`Failed to get file info for mod ${modFile.projectID}/${modFile.fileID}`);
                    stats.failed++;
                    return;
                }

                const downloadUrl = await this.apiClient.getDownloadUrl(modFile.projectID, modFile.fileID);
                if (!downloadUrl) {
                    console.error(`No download URL available for mod ${modFile.projectID}/${modFile.fileID}`);
                    stats.failed++;
                    return;
                }

                const modContent = await this.apiClient.downloadFile(downloadUrl);
                if (!modContent) {
                    console.error(`Failed to download mod ${modFile.projectID}/${modFile.fileID}`);
                    stats.failed++;
                    return;
                }

                // Store mod file
                const hash = crypto.createHash('sha1').update(modContent).digest('hex');
                const modPath = `mods/${fileInfo.fileName}`;

                await this.storeModpackFile(
                    modContent,
                    hash,
                    modPath,
                    'mods',
                    modpackId,
                    versionId
                );

                stats.downloaded++;
            } catch (error) {
                console.error(`Error processing mod ${modFile.projectID}/${modFile.fileID}:`, error);
                stats.failed++;
            } finally {
                semaphore.release();
            }
        });

        await Promise.all(downloadPromises);
        return stats;
    }

    /**
     * Process override files as config/extras
     */
    private async processOverrideFiles(
        overrideFiles: Array<{ path: string; content: Buffer }>,
        modpackId: string,
        versionId: string
    ): Promise<void> {
        const fileEntries = overrideFiles.map(file => {
            const hash = crypto.createHash('sha1').update(file.content).digest('hex');
            const fileType = this.determineOverrideFileType(file.path);
            const adjustedPath = fileType === 'extras' ? file.path : `${fileType}/${file.path}`;

            return {
                content: file.content,
                hash,
                path: adjustedPath,
                type: fileType
            };
        });

        // Group by type and process
        const groupedFiles = this.groupBy(fileEntries, 'type');

        for (const [fileType, files] of Object.entries(groupedFiles)) {
            await this.batchStoreFiles(files, fileType as any, modpackId, versionId);
        }
    }

    /**
     * Store a single modpack file
     */
    private async storeModpackFile(
        content: Buffer,
        hash: string,
        filePath: string,
        fileType: string,
        modpackId: string,
        versionId: string
    ): Promise<void> {
        // Check if file already exists
        let modpackFile = await ModpackFile.findOne({ where: { hash } });

        if (!modpackFile) {
            // Upload to R2
            const getHashKey = (hash: string) => path.posix.join('resources', 'files', hash.slice(0, 2), hash.slice(2, 4), hash);
            const uploadResult = await uploadToR2(
                getHashKey(hash),
                content,
                'application/octet-stream'
            );

            // Create ModpackFile entity
            modpackFile = new ModpackFile();
            modpackFile.hash = hash;
            modpackFile.size = content.length;
            modpackFile.type = fileType as any;
            modpackFile.mimeType = 'application/octet-stream';
            try {
                await modpackFile.save();
            } catch (err: any) {
                // If concurrent insert caused unique constraint, reload the existing record
                if (err?.code === '23505' || err?.message?.includes('duplicate key') || err?.message?.includes('llave duplicada')) {
                    modpackFile = await ModpackFile.findOne({ where: { hash } });
                    if (!modpackFile) throw err; // rethrow if not found
                } else {
                    throw err;
                }
            }
        }

        // Create ModpackVersionFile association
        const versionFile = new ModpackVersionFile();
        versionFile.modpackVersionId = versionId;
        versionFile.fileHash = hash;
        versionFile.path = filePath;

        try {
            await versionFile.save();
        } catch (error: any) {
            // Ignore duplicate key errors
            if (!error.message?.includes('duplicate key') && !error.message?.includes('llave duplicada')) {
                throw error;
            }
        }
    }

    /**
     * Batch store multiple files
     */
    private async batchStoreFiles(
        files: Array<{ content: Buffer; hash: string; path: string }>,
        fileType: string,
        modpackId: string,
        versionId: string
    ): Promise<void> {
        // Get existing files
        const allHashes = files.map(f => f.hash);
        const existingFiles = await ModpackFile.find({ where: { hash: In(allHashes) } });
        const existingHashes = new Set(existingFiles.map(f => f.hash));

        // Upload new files
        const newFiles = files.filter(f => !existingHashes.has(f.hash));
        if (newFiles.length > 0) {
            const getHashKey = (hash: string) => path.posix.join('resources', 'files', hash.slice(0, 2), hash.slice(2, 4), hash);
            const uploads = newFiles.map(f => ({
                key: getHashKey(f.hash),
                body: f.content,
                contentType: 'application/octet-stream'
            }));

            await batchUploadToR2(uploads, 5);

            // Create ModpackFile entities and insert with ON CONFLICT DO NOTHING to avoid races
            const modpackFiles = newFiles.map(f => ({
                hash: f.hash,
                size: f.content.length,
                type: fileType as any,
                mimeType: 'application/octet-stream'
            }));

            try {
                await AppDataSource.createQueryBuilder()
                    .insert()
                    .into(ModpackFile)
                    .values(modpackFiles)
                    .orIgnore()
                    .execute();
            } catch (err) {
                // Fallback: if bulk insert fails for unexpected reasons, try per-item insert with individual error handling
                for (const f of modpackFiles) {
                    try {
                        await AppDataSource.createQueryBuilder()
                            .insert()
                            .into(ModpackFile)
                            .values(f)
                            .orIgnore()
                            .execute();
                    } catch (innerErr) {
                        // ignore duplicate/key errors, rethrow others
                        const msg = (innerErr as any)?.message || '';
                        if (!msg.includes('duplicate key') && !msg.includes('llave duplicada')) {
                            throw innerErr;
                        }
                    }
                }
            }
        }

        // Create version file associations
        const versionFiles = files.map(f => {
            const versionFile = new ModpackVersionFile();
            versionFile.modpackVersionId = versionId;
            versionFile.fileHash = f.hash;
            versionFile.path = f.path;
            return versionFile;
        });

        try {
            await ModpackVersionFile.save(versionFiles);
        } catch (error) {
            // Handle individual duplicates
            for (const versionFile of versionFiles) {
                try {
                    await versionFile.save();
                } catch (err: any) {
                    if (!err.message?.includes('duplicate key') && !err.message?.includes('llave duplicada')) {
                        throw err;
                    }
                }
            }
        }
    }

    /**
     * Determine file type for override files
     */
    private determineOverrideFileType(filePath: string): 'config' | 'resourcepacks' | 'shaderpacks' | 'extras' {
        const lowerPath = filePath.toLowerCase();

        if (lowerPath.startsWith('config/')) return 'config';
        if (lowerPath.startsWith('resourcepacks/')) return 'resourcepacks';
        if (lowerPath.startsWith('shaderpacks/')) return 'shaderpacks';

        return 'extras';
    }

    /**
     * Generate slug from modpack name
     */
    private generateSlug(name: string): string {
        return name
            .toLowerCase()
            // Remove special characters except spaces and hyphens
            .replace(/[^a-z0-9\s-]/g, '')
            // Replace multiple spaces with single space
            .replace(/\s+/g, ' ')
            // Trim spaces
            .trim()
            // Replace spaces with hyphens
            .replace(/\s/g, '-')
            // Remove multiple consecutive hyphens
            .replace(/-+/g, '-')
            // Remove leading/trailing hyphens
            .replace(/^-|-$/g, '')
            // Ensure minimum length
            || 'imported-modpack';
    }

    /**
     * Group array by key
     */
    private groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
        return array.reduce((groups, item) => {
            const group = String(item[key]);
            if (!groups[group]) groups[group] = [];
            groups[group].push(item);
            return groups;
        }, {} as Record<string, T[]>);
    }
}

/**
 * Simple semaphore for concurrency control
 */
class Semaphore {
    private permits: number;
    private queue: Array<() => void> = [];

    constructor(permits: number) {
        this.permits = permits;
    }

    async acquire(): Promise<void> {
        return new Promise<void>((resolve) => {
            if (this.permits > 0) {
                this.permits--;
                resolve();
            } else {
                this.queue.push(resolve);
            }
        });
    }

    release(): void {
        this.permits++;
        if (this.queue.length > 0) {
            const next = this.queue.shift();
            if (next) {
                this.permits--;
                next();
            }
        }
    }
}