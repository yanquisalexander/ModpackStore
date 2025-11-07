# World Manager Implementation

This document describes the implementation of the World Manager feature for ModpackStore.

## Overview

The World Manager allows users to manage Minecraft world saves directly from the launcher interface, without having to manually navigate to the `minecraft/saves` folder.

## Features Implemented

### 1. Backend (Rust/Tauri)

Located in: `application/src-tauri/src/core/world_manager.rs`

#### Tauri Commands

- **`list_worlds(instance_id: String)`**: Lists all worlds in an instance's saves folder
  - Reads world metadata from `level.dat` using NBT parsing
  - Returns world icon path, size, last modified date, and game settings
  
- **`import_world(instance_id: String, zip_path: String, overwrite: bool)`**: Imports a world from a ZIP file
  - Extracts ZIP to temporary directory
  - Validates that `level.dat` exists
  - Checks for naming conflicts
  - Moves world to saves folder
  
- **`validate_world_import(instance_id: String, zip_path: String)`**: Validates a world ZIP before importing
  - Checks if `level.dat` exists in the ZIP
  - Detects naming conflicts with existing worlds
  - Detects version mismatches between world and instance
  
- **`delete_world(instance_id: String, world_name: String)`**: Permanently deletes a world
  
- **`export_world(instance_id: String, world_name: String, destination_path: String)`**: Exports a world to a ZIP file
  - Compresses the entire world folder
  - Uses deflate compression for optimal file size
  
- **`edit_world_settings(instance_id: String, world_name: String, settings: WorldEditData)`**: Edits world settings
  - Reads and parses `level.dat` NBT data
  - Modifies game type, difficulty, hardcore mode, and command permissions
  - Writes updated NBT data back to `level.dat`

#### Data Structures

```rust
pub struct World {
    pub name: String,
    pub path: String,
    pub icon_path: Option<String>,
    pub last_modified: u64,
    pub size_bytes: u64,
    pub level_name: Option<String>,
    pub game_type: Option<i32>,
    pub difficulty: Option<i32>,
    pub hardcore: Option<bool>,
    pub allow_commands: Option<bool>,
    pub version: Option<String>,
}

pub struct WorldEditData {
    pub game_type: i32,
    pub difficulty: i32,
    pub allow_commands: bool,
    pub hardcore: bool,
}

pub struct ImportConflict {
    pub conflict_type: String,
    pub message: String,
    pub world_name: String,
    pub existing_version: Option<String>,
    pub import_version: Option<String>,
}
```

#### Dependencies

- `fastnbt` (v2.5): For parsing and writing NBT data in `level.dat` files
- `flate2`: For gzip compression/decompression of NBT data
- `zip`: For importing/exporting world ZIP files
- `walkdir`: For traversing directory structures

### 2. Frontend (React/TypeScript)

Located in: `application/src/components/WorldManagerDialog.tsx`

#### Components

**WorldManagerDialog**: Main dialog component for managing worlds
- Lists all worlds with icons, names, sizes, and last modified dates
- Import button in dialog header
- Each world has a dropdown menu with Edit, Export, and Delete options
- Handles all world operations with proper error handling and user feedback

**UI Components Used**:
- `Dialog` (shadcn/ui): Main container for the world manager
- `AlertDialog` (shadcn/ui): For delete confirmations and import conflicts
- `Sheet` (shadcn/ui): Side panel for editing world settings
- `DropdownMenu` (shadcn/ui): Action menu for each world
- `Select`, `Switch`: For editing world settings

#### Features

1. **World List**:
   - Displays world icon (or folder icon fallback)
   - Shows world name, last modified date, size, and version
   - Sorted by most recently modified
   - Empty state when no worlds exist

2. **Import World**:
   - Opens file dialog to select `.zip` file
   - Validates world before importing
   - Handles naming conflicts (offers to overwrite)
   - Detects version mismatches (warns user)
   - Shows loading state during import

3. **Delete World**:
   - Confirmation dialog before deletion
   - Shows world name in confirmation message
   - Provides clear cancel/delete actions

4. **Export World**:
   - Opens save dialog with suggested filename
   - Format: `{world_name}_{date}.zip`
   - Shows loading toast during export
   - Success notification on completion

5. **Edit World Settings**:
   - Opens side sheet (Sheet) to avoid dialog stacking
   - Editable fields:
     - Game Type: Survival, Creative, Adventure, Spectator
     - Difficulty: Peaceful, Easy, Normal, Hard
     - Allow Commands: Toggle switch
     - Hardcore Mode: Toggle switch
   - Save button to apply changes

#### TypeScript Types

Located in: `application/src/types/world.ts`

```typescript
export interface World {
  name: string;
  path: string;
  icon_path: string | null;
  last_modified: number;
  size_bytes: number;
  level_name: string | null;
  game_type: number | null;
  difficulty: number | null;
  hardcore: boolean | null;
  allow_commands: boolean | null;
  version: string | null;
}

export enum GameType {
  Survival = 0,
  Creative = 1,
  Adventure = 2,
  Spectator = 3,
}

export enum Difficulty {
  Peaceful = 0,
  Easy = 1,
  Normal = 2,
  Hard = 3,
}
```

### 3. Integration

The World Manager is integrated into the PreLaunch view through the QuickActions menu:

**File**: `application/src/components/PreLaunchQuickActions.tsx`

- Added "Administrar mundos" button with globe icon
- Opens `WorldManagerDialog` when clicked
- Positioned between "Abrir .minecraft" and "Edit Instance Info"

## User Flow

1. User opens an instance in PreLaunch view
2. User clicks settings icon to open Quick Actions menu
3. User clicks "Administrar mundos" button
4. World Manager dialog opens showing all worlds
5. User can:
   - **Import**: Select ZIP file → Validate → Handle conflicts → Import
   - **Delete**: Select world → Confirm deletion → Delete
   - **Export**: Select world → Choose save location → Export
   - **Edit**: Select world → Modify settings → Save changes

## Technical Notes

### NBT Format

Minecraft world data is stored in NBT (Named Binary Tag) format, which is similar to JSON but binary. The `level.dat` file contains:

- World metadata (name, version, game type, etc.)
- Player data
- Game rules
- World generation settings

The implementation uses `fastnbt` to read and write this data, with gzip compression as required by Minecraft.

### File Paths

- World icons use `file://` protocol for local file access
- Fallback to folder icon when `icon.png` is missing or fails to load
- All paths are platform-independent using Rust's `PathBuf`

### Error Handling

- All Tauri commands return `Result<T, String>` for proper error handling
- Frontend displays errors as toast notifications with descriptive messages
- Validation happens before destructive operations (import, delete)

### Localization

Currently, all UI text is in Spanish. To add localization:
1. Extract strings to i18n translation files
2. Use the existing i18n system in the application
3. Replace hardcoded strings with translation keys

## Testing

To test the World Manager:

1. Create a Minecraft instance
2. Add some world saves to the instance's `saves` folder
3. Open the instance in PreLaunch view
4. Click settings → "Administrar mundos"
5. Verify:
   - Worlds are listed correctly
   - Import functionality works with valid world ZIPs
   - Delete removes worlds permanently
   - Export creates valid ZIP files
   - Edit saves changes to level.dat

## Future Enhancements

Potential improvements:
- Drag & drop support for importing worlds
- Bulk operations (delete multiple, export multiple)
- World backup/restore functionality
- World duplication
- Search and filter worlds
- More detailed world information (seed, creation date, etc.)
- Support for world templates
- Integration with cloud storage for world backups
