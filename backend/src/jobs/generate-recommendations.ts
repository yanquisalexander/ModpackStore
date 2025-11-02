#!/usr/bin/env tsx
/**
 * Background job to generate recommendations for all users
 * Usage: tsx backend/src/jobs/generate-recommendations.ts
 */

import "reflect-metadata";
import { AppDataSource } from "../db/data-source";
import { RecommendationService } from "../services/recommendation.service";

async function main() {
    console.log("[JOB] Starting recommendation generation job...");
    
    try {
        // Initialize database connection
        if (!AppDataSource.isInitialized) {
            await AppDataSource.initialize();
            console.log("[JOB] Database connection initialized");
        }

        // Generate recommendations for all users
        await RecommendationService.generateAllRecommendations();

        console.log("[JOB] Recommendation generation completed successfully");
        
        // Close database connection
        await AppDataSource.destroy();
        process.exit(0);

    } catch (error) {
        console.error("[JOB] Error generating recommendations:", error);
        
        // Close database connection
        if (AppDataSource.isInitialized) {
            await AppDataSource.destroy();
        }
        
        process.exit(1);
    }
}

main();
