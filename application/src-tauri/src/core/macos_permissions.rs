use std::os::unix::fs::PermissionsExt;
use std::path::Path;
use std::process::Command;

/// Checks and fixes Java directory permissions on macOS.
/// This handles quarantine attributes and execute permissions that can cause
/// "Permission denied (os error 13)" errors.
pub async fn check_and_fix_java_permissions() -> Result<(), String> {
    let java_manager = crate::core::java_manager::JavaManager::new()
        .map_err(|e| format!("Error initializing JavaManager: {}", e))?;

    // Check all Java versions in _java_versions directory
    let base_path = java_manager.base_path();

    if base_path.exists() {
        let mut repaired_count = 0;

        for version in &["8", "17", "21"] {
            let version_dir = base_path.join(format!("java{}", version));
            if version_dir.exists() {
                match repair_java_permissions(&version_dir) {
                    Ok(true) => {
                        log::info!(
                            "[macos_permissions] Repaired permissions and structure for Java {}",
                            version
                        );
                        repaired_count += 1;
                    }
                    Ok(false) => {
                        // Permissions were already correct
                    }
                    Err(e) => {
                        log::warn!(
                            "[macos_permissions] Failed to repair Java {} permissions: {}",
                            version,
                            e
                        );
                    }
                }
            }
        }

        if repaired_count > 0 {
            log::info!(
                "[macos_permissions] Repaired permissions for {} Java installation(s)",
                repaired_count
            );
        }
    }

    // Also repair permissions for currently configured javaDir if it exists
    if let Ok(config_guard) = crate::config::get_config_manager().lock() {
        if let Ok(config) = config_guard.as_ref() {
            if let Some(java_dir) = config.get_java_dir() {
                if java_dir.exists() {
                    let _ = repair_java_path_permissions(&java_dir);
                }
            }
        }
    }

    Ok(())
}

/// Removes macOS quarantine attributes from a directory and its contents.
/// The com.apple.quarantine attribute is added to downloaded files and can
/// cause permission issues when trying to execute them.
fn remove_quarantine_attributes(path: &Path) -> Result<(), String> {
    if !path.exists() {
        return Ok(());
    }

    // Use xattr to remove quarantine attribute recursively
    let output = Command::new("xattr")
        .args(["-dr", "com.apple.quarantine"])
        .arg(path)
        .output()
        .map_err(|e| format!("Failed to execute xattr: {}", e))?;

    // xattr returns non-zero if the attribute doesn't exist on some files, which is OK
    // We only care about actual errors
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        // "No such xattr: com.apple.quarantine" is not a real error
        if !stderr.contains("No such xattr") && !stderr.contains("Permission denied") {
            log::debug!(
                "[macos_permissions] xattr output: {}",
                stderr.trim()
            );
        }
    }

    Ok(())
}

/// Ensures Java executables and binaries in the bin directory have proper execute permissions.
fn ensure_executable_permissions(version_dir: &Path) -> Result<(), String> {
    let bin_dir = if version_dir.join("bin").exists() {
        version_dir.join("bin")
    } else if version_dir.join("Contents").join("Home").join("bin").exists() {
        version_dir.join("Contents").join("Home").join("bin")
    } else {
        return Ok(());
    };

    if let Ok(entries) = std::fs::read_dir(&bin_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                if let Ok(metadata) = std::fs::metadata(&path) {
                    let current_mode = metadata.permissions().mode();
                    if current_mode & 0o111 == 0 {
                        let mut perms = metadata.permissions();
                        perms.set_mode(0o755);
                        let _ = std::fs::set_permissions(&path, perms);
                        log::info!(
                            "[macos_permissions] Set execute permissions on: {}",
                            path.display()
                        );
                    }
                }
            }
        }
    }

    // Also ensure libjli.dylib and other libraries have readable/executable permissions
    let lib_dir = if version_dir.join("lib").exists() {
        version_dir.join("lib")
    } else if version_dir.join("Contents").join("Home").join("lib").exists() {
        version_dir.join("Contents").join("Home").join("lib")
    } else {
        return Ok(());
    };

    if let Ok(entries) = std::fs::read_dir(&lib_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("dylib") {
                if let Ok(metadata) = std::fs::metadata(&path) {
                    let current_mode = metadata.permissions().mode();
                    if current_mode & 0o111 == 0 {
                        let mut perms = metadata.permissions();
                        perms.set_mode(0o755);
                        let _ = std::fs::set_permissions(&path, perms);
                    }
                }
            }
        }
    }

    Ok(())
}

/// Validates that the Java directory structure is correct.
fn validate_java_directory_structure(version_dir: &Path) -> Result<bool, String> {
    let has_direct = version_dir.join("bin").join("java").exists();
    let has_bundle = version_dir.join("Contents").join("Home").join("bin").join("java").exists();
    Ok(has_direct || has_bundle)
}

/// Repairs permissions for a specific Java version directory.
/// Returns Ok(true) if repairs were made, Ok(false) if already correct.
fn repair_java_permissions(version_dir: &Path) -> Result<bool, String> {
    // Step 1: Auto-heal structure (flatten Contents/Home or nested jdk, or clean corrupt)
    let structure_healed = crate::core::java_manager::JavaManager::heal_java_directory(version_dir)
        .map_err(|e| format!("Error al sanar directorio Java: {}", e))?;

    if !version_dir.exists() {
        return Ok(structure_healed);
    }

    // Step 2: Remove quarantine attributes
    remove_quarantine_attributes(version_dir)?;

    // Step 3: Ensure executable permissions
    let before_mode = std::fs::metadata(version_dir.join("bin").join("java"))
        .ok()
        .map(|m| m.permissions().mode());

    ensure_executable_permissions(version_dir)?;

    let after_mode = std::fs::metadata(version_dir.join("bin").join("java"))
        .ok()
        .map(|m| m.permissions().mode());

    let permissions_changed = before_mode != after_mode;

    Ok(structure_healed || permissions_changed)
}

/// Repairs permissions for a specific Java path.
/// This can be called from other modules when they encounter permission errors.
pub fn repair_java_path_permissions(java_path: &Path) -> Result<(), String> {
    if !java_path.exists() {
        return Ok(());
    }

    // Remove quarantine attributes
    remove_quarantine_attributes(java_path)?;

    // Ensure executable permissions
    ensure_executable_permissions(java_path)?;

    Ok(())
}
