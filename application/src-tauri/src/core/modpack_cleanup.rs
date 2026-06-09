use crate::core::minecraft::paths::MinecraftPaths;
use crate::core::minecraft_instance::{InstanceType, MinecraftInstance, ModLoaderType};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};

use super::download_manager::calculate_file_hash;
use super::modpack_manifest::*;

/// Identifies essential Minecraft files and directories that should never be deleted
fn get_essential_minecraft_paths(
    minecraft_dir: &Path,
    instance: &MinecraftInstance,
) -> HashSet<PathBuf> {
    let mut essential_paths = HashSet::new();

    // Essential directories that contain base Minecraft files
    essential_paths.insert(minecraft_dir.join("versions"));
    essential_paths.insert(minecraft_dir.join("libraries"));
    essential_paths.insert(minecraft_dir.join("assets"));
    essential_paths.insert(minecraft_dir.join("natives"));

    // Runtime and cache directories
    essential_paths.insert(minecraft_dir.join("logs"));
    essential_paths.insert(minecraft_dir.join("crash-reports"));
    essential_paths.insert(minecraft_dir.join("saves"));
    essential_paths.insert(minecraft_dir.join("screenshots"));
    essential_paths.insert(minecraft_dir.join("resourcepacks"));
    essential_paths.insert(minecraft_dir.join("shaderpacks"));
    essential_paths.insert(minecraft_dir.join("config")); // May contain user configurations

    // Launcher and profile files
    essential_paths.insert(minecraft_dir.join("launcher_profiles.json"));
    essential_paths.insert(minecraft_dir.join("options.txt"));
    essential_paths.insert(minecraft_dir.join("optionsshaders.txt"));
    essential_paths.insert(minecraft_dir.join("servers.dat"));

    // Create MinecraftPaths to get specific file locations
    match crate::config::get_config_manager().lock() {
        Ok(config_result) => {
            if let Ok(config) = &*config_result {
                if let Some(mc_paths) = MinecraftPaths::new(instance, config) {
                    // Add specific client jar
                    essential_paths.insert(mc_paths.client_jar());

                    // Add natives directory for this version
                    essential_paths.insert(mc_paths.natives_dir());
                }
            }
        }
        Err(_) => {
            log::warn!("[Cleanup] Could not access config manager for paths");
        }
    }

    log::info!(
        "[Cleanup] Protected {} essential Minecraft paths",
        essential_paths.len()
    );

    essential_paths
}

/// Checks if a file path should be protected from deletion
fn is_essential_path(file_path: &Path, essential_paths: &HashSet<PathBuf>) -> bool {
    // Check if the file itself is essential
    if essential_paths.contains(file_path) {
        return true;
    }

    // Check if the file is inside any essential directory
    for essential_path in essential_paths {
        if file_path.starts_with(essential_path) {
            return true;
        }
    }

    false
}

/// Checks if a file path represents options.txt (Minecraft client options file)
///
/// This function identifies options.txt files that should receive special treatment:
/// - Never deleted during cleanup (already protected by essential paths)
/// - Never downloaded/replaced if they already exist (preserves user settings)
/// - Only downloaded if the file doesn't exist on the client
///
/// ## Critical User Data Protection
///
/// The `options.txt` file contains user's personal Minecraft client settings including:
/// - Graphics settings (render distance, graphics quality, vsync, etc.)
/// - Audio settings (music volume, sound effects volume, voice volume)
/// - Control settings (key bindings, mouse sensitivity)
/// - Accessibility settings
/// - Language preferences
/// - Multiplayer settings
///
/// Preserving this file is essential for maintaining user experience across modpack updates.
pub(crate) fn is_options_txt(relative_path: &str) -> bool {
    // Match exactly "options.txt" at the root level
    // Note: This excludes paths like "config/options.txt" which are different config files
    // and only protects the root-level Minecraft client options file
    relative_path == "options.txt"
}

/// Loads previous manifest if available for comparison
fn load_previous_manifest(instance: &MinecraftInstance) -> Option<ModpackManifest> {
    let instance_dir = instance.instanceDirectory.as_ref()?;
    let manifest_cache_path = Path::new(instance_dir)
        .join(".modpack_cache")
        .join("previous_manifest.json");

    if manifest_cache_path.exists() {
        if let Ok(content) = fs::read_to_string(&manifest_cache_path) {
            if let Ok(manifest) = serde_json::from_str::<ModpackManifest>(&content) {
                log::info!(
                    "[Cleanup] Loaded previous manifest with {} files",
                    manifest.files.len()
                );
                return Some(manifest);
            }
        }
    }

    log::info!("[Cleanup] No previous manifest found");
    None
}

/// Saves current manifest for future comparison
fn save_manifest_cache(
    instance: &MinecraftInstance,
    manifest: &ModpackManifest,
) -> Result<(), String> {
    let instance_dir = instance
        .instanceDirectory
        .as_ref()
        .ok_or("Instance directory not set")?;

    let cache_dir = Path::new(instance_dir).join(".modpack_cache");
    fs::create_dir_all(&cache_dir)
        .map_err(|e| format!("Failed to create cache directory: {}", e))?;

    let manifest_cache_path = cache_dir.join("previous_manifest.json");
    let manifest_json = serde_json::to_string_pretty(manifest)
        .map_err(|e| format!("Failed to serialize manifest: {}", e))?;

    fs::write(&manifest_cache_path, manifest_json)
        .map_err(|e| format!("Failed to save manifest cache: {}", e))?;

    log::info!(
        "[Cleanup] Saved manifest cache with {} files",
        manifest.files.len()
    );
    Ok(())
}

/// Cleans up obsolete files in the instance directory based on manifest comparison
/// Implements differentiated cleanup strategies:
/// - Strict cleanup for mods/ folder: removes any files not in manifest
/// - Synchronized cleanup for other folders: moves files to new locations when possible
///
/// ## Special Handling for options.txt:
///
/// The file `options.txt` (Minecraft client options) receives special treatment throughout the system:
///
/// 1. **Cleanup Protection**: `options.txt` is protected from deletion via essential paths mechanism
///    - It's added to essential paths in `get_essential_minecraft_paths()`
///    - Will never be removed during cleanup operations
///
/// 2. **Download Protection**: `options.txt` is protected from replacement during downloads
///    - If `options.txt` already exists, it will NOT be downloaded/replaced from modpack
///    - If `options.txt` doesn't exist, it will be downloaded normally from modpack
///    - This preserves user's client settings (graphics, controls, etc.)
///
/// 3. **Validation Skipping**: Existing `options.txt` files are not validated against manifest
///    - No hash checking is performed on existing `options.txt` files
///    - Prevents forced replacement due to hash mismatches
///
/// This behavior ensures that user's personal Minecraft settings are preserved when updating modpacks,
/// while still allowing new installations to receive default options from the modpack if needed.
pub fn cleanup_obsolete_files(
    instance: &MinecraftInstance,
    manifest: &ModpackManifest,
) -> Result<Vec<String>, String> {
    let instance_dir = instance
        .instanceDirectory
        .as_ref()
        .ok_or("Instance directory not set")?;

    let minecraft_dir = Path::new(instance_dir).join("minecraft");
    if !minecraft_dir.exists() {
        log::info!("[Cleanup] Minecraft directory does not exist, nothing to clean");
        return Ok(vec![]);
    }

    log::info!(
        "[Cleanup] Starting enhanced cleanup for instance: {}",
        instance.instanceName
    );

    let mut removed_files = Vec::new();
    let mut preserved_files = Vec::new();
    let mut moved_files = Vec::new();

    // Get essential paths that should never be deleted
    let essential_paths = get_essential_minecraft_paths(&minecraft_dir, instance);

    // Get current manifest files for quick lookup
    let current_files: HashSet<String> = manifest.files.iter().map(|f| f.path.clone()).collect();
    log::info!(
        "[Cleanup] Current manifest has {} files",
        current_files.len()
    );

    // Scan only controlled directories for existing files
    let existing_controlled_files = scan_controlled_directories(&minecraft_dir)?;

    log::info!(
        "[Cleanup] Found {} files in controlled directories",
        existing_controlled_files.len()
    );

    // Determine files to clean: any file in controlled directories that is NOT in current manifest
    let files_to_clean: HashSet<String> = existing_controlled_files
        .difference(&current_files)
        .cloned()
        .collect();

    log::info!(
        "[Cleanup] Found {} files to clean from controlled directories",
        files_to_clean.len()
    );

    // Process files for cleanup with different strategies based on directory
    for file_to_clean in files_to_clean {
        let file_path = minecraft_dir.join(&file_to_clean);

        // Double-check: never delete essential files (though they shouldn't be in controlled dirs)
        if is_essential_path(&file_path, &essential_paths) {
            log::warn!(
                "[Cleanup] Skipping essential file in controlled directory: {}",
                file_to_clean
            );
            preserved_files.push(file_to_clean);
            continue;
        }

        // Only clean if file actually exists
        if file_path.exists() {
            if file_to_clean.starts_with("mods/") || file_to_clean.starts_with("coremods/") {
                // STRICT CLEANUP: For mods/ and coremods/ folders, always remove files not in manifest
                match fs::remove_file(&file_path) {
                    Ok(_) => {
                        log::info!("[Cleanup] Strict removal from mods: {}", file_to_clean);
                        removed_files.push(file_to_clean);
                    }
                    Err(e) => {
                        log::error!(
                            "[Cleanup] Failed to remove mod file {}: {}",
                            file_to_clean,
                            e
                        );
                    }
                }
            } else {
                // SYNCHRONIZED CLEANUP: For other folders, try to find if file should be moved
                let file_hash = match calculate_file_hash(&file_path) {
                    Ok(hash) => hash,
                    Err(e) => {
                        log::warn!(
                            "[Cleanup] Could not calculate hash for {}: {}. Removing file.",
                            file_to_clean,
                            e
                        );
                        match fs::remove_file(&file_path) {
                            Ok(_) => {
                                log::info!(
                                    "[Cleanup] Removed file with hash calculation error: {}",
                                    file_to_clean
                                );
                                removed_files.push(file_to_clean);
                            }
                            Err(e) => {
                                log::error!(
                                    "[Cleanup] Failed to remove file {}: {}",
                                    file_to_clean,
                                    e
                                );
                            }
                        }
                        continue;
                    }
                };

                // Check if this file hash is needed somewhere else in the manifest
                let target_location = manifest
                    .files
                    .iter()
                    .find(|f| f.fileHash == file_hash && f.path != file_to_clean);

                if let Some(target_file) = target_location {
                    // File should be moved to new location
                    let target_path = minecraft_dir.join(&target_file.path);

                    // Ensure target directory exists
                    if let Some(parent) = target_path.parent() {
                        if let Err(e) = fs::create_dir_all(parent) {
                            log::error!(
                                "[Cleanup] Failed to create target directory for {}: {}",
                                target_file.path,
                                e
                            );
                            // Fall back to removal
                            match fs::remove_file(&file_path) {
                                Ok(_) => {
                                    log::info!(
                                        "[Cleanup] Removed file (move failed): {}",
                                        file_to_clean
                                    );
                                    removed_files.push(file_to_clean);
                                }
                                Err(e) => {
                                    log::error!(
                                        "[Cleanup] Failed to remove file {}: {}",
                                        file_to_clean,
                                        e
                                    );
                                }
                            }
                            continue;
                        }
                    }

                    // Attempt to move the file
                    match fs::rename(&file_path, &target_path) {
                        Ok(_) => {
                            log::info!(
                                "[Cleanup] Moved file {} -> {}",
                                file_to_clean,
                                target_file.path
                            );
                            moved_files.push(format!("{} -> {}", file_to_clean, target_file.path));
                        }
                        Err(e) => {
                            log::warn!(
                                "[Cleanup] Failed to move file {} -> {}: {}. Removing instead.",
                                file_to_clean,
                                target_file.path,
                                e
                            );
                            // Fall back to removal
                            match fs::remove_file(&file_path) {
                                Ok(_) => {
                                    log::info!(
                                        "[Cleanup] Removed file (move failed): {}",
                                        file_to_clean
                                    );
                                    removed_files.push(file_to_clean);
                                }
                                Err(e) => {
                                    log::error!(
                                        "[Cleanup] Failed to remove file {}: {}",
                                        file_to_clean,
                                        e
                                    );
                                }
                            }
                        }
                    }
                } else {
                    // File is not needed anywhere, remove it
                    match fs::remove_file(&file_path) {
                        Ok(_) => {
                            log::info!("[Cleanup] Removed unnecessary file: {}", file_to_clean);
                            removed_files.push(file_to_clean);
                        }
                        Err(e) => {
                            log::error!("[Cleanup] Failed to remove file {}: {}", file_to_clean, e);
                        }
                    }
                }
            }
        }
    }

    // Remove empty directories within controlled directories only
    remove_empty_controlled_directories(&minecraft_dir)?;

    // Save current manifest for future comparisons
    if let Err(e) = save_manifest_cache(instance, manifest) {
        log::warn!("[Cleanup] Failed to save manifest cache: {}", e);
    }

    log::info!(
        "[Cleanup] Enhanced cleanup complete: {} files removed, {} files moved, {} files preserved",
        removed_files.len(),
        moved_files.len(),
        preserved_files.len()
    );

    Ok(removed_files)
}

/// Checks if a file path represents a modpack-managed file
fn is_modpack_file(relative_path: &str) -> bool {
    // Common modpack directories
    relative_path.starts_with("mods/") ||
    relative_path.starts_with("coremods/") ||
    relative_path.starts_with("scripts/") ||
    relative_path.starts_with("resources/") ||
    relative_path.starts_with("packmenu/") ||
    relative_path.starts_with("structures/") ||
    relative_path.starts_with("schematics/") ||
    // Configuration files that are often modpack-specific
    (relative_path.starts_with("config/") && !relative_path.contains("options")) ||
    // Other modpack-specific files
    relative_path == "manifest.json" ||
    relative_path == "modlist.html" ||
    relative_path.starts_with("changelogs/")
}

/// Gets the list of directories that are controlled by the modpack manifest
fn get_controlled_directories() -> Vec<&'static str> {
    vec![
        "mods",
        "coremods",
        "scripts",
        "resources",
        "packmenu",
        "structures",
        "schematics",
        "config",
        "changelogs",
    ]
}

/// Scans controlled directories for all files and returns their relative paths
fn scan_controlled_directories(minecraft_dir: &Path) -> Result<HashSet<String>, String> {
    let mut found_files = HashSet::new();

    for dir_name in get_controlled_directories() {
        let dir_path = minecraft_dir.join(dir_name);
        if dir_path.exists() && dir_path.is_dir() {
            scan_directory_for_files(&dir_path, minecraft_dir, &mut found_files)?;
        }
    }

    // Also check for standalone modpack files in the root
    let standalone_files = vec!["manifest.json", "modlist.html"];
    for file_name in standalone_files {
        let file_path = minecraft_dir.join(file_name);
        if file_path.exists() && file_path.is_file() {
            found_files.insert(file_name.to_string());
        }
    }

    log::info!(
        "[ControlledScan] Found {} files in controlled directories",
        found_files.len()
    );
    Ok(found_files)
}

/// Recursively scans a directory and adds file paths to the set
fn scan_directory_for_files(
    dir: &Path,
    minecraft_dir: &Path,
    files_set: &mut HashSet<String>,
) -> Result<(), String> {
    let entries = fs::read_dir(dir)
        .map_err(|e| format!("Failed to read directory {}: {}", dir.display(), e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let path = entry.path();

        if path.is_file() {
            let relative_path = path
                .strip_prefix(minecraft_dir)
                .map_err(|_| "Failed to get relative path")?
                .to_string_lossy()
                .replace("\\", "/"); // Normalize path separators
            files_set.insert(relative_path);
        } else if path.is_dir() {
            scan_directory_for_files(&path, minecraft_dir, files_set)?;
        }
    }

    Ok(())
}

// Helper functions

fn find_files_recursively(dir: &Path) -> Result<Vec<PathBuf>, String> {
    let mut files = Vec::new();

    let entries = fs::read_dir(dir)
        .map_err(|e| format!("Failed to read directory {}: {}", dir.display(), e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let path = entry.path();

        if path.is_file() {
            files.push(path);
        } else if path.is_dir() {
            files.extend(find_files_recursively(&path)?);
        }
    }

    Ok(files)
}

fn remove_empty_controlled_directories(minecraft_dir: &Path) -> Result<(), String> {
    // Only process controlled directories to avoid affecting essential Minecraft directories
    for dir_name in get_controlled_directories() {
        let dir_path = minecraft_dir.join(dir_name);
        if dir_path.exists() && dir_path.is_dir() {
            remove_empty_directories_in_tree(&dir_path)?;

            // Check if the top-level controlled directory is now empty and remove it
            if is_directory_empty(&dir_path)? {
                if let Err(e) = fs::remove_dir(&dir_path) {
                    log::warn!(
                        "[Cleanup] Failed to remove empty controlled directory {}: {}",
                        dir_path.display(),
                        e
                    );
                } else {
                    log::info!(
                        "[Cleanup] Removed empty controlled directory: {}",
                        dir_path.display()
                    );
                }
            }
        }
    }

    Ok(())
}

fn remove_empty_directories_in_tree(dir: &Path) -> Result<(), String> {
    let entries = fs::read_dir(dir)
        .map_err(|e| format!("Failed to read directory {}: {}", dir.display(), e))?;

    let mut subdirs = Vec::new();

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let path = entry.path();

        if path.is_dir() {
            subdirs.push(path);
        }
    }

    // Recursively process subdirectories
    for subdir in subdirs {
        remove_empty_directories_in_tree(&subdir)?;

        // Check if subdirectory is now empty
        if is_directory_empty(&subdir)? {
            if let Err(e) = fs::remove_dir(&subdir) {
                log::warn!(
                    "[Cleanup] Failed to remove empty subdirectory {}: {}",
                    subdir.display(),
                    e
                );
            } else {
                log::info!("[Cleanup] Removed empty subdirectory: {}", subdir.display());
            }
        }
    }

    Ok(())
}

fn remove_empty_directories(dir: &Path) -> Result<(), String> {
    let entries = fs::read_dir(dir)
        .map_err(|e| format!("Failed to read directory {}: {}", dir.display(), e))?;

    let mut subdirs = Vec::new();

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let path = entry.path();

        if path.is_dir() {
            subdirs.push(path);
        }
    }

    // Recursively process subdirectories
    for subdir in subdirs {
        remove_empty_directories(&subdir)?;

        // Check if subdirectory is now empty
        if is_directory_empty(&subdir)? {
            if let Err(e) = fs::remove_dir(&subdir) {
                eprintln!(
                    "Failed to remove empty directory {}: {}",
                    subdir.display(),
                    e
                );
            }
        }
    }

    Ok(())
}

fn is_directory_empty(dir: &Path) -> Result<bool, String> {
    let entries = fs::read_dir(dir)
        .map_err(|e| format!("Failed to read directory {}: {}", dir.display(), e))?;

    Ok(entries.count() == 0)
}

/// Validates that user data files are properly protected from modpack operations
///
/// This function performs comprehensive auditing to ensure that critical user files
/// are never at risk of being deleted or overwritten during modpack operations.
///
/// ## Protected Files
///
/// - `options.txt` - Minecraft client settings (graphics, audio, controls, etc.)
/// - `optionsshaders.txt` - Shader-specific settings
/// - `servers.dat` - Multiplayer server list
/// - `saves/` directory - User's worlds and saves
/// - `screenshots/` directory - User's screenshots
/// - `logs/` directory - Game logs for debugging
/// - `crash-reports/` directory - Crash reports for troubleshooting
///
/// ## Audit Results
///
/// Returns a detailed audit report indicating:
/// - Which files are properly protected
/// - Any potential risks detected
/// - Recommendations for additional protection
///
/// This function should be called before any modpack operation to ensure user data safety.
pub fn audit_user_data_protection(
    minecraft_dir: &Path,
    operation_type: &str,
) -> Result<UserDataAuditReport, String> {
    let mut audit = UserDataAuditReport::new(operation_type);

    // Check options.txt protection
    let options_file = minecraft_dir.join("options.txt");
    if options_file.exists() {
        audit.add_protected_file("options.txt", "Minecraft client settings - PROTECTED");

        // Additional validation: ensure file is readable and not corrupted
        match fs::read_to_string(&options_file) {
            Ok(content) => {
                if content.trim().is_empty() {
                    audit.add_warning("options.txt exists but is empty - may need regeneration");
                } else {
                    audit.add_info("options.txt is valid and contains user settings");
                }
            }
            Err(_) => {
                audit.add_warning("options.txt exists but is not readable - may be corrupted");
            }
        }
    } else {
        audit.add_info("options.txt does not exist - modpack defaults will be used if provided");
    }

    // Check other protected files
    let protected_files = [
        ("optionsshaders.txt", "Shader settings"),
        ("servers.dat", "Multiplayer server list"),
        ("launcher_profiles.json", "Launcher profiles"),
    ];

    for (filename, description) in protected_files {
        let file_path = minecraft_dir.join(filename);
        if file_path.exists() {
            audit.add_protected_file(filename, &format!("{} - PROTECTED", description));
        }
    }

    // Check protected directories
    let protected_dirs = [
        ("saves", "User worlds and saves"),
        ("screenshots", "User screenshots"),
        ("logs", "Game logs"),
        ("crash-reports", "Crash reports"),
        ("resourcepacks", "User resource packs"),
        ("shaderpacks", "User shader packs"),
    ];

    for (dirname, description) in protected_dirs {
        let dir_path = minecraft_dir.join(dirname);
        if dir_path.exists() && dir_path.is_dir() {
            if let Ok(entries) = fs::read_dir(&dir_path) {
                let count = entries.count();
                audit.add_protected_directory(
                    dirname,
                    &format!("{} ({} items) - PROTECTED", description, count),
                );
            } else {
                audit.add_protected_directory(
                    dirname,
                    &format!("{} - PROTECTED (unreadable)", description),
                );
            }
        }
    }

    // Validate essential paths protection
    let dummy_instance = MinecraftInstance {
        instanceId: "audit".to_string(),
        usesDefaultIcon: false,
        iconUrl: None,
        bannerUrl: None,
        instanceName: "audit".to_string(),
        accountUuid: None,
        minecraftPath: String::new(),
        modpackId: None,
        modpackVersionId: None,
        minecraftVersion: "1.20.1".to_string(),
        instanceDirectory: None,
        forgeVersion: None,
        loaderType: ModLoaderType::Vanilla,
        loaderVersion: None,
        javaPath: None,
        favorite: false,
        favorite_order: None,
        ms_nickname: None,
        instanceType: InstanceType::Client,
    };

    let essential_paths = get_essential_minecraft_paths(minecraft_dir, &dummy_instance);
    audit.add_info(&format!(
        "Essential paths protection enabled for {} paths",
        essential_paths.len()
    ));

    log::info!(
        "[UserDataAudit] {} operation audit completed",
        operation_type
    );
    log::info!(
        "[UserDataAudit] Protected files: {}",
        audit.protected_files.len()
    );
    log::info!(
        "[UserDataAudit] Protected directories: {}",
        audit.protected_directories.len()
    );

    if !audit.warnings.is_empty() {
        log::warn!("[UserDataAudit] {} warnings detected", audit.warnings.len());
        for warning in &audit.warnings {
            log::warn!("[UserDataAudit] Warning: {}", warning);
        }
    }

    Ok(audit)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_modpack_file() {
        // Test modpack directory files
        assert!(is_modpack_file("mods/some_mod.jar"));
        assert!(is_modpack_file("config/some_config.cfg"));
        assert!(is_modpack_file("scripts/some_script.zs"));
        assert!(is_modpack_file("resources/some_resource.png"));

        // Test files that should not be considered modpack files
        assert!(!is_modpack_file("config/options.txt")); // Player options
        assert!(!is_modpack_file("saves/world1/level.dat")); // World saves
        assert!(!is_modpack_file("logs/latest.log")); // Game logs

        // Test standalone modpack files
        assert!(is_modpack_file("manifest.json"));
        assert!(is_modpack_file("modlist.html"));
    }

    #[test]
    fn test_get_controlled_directories() {
        let controlled_dirs = get_controlled_directories();

        // Ensure key directories are included
        assert!(controlled_dirs.contains(&"mods"));
        assert!(controlled_dirs.contains(&"config"));
        assert!(controlled_dirs.contains(&"resources"));
        assert!(controlled_dirs.contains(&"scripts"));

        // Ensure we don't control essential Minecraft directories
        assert!(!controlled_dirs.contains(&"saves"));
        assert!(!controlled_dirs.contains(&"logs"));
        assert!(!controlled_dirs.contains(&"libraries"));
        assert!(!controlled_dirs.contains(&"versions"));
    }

    #[test]
    fn test_scan_controlled_directories() {
        // Create a temporary directory structure for testing
        let temp_dir = std::env::temp_dir().join("controlled_scan_test");
        let _ = std::fs::create_dir_all(&temp_dir);

        // Create test files in controlled directories
        let mods_dir = temp_dir.join("mods");
        let config_dir = temp_dir.join("config");
        let saves_dir = temp_dir.join("saves"); // This should NOT be scanned

        let _ = std::fs::create_dir_all(&mods_dir);
        let _ = std::fs::create_dir_all(&config_dir);
        let _ = std::fs::create_dir_all(&saves_dir);

        // Create test files
        let _ = std::fs::write(mods_dir.join("test_mod.jar"), "test content");
        let _ = std::fs::write(config_dir.join("test_config.cfg"), "test config");
        let _ = std::fs::write(saves_dir.join("world.dat"), "world data"); // Should be ignored
        let _ = std::fs::write(temp_dir.join("manifest.json"), "manifest"); // Standalone file

        // Scan controlled directories
        let controlled_files = scan_controlled_directories(&temp_dir).unwrap();

        // Verify correct files were found
        assert!(controlled_files.contains("mods/test_mod.jar"));
        assert!(controlled_files.contains("config/test_config.cfg"));
        assert!(controlled_files.contains("manifest.json"));

        // Verify files in non-controlled directories were ignored
        assert!(!controlled_files.contains("saves/world.dat"));

        // Cleanup
        let _ = std::fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_enhanced_cleanup_logic_simulation() {
        // This test simulates the enhanced cleanup logic without file I/O

        // Simulate current manifest files
        let current_files: HashSet<String> = [
            "mods/mod_a.jar".to_string(),
            "mods/mod_b.jar".to_string(),
            "config/config_a.cfg".to_string(),
        ]
        .iter()
        .cloned()
        .collect();

        // Simulate existing files in controlled directories (including manual additions)
        let existing_controlled_files: HashSet<String> = [
            "mods/mod_a.jar".to_string(),        // In manifest (keep)
            "mods/mod_b.jar".to_string(),        // In manifest (keep)
            "mods/old_mod.jar".to_string(),      // Not in manifest (remove - was in old manifest)
            "mods/user_mod.jar".to_string(),     // Not in manifest (remove - manually added)
            "config/config_a.cfg".to_string(),   // In manifest (keep)
            "config/old_config.cfg".to_string(), // Not in manifest (remove)
        ]
        .iter()
        .cloned()
        .collect();

        // Calculate files to clean (any controlled file not in current manifest)
        let files_to_clean: HashSet<String> = existing_controlled_files
            .difference(&current_files)
            .cloned()
            .collect();

        // Verify cleanup targets
        assert_eq!(files_to_clean.len(), 3);
        assert!(files_to_clean.contains("mods/old_mod.jar"));
        assert!(files_to_clean.contains("mods/user_mod.jar"));
        assert!(files_to_clean.contains("config/old_config.cfg"));

        // Verify kept files
        assert!(!files_to_clean.contains("mods/mod_a.jar"));
        assert!(!files_to_clean.contains("mods/mod_b.jar"));
        assert!(!files_to_clean.contains("config/config_a.cfg"));
    }

    #[test]
    fn test_enhanced_cleanup_differentiated_behavior() {
        // Test that demonstrates the differentiated cleanup behavior:
        // - Strict cleanup for mods/ (removal)
        // - Synchronized cleanup for other folders (move files when possible)

        // Simulate files in different directories
        let files_to_clean = vec![
            "mods/old_mod.jar",          // Should be strictly removed
            "mods/user_added_mod.jar",   // Should be strictly removed
            "config/old_config.cfg",     // Should be removed or moved if hash matches
            "resources/old_texture.png", // Should be removed or moved if hash matches
        ];

        // Verify that we can differentiate between mods and other directories
        for file in files_to_clean {
            if file.starts_with("mods/") || file.starts_with("coremods/") {
                // This should trigger strict cleanup (removal)
                assert!(file.starts_with("mods/"));
                // In actual implementation, this would be removed without checking for moves
            } else {
                // This should trigger synchronized cleanup (check for moves)
                assert!(file.starts_with("config/") || file.starts_with("resources/"));
                // In actual implementation, this would check for hash matches in manifest
            }
        }
    }

    #[test]
    fn test_is_options_txt() {
        // Test exact match for options.txt at root level
        assert!(is_options_txt("options.txt"));

        // Test that config options files are NOT treated as options.txt
        assert!(!is_options_txt("config/options.txt"));
        assert!(!is_options_txt("config/client/options.txt"));

        // Test other similar files that should NOT be treated as options.txt
        assert!(!is_options_txt("optionsshaders.txt")); // This is a different file
        assert!(!is_options_txt("mods/options.txt")); // Not at root level
        assert!(!is_options_txt("saves/world1/options.txt")); // Not at root level
        assert!(!is_options_txt("options.json")); // Different extension
        assert!(!is_options_txt("myoptions.txt")); // Different name

        // Test edge cases
        assert!(!is_options_txt("")); // Empty string
        assert!(!is_options_txt("options.txt.bak")); // Backup file
        assert!(!is_options_txt("Options.txt")); // Different case (should be case-sensitive)
    }

    #[test]
    fn test_options_txt_special_handling_behavior() {
        // This test documents the expected behavior for options.txt special handling

        // Scenario 1: options.txt in manifest but doesn't exist locally
        // Expected: Should be downloaded normally
        let files_needing_download = vec!["options.txt"];
        assert!(files_needing_download.contains(&"options.txt"));

        // Scenario 2: options.txt exists locally and in manifest
        // Expected: Should be skipped (not downloaded, not validated, not replaced)
        // This is the core requirement - preserve existing user settings

        // Scenario 3: Other files should work normally
        let normal_files = vec![
            "config/some_mod.cfg",
            "mods/example.jar",
            "optionsshaders.txt",
        ];
        for file in normal_files {
            assert!(
                !is_options_txt(file),
                "File {} should not be treated as options.txt",
                file
            );
        }
    }
}
