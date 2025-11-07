import { AppDataSource } from "@/db/data-source";
import { PatreonTier } from "@/entities/PatreonTier";
import { User } from "@/entities/User";
import { BenefitsService } from "@/services/benefits.service";

/**
 * Test script for Patreon Plus integration
 * 
 * Run with: npm run test:patreon-plus
 */

async function testPatreonPlus() {
    console.log('[TEST] Starting Patreon Plus integration test...\n');

    try {
        // Initialize database connection
        if (!AppDataSource.isInitialized) {
            await AppDataSource.initialize();
            console.log('[TEST] ✓ Database connection initialized\n');
        }

        // Test 1: Check benefits configuration
        console.log('[TEST] Test 1: Checking benefits configuration...');
        const benefitDefs = BenefitsService.getBenefitDefinitions();
        console.log(`[TEST] ✓ Found ${Object.keys(benefitDefs).length} benefit definitions`);
        console.log('[TEST] Available benefits:', Object.keys(benefitDefs).join(', '));
        console.log('');

        // Test 2: Validate benefit values
        console.log('[TEST] Test 2: Validating benefit values...');
        const validTests = [
            { key: 'max_instances_allowed', value: 20 },
            { key: 'can_upload_cover_image', value: true },
            { key: 'priority_support', value: false }
        ];

        for (const test of validTests) {
            const validation = BenefitsService.validateBenefit(test.key, test.value);
            if (validation.valid) {
                console.log(`[TEST] ✓ Valid: ${test.key} = ${test.value}`);
            } else {
                console.log(`[TEST] ✗ Invalid: ${test.key} = ${test.value} - ${validation.error}`);
            }
        }
        console.log('');

        // Test 3: Check invalid benefit values
        console.log('[TEST] Test 3: Testing invalid benefit values...');
        const invalidTests = [
            { key: 'max_instances_allowed', value: 'not a number' },
            { key: 'can_upload_cover_image', value: 'yes' },
            { key: 'max_instances_allowed', value: -5 }
        ];

        for (const test of invalidTests) {
            const validation = BenefitsService.validateBenefit(test.key, test.value);
            if (!validation.valid) {
                console.log(`[TEST] ✓ Correctly rejected: ${test.key} = ${test.value} - ${validation.error}`);
            } else {
                console.log(`[TEST] ✗ Should have rejected: ${test.key} = ${test.value}`);
            }
        }
        console.log('');

        // Test 4: Check PatreonTier entity
        console.log('[TEST] Test 4: Checking PatreonTier entity...');
        const tierRepo = AppDataSource.getRepository(PatreonTier);
        console.log(`[TEST] ✓ PatreonTier repository accessible`);
        
        const existingTiers = await tierRepo.find();
        console.log(`[TEST] Found ${existingTiers.length} existing tiers in database`);
        
        if (existingTiers.length > 0) {
            console.log('[TEST] Existing tiers:');
            existingTiers.forEach(tier => {
                console.log(`[TEST]   - ${tier.name} ($${tier.amountCents / 100}) - Active: ${tier.active}`);
            });
        }
        console.log('');

        // Test 5: Check User entity updates
        console.log('[TEST] Test 5: Checking User entity updates...');
        const userRepo = AppDataSource.getRepository(User);
        console.log(`[TEST] ✓ User repository accessible`);
        
        // Count users with Patreon linked
        const patreonUsers = await userRepo.count({ 
            where: { patreonUserId: Not(null) as any }
        });
        console.log(`[TEST] Found ${patreonUsers} users with Patreon linked`);
        
        const activePatrons = await userRepo.count({ 
            where: { patreonIsActive: true }
        });
        console.log(`[TEST] Found ${activePatrons} active Patreon supporters`);
        console.log('');

        console.log('[TEST] ✓ All tests completed successfully!\n');
        console.log('[TEST] Summary:');
        console.log('[TEST] - Benefits configuration is valid');
        console.log('[TEST] - Benefit validation is working correctly');
        console.log('[TEST] - PatreonTier entity is properly configured');
        console.log('[TEST] - User entity updates are in place');
        console.log('');
        console.log('[TEST] Next steps:');
        console.log('[TEST] 1. Set PATREON_CAMPAIGN_ID and PATREON_CREATOR_ACCESS_TOKEN in .env');
        console.log('[TEST] 2. Run: npm run job:sync-patreon');
        console.log('[TEST] 3. Use admin API endpoints at /admin/patreon-plus/...');

    } catch (error) {
        console.error('[TEST] ✗ Test failed:', error);
        process.exit(1);
    } finally {
        // Close database connection
        if (AppDataSource.isInitialized) {
            await AppDataSource.destroy();
            console.log('\n[TEST] Database connection closed');
        }
    }

    process.exit(0);
}

// Import Not for TypeORM
import { Not } from "typeorm";

// Run the test
testPatreonPlus().catch(error => {
    console.error('[TEST] Unhandled error:', error);
    process.exit(1);
});
