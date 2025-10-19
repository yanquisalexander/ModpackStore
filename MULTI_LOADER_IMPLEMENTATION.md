# Multi-Loader Support Implementation Summary

## Overview
This document summarizes the implementation of comprehensive support for multiple mod loaders (Forge, Fabric, NeoForge, Quilt) in ModpackStore.

## Changes Implemented

### 1. Backend (Node.js + TypeORM)

#### Database Schema
- **Added new enum**: `ModLoaderType` with values: `VANILLA`, `FORGE`, `FABRIC`, `NEOFORGE`, `QUILT`
- **Updated `ModpackVersion` entity**:
  - Added `loaderType` field (enum)
  - Added `loaderVersion` field (string, nullable)
  - Kept `forgeVersion` field for backward compatibility

#### API Changes
- **Updated `/creators/publishers/:publisherId/modpacks/:modpackId/versions` endpoint**:
  - Now accepts `loaderType` and `loaderVersion` in request body
  - Maintains backward compatibility with `forgeVersion`
  - Returns new loader fields in responses

#### Migration Script
- Created `migrate-loader-types.ts` to migrate existing data
- Script populates `loaderType` and `loaderVersion` from existing `forgeVersion` data
- Can be run with: `npm run db:migrate-loader-types`

### 2. Rust Application Core

#### Type Definitions
- **Added `ModLoaderType` enum** with variants:
  - `Vanilla`
  - `Forge`
  - `Fabric`
  - `NeoForge`
  - `Quilt`

#### MinecraftInstance Updates
- Added `loaderType: ModLoaderType` field (defaults to Vanilla)
- Added `loaderVersion: Option<String>` field
- Kept `forgeVersion` for backward compatibility
- Added helper methods:
  - `is_forge_instance()`
  - `is_vanilla_instance()`
  - `is_fabric_instance()`
  - `is_neoforge_instance()`
  - `is_quilt_instance()`
  - `get_loader_name()`

#### Manifest Updates
- Updated `ModpackManifest` struct to include:
  - `loader_type: Option<String>`
  - `loader_version: Option<String>`

#### Instance Creation
- Updated `create_local_instance()` to accept:
  - `loader_type: Option<String>`
  - `loader_version: Option<String>`
- Updated `create_modpack_instance_struct()` to handle loader fields from manifest
- Both functions maintain backward compatibility with `forgeVersion`

### 3. Frontend UI (React + TypeScript)

#### Type Definitions
- **Added `ModLoaderType` type**: `'vanilla' | 'forge' | 'fabric' | 'neoforge' | 'quilt'`
- **Updated `MinecraftInstance` interface**:
  - Added `loaderType?: ModLoaderType`
  - Added `loaderVersion?: string`
  - Kept `forgeVersion` for backward compatibility
- **Updated `ModpackVersion` interface**:
  - Added `loaderType` and `loaderVersion` fields
  - Kept `forgeVersion` for backward compatibility

#### CreateInstanceDialog
- Expanded instance type selection from 2 (Vanilla, Forge) to 5 options:
  - Vanilla (Creeper icon, blue)
  - Forge (Anvil icon, orange)
  - Fabric (Feather icon, green)
  - NeoForge (Hammer icon, purple)
  - Quilt (Package icon, pink)
- Added state management for loader versions
- Updated validation to check for required loader version
- Shows "Coming Soon" alert for Fabric, NeoForge, and Quilt (not yet fully implemented)

#### CreateVersionDialog
- Updated form to include `loaderType` and `loaderVersion` fields
- Sends loader information to API when creating new modpack versions
- Maintains backward compatibility with existing `forgeVersion` field

## Backward Compatibility

All changes maintain full backward compatibility:

1. **Database**: Old records with only `forgeVersion` are automatically migrated
2. **API**: Accepts both old (`forgeVersion`) and new (`loaderType`, `loaderVersion`) formats
3. **Rust**: Handles instances with only `forgeVersion` set
4. **Frontend**: TypeScript types mark new fields as optional

## Migration Path

### For Existing Data
1. Deploy backend with new fields
2. Run migration script: `npm run db:migrate-loader-types`
3. All existing Forge instances will be converted to use `loaderType=FORGE`
4. Vanilla instances (no forgeVersion) will be set to `loaderType=VANILLA`

### For Developers
- Old code using `forgeVersion` continues to work
- New code should use `loaderType` and `loaderVersion`
- Both fields are synchronized for Forge instances

## Implementation Status ✅

### ✅ Rust Loader Installation (COMPLETE)
- ✅ Created loader installers in `loaders/` module:
  - ✅ `FabricInstaller` - Integrates with meta.fabricmc.net API
  - ✅ `NeoForgeInstaller` - Downloads and executes NeoForge installer
  - ✅ `QuiltInstaller` - Integrates with meta.quiltmc.org API
- ✅ Added bootstrap methods to `InstanceBootstrap`:
  - ✅ `bootstrap_fabric_instance()`
  - ✅ `bootstrap_neoforge_instance()`
  - ✅ `bootstrap_quilt_instance()`
- ✅ Updated task spawning to handle all loader types

### ✅ Instance Launcher Updates (COMPLETE)
- ✅ Updated `MinecraftPaths` to track loader type and version
- ✅ Updated `manifest_file()` to locate correct JSON for each loader:
  - Fabric: `fabric-loader-{version}-{mc_version}.json`
  - NeoForge: `{mc_version}-neoforge-{version}.json` or `neoforge-{version}.json`
  - Quilt: `quilt-loader-{version}-{mc_version}.json`
- ✅ Classpath and JVM arguments handled via version JSON inheritance

### ✅ Frontend Enhancements (COMPLETE)
- ✅ Implemented version fetching for Fabric, NeoForge, Quilt
  - Fabric: Fetches from https://meta.fabricmc.net/v2
  - NeoForge: Fetches from https://maven.neoforged.net/api
  - Quilt: Fetches from https://meta.quiltmc.org/v3
- ✅ Removed "Coming Soon" alerts
- ✅ Added functional Select components for loader versions
- 🔄 Loader badges/icons (optional future enhancement)
- 🔄 Instance details view enhancements (optional)

### ⏳ Testing (Pending)
- ⏳ Test vanilla instance creation and launch
- ⏳ Test Forge instance creation and launch (existing)
- ⏳ Test Fabric instance creation and launch
- ⏳ Test NeoForge instance creation and launch
- ⏳ Test Quilt instance creation and launch
- ⏳ Test modpack creation with different loaders
- ⏳ Test migration of existing data

## Files Modified

### Backend (Previous PR)
- `backend/src/types/enums.ts`
- `backend/src/entities/ModpackVersion.ts`
- `backend/src/routes/v1/creators/modpacks.route.ts`
- `backend/package.json`
- `backend/src/db/migrate-loader-types.ts` (new)

### Rust (This Implementation)
- `application/src-tauri/src/core/minecraft_instance.rs`
- `application/src-tauri/src/core/instance_manager.rs`
- `application/src-tauri/src/core/instance_bootstrap.rs` (added bootstrap methods)
- `application/src-tauri/src/core/minecraft/paths.rs` (updated for all loaders)
- `application/src-tauri/src/core/bootstrap/mod.rs` (added loaders module)
- `application/src-tauri/src/core/bootstrap/loaders/mod.rs` (new)
- `application/src-tauri/src/core/bootstrap/loaders/fabric.rs` (new)
- `application/src-tauri/src/core/bootstrap/loaders/neoforge.rs` (new)
- `application/src-tauri/src/core/bootstrap/loaders/quilt.rs` (new)
- `application/src-tauri/src/core/modpack_file_manager.rs`

### Frontend (This Implementation)
- `application/src/types/TauriCommandReturns.d.ts`
- `application/src/types/modpacks.d.ts`
- `application/src/components/CreateInstanceDialog.tsx` (removed "Coming Soon", added version fetching)
- `application/src/components/creator/CreateVersionDialog.tsx`

### Documentation (This Implementation)
- `MULTI_LOADER_QUICK_START.md` (updated status)
- `MULTI_LOADER_IMPLEMENTATION.md` (this file - updated status)

## API Examples

### Creating a Modpack Version with Fabric
```json
POST /creators/publishers/{publisherId}/modpacks/{modpackId}/versions
{
  "versionName": "1.0.0",
  "mcVersion": "1.20.1",
  "loaderType": "fabric",
  "loaderVersion": "0.15.0",
  "changelog": "Initial release with Fabric support"
}
```

### Creating a Vanilla Instance
```javascript
invoke('create_local_instance', {
  instanceName: "My Vanilla World",
  mcVersion: "1.20.1",
  loaderType: "vanilla",
  loaderVersion: null
})
```

### Creating a Forge Instance (Backward Compatible)
```javascript
// Old way (still works)
invoke('create_local_instance', {
  instanceName: "My Modded World",
  mcVersion: "1.20.1",
  forgeVersion: "47.2.0"
})

// New way
invoke('create_local_instance', {
  instanceName: "My Modded World",
  mcVersion: "1.20.1",
  loaderType: "forge",
  loaderVersion: "47.2.0"
})
```

## Notes

- All loader types are now selectable in the UI
- Fabric, NeoForge, and Quilt show "Coming Soon" as installation logic is not implemented
- The foundation is laid for full multi-loader support
- Implementation follows a modular, extensible pattern for easy addition of new loaders
