import "reflect-metadata";
import { AppDataSource } from "./data-source";

async function migrateFileType() {
    console.log("🔄 Starting fileType migration from ModpackFile to ModpackVersionFile...");

    try {
        // Initialize database connection
        if (!AppDataSource.isInitialized) {
            await AppDataSource.initialize();
            console.log("✅ Database connection initialized");
        }

        // Step 1: Add column if it doesn't exist (TypeORM synchronize should handle this)
        console.log("📊 Checking if file_type column exists in modpack_version_files...");
        
        const columnExists = await AppDataSource.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'modpack_version_files' 
            AND column_name = 'file_type';
        `);

        if (columnExists.length === 0) {
            console.log("➕ Adding file_type column to modpack_version_files table...");
            await AppDataSource.query(`
                ALTER TABLE modpack_version_files 
                ADD COLUMN file_type VARCHAR(32);
            `);
            console.log("✅ Column added successfully");
        } else {
            console.log("✅ Column already exists");
        }

        // Step 2: Migrate data from ModpackFile.type to ModpackVersionFile.fileType
        console.log("🔄 Migrating fileType data...");
        
        const result = await AppDataSource.query(`
            UPDATE modpack_version_files mvf
            SET file_type = mf.type
            FROM modpack_files mf
            WHERE mvf.file_hash = mf.hash
            AND mvf.file_type IS NULL;
        `);

        const rowsUpdated = result[1] || 0;
        console.log(`✅ Updated ${rowsUpdated} rows with fileType from ModpackFile`);

        // Step 3: Verify migration
        console.log("🔍 Verifying migration...");
        
        const stats = await AppDataSource.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(file_type) as with_filetype,
                COUNT(*) - COUNT(file_type) as without_filetype
            FROM modpack_version_files;
        `);

        console.log("📊 Migration statistics:");
        console.log(`   Total rows: ${stats[0].total}`);
        console.log(`   Rows with fileType: ${stats[0].with_filetype}`);
        console.log(`   Rows without fileType: ${stats[0].without_filetype}`);

        if (stats[0].without_filetype > 0) {
            console.warn(`⚠️  Warning: ${stats[0].without_filetype} rows still don't have fileType. This might be expected for orphaned records.`);
        }

        console.log("✅ Migration completed successfully!");

    } catch (error) {
        console.error("❌ Migration failed:", error);
        throw error;
    } finally {
        if (AppDataSource.isInitialized) {
            await AppDataSource.destroy();
            console.log("🔌 Database connection closed");
        }
    }
}

// Run migration
migrateFileType()
    .then(() => {
        console.log("🎉 All done!");
        process.exit(0);
    })
    .catch((error) => {
        console.error("💥 Fatal error:", error);
        process.exit(1);
    });
