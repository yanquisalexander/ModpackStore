import { DataSource } from 'typeorm';
import { ModpackFile } from '../entities/ModpackFile';
import { ModpackVersionFile } from '../entities/ModpackVersionFile';
import { ModpackVersion } from '../entities/ModpackVersion';
import { batchDeleteFromR2 } from './r2UploadService';
import { DOWNLOAD_PREFIX_URL } from './r2UploadService';

export class MaintenanceService {
    constructor(private dataSource: DataSource) {}

    /**
     * Clean up orphaned modpack files that are not associated with any version
     * @returns Promise<{ deletedCount: number }>
     */
    async cleanupOrphanedModpackFiles(): Promise<{ deletedCount: number }> {
        return await this.dataSource.transaction(async manager => {
            try {
                // Find all ModpackFiles that have no associated ModpackVersionFile records
                // or whose ModpackVersionFile records point to non-existent ModpackVersions
                const orphanedFiles = await manager
                    .createQueryBuilder(ModpackFile, 'mf')
                    .leftJoin(ModpackVersionFile, 'mvf', 'mvf.fileHash = mf.hash')
                    .leftJoin(ModpackVersion, 'mv', 'mv.id = mvf.modpackVersionId')
                    .where('mvf.fileHash IS NULL OR mv.id IS NULL')
                    .getMany();

                if (orphanedFiles.length === 0) {
                    return { deletedCount: 0 };
                }

                const fileHashes = orphanedFiles.map(file => file.hash);
                
                // Generate R2 keys for the orphaned files
                // Based on the modpackFileUpload service, files are stored with the hash as the key
                const r2Keys = orphanedFiles.map(file => {
                    // The key format appears to be just the hash based on the upload service
                    return file.hash;
                });

                console.log(`Found ${orphanedFiles.length} orphaned files to delete`);

                // First, delete any remaining ModpackVersionFile records that reference these files
                await manager
                    .createQueryBuilder()
                    .delete()
                    .from(ModpackVersionFile)
                    .where('fileHash IN (:...hashes)', { hashes: fileHashes })
                    .execute();

                // Then delete the ModpackFile records
                await manager
                    .createQueryBuilder()
                    .delete()
                    .from(ModpackFile)
                    .where('hash IN (:...hashes)', { hashes: fileHashes })
                    .execute();

                // After successful DB deletion, attempt to delete from R2
                // We do this after DB operations to ensure consistency
                // If R2 deletion fails, the DB is still cleaned up
                try {
                    await batchDeleteFromR2(r2Keys);
                    console.log(`Successfully deleted ${r2Keys.length} files from R2`);
                } catch (r2Error) {
                    // Log the error but don't fail the transaction
                    // The DB cleanup is more important than R2 cleanup
                    console.error('Failed to delete some files from R2:', r2Error);
                    console.log('Database cleanup completed successfully despite R2 errors');
                }

                return { deletedCount: orphanedFiles.length };
            } catch (error) {
                console.error('Error during cleanup operation:', error);
                throw new Error('Failed to cleanup orphaned files');
            }
        });
    }
}