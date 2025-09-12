# User Data Protection in ModpackStore

## Overview

ModpackStore implements comprehensive protection mechanisms to ensure that user's personal data and settings are never lost during modpack operations. This documentation outlines the critical protections in place for user files, particularly the `options.txt` file that contains Minecraft client settings.

## Critical User Data Protection

### options.txt Protection

The `options.txt` file contains user's personal Minecraft client settings and receives special protection:

#### What's Protected
- **Graphics settings**: render distance, graphics quality, vsync, fullscreen mode
- **Audio settings**: music volume, sound effects volume, voice/chat volume  
- **Control settings**: key bindings, mouse sensitivity, invert mouse
- **Accessibility settings**: narrator, auto-jump, reduced motion
- **Language preferences**: selected language/locale
- **Multiplayer settings**: chat visibility, player reporting preferences

#### Protection Mechanisms

1. **Download Protection**: If `options.txt` already exists locally, it will never be downloaded or replaced from modpack manifests
2. **Validation Skipping**: Existing `options.txt` files are not validated against modpack hashes, preventing forced replacement
3. **Cleanup Protection**: `options.txt` is marked as an essential file and is never deleted during cleanup operations
4. **Precise Detection**: Only the root-level `options.txt` is protected; config files like `config/options.txt` are treated normally

#### Behavior Scenarios

| Scenario | Behavior | Rationale |
|----------|----------|-----------|
| New Installation | `options.txt` is downloaded from modpack if provided | Users get reasonable defaults |
| Existing Installation | `options.txt` is preserved, modpack version ignored | User settings take priority |
| Modpack Update | Existing `options.txt` is never touched | Preserves user customizations |
| Instance Cleanup | `options.txt` is protected from deletion | Essential user data |

### Other Protected Files

In addition to `options.txt`, the following files and directories are protected:

#### Protected Files
- `optionsshaders.txt` - Shader-specific settings
- `servers.dat` - Multiplayer server list
- `launcher_profiles.json` - Launcher configuration

#### Protected Directories
- `saves/` - User's worlds and save files
- `screenshots/` - User's screenshots
- `logs/` - Game logs for debugging
- `crash-reports/` - Crash reports for troubleshooting
- `resourcepacks/` - User-installed resource packs
- `shaderpacks/` - User-installed shader packs
- `config/` - Most mod configuration files (user customizations)

## Technical Implementation

### Essential Paths System

The protection is implemented through an "essential paths" system that marks critical files and directories as protected:

```rust
fn get_essential_minecraft_paths(minecraft_dir: &Path, instance: &MinecraftInstance) -> HashSet<PathBuf> {
    let mut essential_paths = HashSet::new();
    
    // Critical user files
    essential_paths.insert(minecraft_dir.join("options.txt"));
    essential_paths.insert(minecraft_dir.join("optionsshaders.txt"));
    essential_paths.insert(minecraft_dir.join("servers.dat"));
    
    // User data directories
    essential_paths.insert(minecraft_dir.join("saves"));
    essential_paths.insert(minecraft_dir.join("screenshots"));
    // ... more paths
    
    essential_paths
}
```

### Multi-Layer Protection

Protection is enforced at multiple layers:

1. **File Detection**: Precise identification of protected files
2. **Download Phase**: Skip protected files that already exist
3. **Validation Phase**: Skip hash validation for protected files  
4. **Cleanup Phase**: Never delete files in essential paths
5. **Audit Phase**: Pre-operation validation of protection status

### User Data Audit System

Before any modpack operation, the system performs a comprehensive audit:

```rust
pub fn audit_user_data_protection(
    minecraft_dir: &Path,
    operation_type: &str,
) -> Result<UserDataAuditReport, String>
```

The audit verifies:
- Which files are properly protected
- Potential risks or warnings
- File integrity and readability
- Protection mechanism status

## Usage Guidelines

### For Users

1. **Your settings are safe**: Personal Minecraft settings will never be lost during modpack operations
2. **Customizations preserved**: Any changes you make to graphics, controls, or audio settings will persist through modpack updates
3. **Worlds protected**: Your saves, screenshots, and resource packs are always protected
4. **New installations**: Fresh installations will receive sensible defaults from modpacks

### For Developers

1. **Respect user data**: Never attempt to force-replace protected files
2. **Test protection**: Use the audit system to verify protection status
3. **Document changes**: Any modifications to protection mechanisms must be thoroughly documented
4. **Backward compatibility**: Protection mechanisms must maintain compatibility across updates

## Troubleshooting

### Common Issues

**Q: My modpack includes options.txt but users aren't getting the settings**
A: This is expected behavior. If users already have options.txt, their settings take priority. Only new installations receive modpack defaults.

**Q: I need to update a user's options.txt for compatibility**
A: Create a mod or config file that handles compatibility automatically, rather than replacing options.txt. User settings should remain under user control.

**Q: How can I verify protection is working?**
A: Use the audit command or check the logs during modpack operations. Protected files will be explicitly logged as "PROTECTED" or "SKIPPED".

### Logging

Protection activities are logged at INFO level:

```
[FileManager] Skipping options.txt - file already exists and will be preserved (user settings protection)
[Validation] Skipping options.txt - file already exists and will be preserved (user settings protection)
[Cleanup] Protected 15 essential Minecraft paths
[UserDataProtection] Audit completed successfully
```

## Security Considerations

1. **Data Integrity**: Protection mechanisms prevent accidental data loss
2. **User Control**: Users maintain full control over their personal settings
3. **Transparency**: All protection actions are logged for audit purposes
4. **Fail-Safe**: System defaults to protection when in doubt

## Compliance

This protection system ensures compliance with:
- User data protection principles
- Gaming industry best practices
- Data preservation requirements
- User experience guidelines

## Future Enhancements

Planned improvements to user data protection:
- Backup system for protected files before operations
- User-configurable protection levels
- Export/import functionality for settings
- Cross-instance settings synchronization