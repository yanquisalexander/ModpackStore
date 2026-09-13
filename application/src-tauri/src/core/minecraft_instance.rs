// src-tauri/src/minecraft_instance.rs
use crate::core::instance_launcher::InstanceLauncher;
use crate::core::tasks_manager::{TaskInfo, TaskStatus};
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Result as IoResult;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::thread;
use tauri_plugin_opener::OpenerExt;

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ModLoaderType {
    Vanilla,
    Forge,
    Fabric,
    NeoForge,
    Quilt,
}

impl Default for ModLoaderType {
    fn default() -> Self {
        ModLoaderType::Vanilla
    }
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum InstanceType {
    Client,
    Server,
}

impl Default for InstanceType {
    fn default() -> Self {
        InstanceType::Client
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct MinecraftInstance {
    pub instanceId: String,
    pub usesDefaultIcon: bool,
    pub iconUrl: Option<String>,
    pub bannerUrl: Option<String>,
    pub instanceName: String,
    pub accountUuid: Option<String>,
    pub minecraftPath: String,
    pub modpackId: Option<String>,
    pub modpackVersionId: Option<String>,
    pub minecraftVersion: String,
    pub instanceDirectory: Option<String>,
    #[serde(default)]
    pub forgeVersion: Option<String>, // Deprecated, kept for backward compatibility
    #[serde(default)]
    pub loaderType: ModLoaderType,
    #[serde(default)]
    pub loaderVersion: Option<String>,
    pub javaPath: Option<String>, // In the future, we automatically download the correct Java version
    #[serde(default)]
    pub favorite: bool,
    #[serde(default)]
    pub favorite_order: Option<i32>,
    #[serde(default)]
    pub ms_nickname: Option<String>, // Custom nickname for ModpackStore auth
    #[serde(default)]
    pub useModpackStoreAuth: bool, // Use ModpackStore Yggdrasil auth instead of local account
    #[serde(default)]
    pub instanceType: InstanceType,
}

impl MinecraftInstance {
    pub fn is_forge_instance(&self) -> bool {
        matches!(self.loaderType, ModLoaderType::Forge) || self.forgeVersion.is_some()
    }

    pub fn is_vanilla_instance(&self) -> bool {
        matches!(self.loaderType, ModLoaderType::Vanilla)
    }

    pub fn is_fabric_instance(&self) -> bool {
        matches!(self.loaderType, ModLoaderType::Fabric)
    }

    pub fn is_neoforge_instance(&self) -> bool {
        matches!(self.loaderType, ModLoaderType::NeoForge)
    }

    pub fn is_quilt_instance(&self) -> bool {
        matches!(self.loaderType, ModLoaderType::Quilt)
    }

    pub fn is_server(&self) -> bool {
        matches!(self.instanceType, InstanceType::Server)
    }

    pub fn get_loader_name(&self) -> &str {
        match self.loaderType {
            ModLoaderType::Vanilla => "Vanilla",
            ModLoaderType::Forge => "Forge",
            ModLoaderType::Fabric => "Fabric",
            ModLoaderType::NeoForge => "NeoForge",
            ModLoaderType::Quilt => "Quilt",
        }
    }

    pub fn new() -> Self {
        Self {
            instanceId: String::new(),
            usesDefaultIcon: false,
            iconUrl: None,
            bannerUrl: None,
            instanceName: String::new(),
            accountUuid: None,
            minecraftPath: String::new(),
            modpackId: None,
            modpackVersionId: None,
            minecraftVersion: String::new(),
            instanceDirectory: None,
            forgeVersion: None,
            loaderType: ModLoaderType::Vanilla,
            loaderVersion: None,
            javaPath: None,
            favorite: false,
            favorite_order: None,
            ms_nickname: None,
            useModpackStoreAuth: false,
            instanceType: InstanceType::Client,
        }
    }

    pub fn from_instance_id(instance_id: &str) -> Option<Self> {
        let instances_dir = match crate::config::get_config_manager().lock() {
            Ok(guard) => match &*guard {
                Ok(mgr) => mgr.get_instances_dir(),
                Err(_) => return None,
            },
            Err(e) => {
                println!("Error locking ConfigManager mutex: {}", e);
                return None;
            }
        };

        println!(
            "Searching for instance {} in directory: {}",
            instance_id,
            instances_dir.display()
        );

        // Try to read the instances directory
        let dir_entries = match fs::read_dir(&instances_dir) {
            Ok(entries) => entries,
            Err(e) => {
                println!("Error reading instances directory: {}", e);
                return None;
            }
        };

        // Iterate through all directories looking for instance.json
        for entry in dir_entries {
            if let Ok(entry) = entry {
                let path = entry.path();
                if path.is_dir() {
                    let config_file = path.join("instance.json");
                    if config_file.exists() {
                        // Try to read and parse the instance.json file
                        if let Ok(content) = fs::read_to_string(&config_file) {
                            if let Ok(mut instance) =
                                serde_json::from_str::<MinecraftInstance>(&content)
                            {
                                // Migrate legacy fields
                                instance.migrate_legacy_fields();

                                // Check if this is the instance we're looking for
                                if instance.instanceId == instance_id {
                                    // Make sure instanceDirectory is set
                                    if instance.instanceDirectory.is_none() {
                                        // Use the native path without normalization to forward slashes
                                        // PathBuf will handle the conversion properly
                                        let native_path_str = path.to_string_lossy().to_string();
                                        instance.instanceDirectory = Some(native_path_str);
                                    }
                                    println!("Found instance: {}", instance.instanceName);
                                    return Some(instance);
                                }
                            }
                        }
                    }
                }
            }
        }

        println!("No instance found with ID: {}", instance_id);
        None
    }

    pub fn from_directory(directory: &Path) -> Option<Self> {
        let config_file = directory.join("instance.json");
        if !config_file.exists() {
            return None;
        }

        match fs::read_to_string(config_file) {
            Ok(content) => {
                match serde_json::from_str::<MinecraftInstance>(&content) {
                    Ok(mut instance) => {
                        // Migrate legacy fields
                        instance.migrate_legacy_fields();

                        // Aseguramos que instanceDirectory sea una ruta válida
                        // y que no esté vacía
                        if instance.instanceDirectory.is_none() {
                            // Use the native path without normalization to forward slashes
                            let native_path_str = directory.to_string_lossy().to_string();
                            instance.instanceDirectory = Some(native_path_str);
                        }
                        // Verificamos si la ruta de la instancia es válida
                        if instance.instanceDirectory.is_none() {
                            println!("Instance directory is not set or invalid.");
                            return None;
                        }
                        Some(instance)
                    }
                    Err(_) => None,
                }
            }
            Err(_) => None,
        }
    }

    pub fn save(&self) -> IoResult<()> {
        let config_file = Path::new(&self.instanceDirectory.as_ref().unwrap_or(&String::new()))
            .join("instance.json");
        let content = serde_json::to_string_pretty(self)?;
        // Atomic write: temp file + rename to prevent truncation on crash
        let temp_path = config_file.with_extension("json.tmp");
        fs::write(&temp_path, &content)?;
        fs::rename(&temp_path, &config_file)?;
        // Invalidate the cached instance list so next read is fresh
        crate::core::instance_manager::invalidate_instance_cache();
        Ok(())
    }

    pub fn delete(&self) -> IoResult<()> {
        if let Some(directory) = &self.instanceDirectory {
            fs::remove_dir_all(directory)
        } else {
            Ok(())
        }
    }

    pub fn launch(&self) -> Result<(), String> {
        let launcher = InstanceLauncher::new(self.clone());
        launcher.launch_instance_async();

        println!(
            "[Tauri Command] Successfully initiated async launch for {}",
            self.instanceName
        );
        Ok(())
    }

    pub fn set_java_path(&mut self, java_path: PathBuf) {
        self.javaPath = Some(java_path.to_string_lossy().to_string());

        // Guardar la ruta de Java en el archivo de configuración
        self.save().unwrap_or_else(|e| {
            println!("Error saving Java path: {}", e);
        });
    }

    pub fn migrate_legacy_fields(&mut self) {
        // Migrate forgeVersion to loaderType for backward compatibility
        if self.loaderType == ModLoaderType::Vanilla && self.forgeVersion.is_some() {
            self.loaderType = ModLoaderType::Forge;
            self.loaderVersion = self.forgeVersion.clone();
        }
    }

    pub fn check_eula(&self) -> bool {
        if !self.is_server() {
            return true;
        }
        let eula_path = PathBuf::from(&self.minecraftPath).join("eula.txt");
        if !eula_path.exists() {
            return false;
        }
        if let Ok(content) = fs::read_to_string(eula_path) {
            return content.contains("eula=true");
        }
        false
    }

    pub fn accept_eula(&self) -> IoResult<()> {
        let eula_path = PathBuf::from(&self.minecraftPath).join("eula.txt");
        fs::write(
            eula_path,
            "#By changing the setting below to TRUE you are indicating your agreement to our EULA (https://aka.ms/MinecraftEULA).\neula=true",
        )
    }
}

#[tauri::command]
pub fn save_minecraft_instance(instance: MinecraftInstance) -> bool {
    instance.save().is_ok()
}

#[tauri::command]
pub fn revalidate_assets(instance: MinecraftInstance) -> Result<(), String> {
    // Implementar la lógica para revalidar assets
    println!(
        "Revalidating assets for instance: {}",
        instance.instanceName
    );
    Ok(())
}

#[tauri::command]
pub fn get_instances_by_modpack_id(modpack_id: String) -> Vec<MinecraftInstance> {
    /*
        Gets all instances that match the given modpack ID
    */
    let mut instances = Vec::new();
    let config_manager_mutex = crate::config::get_config_manager();
    let instances_dir = match config_manager_mutex.lock() {
        Ok(guard) => match &*guard {
            Ok(mgr) => mgr.get_instances_dir(),
            Err(e) => {
                eprintln!("Error getting config manager: {}", e);
                return instances;
            }
        },
        Err(e) => {
            eprintln!("Error locking ConfigManager mutex: {}", e);
            return instances;
        }
    };
    if let Ok(entries) = fs::read_dir(instances_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                let config_file = path.join("instance.json");
                if config_file.exists() {
                    if let Ok(content) = fs::read_to_string(&config_file) {
                        if let Ok(mut instance) =
                            serde_json::from_str::<MinecraftInstance>(&content)
                        {
                            // Migrate legacy fields
                            instance.migrate_legacy_fields();

                            if instance.modpackId == Some(modpack_id.clone()) {
                                instances.push(instance);
                            }
                        }
                    }
                }
            }
        }
    }
    instances
}

#[tauri::command]
pub fn open_game_dir(app_handle: tauri::AppHandle, instance_id: String) -> Result<(), String> {
    println!(
        "[Tauri Command] Opening game directory for instance ID: {}",
        instance_id
    );
    let instance = MinecraftInstance::from_instance_id(&instance_id);
    if let Some(instance) = instance {
        let path = if cfg!(target_os = "windows") {
            PathBuf::from(instance.minecraftPath.replace("/", "\\"))
        } else {
            PathBuf::from(instance.minecraftPath.replace("\\", "/"))
        };
        println!("[Tauri Command] Opening game directory: {}", path.display());
        if path.exists() {
            // Abre el directorio del juego con el programa predeterminado del sistema
            if let Err(e) = app_handle.opener().open_path(path.to_string_lossy().to_string(), None::<&str>) {
                return Err(format!("Error opening game directory: {}", e));
            }
            Ok(())
        } else {
            Err("Game directory does not exist".to_string())
        }
    } else {
        Err("Instance not found".to_string())
    }
}
