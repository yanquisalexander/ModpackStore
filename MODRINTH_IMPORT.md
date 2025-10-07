# Modrinth .mrpack Import Support

## Overview

This document describes the implementation of support for Modrinth's .mrpack modpack format in ModpackStore.

## Backend Implementation

### Components Added

#### 1. Type Definitions (`backend/src/types/modrinth.ts`)

Defines TypeScript interfaces for the Modrinth modpack format based on the official specification:
- `ModrinthManifest`: Main manifest structure from `modrinth.index.json`
- `ModrinthFile`: Individual file metadata with hashes and download URLs
- `ModrinthDependencies`: Game and modloader dependencies
- `ModrinthImportResult`: Import operation result

#### 2. Import Service (`backend/src/services/modrinthImportService.ts`)

Complete import service with the following capabilities:

**Features:**
- Extracts and parses `modrinth.index.json` from .mrpack ZIP files
- Validates manifest structure and requirements
- Downloads mods from Modrinth CDN with hash verification (SHA1)
- Processes override files organized by category (config, resourcepacks, shaderpacks, datapacks, extras)
- Parallel downloads with configurable concurrency
- Automatic deduplication of files by hash
- Error handling and cleanup

**Validation:**
- Only Minecraft modpacks are supported
- Only Forge modloader is currently supported (Fabric, Quilt, NeoForge rejected)
- Validates Minecraft version format
- Enforces modpack name length (max 100 characters)
- Limits mod count (max 500 mods)
- Verifies file structure (path, hashes, download URLs)

**Process Flow:**
1. Extract ZIP and parse `modrinth.index.json`
2. Validate manifest structure
3. Create Modpack and ModpackVersion entities
4. Download mods with parallel workers
5. Verify file hashes (SHA1)
6. Process override files by category
7. Upload files to R2 storage
8. Create file associations in database
9. Cleanup temporary files

#### 3. API Endpoint (`backend/src/routes/v1/creators/modpacks.route.ts`)

New endpoint for importing .mrpack files:

```
POST /v1/creators/publishers/:publisherId/modpacks/import/modrinth
```

**Parameters:**
- `mrpackFile`: The .mrpack file (multipart/form-data)
- `slug` (optional): Custom slug for the modpack
- `visibility` (optional): Modpack visibility setting
- `parallelDownloads` (optional): Number of parallel downloads (1-10, default: 5)

**Authentication:**
- Requires organization membership (admin, owner, or member)

**Response:**
```json
{
  "success": true,
  "message": "Modpack importado exitosamente desde Modrinth",
  "data": {
    "modpack": {
      "id": "uuid",
      "name": "Modpack Name",
      "version": "1.0.0"
    },
    "stats": {
      "totalMods": 150,
      "downloadedMods": 148,
      "failedMods": 2,
      "overrideFiles": 25
    },
    "errors": ["2 mods could not be downloaded from Modrinth"]
  }
}
```

### Testing

Comprehensive test suite in `backend/test/modrinth-import.test.ts`:

- ✅ Manifest parsing from .mrpack files
- ✅ Manifest validation (game type, dependencies, modloaders)
- ✅ Override file categorization
- ✅ File hash structure validation
- ✅ Edge cases (invalid formats, missing fields, unsupported loaders)

Run tests with:
```bash
cd backend
npx tsx test/modrinth-import.test.ts
```

## .mrpack Format Specification

A .mrpack file is a ZIP archive containing:

### 1. `modrinth.index.json`
Main manifest file with:
- `formatVersion`: Format version (currently 1)
- `game`: Must be "minecraft"
- `versionId`: Modpack version identifier
- `name`: Modpack name
- `summary`: Optional description
- `files[]`: Array of mod files with hashes and download URLs
- `dependencies`: Minecraft version and modloader info

### 2. `overrides/` Directory
Files to be copied directly to the instance:
- `config/`: Configuration files
- `resourcepacks/`: Resource packs
- `shaderpacks/`: Shader packs
- `datapacks/`: Data packs
- Other files: Treated as extras

## Usage for Creators

1. Navigate to your publisher's modpacks section
2. Click "Import from Modrinth" or similar option
3. Select a .mrpack file from your computer
4. Configure import options:
   - Custom slug (optional)
   - Visibility settings
   - Parallel download count
5. Wait for import to complete
6. Review imported modpack and publish when ready

## Current Limitations

### Modloader Support
- ✅ **Forge**: Fully supported
- ❌ **Fabric**: Not yet supported
- ❌ **Quilt**: Not yet supported
- ❌ **NeoForge**: Not yet supported

Attempting to import modpacks with unsupported modloaders will result in an error:
```
"Solo se admite Forge actualmente. Fabric, Quilt y NeoForge no están soportados todavía."
```

### Client-Side Support
The backend implementation is complete, but client-side features are not yet implemented:

**Pending Features:**
- [ ] Drag-and-drop .mrpack files in "My Instances" section
- [ ] Import button with file picker
- [ ] Installation dialog with mod options selection
- [ ] Modloader compatibility verification UI
- [ ] Direct .mrpack file opening (double-click support)

## Future Enhancements

### Short-term
1. Add support for Fabric, Quilt, and NeoForge modloaders
2. Implement client-side .mrpack installation
3. Add optional mod selection during import
4. Improve error reporting and progress tracking

### Long-term
1. Export modpacks to .mrpack format
2. Automatic update detection for Modrinth-sourced modpacks
3. Batch import multiple .mrpack files
4. Modrinth API integration for direct mod resolution

## Technical Details

### File Hash Verification
All downloaded mods are verified using SHA1 hashes from the manifest:
```typescript
const computedHash = crypto.createHash('sha1').update(modContent).digest('hex');
if (computedHash !== modFile.hashes.sha1) {
  // Hash mismatch - reject file
}
```

### Parallel Download Management
Uses semaphore pattern for controlled concurrency:
```typescript
const semaphore = new Semaphore(concurrency);
await semaphore.acquire();
try {
  // Download and process file
} finally {
  semaphore.release();
}
```

### Error Handling
- Network errors: Retries with alternative download URLs
- Hash mismatches: Rejects file and reports in stats
- Database conflicts: Handles duplicate key errors gracefully
- Cleanup: Always removes temporary files, even on error

## References

- [Official Modrinth Modpack Format Specification](https://support.modrinth.com/en/articles/8802351-modrinth-modpack-format-mrpack)
- [Modrinth API Documentation](https://docs.modrinth.com/)
- [CurseForge Import Service](backend/src/services/curseforgeImportService.ts) - Reference implementation

## Contributing

When extending .mrpack support, please:
1. Update type definitions in `backend/src/types/modrinth.ts`
2. Add validation logic to `validateManifest()`
3. Write tests for new functionality
4. Update this documentation
5. Follow existing patterns from CurseForge import service
