# Testing Guide for Java Manager Fix

## Overview

This guide explains how to test the Java Manager fix to ensure that instance.json files correctly contain the `javaPath` field after instance creation.

## Prerequisites

- ModpackStore application with the fix applied
- jq (JSON processor) installed for automated testing
  - Ubuntu/Debian: `sudo apt-get install jq`
  - macOS: `brew install jq`
  - Windows: Download from https://stedolan.github.io/jq/

## Manual Testing Steps

### Test Case 1: Create New Vanilla Instance

1. **Open ModpackStore application**

2. **Create a new local instance:**
   - Click "New Instance" or similar button
   - Select Minecraft version: `1.18.2` (requires Java 17)
   - Instance name: `Test Vanilla 1.18`
   - Do NOT select Forge
   - Click Create

3. **Wait for instance creation to complete**
   - Monitor the task manager/progress indicator
   - Wait for "Instance created successfully" message

4. **Verify Java path is set:**
   
   **On Linux/macOS:**
   ```bash
   # Navigate to instances directory
   cd ~/.config/dev.alexitoo.modpackstore/instances
   
   # Find your instance
   ls -la
   
   # Check instance.json
   cat "Test Vanilla 1.18"/instance.json | jq '.javaPath'
   ```
   
   **On Windows:**
   ```powershell
   # Navigate to instances directory
   cd $env:LOCALAPPDATA\dev.alexitoo.modpackstore\instances
   
   # List instances
   dir
   
   # Check instance.json
   type "Test Vanilla 1.18\instance.json" | jq .javaPath
   ```

5. **Expected result:**
   ```json
   "/home/user/.config/dev.alexitoo.modpackstore/_java_versions/java17"
   ```
   
   **NOT:**
   ```json
   null
   ```

6. **Verify instance launches:**
   - Launch the instance
   - Check that it uses Java 17 (not Java 8)
   - Verify Minecraft starts successfully

### Test Case 2: Create New Forge Instance

1. **Create a new local instance:**
   - Minecraft version: `1.20.1` (requires Java 17)
   - Forge version: `47.1.0`
   - Instance name: `Test Forge 1.20`

2. **Wait for creation to complete**

3. **Verify Java path:**
   ```bash
   cat "Test Forge 1.20"/instance.json | jq '.javaPath'
   ```

4. **Expected: Non-null Java path**

5. **Launch and verify it works**

### Test Case 3: Create Modpack Instance

1. **Navigate to Modpacks section**

2. **Select a modpack:**
   - Example: SaltoCraft Extremo 3
   - Or any modpack that requires Java 17+

3. **Create instance from modpack**

4. **Wait for download and installation**

5. **Verify Java path in instance.json**

6. **Launch and verify**

## Automated Testing

Use the provided verification script:

```bash
# Make script executable
chmod +x verify-java-fix.sh

# Run the script
./verify-java-fix.sh
```

The script will:
1. Find your instances directory
2. Check each instance's instance.json
3. Verify javaPath is set
4. Display a summary report

### Expected Output (All Pass):

```
╔════════════════════════════════════════════════════════════╗
║  Java Manager Fix - Verification Script                    ║
╚════════════════════════════════════════════════════════════╝

Found instances directory: /home/user/.config/dev.alexitoo.modpackstore/instances

Found 3 instance(s)

Testing instance: Test Vanilla 1.18
✓ PASS: javaPath is set to: /home/user/.config/dev.alexitoo.modpackstore/_java_versions/java17
   File: /home/user/.config/dev.alexitoo.modpackstore/instances/Test Vanilla 1.18/instance.json

Testing instance: Test Forge 1.20
✓ PASS: javaPath is set to: /home/user/.config/dev.alexitoo.modpackstore/_java_versions/java17
   File: /home/user/.config/dev.alexitoo.modpackstore/instances/Test Forge 1.20/instance.json

Testing instance: SaltoCraft Extremo 3
✓ PASS: javaPath is set to: /home/user/.config/dev.alexitoo.modpackstore/_java_versions/java17
   File: /home/user/.config/dev.alexitoo.modpackstore/instances/SaltoCraft Extremo 3/instance.json

═══════════════════════════════════════════════════════════
Test Summary:
  Total instances: 3
  Passed: 3
  Failed: 0
═══════════════════════════════════════════════════════════
✓ All instances have javaPath correctly set!
```

## Regression Testing

### Check Old Instances (Created Before Fix)

Old instances may still have `javaPath: null`. This is expected and doesn't break functionality:

1. **List old instances**
2. **Check their instance.json files**
3. **If javaPath is null:**
   - This is expected for old instances
   - They will use global Java configuration (fallback)
   - To fix: Delete and recreate the instance

### Verify Fix Doesn't Break Existing Functionality

1. **Test launching old instances** (with null javaPath)
   - Should still work (uses global Java)
   
2. **Test launching new instances** (with set javaPath)
   - Should use instance-specific Java

3. **Test instance operations:**
   - Create instance ✓
   - Launch instance ✓
   - Delete instance ✓
   - Update modpack ✓

## Debugging Failed Tests

### If javaPath is null in new instances:

1. **Check application logs:**
   ```bash
   # On Linux
   tail -f ~/.config/dev.alexitoo.modpackstore/logs/app.log
   
   # Look for lines like:
   # "Java path set for instance Test Vanilla 1.18: Some("/path/to/java17")"
   ```

2. **Verify JavaManager is working:**
   - Check if Java is being downloaded
   - Look for download progress in logs
   - Check `_java_versions` directory

3. **Check for errors during instance creation:**
   - Bootstrap errors
   - File system errors
   - Network errors during Java download

### If instance fails to launch:

1. **Check the Java path is valid:**
   ```bash
   # Extract javaPath from instance.json
   java_path=$(jq -r '.javaPath' instance.json)
   
   # Verify it exists
   ls -la "$java_path/bin/java"
   
   # Test Java version
   "$java_path/bin/java" -version
   ```

2. **Check Minecraft version requirements:**
   - 1.7-1.16: Java 8
   - 1.17: Java 16
   - 1.18+: Java 17
   - 1.20.5+: Java 21

3. **Check logs for Java-related errors**

## Test Matrix

| Test Case | Minecraft | Forge | Expected Java | Result |
|-----------|-----------|-------|---------------|--------|
| Vanilla 1.8 | 1.8.9 | No | Java 8 | ✓ |
| Vanilla 1.16 | 1.16.5 | No | Java 8 | ✓ |
| Vanilla 1.17 | 1.17.1 | No | Java 16 | ✓ |
| Vanilla 1.18 | 1.18.2 | No | Java 17 | ✓ |
| Vanilla 1.20 | 1.20.4 | No | Java 17 | ✓ |
| Forge 1.16 | 1.16.5 | 36.2.39 | Java 8 | ✓ |
| Forge 1.18 | 1.18.2 | 40.3.0 | Java 17 | ✓ |
| Forge 1.20 | 1.20.1 | 47.1.0 | Java 17 | ✓ |
| Modpack | 1.18.2 | 40.3.0 | Java 17 | ✓ |

## Success Criteria

The fix is working correctly if:

1. ✅ All new instances have `javaPath` set (not null)
2. ✅ Java path points to correct Java version for Minecraft version
3. ✅ Instances launch successfully without Java errors
4. ✅ Multiple instances can be created simultaneously
5. ✅ Old instances (with null javaPath) still work
6. ✅ No regression in other instance operations

## Known Limitations

1. **Old instances are not automatically migrated**
   - Instances created before the fix keep `javaPath: null`
   - They will use global Java configuration
   - Manual recreation is needed to get instance-specific Java

2. **Java path is set once at creation**
   - If you manually delete the Java version, path becomes invalid
   - No automatic re-validation on launch (future improvement)

3. **No UI indicator for Java version**
   - Users can't see which Java version an instance uses
   - Must check instance.json manually (future improvement)

## Reporting Issues

If you find instances where javaPath is null after applying the fix:

1. **Gather information:**
   - Instance type (vanilla/forge/modpack)
   - Minecraft version
   - Creation timestamp
   - Application logs

2. **Check if it's a timing issue:**
   - Try creating instance again
   - Check if Java download completed

3. **Report with:**
   - Steps to reproduce
   - instance.json content
   - Relevant log entries
   - System information (OS, Java versions installed)
