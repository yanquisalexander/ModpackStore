// src/examples/granular-permissions-demo.ts
import "reflect-metadata";
import { PERMISSIONS } from "../utils/permissions";
import { granularScopeSchema } from "../models/Publisher.typeorm";
import { scopeSchema } from "../models/Publisher.model";

/**
 * Demonstration of the granular permissions system
 * This script shows how the new permission system works without requiring a database
 */

console.log("🔒 Granular Permissions System Demo");
console.log("=====================================\n");

// 1. Show available permissions
console.log("📋 Available Granular Permissions:");
console.log("==================================");
Object.entries(PERMISSIONS).forEach(([key, value]) => {
    console.log(`  ${key}: '${value}'`);
});

console.log("\n🎭 Role Hierarchy:");
console.log("==================");
console.log("  OWNER   (Level 3): ✅ All permissions, immutable, cannot be removed");
console.log("  ADMIN   (Level 2): ✅ All permissions, can manage Members, cannot modify Owner");
console.log("  MEMBER  (Level 1): ❌ Limited permissions, can access own modpacks + explicit grants");

console.log("\n📝 Permission Scope Examples:");
console.log("=============================");

// Example organization-level scope
const orgScope = {
    publisherId: "123e4567-e89b-12d3-a456-426614174000",
    publisherManageCategoriesTags: true,
    publisherViewStats: true,
    modpackView: false,
    modpackModify: false,
    modpackManageVersions: false,
    modpackPublish: false,
    modpackDelete: false,
    modpackManageAccess: false
};

console.log("  Organization-level scope:");
console.log("  ", JSON.stringify(orgScope, null, 4));

// Example modpack-specific scope
const modpackScope = {
    modpackId: "456e7890-e89b-12d3-a456-426614174001",
    modpackView: true,
    modpackModify: true,
    modpackManageVersions: true,
    modpackPublish: false,
    modpackDelete: false,
    modpackManageAccess: false,
    publisherManageCategoriesTags: false,
    publisherViewStats: false
};

console.log("\n  Modpack-specific scope:");
console.log("  ", JSON.stringify(modpackScope, null, 4));

console.log("\n🔍 Schema Validation:");
console.log("=====================");

// Test schema validation
try {
    const validOrgScope = granularScopeSchema.parse(orgScope);
    console.log("  ✅ Organization scope validation: PASSED");
} catch (error) {
    console.log("  ❌ Organization scope validation: FAILED", error);
}

try {
    const validModpackScope = granularScopeSchema.parse(modpackScope);
    console.log("  ✅ Modpack scope validation: PASSED");
} catch (error) {
    console.log("  ❌ Modpack scope validation: FAILED", error);
}

// Test invalid scope (missing both publisherId and modpackId)
try {
    const invalidScope = {
        modpackView: true,
        modpackModify: true
    };
    granularScopeSchema.parse(invalidScope);
    console.log("  ❌ Invalid scope validation: SHOULD HAVE FAILED");
} catch (error) {
    console.log("  ✅ Invalid scope validation: CORRECTLY FAILED");
}

console.log("\n📊 Permission Matrix:");
console.log("=====================");
console.log("  Role    | View | Modify | Versions | Publish | Delete | Access | Categories | Stats");
console.log("  --------|------|--------|----------|---------|--------|--------|------------|-------");
console.log("  Owner   |  ✅   |   ✅    |    ✅     |    ✅    |   ✅    |   ✅    |     ✅      |   ✅  ");
console.log("  Admin   |  ✅   |   ✅    |    ✅     |    ✅    |   ✅    |   ✅    |     ✅      |   ✅  ");
console.log("  Member  |  📝*  |   📝*   |    📝*    |    📝*   |   📝*   |   📝*   |     📝*     |   📝* ");
console.log("");
console.log("  📝* = Only with explicit permission grant or for own modpacks");

console.log("\n🔄 Member Default Behavior:");
console.log("===========================");
console.log("  ✅ Can view modpacks they created");
console.log("  ✅ Can modify modpacks they created");
console.log("  ✅ Can manage versions of modpacks they created");
console.log("  ❌ Cannot publish modpacks (requires explicit permission)");
console.log("  ❌ Cannot delete modpacks (requires explicit permission)");
console.log("  ❌ Cannot manage access for other members (requires explicit permission)");
console.log("  ❌ Cannot manage publisher categories/tags (requires explicit permission)");
console.log("  ❌ Cannot view publisher stats (requires explicit permission)");

console.log("\n🚀 Usage Examples:");
console.log("==================");
console.log(`
  // Grant modpack view permission to a member for a specific modpack
  await grantPermissions(memberId, {
    modpackView: true
  }, undefined, modpackId);

  // Grant organization-level stats viewing permission
  await grantPermissions(memberId, {
    publisherViewStats: true
  }, publisherId, undefined);

  // Check if user can view a modpack
  const canView = await canViewModpack(userId, publisherId, modpackId, modpackCreatedBy);

  // Check specific permission
  const hasPermission = await hasPermission(userId, publisherId, PERMISSIONS.MODPACK_PUBLISH, modpackId);
`);

console.log("✨ Demo completed! The granular permissions system is ready to use.");