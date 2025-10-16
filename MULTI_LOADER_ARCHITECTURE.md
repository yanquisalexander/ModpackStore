# Multi-Loader Support Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (React + TypeScript)                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                    CreateInstanceDialog.tsx                          │  │
│  ├──────────────────────────────────────────────────────────────────────┤  │
│  │  User selects:                                                        │  │
│  │  • Vanilla  (Creeper icon, blue)                                     │  │
│  │  • Forge    (Anvil icon, orange)    ← Works now                     │  │
│  │  • Fabric   (Feather icon, green)   ← Coming soon                   │  │
│  │  • NeoForge (Hammer icon, purple)   ← Coming soon                   │  │
│  │  • Quilt    (Package icon, pink)    ← Coming soon                   │  │
│  │                                                                        │  │
│  │  Sends to Tauri: { loaderType, loaderVersion, mcVersion, ... }      │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                      │                                       │
│                                      ▼                                       │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                  Type Definitions (TypeScript)                        │  │
│  ├──────────────────────────────────────────────────────────────────────┤  │
│  │  type ModLoaderType = 'vanilla' | 'forge' | 'fabric' |               │  │
│  │                       'neoforge' | 'quilt'                            │  │
│  │                                                                        │  │
│  │  interface MinecraftInstance {                                        │  │
│  │    loaderType?: ModLoaderType                                        │  │
│  │    loaderVersion?: string                                            │  │
│  │    forgeVersion?: string  // Backward compat                         │  │
│  │  }                                                                    │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼ Tauri IPC
┌─────────────────────────────────────────────────────────────────────────────┐
│                           RUST APPLICATION CORE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │               create_local_instance(                                  │  │
│  │                 loaderType, loaderVersion, mcVersion                 │  │
│  │               )                                                        │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                      │                                       │
│                                      ▼                                       │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                    MinecraftInstance (Rust)                           │  │
│  ├──────────────────────────────────────────────────────────────────────┤  │
│  │  pub enum ModLoaderType {                                             │  │
│  │    Vanilla, Forge, Fabric, NeoForge, Quilt                           │  │
│  │  }                                                                     │  │
│  │                                                                        │  │
│  │  pub struct MinecraftInstance {                                       │  │
│  │    loaderType: ModLoaderType,                                        │  │
│  │    loaderVersion: Option<String>,                                    │  │
│  │    forgeVersion: Option<String>,  // Backward compat                 │  │
│  │  }                                                                     │  │
│  │                                                                        │  │
│  │  Helper methods:                                                      │  │
│  │  • is_forge_instance()                                               │  │
│  │  • is_fabric_instance()                                              │  │
│  │  • is_vanilla_instance()                                             │  │
│  │  • get_loader_name()                                                 │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                      │                                       │
│                                      ▼                                       │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │              Future: LoaderInstaller Trait                            │  │
│  ├──────────────────────────────────────────────────────────────────────┤  │
│  │  trait LoaderInstaller {                                              │  │
│  │    fn download(&self) -> Result<()>;                                 │  │
│  │    fn install(&self) -> Result<()>;                                  │  │
│  │    fn get_classpath(&self) -> Vec<String>;                           │  │
│  │    fn get_jvm_args(&self) -> Vec<String>;                            │  │
│  │  }                                                                     │  │
│  │                                                                        │  │
│  │  Implementations:                                                     │  │
│  │  • ForgeInstaller      ← To be refactored from existing              │  │
│  │  • FabricInstaller     ← To be implemented                           │  │
│  │  • NeoForgeInstaller   ← To be implemented                           │  │
│  │  • QuiltInstaller      ← To be implemented                           │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  Saves instance.json with loader information                                │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼ HTTP API
┌─────────────────────────────────────────────────────────────────────────────┐
│                        BACKEND (Node.js + TypeORM)                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │              POST /modpacks/:id/versions                              │  │
│  ├──────────────────────────────────────────────────────────────────────┤  │
│  │  Request Body:                                                        │  │
│  │  {                                                                     │  │
│  │    mcVersion: "1.20.1",                                              │  │
│  │    loaderType: "fabric",                                             │  │
│  │    loaderVersion: "0.15.0",                                          │  │
│  │    forgeVersion: null  // Optional, backward compat                  │  │
│  │  }                                                                     │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                      │                                       │
│                                      ▼                                       │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                    ModpackVersion Entity                              │  │
│  ├──────────────────────────────────────────────────────────────────────┤  │
│  │  @Column({ type: "enum", enum: ModLoaderType })                      │  │
│  │  loaderType?: ModLoaderType;                                         │  │
│  │                                                                        │  │
│  │  @Column({ type: "text", nullable: true })                           │  │
│  │  loaderVersion?: string;                                             │  │
│  │                                                                        │  │
│  │  @Column({ type: "text", nullable: true })                           │  │
│  │  forgeVersion?: string;  // Kept for backward compat                 │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                      │                                       │
│                                      ▼                                       │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                      PostgreSQL Database                              │  │
│  ├──────────────────────────────────────────────────────────────────────┤  │
│  │  modpack_versions table:                                              │  │
│  │  ┌──────────────┬──────────────┬──────────────┬──────────────┐       │  │
│  │  │ mc_version   │ loader_type  │ loader_ver   │ forge_version│       │  │
│  │  ├──────────────┼──────────────┼──────────────┼──────────────┤       │  │
│  │  │ "1.20.1"     │ "forge"      │ "47.2.0"     │ "47.2.0"     │       │  │
│  │  │ "1.20.1"     │ "fabric"     │ "0.15.0"     │ NULL         │       │  │
│  │  │ "1.19.4"     │ "vanilla"    │ NULL         │ NULL         │       │  │
│  │  │ "1.20.1"     │ "neoforge"   │ "20.1.0"     │ NULL         │       │  │
│  │  │ "1.20.1"     │ "quilt"      │ "0.21.0"     │ NULL         │       │  │
│  │  └──────────────┴──────────────┴──────────────┴──────────────┘       │  │
│  │                                                                        │  │
│  │  Migration: migrate-loader-types.ts                                  │  │
│  │  Populates loader_type/loader_version from forge_version             │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                            DATA FLOW EXAMPLE                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Creating a Fabric Instance:                                                │
│                                                                              │
│  1. User selects "Fabric" in CreateInstanceDialog                           │
│  2. User selects MC version "1.20.1"                                        │
│  3. User selects Fabric version "0.15.0" (when implemented)                 │
│  4. Frontend calls: invoke('create_local_instance', {                       │
│       loaderType: 'fabric',                                                 │
│       loaderVersion: '0.15.0',                                              │
│       mcVersion: '1.20.1'                                                   │
│     })                                                                       │
│  5. Rust creates MinecraftInstance with:                                    │
│       - loaderType = ModLoaderType::Fabric                                  │
│       - loaderVersion = Some("0.15.0")                                      │
│  6. FabricInstaller (future) downloads and installs Fabric                  │
│  7. Instance launches with Fabric loader                                    │
│                                                                              │
│  Backward Compatibility Example:                                            │
│                                                                              │
│  1. Old instance.json has only "forgeVersion": "47.2.0"                     │
│  2. Rust reads it and auto-converts to:                                     │
│       - loaderType = ModLoaderType::Forge                                   │
│       - loaderVersion = Some("47.2.0")                                      │
│       - forgeVersion = Some("47.2.0")  // Kept                              │
│  3. Instance works exactly as before                                        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Color Scheme in UI

- **Vanilla**: Blue (Creeper icon) 🟦
- **Forge**: Orange (Anvil icon) 🟧
- **Fabric**: Green (Feather icon) 🟩
- **NeoForge**: Purple (Hammer icon) 🟪
- **Quilt**: Pink (Package icon) 🌸

## Implementation Status Legend

- ✅ Fully implemented and working
- ⚠️ Partially implemented (UI ready, installer pending)
- ❌ Not yet implemented
- 🔄 Backward compatible

## Status by Component

| Component | Status | Notes |
|-----------|--------|-------|
| Backend Schema | ✅ | Fully implemented with migration |
| Backend API | ✅ | Accepts all loader types |
| Rust Types | ✅ | All enums and structs ready |
| Rust Instance Creation | ✅ | Creates instances with any loader |
| Rust Loader Installers | ⚠️ | Only Forge exists, others pending |
| Frontend UI | ✅ | Shows all 5 loader options |
| Frontend Types | ✅ | TypeScript types complete |
| Backward Compatibility | 🔄 | Fully maintained across all layers |
