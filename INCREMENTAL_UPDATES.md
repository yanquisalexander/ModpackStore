# Incremental Modpack Updates Implementation

## Overview

This document describes the implementation of incremental modpack updates in Modpack Store, addressing the issue where modpack updates were previously performed destructively by completely removing and reinstalling modpacks.

## Problem Statement

Previously, the modpack update functionality in `spawn_modpack_update_task` worked as follows:

1. Delete all existing modpack files
2. Download and install the entire new modpack from scratch

This approach was:
- **Slow**: Required downloading all files, even unchanged ones
- **Inefficient**: Wasted bandwidth and storage
- **Risky**: Could lose user configurations and settings

## Solution: Incremental Updates

The new implementation reuses the proven incremental validation logic already present in the "Play Now" functionality. This approach:

### 1. Validates Existing Files
- Uses `validate_modpack_assets()` to check existing files against the new manifest
- Identifies which files are missing, corrupted, or have changed
- Returns only files that actually need to be downloaded

### 2. Intelligent File Management
- **Preserves unchanged files**: Files with correct hashes are kept as-is
- **Moves relocated files**: Files with correct hashes are moved to new locations when needed
- **Downloads only what's needed**: Only missing, corrupted, or changed files are downloaded
- **Preserves user settings**: Special handling for files like `options.txt`

### 3. Non-destructive Cleanup
- Removes only files that are truly obsolete (no longer in the new manifest)
- Cleanup errors are non-fatal to prevent update failures

## Implementation Details

### Key Functions Used

1. **`validate_modpack_assets()`** - Validates existing files and returns what needs downloading
2. **`download_and_install_files()`** - Handles incremental downloads and file moving
3. **`cleanup_obsolete_files()`** - Removes obsolete files after successful update

### Update Flow

```
1. Start incremental update task
2. Validate existing files against new manifest
3. Download only files that need updating
4. Move files with correct hashes to new locations
5. Clean up obsolete files
6. Complete update
```

### Progress Reporting

The update process provides detailed progress information:
- Initial validation phase
- Number of files found for update
- Download progress
- Cleanup phase
- Final completion status

## Benefits

### Performance Improvements
- **Significantly faster updates**: Only downloads changed content
- **Reduced bandwidth usage**: No unnecessary downloads
- **Lower disk I/O**: Reuses existing files when possible

### Reliability Improvements
- **Preserves user settings**: Files like `options.txt` are protected
- **Non-destructive approach**: Less risk of data loss
- **Robust error handling**: Update doesn't fail on minor cleanup issues

### User Experience
- **Faster update times**: Users see much quicker update completion
- **Settings preservation**: User configurations are maintained
- **Better progress feedback**: Clear indication of what's being updated

## Code Changes

The main change was in `src/core/instance_manager.rs` in the `spawn_modpack_update_task` function:

### Before (Destructive)
```rust
// Clean up all files first
let removed_files = cleanup_obsolete_files(&instance, &manifest);
// Download entire modpack
let files_processed = download_and_install_files(&instance, &manifest, task_id);
```

### After (Incremental)
```rust
// Validate existing files first
let files_to_download = validate_modpack_assets(&instance, &manifest, task_id);
// Download only what's needed
let processed_count = download_and_install_files(&instance, &manifest, task_id);
// Clean up obsolete files after successful update
let removed_files = cleanup_obsolete_files(&instance, &manifest);
```

## Testing

The implementation reuses battle-tested code from the "Play Now" functionality, which has extensive test coverage in the `modpack_file_manager` module. The core validation and download logic has been proven stable through regular usage.

## Backward Compatibility

This change is fully backward compatible:
- No API changes to external interfaces
- No changes to data structures or file formats
- Existing instances will continue to work normally
- Update behavior is transparent to users (just faster)

## Future Enhancements

Potential future improvements could include:
- Delta downloading for large files
- Parallel validation of multiple modpacks
- Update scheduling and batching
- More granular progress reporting