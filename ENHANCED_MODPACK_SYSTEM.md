# Enhanced Modpack Update System

This document describes the improvements made to the modpack update system to address the requirements for better cleanup logic, task management, and database schema flexibility.

## Overview

The enhanced system implements three main areas of improvement:

1. **Database Schema Updates** - Modified to support multiple file paths with the same hash
2. **Enhanced Task Management** - Prevents tasks from getting stuck and ensures proper titles
3. **Differentiated File Cleanup** - Smart cleanup strategies based on directory type

## Database Changes

### ModpackVersionFile Entity

**Before:**
- Primary Key: `(file_hash, modpack_version_id)`
- Problem: Same file couldn't exist in multiple paths within one modpack version

**After:**
- Primary Key: `(file_hash, modpack_version_id, path)`
- Benefit: Same file (hash) can exist in different locations within the same modpack version

This change resolves issues where the same mod file might need to be placed in different subdirectories (e.g., `mods/1.18/mod.jar` and `mods/1.19/mod.jar`).

## Enhanced Task Management

### Key Improvements

1. **Proper Task Titles**: Fixed incorrect usage of `add_task()` where task IDs were being passed as titles
2. **Anti-Stuck Mechanism**: New `add_task_with_auto_start()` prevents tasks from staying in "En espera" (Pending) state
3. **Validation**: Enhanced `update_task()` validates task existence before attempting updates
4. **Periodic Cleanup**: Background service automatically handles stuck and old tasks

### New Functions

```rust
// Create task with auto-start capability
let task_id = add_task_with_auto_start("Validación de assets", data);

// Check for stuck pending tasks (run periodically)
cleanup_stuck_pending_tasks(120); // 2 minutes timeout

// Start background cleanup service
start_periodic_task_cleanup();
```

## Enhanced File Cleanup System

### Differentiated Cleanup Strategies

The system now uses different cleanup approaches based on the directory type:

#### 1. Strict Cleanup (mods/, coremods/)
- **Behavior**: Remove any files not in the current manifest
- **Reason**: Prevents mod conflicts and ensures clean mod environment
- **Applies to**: `mods/`, `coremods/`

```rust
// Files in mods/ not in manifest are always removed
if file_to_clean.starts_with("mods/") {
    fs::remove_file(&file_path)?; // Strict removal
}
```

#### 2. Synchronized Cleanup (config/, resources/, etc.)
- **Behavior**: Try to move files to new locations if the same hash is needed elsewhere
- **Reason**: Avoids re-downloading files that just need to be relocated
- **Applies to**: `config/`, `resources/`, `scripts/`, etc.

```rust
// For config files, check if file should be moved to new location
if let Some(target_location) = find_new_location_for_hash(file_hash) {
    fs::rename(old_path, new_path)?; // Move instead of delete
}
```

### Cleanup Process Flow

1. **Pre-validation Cleanup**: Always run before asset validation
2. **Directory Scanning**: Only scan modpack-controlled directories
3. **Hash Calculation**: For non-mod files, calculate hash to check for relocations
4. **Smart Processing**:
   - Mods: Remove if not in manifest
   - Configs: Move to new location if hash matches, otherwise remove
5. **Empty Directory Removal**: Clean up empty folders after file operations

### Benefits

- **Reduced Downloads**: Files are moved instead of re-downloaded when possible
- **Consistent State**: Mods folder always matches manifest exactly
- **Performance**: Avoids unnecessary network transfers
- **User Experience**: Preserves config files by moving them instead of deleting

## Usage Examples

### Backend (TypeORM)

```typescript
// Create modpack version file with new composite key
const versionFile = ModpackVersionFile.create({
    fileHash: "abc123...",
    modpackVersionId: "uuid-here",
    path: "mods/1.19/example-mod.jar"
});

// Same file can now exist in multiple paths
const versionFile2 = ModpackVersionFile.create({
    fileHash: "abc123...", // Same hash
    modpackVersionId: "uuid-here", // Same version
    path: "mods/1.18/example-mod.jar" // Different path - now allowed!
});
```

### Rust Client

```rust
// Enhanced task creation with proper title
let task_id = add_task_with_auto_start(
    "Validación de assets - MyModpack",
    Some(json!({"instanceId": "123"}))
);

// Cleanup with new strategies
let removed_files = cleanup_obsolete_files(&instance, &manifest)?;

// Start background task maintenance
start_periodic_task_cleanup();
```

## Migration Notes

### Database Migration
- The TypeORM schema will automatically update due to `synchronize: true`
- Existing data should migrate smoothly as the new primary key is a superset of the old one

### Runtime Behavior
- Tasks now have more descriptive titles visible to users
- Cleanup is more intelligent and preserves files when possible
- Background services prevent task management issues

## Testing

The implementation includes comprehensive tests for:

- Hash calculation consistency
- Differentiated cleanup behavior
- Task state management
- File movement vs. removal logic

Run tests with:
```bash
cd application/src-tauri
cargo test modpack_file_manager
```

## Performance Considerations

- Hash calculation is only performed for non-mod files during cleanup
- File scanning is limited to modpack-controlled directories
- Background cleanup runs every 5 minutes with minimal resource usage
- File moves are attempted before downloads to save bandwidth

## Security and Safety

- Essential Minecraft files are never touched (libraries/, versions/, saves/, etc.)
- Double-validation prevents accidental deletion of important files
- Task state transitions are validated to prevent invalid state changes
- All file operations include proper error handling and logging