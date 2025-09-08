/**
 * Migration script to populate acquisitionMethod field based on existing data
 * This should be run after deploying the new code with the acquisitionMethod field
 */
import "reflect-metadata";
import { AppDataSource } from "./data-source";
import { Modpack } from "../entities/Modpack";
import { AcquisitionMethod } from "../types/enums";

async function migrateAcquisitionMethods() {
    try {
        // Initialize the data source
        await AppDataSource.initialize();
        console.log("Data Source has been initialized!");

        // Get all modpacks
        const modpacks = await Modpack.find();
        console.log(`Found ${modpacks.length} modpacks to migrate`);

        let updated = 0;
        let skipped = 0;

        for (const modpack of modpacks) {
            // Skip if acquisitionMethod is already set (not default)
            if (modpack.acquisitionMethod && modpack.acquisitionMethod !== AcquisitionMethod.FREE) {
                skipped++;
                continue;
            }

            let newMethod: AcquisitionMethod = AcquisitionMethod.FREE;

            // Determine acquisition method based on existing fields
            if (modpack.password && modpack.password.trim() !== "") {
                newMethod = AcquisitionMethod.PASSWORD;
            } else if (modpack.requiresTwitchSubscription && 
                       Array.isArray(modpack.twitchCreatorIds) && 
                       modpack.twitchCreatorIds.length > 0) {
                newMethod = AcquisitionMethod.TWITCH_SUB;
            } else if (modpack.isPaid && parseFloat(modpack.price) > 0) {
                newMethod = AcquisitionMethod.PAID;
            } else {
                newMethod = AcquisitionMethod.FREE;
            }

            // Update the modpack
            modpack.acquisitionMethod = newMethod;
            await modpack.save();
            updated++;

            console.log(`Updated modpack ${modpack.name} (${modpack.id}) to method: ${newMethod}`);
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
    migrateAcquisitionMethods()
        .then(() => {
            console.log("Migration completed successfully");
            process.exit(0);
        })
        .catch((error) => {
            console.error("Migration failed:", error);
            process.exit(1);
        });
}

export { migrateAcquisitionMethods };