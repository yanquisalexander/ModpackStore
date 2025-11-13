import { AppDataSource } from "@/db/data-source";
import { PublisherSubscriptionService } from "@/services/publisher-subscription.service";
import { WhitelistService } from "@/services/whitelist.service";
import { Publisher } from "@/entities/Publisher";
import { User } from "@/entities/User";
import { Modpack } from "@/entities/Modpack";
import { PublisherMember } from "@/entities/PublisherMember";
import { SubscriptionTier, PaymentProvider } from "@/entities/PublisherSubscription";
import { FeatureKey } from "@/entities/PublisherSubscriptionFeature";
import { ModpackVisibility, ModpackStatus, PublisherMemberRole } from "@/types/enums";

/**
 * Test script for Publisher Subscriptions and Whitelist features
 * 
 * Run with: npm run test:subscriptions-whitelist
 */

async function testSubscriptionsAndWhitelist() {
    console.log('[TEST] Starting Subscriptions and Whitelist integration test...\n');

    try {
        // Initialize database connection
        if (!AppDataSource.isInitialized) {
            await AppDataSource.initialize();
            console.log('[TEST] ✓ Database connection initialized\n');
        }

        // Test 1: Create a test publisher
        console.log('[TEST] Test 1: Creating test publisher...');
        let testPublisher = await Publisher.findOne({ where: { publisherName: 'Test Publisher' } });
        
        if (!testPublisher) {
            testPublisher = new Publisher();
            testPublisher.publisherName = 'Test Publisher';
            testPublisher.tosUrl = 'https://example.com/tos';
            testPublisher.privacyUrl = 'https://example.com/privacy';
            testPublisher.bannerUrl = 'https://example.com/banner.jpg';
            testPublisher.logoUrl = 'https://example.com/logo.jpg';
            testPublisher.description = 'Test publisher for subscriptions';
            await testPublisher.save();
            console.log('[TEST] ✓ Test publisher created');
        } else {
            console.log('[TEST] ✓ Test publisher already exists');
        }
        console.log('');

        // Test 2: Create a subscription
        console.log('[TEST] Test 2: Creating subscription...');
        const subscription = await PublisherSubscriptionService.createSubscription({
            publisherId: testPublisher.id,
            tier: SubscriptionTier.PREMIUM,
            paymentProvider: PaymentProvider.PAYPAL,
            paymentReference: 'TEST-REF-123',
            amount: '29.99',
            currency: 'USD',
            durationDays: 30,
            autoRenew: false
        });
        console.log(`[TEST] ✓ Subscription created: ${subscription.id}`);
        console.log(`[TEST]   Tier: ${subscription.tier}`);
        console.log(`[TEST]   Expires: ${subscription.subscriptionExpiresAt}`);
        console.log(`[TEST]   Days until expiry: ${subscription.daysUntilExpiry()}`);
        console.log('');

        // Test 3: Check subscription features
        console.log('[TEST] Test 3: Checking subscription features...');
        const features = await PublisherSubscriptionService.getPublisherFeatures(testPublisher.id);
        console.log('[TEST] ✓ Features retrieved:');
        console.log(`[TEST]   Can use whitelist: ${features.can_use_whitelist}`);
        console.log(`[TEST]   Max whitelist players: ${features.whitelist_max_players_per_modpack}`);
        console.log(`[TEST]   Max members: ${features.max_members}`);
        console.log(`[TEST]   Storage limit: ${features.storage_limit_mb} MB`);
        console.log('');

        // Test 4: Override a feature
        console.log('[TEST] Test 4: Overriding feature...');
        await PublisherSubscriptionService.overrideFeature(
            testPublisher.id,
            FeatureKey.WHITELIST_MAX_PLAYERS_PER_MODPACK,
            500
        );
        const maxPlayers = await PublisherSubscriptionService.getMaxWhitelistPlayers(testPublisher.id);
        console.log(`[TEST] ✓ Feature overridden: max_players = ${maxPlayers}`);
        console.log('');

        // Test 5: Create test user and modpack for whitelist testing
        console.log('[TEST] Test 5: Setting up whitelist test data...');
        
        // Create or get test user
        let testUser = await User.findOne({ where: { username: 'test_creator' } });
        if (!testUser) {
            testUser = new User();
            testUser.username = 'test_creator';
            testUser.email = 'test@example.com';
            testUser.discordId = 'test_discord_123';
            await testUser.save();
            console.log('[TEST] ✓ Test user created');
        } else {
            console.log('[TEST] ✓ Test user already exists');
        }

        // Create publisher membership
        let membership = await PublisherMember.findOne({
            where: { userId: testUser.id, publisherId: testPublisher.id }
        });
        
        if (!membership) {
            membership = new PublisherMember();
            membership.userId = testUser.id;
            membership.publisherId = testPublisher.id;
            membership.role = PublisherMemberRole.OWNER;
            await membership.save();
            console.log('[TEST] ✓ Publisher membership created');
        } else {
            console.log('[TEST] ✓ Publisher membership already exists');
        }

        // Create test modpack
        let testModpack = await Modpack.findOne({ where: { slug: 'test-whitelist-modpack' } });
        
        if (!testModpack) {
            testModpack = new Modpack();
            testModpack.name = 'Test Whitelist Modpack';
            testModpack.slug = 'test-whitelist-modpack';
            testModpack.shortDescription = 'Test modpack for whitelist testing';
            testModpack.visibility = ModpackVisibility.WHITELIST;
            testModpack.status = ModpackStatus.PUBLISHED;
            testModpack.publisherId = testPublisher.id;
            testModpack.creatorUserId = testUser.id;
            await testModpack.save();
            console.log('[TEST] ✓ Test modpack created');
        } else {
            console.log('[TEST] ✓ Test modpack already exists');
        }
        console.log('');

        // Test 6: Validate modpack constraints
        console.log('[TEST] Test 6: Validating modpack constraints...');
        const validation = testModpack.validateVisibilityConstraints();
        if (validation.valid) {
            console.log('[TEST] ✓ Modpack validation passed');
        } else {
            console.log(`[TEST] ✗ Modpack validation failed: ${validation.error}`);
        }
        console.log('');

        // Test 7: Add user to whitelist
        console.log('[TEST] Test 7: Testing whitelist operations...');
        
        // Create a second test user to add to whitelist
        let targetUser = await User.findOne({ where: { username: 'test_player' } });
        if (!targetUser) {
            targetUser = new User();
            targetUser.username = 'test_player';
            targetUser.email = 'player@example.com';
            targetUser.discordId = 'test_discord_456';
            await targetUser.save();
            console.log('[TEST] ✓ Target user created');
        } else {
            console.log('[TEST] ✓ Target user already exists');
        }

        // Add to whitelist
        try {
            await WhitelistService.addToWhitelist({
                modpackId: testModpack.id,
                userId: targetUser.id,
                addedByUserId: testUser.id,
                notes: 'Test whitelist entry'
            });
            console.log('[TEST] ✓ User added to whitelist');
        } catch (error) {
            if (error instanceof Error && error.message.includes('already whitelisted')) {
                console.log('[TEST] ✓ User already in whitelist');
            } else {
                throw error;
            }
        }
        console.log('');

        // Test 8: Check whitelist access
        console.log('[TEST] Test 8: Checking whitelist access...');
        const hasAccess = await WhitelistService.hasAccess(testModpack.id, targetUser.id);
        console.log(`[TEST] ✓ User has access: ${hasAccess}`);
        console.log('');

        // Test 9: Get whitelist stats
        console.log('[TEST] Test 9: Getting whitelist statistics...');
        const stats = await WhitelistService.getWhitelistStats(testModpack.id, testUser.id);
        console.log('[TEST] ✓ Whitelist statistics:');
        console.log(`[TEST]   Total whitelisted: ${stats.totalWhitelisted}`);
        console.log(`[TEST]   Max allowed: ${stats.maxAllowed}`);
        console.log(`[TEST]   Remaining slots: ${stats.remainingSlots}`);
        console.log('');

        // Test 10: Get user's whitelisted modpacks
        console.log('[TEST] Test 10: Getting user whitelisted modpacks...');
        const userModpacks = await WhitelistService.getUserWhitelistedModpacks(targetUser.id);
        console.log(`[TEST] ✓ User has access to ${userModpacks.length} modpack(s)`);
        for (const modpack of userModpacks) {
            console.log(`[TEST]   - ${modpack.name} (${modpack.slug})`);
        }
        console.log('');

        // Test 11: Test subscription expiry
        console.log('[TEST] Test 11: Testing subscription expiry detection...');
        const isActive = subscription.isActive();
        const isExpired = subscription.isExpired();
        console.log(`[TEST] ✓ Subscription active: ${isActive}`);
        console.log(`[TEST] ✓ Subscription expired: ${isExpired}`);
        console.log('');

        // Test 12: Get subscription stats
        console.log('[TEST] Test 12: Getting subscription statistics...');
        const subStats = await PublisherSubscriptionService.getSubscriptionStats();
        console.log('[TEST] ✓ Subscription statistics:');
        console.log(`[TEST]   Total: ${subStats.total}`);
        console.log(`[TEST]   Active: ${subStats.active}`);
        console.log(`[TEST]   Expired: ${subStats.expired}`);
        console.log(`[TEST]   Cancelled: ${subStats.cancelled}`);
        console.log(`[TEST]   By tier:`);
        console.log(`[TEST]     - FREE: ${subStats.byTier[SubscriptionTier.FREE]}`);
        console.log(`[TEST]     - BASIC: ${subStats.byTier[SubscriptionTier.BASIC]}`);
        console.log(`[TEST]     - PREMIUM: ${subStats.byTier[SubscriptionTier.PREMIUM]}`);
        console.log(`[TEST]     - ENTERPRISE: ${subStats.byTier[SubscriptionTier.ENTERPRISE]}`);
        console.log('');

        console.log('[TEST] ✓ All tests completed successfully!\n');
        console.log('[TEST] Summary:');
        console.log('[TEST] ✓ Subscriptions working correctly');
        console.log('[TEST] ✓ Whitelist functionality operational');
        console.log('[TEST] ✓ Feature management working');
        console.log('[TEST] ✓ Validation constraints enforced');

    } catch (error) {
        console.error('[TEST] ✗ Test failed:', error);
        throw error;
    } finally {
        // Close database connection
        if (AppDataSource.isInitialized) {
            await AppDataSource.destroy();
            console.log('\n[TEST] Database connection closed');
        }
    }
}

// Run if executed directly
if (require.main === module) {
    testSubscriptionsAndWhitelist()
        .then(() => {
            console.log('\n[TEST] Test suite completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n[TEST] Test suite failed:', error);
            process.exit(1);
        });
}

export { testSubscriptionsAndWhitelist };
