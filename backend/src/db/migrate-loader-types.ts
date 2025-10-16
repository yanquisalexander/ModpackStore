/**
 * Migration script to populate loaderType and loaderVersion fields from forgeVersion
 * This should be run after deploying the new code with the loader fields
 */
import "reflect-metadata";
import { AppDataSource } from "./data-source";
import { ModpackVersion } from "../entities/ModpackVersion";
import { ModLoaderType } from "../types/enums";

async function migrateLoaderTypes() {
    try {
        // Initialize the data source
        await AppDataSource.initialize();
        console.log("Data Source has been initialized!");

        // Get all modpack versions
        const versions = await ModpackVersion.find();
        console.log(`Found ${versions.length} modpack versions to migrate`);

        let updated = 0;
        let skipped = 0;

        for (const version of versions) {
            // Skip if loaderType is already set
            if (version.loaderType && version.loaderType !== ModLoaderType.VANILLA) {
                skipped++;
                continue;
            }

            // Determine loader type and version based on existing forgeVersion field
            if (version.forgeVersion && version.forgeVersion.trim() !== "") {
                version.loaderType = ModLoaderType.FORGE;
                version.loaderVersion = version.forgeVersion;
            } else {
                version.loaderType = ModLoaderType.VANILLA;
                version.loaderVersion = null;
            }

            // Update the version
            await version.save();
            updated++;

            console.log(`Updated version ${version.version} (${version.id}) to loader: ${version.loaderType} ${version.loaderVersion || ''}`);
        }

        console.log(`Migration completed: ${updated} updated, ${skipped} skipped`);

    } catch (error) {
        console.error("Error during migration:", error);
        throw error;
    } finally {
        // Close the data source
        if (AppDataSource.isInitialized) {
            await AppDataSource.destroy();
            console.log("Data Source has been closed!");
        }
    }
}

// Run migration if this file is executed directly
if (require.main === module) {
    migrateLoaderTypes()
        .then(() => {
            console.log("Migration completed successfully");
            process.exit(0);
        })
        .catch((error) => {
            console.error("Migration failed:", error);
            process.exit(1);
        });
}

export { migrateLoaderTypes };
