# Client-Side .mrpack Import Implementation Guide

## Overview

This guide outlines the implementation plan for client-side .mrpack (Modrinth modpack) import functionality. The backend support is already complete - this focuses on the user-facing application features.

## Current Status

✅ **Backend (Complete)**
- Import service for .mrpack files
- API endpoint for creators to import
- Validation and processing logic
- Tests and documentation

❌ **Client (Pending)**
- Drag-and-drop support
- File picker import
- Installation dialog
- Modloader compatibility checking

## Implementation Plan

### Phase 1: Basic .mrpack File Handling (Rust/Tauri)

#### 1.1 Add .mrpack File Reader

**File:** `application/src-tauri/src/core/mrpack_handler.rs` (new file)

```rust
use std::fs;
use std::path::Path;
use serde::{Deserialize, Serialize};
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

pub fn read_mrpack_manifest(mrpack_path: &Path) -> Result<MrpackManifest, String> {
    let file = fs::File::open(mrpack_path)
        .map_err(|e| format!("Failed to open .mrpack file: {}", e))?;
    
    let mut archive = ZipArchive::new(file)
        .map_err(|e| format!("Invalid .mrpack file: {}", e))?;
    
    let mut manifest_file = archive
        .by_name("modrinth.index.json")
        .map_err(|_| "modrinth.index.json not found in .mrpack".to_string())?;
    
    let mut manifest_content = String::new();
    use std::io::Read;
    manifest_file.read_to_string(&mut manifest_content)
        .map_err(|e| format!("Failed to read manifest: {}", e))?;
    
    let manifest: MrpackManifest = serde_json::from_str(&manifest_content)
        .map_err(|e| format!("Invalid manifest format: {}", e))?;
    
    Ok(manifest)
}

pub fn extract_mrpack_overrides(
    mrpack_path: &Path,
    target_dir: &Path,
) -> Result<Vec<String>, String> {
    let file = fs::File::open(mrpack_path)
        .map_err(|e| format!("Failed to open .mrpack file: {}", e))?;
    
    let mut archive = ZipArchive::new(file)
        .map_err(|e| format!("Invalid .mrpack file: {}", e))?;
    
    let mut extracted_files = Vec::new();
    
    for i in 0..archive.len() {
        let mut file = archive.by_index(i)
            .map_err(|e| format!("Failed to access file: {}", e))?;
        
        let filepath = file.enclosed_name()
            .ok_or("Invalid file path in archive")?;
        
        // Only extract files from overrides/
        if filepath.starts_with("overrides/") {
            let relative_path = filepath.strip_prefix("overrides/").unwrap();
            let outpath = target_dir.join(relative_path);
            
            if file.is_dir() {
                fs::create_dir_all(&outpath)
                    .map_err(|e| format!("Failed to create directory: {}", e))?;
            } else {
                if let Some(parent) = outpath.parent() {
                    fs::create_dir_all(parent)
                        .map_err(|e| format!("Failed to create parent directory: {}", e))?;
                }
                
                let mut outfile = fs::File::create(&outpath)
                    .map_err(|e| format!("Failed to create file: {}", e))?;
                
                use std::io::copy;
                copy(&mut file, &mut outfile)
                    .map_err(|e| format!("Failed to extract file: {}", e))?;
                
                extracted_files.push(relative_path.to_string_lossy().to_string());
            }
        }
    }
    
    Ok(extracted_files)
}
```

#### 1.2 Add Tauri Commands

**File:** `application/src-tauri/src/core/mrpack_handler.rs` (continued)

```rust
#[tauri::command]
pub fn validate_mrpack_file(mrpack_path: String) -> Result<MrpackManifest, String> {
    let path = Path::new(&mrpack_path);
    
    if !path.exists() {
        return Err("File does not exist".to_string());
    }
    
    if !path.extension().map_or(false, |ext| ext == "mrpack") {
        return Err("File is not a .mrpack file".to_string());
    }
    
    read_mrpack_manifest(path)
}

#[tauri::command]
pub fn check_mrpack_compatibility(manifest: MrpackManifest) -> Result<MrpackCompatibility, String> {
    let mut warnings = Vec::new();
    let mut errors = Vec::new();
    
    // Check modloader support
    if manifest.dependencies.fabric_loader.is_some() {
        errors.push("Fabric no está soportado actualmente. Solo Forge es compatible.".to_string());
    }
    
    if manifest.dependencies.quilt_loader.is_some() {
        errors.push("Quilt no está soportado actualmente. Solo Forge es compatible.".to_string());
    }
    
    if manifest.dependencies.neoforge.is_some() {
        errors.push("NeoForge no está soportado actualmente. Solo Forge es compatible.".to_string());
    }
    
    // Check for optional mods
    let optional_mods: Vec<&MrpackFile> = manifest.files.iter()
        .filter(|f| {
            f.env.as_ref().map_or(false, |env| {
                env.client == Some("optional".to_string())
            })
        })
        .collect();
    
    if !optional_mods.is_empty() {
        warnings.push(format!("{} mods opcionales encontrados", optional_mods.len()));
    }
    
    Ok(MrpackCompatibility {
        compatible: errors.is_empty(),
        errors,
        warnings,
        minecraft_version: manifest.dependencies.minecraft.clone(),
        modloader: if manifest.dependencies.forge.is_some() {
            "Forge".to_string()
        } else {
            "None".to_string()
        },
        optional_mods_count: optional_mods.len(),
    })
}

#[derive(Serialize, Deserialize, Debug)]
pub struct MrpackCompatibility {
    pub compatible: bool,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
    pub minecraft_version: String,
    pub modloader: String,
    pub optional_mods_count: usize,
}
```

#### 1.3 Register Commands in main.rs

**File:** `application/src-tauri/src/main.rs`

```rust
// Add to imports
mod core::mrpack_handler;

// Add to .invoke_handler()
.invoke_handler(tauri::generate_handler![
    // ... existing commands ...
    core::mrpack_handler::validate_mrpack_file,
    core::mrpack_handler::check_mrpack_compatibility,
])
```

### Phase 2: React UI Components

#### 2.1 Import .mrpack Dialog Component

**File:** `application/src/components/import-modpack/ImportMrpackDialog.tsx` (new file)

```tsx
import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { LucidePackageImport, LucideAlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface MrpackManifest {
  formatVersion: number;
  game: string;
  versionId: string;
  name: string;
  summary?: string;
  files: MrpackFile[];
  dependencies: {
    minecraft: string;
    forge?: string;
    "fabric-loader"?: string;
    "quilt-loader"?: string;
    neoforge?: string;
  };
}

interface MrpackFile {
  path: string;
  hashes: {
    sha1: string;
    sha512: string;
  };
  env?: {
    client?: string;
    server?: string;
  };
  downloads: string[];
  fileSize: number;
}

interface MrpackCompatibility {
  compatible: boolean;
  errors: string[];
  warnings: string[];
  minecraftVersion: string;
  modloader: string;
  optionalModsCount: number;
}

export const ImportMrpackDialog = ({ onInstanceCreated }: { onInstanceCreated: () => void }) => {
  const [open, setOpen] = useState(false);
  const [mrpackPath, setMrpackPath] = useState<string | null>(null);
  const [manifest, setManifest] = useState<MrpackManifest | null>(null);
  const [compatibility, setCompatibility] = useState<MrpackCompatibility | null>(null);
  const [instanceName, setInstanceName] = useState("");
  const [isImporting, setIsImporting] = useState(false);

  const handleSelectFile = async () => {
    try {
      const selected = await open({
        filters: [
          {
            name: "Modrinth Modpack",
            extensions: ["mrpack"],
          },
        ],
      });

      if (selected) {
        const path = Array.isArray(selected) ? selected[0] : selected;
        setMrpackPath(path);

        // Validate and read manifest
        const manifestData = await invoke<MrpackManifest>("validate_mrpack_file", {
          mrpackPath: path,
        });

        setManifest(manifestData);
        setInstanceName(manifestData.name);

        // Check compatibility
        const compat = await invoke<MrpackCompatibility>("check_mrpack_compatibility", {
          manifest: manifestData,
        });

        setCompatibility(compat);
      }
    } catch (error) {
      toast.error("Error al leer el archivo .mrpack", {
        description: String(error),
      });
    }
  };

  const handleImport = async () => {
    if (!mrpackPath || !manifest) return;

    setIsImporting(true);
    try {
      // This would call a Tauri command that creates the instance from .mrpack
      await invoke("create_instance_from_mrpack", {
        mrpackPath,
        instanceName,
      });

      toast.success("Modpack importado exitosamente");
      setOpen(false);
      onInstanceCreated();
    } catch (error) {
      toast.error("Error al importar modpack", {
        description: String(error),
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <LucidePackageImport className="size-4" />
          Importar .mrpack
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Importar Modpack de Modrinth</DialogTitle>
          <DialogDescription>
            Selecciona un archivo .mrpack para crear una nueva instancia
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {!mrpackPath ? (
            <Button onClick={handleSelectFile} className="w-full">
              Seleccionar archivo .mrpack
            </Button>
          ) : (
            <>
              {/* Display manifest info */}
              <div className="space-y-2">
                <Label>Archivo seleccionado</Label>
                <div className="text-sm text-muted-foreground break-all">
                  {mrpackPath}
                </div>
              </div>

              {manifest && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Modpack</Label>
                      <div className="text-sm font-medium">{manifest.name}</div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Versión</Label>
                      <div className="text-sm font-medium">{manifest.versionId}</div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Minecraft</Label>
                      <div className="text-sm font-medium">{manifest.dependencies.minecraft}</div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Mods</Label>
                      <div className="text-sm font-medium">{manifest.files.length}</div>
                    </div>
                  </div>

                  {manifest.summary && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Descripción</Label>
                      <div className="text-sm">{manifest.summary}</div>
                    </div>
                  )}
                </>
              )}

              {/* Compatibility warnings/errors */}
              {compatibility && (
                <>
                  {compatibility.errors.length > 0 && (
                    <Alert variant="destructive">
                      <LucideAlertTriangle className="h-4 w-4" />
                      <AlertTitle>Incompatible</AlertTitle>
                      <AlertDescription>
                        <ul className="list-disc list-inside">
                          {compatibility.errors.map((error, i) => (
                            <li key={i}>{error}</li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}

                  {compatibility.warnings.length > 0 && (
                    <Alert>
                      <AlertTitle>Advertencias</AlertTitle>
                      <AlertDescription>
                        <ul className="list-disc list-inside">
                          {compatibility.warnings.map((warning, i) => (
                            <li key={i}>{warning}</li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}
                </>
              )}

              {/* Instance name input */}
              <div>
                <Label htmlFor="instance-name">Nombre de la instancia</Label>
                <Input
                  id="instance-name"
                  value={instanceName}
                  onChange={(e) => setInstanceName(e.target.value)}
                  placeholder="Mi Modpack"
                />
              </div>

              <Button
                onClick={() => {
                  setMrpackPath(null);
                  setManifest(null);
                  setCompatibility(null);
                }}
                variant="outline"
              >
                Cambiar archivo
              </Button>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleImport}
            disabled={!mrpackPath || !compatibility?.compatible || isImporting}
          >
            {isImporting ? "Importando..." : "Importar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
```

#### 2.2 Add to My Instances Section

**File:** `application/src/views/MyInstancesSection.tsx`

```tsx
import { ImportMrpackDialog } from "@/components/import-modpack/ImportMrpackDialog";

// In the render section, add after CreateInstanceDialog:
<ImportMrpackDialog onInstanceCreated={fetchInstances} />
```

### Phase 3: Create Instance from .mrpack (Rust)

**File:** `application/src-tauri/src/core/instance_manager.rs`

Add new command:

```rust
#[tauri::command]
pub async fn create_instance_from_mrpack(
    mrpack_path: String,
    instance_name: String,
) -> Result<String, String> {
    use crate::core::mrpack_handler::{read_mrpack_manifest, extract_mrpack_overrides};
    
    let path = Path::new(&mrpack_path);
    let manifest = read_mrpack_manifest(path)?;
    
    // Validate that it's compatible (Forge only)
    if manifest.dependencies.fabric_loader.is_some() ||
       manifest.dependencies.quilt_loader.is_some() ||
       manifest.dependencies.neoforge.is_some() {
        return Err("Solo se admite Forge actualmente".to_string());
    }
    
    // Create instance directory
    let instances_dir = get_instances_dir()?;
    let instance_id = uuid::Uuid::new_v4().to_string();
    let instance_dir = instances_dir.join(&instance_id);
    fs::create_dir_all(&instance_dir)
        .map_err(|e| format!("Failed to create instance directory: {}", e))?;
    
    // Extract overrides
    extract_mrpack_overrides(path, &instance_dir)?;
    
    // Download mods from manifest
    download_mrpack_mods(&manifest, &instance_dir).await?;
    
    // Create instance configuration
    let instance = MinecraftInstance {
        instanceId: instance_id.clone(),
        instanceName: instance_name,
        minecraftVersion: manifest.dependencies.minecraft.clone(),
        forgeVersion: manifest.dependencies.forge.clone(),
        modpackId: None,
        modpackVersionId: None,
        modpackInfo: Some(ModpackInfo {
            name: manifest.name,
            version: manifest.version_id,
        }),
        instanceDirectory: Some(instance_dir.to_string_lossy().to_string()),
        // ... other fields ...
    };
    
    instance.save()?;
    
    Ok(instance_id)
}

async fn download_mrpack_mods(
    manifest: &MrpackManifest,
    instance_dir: &Path,
) -> Result<(), String> {
    let mods_dir = instance_dir.join("mods");
    fs::create_dir_all(&mods_dir)
        .map_err(|e| format!("Failed to create mods directory: {}", e))?;
    
    for file in &manifest.files {
        // Try each download URL
        let mut downloaded = false;
        for url in &file.downloads {
            match download_file_from_url(url, &mods_dir.join(&file.path)).await {
                Ok(_) => {
                    // Verify hash
                    if verify_file_hash(&mods_dir.join(&file.path), &file.hashes.sha1)? {
                        downloaded = true;
                        break;
                    }
                }
                Err(_) => continue,
            }
        }
        
        if !downloaded {
            return Err(format!("Failed to download: {}", file.path));
        }
    }
    
    Ok(())
}
```

### Phase 4: Drag and Drop Support

**File:** `application/src/views/MyInstancesSection.tsx`

Add drag-and-drop handling:

```tsx
import { useEffect, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";

// Inside component:
useEffect(() => {
  const unlisten = listen<string[]>("tauri://drag-drop", async (event) => {
    const files = event.payload;
    const mrpackFiles = files.filter(f => f.endsWith(".mrpack"));
    
    if (mrpackFiles.length > 0) {
      // Handle .mrpack file drop
      // Could open ImportMrpackDialog with the file pre-selected
      toast.info(`Archivo .mrpack detectado: ${mrpackFiles[0]}`);
    }
  });

  return () => {
    unlisten.then(f => f());
  };
}, []);
```

**File:** `application/src-tauri/tauri.conf.json`

Enable file drop:

```json
{
  "tauri": {
    "windows": [{
      "fileDropEnabled": true
    }]
  }
}
```

## Testing Checklist

- [ ] .mrpack file validation
- [ ] Manifest parsing
- [ ] Compatibility checking
- [ ] Forge-only enforcement
- [ ] Optional mods detection
- [ ] Override files extraction
- [ ] Mod downloading with hash verification
- [ ] Instance creation
- [ ] UI flow (file selection → validation → import)
- [ ] Drag and drop
- [ ] Error handling
- [ ] Progress indication

## Migration Strategy

1. Implement Rust backend (mrpack_handler.rs)
2. Add Tauri commands
3. Create React UI components
4. Test with sample .mrpack files
5. Add drag-and-drop support
6. Polish UI/UX
7. Document user-facing features

## Related Files to Modify

- `application/src-tauri/src/main.rs` - Register commands
- `application/src-tauri/src/core/mod.rs` - Add mrpack_handler module
- `application/src-tauri/Cargo.toml` - Add zip dependency if needed
- `application/src/views/MyInstancesSection.tsx` - Add import button
- `application/src/components/CreateInstanceDialog.tsx` - Reference for UI patterns

## Notes

- The backend API already supports .mrpack import for creators
- This client-side implementation is for end-users installing modpacks
- Consider caching downloaded mods to avoid re-downloading
- Optional mods selection could be a future enhancement
- File association (.mrpack double-click) requires OS-specific setup

## References

- Backend implementation: `backend/src/services/modrinthImportService.ts`
- CurseForge analog: Instance creation from modpack
- Modrinth format: `backend/src/types/modrinth.ts`
