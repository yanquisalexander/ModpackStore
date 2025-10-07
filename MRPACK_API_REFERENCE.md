# Quick Reference: .mrpack Local Import API

## Tauri Commands

### `validate_mrpack_file`

**Purpose:** Validate and read the manifest from a .mrpack file.

**Signature:**
```rust
#[tauri::command]
pub fn validate_mrpack_file(mrpack_path: String) -> Result<MrpackManifest, String>
```

**Frontend Usage:**
```typescript
const manifest = await invoke<MrpackManifest>("validate_mrpack_file", {
  mrpackPath: "/path/to/modpack.mrpack"
});
```

**Returns:** `MrpackManifest` object with modpack details
**Errors:** File not found, invalid .mrpack, missing manifest, parse errors

---

### `check_mrpack_compatibility`

**Purpose:** Check if a modpack is compatible with the client.

**Signature:**
```rust
#[tauri::command]
pub fn check_mrpack_compatibility(
    manifest: MrpackManifest,
) -> Result<MrpackCompatibility, String>
```

**Frontend Usage:**
```typescript
const compat = await invoke<MrpackCompatibility>("check_mrpack_compatibility", {
  manifest: manifestData
});

if (compat.is_compatible) {
  // Can import
} else {
  // Show errors: compat.errors
}
```

**Returns:** `MrpackCompatibility` with `is_compatible`, `warnings`, `errors`, `loader`, `minecraft_version`

---

### `create_instance_from_mrpack`

**Purpose:** Create a new instance from a .mrpack file.

**Signature:**
```rust
#[tauri::command]
pub async fn create_instance_from_mrpack(
    mrpack_path: String,
    instance_name: String,
) -> Result<String, String>
```

**Frontend Usage:**
```typescript
const instanceId = await invoke<string>("create_instance_from_mrpack", {
  mrpackPath: "/path/to/modpack.mrpack",
  instanceName: "My Cool Modpack"
});

console.log(`Created instance: ${instanceId}`);
```

**Returns:** Instance UUID on success
**Errors:** Compatibility errors, download failures, file system errors

---

## TypeScript Types

```typescript
// application/src/types/mrpack.ts

export interface MrpackManifest {
  formatVersion: number;
  game: string;
  versionId: string;
  name: string;
  summary?: string;
  files: MrpackFile[];
  dependencies: MrpackDependencies;
}

export interface MrpackFile {
  path: string;
  hashes: MrpackHashes;
  env?: MrpackEnv;
  downloads: string[];
  fileSize: number;
}

export interface MrpackHashes {
  sha1: string;
  sha512: string;
}

export interface MrpackEnv {
  client?: string;  // "required" | "optional" | "unsupported"
  server?: string;  // "required" | "optional" | "unsupported"
}

export interface MrpackDependencies {
  minecraft: string;
  forge?: string;
  'fabric-loader'?: string;
  'quilt-loader'?: string;
  neoforge?: string;
}

export interface MrpackCompatibility {
  is_compatible: boolean;
  warnings: string[];
  errors: string[];
  loader: string;  // "forge" | "fabric" | "quilt" | "neoforge" | "vanilla"
  minecraft_version: string;
}
```

---

## Rust Types

```rust
// application/src-tauri/src/core/mrpack_handler.rs

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
```

---

## Helper Functions (Internal)

### `read_mrpack_manifest`
```rust
pub fn read_mrpack_manifest(mrpack_path: &Path) -> Result<MrpackManifest, String>
```
Reads and parses the modrinth.index.json from a .mrpack file.

### `extract_mrpack_overrides`
```rust
pub fn extract_mrpack_overrides(mrpack_path: &Path, instance_dir: &Path) -> Result<(), String>
```
Extracts all files from the `overrides/` directory to the instance directory.

### `download_mrpack_mods`
```rust
pub async fn download_mrpack_mods(manifest: &MrpackManifest, instance_dir: &Path) -> Result<(), String>
```
Downloads all client-side mods from the manifest to `<instance_dir>/mods/`.

### `download_mod_file` (private)
```rust
async fn download_mod_file(mod_file: &MrpackFile, mods_dir: &Path) -> Result<(), String>
```
Downloads a single mod file, trying multiple URLs if needed.

### `download_file_from_url` (private)
```rust
async fn download_file_from_url(url: &str, output_path: &Path) -> Result<(), String>
```
Low-level HTTP file download helper.

---

## Complete Import Flow Example

```typescript
// React component example
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";

async function importModpack() {
  try {
    // Step 1: Let user select file
    const selected = await open({
      filters: [{ name: "Modrinth Modpack", extensions: ["mrpack"] }]
    });
    
    if (!selected) return;
    const path = Array.isArray(selected) ? selected[0] : selected;
    
    // Step 2: Validate and read manifest
    const manifest = await invoke<MrpackManifest>("validate_mrpack_file", {
      mrpackPath: path
    });
    
    // Step 3: Check compatibility
    const compat = await invoke<MrpackCompatibility>("check_mrpack_compatibility", {
      manifest: manifest
    });
    
    if (!compat.is_compatible) {
      toast.error("Modpack no compatible", {
        description: compat.errors.join("\n")
      });
      return;
    }
    
    // Show warnings if any
    if (compat.warnings.length > 0) {
      toast.warning("Advertencias", {
        description: compat.warnings.join("\n")
      });
    }
    
    // Step 4: Get instance name from user (or use manifest.name)
    const instanceName = manifest.name;
    
    // Step 5: Import the modpack
    const instanceId = await invoke<string>("create_instance_from_mrpack", {
      mrpackPath: path,
      instanceName: instanceName
    });
    
    toast.success("Modpack importado", {
      description: `Instancia ${instanceName} creada exitosamente`
    });
    
    // Refresh instances list
    // ... your code to refresh ...
    
  } catch (error) {
    toast.error("Error al importar modpack", {
      description: String(error)
    });
  }
}
```

---

## Error Messages Reference

### Validation Errors
- `"File does not exist"` - The specified file path doesn't exist
- `"File is not a .mrpack file"` - File doesn't have .mrpack extension
- `"Failed to open .mrpack file: {error}"` - Can't open file (permissions?)
- `"Invalid .mrpack file: {error}"` - Not a valid ZIP archive
- `"modrinth.index.json not found in .mrpack"` - Missing manifest
- `"Failed to read manifest: {error}"` - Can't read manifest file
- `"Invalid manifest format: {error}"` - JSON parse error

### Compatibility Errors
- `"Unsupported game type: {game}. Only Minecraft is supported."` - Not a Minecraft modpack
- `"Solo se admite Forge actualmente. Fabric, Quilt y NeoForge no están soportados todavía."` - Unsupported loader
- `"Solo se admite Forge y Vanilla actualmente"` - From create_instance_from_mrpack

### Import Errors
- `"Failed to create instance directory: {error}"` - Can't create instance folder
- `"Failed to create directory: {error}"` - Can't create subdirectories
- `"Failed to create file: {error}"` - Can't write file
- `"Failed to extract file: {error}"` - Can't extract from ZIP
- `"Failed to create mods directory: {error}"` - Can't create mods folder
- `"Invalid file name"` - Mod file has invalid path
- `"Failed to download file: {error}"` - Network error
- `"HTTP error: {status}"` - HTTP request failed
- `"Failed to read response: {error}"` - Can't read HTTP response
- `"Failed to write file: {error}"` - Can't write downloaded file
- `"All download URLs failed"` - All mod URLs failed
- `"Failed to download {path}: {error}"` - Specific mod failed
- `"Failed to save instance: {error}"` - Can't save instance.json

---

## Logging

Import operations log the following:

```
INFO: Extracting overrides from .mrpack...
INFO: Downloading mods from Modrinth...
INFO: Downloading {} mods...
INFO: Downloading mod {}/{} 
INFO: File {} already exists with correct hash, skipping
INFO: Downloaded {} successfully
WARN: Failed to download from {}: {}
INFO: Instance created successfully: {}
```

Enable in `src-tauri/src/main.rs`:
```rust
.plugin(
    tauri_plugin_log::Builder::new()
        .level(log::LevelFilter::Info)  // or Debug
        // ...
)
```

---

## Constants

```rust
// application/src-tauri/src/core/instance_manager.rs
const DEFAULT_VANILLA_ICON: &str = "/images/default_instances/default_vanilla.webp";
const DEFAULT_FORGE_ICON: &str = "/images/default_instances/default_forge.webp";
```

---

## File Paths

```
<instances_dir>/
  <uuid>/
    instance.json       # MinecraftInstance config
    mods/              # Downloaded mod JARs
    config/            # From overrides/config/
    resourcepacks/     # From overrides/resourcepacks/
    shaderpacks/       # From overrides/shaderpacks/
    ...                # Other overrides
```

---

## Dependencies

### Rust Crates
- `zip` - Reading .mrpack archives
- `serde` + `serde_json` - JSON parsing
- `tauri_plugin_http::reqwest` - HTTP downloads
- `sha1` - Hash verification
- `uuid` - Instance ID generation

### Frontend Packages
- `@tauri-apps/api` - Tauri invoke
- `@tauri-apps/plugin-dialog` - File picker
- `sonner` - Toast notifications

---

## Best Practices

1. **Always validate before importing**
   ```typescript
   const manifest = await invoke("validate_mrpack_file", { mrpackPath });
   const compat = await invoke("check_mrpack_compatibility", { manifest });
   if (!compat.is_compatible) return;
   ```

2. **Show progress feedback**
   ```typescript
   toast.promise(
     invoke("create_instance_from_mrpack", { ... }),
     {
       loading: "Importando modpack...",
       success: "Modpack importado",
       error: (e) => `Error: ${e}`
     }
   );
   ```

3. **Handle errors gracefully**
   ```typescript
   try {
     await invoke("create_instance_from_mrpack", { ... });
   } catch (error) {
     console.error(error);
     toast.error("Error al importar", { description: String(error) });
   }
   ```

4. **Refresh UI after import**
   ```typescript
   const instanceId = await invoke("create_instance_from_mrpack", { ... });
   await refreshInstances();  // Re-fetch instances list
   ```

5. **Validate user input**
   ```typescript
   if (!instanceName.trim()) {
     toast.error("El nombre no puede estar vacío");
     return;
   }
   ```

---

## Future Enhancements

Potential improvements for the future:

1. **Optional Mod Selection**
   - UI to select which optional mods to install
   - Save preferences for future imports

2. **Parallel Downloads**
   - Download multiple mods concurrently
   - Rate limiting to respect Modrinth's limits

3. **Progress Events**
   - Emit Tauri events for download progress
   - Show percentage/progress bar in UI

4. **Loader Support**
   - Add Fabric support
   - Add Quilt support
   - Add NeoForge support

5. **Update Detection**
   - Check if imported modpack has updates
   - One-click update to latest version

6. **Import History**
   - Track imported modpacks
   - Quick re-import/update

7. **Validation**
   - Verify all file hashes after download
   - Check for corrupt files

8. **Cleanup**
   - Remove partial imports on failure
   - Disk space checking before import

9. **Caching**
   - Shared mod cache across instances
   - Avoid duplicate downloads
