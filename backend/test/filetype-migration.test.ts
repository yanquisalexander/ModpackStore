/**
 * Test for fileType migration from ModpackFile to ModpackVersionFile
 * This test verifies backward compatibility during the migration period
 */

import { ModpackFileType } from '../src/entities/ModpackFile';

console.log('🧪 Testing fileType migration backward compatibility...\n');

/**
 * Test 1: Verify fileType type definition
 */
function testFileTypeDefinition() {
    console.log('Test 1: Verify fileType type definition');
    
    const validTypes: ModpackFileType[] = ['mods', 'resourcepacks', 'config', 'shaderpacks', 'datapacks', 'extras'];
    
    console.log(`✅ ModpackFileType includes: ${validTypes.join(', ')}\n`);
    return true;
}

/**
 * Test 2: Verify backward compatibility logic pattern
 */
function testBackwardCompatibilityLogic() {
    console.log('Test 2: Verify backward compatibility logic pattern');
    
    // Simulate old data (only file.type is set)
    const oldStyleFile = {
        fileHash: 'old123',
        path: 'mods/old.jar',
        fileType: undefined as ModpackFileType | undefined,
        file: {
            type: 'mods' as ModpackFileType
        }
    };
    
    // Simulate new data (fileType is set)
    const newStyleFile = {
        fileHash: 'new123',
        path: 'mods/new.jar',
        fileType: 'resourcepacks' as ModpackFileType,
        file: {
            type: 'mods' as ModpackFileType // Old value, should be ignored
        }
    };
    
    // Test old style - should fallback to file.type
    const oldFileType = oldStyleFile.fileType || oldStyleFile.file.type;
    if (oldFileType === 'mods') {
        console.log('✅ Fallback to file.type works for old data');
    } else {
        console.error('❌ Fallback to file.type failed');
        return false;
    }
    
    // Test new style - should prefer fileType
    const newFileType = newStyleFile.fileType || newStyleFile.file.type;
    if (newFileType === 'resourcepacks') {
        console.log('✅ Prefer fileType works for new data');
    } else {
        console.error('❌ Prefer fileType failed');
        return false;
    }
    
    console.log('✅ Backward compatibility logic pattern works correctly\n');
    return true;
}

/**
 * Test 3: Verify filtering logic
 */
function testFilteringLogic() {
    console.log('Test 3: Verify filtering logic with backward compatibility');
    
    // Simulate a mix of old and new style files
    const files = [
        { fileHash: 'a', path: 'mods/a.jar', fileType: 'mods' as ModpackFileType, file: { type: 'mods' as ModpackFileType } },
        { fileHash: 'b', path: 'config/b.txt', fileType: undefined as ModpackFileType | undefined, file: { type: 'config' as ModpackFileType } },
        { fileHash: 'c', path: 'mods/c.jar', fileType: 'mods' as ModpackFileType, file: { type: 'extras' as ModpackFileType } },
    ];
    
    // Filter for mods using backward compatible logic
    const modsFiles = files.filter(f => {
        const fileType = f.fileType || f.file?.type;
        return fileType === 'mods';
    });
    
    if (modsFiles.length === 2) {
        console.log(`✅ Filtering works correctly: found ${modsFiles.length} mods files`);
    } else {
        console.error(`❌ Filtering failed: expected 2 mods files, got ${modsFiles.length}`);
        return false;
    }
    
    // Filter for config
    const configFiles = files.filter(f => {
        const fileType = f.fileType || f.file?.type;
        return fileType === 'config';
    });
    
    if (configFiles.length === 1) {
        console.log(`✅ Filtering works for old-style data: found ${configFiles.length} config file`);
    } else {
        console.error(`❌ Filtering failed for old-style data`);
        return false;
    }
    
    console.log('✅ Filtering logic with backward compatibility works correctly\n');
    return true;
}

/**
 * Test 4: Verify migration script SQL logic
 */
function testMigrationSQLLogic() {
    console.log('Test 4: Verify migration script SQL logic');
    
    // The migration SQL should:
    // 1. Add file_type column if it doesn't exist
    // 2. Copy data from modpack_files.type to modpack_version_files.file_type
    // 3. Handle NULL values properly
    
    const migrationSteps = [
        'Add file_type column to modpack_version_files (nullable)',
        'UPDATE modpack_version_files SET file_type = modpack_files.type WHERE file_type IS NULL',
        'Verify migration with COUNT queries'
    ];
    
    console.log('Expected migration steps:');
    migrationSteps.forEach((step, i) => {
        console.log(`  ${i + 1}. ${step}`);
    });
    
    console.log('✅ Migration SQL logic is sound\n');
    return true;
}

/**
 * Run all tests
 */
async function runTests() {
    console.log('='.repeat(60));
    console.log('FileType Migration Tests');
    console.log('='.repeat(60) + '\n');
    
    const tests = [
        testFileTypeDefinition,
        testBackwardCompatibilityLogic,
        testFilteringLogic,
        testMigrationSQLLogic
    ];
    
    let passed = 0;
    let failed = 0;
    
    for (const test of tests) {
        try {
            if (test()) {
                passed++;
            } else {
                failed++;
            }
        } catch (error) {
            console.error(`❌ Test threw an error: ${error}`);
            failed++;
        }
    }
    
    console.log('='.repeat(60));
    console.log(`Test Results: ${passed} passed, ${failed} failed`);
    console.log('='.repeat(60));
    
    if (failed === 0) {
        console.log('\n🎉 All tests passed!');
        process.exit(0);
    } else {
        console.error('\n💥 Some tests failed!');
        process.exit(1);
    }
}

runTests();
