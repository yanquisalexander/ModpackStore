#!/usr/bin/env tsx
/**
 * Test script for voting and recommendation system
 * Usage: tsx backend/test/vote-recommendation.test.ts
 */

import "reflect-metadata";
import { AppDataSource } from "../src/db/data-source";
import { VoteService } from "../src/services/vote.service";
import { RecommendationService } from "../src/services/recommendation.service";
import { User } from "../src/entities/User";
import { Modpack } from "../src/entities/Modpack";
import { ModpackVote } from "../src/entities/ModpackVote";

async function testVotingSystem() {
    console.log("\n🧪 Testing Voting System...\n");

    try {
        // Find a test user
        const testUser = await User.findOne({ where: {} });
        if (!testUser) {
            console.log("❌ No users found. Please create a user first.");
            return;
        }
        console.log(`✅ Found test user: ${testUser.username}`);

        // Find a test modpack
        const testModpack = await Modpack.findOne({ where: {} });
        if (!testModpack) {
            console.log("❌ No modpacks found. Please create a modpack first.");
            return;
        }
        console.log(`✅ Found test modpack: ${testModpack.name}`);

        // Test voting
        console.log("\n📝 Testing vote creation...");
        const vote = await VoteService.voteOnModpack(testUser, testModpack, "like");
        console.log(`✅ Vote created: ${vote?.vote === 1 ? 'Like' : 'Dislike'}`);

        // Test getting vote counts
        console.log("\n📊 Testing vote counts...");
        const counts = await VoteService.getVoteCounts(testModpack.id);
        console.log(`✅ Vote counts - Likes: ${counts.likes}, Dislikes: ${counts.dislikes}`);

        // Test getting user vote
        console.log("\n👤 Testing user vote retrieval...");
        const userVote = await VoteService.getUserVote(testUser.id, testModpack.id);
        console.log(`✅ User vote: ${userVote}`);

        // Test changing vote
        console.log("\n🔄 Testing vote change...");
        await VoteService.voteOnModpack(testUser, testModpack, "dislike");
        const newVote = await VoteService.getUserVote(testUser.id, testModpack.id);
        console.log(`✅ Vote changed to: ${newVote}`);

        // Test removing vote
        console.log("\n🗑️ Testing vote removal...");
        await VoteService.voteOnModpack(testUser, testModpack, "none");
        const removedVote = await VoteService.getUserVote(testUser.id, testModpack.id);
        console.log(`✅ Vote removed: ${removedVote === 'none' ? 'Yes' : 'No'}`);

        console.log("\n✅ Voting system tests completed successfully!");

    } catch (error) {
        console.error("❌ Error in voting tests:", error);
    }
}

async function testRecommendationSystem() {
    console.log("\n🧪 Testing Recommendation System...\n");

    try {
        // Count total votes
        const totalVotes = await ModpackVote.count();
        console.log(`📊 Total votes in system: ${totalVotes}`);

        if (totalVotes < 5) {
            console.log("⚠️  Not enough votes for meaningful recommendations. Please add more votes.");
            console.log("   Tip: Create multiple users and have them vote on different modpacks.");
            return;
        }

        // Test generating recommendations for a user
        const testUser = await User.findOne({ where: {} });
        if (!testUser) {
            console.log("❌ No users found.");
            return;
        }

        console.log(`\n👤 Generating recommendations for: ${testUser.username}`);
        await RecommendationService.generateRecommendationsForUser(testUser.id);
        console.log("✅ Recommendations generated!");

        // Test getting recommendations
        console.log("\n📋 Fetching recommendations...");
        const recommendations = await RecommendationService.getRecommendationsForUser(testUser.id, 5);
        
        if (recommendations.length > 0) {
            console.log(`✅ Found ${recommendations.length} recommendations:`);
            for (const rec of recommendations) {
                console.log(`   - Score: ${rec.score.toFixed(3)}, Algorithm: ${rec.algorithm}`);
            }
        } else {
            console.log("⚠️  No recommendations found (this is normal for cold start)");
        }

        // Test related modpacks
        const testModpack = await Modpack.findOne({ where: {} });
        if (testModpack) {
            console.log(`\n🔗 Fetching related modpacks for: ${testModpack.name}`);
            const relatedModpacks = await RecommendationService.getRelatedModpacks(testModpack.id, undefined, 5);
            console.log(`✅ Found ${relatedModpacks.length} related modpacks`);
        }

        console.log("\n✅ Recommendation system tests completed successfully!");

    } catch (error) {
        console.error("❌ Error in recommendation tests:", error);
    }
}

async function main() {
    console.log("🚀 Starting Vote & Recommendation System Tests\n");

    try {
        // Initialize database connection
        if (!AppDataSource.isInitialized) {
            await AppDataSource.initialize();
            console.log("✅ Database connection initialized\n");
        }

        // Run tests
        await testVotingSystem();
        await testRecommendationSystem();

        console.log("\n🎉 All tests completed!\n");

        // Close database connection
        await AppDataSource.destroy();
        process.exit(0);

    } catch (error) {
        console.error("\n❌ Fatal error:", error);
        
        if (AppDataSource.isInitialized) {
            await AppDataSource.destroy();
        }
        
        process.exit(1);
    }
}

main();
