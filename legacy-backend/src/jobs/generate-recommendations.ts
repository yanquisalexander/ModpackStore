#!/usr/bin/env tsx
/**
 * Background job to generate recommendations for all users
 * Usage: tsx backend/src/jobs/generate-recommendations.ts
 */


import "reflect-metadata";
import { AppDataSource } from "@/db/data-source";
import { RecommendationService } from "../services/recommendation.service";

async function main() {
    console.log("[JOB] Starting recommendation generation job...");

    // Ensure database is initialized
    if (!AppDataSource.isInitialized) {
        console.log("[JOB] Initializing database connection...");
        try {
            await AppDataSource.initialize();
            console.log("[JOB] Database connection established.");
        } catch (error) {
            console.error("[JOB] Failed to initialize database connection:", error);
            process.exit(1);
        }
    }

    try {
        // Generate recommendations for all users
        await RecommendationService.generateAllRecommendations();

        console.log("[JOB] Recommendation generation completed successfully");

        process.exit(0);

    } catch (error) {
        console.error("[JOB] Error generating recommendations:", error);

        process.exit(1);
    }
}

main();
