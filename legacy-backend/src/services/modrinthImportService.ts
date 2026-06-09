import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import JSZip from 'jszip';
import { uploadToR2, batchUploadToR2 } from './r2UploadService';
import { Modpack } from '@/entities/Modpack';
import { ModpackVersion } from '@/entities/ModpackVersion';
import { ModpackFile } from '@/entities/ModpackFile';
import { ModpackVersionFile } from '@/entities/ModpackVersionFile';
import { ModrinthManifest, ModrinthFile, ModrinthImportResult } from '@/types/modrinth';
import { ModpackStatus, ModpackVersionStatus } from '@/types/enums';
import { In } from 'typeorm';
import { AppDataSource } from '@/db/data-source';
import axios from 'axios';

const TEMP_IMPORT_DIR = path.join(__dirname, '../../tmp/modrinth-imports');
if (!fs.existsSync(TEMP_IMPORT_DIR)) fs.mkdirSync(TEMP_IMPORT_DIR, { recursive: true });

// Semaphore implementation for concurrent downloads
class Semaphore {
    private tasks: (() => void)[] = [];
    constructor(private permits: number) {}

    async acquire(): Promise<void> {
        if (this.permits > 0) {
            this.permits--;
            return Promise.resolve();
        }

        return new Promise(resolve => {
            this.tasks.push(() => resolve());
        });
    }

    release(): void {
        this.permits++;
        const task = this.tasks.shift();
        if (task) {
            this.permits--;
            task();
        }
    }
}

export class ModrinthImportService {
    /**
     * Import a Modrinth modpack from .mrpack (ZIP) buffer
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
    ): Promise<ModrinthImportResult> {
        const importId = crypto.randomUUID();
        const workDir = path.join(TEMP_IMPORT_DIR, importId);
        const errors: string[] = [];

        try {
            fs.mkdirSync(workDir, { recursive: true });

            // Extract ZIP and parse modrinth.index.json
            const { manifest, overrideFilesByCategory } = await this.extractAndParseZip(zipBuffer, workDir);

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
                overrideFilesByCategory,
                modpack.id,
                version.id,
                workDir,
                options.parallelDownloads || 5
            );

            // Add failed mod names to errors if any
            if (stats.failedMods > 0) {
                errors.push(`${stats.failedMods} mods could not be downloaded from Modrinth`);
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
     * Extract ZIP and parse modrinth.index.json
     */
    private async extractAndParseZip(
        zipBuffer: Buffer,
        workDir: string
    ): Promise<{ 
        manifest: ModrinthManifest; 
        overrideFilesByCategory: Map<string, Array<{ path: string; content: Buffer }>>
    }> {
        const zip = await JSZip.loadAsync(zipBuffer);

        // Find and parse modrinth.index.json
        const manifestFile = zip.file('modrinth.index.json');
        if (!manifestFile) {
            throw new Error('modrinth.index.json not found in .mrpack file');
        }

        const manifestContent = await manifestFile.async('text');
        let manifest: ModrinthManifest;

        try {
            manifest = JSON.parse(manifestContent);
        } catch (error) {
            throw new Error('Invalid modrinth.index.json format');
        }

        // Validate manifest
        this.validateManifest(manifest);

        // Extract override files and group them by category
        const overrideFilesByCategory = new Map<string, Array<{ path: string; content: Buffer }>>();
        const overrideFolderName = 'overrides';

        // Initialize categories
        const categories = ['config', 'resourcepacks', 'shaderpacks', 'datapacks', 'extras'];
        categories.forEach(category => {
            overrideFilesByCategory.set(category, []);
        });

        for (const [filePath, zipEntry] of Object.entries(zip.files)) {
            if (filePath.startsWith(overrideFolderName + '/') && !zipEntry.dir) {
                const content = await zipEntry.async('nodebuffer');
                const relativePath = filePath.substring(overrideFolderName.length + 1);
                
                // Determine the category based on the top-level directory
                const category = this.determineOverrideFileType(relativePath);
                
                // For recognized categories, store the path relative to that category
                // For extras, store the full relative path
                let adjustedPath: string;
                if (category === 'extras') {
                    adjustedPath = relativePath;
                } else {
                    // Remove the category prefix from the path since we'll add it back during processing
                    adjustedPath = relativePath.startsWith(category + '/') 
                        ? relativePath.substring(category.length + 1)
                        : relativePath;
                }
                
                overrideFilesByCategory.get(category)!.push({ 
                    path: adjustedPath, 
                    content 
                });
            }
        }

        return { manifest, overrideFilesByCategory };
    }

    /**
     * Validate Modrinth manifest structure
     */
    private validateManifest(manifest: ModrinthManifest): void {
        if (!manifest.name || !manifest.versionId) {
            throw new Error('Manifest must have name and versionId');
        }

        if (!manifest.dependencies?.minecraft) {
            throw new Error('Manifest must specify Minecraft version in dependencies');
        }

        if (!Array.isArray(manifest.files)) {
            throw new Error('Manifest must have files array');
        }

        if (manifest.game !== 'minecraft') {
            throw new Error('Only Minecraft modpacks are supported');
        }

        // Validate name length
        if (manifest.name.length > 100) {
            throw new Error('Modpack name cannot exceed 100 characters');
        }

        // Validate Minecraft version format
        if (!/^\d+\.\d+(\.\d+)?/.test(manifest.dependencies.minecraft)) {
            throw new Error('Minecraft version must be valid (e.g., 1.19.2)');
        }

        // Check for reasonable file count
        if (manifest.files.length > 500) {
            throw new Error('Too many mods in modpack (maximum 500 supported)');
        }

        // Validate that only Forge is used (other modloaders not yet supported)
        if (manifest.dependencies['fabric-loader'] || 
            manifest.dependencies['quilt-loader'] || 
            manifest.dependencies['neoforge']) {
            throw new Error('Solo se admite Forge actualmente. Fabric, Quilt y NeoForge no están soportados todavía.');
        }

        // Validate file entries
        for (const file of manifest.files) {
            if (!file.path || !file.hashes?.sha1 || !Array.isArray(file.downloads) || file.downloads.length === 0) {
                throw new Error('All mod files must have valid path, SHA1 hash, and download URLs');
            }
        }
    }

    /**
     * Create Modpack and ModpackVersion entities
     */
    private async createModpackEntities(
        manifest: ModrinthManifest,
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
        modpack.description = manifest.summary || `Imported from Modrinth`;
        modpack.shortDescription = `Minecraft ${manifest.dependencies.minecraft} modpack with ${manifest.files.length} mods`;
        modpack.publisherId = publisherId;
        modpack.creatorUserId = createdBy;
        modpack.status = ModpackStatus.DRAFT;
        await modpack.save();

        // Extract forge version from dependencies
        const forgeVersion = manifest.dependencies.forge;

        // Create version
        const version = new ModpackVersion();
        version.version = manifest.versionId;
        version.mcVersion = manifest.dependencies.minecraft;
        version.forgeVersion = forgeVersion;
        version.changelog = `Imported from Modrinth. Contains ${manifest.files.length} mods.`;
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
        manifest: ModrinthManifest,
        overrideFilesByCategory: Map<string, Array<{ path: string; content: Buffer }>>,
        modpackId: string,
        versionId: string,
        workDir: string,
        concurrency: number
    ): Promise<{ totalMods: number; downloadedMods: number; failedMods: number; overrideFiles: number }> {
        // Calculate total override files
        let totalOverrideFiles = 0;
        for (const [, files] of overrideFilesByCategory) {
            totalOverrideFiles += files.length;
        }

        const stats = {
            totalMods: manifest.files.length,
            downloadedMods: 0,
            failedMods: 0,
            overrideFiles: totalOverrideFiles
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

        // Process override files by category
        if (totalOverrideFiles > 0) {
            await this.processOverrideFilesByCategory(overrideFilesByCategory, modpackId, versionId);
        }

        return stats;
    }

    /**
     * Download and process mods from Modrinth
     */
    private async downloadAndProcessMods(
        modFiles: ModrinthFile[],
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
                console.log(`Downloading mod: ${modFile.path}`);

                // Try each download URL until one succeeds
                let modContent: Buffer | null = null;
                for (const downloadUrl of modFile.downloads) {
                    try {
                        const response = await axios.get(downloadUrl, {
                            responseType: 'arraybuffer',
                            timeout: 60000, // 60 second timeout
                        });
                        modContent = Buffer.from(response.data);
                        break; // Success, exit loop
                    } catch (error) {
                        console.warn(`Failed to download from ${downloadUrl}, trying next URL...`);
                        continue;
                    }
                }

                if (!modContent) {
                    console.error(`Failed to download mod ${modFile.path} from all URLs`);
                    stats.failed++;
                    return;
                }

                // Verify hash
                const computedHash = crypto.createHash('sha1').update(modContent).digest('hex');
                if (computedHash !== modFile.hashes.sha1) {
                    console.error(`Hash mismatch for mod ${modFile.path}. Expected: ${modFile.hashes.sha1}, Got: ${computedHash}`);
                    stats.failed++;
                    return;
                }

                // Store mod file
                await this.storeModpackFile(
                    modContent,
                    modFile.hashes.sha1,
                    modFile.path,
                    'mods',
                    modpackId,
                    versionId
                );

                stats.downloaded++;
            } catch (error) {
                console.error(`Error processing mod ${modFile.path}:`, error);
                stats.failed++;
            } finally {
                semaphore.release();
            }
        });

        await Promise.all(downloadPromises);
        return stats;
    }

    /**
     * Process override files grouped by category
     */
    private async processOverrideFilesByCategory(
        overrideFilesByCategory: Map<string, Array<{ path: string; content: Buffer }>>,
        modpackId: string,
        versionId: string
    ): Promise<void> {
        for (const [category, files] of overrideFilesByCategory) {
            // Skip empty categories
            if (files.length === 0) continue;

            console.log(`Processing ${files.length} files for category: ${category}`);

            // Prepare file entries with proper path prefixes
            const fileEntries = files.map(file => {
                const hash = crypto.createHash('sha1').update(file.content).digest('hex');
                // Add category prefix for path consistency
                const adjustedPath = category === 'extras' ? file.path : `${category}/${file.path}`;

                return {
                    content: file.content,
                    hash,
                    path: adjustedPath,
                    type: category
                };
            });

            // Process this category's files as a batch
            await this.batchStoreFiles(fileEntries, category, modpackId, versionId);
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
                    if (!modpackFile) throw err;
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
        versionFile.fileType = fileType as any; // NEW: Set fileType on ModpackVersionFile

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

            // Create ModpackFile entities
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
                // Fallback: if bulk insert fails, try per-item insert
                for (const f of modpackFiles) {
                    try {
                        await AppDataSource.createQueryBuilder()
                            .insert()
                            .into(ModpackFile)
                            .values(f)
                            .orIgnore()
                            .execute();
                    } catch (innerErr) {
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
            versionFile.fileType = fileType as any; // NEW: Set fileType on ModpackVersionFile
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
    private determineOverrideFileType(filePath: string): 'config' | 'resourcepacks' | 'shaderpacks' | 'datapacks' | 'extras' {
        const lowerPath = filePath.toLowerCase();

        if (lowerPath.startsWith('config/')) return 'config';
        if (lowerPath.startsWith('resourcepacks/')) return 'resourcepacks';
        if (lowerPath.startsWith('shaderpacks/')) return 'shaderpacks';
        if (lowerPath.startsWith('datapacks/')) return 'datapacks';

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
}
