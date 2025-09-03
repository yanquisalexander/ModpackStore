# Library Extraction Improvements Test

## Enhanced Native Library Detection

The following improvements have been made to detect and extract native libraries more accurately:

### 1. Enhanced Detection Patterns
- **LWJGL libraries**: Detects `org.lwjgl.tinyfd` and other LWJGL native components
- **JInput libraries**: Detects native input libraries
- **Platform-specific libraries**: Improved detection of OS-specific components
- **Forge-specific patterns**: Better support for modded library detection

### 2. Improved Path Resolution
- **Multiple classifier strategies**: Tries various native classifier patterns
- **Maven coordinate fallback**: Constructs paths from Maven coordinates when download info is missing
- **Enhanced logging**: Detailed information about path resolution attempts

### 3. Better Error Handling
- **Fallback reporting**: Reports missing libraries without crashing the installation
- **Detailed logging**: Clear traceability of what's downloaded and extracted
- **Duplicate detection**: Avoids re-extracting existing files

### 4. Enhanced Exclusion Patterns
- **Improved defaults**: Better patterns for excluding unnecessary files
- **Forge-specific exclusions**: Patterns tailored for modded environments

## Test Cases to Verify

1. **Test with vanilla Minecraft**: Ensure standard LWJGL extraction works
2. **Test with Forge**: Verify Forge-specific native libraries are detected
3. **Test with missing libraries**: Confirm graceful degradation and error reporting
4. **Test duplicate detection**: Verify no unnecessary re-extraction

## Expected Behavior

- All native libraries should be detected and extracted to `/natives/{version}/`
- Libraries like `org.lwjgl.tinyfd` should be properly resolved and extracted
- Clear logs should show what was downloaded, extracted, and any issues
- Missing libraries should be reported but not crash the installation

## Changes Made (Latest Update)

### 1. Fixed Multiple Artifacts Resolution
- **Problem**: Libraries with native components (like `org.lwjgl.tinyfd`) require both main JAR and native JAR, but system was adding them independently
- **Solution**: Enhanced ClasspathBuilder to treat native libraries as multi-artifact entities requiring BOTH main and native JARs
- **Result**: Eliminates `java.lang.module.FindException` errors

### 2. Enhanced Path Resolution
- **Problem**: Native library path resolution used basic fallback logic
- **Solution**: Updated extraction to use `get_native_library_path_enhanced()` with better classifier pattern matching
- **Result**: More reliable native library detection and extraction

### 3. Improved Exclusion Pattern Enforcement
- **Problem**: Basic exclusion patterns didn't prevent META-INF contamination consistently
- **Solution**: All extraction functions now use `get_exclusion_patterns_enhanced()` with comprehensive defaults
- **Result**: Clean natives directory without META-INF/, license files, or Java classes

## Key Fix: Multi-Artifact Libraries

For libraries like `org.lwjgl.tinyfd:3.3.1`:
- **Before**: Native JAR added to classpath even if main JAR missing → FindException
- **After**: Both main JAR (`tinyfd-3.3.1.jar`) AND native JAR (`tinyfd-3.3.1-natives-windows.jar`) required and added together
- **Validation**: System now ensures complete library resolution for native components