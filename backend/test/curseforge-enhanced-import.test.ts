#!/usr/bin/env tsx
/**
 * Enhanced test script for CurseForge import functionality
 * Tests the new folder-based processing
 */

// Mock environment variables to avoid missing config errors
process.env.R2_BUCKET_NAME = 'test-bucket';
process.env.R2_ACCESS_KEY_ID = 'test-key';
process.env.R2_SECRET_ACCESS_KEY = 'test-secret';
process.env.R2_ENDPOINT = 'https://test.r2.dev';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';

import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';

async function createMockCurseForgeZip(): Promise<Buffer> {
    const zip = new JSZip();
    
    // Add manifest.json
    const manifest = {
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
        name: "Test Enhanced Modpack",
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
    
    zip.file('manifest.json', JSON.stringify(manifest, null, 2));
    
    // Add override files in different categories
    zip.file('overrides/config/forge-common.toml', 'forge config content');
    zip.file('overrides/config/client.cfg', 'client config content');
    zip.file('overrides/resourcepacks/texture-pack.zip', 'fake texture pack');
    zip.file('overrides/shaderpacks/shader.zip', 'fake shader pack');
    zip.file('overrides/datapacks/custom-datapack.zip', 'fake datapack');
    zip.file('overrides/datapacks/subfolder/recipe.json', '{"type": "crafting_shaped"}');
    zip.file('overrides/options.txt', 'minecraft options file');
    zip.file('overrides/servers.dat', 'minecraft servers file');
    zip.file('overrides/screenshots/screenshot1.png', 'fake screenshot');
    
    return zip.generateAsync({ type: 'nodebuffer' });
}

async function testEnhancedImport() {
    console.log('Testing enhanced CurseForge import with folder categorization...');
    
    // Create mock ZIP
    const zipBuffer = await createMockCurseForgeZip();
    console.log('✓ Created mock CurseForge ZIP with various file categories');
    
    // Test the import service
    const { CurseForgeImportService } = await import('../src/services/curseforgeImportService');
    const importService = new CurseForgeImportService();
    
    // Test the extraction method directly (using reflection to access private method)
    const extractMethod = (importService as any).extractAndParseZip;
    const result = await extractMethod.call(importService, zipBuffer, '/tmp/test');
    
    console.log('✓ Successfully extracted and parsed ZIP');
    console.log('✓ Manifest parsed:', result.manifest.name);
    
    // Check that files are properly categorized
    const { overrideFilesByCategory } = result;
    
    console.log('\n📁 File categorization results:');
    for (const [category, files] of overrideFilesByCategory) {
        if (files.length > 0) {
            console.log(`  ${category}: ${files.length} files`);
            files.forEach(file => {
                console.log(`    - ${file.path}`);
            });
        }
    }
    
    // Validate expected categories
    const expectedCategories = ['config', 'resourcepacks', 'shaderpacks', 'datapacks', 'extras'];
    for (const category of expectedCategories) {
        if (!overrideFilesByCategory.has(category)) {
            throw new Error(`Missing expected category: ${category}`);
        }
    }
    
    // Validate specific file counts
    const configFiles = overrideFilesByCategory.get('config')!;
    const datapackFiles = overrideFilesByCategory.get('datapacks')!;
    const extrasFiles = overrideFilesByCategory.get('extras')!;
    
    if (configFiles.length !== 2) {
        throw new Error(`Expected 2 config files, got ${configFiles.length}`);
    }
    
    if (datapackFiles.length !== 2) {
        throw new Error(`Expected 2 datapack files, got ${datapackFiles.length}`);
    }
    
    if (extrasFiles.length !== 3) {
        throw new Error(`Expected 3 extras files, got ${extrasFiles.length}`);
    }
    
    console.log('✓ All file categories validated successfully');
    
    // Test the file type determination method
    const determineMethod = (importService as any).determineOverrideFileType;
    
    const testCases = [
        { input: 'config/forge.toml', expected: 'config' },
        { input: 'resourcepacks/pack.zip', expected: 'resourcepacks' },
        { input: 'shaderpacks/shader.zip', expected: 'shaderpacks' },
        { input: 'datapacks/data.zip', expected: 'datapacks' },
        { input: 'options.txt', expected: 'extras' },
        { input: 'screenshots/shot.png', expected: 'extras' }
    ];
    
    for (const testCase of testCases) {
        const result = determineMethod.call(importService, testCase.input);
        if (result !== testCase.expected) {
            throw new Error(`Expected ${testCase.input} to be ${testCase.expected}, got ${result}`);
        }
    }
    
    console.log('✓ File type determination working correctly');
    
    return true;
}

async function main() {
    try {
        await testEnhancedImport();
        console.log('\n✅ All enhanced import tests passed!');
        process.exit(0);
    } catch (error) {
        console.error('\n❌ Enhanced import test failed:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}