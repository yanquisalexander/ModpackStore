# Diagrama de Flujo: Exportar Instancias Locales a .mrpack

```
┌─────────────────────────────────────────────────────────────────────┐
│                     USUARIO INTERACTÚA CON LA UI                    │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
                ┌────────────────────────┐
                │ Usuario hace clic      │
                │ derecho en instancia   │
                │ local                  │
                └────────────┬───────────┘
                             │
                             ▼
                ┌────────────────────────────────────┐
                │ ¿Es instancia local?               │
                │ (modpackId === null/undefined)     │
                └──────┬─────────────────┬───────────┘
                       │                 │
                   SI  │                 │ NO
                       │                 │
                       ▼                 ▼
        ┌──────────────────────┐  ┌─────────────────┐
        │ Muestra opción       │  │ Opción no se    │
        │ "Exportar como       │  │ muestra         │
        │ .mrpack"             │  └─────────────────┘
        └──────────┬───────────┘
                   │
                   │ Usuario selecciona
                   ▼
        ┌──────────────────────┐
        │ Abre diálogo de      │
        │ guardado de archivo  │
        │ (@tauri-apps/        │
        │ plugin-dialog)       │
        └──────────┬───────────┘
                   │
                   ▼
        ┌──────────────────────┐
        │ Usuario elige:       │
        │ - Ubicación          │
        │ - Nombre archivo     │
        │   (.mrpack)          │
        └──────────┬───────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    PROCESAMIENTO BACKEND (RUST)                      │
└──────────────────────────────────────────────────────────────────────┘
                   │
                   ▼
        ┌──────────────────────────────┐
        │ 1. Crear tarea en            │
        │    Task Manager              │
        │    Progreso: 0%              │
        └──────────────┬───────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │ 2. Validar instancia         │
        │    - Existe?                 │
        │    - Es local?               │
        │    Progreso: 10%             │
        └──────────┬───────────────────┘
                   │
                   ▼
        ┌──────────────────────────────┐
        │ 3. Recorrer directorios      │
        │    walkdir::WalkDir::new()   │
        │    Progreso: 20%             │
        └──────────┬───────────────────┘
                   │
                   ▼
        ┌──────────────────────────────┐
        │ 4. Por cada archivo:         │
        │    - Calcular SHA1           │
        │    - Calcular SHA512         │
        │    - Obtener tamaño          │
        │    Progreso: 30% → 70%       │
        └──────────┬───────────────────┘
                   │
                   ▼
        ┌──────────────────────────────┐
        │ 5. Generar manifest          │
        │    modrinth.index.json       │
        │    {                         │
        │      formatVersion: 1,       │
        │      game: "minecraft",      │
        │      versionId: "...",       │
        │      name: "...",            │
        │      dependencies: {...},    │
        │      files: [...]            │
        │    }                         │
        │    Progreso: 75%             │
        └──────────┬───────────────────┘
                   │
                   ▼
        ┌──────────────────────────────┐
        │ 6. Crear archivo ZIP         │
        │    - Escribir manifest       │
        │    - Agregar archivos a      │
        │      overrides/              │
        │    Progreso: 80% → 95%       │
        └──────────┬───────────────────┘
                   │
                   ▼
        ┌──────────────────────────────┐
        │ 7. Finalizar y cerrar ZIP    │
        │    Progreso: 100%            │
        └──────────┬───────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│                        RESULTADO FINAL                               │
└──────────────────────────────────────────────────────────────────────┘
                   │
                   ▼
        ┌──────────────────────────────┐
        │ Archivo .mrpack creado       │
        │                              │
        │ Estructura:                  │
        │ ├─ modrinth.index.json       │
        │ └─ overrides/                │
        │    ├─ mods/                  │
        │    ├─ config/                │
        │    ├─ saves/                 │
        │    └─ ...                    │
        └──────────┬───────────────────┘
                   │
                   ▼
        ┌──────────────────────────────┐
        │ Notificación de éxito        │
        │ "Instancia exportada         │
        │  correctamente"              │
        └──────────────────────────────┘
```

## Componentes del Sistema

### Frontend (TypeScript/React)
```
InstanceCard.tsx
│
├─ handleExportToMrpack()
│  ├─ import('@tauri-apps/plugin-dialog')
│  ├─ save() → filePath
│  └─ invoke('export_instance_to_mrpack')
│
└─ Context Menu Item (condicional)
   └─ Visible solo si installationType === "local"
```

### Backend (Rust)
```
mrpack_handler.rs
│
├─ export_instance_to_mrpack()
│  ├─ Validación
│  ├─ WalkDir::new() → Lista de archivos
│  ├─ calculate_sha1() → por cada archivo
│  ├─ calculate_sha512() → por cada archivo
│  ├─ Generar MrpackManifest
│  └─ ZipWriter → .mrpack
│
├─ calculate_sha1()
│  └─ sha1::Sha1::new()
│
└─ calculate_sha512()
   └─ sha2::Sha512::new()
```

## Formato del Archivo .mrpack

```
┌─────────────────────────────────────────────┐
│         instance-name.mrpack (ZIP)          │
├─────────────────────────────────────────────┤
│                                             │
│  modrinth.index.json (raíz)                 │
│  ┌─────────────────────────────────────┐   │
│  │ {                                   │   │
│  │   "formatVersion": 1,               │   │
│  │   "game": "minecraft",              │   │
│  │   "versionId": "local-export-XXX",  │   │
│  │   "name": "Mi Instancia",           │   │
│  │   "summary": "Exportado...",        │   │
│  │   "dependencies": {                 │   │
│  │     "minecraft": "1.20.1",          │   │
│  │     "forge": "47.2.0"               │   │
│  │   },                                │   │
│  │   "files": [                        │   │
│  │     {                               │   │
│  │       "path": "overrides/...",      │   │
│  │       "hashes": {                   │   │
│  │         "sha1": "...",              │   │
│  │         "sha512": "..."             │   │
│  │       },                            │   │
│  │       "env": {...},                 │   │
│  │       "downloads": [],              │   │
│  │       "fileSize": 123456            │   │
│  │     }                               │   │
│  │   ]                                 │   │
│  │ }                                   │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  overrides/ (directorio)                    │
│  ├─ mods/                                   │
│  │  ├─ mod1.jar ──────────────┐            │
│  │  └─ mod2.jar               │            │
│  ├─ config/                   │            │
│  │  └─ some-config.toml       │ Todos      │
│  ├─ saves/                    │ listados   │
│  │  └─ world1/                │ en         │
│  ├─ resourcepacks/            │ files[]    │
│  │  └─ pack.zip               │            │
│  └─ ... ──────────────────────┘            │
│                                             │
└─────────────────────────────────────────────┘
```

## Estados del Task Manager

```
┌────────────┬──────────┬─────────────────────────────────┐
│ Estado     │ Progreso │ Mensaje                         │
├────────────┼──────────┼─────────────────────────────────┤
│ Pending    │    0%    │ En espera...                    │
├────────────┼──────────┼─────────────────────────────────┤
│ Running    │   10%    │ Recopilando información...      │
├────────────┼──────────┼─────────────────────────────────┤
│ Running    │   20%    │ Recorriendo archivos...         │
├────────────┼──────────┼─────────────────────────────────┤
│ Running    │  30-70%  │ Procesando archivo X/Y          │
├────────────┼──────────┼─────────────────────────────────┤
│ Running    │   75%    │ Creando manifest...             │
├────────────┼──────────┼─────────────────────────────────┤
│ Running    │  80-95%  │ Empaquetando archivo X/Y        │
├────────────┼──────────┼─────────────────────────────────┤
│ Running    │   95%    │ Finalizando archivo...          │
├────────────┼──────────┼─────────────────────────────────┤
│ Completed  │  100%    │ Instancia exportada             │
│            │          │ correctamente                   │
└────────────┴──────────┴─────────────────────────────────┘
```

## Compatibilidad del Formato

```
Archivo .mrpack generado
        │
        ├─→ Modrinth Launcher ✓
        ├─→ PrismLauncher ✓
        ├─→ ATLauncher ✓
        └─→ Otros launchers con soporte .mrpack ✓
```
