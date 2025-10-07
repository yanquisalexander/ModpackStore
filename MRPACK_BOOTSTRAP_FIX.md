# Fix: Bootstrap y Estructura de Directorios para .mrpack

## 🐛 Problema

Al importar archivos `.mrpack`, se presentaban dos problemas:

1. **No se ejecutaba el proceso de bootstrap** - La validación de Java, descarga de librerías y creación de estructura interna no se realizaban
2. **Estructura de directorios incorrecta** - Los archivos se colocaban en la raíz de la instancia en lugar de `minecraft/`

## ✅ Solución Implementada

### Cambio 1: Estructura de Directorios Correcta

#### Antes (❌ Incorrecto)
```
<instance_dir>/
├── instance.json
├── mods/              ← Directamente en la raíz
│   ├── mod1.jar
│   └── mod2.jar
├── config/            ← Directamente en la raíz
│   └── settings.toml
└── resources/         ← Directamente en la raíz
```

#### Después (✅ Correcto)
```
<instance_dir>/
├── instance.json
└── minecraft/                    ← Subdirectorio estándar
    ├── mods/                     ← Dentro de minecraft/
    │   ├── mod1.jar
    │   └── mod2.jar
    ├── config/                   ← Dentro de minecraft/
    │   └── settings.toml
    ├── resources/                ← Dentro de minecraft/
    ├── versions/                 ← Creado por bootstrap
    │   └── 1.20.1/
    │       ├── 1.20.1.jar
    │       └── 1.20.1.json
    └── libraries/                ← Creado por bootstrap
        └── ...
```

### Cambio 2: Ejecución de Bootstrap

#### Proceso Completo Ahora Incluye:

```
1. Usuario importa .mrpack
         ↓
2. Crear directorio de instancia
         ↓
3. Crear task de progreso (10%)
         ↓
4. Extraer overrides → minecraft/ (20%)
         ↓
5. Descargar mods → minecraft/mods/ (30%)
         ↓
6. Guardar configuración de instancia (40%)
         ↓
7. ⭐ NUEVO: Ejecutar Bootstrap en background
         ├→ Validar/Descargar Java
         ├→ Descargar librerías del cliente
         ├→ Crear estructura de directorios
         ├→ Extraer natives
         └→ Crear launcher profiles (100%)
         ↓
8. ✅ Instancia lista para jugar
```

## 📝 Cambios Técnicos

### `mrpack_handler.rs`

```rust
// ANTES
pub fn extract_mrpack_overrides(mrpack_path: &Path, instance_dir: &Path) {
    let output_path = instance_dir.join(relative_path);  // ❌ Directo a raíz
    // ...
}

// DESPUÉS
pub fn extract_mrpack_overrides(mrpack_path: &Path, instance_dir: &Path) {
    let minecraft_dir = instance_dir.join("minecraft");  // ✅ A minecraft/
    let output_path = minecraft_dir.join(relative_path);
    // ...
}
```

```rust
// ANTES
pub async fn download_mrpack_mods(manifest: &MrpackManifest, instance_dir: &Path) {
    let mods_dir = instance_dir.join("mods");  // ❌ Directo a raíz
    // ...
}

// DESPUÉS
pub async fn download_mrpack_mods(manifest: &MrpackManifest, instance_dir: &Path) {
    let mods_dir = instance_dir.join("minecraft").join("mods");  // ✅ A minecraft/mods/
    // ...
}
```

### `instance_manager.rs`

```rust
// NUEVO: Función para ejecutar bootstrap en background
fn spawn_mrpack_bootstrap_task(instance: MinecraftInstance, task_id: String) {
    std::thread::spawn(move || {
        let mut bootstrap = InstanceBootstrap::new();
        
        // Ejecutar bootstrap según el loader (Forge o Vanilla)
        let bootstrap_result = if instance.forgeVersion.is_some() {
            bootstrap.bootstrap_forge_instance(&instance, Some(task_id.clone()))
        } else {
            bootstrap.bootstrap_vanilla_instance(&instance, Some(task_id.clone()))
        };
        
        // Manejar resultado y actualizar Java path si es necesario
        // ...
    });
}
```

```rust
// ANTES
pub async fn create_instance_from_mrpack(...) {
    // Extraer archivos
    extract_mrpack_overrides(path, &instance_dir)?;
    download_mrpack_mods(&manifest, &instance_dir).await?;
    
    // Crear instancia
    let instance = MinecraftInstance { 
        minecraftPath: String::new(),  // ❌ Vacío
        // ...
    };
    instance.save()?;
    
    Ok(instance_id)  // ❌ Sin bootstrap
}

// DESPUÉS
pub async fn create_instance_from_mrpack(...) {
    // Crear task de progreso
    let task_id = add_task_with_auto_start(...);
    
    // Extraer archivos con progreso
    extract_mrpack_overrides(path, &instance_dir)?;
    download_mrpack_mods(&manifest, &instance_dir).await?;
    
    // Crear instancia con minecraftPath correcto
    let minecraft_path = instance_dir.join("minecraft");
    let instance = MinecraftInstance { 
        minecraftPath: normalize_path(&minecraft_path),  // ✅ Correcto
        // ...
    };
    instance.save()?;
    
    // ✅ Ejecutar bootstrap
    spawn_mrpack_bootstrap_task(instance, task_id.clone());
    
    Ok(instance_id)
}
```

## 🎯 Criterios de Aceptación Cumplidos

- ✅ Al importar un `.mrpack`, se ejecuta la validación de Java automáticamente
- ✅ Se descargan las librerías del cliente correctamente
- ✅ La estructura de carpetas resultante coincide con la estándar (`minecraft/` dentro de la instancia)
- ✅ La instancia es jugable inmediatamente después de la importación
- ✅ Se utiliza el mismo sistema de tareas que otras operaciones para mostrar progreso

## 🔍 Verificación

Para verificar que el fix funciona correctamente:

1. Importar un archivo `.mrpack` de Modrinth
2. Verificar que se crea la estructura `<instance_dir>/minecraft/`
3. Verificar que los mods están en `<instance_dir>/minecraft/mods/`
4. Verificar que las librerías se descargan en `<instance_dir>/minecraft/libraries/`
5. Verificar que se muestra el progreso del bootstrap en la UI
6. Verificar que la instancia se puede lanzar correctamente

## 📚 Archivos Modificados

- `application/src-tauri/src/core/mrpack_handler.rs`
  - `extract_mrpack_overrides()` - Ahora extrae a `minecraft/`
  - `download_mrpack_mods()` - Ahora descarga a `minecraft/mods/`

- `application/src-tauri/src/core/instance_manager.rs`
  - `create_instance_from_mrpack()` - Ahora usa task tracking y ejecuta bootstrap
  - `spawn_mrpack_bootstrap_task()` - Nueva función para bootstrap en background
