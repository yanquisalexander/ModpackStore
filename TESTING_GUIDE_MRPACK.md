# Testing Guide: .mrpack Local Import

## Prerequisites

Before testing, ensure you have:
1. A working development environment for the Tauri app
2. A valid .mrpack file (can be downloaded from Modrinth)
3. System dependencies installed (glib, webkit, etc.)

## Test Cases

### Test 1: Import via Dialog (Happy Path)

**Steps:**
1. Launch the application
2. Navigate to "My Instances" section
3. Click the "Import .mrpack" button (card with Import icon)
4. Select a valid Forge modpack .mrpack file
5. Verify modpack information is displayed:
   - Name
   - Version
   - Minecraft version
   - Loader type (should show "forge")
   - Mod count
   - Description (if available)
6. Check that compatibility shows "Compatible" (green alert)
7. Verify instance name is pre-filled with modpack name
8. Click "Install" button
9. Wait for import to complete
10. Check success toast appears
11. Verify new instance appears in instances list

**Expected Results:**
- ✅ Modpack info correctly displayed
- ✅ No compatibility errors
- ✅ Import completes successfully
- ✅ Instance appears in list
- ✅ Instance can be launched

### Test 2: Import via Drag & Drop

**Steps:**
1. Launch the application
2. Navigate to "My Instances" section
3. Drag a .mrpack file from file explorer
4. Drop it onto the instances grid
5. Check toast notification shows "Importing..."
6. Wait for import to complete
7. Verify success toast appears
8. Check new instance appears in list

**Expected Results:**
- ✅ Drag feedback visible
- ✅ Progress toast shown
- ✅ Import completes
- ✅ Instance created with modpack name

### Test 3: Incompatible Loader (Fabric)

**Steps:**
1. Select a Fabric modpack .mrpack file
2. Verify error is shown: "Solo se admite Forge y Vanilla actualmente"
3. Verify "Install" button is disabled

**Expected Results:**
- ✅ Error message displayed in red alert
- ✅ Cannot proceed with import

### Test 4: Multiple Files Drag

**Steps:**
1. Drag multiple .mrpack files at once
2. Drop them onto instances grid

**Expected Results:**
- ✅ Error toast: "Solo puedes importar un archivo .mrpack a la vez"
- ✅ No import occurs

### Test 5: Invalid File

**Steps:**
1. Try to import a non-.mrpack file (e.g., .zip)
2. Or try to import a corrupted .mrpack

**Expected Results:**
- ✅ Error message shown
- ✅ Clear description of what went wrong

### Test 6: Network Failure During Download

**Steps:**
1. Disconnect from internet
2. Start importing a .mrpack
3. Wait for mod download phase

**Expected Results:**
- ✅ Error toast with download failure message
- ✅ Partial instance may exist but should be cleanable

### Test 7: Vanilla Modpack

**Steps:**
1. Import a Vanilla (no mods) .mrpack file
2. Verify it imports successfully
3. Check that default Vanilla icon is used

**Expected Results:**
- ✅ Import succeeds
- ✅ Vanilla icon shown
- ✅ No forge version set

### Test 8: Modpack with Overrides

**Steps:**
1. Import .mrpack containing overrides/ folder
2. After import, check instance directory
3. Verify files from overrides/ are present:
   - config/
   - resourcepacks/
   - shaderpacks/
   - options.txt
   - etc.

**Expected Results:**
- ✅ All override files extracted correctly
- ✅ Folder structure maintained

### Test 9: Re-import Same Modpack

**Steps:**
1. Import a modpack successfully
2. Import the same modpack again (with different name)
3. Monitor logs for hash verification

**Expected Results:**
- ✅ Second import faster (mods skip re-download due to hash check)
- ✅ Both instances created successfully
- ✅ Logs show "already exists with correct hash, skipping"

### Test 10: Large Modpack

**Steps:**
1. Import a modpack with 100+ mods
2. Monitor progress
3. Verify all mods download

**Expected Results:**
- ✅ Progress visible in logs
- ✅ All mods downloaded
- ✅ No timeout errors

## Manual Verification Checklist

After importing a modpack:

### File System
```bash
# Check instance directory exists
ls <instances_dir>/<instance-uuid>/

# Verify instance.json
cat <instances_dir>/<instance-uuid>/instance.json

# Check mods directory
ls <instances_dir>/<instance-uuid>/mods/

# Verify override files
ls <instances_dir>/<instance-uuid>/config/
ls <instances_dir>/<instance-uuid>/resourcepacks/
```

### Instance Configuration
- [ ] instanceId is a valid UUID
- [ ] instanceName matches what was entered
- [ ] minecraftVersion matches manifest
- [ ] forgeVersion matches manifest (if Forge)
- [ ] instanceDirectory is set correctly
- [ ] iconUrl is set (forge or vanilla)

### Mods
- [ ] All required mods downloaded
- [ ] File sizes match manifest
- [ ] No duplicate mods
- [ ] Server-only mods NOT downloaded

### Overrides
- [ ] Config files present
- [ ] Resource packs present
- [ ] Shader packs present (if in manifest)
- [ ] Other override files present

## Troubleshooting

### Issue: Import fails immediately

**Check:**
- Is the file a valid .mrpack?
- Is the file path accessible?
- Does modrinth.index.json exist in the archive?

### Issue: Import hangs during download

**Check:**
- Internet connection
- Modrinth CDN availability
- Firewall/antivirus blocking

### Issue: Import succeeds but instance won't launch

**Check:**
- Java installation
- Minecraft version compatibility
- Forge installation (for Forge modpacks)
- Instance.json correctness

### Issue: Some mods missing

**Check:**
- Download errors in logs
- Network issues
- Modrinth CDN URLs validity

## Logging

Enable debug logging to see detailed import progress:

```rust
// In src-tauri/src/main.rs
.plugin(
    tauri_plugin_log::Builder::new()
        .level(log::LevelFilter::Debug)  // <- Change to Debug
        // ...
)
```

Look for log entries like:
- "Extracting overrides from .mrpack..."
- "Downloading mods from Modrinth..."
- "Downloading mod 1/10"
- "Downloaded X successfully"
- "File Y already exists with correct hash, skipping"
- "Instance created successfully: <uuid>"

## Performance Benchmarks

Expected times (approximate):

| Modpack Size | Extract Time | Download Time | Total Time |
|--------------|--------------|---------------|------------|
| 10 mods      | < 1s         | 10-30s        | 15-35s     |
| 50 mods      | < 5s         | 1-3 min       | 1-3 min    |
| 100 mods     | < 10s        | 3-8 min       | 3-8 min    |
| 200+ mods    | < 20s        | 8-20 min      | 8-20 min   |

*Note: Download times vary based on internet speed and Modrinth CDN performance*

## Success Criteria

A successful implementation should:

✅ Import Forge modpacks without errors
✅ Import Vanilla modpacks without errors
✅ Reject unsupported loaders (Fabric, Quilt, NeoForge) with clear messages
✅ Extract all override files correctly
✅ Download all required mods
✅ Verify file integrity (SHA1 hashes)
✅ Skip re-downloading existing files
✅ Create valid instance.json
✅ Show clear progress/error feedback to user
✅ Handle network errors gracefully
✅ Support both dialog and drag-drop import methods

## Known Limitations

These are expected behaviors, not bugs:

- ⚠️ Only Forge and Vanilla are supported (Fabric/Quilt/NeoForge will error)
- ⚠️ Optional mods are all downloaded (no selection UI yet)
- ⚠️ Mods download sequentially (not parallel)
- ⚠️ No detailed progress bar (uses toast notifications)
- ⚠️ No resume capability if import fails mid-download

## Test .mrpack Files

You can test with these modpacks from Modrinth:

1. **Small Test**: Better Minecraft (< 50 mods)
2. **Medium Test**: All the Mods 9 (100-200 mods)
3. **Large Test**: All the Mods 10 (200+ mods)
4. **Vanilla Test**: Vanilla+ (vanilla with datapacks)
5. **Fabric Test**: Fabulously Optimized (for error testing)

Download from: https://modrinth.com/modpacks

## Reporting Issues

If you find a bug, please report:

1. **Steps to reproduce**
2. **Expected behavior**
3. **Actual behavior**
4. **Modpack details** (name, file size, mod count, loader)
5. **Log output** (from Tauri logs)
6. **System info** (OS, RAM, etc.)
7. **Screenshot** (if UI-related)
