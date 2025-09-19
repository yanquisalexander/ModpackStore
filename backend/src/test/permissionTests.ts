/**
 * Test file for the granular permissions system
 * This can be run manually to validate the permission hierarchy and functionality
 */

import { Publisher } from '../models/Publisher.model';
import { PublisherMember, PublisherRole } from '../models/PublisherMember.model';
import { ModpackPermission, PublisherPermission } from '../types/enums';

/**
 * Test the permission hierarchy:
 * - Owner should have all permissions (immutable)
 * - Admin should have all permissions (manageable by Owner)
 * - Member should have limited permissions based on scopes
 */
export async function testPermissionHierarchy() {
    console.log('🔒 Testing Permission Hierarchy...\n');

    // Test data - these would normally come from the database
    const testPublisherId = 'test-publisher-id';
    const testModpackId = 'test-modpack-id';
    
    const ownerUserId = 'owner-user-id';
    const adminUserId = 'admin-user-id';
    const memberUserId = 'member-user-id';

    try {
        // Simulate getting a publisher
        const publisher = await Publisher.findById(testPublisherId);
        if (!publisher) {
            console.log('❌ Publisher not found for testing');
            return;
        }

        console.log('✅ Publisher found, testing permission checks...\n');

        // Test Owner permissions
        console.log('👑 Testing Owner permissions:');
        const ownerCanView = await publisher.hasModpackPermission(ownerUserId, testModpackId, ModpackPermission.VIEW);
        const ownerCanModify = await publisher.hasModpackPermission(ownerUserId, testModpackId, ModpackPermission.MODIFY);
        const ownerCanDelete = await publisher.hasModpackPermission(ownerUserId, testModpackId, ModpackPermission.DELETE);
        const ownerCanViewStats = await publisher.hasPublisherPermission(ownerUserId, PublisherPermission.VIEW_STATS);
        
        console.log(`  - Can view modpack: ${ownerCanView ? '✅' : '❌'}`);
        console.log(`  - Can modify modpack: ${ownerCanModify ? '✅' : '❌'}`);
        console.log(`  - Can delete modpack: ${ownerCanDelete ? '✅' : '❌'}`);
        console.log(`  - Can view stats: ${ownerCanViewStats ? '✅' : '❌'}\n`);

        // Test Admin permissions
        console.log('👮 Testing Admin permissions:');
        const adminCanView = await publisher.hasModpackPermission(adminUserId, testModpackId, ModpackPermission.VIEW);
        const adminCanModify = await publisher.hasModpackPermission(adminUserId, testModpackId, ModpackPermission.MODIFY);
        const adminCanDelete = await publisher.hasModpackPermission(adminUserId, testModpackId, ModpackPermission.DELETE);
        const adminCanViewStats = await publisher.hasPublisherPermission(adminUserId, PublisherPermission.VIEW_STATS);
        
        console.log(`  - Can view modpack: ${adminCanView ? '✅' : '❌'}`);
        console.log(`  - Can modify modpack: ${adminCanModify ? '✅' : '❌'}`);
        console.log(`  - Can delete modpack: ${adminCanDelete ? '✅' : '❌'}`);
        console.log(`  - Can view stats: ${adminCanViewStats ? '✅' : '❌'}\n`);

        // Test Member permissions (should be limited)
        console.log('👤 Testing Member permissions (before granting specific permissions):');
        const memberCanView = await publisher.hasModpackPermission(memberUserId, testModpackId, ModpackPermission.VIEW);
        const memberCanModify = await publisher.hasModpackPermission(memberUserId, testModpackId, ModpackPermission.MODIFY);
        const memberCanDelete = await publisher.hasModpackPermission(memberUserId, testModpackId, ModpackPermission.DELETE);
        const memberCanViewStats = await publisher.hasPublisherPermission(memberUserId, PublisherPermission.VIEW_STATS);
        
        console.log(`  - Can view modpack: ${memberCanView ? '✅' : '❌'} (should be ❌)`);
        console.log(`  - Can modify modpack: ${memberCanModify ? '✅' : '❌'} (should be ❌)`);
        console.log(`  - Can delete modpack: ${memberCanDelete ? '✅' : '❌'} (should be ❌)`);
        console.log(`  - Can view stats: ${memberCanViewStats ? '✅' : '❌'} (should be ❌)\n`);

        // Test role management permissions
        console.log('🔐 Testing Role Management permissions:');
        const ownerCanManageAdmin = await publisher.canUserManageRole(ownerUserId, PublisherRole.ADMIN);
        const ownerCanManageMembers = await publisher.canUserManageRole(ownerUserId, PublisherRole.MEMBER);
        const adminCanManageMembers = await publisher.canUserManageRole(adminUserId, PublisherRole.MEMBER);
        const adminCanManageAdmin = await publisher.canUserManageRole(adminUserId, PublisherRole.ADMIN);
        const memberCanManageAnyone = await publisher.canUserManageRole(memberUserId, PublisherRole.MEMBER);
        
        console.log(`  - Owner can manage Admin: ${ownerCanManageAdmin ? '✅' : '❌'}`);
        console.log(`  - Owner can manage Members: ${ownerCanManageMembers ? '✅' : '❌'}`);
        console.log(`  - Admin can manage Members: ${adminCanManageMembers ? '✅' : '❌'}`);
        console.log(`  - Admin can manage Admin: ${adminCanManageAdmin ? '✅' : '❌'} (should be ❌)`);
        console.log(`  - Member can manage anyone: ${memberCanManageAnyone ? '✅' : '❌'} (should be ❌)\n`);

        console.log('🎉 Permission hierarchy test completed!');

    } catch (error) {
        console.error('❌ Error testing permissions:', error);
    }
}

/**
 * Test permission assignment and removal
 */
export async function testPermissionAssignment() {
    console.log('🔧 Testing Permission Assignment...\n');

    const testPublisherId = 'test-publisher-id';
    const testModpackId = 'test-modpack-id';
    const memberUserId = 'member-user-id';

    try {
        const publisher = await Publisher.findById(testPublisherId);
        if (!publisher) {
            console.log('❌ Publisher not found for testing');
            return;
        }

        // Test adding specific permissions to a member
        console.log('➕ Adding VIEW permission to member...');
        await publisher.addMemberScope(memberUserId, {
            modpackId: testModpackId,
            modpackView: true,
            modpackModify: false,
            modpackManageVersions: false,
            modpackPublish: false,
            modpackDelete: false,
            modpackManageAccess: false,
            publisherManageCategoriesTags: false,
            publisherViewStats: false,
        });

        // Verify permission was granted
        const canViewAfterGrant = await publisher.hasModpackPermission(memberUserId, testModpackId, ModpackPermission.VIEW);
        const canModifyAfterGrant = await publisher.hasModpackPermission(memberUserId, testModpackId, ModpackPermission.MODIFY);
        
        console.log(`  - Can view after grant: ${canViewAfterGrant ? '✅' : '❌'} (should be ✅)`);
        console.log(`  - Can modify after grant: ${canModifyAfterGrant ? '✅' : '❌'} (should be ❌)\n`);

        // Test adding more permissions
        console.log('➕ Adding MODIFY permission to member...');
        await publisher.addMemberScope(memberUserId, {
            modpackId: testModpackId,
            modpackView: false,
            modpackModify: true,
            modpackManageVersions: false,
            modpackPublish: false,
            modpackDelete: false,
            modpackManageAccess: false,
            publisherManageCategoriesTags: false,
            publisherViewStats: false,
        });

        const canModifyAfterSecondGrant = await publisher.hasModpackPermission(memberUserId, testModpackId, ModpackPermission.MODIFY);
        console.log(`  - Can modify after second grant: ${canModifyAfterSecondGrant ? '✅' : '❌'} (should be ✅)\n`);

        console.log('🎉 Permission assignment test completed!');

    } catch (error) {
        console.error('❌ Error testing permission assignment:', error);
    }
}

/**
 * Run all permission tests
 */
export async function runAllPermissionTests() {
    console.log('🚀 Starting Granular Permissions System Tests\n');
    console.log('=' .repeat(50) + '\n');

    await testPermissionHierarchy();
    console.log('\n' + '=' .repeat(50) + '\n');
    await testPermissionAssignment();
    
    console.log('\n' + '=' .repeat(50));
    console.log('✨ All permission tests completed!');
    console.log('=' .repeat(50));
}

// Export for use in other test files
export const PermissionTests = {
    testPermissionHierarchy,
    testPermissionAssignment,
    runAllPermissionTests
};