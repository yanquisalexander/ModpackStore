use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Read;
use std::path::Path;
use zip::ZipArchive;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct MrpackManifest {
    #[serde(rename = "formatVersion")]
    pub format_version: u32,
    pub game: String,
    #[serde(rename = "versionId")]
    pub version_id: String,
    pub name: String,
    pub summary: Option<String>,
    pub files: Vec<MrpackFile>,
    pub dependencies: MrpackDependencies,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct MrpackFile {
    pub path: String,
    pub hashes: MrpackHashes,
    pub env: Option<MrpackEnv>,
    pub downloads: Vec<String>,
    #[serde(rename = "fileSize")]
    pub file_size: u64,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct MrpackHashes {
    pub sha1: String,
    pub sha512: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct MrpackEnv {
    pub client: Option<String>,
    pub server: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct MrpackDependencies {
    pub minecraft: String,
    pub forge: Option<String>,
    #[serde(rename = "fabric-loader")]
    pub fabric_loader: Option<String>,
    #[serde(rename = "quilt-loader")]
    pub quilt_loader: Option<String>,
    pub neoforge: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct MrpackCompatibility {
    pub is_compatible: bool,
    pub warnings: Vec<String>,
    pub errors: Vec<String>,
    pub loader: String,
    pub minecraft_version: String,
}

pub fn read_mrpack_manifest(mrpack_path: &Path) -> Result<MrpackManifest, String> {
    let file = fs::File::open(mrpack_path)
        .map_err(|e| format!("Failed to open .mrpack file: {}", e))?;

    let mut archive =
        ZipArchive::new(file).map_err(|e| format!("Invalid .mrpack file: {}", e))?;

    let mut manifest_file = archive
        .by_name("modrinth.index.json")
        .map_err(|_| "modrinth.index.json not found in .mrpack".to_string())?;

    let mut manifest_content = String::new();
    manifest_file
        .read_to_string(&mut manifest_content)
        .map_err(|e| format!("Failed to read manifest: {}", e))?;

    let manifest: MrpackManifest = serde_json::from_str(&manifest_content)
        .map_err(|e| format!("Invalid manifest format: {}", e))?;

    Ok(manifest)
}

#[tauri::command]
pub fn validate_mrpack_file(mrpack_path: String) -> Result<MrpackManifest, String> {
    let path = Path::new(&mrpack_path);

    if !path.exists() {
        return Err("File does not exist".to_string());
    }

    if !path
        .extension()
        .map_or(false, |ext| ext == "mrpack")
    {
        return Err("File is not a .mrpack file".to_string());
    }

    read_mrpack_manifest(path)
}

#[tauri::command]
pub fn check_mrpack_compatibility(
    manifest: MrpackManifest,
) -> Result<MrpackCompatibility, String> {
    let mut warnings = Vec::new();
    let mut errors = Vec::new();

    // Check game type
    if manifest.game != "minecraft" {
        errors.push(format!(
            "Unsupported game type: {}. Only Minecraft is supported.",
            manifest.game
        ));
    }

    // Determine loader
    let loader = if manifest.dependencies.forge.is_some() {
        "forge".to_string()
    } else if manifest.dependencies.fabric_loader.is_some() {
        "fabric".to_string()
    } else if manifest.dependencies.quilt_loader.is_some() {
        "quilt".to_string()
    } else if manifest.dependencies.neoforge.is_some() {
        "neoforge".to_string()
    } else {
        "vanilla".to_string()
    };

    // Check loader compatibility
    if loader != "forge" && loader != "vanilla" {
        errors.push(format!(
            "Solo se admite Forge actualmente. {}, Quilt y NeoForge no están soportados todavía.",
            if loader == "fabric" { "Fabric" } else { &loader }
        ));
    }

    // Add warning for optional mods
    let optional_mods: Vec<&MrpackFile> = manifest
        .files
        .iter()
        .filter(|f| {
            f.env.as_ref().map_or(false, |env| {
                env.client.as_ref().map_or(false, |c| c == "optional")
            })
        })
        .collect();

    if !optional_mods.is_empty() {
        warnings.push(format!(
            "Este modpack tiene {} mod(s) opcional(es) que puedes habilitar o deshabilitar durante la instalación.",
            optional_mods.len()
        ));
    }

    let is_compatible = errors.is_empty();

    Ok(MrpackCompatibility {
        is_compatible,
        warnings,
        errors,
        loader,
        minecraft_version: manifest.dependencies.minecraft.clone(),
    })
}
