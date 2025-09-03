# CurseForge Import Feature

Esta funcionalidad permite importar modpacks desde archivos ZIP exportados de CurseForge, procesándolos automáticamente para crear un modpack completo en el sistema.

## Funcionalidades Implementadas

### 1. Importación Automática Completa
- Extrae y valida `manifest.json` del ZIP de CurseForge
- Descarga automáticamente todos los mods listados en `files[]`
- **Procesa archivos de configuración desde la carpeta `overrides/` con detección inteligente de categorías**
- **Replica exactamente el comportamiento de subida manual para cada categoría**
- Crea automáticamente entidades `Modpack` y `ModpackVersion`

### 2. Optimizaciones de Rendimiento
- Descargas paralelas configurables (1-10 mods simultáneos, por defecto 5)
- Deduplicación de archivos usando SHA1 hashing
- Operaciones batch para subidas a R2 y base de datos
- Reutilización de archivos existentes

### 3. Gestión de Errores
- Validación de estructura de manifest
- Manejo de mods no disponibles o con errores de descarga
- Limpieza automática de archivos temporales
- Estadísticas detalladas del proceso de importación

## Endpoint API

```http
POST /v1/creators/publishers/:publisherId/modpacks/import/curseforge
Content-Type: multipart/form-data

{
  "zipFile": <File>,           // Archivo ZIP de CurseForge (requerido)
  "slug": "mi-modpack",        // Slug personalizado (opcional)
  "visibility": "public",      // Visibilidad del modpack (opcional)
  "parallelDownloads": 5       // Número de descargas paralelas (opcional, 1-10)
}
```

### Respuesta

```json
{
  "success": true,
  "message": "Modpack importado exitosamente desde CurseForge",
  "data": {
    "modpack": {
      "id": "uuid",
      "name": "Nombre del Modpack",
      "version": "1.0.0"
    },
    "stats": {
      "totalMods": 150,
      "downloadedMods": 147,
      "failedMods": 3,
      "overrideFiles": 45
    },
    "errors": []
  }
}
```

## Flujo de Procesamiento

1. **Extracción del ZIP**: Descomprime el archivo y localiza `manifest.json`
2. **Validación**: Verifica estructura del manifest y compatibilidad
3. **Creación de Entidades**: Genera `Modpack` y `ModpackVersion` con datos del manifest
4. **Descarga de Mods**: Usa la API de CurseForge para descargar archivos de mods
5. **Procesamiento de Overrides Mejorado**: 
   - Agrupa archivos por carpetas predefinidas (`config/`, `resourcepacks/`, `shaderpacks/`, `datapacks/`)
   - Procesa cada categoría independientemente como colecciones (similar a subida manual)
   - Clasifica archivos sueltos y carpetas no reconocidas como `extras`
6. **Almacenamiento**: Sube archivos a R2 y crea registros en base de datos
7. **Limpieza**: Elimina archivos temporales y devuelve estadísticas

### Mejoras en el Procesamiento de Overrides

El sistema ahora replica exactamente el comportamiento de la subida manual:

- **Detección de Carpetas**: Identifica automáticamente las carpetas `config/`, `resourcepacks/`, `shaderpacks/`, `datapacks/` en la raíz de `overrides/`
- **Procesamiento por Categorías**: Cada carpeta se procesa como una colección independiente
- **Consistencia de Rutas**: Los prefijos de rutas son idénticos entre importación y subida manual
- **Gestión de Extras**: Archivos y carpetas no reconocidas se agrupan en la categoría `extras`

## Tipos de Archivos Soportados

- **mods/**: Archivos JAR de mods descargados desde CurseForge
- **config/**: Archivos de configuración del modpack
- **resourcepacks/**: Paquetes de recursos incluidos
- **shaderpacks/**: Paquetes de shaders
- **datapacks/**: Paquetes de datos (datapacks) para Minecraft
- **extras/**: Otros archivos no clasificados

## Configuración Requerida

### Variables de Entorno
```bash
# API de CurseForge (opcional, mejora la funcionalidad)
CURSEFORGE_API_KEY=your_api_key_here

# Almacenamiento R2 (requerido)
R2_BUCKET_NAME=your_bucket
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_ENDPOINT=https://your_account_id.r2.cloudflarestorage.com
R2_CDN_URL=https://your_cdn_domain.com  # opcional
```

### Permisos
- El usuario debe tener permisos de creador en el publisher especificado
- Roles válidos: OWNER, ADMIN, MEMBER

## Limitaciones y Consideraciones

### Limitaciones Actuales
- Solo soporta modpacks de Minecraft
- Requiere manifest versión 1
- No soporta modpacks con loaders que no sean Forge
- Los mods que no están disponibles en CurseForge se omiten

### Optimizaciones Futuras Sugeridas
1. **Cache de Mods**: Implementar cache local para mods frecuentemente descargados
2. **Verificación de Integridad**: Validar checksums de archivos descargados
3. **Soporte para Fabric**: Extender soporte para otros mod loaders
4. **Importación Incremental**: Permitir actualizaciones de modpacks existentes
5. **Queue de Background**: Procesar importaciones grandes en background

## Ejemplo de Uso

```typescript
// Frontend JavaScript
const formData = new FormData();
formData.append('zipFile', curseforgeZipFile);
formData.append('slug', 'my-awesome-modpack');
formData.append('parallelDownloads', '8');

const response = await fetch('/v1/creators/publishers/my-publisher-id/modpacks/import/curseforge', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${authToken}`
  },
  body: formData
});

const result = await response.json();
console.log(`Imported ${result.data.stats.downloadedMods} mods successfully!`);
```

## Estructura del Manifest de CurseForge

El sistema espera un `manifest.json` con la siguiente estructura:

```json
{
  "minecraft": {
    "version": "1.19.2",
    "modLoaders": [
      {
        "id": "forge-43.2.0",
        "primary": true
      }
    ]
  },
  "manifestType": "minecraftModpack",
  "manifestVersion": 1,
  "name": "Mi Modpack Increíble",
  "version": "1.0.0",
  "author": "Mi Nombre",
  "files": [
    {
      "projectID": 238222,
      "fileID": 4509153,
      "required": true
    }
  ],
  "overrides": "overrides"
}
```