import "reflect-metadata";
import "dotenv/config";
import { AppDataSource } from "./data-source";

async function testDataSourceConnection() {
    try {
        console.log("🔄 Initializing TypeORM DataSource...");
        
        await AppDataSource.initialize();
        
        console.log("✅ TypeORM DataSource initialized successfully!");
        console.log("📊 Database connection established");
        
        // Test that we can access our entities
        const userRepository = AppDataSource.getRepository("User");
        console.log(`📝 User repository loaded with ${Object.keys(userRepository.metadata.columns).length} columns`);
        
        const modpackRepository = AppDataSource.getRepository("Modpack");
        console.log(`📦 Modpack repository loaded with ${Object.keys(modpackRepository.metadata.columns).length} columns`);
        
        console.log("🎯 All entities are properly registered and accessible");
        
        await AppDataSource.destroy();
        console.log("💤 DataSource connection closed");
        
    } catch (error) {
        console.error("❌ Error initializing TypeORM DataSource:", error);
        process.exit(1);
    }
}

if (require.main === module) {
    testDataSourceConnection();
}

export { testDataSourceConnection };