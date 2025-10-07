# Visual Guide: .mrpack Local Import Flow

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Actions                             │
├─────────────────────────────────────────────────────────────────┤
│  1. Drag & Drop .mrpack file                                     │
│  2. Click "Import .mrpack" button and select file                │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                   React Frontend (TypeScript)                    │
├─────────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  MyInstancesSection.tsx or ImportMrpackDialog.tsx         │  │
│  │                                                             │  │
│  │  1. validate_mrpack_file(path)        ← Tauri Command     │  │
│  │  2. check_mrpack_compatibility(...)   ← Tauri Command     │  │
│  │  3. create_instance_from_mrpack(...)  ← Tauri Command     │  │
│  └───────────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Tauri Backend (Rust)                          │
├─────────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  mrpack_handler.rs                                        │  │
│  │  • read_mrpack_manifest()                                 │  │
│  │  • extract_mrpack_overrides()                             │  │
│  │  • download_mrpack_mods()                                 │  │
│  └───────────────────────────────────────────────────────────┘  │
│                         │                                        │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  instance_manager.rs                                      │  │
│  │  • create_instance_from_mrpack()                          │  │
│  └───────────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    External Services                             │
├─────────────────────────────────────────────────────────────────┤
│  • Modrinth CDN (for downloading mod files)                      │
│  • Local File System (for .mrpack and instance storage)          │
└─────────────────────────────────────────────────────────────────┘
```

## Detailed Import Flow

### Step 1: File Selection

```
User Action
    │
    ├─→ Drag & Drop .mrpack
    │       │
    │       └─→ handleDrop() in MyInstancesSection.tsx
    │
    └─→ Click Import Button
            │
            └─→ handleSelectFile() in ImportMrpackDialog.tsx
```

### Step 2: Validation

```
Frontend (React)
    │
    ├─→ invoke("validate_mrpack_file", { mrpackPath })
    │       │
    │       └─→ Rust: mrpack_handler.rs
    │               │
    │               ├─→ Open ZIP archive
    │               ├─→ Extract modrinth.index.json
    │               ├─→ Parse JSON to MrpackManifest
    │               └─→ Return manifest
    │
    └─→ invoke("check_mrpack_compatibility", { manifest })
            │
            └─→ Rust: mrpack_handler.rs
                    │
                    ├─→ Check game type (must be "minecraft")
                    ├─→ Determine loader (Forge/Fabric/Quilt/etc)
                    ├─→ Validate loader compatibility
                    ├─→ Count optional mods
                    └─→ Return compatibility info
```

### Step 3: User Confirmation (Dialog Only)

```
ImportMrpackDialog.tsx
    │
    ├─→ Display modpack info:
    │   ├─ Name
    │   ├─ Version
    │   ├─ Minecraft version
    │   ├─ Loader type
    │   ├─ Mod count
    │   └─ Description
    │
    ├─→ Show warnings (if any)
    ├─→ Show errors (if any)
    │
    └─→ User enters instance name
            │
            └─→ Click "Install" button
```

### Step 4: Instance Creation

```
Frontend
    │
    └─→ invoke("create_instance_from_mrpack", { mrpackPath, instanceName })
            │
            └─→ Rust: instance_manager.rs::create_instance_from_mrpack()
                    │
                    ├─→ 1. Read manifest again
                    │       │
                    │       └─→ mrpack_handler.rs::read_mrpack_manifest()
                    │
                    ├─→ 2. Validate compatibility (Forge/Vanilla only)
                    │       │
                    │       └─→ Reject if Fabric/Quilt/NeoForge
                    │
                    ├─→ 3. Create instance directory
                    │       │
                    │       ├─→ Generate UUID
                    │       ├─→ Create <instances_dir>/<uuid>/
                    │       └─→ Set permissions
                    │
                    ├─→ 4. Extract overrides
                    │       │
                    │       └─→ mrpack_handler.rs::extract_mrpack_overrides()
                    │               │
                    │               ├─→ Open .mrpack ZIP
                    │               ├─→ Find files in overrides/
                    │               ├─→ Extract to instance dir
                    │               └─→ Maintain folder structure
                    │
                    ├─→ 5. Download mods
                    │       │
                    │       └─→ mrpack_handler.rs::download_mrpack_mods()
                    │               │
                    │               ├─→ Filter client-side mods
                    │               ├─→ Create mods/ directory
                    │               └─→ For each mod:
                    │                       │
                    │                       └─→ download_mod_file()
                    │                               │
                    │                               ├─→ Check if exists (SHA1)
                    │                               ├─→ Try download URLs
                    │                               └─→ download_file_from_url()
                    │                                       │
                    │                                       ├─→ HTTP GET
                    │                                       ├─→ Save to disk
                    │                                       └─→ Verify
                    │
                    ├─→ 6. Create instance config
                    │       │
                    │       ├─→ Set instance ID
                    │       ├─→ Set name
                    │       ├─→ Set Minecraft version
                    │       ├─→ Set Forge version (if any)
                    │       ├─→ Set default icon
                    │       └─→ Set instance directory
                    │
                    └─→ 7. Save instance.json
                            │
                            └─→ minecraft_instance.rs::save()
                                    │
                                    └─→ Write to <instance_dir>/instance.json
```

### Step 5: Completion

```
Rust Backend
    │
    └─→ Return instance_id
            │
            ▼
Frontend
    │
    ├─→ Show success toast
    ├─→ Close dialog (if applicable)
    ├─→ Refresh instances list
    │       │
    │       └─→ invoke("get_all_instances")
    │
    └─→ User sees new instance in UI
```

## File Operations Detail

### Reading .mrpack

```
.mrpack file (ZIP archive)
    │
    ├─→ modrinth.index.json     ← Read and parse
    │   {
    │     "formatVersion": 1,
    │     "game": "minecraft",
    │     "versionId": "1.0.0",
    │     "name": "My Modpack",
    │     "dependencies": {
    │       "minecraft": "1.20.1",
    │       "forge": "47.2.0"
    │     },
    │     "files": [
    │       {
    │         "path": "mods/example-mod.jar",
    │         "hashes": {
    │           "sha1": "abc123...",
    │           "sha512": "def456..."
    │         },
    │         "downloads": [
    │           "https://cdn.modrinth.com/..."
    │         ],
    │         "fileSize": 123456,
    │         "env": {
    │           "client": "required"
    │         }
    │       }
    │     ]
    │   }
    │
    └─→ overrides/              ← Extract entire directory
        ├─→ config/
        │   └─→ example-mod.toml
        ├─→ resourcepacks/
        │   └─→ custom.zip
        └─→ options.txt
```

### Instance Directory Structure

```
<instances_dir>/
    └─→ <uuid>/
        ├─→ instance.json       ← Instance configuration
        │   {
        │     "instanceId": "uuid",
        │     "instanceName": "My Modpack",
        │     "minecraftVersion": "1.20.1",
        │     "forgeVersion": "47.2.0",
        │     "instanceDirectory": "/path/to/uuid",
        │     ...
        │   }
        │
        ├─→ mods/               ← Downloaded from Modrinth
        │   ├─→ example-mod.jar
        │   ├─→ another-mod.jar
        │   └─→ ...
        │
        ├─→ config/             ← From overrides/
        │   └─→ example-mod.toml
        │
        ├─→ resourcepacks/      ← From overrides/
        │   └─→ custom.zip
        │
        └─→ options.txt         ← From overrides/
```

## Error Handling Flow

```
At each step, errors are caught and returned to the user:

┌─────────────────────────────────────────────────────────────┐
│  File Validation Error                                       │
│  "File does not exist" / "Not a .mrpack file"               │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  Compatibility Error                                         │
│  "Only Forge and Vanilla are supported"                     │
│  "Unsupported game type"                                    │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  Download Error                                              │
│  "Failed to download mod: <name>"                           │
│  "All download URLs failed"                                 │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  Save Error                                                  │
│  "Failed to save instance: <error>"                         │
└─────────────────────────────────────────────────────────────┘

All errors show toast notifications with detailed descriptions.
```

## UI States

### ImportMrpackDialog.tsx States

1. **Initial State**: No file selected
   - Shows "Select .mrpack file" button

2. **File Selected**: Validating
   - Shows loading state

3. **File Validated**: Ready to import
   - Shows modpack details
   - Shows compatibility status (errors/warnings/success)
   - Shows instance name input
   - "Install" button enabled if compatible

4. **Importing**: In progress
   - "Install" button shows loading spinner
   - "Importing..." text
   - Dialog cannot be closed

5. **Complete**: Success or error
   - Success: Close dialog, refresh list, show success toast
   - Error: Show error toast, keep dialog open

### MyInstancesSection.tsx Drag States

1. **Not Dragging**: Normal view
   - Grid of instances

2. **Dragging Over**: Highlighted drop zone
   - Visual feedback for drop area

3. **Dropped**: Processing
   - Validate → Import → Show progress toast

4. **Complete**: Refresh view
   - New instance appears in grid
