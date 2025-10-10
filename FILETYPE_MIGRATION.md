# FileType Migration from ModpackFile to ModpackVersionFile

## Overview

This migration moves the `fileType` field from `ModpackFile` to `ModpackVersionFile` to better reflect that file types are version-specific rather than file-specific.

## Why This Migration?

Previously, the file type (e.g., `mods`, `config`, `resourcepacks`) was stored in `ModpackFile`, which represents a physical file by its hash. However, the same file hash could theoretically be used in different contexts across different versions, making the type ambiguous. By moving `fileType` to `ModpackVersionFile`, we make the relationship clearer: each file in a specific version has a specific type.

## Changes Made

### 1. Entity Changes

#### `ModpackVersionFile` Entity
- **Added**: `fileType` column (nullable, varchar(32))
- **Location**: `backend/src/entities/ModpackVersionFile.ts`

```typescript
@Column({ name: "file_type", type: "varchar", length: 32, nullable: true })
fileType?: ModpackFileType;
```

#### `ModpackFile` Entity
- **Deprecated**: `type` column (kept for backward compatibility)
- **Location**: `backend/src/entities/ModpackFile.ts`

```typescript
/**
 * @deprecated This field is deprecated. Use ModpackVersionFile.fileType instead.
 * Kept for backward compatibility during migration.
 */
@Column({ name: "type", type: "varchar", length: 32 })
type: ModpackFileType;
```

### 2. Service Updates

All services now write `fileType` to both `ModpackVersionFile` (new) and `ModpackFile` (deprecated):

- `backend/src/services/modpackFileUpload.ts`
- `backend/src/services/modrinthImportService.ts`
- `backend/src/services/curseforgeImportService.ts`

### 3. Route Updates

All routes now read from `ModpackVersionFile.fileType` with fallback to `ModpackFile.type`:

- `backend/src/routes/v1/creators/modpacks.route.ts`

```typescript
// Backward compatible filtering
const filesOfType = version.files.filter(vf => {
    const fileType = vf.fileType || vf.file?.type;
    return fileType === type;
});
```

### 4. Frontend Updates

Updated TypeScript interfaces to include the new field:

- `application/src/views/creator/ModpackVersionDetailView.tsx`
- `application/src/views/publisher/PublisherModpackVersionDetailView.tsx`

```typescript
interface ModpackVersionFile {
    fileHash: string;
    path: string;
    fileType?: 'mods' | 'resourcepacks' | 'config' | 'shaderpacks' | 'extras' | 'datapacks';
    file: {
        type: 'mods' | 'resourcepacks' | 'config' | 'shaderpacks' | 'extras'; // DEPRECATED
    };
    size?: number;
}
```

## Migration Steps

### Step 1: Run the Migration Script

The migration script will:
1. Add the `file_type` column to `modpack_version_files` table (if not exists)
2. Copy existing values from `modpack_files.type` to `modpack_version_files.file_type`
3. Verify the migration with statistics

```bash
cd backend
npm run db:migrate-filetype
```

### Step 2: Verify Migration

Check the migration statistics output to ensure all rows were migrated successfully.

### Step 3: Test the Application

Run the application and verify that:
- File uploads work correctly
- File filtering by type works
- Import services (CurseForge, Modrinth) work correctly

## Backward Compatibility

During the transition period, the code maintains backward compatibility:

1. **Write Operations**: Both `ModpackVersionFile.fileType` and `ModpackFile.type` are populated
2. **Read Operations**: Code prefers `ModpackVersionFile.fileType` but falls back to `ModpackFile.type` if null
3. **Delete Operations**: Handle files with either field set

Example:
```typescript
// This works for both old and new data
const fileType = versionFile.fileType || versionFile.file?.type;
```

## Testing

Run the migration tests to verify backward compatibility:

```bash
cd backend
npm run test:filetype-migration
```

Expected output:
```
✅ ModpackFileType includes: mods, resourcepacks, config, shaderpacks, datapacks, extras
✅ Fallback to file.type works for old data
✅ Prefer fileType works for new data
✅ Backward compatibility logic pattern works correctly
```

## Future Breaking Changes (Not in This PR)

In a future update, after all data is migrated and the system is stable:

1. Remove the `type` column from `ModpackFile` entity
2. Remove backward compatibility code (fallbacks)
3. Make `ModpackVersionFile.fileType` non-nullable
4. Update API documentation

## Rollback Plan

If issues occur:

1. The `ModpackFile.type` field is still populated, so old code will continue to work
2. No data is lost during migration (only copied)
3. Can revert code changes and continue using `ModpackFile.type`

## Notes

- `fileType` is manually defined, not auto-detected
- All file operations continue to work during migration
- No API breaking changes - both frontend and backend are backward compatible
- The migration is idempotent (safe to run multiple times)

## Related Files

- Migration script: `backend/src/db/migrate-filetype.ts`
- Migration test: `backend/test/filetype-migration.test.ts`
- Entity definitions: `backend/src/entities/ModpackFile.ts`, `backend/src/entities/ModpackVersionFile.ts`
