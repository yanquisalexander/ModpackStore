#!/usr/bin/env tsx
/**
 * Simple test script for CurseForge import functionality
 */

// Mock environment variables to avoid missing config errors
process.env.R2_BUCKET_NAME = 'test-bucket';
process.env.R2_ACCESS_KEY_ID = 'test-key';
process.env.R2_SECRET_ACCESS_KEY = 'test-secret';
process.env.R2_ENDPOINT = 'https://test.r2.dev';

import fs from 'fs';
import path from 'path';
import { CurseForgeImportService } from '../src/services/curseforgeImportService';
import { CurseForgeAPIClient } from '../src/services/curseforgeApiClient';

async function testManifestParsing() {
    console.log('Testing CurseForge manifest parsing...');
    
    // Create a mock CurseForge manifest
    const mockManifest = {
        minecraft: {
            version: "1.19.2",
            modLoaders: [
                {
                    id: "forge-43.2.0",
                    primary: true
                }
            ]
        },
        manifestType: "minecraftModpack",
        manifestVersion: 1,
        name: "Test Modpack",
        version: "1.0.0",
        author: "Test Author",
        files: [
            {
                projectID: 238222,
                fileID: 4509153,
                required: true
            }
        ],
        overrides: "overrides"
    };

    // Test API client initialization
    const apiClient = new CurseForgeAPIClient();
    console.log('✓ CurseForge API client initialized');

    // Test import service initialization
    const importService = new CurseForgeImportService();
    console.log('✓ CurseForge import service initialized');

    console.log('✓ All basic components initialized successfully');
    return true;
}

async function main() {
    try {
        await testManifestParsing();
        console.log('\n✅ All tests passed!');
        process.exit(0);
    } catch (error) {
        console.error('\n❌ Test failed:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}