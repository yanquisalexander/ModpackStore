# Exportar Instancias Locales a .mrpack

## Descripción

Esta funcionalidad permite a los usuarios exportar sus instancias locales de Minecraft (aquellas que no están gestionadas como modpacks) al formato `.mrpack`, el estándar utilizado por Modrinth. Esto facilita la migración, el respaldo y la compartición de configuraciones personales.

## Características

- **Exportación de Instancias Locales**: Solo las instancias creadas localmente (sin `modpackId`) pueden ser exportadas.
- **Formato .mrpack Compatible**: Los archivos generados siguen la especificación oficial de Modrinth.
- **Seguimiento de Progreso**: El proceso de exportación se integra con el Task Manager para mostrar el progreso en tiempo real.
- **Todos los Archivos como Overrides**: Dado que los archivos de una instancia local no tienen un origen trazable (como un `project_id` de Modrinth), todos los archivos se incluyen en la carpeta `overrides/`.

## Uso

### Desde la Interfaz de Usuario

1. Haz clic derecho sobre una instancia local en la vista de instancias
2. Selecciona "Exportar como .mrpack" del menú contextual
3. Elige la ubicación y nombre del archivo en el diálogo de guardado
4. El proceso comenzará y podrás ver el progreso en el Task Manager

**Nota**: Esta opción solo aparece para instancias locales, no para instancias de modpacks.

## Estructura del Archivo .mrpack Generado

El archivo `.mrpack` es esencialmente un archivo ZIP con la siguiente estructura:

```
instance-name.mrpack
├── modrinth.index.json    # Manifest con metadatos
└── overrides/             # Todos los archivos de la instancia
    ├── mods/
    ├── config/
    ├── saves/
    ├── resourcepacks/
    └── ...
```

### Contenido del modrinth.index.json

```json
{
  "formatVersion": 1,
  "game": "minecraft",
  "versionId": "local-export-1234567890",
  "name": "Mi Instancia Local",
  "summary": "Exportado desde ModpackStore",
  "dependencies": {
    "minecraft": "1.20.1",
    "forge": "47.2.0"
  },
  "files": [
    {
      "path": "overrides/mods/example-mod.jar",
      "hashes": {
        "sha1": "abc123...",
        "sha512": "def456..."
      },
      "env": {
        "client": "required",
        "server": "required"
      },
      "downloads": [],
      "fileSize": 1234567
    }
  ]
}
```

## Implementación Técnica

### Backend (Rust)

**Archivo**: `application/src-tauri/src/core/mrpack_handler.rs`

La función `export_instance_to_mrpack` realiza las siguientes operaciones:

1. **Validación**: Verifica que la instancia existe y es local (no es un modpack)
2. **Recopilación de Archivos**: Recorre recursivamente el directorio `minecraft/` de la instancia
3. **Cálculo de Hashes**: Calcula SHA1 y SHA512 para cada archivo
4. **Generación del Manifest**: Crea el `modrinth.index.json` con todos los metadatos
5. **Creación del ZIP**: Empaqueta el manifest y todos los archivos en un archivo `.mrpack`

#### Dependencias Añadidas

```toml
sha2 = "0.10"
walkdir = "2"
```

### Frontend (TypeScript/React)

**Archivo**: `application/src/components/InstanceCard.tsx`

Se agregó:

- Importación del icono `LucideUpload`
- Función `handleExportToMrpack()` que:
  - Abre un diálogo para guardar el archivo
  - Invoca el comando Rust `export_instance_to_mrpack`
  - Muestra notificaciones de éxito o error
- Elemento de menú contextual condicional (solo para instancias locales)

## Progreso y Notificaciones

El proceso de exportación muestra el progreso a través del Task Manager con las siguientes etapas:

1. **10%**: Recopilando información de la instancia
2. **20%**: Recorriendo archivos
3. **30-70%**: Calculando hashes (progreso incremental por archivo)
4. **75%**: Creando archivo .mrpack
5. **80-95%**: Empaquetando archivos (progreso incremental)
6. **100%**: Finalizado

## Limitaciones Conocidas

- **Sin Identificación de Mods**: El sistema no intenta identificar el `projectId` o `versionId` de Modrinth/CurseForge para los archivos. Todos los archivos se incluyen como overrides.
- **Solo Instancias Locales**: Las instancias que ya son modpacks no pueden ser exportadas de esta manera.
- **Tamaño del Archivo**: El archivo resultante puede ser grande si la instancia contiene muchos archivos (mods, mundos guardados, etc.)

## Compatibilidad

Los archivos `.mrpack` generados son compatibles con:

- Modrinth Launcher
- PrismLauncher
- Otros launchers que soporten el formato .mrpack de Modrinth

## Comandos Tauri

### `export_instance_to_mrpack`

**Parámetros**:
- `instance_id` (String): ID de la instancia a exportar
- `output_path` (String): Ruta completa donde guardar el archivo .mrpack

**Retorno**: `Result<(), String>` - Éxito o mensaje de error

**Ejemplo**:
```typescript
await invoke('export_instance_to_mrpack', {
  instanceId: 'abc-123-def',
  outputPath: '/path/to/instance.mrpack'
});
```

## Testing

Para probar esta funcionalidad:

1. Crea una instancia local en ModpackStore
2. Agrega algunos mods y configuraciones
3. Haz clic derecho en la instancia
4. Selecciona "Exportar como .mrpack"
5. Guarda el archivo
6. Verifica que:
   - El archivo se crea correctamente
   - Puedes importarlo en otro launcher compatible con .mrpack
   - El Task Manager muestra el progreso correctamente

## Referencias

- [Especificación del formato .mrpack de Modrinth](https://docs.modrinth.com/docs/modpacks/format/)
- [ZIP Crate Documentation](https://docs.rs/zip/)
- [Tauri Plugin Dialog](https://v2.tauri.app/plugin/dialog/)
