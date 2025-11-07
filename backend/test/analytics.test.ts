/**
 * Analytics API Tests
 * 
 * Tests for the creator analytics endpoints
 * Run with: tsx test/analytics.test.ts
 */

import { AppDataSource } from "../src/db/data-source";
import { ModpackDownload } from "../src/entities/ModpackDownload";
import { Modpack } from "../src/entities/Modpack";
import { ModpackVersion } from "../src/entities/ModpackVersion";
import { ModpackVote } from "../src/entities/ModpackVote";
import { Publisher } from "../src/entities/Publisher";
import { User } from "../src/entities/User";
import { AnalyticsService } from "../src/services/analytics.service";

async function setupTestData() {
    console.log("🔧 Setting up test data...");

    // Create test users
    const testUser = User.create({
        username: "analytics-test-user",
        email: "analytics-test@test.com",
        discordId: "test-discord-id",
    });
    await testUser.save();

    // Create additional test users for votes (to avoid unique constraint violations)
    const voteUsers = [];
    for (let i = 0; i < 10; i++) {
        const voteUser = User.create({
            username: `vote-test-user-${i}`,
            email: `vote-test-${i}@test.com`,
            discordId: `test-discord-vote-${i}`,
        });
        await voteUser.save();
        voteUsers.push(voteUser);
    }

    // Create test publisher
    const testPublisher = Publisher.create({
        name: "Analytics Test Publisher",
        slug: "analytics-test-publisher",
    });
    await testPublisher.save();

    // Create test modpacks
    const modpack1 = Modpack.create({
        name: "Test Modpack 1",
        slug: "test-modpack-1",
        publisherId: testPublisher.id,
        creatorUserId: testUser.id,
        visibility: "public" as any,
        status: "published" as any,
        acquisitionMethod: "free" as any,
    });
    await modpack1.save();

    const modpack2 = Modpack.create({
        name: "Test Modpack 2",
        slug: "test-modpack-2",
        publisherId: testPublisher.id,
        creatorUserId: testUser.id,
        visibility: "public" as any,
        status: "published" as any,
        acquisitionMethod: "free" as any,
    });
    await modpack2.save();

    // Create versions
    const version1 = ModpackVersion.create({
        modpackId: modpack1.id,
        version: "1.0.0",
        mcVersion: "1.20.1",
        createdBy: testUser.id,
        status: "published" as any,
        loaderType: "forge" as any,
        loaderVersion: "47.1.0",
    });
    await version1.save();

    const version2 = ModpackVersion.create({
        modpackId: modpack1.id,
        version: "1.1.0",
        mcVersion: "1.20.1",
        createdBy: testUser.id,
        status: "published" as any,
        loaderType: "forge" as any,
        loaderVersion: "47.2.0",
    });
    await version2.save();

    const version3 = ModpackVersion.create({
        modpackId: modpack2.id,
        version: "1.0.0",
        mcVersion: "1.19.4",
        createdBy: testUser.id,
        status: "published" as any,
        loaderType: "fabric" as any,
        loaderVersion: "0.15.0",
    });
    await version3.save();

    // Create downloads
    console.log("📥 Creating test downloads...");
    for (let i = 0; i < 10; i++) {
        await ModpackDownload.trackDownload(testUser.id, modpack1.id, version1.id);
    }
    for (let i = 0; i < 5; i++) {
        await ModpackDownload.trackDownload(testUser.id, modpack1.id, version2.id);
    }
    for (let i = 0; i < 3; i++) {
        await ModpackDownload.trackDownload(testUser.id, modpack2.id, version3.id);
    }

    // Create votes (use different users to avoid unique constraint violations)
    console.log("👍 Creating test votes...");
    // 8 likes for modpack1
    for (let i = 0; i < 8; i++) {
        await ModpackVote.create({
            userId: voteUsers[i].id,
            modpackId: modpack1.id,
            vote: 1, // like
        }).save();
    }
    // 2 dislikes for modpack1
    for (let i = 8; i < 10; i++) {
        await ModpackVote.create({
            userId: voteUsers[i].id,
            modpackId: modpack1.id,
            vote: -1, // dislike
        }).save();
    }

    return {
        testUser,
        voteUsers,
        testPublisher,
        modpack1,
        modpack2,
        version1,
        version2,
        version3,
    };
}

async function cleanupTestData(data: any) {
    console.log("🧹 Cleaning up test data...");

    // Delete in reverse order due to foreign keys
    // Note: While CASCADE deletes are configured on the entities,
    // we explicitly delete each entity type for test clarity and to ensure
    // complete cleanup of all test data we created
    await ModpackDownload.delete({ modpackId: data.modpack1.id });
    await ModpackDownload.delete({ modpackId: data.modpack2.id });
    await ModpackVote.delete({ modpackId: data.modpack1.id });
    await ModpackVote.delete({ modpackId: data.modpack2.id });
    await ModpackVersion.delete({ modpackId: data.modpack1.id });
    await ModpackVersion.delete({ modpackId: data.modpack2.id });
    await Modpack.delete({ id: data.modpack1.id });
    await Modpack.delete({ id: data.modpack2.id });
    await Publisher.delete({ id: data.testPublisher.id });
    await User.delete({ id: data.testUser.id });
    
    // Delete vote test users
    if (data.voteUsers) {
        for (const voteUser of data.voteUsers) {
            await User.delete({ id: voteUser.id });
        }
    }
}

async function runTests() {
    console.log("🚀 Starting Analytics API Tests\n");

    try {
        // Initialize database
        console.log("📦 Initializing database connection...");
        await AppDataSource.initialize();
        console.log("✅ Database connected\n");

        // Setup test data
        const testData = await setupTestData();
        console.log("✅ Test data created\n");

        // Initialize analytics service
        const analyticsService = new AnalyticsService();

        // Test 1: Publisher Overview
        console.log("📊 Test 1: Publisher Overview");
        const overview = await analyticsService.getPublisherOverview(testData.testPublisher.id);
        console.log("Total Downloads:", overview.totalDownloads);
        console.log("Total Modpacks:", overview.totalModpacks);
        console.log("Total Likes:", overview.totalLikes);
        console.log("Total Dislikes:", overview.totalDislikes);
        console.log("Top Modpacks:", overview.topModpacks);

        if (overview.totalDownloads !== 18) {
            throw new Error(`Expected 18 downloads, got ${overview.totalDownloads}`);
        }
        if (overview.totalModpacks !== 2) {
            throw new Error(`Expected 2 modpacks, got ${overview.totalModpacks}`);
        }
        console.log("✅ Test 1 passed\n");

        // Test 2: Modpack Analytics
        console.log("📊 Test 2: Modpack Analytics");
        const modpackAnalytics = await analyticsService.getModpackAnalytics(testData.modpack1.id);
        console.log("Modpack Name:", modpackAnalytics.name);
        console.log("Total Downloads:", modpackAnalytics.totalDownloads);
        console.log("Likes:", modpackAnalytics.likes);
        console.log("Dislikes:", modpackAnalytics.dislikes);
        console.log("Net Score:", modpackAnalytics.netScore);
        console.log("Downloads by Version:", modpackAnalytics.downloadsByVersion);

        if (modpackAnalytics.totalDownloads !== 15) {
            throw new Error(`Expected 15 downloads, got ${modpackAnalytics.totalDownloads}`);
        }
        if (modpackAnalytics.downloadsByVersion.length !== 2) {
            throw new Error(`Expected 2 versions, got ${modpackAnalytics.downloadsByVersion.length}`);
        }
        console.log("✅ Test 2 passed\n");

        // Test 3: Version Analytics
        console.log("📊 Test 3: Version Analytics");
        const versionAnalytics = await analyticsService.getVersionAnalytics(testData.version1.id);
        console.log("Version:", versionAnalytics.version);
        console.log("Downloads:", versionAnalytics.downloads);
        console.log("MC Version:", versionAnalytics.mcVersion);
        console.log("Loader Type:", versionAnalytics.loaderType);

        if (versionAnalytics.downloads !== 10) {
            throw new Error(`Expected 10 downloads, got ${versionAnalytics.downloads}`);
        }
        console.log("✅ Test 3 passed\n");

        // Test 4: Downloads Timeline
        console.log("📊 Test 4: Downloads Timeline");
        const timeline = await analyticsService.getDownloadsTimeline(testData.modpack1.id);
        console.log("Timeline entries:", timeline.length);
        if (timeline.length > 0) {
            console.log("Sample entry:", timeline[0]);
        }
        console.log("✅ Test 4 passed\n");

        // Test 5: Votes Timeline
        console.log("📊 Test 5: Votes Timeline");
        const votesTimeline = await analyticsService.getVotesTimeline(testData.modpack1.id);
        console.log("Votes timeline entries:", votesTimeline.length);
        if (votesTimeline.length > 0) {
            console.log("Sample entry:", votesTimeline[0]);
        }
        console.log("✅ Test 5 passed\n");

        // Cleanup
        await cleanupTestData(testData);
        console.log("✅ Cleanup completed\n");

        console.log("🎉 All tests passed!");

    } catch (error) {
        console.error("❌ Test failed:", error);
        throw error;
    } finally {
        // Close database connection
        if (AppDataSource.isInitialized) {
            await AppDataSource.destroy();
            console.log("📦 Database connection closed");
        }
    }
}

// Run tests
runTests().catch(error => {
    console.error("Fatal error:", error);
    process.exit(1);
});
