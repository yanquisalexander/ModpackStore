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

    if !base_path.exists() {
        return Ok(());
    }

    let mut repaired_count = 0;

    for version in &["8", "17", "21"] {
        let version_dir = base_path.join(format!("java{}", version));
        if version_dir.exists() {
            match repair_java_permissions(&version_dir) {
                Ok(true) => {
                    log::info!(
                        "[macos_permissions] Repaired permissions for Java {}",
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

/// Ensures Java executables in the bin directory have proper execute permissions.
fn ensure_executable_permissions(version_dir: &Path) -> Result<(), String> {
    let bin_dir = version_dir.join("bin");
    if !bin_dir.exists() {
        return Ok(());
    }

    let java_executable = bin_dir.join("java");
    if !java_executable.exists() {
        return Ok(());
    }

    // Check current permissions
    let metadata = std::fs::metadata(&java_executable)
        .map_err(|e| format!("Failed to read Java executable metadata: {}", e))?;

    let current_mode = metadata.permissions().mode();

    // Check if execute permission is already set for owner (0o100)
    if current_mode & 0o100 != 0 {
        return Ok(());
    }

    // Set execute permissions (0o755 = rwxr-xr-x)
    let mut perms = metadata.permissions();
    perms.set_mode(0o755);

    std::fs::set_permissions(&java_executable, perms)
        .map_err(|e| format!("Failed to set permissions on Java executable: {}", e))?;

    log::info!(
        "[macos_permissions] Set execute permissions on: {}",
        java_executable.display()
    );

    Ok(())
}

/// Validates that the Java directory structure is correct.
fn validate_java_directory_structure(version_dir: &Path) -> Result<bool, String> {
    let bin_dir = version_dir.join("bin");
    if !bin_dir.exists() {
        return Ok(false);
    }

    let java_executable = if cfg!(target_os = "windows") {
        bin_dir.join("java.exe")
    } else {
        bin_dir.join("java")
    };

    Ok(java_executable.exists())
}

/// Repairs permissions for a specific Java version directory.
/// Returns Ok(true) if repairs were made, Ok(false) if already correct.
fn repair_java_permissions(version_dir: &Path) -> Result<bool, String> {
    let mut repaired = false;

    // Step 1: Remove quarantine attributes
    remove_quarantine_attributes(version_dir)?;

    // Step 2: Ensure executable permissions
    let before_metadata = std::fs::metadata(version_dir.join("bin").join("java"))
        .ok()
        .map(|m| m.permissions().mode());

    ensure_executable_permissions(version_dir)?;

    let after_metadata = std::fs::metadata(version_dir.join("bin").join("java"))
        .ok()
        .map(|m| m.permissions().mode());

    if before_metadata != after_metadata {
        repaired = true;
    }

    // Step 3: Validate directory structure
    if !validate_java_directory_structure(version_dir)? {
        log::warn!(
            "[macos_permissions] Java directory structure invalid at: {}",
            version_dir.display()
        );
    }

    Ok(repaired)
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
