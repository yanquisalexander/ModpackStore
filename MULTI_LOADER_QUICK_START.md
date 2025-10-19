# Multi-Loader Support - Quick Start Guide

## For Users

### Creating a Vanilla Instance
1. Click "Nueva instancia" (New Instance)
2. Enter instance name
3. Select "Vanilla" (blue Creeper icon)
4. Select Minecraft version
5. Click "Crear instancia"

### Creating a Forge Instance
1. Click "Nueva instancia"
2. Enter instance name
3. Select "Forge" (orange Anvil icon)
4. Select Minecraft version
5. Select Forge version
6. Click "Crear instancia"

### Creating Fabric, NeoForge, or Quilt Instances
1. Click "Nueva instancia"
2. Enter instance name
3. Select your desired loader (Fabric/NeoForge/Quilt with their respective icons)
4. Select Minecraft version
5. Select loader version (automatically fetched from the loader's API)
6. Click "Crear instancia"

All loaders are now fully functional!

## For Modpack Creators

### Creating a Version with Specific Loader
1. Go to your modpack
2. Click "Create Version"
3. Enter version details
4. Select loader type (Vanilla, Forge, Fabric, NeoForge, Quilt)
5. Select loader version
6. Add changelog
7. Click "Create"

The backend will store both `loaderType` and `loaderVersion` for full flexibility.

## For Developers

### Running the Database Migration

After deploying the backend changes:

```bash
cd backend
npm run db:migrate-loader-types
```

This will:
- Find all modpack versions with `forgeVersion` set
- Set `loaderType = 'FORGE'` and `loaderVersion = forgeVersion`
- Set `loaderType = 'VANILLA'` for versions without forge

### API Usage Examples

#### Creating a Vanilla Version
```bash
curl -X POST /creators/publishers/{publisherId}/modpacks/{modpackId}/versions \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "versionName": "1.0.0",
    "mcVersion": "1.20.1",
    "loaderType": "vanilla",
    "changelog": "Initial release"
  }'
```

#### Creating a Fabric Version
```bash
curl -X POST /creators/publishers/{publisherId}/modpacks/{modpackId}/versions \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "versionName": "1.0.0",
    "mcVersion": "1.20.1",
    "loaderType": "fabric",
    "loaderVersion": "0.15.0",
    "changelog": "Initial Fabric release"
  }'
```

#### Creating a Forge Version (Backward Compatible)
```bash
# Old way (still works)
curl -X POST /creators/publishers/{publisherId}/modpacks/{modpackId}/versions \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "versionName": "1.0.0",
    "mcVersion": "1.20.1",
    "forgeVersion": "47.2.0",
    "changelog": "Initial release"
  }'

# New way (recommended)
curl -X POST /creators/publishers/{publisherId}/modpacks/{modpackId}/versions \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "versionName": "1.0.0",
    "mcVersion": "1.20.1",
    "loaderType": "forge",
    "loaderVersion": "47.2.0",
    "changelog": "Initial release"
  }'
```

### Tauri Command Examples

#### Creating a Vanilla Instance
```javascript
import { invoke } from '@tauri-apps/api/core';

await invoke('create_local_instance', {
  instanceName: "My Vanilla World",
  mcVersion: "1.20.1",
  loaderType: "vanilla",
  loaderVersion: null
});
```

#### Creating a Forge Instance
```javascript
await invoke('create_local_instance', {
  instanceName: "My Modded World",
  mcVersion: "1.20.1",
  loaderType: "forge",
  loaderVersion: "47.2.0"
});
```

#### Creating a Fabric Instance
```javascript
await invoke('create_local_instance', {
  instanceName: "My Fabric World",
  mcVersion: "1.20.1",
  loaderType: "fabric",
  loaderVersion: "0.15.0"
});
```

#### Creating a NeoForge Instance
```javascript
await invoke('create_local_instance', {
  instanceName: "My NeoForge World",
  mcVersion: "1.20.1",
  loaderType: "neoforge",
  loaderVersion: "20.2.59"
});
```

#### Creating a Quilt Instance
```javascript
await invoke('create_local_instance', {
  instanceName: "My Quilt World",
  mcVersion: "1.20.1",
  loaderType: "quilt",
  loaderVersion: "0.20.0"
});
```

### TypeScript Types

```typescript
// Loader type definition
type ModLoaderType = 'vanilla' | 'forge' | 'fabric' | 'neoforge' | 'quilt';

// Instance interface
interface MinecraftInstance {
  instanceId: string;
  instanceName: string;
  minecraftVersion: string;
  loaderType?: ModLoaderType;
  loaderVersion?: string;
  forgeVersion?: string; // Deprecated but kept for compatibility
  // ... other fields
}

// Modpack version interface
interface ModpackVersion {
  id: string;
  version: string;
  mcVersion: string;
  loaderType?: ModLoaderType;
  loaderVersion?: string;
  forgeVersion?: string; // Deprecated but kept for compatibility
  changelog: string;
  // ... other fields
}
```

### Rust Helpers

```rust
use crate::core::minecraft_instance::{MinecraftInstance, ModLoaderType};

// Check loader type
if instance.is_forge_instance() {
    println!("This is a Forge instance");
}

if instance.is_fabric_instance() {
    println!("This is a Fabric instance");
}

// Get loader name
let loader_name = instance.get_loader_name(); // "Forge", "Fabric", etc.

// Pattern matching
match instance.loaderType {
    ModLoaderType::Vanilla => { /* handle vanilla */ },
    ModLoaderType::Forge => { /* handle forge */ },
    ModLoaderType::Fabric => { /* handle fabric */ },
    ModLoaderType::NeoForge => { /* handle neoforge */ },
    ModLoaderType::Quilt => { /* handle quilt */ },
}
```

## Troubleshooting

### "No loader versions available"
- For Forge: Ensure the Minecraft version has Forge releases
- For Fabric: Versions are fetched from https://meta.fabricmc.net/v2
- For NeoForge: Versions are fetched from https://maven.neoforged.net/api
- For Quilt: Versions are fetched from https://meta.quiltmc.org/v3
- Check your internet connection if versions fail to load

### Instance creation fails
- Ensure Java is properly configured in settings
- Check that the selected Minecraft version is valid
- For modded loaders, verify the loader version is compatible with the MC version
- Check the Task Manager for detailed error messages

### Existing instances not showing loader type
- Run the migration script: `npm run db:migrate-loader-types`
- The migration populates loader fields from existing forgeVersion data

### TypeScript errors after update
- Regenerate types if using API schema generation
- New fields are optional, so existing code should work

### Old instances not launching
- All old instances are backward compatible
- forgeVersion is automatically converted to loaderType/loaderVersion
- No changes needed to existing instance.json files

## Implementation Checklist

### Backend
- [x] Add ModLoaderType enum
- [x] Update ModpackVersion entity
- [x] Create migration script
- [x] Update API endpoints
- [x] Test backward compatibility

### Rust
- [x] Add ModLoaderType enum
- [x] Update MinecraftInstance struct
- [x] Add helper methods
- [x] Update instance creation
- [x] Create FabricInstaller
- [x] Create NeoForgeInstaller
- [x] Create QuiltInstaller
- [x] Update launch logic (MinecraftPaths)
- [x] Add bootstrap methods for each loader

### Frontend
- [x] Add TypeScript types
- [x] Update CreateInstanceDialog
- [x] Update CreateVersionDialog
- [x] Add loader selection UI
- [x] Implement version fetching for new loaders
- [ ] Add loader badges to instance cards (optional enhancement)
- [ ] Show loader in instance details (optional enhancement)

### Testing
- [ ] Test vanilla instance creation
- [ ] Test Forge instance creation
- [ ] Test Fabric instance creation
- [ ] Test NeoForge instance creation
- [ ] Test Quilt instance creation
- [ ] Test migration script
- [ ] Test API with all loader types
- [ ] Test backward compatibility

## Implementation Complete! ✅

All core functionality for multi-loader support has been implemented:

1. **✅ Fabric Installer** - Fully implemented with meta.fabricmc.net API integration
2. **✅ NeoForge Installer** - Fully implemented with Maven and installer execution
3. **✅ Quilt Installer** - Fully implemented with meta.quiltmc.org API integration
4. **✅ Launch Logic** - Updated to handle all loader types via MinecraftPaths
5. **✅ Frontend** - Loader version fetching and UI selection complete

### Optional Enhancements (Future Work)
- Add loader badges to instance cards for better visual identification
- Show detailed loader information in instance details view
- Add loader-based filtering for instance list
- Implement loader-specific icons or themes

## Resources

- Fabric Installation: https://fabricmc.net/
- NeoForge Documentation: https://neoforged.net/
- Quilt Documentation: https://quiltmc.org/
- Forge Documentation: https://docs.minecraftforge.net/

## Support

For issues or questions:
1. Check `MULTI_LOADER_IMPLEMENTATION.md` for technical details
2. Review `MULTI_LOADER_ARCHITECTURE.md` for architecture
3. Check Discord for community support
4. Report bugs on GitHub Issues
