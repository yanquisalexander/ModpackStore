# Incremental Update Testing Plan

## Overview
This document outlines how to test the incremental modpack update functionality to ensure it works correctly and provides the expected benefits.

## Pre-Change Behavior (Destructive Updates)
Before the improvement, modpack updates would:
1. Show "Descargando archivos actualizados..." immediately
2. Delete all existing files
3. Download the entire modpack again (100% of files)
4. Take a long time even for small changes
5. Progress would show downloading every single file

## Post-Change Behavior (Incremental Updates)
After the improvement, modpack updates should:
1. Show "Iniciando actualización incremental..."
2. Show "Validando archivos existentes..." 
3. Show "Encontrados X archivos para actualizar" (X should be much smaller)
4. Only download files that actually changed
5. Show "Limpiando archivos obsoletos..."
6. Complete much faster
7. Final message: "Modpack [name] actualizado exitosamente mediante actualización incremental"

## Test Scenarios

### Scenario 1: No Changes (Best Case)
**Setup**: Update a modpack when no files have changed
**Expected Result**: 
- Very fast completion
- "Encontrados 0 archivos para actualizar"
- No downloads performed
- Only cleanup phase runs

### Scenario 2: Small Changes
**Setup**: Update a modpack with 1-2 changed mods
**Expected Result**:
- Fast completion
- "Encontrados 1-2 archivos para actualizar"
- Only changed files are downloaded
- Existing unchanged files are preserved

### Scenario 3: Large Changes
**Setup**: Update a modpack with many new/changed files
**Expected Result**:
- Still faster than before (doesn't re-download unchanged files)
- "Encontrados X archivos para actualizar" where X is less than total files
- Unchanged files are not re-downloaded

### Scenario 4: Configuration Preservation
**Setup**: Modify options.txt, then update modpack
**Expected Result**:
- User's options.txt is preserved
- Update completes successfully
- Custom settings remain intact

## UI Testing Points

### ModpackInstallButton Component
- Click "Actualizar" button on existing modpack
- Verify new progress messages appear
- Confirm faster completion times
- Check that button states work correctly

### ModpackUpdateChecker Component  
- Use "Verificar actualizaciones" button
- Click "Actualizar" when update is available
- Verify incremental update progress is shown
- Confirm task manager shows correct progress

### Task Manager
- Verify task titles show "Actualizando modpack: [name]"
- Check progress percentages advance correctly:
  - 10%: "Iniciando actualización incremental..."
  - 25%: "Validando archivos existentes..."
  - 50%: "Encontrados X archivos para actualizar"
  - 85%: "Limpiando archivos obsoletos..."
  - 90%: "Actualización incremental completada - X archivos procesados"
  - 100%: "Modpack [name] actualizado exitosamente mediante actualización incremental"

## Performance Validation

### Timing Measurements
- Record update times before and after the change
- Measure bandwidth usage during updates
- Compare file system I/O operations

### Expected Improvements
- **Update Speed**: 50-90% faster for typical updates
- **Bandwidth Usage**: Reduced by 60-95% depending on change size  
- **File Operations**: Significantly fewer delete/write operations

## Error Handling Testing

### Network Issues
- Test update behavior with intermittent connectivity
- Verify graceful handling of download failures
- Ensure partial updates can be resumed

### File System Issues
- Test with read-only files in modpack directory
- Verify behavior when disk space is low
- Check handling of corrupted files

### Cleanup Failures
- Simulate cleanup errors (e.g., files in use)
- Verify update doesn't fail due to minor cleanup issues
- Confirm non-fatal error handling works correctly

## Regression Testing

### Existing Functionality
- Verify "Play Now" functionality still works correctly
- Confirm new modpack installations work as before
- Check that validation logic hasn't been broken

### Data Integrity
- Verify file hashes are correctly validated
- Ensure moved files maintain their integrity
- Confirm no data corruption occurs

## Success Criteria

The incremental update implementation is successful if:

1. **Performance**: Updates are significantly faster (>50% improvement)
2. **Bandwidth**: Less data is downloaded (measured improvement)
3. **Reliability**: No increase in update failures
4. **User Experience**: Better progress feedback and faster completion
5. **Compatibility**: No breaking changes to existing functionality
6. **Data Safety**: User configurations and settings are preserved

## Manual Testing Steps

1. **Setup**: Install a modpack with the old version
2. **Modify**: Change options.txt or add custom files
3. **Update**: Trigger an update using either UI component
4. **Verify**: Check that:
   - Update completes faster than before
   - Progress messages show incremental behavior
   - Custom files are preserved
   - Only necessary files were downloaded
   - Final result is functionally identical to destructive update

## Automated Testing

While we rely on existing test coverage for the core functions, additional automated tests could include:

- Unit tests for the modified `spawn_modpack_update_task` function
- Integration tests comparing update performance metrics
- Regression tests ensuring UI components work correctly
- Performance benchmarks for various update scenarios