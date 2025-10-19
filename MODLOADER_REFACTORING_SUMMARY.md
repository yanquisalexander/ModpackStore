# Refactorización del Sistema de Bootstrap de Modloaders

## Resumen de Cambios

Este documento describe la refactorización realizada en el sistema de bootstrap de instancias de Minecraft para soportar múltiples modloaders de manera escalable y mantenible.

## Problema Original

El archivo `instance_bootstrap.rs` tenía **1277 líneas** con lógica fuertemente acoplada a Forge, dificultando:
- Mantenimiento del código
- Adición de nuevos modloaders
- Reutilización de componentes
- Testing y depuración

## Solución Implementada

### 1. Trait `ModLoaderInstaller`

Se creó un trait común que define la interfaz para todos los instaladores de modloaders:

```rust
pub trait ModLoaderInstaller: Send + Sync {
    fn name(&self) -> &str;
    fn loader_version(&self) -> &str;
    fn minecraft_version(&self) -> &str;
    fn download_libraries(&self, libraries_dir: &Path, instance: &MinecraftInstance) -> Result<(), BootstrapError>;
    fn run_post_install(&self, minecraft_dir: &Path, versions_dir: &Path, instance: &MinecraftInstance) -> Result<(), BootstrapError>;
    fn install(&self, minecraft_dir: &Path, versions_dir: &Path, libraries_dir: &Path, instance: &MinecraftInstance) -> Result<(), BootstrapError>;
    fn get_version_name(&self) -> String;
    fn requires_java_for_install(&self) -> bool;
}
```

### 2. Módulos de Instaladores

Se crearon/refactorizaron los siguientes módulos en `bootstrap/loaders/`:

#### `forge.rs` (NUEVO - 320 líneas)
- Extraído completamente de `instance_bootstrap.rs`
- Implementa `ModLoaderInstaller`
- Maneja descarga e instalación del instalador de Forge
- Prueba múltiples opciones de instalación (`--installClient`, `--installDir`, `--installServer`)

#### `fabric.rs` (ACTUALIZADO)
- Ya existía, pero ahora implementa `ModLoaderInstaller`
- Maneja instalación de Fabric Loader
- Genera JSON de versión con herencia de Minecraft base

#### `neoforge.rs` (ACTUALIZADO)
- Ya existía, pero ahora implementa `ModLoaderInstaller`
- Similar a Forge pero para NeoForge
- Usa el instalador de NeoForge

#### `quilt.rs` (ACTUALIZADO)
- Ya existía, pero ahora implementa `ModLoaderInstaller`
- Fork de Fabric, maneja su propia API
- Genera JSON de versión con librerías específicas

### 3. Refactorización de `instance_bootstrap.rs`

**Antes:** 1277 líneas
**Después:** 1047 líneas
**Reducción:** 230 líneas (~18%)

Cambios principales:
- Eliminado método `run_forge_installer` (180 líneas) → movido a `forge.rs`
- Simplificado `bootstrap_forge_instance` para usar `ForgeInstaller`
- Los métodos de bootstrap ahora delegan a los instaladores específicos

## Beneficios de la Refactorización

### 1. Separación de Responsabilidades
Cada modloader tiene su propio módulo con toda su lógica encapsulada.

### 2. Escalabilidad
Para agregar un nuevo modloader (ej: LiteLoader, Rift):
1. Crear `bootstrap/loaders/nuevoloader.rs`
2. Implementar el trait `ModLoaderInstaller`
3. Agregar método `bootstrap_nuevoloader_instance` en `instance_bootstrap.rs`

### 3. Reutilización de Código
El trait define comportamiento por defecto en el método `install()`, reduciendo duplicación.

### 4. Testing Mejorado
Cada instalador puede ser testeado independientemente.

### 5. Mantenibilidad
- Cambios en un modloader no afectan a otros
- Código más legible y organizado
- Menos riesgo de regresiones

## Estructura de Archivos

```
application/src-tauri/src/core/bootstrap/
├── loaders/
│   ├── mod.rs          (Trait + exports)
│   ├── forge.rs        (320 líneas - NUEVO)
│   ├── fabric.rs       (210 líneas - actualizado)
│   ├── neoforge.rs     (220 líneas - actualizado)
│   └── quilt.rs        (290 líneas - actualizado)
├── download.rs         (1280 líneas)
├── filesystem.rs       (1033 líneas)
├── manifest.rs         (163 líneas)
├── manifest_servers.rs (189 líneas)
├── tasks.rs            (262 líneas)
└── validate.rs         (455 líneas)
```

## Compatibilidad

✅ **Totalmente compatible con código existente**
- Todos los métodos públicos mantienen la misma firma
- No hay cambios en la API externa
- Los modloaders existentes funcionan igual que antes

## Próximos Pasos (Opcionales)

1. **Unificar métodos bootstrap:** Crear un método genérico `bootstrap_modloader_instance<T: ModLoaderInstaller>()` para reducir más duplicación

2. **Configuración por modloader:** Permitir configuraciones específicas por loader

3. **Validación de compatibilidad:** Agregar validación de versiones de Minecraft compatibles con cada loader

4. **Métricas de instalación:** Reportar tiempos de instalación y éxito/fallos por modloader

5. **Cache de instaladores:** Cachear instaladores descargados para reinstalaciones rápidas

## Métricas

- **Líneas reducidas en `instance_bootstrap.rs`:** 230 (18%)
- **Nuevos módulos creados:** 1 (`forge.rs`)
- **Módulos refactorizados:** 4 (fabric, neoforge, quilt, mod)
- **Total de líneas en módulos bootstrap:** ~4600
- **Acoplamiento a Forge:** ❌ Eliminado
- **Abstracción:** ✅ Implementada mediante trait

## Conclusión

La refactorización logra el objetivo principal de **abstraer el proceso de bootstrapping** para soportar múltiples modloaders de manera escalable. El código es ahora:

- ✅ Más mantenible
- ✅ Más modular
- ✅ Más testeable
- ✅ Más escalable
- ✅ Menos acoplado
- ✅ Mejor documentado

El sistema está listo para agregar nuevos modloaders sin modificar código crítico existente.
