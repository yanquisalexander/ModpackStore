# Implementación de Flags de ModpackStore+: Gestión y Descarga de Mods

## 📋 Resumen

Se han implementado dos nuevas flags para ModpackStore+ que permiten a los usuarios con suscripción activa gestionar y descargar mods directamente desde la aplicación en instancias de tipo local.

## 🎯 Nuevas Flags Implementadas

### 1. `allow_mod_manager` - Gestor de Mods Integrado
- **Tipo**: `boolean`
- **Valor por defecto**: `false`
- **Descripción**: Permite gestionar mods directamente desde Modpack Store en instancias locales sin necesidad de abrir la carpeta de mods
- **Funcionalidades**:
  - ✅ Listar todos los mods instalados
  - ✅ Ver tamaño de cada mod
  - ✅ Habilitar/deshabilitar mods (renombrado a `.disabled`)
  - ✅ Eliminar mods
  - ✅ Abrir carpeta de mods desde la aplicación
  - ✅ Actualización automática de la lista

### 2. `enable_instance_mod_downloader` - Descargador de Mods
- **Tipo**: `boolean`
- **Valor por defecto**: `false`
- **Descripción**: Permite descargar mods directamente desde Modrinth en instancias locales, verificando compatibilidad con modLoader y versión
- **Funcionalidades**:
  - ✅ Búsqueda de mods en Modrinth API
  - ✅ Filtrado automático por versión de Minecraft
  - ✅ Filtrado automático por mod loader (Forge, Fabric, NeoForge, Quilt)
  - ✅ Visualización de información del mod (descargas, autor, categorías)
  - ✅ Listado de versiones compatibles
  - ✅ Descarga directa a la carpeta de mods de la instancia
  - ✅ Validación de duplicados

## 🔧 Archivos Creados

### Backend

#### 1. `backend/src/config/benefitDefinitions.ts`
```typescript
{
    id: 'allow_mod_manager',
    name: 'Gestor de Mods Integrado',
    description: 'Permite gestionar mods directamente desde Modpack Store en instancias locales',
    type: 'boolean',
    defaultValue: false
},
{
    id: 'enable_instance_mod_downloader',
    name: 'Descargador de Mods',
    description: 'Permite descargar mods directamente desde Modrinth en instancias locales',
    type: 'boolean',
    defaultValue: false
}
```

### Frontend

#### 2. `application/src/components/instance/ModManagerDialog.tsx`
Componente React para gestión de mods:
- Interfaz intuitiva con diseño oscuro
- Lista de mods con información de tamaño
- Botones para habilitar/deshabilitar
- Botón para eliminar con confirmación
- Indicadores visuales de estado
- Botón para abrir carpeta de mods

#### 3. `application/src/components/instance/ModDownloaderDialog.tsx`
Componente React para descarga de mods:
- Sistema de búsqueda integrado con Modrinth
- Dos pestañas: Búsqueda y Detalles
- Filtrado automático por versión y loader
- Visualización de iconos de mods
- Lista de versiones compatibles
- Descarga directa con indicador de progreso
- Información detallada de cada versión

### Backend (Tauri/Rust)

#### 4. `application/src-tauri/src/core/mod_manager.rs`
Módulo Rust con comandos Tauri:

**Comandos implementados:**
- `list_instance_mods`: Lista todos los mods de una instancia
- `delete_instance_mod`: Elimina un mod específico
- `toggle_instance_mod`: Habilita/deshabilita un mod
- `open_instance_mods_folder`: Abre la carpeta de mods en el explorador
- `search_modrinth_mods`: Busca mods en Modrinth API
- `get_modrinth_mod_versions`: Obtiene versiones de un mod
- `download_mod_to_instance`: Descarga un mod directamente

**Estructuras de datos:**
```rust
pub struct ModFile {
    file_name: String,
    file_path: String,
    size: u64,
    is_enabled: bool,
}

pub struct ModrinthSearchResult {
    project_id: String,
    title: String,
    description: String,
    downloads: u64,
    // ... más campos
}

pub struct ModrinthVersion {
    id: String,
    version_number: String,
    game_versions: Vec<String>,
    loaders: Vec<String>,
    files: Vec<ModrinthFile>,
    // ... más campos
}
```

## 🔄 Archivos Modificados

### Backend
1. **`backend/src/utils/userFlags.ts`**
   - Agregadas las nuevas flags al tipo `UserFlags`

### Frontend
2. **`application/src/types/userFlags.ts`**
   - Agregadas las nuevas flags al tipo `UserFlags`
   - Agregadas a `AVAILABLE_BENEFITS`
   - Agregadas a `DEFAULT_USER_FLAGS`

3. **`application/src/components/InstanceCard.tsx`**
   - Importados nuevos componentes de diálogos
   - Agregado hook `useUserFlags` para verificar permisos
   - Agregados estados para controlar visibilidad de diálogos
   - Agregadas opciones al menú contextual (solo para instancias locales)
   - Validación de flags antes de abrir diálogos
   - Renderizado condicional de diálogos

### Tauri/Rust
4. **`application/src-tauri/src/core/mod.rs`**
   - Agregado módulo `mod_manager`

5. **`application/src-tauri/src/main.rs`**
   - Registrados todos los comandos de `mod_manager` en `invoke_handler`

## 🎨 Características de la UI

### Gestor de Mods
- **Diseño**: Card oscuro con bordes sutiles
- **Lista scrollable**: ScrollArea con altura fija (400px)
- **Información por mod**:
  - Nombre del archivo
  - Tamaño formateado (B, KB, MB)
  - Estado (Habilitado/Deshabilitado) con badge
- **Acciones por mod**:
  - Botón Habilitar/Deshabilitar
  - Botón Eliminar (con confirmación visual)
- **Acciones globales**:
  - Botón Actualizar lista
  - Botón Abrir carpeta de mods
- **Mensajes informativos**: Alert con icono explicando el sistema de .disabled

### Descargador de Mods
- **Diseño**: Card grande con tabs (Búsqueda/Detalles)
- **Barra de búsqueda**: Input con botón y Enter key support
- **Resultados de búsqueda**:
  - Cards clickeables con hover effects
  - Icono del mod (si disponible)
  - Título, descripción truncada
  - Descargas formateadas (K, M)
  - Categorías con badges
- **Detalles del mod**:
  - Header con información completa
  - Lista de versiones compatibles
  - Botones de descarga por versión
  - Información de tamaño de archivo
  - Indicadores de carga
- **Filtros automáticos**: Muestra badges con MC version y loader
- **Validaciones**: Verifica duplicados antes de descargar

## 🔐 Sistema de Permisos

### Verificación de Flags
```typescript
const { flags } = useUserFlags();

// En el handler de acciones
if (!flags.allow_mod_manager) {
    toast.error('Esta función requiere ModpackStore+');
    return;
}
```

### Visibilidad de Opciones
- Las opciones aparecen en el menú contextual **solo para instancias locales**
- Al intentar usar sin permisos, se muestra mensaje de error
- Los diálogos no se renderizan si no es una instancia local

## 🚀 Flujo de Uso

### Gestionar Mods
1. Usuario hace clic derecho en una instancia local
2. Selecciona "Gestionar Mods" del menú contextual
3. Sistema valida flag `allow_mod_manager`
4. Si tiene permiso, se abre el diálogo
5. Se cargan los mods desde Rust
6. Usuario puede:
   - Ver lista completa de mods
   - Habilitar/deshabilitar mods
   - Eliminar mods
   - Abrir carpeta de mods
   - Actualizar lista

### Descargar Mods
1. Usuario hace clic derecho en una instancia local con loader
2. Selecciona "Descargar Mods" del menú contextual
3. Sistema valida flag `enable_instance_mod_downloader`
4. Si tiene permiso, se abre el diálogo con información de la instancia
5. Usuario busca mods (filtrado automático por MC version y loader)
6. Selecciona un mod de los resultados
7. Ve versiones compatibles
8. Descarga la versión deseada
9. Mod se instala automáticamente en la carpeta de mods

## 📊 Integración con Modrinth API

### Endpoints utilizados:
- **Búsqueda**: `GET https://api.modrinth.com/v2/search`
  - Filtros: `project_type:mod`, versión de MC, loader type
  - Límite: 20 resultados
- **Versiones**: `GET https://api.modrinth.com/v2/project/{id}/version`
  - Filtros: game_versions, loaders
  - Retorna todas las versiones compatibles

### Headers requeridos:
```rust
.header("User-Agent", "ModpackStore/1.0")
```

## ✅ Validaciones Implementadas

### Gestión de Mods
- ✅ Verificación de existencia de instancia
- ✅ Creación automática de carpeta de mods si no existe
- ✅ Validación de archivo antes de eliminar
- ✅ Validación de estado al habilitar/deshabilitar
- ✅ Manejo de errores de sistema de archivos

### Descarga de Mods
- ✅ Verificación de loader type compatible
- ✅ Normalización de loader types (forge, fabric, neoforge, quilt)
- ✅ Validación de duplicados antes de descargar
- ✅ Verificación de respuesta exitosa de API
- ✅ Manejo de errores de red

## 🎯 Restricciones

### Solo Instancias Locales
- Las opciones solo aparecen para instancias con `modpackId === undefined/null`
- Instancias de modpacks no muestran estas opciones (para no interferir con el sistema de actualizaciones)

### Descargador de Mods
- Solo funciona con instancias que tengan loader type definido (no vanilla)
- Verifica compatibilidad automáticamente con:
  - Versión de Minecraft
  - Tipo de mod loader
  - Versión de mod loader (opcional)

## 🔍 Testing Recomendado

### Gestión de Mods
1. ✅ Crear instancia local con Forge/Fabric
2. ✅ Agregar mods manualmente a la carpeta
3. ✅ Verificar que aparecen en el gestor
4. ✅ Deshabilitar un mod y verificar renombrado a .disabled
5. ✅ Habilitar mod deshabilitado
6. ✅ Eliminar un mod y verificar que se elimina del filesystem
7. ✅ Abrir carpeta de mods y verificar que se abre el explorador

### Descarga de Mods
1. ✅ Buscar mods (ej: "JEI", "Optifine")
2. ✅ Verificar que solo aparecen mods compatibles
3. ✅ Seleccionar un mod y ver detalles
4. ✅ Verificar que solo muestra versiones compatibles
5. ✅ Descargar una versión
6. ✅ Verificar que aparece en el gestor de mods
7. ✅ Intentar descargar duplicado y verificar error

### Permisos
1. ✅ Usuario sin flag: verificar mensaje de error
2. ✅ Usuario con flag: verificar acceso completo
3. ✅ Instancia de modpack: verificar que no aparecen opciones
4. ✅ Instancia local sin loader: verificar que solo aparece gestor

## 📝 Notas Técnicas

### Manejo de Estado
- Estados independientes para cada diálogo
- Carga asíncrona de datos
- Indicadores de carga en todas las operaciones
- Manejo de errores con toast notifications

### Performance
- Solo se cargan mods cuando se abre el diálogo
- Búsqueda con debounce implícito (solo al presionar Enter o botón)
- Descarga de imágenes lazy con fallback
- Límite de 20 resultados en búsquedas

### Compatibilidad
- Soporte multiplataforma para abrir carpetas (Windows, macOS, Linux)
- Normalización de paths
- Encoding de URLs para búsquedas

## 🎉 Resultado Final

Se han implementado exitosamente dos flags premium de ModpackStore+ que:
1. ✅ Permiten gestión completa de mods desde la aplicación
2. ✅ Integran búsqueda y descarga directa desde Modrinth
3. ✅ Verifican compatibilidad automáticamente
4. ✅ Mantienen el diseño y UX consistentes con la aplicación
5. ✅ Funcionan solo en instancias locales (no interfieren con modpacks)
6. ✅ Están protegidas por el sistema de flags/beneficios

Los usuarios con suscripción ModpackStore+ ahora pueden gestionar y descargar mods sin salir de la aplicación, mejorando significativamente la experiencia de usuario. 🚀
