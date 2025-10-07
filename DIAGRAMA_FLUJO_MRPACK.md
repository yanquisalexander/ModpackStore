# Diagrama de Flujo: Importación .mrpack (Antes vs. Después)

## ❌ ANTES (Con Problemas)

```
┌─────────────────────────────────────────────────────────────────┐
│ Usuario selecciona archivo .mrpack                              │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ create_instance_from_mrpack()                                   │
│                                                                 │
│  1. Leer manifest                                               │
│  2. Crear directorio de instancia                               │
│  3. Extraer overrides → instance_dir/  ❌ (INCORRECTO)          │
│  4. Descargar mods → instance_dir/mods/ ❌ (INCORRECTO)         │
│  5. Crear MinecraftInstance con minecraftPath: "" ❌            │
│  6. Guardar instance.json                                       │
│  7. ❌ NO SE EJECUTA BOOTSTRAP                                  │
│  8. return instance_id                                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Resultado:                                                      │
│                                                                 │
│ instance_dir/                                                   │
│ ├── instance.json                                               │
│ ├── mods/           ❌ En raíz, no en minecraft/                │
│ ├── config/         ❌ En raíz, no en minecraft/                │
│ └── [NO HAY libraries/, versions/, etc.] ❌                     │
│                                                                 │
│ ⚠️ NO JUGABLE - Faltan librerías y estructura                   │
└─────────────────────────────────────────────────────────────────┘
```

## ✅ DESPUÉS (Corregido)

```
┌─────────────────────────────────────────────────────────────────┐
│ Usuario selecciona archivo .mrpack                              │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ create_instance_from_mrpack() - ASYNC                           │
│                                                                 │
│  1. Leer manifest                                               │
│  2. Crear directorio de instancia                               │
│  3. Crear Task de progreso (10%)                                │
│  4. Extraer overrides → minecraft/ ✅                            │
│  5. Descargar mods → minecraft/mods/ ✅                          │
│  6. Crear MinecraftInstance con minecraftPath correcto ✅       │
│  7. Guardar instance.json (30%)                                 │
│  8. spawn_mrpack_bootstrap_task() ✅                            │
│  9. return instance_id                                          │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  │ En paralelo, en background thread:
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│ spawn_mrpack_bootstrap_task()                                   │
│                                                                 │
│  1. Actualizar task (40%)                                       │
│  2. Ejecutar bootstrap según loader:                            │
│     ├─ Forge: bootstrap_forge_instance()                        │
│     └─ Vanilla: bootstrap_vanilla_instance()                    │
│                                                                 │
│  3. Bootstrap ejecuta (40-90%):                                 │
│     ├─ Validar versión de Java requerida                        │
│     ├─ Descargar Java si no existe                              │
│     ├─ Crear directorios (versions/, libraries/, etc.)          │
│     ├─ Descargar version manifest                               │
│     ├─ Descargar librerías del cliente                          │
│     ├─ Extraer natives                                          │
│     └─ Crear launcher profiles                                  │
│                                                                 │
│  4. Si Java fue descargado/detectado:                           │
│     └─ Actualizar instance.javaPath                             │
│                                                                 │
│  5. Actualizar task → Completed (100%)                          │
│  6. Cleanup task después de 60s                                 │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Resultado Final:                                                │
│                                                                 │
│ instance_dir/                                                   │
│ ├── instance.json                                               │
│ └── minecraft/                                                  │
│     ├── mods/                    ✅ En minecraft/               │
│     │   ├── mod1.jar                                            │
│     │   └── mod2.jar                                            │
│     ├── config/                  ✅ En minecraft/               │
│     │   └── settings.toml                                       │
│     ├── versions/                ✅ Creado por bootstrap        │
│     │   └── 1.20.1/                                             │
│     │       ├── 1.20.1.jar                                      │
│     │       └── 1.20.1.json                                     │
│     ├── libraries/               ✅ Creado por bootstrap        │
│     │   └── [todas las libs]                                    │
│     ├── assets/                  ✅ Creado por bootstrap        │
│     └── natives/                 ✅ Creado por bootstrap        │
│                                                                 │
│ ✅ TOTALMENTE JUGABLE - Estructura completa                      │
└─────────────────────────────────────────────────────────────────┘
```

## 🔄 Comparación de Progreso en UI

### Antes (Sin Bootstrap)
```
[■■■□□□□□□□] 30% - Descargando mods...
[■■■■■■■■■■] 100% - Instancia creada ❌
```
*Usuario intenta jugar → ERROR: Faltan librerías*

### Después (Con Bootstrap)
```
[■□□□□□□□□□] 10% - Extrayendo archivos...
[■■□□□□□□□□] 20% - Descargando mods...
[■■■□□□□□□□] 30% - Creando configuración...
[■■■■□□□□□□] 40% - Configurando Minecraft...
[■■■■■□□□□□] 50% - Validando Java...
[■■■■■■□□□□] 60% - Descargando librerías...
[■■■■■■■□□□] 70% - Extrayendo natives...
[■■■■■■■■□□] 80% - Configurando launcher...
[■■■■■■■■■□] 90% - Finalizando...
[■■■■■■■■■■] 100% - Instancia importada exitosamente ✅
```
*Usuario puede jugar inmediatamente*

## 📊 Diagrama de Secuencia

```
Usuario           Frontend          Backend           Bootstrap          Java Manager
   │                  │                 │                 │                    │
   │  Selecciona      │                 │                 │                    │
   │  .mrpack         │                 │                 │                    │
   ├─────────────────>│                 │                 │                    │
   │                  │  invoke()       │                 │                    │
   │                  ├────────────────>│                 │                    │
   │                  │                 │ Leer manifest   │                    │
   │                  │                 │ Crear instance  │                    │
   │                  │                 │ Extraer files   │                    │
   │                  │<────[Task 10%]──┤                 │                    │
   │<─────Progress────┤                 │                 │                    │
   │                  │                 │ Descargar mods  │                    │
   │                  │<────[Task 20%]──┤                 │                    │
   │<─────Progress────┤                 │                 │                    │
   │                  │                 │ Crear config    │                    │
   │                  │<────[Task 30%]──┤                 │                    │
   │<─────Progress────┤                 │                 │                    │
   │                  │                 │ spawn_bootstrap │                    │
   │                  │<──instance_id───┤────────────────>│                    │
   │                  │                 │                 │ Detect Java ver.   │
   │                  │                 │                 ├───────────────────>│
   │                  │                 │                 │<───Java path/null──┤
   │                  │                 │                 │                    │
   │                  │                 │                 │ If null:           │
   │                  │                 │                 │ Download Java      │
   │                  │<────[Task 50%]──┤<────────────────┤                    │
   │<─────Progress────┤                 │                 │                    │
   │                  │                 │                 │ Download libs      │
   │                  │<────[Task 70%]──┤<────────────────┤                    │
   │<─────Progress────┤                 │                 │                    │
   │                  │                 │                 │ Extract natives    │
   │                  │<────[Task 90%]──┤<────────────────┤                    │
   │<─────Progress────┤                 │                 │                    │
   │                  │                 │                 │ Complete           │
   │                  │<───[Task 100%]──┤<────────────────┤                    │
   │<────Success──────┤                 │                 │                    │
   │                  │                 │                 │                    │
```

## 🎯 Puntos Clave del Fix

### 1. Cambio de Rutas (2 líneas modificadas)
```rust
// mrpack_handler.rs
- instance_dir.join(relative_path)
+ instance_dir.join("minecraft").join(relative_path)

- instance_dir.join("mods")
+ instance_dir.join("minecraft").join("mods")
```

### 2. Agregar Bootstrap (1 llamada nueva)
```rust
// instance_manager.rs
spawn_mrpack_bootstrap_task(instance, task_id.clone());
```

### 3. Función de Bootstrap (98 líneas nuevas)
```rust
fn spawn_mrpack_bootstrap_task(instance: MinecraftInstance, task_id: String) {
    // Similar a spawn_instance_creation_task y spawn_modpack_creation_task
    // Ejecuta bootstrap_forge_instance o bootstrap_vanilla_instance
    // Actualiza progreso en task
}
```

### 4. Configurar minecraftPath (2 líneas)
```rust
let minecraft_path = instance_dir.join("minecraft");
minecraftPath: normalize_path(&minecraft_path),
```

## 📈 Resultado

| Aspecto                  | Antes     | Después   |
|--------------------------|-----------|-----------|
| Estructura correcta      | ❌        | ✅        |
| Bootstrap ejecutado      | ❌        | ✅        |
| Java validado/descargado | ❌        | ✅        |
| Librerías descargadas    | ❌        | ✅        |
| Progreso visible en UI   | Parcial   | Completo  |
| Instancia jugable        | ❌        | ✅        |
| Consistente con otros flujos | ❌   | ✅        |

