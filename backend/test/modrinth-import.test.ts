/**
 * Test for Modrinth .mrpack format validation
 * 
 * This test validates .mrpack structure and manifest parsing
 * without requiring database or R2 configuration
 */

import JSZip from 'jszip';

// Sample Modrinth manifest
const sampleManifest = {
    formatVersion: 1,
    game: 'minecraft',
    versionId: 'test-version-1.0.0',
    name: 'Test Modrinth Modpack',
    summary: 'A test modpack for .mrpack import validation',
    files: [
        {
            path: 'mods/sample-mod-1.jar',
            hashes: {
                sha1: 'da39a3ee5e6b4b0d3255bfef95601890afd80709', // Empty file hash
                sha512: 'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e'
            },
            env: {
                client: 'required',
                server: 'required'
            },
            downloads: [
                'https://cdn.modrinth.com/data/sample/versions/sample-mod-1.jar'
            ],
            fileSize: 0
        }
    ],
    dependencies: {
        minecraft: '1.19.2',
        forge: '43.2.0'
    }
};

async function createSampleMrpack(): Promise<Buffer> {
    const zip = new JSZip();
    
    // Add modrinth.index.json
    zip.file('modrinth.index.json', JSON.stringify(sampleManifest, null, 2));
    
    // Add some override files
    zip.file('overrides/config/test-config.toml', 'test = "config"');
    zip.file('overrides/config/mods/test-mod-config.json', '{"enabled": true}');
    zip.file('overrides/resourcepacks/test-pack.zip', 'fake-zip-content');
    zip.file('overrides/shaderpacks/test-shader.zip', 'fake-shader-content');
    zip.file('overrides/options.txt', 'version:3021\nfov:90.0');
    
    const buffer = await zip.generateAsync({ 
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
    });
    
    return buffer;
}

function validateManifest(manifest: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Check required fields
    if (!manifest.name || !manifest.versionId) {
        errors.push('Manifest must have name and versionId');
    }
    
    if (!manifest.dependencies?.minecraft) {
        errors.push('Manifest must specify Minecraft version in dependencies');
    }
    
    if (!Array.isArray(manifest.files)) {
        errors.push('Manifest must have files array');
    }
    
    if (manifest.game !== 'minecraft') {
        errors.push('Only Minecraft modpacks are supported');
    }
    
    // Validate name length
    if (manifest.name?.length > 100) {
        errors.push('Modpack name cannot exceed 100 characters');
    }
    
    // Validate Minecraft version format
    if (manifest.dependencies?.minecraft && !/^\d+\.\d+(\.\d+)?/.test(manifest.dependencies.minecraft)) {
        errors.push('Minecraft version must be valid (e.g., 1.19.2)');
    }
    
    // Check for reasonable file count
    if (manifest.files?.length > 500) {
        errors.push('Too many mods in modpack (maximum 500 supported)');
    }
    
    // Validate that only Forge is used
    if (manifest.dependencies?.['fabric-loader'] || 
        manifest.dependencies?.['quilt-loader'] || 
        manifest.dependencies?.['neoforge']) {
        errors.push('Solo se admite Forge actualmente. Fabric, Quilt y NeoForge no están soportados todavía.');
    }
    
    // Validate file entries
    if (manifest.files) {
        for (const file of manifest.files) {
            if (!file.path || !file.hashes?.sha1 || !Array.isArray(file.downloads) || file.downloads.length === 0) {
                errors.push('All mod files must have valid path, SHA1 hash, and download URLs');
                break;
            }
        }
    }
    
    return { valid: errors.length === 0, errors };
}

async function testModrinthManifestParsing() {
    console.log('\n🧪 Testing Modrinth manifest parsing...');
    
    try {
        const mrpackBuffer = await createSampleMrpack();
        console.log('✓ Sample .mrpack created successfully');
        console.log(`  - Size: ${mrpackBuffer.length} bytes`);
        
        // Extract and validate
        const zip = await JSZip.loadAsync(mrpackBuffer);
        const manifestFile = zip.file('modrinth.index.json');
        
        if (!manifestFile) {
            throw new Error('modrinth.index.json not found');
        }
        
        const manifestContent = await manifestFile.async('text');
        const manifest = JSON.parse(manifestContent);
        
        console.log('✓ Manifest extracted successfully');
        console.log(`  - Format version: ${manifest.formatVersion}`);
        console.log(`  - Game: ${manifest.game}`);
        console.log(`  - Name: ${manifest.name}`);
        console.log(`  - Version: ${manifest.versionId}`);
        console.log(`  - Minecraft: ${manifest.dependencies.minecraft}`);
        console.log(`  - Forge: ${manifest.dependencies.forge}`);
        console.log(`  - Files: ${manifest.files.length}`);
        
        // Validate manifest structure
        const validation = validateManifest(manifest);
        if (!validation.valid) {
            throw new Error(`Manifest validation failed: ${validation.errors.join(', ')}`);
        }
        
        console.log('✓ Manifest validation passed');
        
        // Check override files
        const overrideFiles = Object.keys(zip.files).filter(f => f.startsWith('overrides/'));
        console.log(`✓ Found ${overrideFiles.length} override files`);
        
        overrideFiles.forEach(file => {
            console.log(`  - ${file}`);
        });
        
        return true;
    } catch (error) {
        console.error('✗ Test failed:', error);
        throw error;
    }
}

async function testModrinthValidation() {
    console.log('\n🧪 Testing Modrinth manifest validation...');
    
    const testCases = [
        {
            name: 'Valid Forge modpack',
            manifest: { ...sampleManifest },
            shouldPass: true
        },
        {
            name: 'Invalid game type',
            manifest: { ...sampleManifest, game: 'terraria' },
            shouldPass: false,
            expectedError: 'Only Minecraft modpacks are supported'
        },
        {
            name: 'Missing Minecraft version',
            manifest: { ...sampleManifest, dependencies: { forge: '43.2.0' } },
            shouldPass: false,
            expectedError: 'must specify Minecraft version'
        },
        {
            name: 'Fabric loader (not supported)',
            manifest: { 
                ...sampleManifest, 
                dependencies: { 
                    minecraft: '1.19.2', 
                    'fabric-loader': '0.14.0' 
                } 
            },
            shouldPass: false,
            expectedError: 'Solo se admite Forge'
        },
        {
            name: 'Invalid name length',
            manifest: { 
                ...sampleManifest, 
                name: 'a'.repeat(101) 
            },
            shouldPass: false,
            expectedError: 'name cannot exceed 100 characters'
        },
        {
            name: 'Too many files',
            manifest: { 
                ...sampleManifest, 
                files: new Array(501).fill(sampleManifest.files[0])
            },
            shouldPass: false,
            expectedError: 'Too many mods'
        }
    ];
    
    for (const testCase of testCases) {
        const validation = validateManifest(testCase.manifest);
        
        if (testCase.shouldPass) {
            if (!validation.valid) {
                console.error(`  ✗ ${testCase.name}: Incorrectly rejected`);
                console.error(`    Errors: ${validation.errors.join(', ')}`);
                throw new Error(`Test case failed: ${testCase.name}`);
            }
            console.log(`  ✓ ${testCase.name}: Correctly accepted`);
        } else {
            if (validation.valid) {
                console.error(`  ✗ ${testCase.name}: Should have been rejected`);
                throw new Error(`Test case failed: ${testCase.name}`);
            }
            
            // Check if expected error is present
            const hasExpectedError = validation.errors.some(err => 
                err.includes(testCase.expectedError!)
            );
            
            if (!hasExpectedError) {
                console.error(`  ✗ ${testCase.name}: Wrong error message`);
                console.error(`    Expected: ${testCase.expectedError}`);
                console.error(`    Got: ${validation.errors.join(', ')}`);
                throw new Error(`Test case failed: ${testCase.name}`);
            }
            
            console.log(`  ✓ ${testCase.name}: Correctly rejected (${validation.errors[0]})`);
        }
    }
    
    return true;
}

async function testOverrideFileCategories() {
    console.log('\n🧪 Testing override file categorization...');
    
    const zip = new JSZip();
    zip.file('modrinth.index.json', JSON.stringify(sampleManifest));
    
    // Add various override files
    const testFiles = [
        { path: 'overrides/config/forge.toml', category: 'config' },
        { path: 'overrides/config/mods/mod-config.json', category: 'config' },
        { path: 'overrides/resourcepacks/pack.zip', category: 'resourcepacks' },
        { path: 'overrides/shaderpacks/shader.zip', category: 'shaderpacks' },
        { path: 'overrides/datapacks/data.zip', category: 'datapacks' },
        { path: 'overrides/options.txt', category: 'extras' },
        { path: 'overrides/screenshots/shot.png', category: 'extras' }
    ];
    
    testFiles.forEach(file => {
        zip.file(file.path, 'test content');
    });
    
    const buffer = await zip.generateAsync({ type: 'nodebuffer' });
    
    // Verify structure
    const loadedZip = await JSZip.loadAsync(buffer);
    
    console.log('✓ Override files organized by category:');
    testFiles.forEach(file => {
        const exists = loadedZip.file(file.path);
        if (exists) {
            console.log(`  - ${file.path} → ${file.category}`);
        } else {
            throw new Error(`Missing file: ${file.path}`);
        }
    });
    
    return true;
}

async function testFileHashStructure() {
    console.log('\n🧪 Testing file hash structure...');
    
    const testFile = sampleManifest.files[0];
    
    // Verify hash structure
    if (!testFile.hashes.sha1) {
        throw new Error('Missing SHA1 hash');
    }
    
    if (!/^[a-f0-9]{40}$/.test(testFile.hashes.sha1)) {
        throw new Error('Invalid SHA1 hash format');
    }
    
    console.log('✓ File hash structure validated');
    console.log(`  - SHA1: ${testFile.hashes.sha1}`);
    console.log(`  - Path: ${testFile.path}`);
    console.log(`  - Size: ${testFile.fileSize} bytes`);
    console.log(`  - Downloads: ${testFile.downloads.length} URLs`);
    
    return true;
}

async function main() {
    console.log('🚀 Modrinth .mrpack Format Tests\n');
    console.log('='.repeat(50));
    
    try {
        await testModrinthManifestParsing();
        await testModrinthValidation();
        await testOverrideFileCategories();
        await testFileHashStructure();
        
        console.log('\n' + '='.repeat(50));
        console.log('✅ All Modrinth format tests passed!');
        console.log('\nNote: These tests validate .mrpack structure and manifest format.');
        console.log('Integration tests with database/R2 require full environment setup.');
        process.exit(0);
    } catch (error) {
        console.error('\n' + '='.repeat(50));
        console.error('❌ Modrinth format tests failed:', error);
        process.exit(1);
    }
}

main();
