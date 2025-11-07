use crate::core::minecraft_instance::MinecraftInstance;
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{self, Read, Write};
use std::path::{Path, PathBuf};
use walkdir::WalkDir;
use zip::write::FileOptions;
use zip::{CompressionMethod, ZipArchive, ZipWriter};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct World {
    pub name: String,
    pub path: String,
    pub icon_path: Option<String>,
    pub last_modified: u64,
    pub size_bytes: u64,
    pub level_name: Option<String>,
    pub game_type: Option<i32>,
    pub difficulty: Option<i32>,
    pub hardcore: Option<bool>,
    pub allow_commands: Option<bool>,
    pub version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorldEditData {
    pub game_type: i32,
    pub difficulty: i32,
    pub allow_commands: bool,
    pub hardcore: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportConflict {
    pub conflict_type: String, // "name_exists" or "version_mismatch"
    pub message: String,
    pub world_name: String,
    pub existing_version: Option<String>,
    pub import_version: Option<String>,
}

/// Calculate the total size of a directory
fn calculate_directory_size(path: &Path) -> io::Result<u64> {
    let mut total_size = 0u64;
    
    for entry in WalkDir::new(path).into_iter().filter_map(|e| e.ok()) {
        if entry.file_type().is_file() {
            total_size += entry.metadata()?.len();
        }
    }
    
    Ok(total_size)
}

/// Get the last modified time of a file/directory
fn get_last_modified(path: &Path) -> io::Result<u64> {
    let metadata = fs::metadata(path)?;
    let modified = metadata.modified()?;
    let duration = modified.duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| io::Error::new(io::ErrorKind::Other, e))?;
    Ok(duration.as_secs())
}

/// Read NBT data from level.dat
fn read_level_dat(path: &Path) -> Result<fastnbt::Value, Box<dyn std::error::Error>> {
    let level_dat_path = path.join("level.dat");
    if !level_dat_path.exists() {
        return Err("level.dat not found".into());
    }

    let data = fs::read(&level_dat_path)?;
    
    // Minecraft level.dat files are GZip compressed NBT
    let mut decoder = flate2::read::GzDecoder::new(&data[..]);
    let mut decompressed = Vec::new();
    decoder.read_to_end(&mut decompressed)?;
    
    // Parse NBT
    let value: fastnbt::Value = fastnbt::from_bytes(&decompressed)?;
    
    Ok(value)
}

/// Extract world information from level.dat
fn extract_world_info(nbt: &fastnbt::Value) -> (Option<String>, Option<i32>, Option<i32>, Option<bool>, Option<bool>, Option<String>) {
    let mut level_name = None;
    let mut game_type = None;
    let mut difficulty = None;
    let mut hardcore = None;
    let mut allow_commands = None;
    let mut version = None;

    if let fastnbt::Value::Compound(root) = nbt {
        if let Some(fastnbt::Value::Compound(data)) = root.get("Data") {
            // Get LevelName
            if let Some(fastnbt::Value::String(name)) = data.get("LevelName") {
                level_name = Some(name.clone());
            }
            
            // Get GameType
            if let Some(fastnbt::Value::Int(gt)) = data.get("GameType") {
                game_type = Some(*gt);
            }
            
            // Get Difficulty
            if let Some(fastnbt::Value::Byte(diff)) = data.get("Difficulty") {
                difficulty = Some(*diff as i32);
            }
            
            // Get hardcore
            if let Some(fastnbt::Value::Byte(hc)) = data.get("hardcore") {
                hardcore = Some(*hc != 0);
            }
            
            // Get allowCommands
            if let Some(fastnbt::Value::Byte(ac)) = data.get("allowCommands") {
                allow_commands = Some(*ac != 0);
            }
            
            // Get Version
            if let Some(fastnbt::Value::Compound(ver)) = data.get("Version") {
                if let Some(fastnbt::Value::String(name)) = ver.get("Name") {
                    version = Some(name.clone());
                }
            }
        }
    }

    (level_name, game_type, difficulty, hardcore, allow_commands, version)
}

/// List all worlds in an instance
#[tauri::command]
pub fn list_worlds(instance_id: String) -> Result<Vec<World>, String> {
    let instance = MinecraftInstance::from_instance_id(&instance_id)
        .ok_or("Instance not found".to_string())?;
    
    let saves_path = PathBuf::from(&instance.minecraftPath).join("saves");
    
    if !saves_path.exists() {
        return Ok(Vec::new());
    }

    let mut worlds = Vec::new();

    for entry in fs::read_dir(&saves_path).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        
        if !path.is_dir() {
            continue;
        }

        let name = path.file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("Unknown")
            .to_string();

        // Check if level.dat exists
        let level_dat = path.join("level.dat");
        if !level_dat.exists() {
            continue; // Skip directories without level.dat
        }

        let icon_path = path.join("icon.png");
        let icon_path_str = if icon_path.exists() {
            Some(icon_path.to_string_lossy().to_string())
        } else {
            None
        };

        let last_modified = get_last_modified(&level_dat).unwrap_or(0);
        let size_bytes = calculate_directory_size(&path).unwrap_or(0);

        // Try to read level.dat
        let (level_name, game_type, difficulty, hardcore, allow_commands, version) = 
            if let Ok(nbt) = read_level_dat(&path) {
                extract_world_info(&nbt)
            } else {
                (None, None, None, None, None, None)
            };

        worlds.push(World {
            name,
            path: path.to_string_lossy().to_string(),
            icon_path: icon_path_str,
            last_modified,
            size_bytes,
            level_name,
            game_type,
            difficulty,
            hardcore,
            allow_commands,
            version,
        });
    }

    // Sort by last modified (newest first)
    worlds.sort_by(|a, b| b.last_modified.cmp(&a.last_modified));

    Ok(worlds)
}

/// Delete a world
#[tauri::command]
pub fn delete_world(instance_id: String, world_name: String) -> Result<(), String> {
    let instance = MinecraftInstance::from_instance_id(&instance_id)
        .ok_or("Instance not found".to_string())?;
    
    let world_path = PathBuf::from(&instance.minecraftPath)
        .join("saves")
        .join(&world_name);
    
    if !world_path.exists() {
        return Err("World not found".to_string());
    }

    fs::remove_dir_all(&world_path).map_err(|e| format!("Failed to delete world: {}", e))?;

    Ok(())
}

/// Export a world to a ZIP file
#[tauri::command]
pub fn export_world(instance_id: String, world_name: String, destination_path: String) -> Result<(), String> {
    let instance = MinecraftInstance::from_instance_id(&instance_id)
        .ok_or("Instance not found".to_string())?;
    
    let world_path = PathBuf::from(&instance.minecraftPath)
        .join("saves")
        .join(&world_name);
    
    if !world_path.exists() {
        return Err("World not found".to_string());
    }

    let dest_path = PathBuf::from(&destination_path);
    let file = fs::File::create(&dest_path)
        .map_err(|e| format!("Failed to create ZIP file: {}", e))?;
    
    let mut zip = ZipWriter::new(file);
    let options = FileOptions::default()
        .compression_method(CompressionMethod::Deflated)
        .unix_permissions(0o755);

    // Walk through the world directory and add files to ZIP
    for entry in WalkDir::new(&world_path).into_iter().filter_map(|e| e.ok()) {
        let path = entry.path();
        let relative_path = path.strip_prefix(&world_path)
            .map_err(|e| format!("Failed to get relative path: {}", e))?;

        if path.is_file() {
            zip.start_file(relative_path.to_string_lossy().to_string(), options)
                .map_err(|e| format!("Failed to add file to ZIP: {}", e))?;
            
            let mut f = fs::File::open(path)
                .map_err(|e| format!("Failed to open file: {}", e))?;
            io::copy(&mut f, &mut zip)
                .map_err(|e| format!("Failed to write file to ZIP: {}", e))?;
        } else if path.is_dir() && path != world_path {
            // Add directory entry
            let dir_path = format!("{}/", relative_path.to_string_lossy());
            zip.add_directory(dir_path, options)
                .map_err(|e| format!("Failed to add directory to ZIP: {}", e))?;
        }
    }

    zip.finish().map_err(|e| format!("Failed to finalize ZIP: {}", e))?;

    Ok(())
}

/// Import a world from a ZIP file
#[tauri::command]
pub fn import_world(
    instance_id: String,
    zip_path: String,
    overwrite: bool,
) -> Result<(), String> {
    let instance = MinecraftInstance::from_instance_id(&instance_id)
        .ok_or("Instance not found".to_string())?;
    
    let saves_path = PathBuf::from(&instance.minecraftPath).join("saves");
    
    // Create saves directory if it doesn't exist
    if !saves_path.exists() {
        fs::create_dir_all(&saves_path)
            .map_err(|e| format!("Failed to create saves directory: {}", e))?;
    }

    // Open the ZIP file
    let file = fs::File::open(&zip_path)
        .map_err(|e| format!("Failed to open ZIP file: {}", e))?;
    let mut archive = ZipArchive::new(file)
        .map_err(|e| format!("Failed to read ZIP archive: {}", e))?;

    // Create a temporary directory for extraction
    let temp_dir = std::env::temp_dir().join(format!("world_import_{}", uuid::Uuid::new_v4()));
    fs::create_dir_all(&temp_dir)
        .map_err(|e| format!("Failed to create temp directory: {}", e))?;

    // Extract to temp directory first
    for i in 0..archive.len() {
        let mut file = archive.by_index(i)
            .map_err(|e| format!("Failed to read file from ZIP: {}", e))?;
        let outpath = temp_dir.join(file.name());

        if file.is_dir() {
            fs::create_dir_all(&outpath)
                .map_err(|e| format!("Failed to create directory: {}", e))?;
        } else {
            if let Some(p) = outpath.parent() {
                if !p.exists() {
                    fs::create_dir_all(p)
                        .map_err(|e| format!("Failed to create parent directory: {}", e))?;
                }
            }
            let mut outfile = fs::File::create(&outpath)
                .map_err(|e| format!("Failed to create file: {}", e))?;
            io::copy(&mut file, &mut outfile)
                .map_err(|e| format!("Failed to extract file: {}", e))?;
        }
    }

    // Validate that level.dat exists in the extracted files
    let level_dat_path = temp_dir.join("level.dat");
    if !level_dat_path.exists() {
        // Clean up temp directory
        let _ = fs::remove_dir_all(&temp_dir);
        return Err("Invalid world: level.dat not found in ZIP".to_string());
    }

    // Determine the world name from level.dat
    let world_name = if let Ok(nbt) = read_level_dat(&temp_dir) {
        let (level_name, _, _, _, _, _) = extract_world_info(&nbt);
        level_name.unwrap_or_else(|| {
            // Use the ZIP file name as fallback
            PathBuf::from(&zip_path)
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("imported_world")
                .to_string()
        })
    } else {
        PathBuf::from(&zip_path)
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("imported_world")
            .to_string()
    };

    let destination = saves_path.join(&world_name);

    // Check for conflicts
    if destination.exists() && !overwrite {
        // Clean up temp directory
        let _ = fs::remove_dir_all(&temp_dir);
        return Err(format!("CONFLICT:World '{}' already exists", world_name));
    }

    // If overwrite is true and destination exists, remove it
    if destination.exists() && overwrite {
        fs::remove_dir_all(&destination)
            .map_err(|e| format!("Failed to remove existing world: {}", e))?;
    }

    // Move from temp to saves directory
    fs::rename(&temp_dir, &destination)
        .map_err(|e| format!("Failed to move world to saves directory: {}", e))?;

    Ok(())
}

/// Validate a world ZIP before importing
#[tauri::command]
pub fn validate_world_import(
    instance_id: String,
    zip_path: String,
) -> Result<Option<ImportConflict>, String> {
    let instance = MinecraftInstance::from_instance_id(&instance_id)
        .ok_or("Instance not found".to_string())?;
    
    let saves_path = PathBuf::from(&instance.minecraftPath).join("saves");

    // Open the ZIP file
    let file = fs::File::open(&zip_path)
        .map_err(|e| format!("Failed to open ZIP file: {}", e))?;
    let mut archive = ZipArchive::new(file)
        .map_err(|e| format!("Failed to read ZIP archive: {}", e))?;

    // Check if level.dat exists in ZIP
    let has_level_dat = (0..archive.len()).any(|i| {
        archive.by_index(i)
            .ok()
            .map(|f| f.name() == "level.dat")
            .unwrap_or(false)
    });

    if !has_level_dat {
        return Err("Invalid world: level.dat not found in ZIP".to_string());
    }

    // Extract level.dat to temp location to read world name
    let temp_dir = std::env::temp_dir().join(format!("world_validate_{}", uuid::Uuid::new_v4()));
    fs::create_dir_all(&temp_dir)
        .map_err(|e| format!("Failed to create temp directory: {}", e))?;

    // Extract just level.dat
    for i in 0..archive.len() {
        let mut file = archive.by_index(i)
            .map_err(|e| format!("Failed to read file from ZIP: {}", e))?;
        if file.name() == "level.dat" {
            let outpath = temp_dir.join("level.dat");
            let mut outfile = fs::File::create(&outpath)
                .map_err(|e| format!("Failed to create file: {}", e))?;
            io::copy(&mut file, &mut outfile)
                .map_err(|e| format!("Failed to extract file: {}", e))?;
            break;
        }
    }

    let world_name = if let Ok(nbt) = read_level_dat(&temp_dir) {
        let (level_name, _, _, _, _, import_version) = extract_world_info(&nbt);
        let name = level_name.unwrap_or_else(|| {
            PathBuf::from(&zip_path)
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("imported_world")
                .to_string()
        });
        
        // Check for name conflicts
        let destination = saves_path.join(&name);
        if destination.exists() {
            // Check version mismatch
            if let Ok(existing_nbt) = read_level_dat(&destination) {
                let (_, _, _, _, _, existing_version) = extract_world_info(&existing_nbt);
                
                if existing_version != import_version && existing_version.is_some() && import_version.is_some() {
                    // Clean up temp directory
                    let _ = fs::remove_dir_all(&temp_dir);
                    return Ok(Some(ImportConflict {
                        conflict_type: "version_mismatch".to_string(),
                        message: format!(
                            "World version mismatch: existing world is version {}, importing world is version {}",
                            existing_version.unwrap_or_default(),
                            import_version.unwrap_or_default()
                        ),
                        world_name: name.clone(),
                        existing_version,
                        import_version,
                    }));
                }
            }
            
            // Clean up temp directory
            let _ = fs::remove_dir_all(&temp_dir);
            return Ok(Some(ImportConflict {
                conflict_type: "name_exists".to_string(),
                message: format!("A world named '{}' already exists", name),
                world_name: name,
                existing_version: None,
                import_version: None,
            }));
        }
        
        name
    } else {
        // Clean up temp directory
        let _ = fs::remove_dir_all(&temp_dir);
        return Err("Failed to read level.dat from ZIP".to_string());
    };

    // Clean up temp directory
    let _ = fs::remove_dir_all(&temp_dir);

    Ok(None) // No conflicts
}

/// Edit world settings
#[tauri::command]
pub fn edit_world_settings(
    instance_id: String,
    world_name: String,
    settings: WorldEditData,
) -> Result<(), String> {
    let instance = MinecraftInstance::from_instance_id(&instance_id)
        .ok_or("Instance not found".to_string())?;
    
    let world_path = PathBuf::from(&instance.minecraftPath)
        .join("saves")
        .join(&world_name);
    
    if !world_path.exists() {
        return Err("World not found".to_string());
    }

    let level_dat_path = world_path.join("level.dat");
    if !level_dat_path.exists() {
        return Err("level.dat not found".to_string());
    }

    // Read existing level.dat
    let data = fs::read(&level_dat_path)
        .map_err(|e| format!("Failed to read level.dat: {}", e))?;
    
    let mut decoder = flate2::read::GzDecoder::new(&data[..]);
    let mut decompressed = Vec::new();
    decoder.read_to_end(&mut decompressed)
        .map_err(|e| format!("Failed to decompress level.dat: {}", e))?;
    
    let mut nbt: fastnbt::Value = fastnbt::from_bytes(&decompressed)
        .map_err(|e| format!("Failed to parse NBT: {}", e))?;

    // Modify the NBT data
    if let fastnbt::Value::Compound(ref mut root) = nbt {
        if let Some(fastnbt::Value::Compound(ref mut data)) = root.get_mut("Data") {
            // Update GameType
            data.insert("GameType".to_string(), fastnbt::Value::Int(settings.game_type));
            
            // Update Difficulty
            data.insert("Difficulty".to_string(), fastnbt::Value::Byte(settings.difficulty as i8));
            
            // Update allowCommands
            data.insert("allowCommands".to_string(), fastnbt::Value::Byte(if settings.allow_commands { 1 } else { 0 }));
            
            // Update hardcore
            data.insert("hardcore".to_string(), fastnbt::Value::Byte(if settings.hardcore { 1 } else { 0 }));
        }
    }

    // Serialize back to NBT
    let serialized = fastnbt::to_bytes(&nbt)
        .map_err(|e| format!("Failed to serialize NBT: {}", e))?;

    // Compress with GZip
    let mut encoder = flate2::write::GzEncoder::new(Vec::new(), flate2::Compression::default());
    encoder.write_all(&serialized)
        .map_err(|e| format!("Failed to compress NBT: {}", e))?;
    let compressed = encoder.finish()
        .map_err(|e| format!("Failed to finalize compression: {}", e))?;

    // Write back to level.dat
    fs::write(&level_dat_path, compressed)
        .map_err(|e| format!("Failed to write level.dat: {}", e))?;

    Ok(())
}
