# Enhanced Error Handling System for ModpackStore

This document describes the enhanced error handling system implemented for modpack installation and bootstrap operations in ModpackStore.

## Overview

The enhanced error handling system provides:

- **Structured Error Context**: Each error includes the specific step that failed, error category, and actionable suggestions
- **Rich User Feedback**: Clear error messages with step information and recovery suggestions
- **Detailed Logging**: Comprehensive debugging information without affecting user experience
- **Event-Driven Communication**: Bootstrap errors are communicated between Rust backend and React frontend via events

## Architecture

### Backend (Rust)

#### Core Error Structure

The system is built around the `BootstrapError` struct:

```rust
pub struct BootstrapError {
    pub step: BootstrapStep,           // Which step failed
    pub category: ErrorCategory,       // Type of error
    pub message: String,               // User-friendly error message
    pub suggestion: Option<String>,    // Recovery suggestion
    pub technical_details: Option<String>, // Debug information
}
```

#### Bootstrap Steps

Errors are categorized by the bootstrap step where they occur:

- `CreatingDirectories` - Directory creation failures
- `DownloadingManifest` - Version manifest download issues
- `DownloadingVersionJson` - Version configuration download problems
- `DownloadingClientJar` - Minecraft client download failures
- `CheckingJavaVersion` - Java path validation issues
- `InstallingJava` - Java installation problems
- `DownloadingLibraries` - Library download failures
- `ValidatingAssets` - Asset validation issues
- `ExtractingNatives` - Native library extraction problems
- `DownloadingForgeInstaller` - Forge installer download issues
- `RunningForgeInstaller` - Forge installation execution failures
- `CreatingLauncherProfiles` - Launcher profile creation issues

#### Error Categories

Errors are classified by type for appropriate handling:

- `Network` - Internet connectivity or download issues
- `Filesystem` - File system permissions or I/O problems
- `Java` - Java installation or configuration issues
- `Forge` - Forge-specific installation problems
- `Configuration` - Application configuration issues
- `Other` - Uncategorized errors

#### Event Emission

Bootstrap errors emit two types of events:
- `bootstrap-error` - Detailed error information for enhanced UI handling
- `instance-error` - General error event for compatibility with existing error handling

### Frontend (React)

#### Error Display

The frontend displays errors with enhanced context:

1. **Toast Notifications**: Show immediate error feedback with step context
2. **ErrorScreen Component**: Detailed error page with category icons and suggestions
3. **Task Context**: Integration with task management system for progress tracking

#### Error Message Enhancement

```typescript
const displayBootstrapError = (error: BootstrapError, instanceName: string) => {
    const stepName = getStepDisplayName(error.step);
    const title = `Error ${stepName} en "${instanceName}"`;
    
    // Show toast with suggestion and technical details options
    toast.error(title, {
        description: error.message + (error.suggestion ? `\n\nSugerencia: ${error.suggestion}` : ""),
        action: error.technical_details ? {
            label: "Ver detalles",
            onClick: () => showTechnicalDetails(error.technical_details)
        } : undefined
    });
};
```

## Common Error Scenarios

### Java Executable Not Found

**Error**: Java executable not found at configured path
**Step**: `CheckingJavaVersion`
**Category**: `Java`
**User Message**: "Java executable not found at: /path/to/java"
**Suggestion**: "Ve a Configuración → Java y configura la ruta de Java"
**Technical Details**: Expected Java executable location and path resolution details

### Forge Installation Failure

**Error**: Forge installer fails to execute
**Step**: `RunningForgeInstaller`
**Category**: `Forge`
**User Message**: Specific error from Forge installer
**Suggestion**: "Verifica que la versión de Forge sea compatible con la versión de Minecraft"
**Technical Details**: Installation options tried and failure details

### Network Download Issues

**Error**: Failed to download required files
**Step**: Various download steps
**Category**: `Network`
**User Message**: Specific download failure reason
**Suggestion**: "Verifica tu conexión a internet y vuelve a intentar"
**Technical Details**: URL and network error details

## Logging System

### Log Levels

The system uses structured logging at different levels:

- `ERROR`: Critical failures that stop the bootstrap process
- `WARN`: Issues that were recovered from or alternative approaches
- `INFO`: Important milestone events and successful operations
- `DEBUG`: Detailed internal state and decision-making information

### Log Examples

```rust
// High-level operation start
log::info!("[Instance: {}] Starting Forge installer - Minecraft: {}, Forge: {}", 
    instance_id, minecraft_version, forge_version);

// Detailed debug information
log::debug!("[Instance: {}] Using Java path: {}", instance_id, java_path);

// Error with context
log::error!("[Instance: {}] All Forge installation methods failed. Attempted options: {:?}", 
    instance_id, attempted_options);
```

## Usage Examples

### Handling Bootstrap Errors in Tasks

```rust
match bootstrap_result {
    Ok(_) => {
        // Normal success handling
        update_task(&task_id, TaskStatus::Completed, 100.0, "Success", None);
    }
    Err(bootstrap_error) => {
        // Enhanced error handling
        emit_bootstrap_error(instance, &bootstrap_error);
        update_task_with_bootstrap_error(&task_id, &bootstrap_error);
    }
}
```

### Creating Specific Error Types

```rust
// Java path error with suggestion
let error = BootstrapError::java_error(
    BootstrapStep::CheckingJavaVersion,
    "Java executable not found"
).with_suggestion("Configure Java path in settings");

// Network error with recovery suggestion
let error = BootstrapError::network_error(
    BootstrapStep::DownloadingManifest,
    "Failed to download version manifest"
);

// Forge error with technical details
let error = BootstrapError::forge_error("Installation failed")
    .with_technical_details("Tried options: --installClient, --installDir");
```

## Benefits

1. **Better User Experience**: Users see exactly what step failed and how to fix it
2. **Improved Debugging**: Detailed logs help identify and resolve issues quickly
3. **Proactive Error Handling**: Suggestions help users resolve issues independently
4. **Consistent Error Format**: All bootstrap errors follow the same structure
5. **Event-Driven Architecture**: Clean separation between error detection and display

## Migration Notes

The enhanced error handling is backward compatible:
- Existing error handling code continues to work
- New errors provide additional context when available
- Error events are emitted to both new and legacy event channels
- Logging maintains existing format while adding structured information

## Future Enhancements

Potential improvements to consider:
- Error reporting and analytics integration
- Automatic error recovery mechanisms
- User error reporting system
- Localization of error messages and suggestions
- Context-aware help system integration