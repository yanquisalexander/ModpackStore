# ModpackStore Library Extraction & LoadingIndicator Improvements

## Summary of Changes

This PR addresses the issues mentioned in the problem statement by implementing comprehensive improvements to the library extraction process and LoadingIndicator state management.

### 🔧 Library Extraction Improvements

#### Enhanced Native Library Detection
- **New function**: `is_native_library_enhanced()` that detects libraries using pattern matching
- **Supports Forge libraries**: Specifically addresses `org.lwjgl.tinyfd` and other LWJGL components
- **Pattern recognition**: Detects `lwjgl`, `jinput`, `jutils`, `joml`, and other native library patterns
- **OS-specific classifiers**: Enhanced detection of platform-specific variants

#### Improved Path Resolution
- **New function**: `get_native_library_path_enhanced()` with multiple fallback strategies
- **Classifier-specific downloads**: Tries various native classifier patterns
- **Maven coordinate fallback**: Constructs paths when download info is missing
- **Enhanced logging**: Detailed information about path resolution attempts

#### Better Error Handling & Logging
- **Graceful degradation**: Missing libraries are reported but don't crash installation
- **Comprehensive logging**: Clear traceability of downloads, extractions, and failures
- **Detailed error reporting**: Reports library name, URL, and failure reason
- **Fallback information**: Provides helpful details for troubleshooting

#### Enhanced JAR Extraction
- **Duplicate detection**: File size comparison to avoid unnecessary re-extraction
- **Better exclusion patterns**: Improved patterns for Forge and modded environments
- **Flattened structure**: Native files extracted directly to natives directory
- **Progress tracking**: Detailed statistics on extracted, skipped, and duplicate files

### 🎯 LoadingIndicator State Management

#### State Clearing Before Launch
- **New function**: `clearLoadingState()` that clears all timers and resets state
- **Fresh start**: Each instance launch begins with clean loading state
- **Timer cleanup**: Comprehensive clearing of message rotation timers
- **Memory leak prevention**: Proper cleanup when switching instances

#### Instance-Specific Message Tracking
- **Instance-aware messaging**: Messages tracked per instance ID to prevent cross-contamination
- **Enhanced key tracking**: Uses `${instanceId}-${message}` for unique identification
- **State synchronization**: Loading state properly reflects current instance status
- **Cleanup on change**: Proper cleanup when instanceId changes

#### Improved Timer Management
- **Helper function**: `clearAllTimers()` for consistent timer cleanup
- **Proper lifecycle**: Timers cleared when instances stop or change
- **Effect cleanup**: Enhanced useEffect cleanup to prevent timer leaks
- **State consistency**: Loading indicator always reflects current instance state

### 🧪 Testing & Validation

#### Test Documentation
- **Library extraction tests**: Comprehensive test cases for different scenarios
- **LoadingIndicator tests**: Validation scenarios for state management
- **Integration script**: Automated validation of improvements

#### Expected Outcomes
- ✅ Native libraries like `org.lwjgl.tinyfd` should extract correctly
- ✅ No more `java.lang.module.FindException` for missing natives
- ✅ Clear logs showing library download/extraction progress
- ✅ LoadingIndicator shows fresh messages for each instance
- ✅ No residual "Minecraft has exited with exit code 0" messages
- ✅ Proper state cleanup between instance launches

### 📋 Files Modified

1. **`src-tauri/src/core/bootstrap/filesystem.rs`**: Enhanced library extraction logic
2. **`src/hooks/usePrelaunchInstance.tsx`**: Improved LoadingIndicator state management
3. **Test files**: Documentation and integration testing

### 🎯 Problem Statement Resolution

| Issue | Status | Solution |
|-------|--------|----------|
| Native Forge libraries not extracting correctly | ✅ Fixed | Enhanced pattern detection and path resolution |
| Libraries missing or in wrong paths | ✅ Fixed | Improved fallback strategies and Maven coordinate construction |
| LoadingIndicator showing old messages | ✅ Fixed | State clearing and instance-specific tracking |
| Need comprehensive logging | ✅ Implemented | Detailed logging throughout extraction process |
| Error handling without crashing | ✅ Implemented | Graceful degradation with detailed error reporting |

The implementation ensures that all native libraries required by Forge and modpacks are properly detected, downloaded, and extracted, while providing a clean and consistent LoadingIndicator experience that accurately reflects the current instance state.