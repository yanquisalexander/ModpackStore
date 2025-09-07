# Enhanced Modpack Update System

This document describes the improvements made to the modpack update system to implement a manifest-as-source-of-truth approach.

## Problem Statement

The original system had an issue where files that moved between modpack versions but didn't change content (same SHA1 hash) would remain in their old locations, causing inconsistencies. The system would find the correct hash and skip downloading, but the file would still be in the wrong location according to the new manifest.

## Solution Overview

The enhanced system implements the following key improvements:

### 1. Hash-Based File Discovery

- **Function**: `build_hash_to_path_map()`
- **Purpose**: Scans the instance directory and creates a HashMap of `file_hash -> relative_path`
- **Scope**: Only scans modpack-relevant directories for performance:
  - `mods/`, `coremods/`, `scripts/`, `resources/`, `packmenu/`
  - `structures/`, `schematics/`, `config/`, `changelogs/`
  - Standalone files like `manifest.json`, `modlist.html`

### 2. Enhanced File Processing Logic

The updated `download_and_install_files()` function now follows this workflow:

```
For each file in manifest:
1. Check if file exists at correct location with correct hash
   → If yes: Skip (already correct)
   
2. Check if file with same hash exists elsewhere in instance
   → If yes: Move file to correct location
   → If move fails: Fall back to download
   
3. If no file with correct hash exists anywhere
   → Download file to correct location
```

### 3. Improved Validation

The `validate_modpack_assets()` function now:
- Builds a hash map first for efficient lookups
- Considers files that exist elsewhere with correct hash as valid (will be moved)
- Only marks files for download if no copy with the required hash exists anywhere

### 4. Enhanced Cleanup

- Recursive empty directory removal after file cleanup
- Proper handling of moved files during cleanup process
- Maintains safety checks for essential Minecraft files

## Technical Implementation

### Core Functions

#### `build_hash_to_path_map(minecraft_dir: &Path) -> HashMap<String, PathBuf>`
Efficiently builds a lookup table of all existing files by their SHA1 hash.

#### `scan_directory_for_hashes(dir: &Path, minecraft_dir: &Path, hash_map: &mut HashMap<String, PathBuf>)`
Recursively scans directories and computes file hashes for the lookup table.

#### Enhanced `download_and_install_files()`
Main processing function that handles the three scenarios:
1. File at correct location ✓
2. File exists elsewhere → Move
3. File doesn't exist → Download

### Performance Considerations

- Hash map building is done once per update operation
- Only scans modpack-relevant directories to avoid performance issues
- Uses efficient file operations (rename) for moving files
- Maintains parallel download capabilities for new files

### Safety Features

- Verifies file hash before moving (safety check)
- Falls back to download if move operation fails
- Preserves existing error handling and retry logic
- Maintains all existing progress reporting

## Benefits

1. **Manifest as Source of Truth**: Files always end up in the location specified by the manifest
2. **Reduced Downloads**: Moves existing files instead of re-downloading when possible
3. **Consistency**: Eliminates file location inconsistencies between versions
4. **Performance**: Avoids unnecessary downloads for moved files
5. **Cleanup**: Properly removes empty directories after file operations

## Example Scenario

**Before Enhancement:**
```
Version 1.0: mod_file.jar in /mods/1.18/
Version 1.1: mod_file.jar should be in /mods/1.19/
→ Hash matches, so skip download
→ File remains in /mods/1.18/ (WRONG!)
```

**After Enhancement:**
```
Version 1.0: mod_file.jar in /mods/1.18/
Version 1.1: mod_file.jar should be in /mods/1.19/
→ Hash found in /mods/1.18/
→ Move file to /mods/1.19/ (CORRECT!)
→ Remove empty /mods/1.18/ directory
```

## Testing

The implementation includes comprehensive tests for:
- Hash map building functionality
- File content hashing consistency  
- Modpack file detection logic
- Directory cleanup behavior

A simulation test demonstrates the complete workflow of discovering, moving, and cleaning up files according to the new manifest-as-source-of-truth approach.