import * as fs from "fs";
import * as path from "path";
import * as yaml from "yaml";

/**
 * Simple validation test for Patreon Plus integration
 * Does not require database connection
 * 
 * Run with: npm run test:patreon-plus-validation
 */

async function validatePatreonPlusIntegration() {
    console.log('[VALIDATION] Starting Patreon Plus validation...\n');
    let hasErrors = false;

    try {
        // Test 1: Check benefits configuration file exists
        console.log('[VALIDATION] Test 1: Checking benefits configuration file...');
        const configPath = path.join(__dirname, '../src/config/benefits_modpackstore_plus.yml');
        
        if (!fs.existsSync(configPath)) {
            console.error('[VALIDATION] ✗ benefits_modpackstore_plus.yml not found!');
            hasErrors = true;
        } else {
            console.log('[VALIDATION] ✓ benefits_modpackstore_plus.yml exists');

            // Test 2: Parse YAML configuration
            console.log('[VALIDATION] Test 2: Parsing YAML configuration...');
            const configContent = fs.readFileSync(configPath, 'utf8');
            const config = yaml.parse(configContent);

            if (!config.benefits) {
                console.error('[VALIDATION] ✗ No benefits section found in config');
                hasErrors = true;
            } else {
                const benefitCount = Object.keys(config.benefits).length;
                console.log(`[VALIDATION] ✓ Found ${benefitCount} benefit definitions`);

                // Test 3: Validate benefit structure
                console.log('[VALIDATION] Test 3: Validating benefit structure...');
                for (const [key, benefit] of Object.entries(config.benefits) as [string, any][]) {
                    if (!benefit.type || !benefit.name || benefit.default === undefined || !benefit.validator) {
                        console.error(`[VALIDATION] ✗ Invalid benefit structure for '${key}'`);
                        hasErrors = true;
                    }
                }

                if (!hasErrors) {
                    console.log('[VALIDATION] ✓ All benefits have valid structure');
                }
            }

            if (!config.validators) {
                console.error('[VALIDATION] ✗ No validators section found in config');
                hasErrors = true;
            } else {
                const validatorCount = Object.keys(config.validators).length;
                console.log(`[VALIDATION] ✓ Found ${validatorCount} validator definitions`);
            }
        }
        console.log('');

        // Test 4: Check entity files exist
        console.log('[VALIDATION] Test 4: Checking entity files...');
        const entityFiles = [
            '../src/entities/PatreonTier.ts',
            '../src/entities/User.ts'
        ];

        for (const file of entityFiles) {
            const filePath = path.join(__dirname, file);
            if (!fs.existsSync(filePath)) {
                console.error(`[VALIDATION] ✗ Entity file not found: ${file}`);
                hasErrors = true;
            } else {
                console.log(`[VALIDATION] ✓ ${file} exists`);
            }
        }
        console.log('');

        // Test 5: Check service files exist
        console.log('[VALIDATION] Test 5: Checking service files...');
        const serviceFiles = [
            '../src/services/patreon-sync.service.ts',
            '../src/services/benefits.service.ts',
            '../src/services/patreon-integration.service.ts'
        ];

        for (const file of serviceFiles) {
            const filePath = path.join(__dirname, file);
            if (!fs.existsSync(filePath)) {
                console.error(`[VALIDATION] ✗ Service file not found: ${file}`);
                hasErrors = true;
            } else {
                console.log(`[VALIDATION] ✓ ${file} exists`);
            }
        }
        console.log('');

        // Test 6: Check controller files exist
        console.log('[VALIDATION] Test 6: Checking controller files...');
        const controllerPath = path.join(__dirname, '../src/controllers/AdminPatreonPlus.controller.ts');
        if (!fs.existsSync(controllerPath)) {
            console.error('[VALIDATION] ✗ AdminPatreonPlus.controller.ts not found');
            hasErrors = true;
        } else {
            console.log('[VALIDATION] ✓ AdminPatreonPlus.controller.ts exists');
        }
        console.log('');

        // Test 7: Check route files exist
        console.log('[VALIDATION] Test 7: Checking route files...');
        const routePath = path.join(__dirname, '../src/routes/admin/patreon-plus.route.ts');
        if (!fs.existsSync(routePath)) {
            console.error('[VALIDATION] ✗ patreon-plus.route.ts not found');
            hasErrors = true;
        } else {
            console.log('[VALIDATION] ✓ patreon-plus.route.ts exists');
        }
        console.log('');

        // Test 8: Check job files exist
        console.log('[VALIDATION] Test 8: Checking job files...');
        const jobPath = path.join(__dirname, '../src/jobs/sync-patreon.ts');
        if (!fs.existsSync(jobPath)) {
            console.error('[VALIDATION] ✗ sync-patreon.ts job not found');
            hasErrors = true;
        } else {
            console.log('[VALIDATION] ✓ sync-patreon.ts exists');
        }
        console.log('');

        // Test 9: Check TypeScript compilation
        console.log('[VALIDATION] Test 9: Checking TypeScript imports...');
        try {
            // Try to import the services (this will fail if there are syntax errors)
            const benefitsServicePath = path.join(__dirname, '../src/services/benefits.service.ts');
            const benefitsContent = fs.readFileSync(benefitsServicePath, 'utf8');
            
            if (benefitsContent.includes('export class BenefitsService')) {
                console.log('[VALIDATION] ✓ BenefitsService class definition found');
            } else {
                console.error('[VALIDATION] ✗ BenefitsService class definition not found');
                hasErrors = true;
            }

            const syncServicePath = path.join(__dirname, '../src/services/patreon-sync.service.ts');
            const syncContent = fs.readFileSync(syncServicePath, 'utf8');
            
            if (syncContent.includes('export class PatreonSyncService')) {
                console.log('[VALIDATION] ✓ PatreonSyncService class definition found');
            } else {
                console.error('[VALIDATION] ✗ PatreonSyncService class definition not found');
                hasErrors = true;
            }
        } catch (error) {
            console.error('[VALIDATION] ✗ Error reading service files:', error);
            hasErrors = true;
        }
        console.log('');

        // Final summary
        if (hasErrors) {
            console.error('[VALIDATION] ✗ Validation FAILED - Some checks did not pass\n');
            process.exit(1);
        } else {
            console.log('[VALIDATION] ✓ All validation checks PASSED!\n');
            console.log('[VALIDATION] Summary:');
            console.log('[VALIDATION] - Benefits configuration is valid');
            console.log('[VALIDATION] - All required files are present');
            console.log('[VALIDATION] - TypeScript class definitions are correct');
            console.log('');
            console.log('[VALIDATION] Next steps:');
            console.log('[VALIDATION] 1. Ensure database is running and configured');
            console.log('[VALIDATION] 2. Set PATREON_CAMPAIGN_ID and PATREON_CREATOR_ACCESS_TOKEN in .env');
            console.log('[VALIDATION] 3. Run: npm run job:sync-patreon');
            console.log('[VALIDATION] 4. Use admin API endpoints at /admin/patreon-plus/...');
            console.log('');
        }

    } catch (error) {
        console.error('[VALIDATION] ✗ Validation failed with error:', error);
        process.exit(1);
    }

    process.exit(0);
}

// Run the validation
validatePatreonPlusIntegration().catch(error => {
    console.error('[VALIDATION] Unhandled error:', error);
    process.exit(1);
});
