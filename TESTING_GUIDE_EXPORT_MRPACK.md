# 🚀 Quick Start: Testing Export to .mrpack Feature

Esta guía rápida te ayudará a probar la nueva funcionalidad de exportación de instancias locales a formato .mrpack.

## 📋 Prerequisites

Antes de comenzar, asegúrate de tener:

- ✅ Node.js (v18 o superior)
- ✅ Rust y Cargo instalados
- ✅ Tauri CLI instalado (`cargo install tauri-cli`)
- ✅ Sistema operativo: Windows, macOS, o Linux
- ✅ Dependencias del sistema para Tauri (GTK en Linux)

## 🔧 Instalación y Compilación

### 1. Clonar el Repositorio

```bash
git clone https://github.com/yanquisalexander/ModpackStore.git
cd ModpackStore
git checkout copilot/add-export-local-instances
```

### 2. Instalar Dependencias del Frontend

```bash
cd application
npm install
```

### 3. Compilar el Backend (Rust)

```bash
cd src-tauri
cargo build
```

Esto descargará e instalará las nuevas dependencias:
- `sha2 = "0.10"` (para hashes SHA512)
- `walkdir = "2"` (para recorrer directorios)

### 4. Ejecutar en Modo Desarrollo

```bash
# Desde la carpeta application/
npm run tauri dev
```

## 🧪 Cómo Probar la Funcionalidad

### Paso 1: Crear una Instancia Local

1. Abre ModpackStore
2. Haz clic en "Crear Nueva Instancia"
3. Selecciona "Instancia Local" (NO modpack)
4. Configura:
   - Nombre: "Test Exportar MRPACK"
   - Versión de Minecraft: 1.20.1
   - Loader: Forge o Vanilla

### Paso 2: Agregar Contenido a la Instancia

Para una prueba más realista:

1. Navega a la carpeta de la instancia
2. Agrega algunos mods en `minecraft/mods/`
3. Crea archivos de configuración en `minecraft/config/`
4. Opcional: Agrega resourcepacks, shaderpacks, etc.

### Paso 3: Exportar la Instancia

1. Ve a la vista de "Mis Instancias"
2. **Haz clic derecho** en tu instancia local
3. Deberías ver la opción **"📤 Exportar como .mrpack"**
4. Haz clic en la opción
5. Se abrirá un diálogo de guardado
6. Elige ubicación y nombre para el archivo
7. Haz clic en "Guardar"

### Paso 4: Observar el Progreso

1. Abre el **Task Manager** en ModpackStore
2. Verás una nueva tarea: "Exportando instancia a .mrpack"
3. El progreso avanzará de 0% a 100%:
   - 10%: Recopilando información
   - 20%: Recorriendo archivos
   - 30-70%: Calculando hashes
   - 75%: Creando manifest
   - 80-95%: Empaquetando archivos
   - 100%: Finalizado

### Paso 5: Verificar el Archivo

1. Navega a la ubicación donde guardaste el .mrpack
2. Verifica que el archivo existe
3. Opcional: Cambia la extensión a .zip y ábrelo para ver su contenido
4. Deberías ver:
   - `modrinth.index.json` en la raíz
   - Carpeta `overrides/` con todo el contenido de tu instancia

## ✅ Checklist de Validación

Usa esta checklist para verificar que todo funciona correctamente:

### UI y Comportamiento
- [ ] El menú contextual se abre con clic derecho
- [ ] La opción "Exportar como .mrpack" aparece solo en instancias locales
- [ ] La opción NO aparece en instancias de modpacks
- [ ] El diálogo de guardado se abre correctamente
- [ ] El filtro de archivos muestra "Modrinth Modpack (*.mrpack)"
- [ ] El nombre por defecto es el nombre de la instancia + .mrpack

### Procesamiento
- [ ] El Task Manager muestra la tarea de exportación
- [ ] El progreso avanza correctamente (0% → 100%)
- [ ] Los mensajes de progreso son descriptivos y en español
- [ ] La tarea se completa sin errores
- [ ] Aparece notificación de éxito al finalizar

### Archivo Generado
- [ ] El archivo .mrpack se crea en la ubicación elegida
- [ ] El tamaño del archivo es razonable
- [ ] El archivo es un ZIP válido
- [ ] Contiene `modrinth.index.json` en la raíz
- [ ] Contiene carpeta `overrides/`
- [ ] Los archivos en `overrides/` coinciden con la instancia original

### Contenido del Manifest
Abre el `modrinth.index.json` y verifica:
- [ ] `formatVersion` es `1`
- [ ] `game` es `"minecraft"`
- [ ] `versionId` tiene el formato `local-export-{timestamp}`
- [ ] `name` es el nombre de tu instancia
- [ ] `dependencies.minecraft` tiene la versión correcta
- [ ] `dependencies.forge` está presente si la instancia usa Forge
- [ ] El array `files` contiene entradas para todos los archivos
- [ ] Cada archivo tiene `sha1` y `sha512` hashes
- [ ] Todos los paths comienzan con `overrides/`

### Compatibilidad
- [ ] El .mrpack puede ser importado en Modrinth Launcher
- [ ] El .mrpack puede ser importado en PrismLauncher
- [ ] Al importar, los archivos se restauran correctamente
- [ ] La configuración se preserva

## 🐛 Troubleshooting

### Error: "Failed to create output file"
**Causa**: Permisos insuficientes o ruta inválida  
**Solución**: Elige una ubicación donde tengas permisos de escritura

### Error: "Minecraft directory not found"
**Causa**: La estructura de la instancia no es válida  
**Solución**: Verifica que existe la carpeta `minecraft/` en la instancia

### Error: "Cannot export modpack instances"
**Causa**: Intentaste exportar una instancia que es un modpack  
**Solución**: Solo puedes exportar instancias locales

### El progreso se queda atascado
**Causa**: Instancia muy grande con muchos archivos  
**Solución**: Espera. El cálculo de hashes puede tardar en instancias grandes

### El archivo .mrpack está corrupto
**Causa**: Error durante la creación del ZIP  
**Solución**: Intenta exportar de nuevo. Si persiste, verifica los logs de la aplicación

## 📊 Pruebas de Rendimiento

### Instancia Pequeña (~50 archivos)
- Tiempo esperado: 5-10 segundos
- Tamaño del .mrpack: 10-50 MB

### Instancia Media (~200 archivos)
- Tiempo esperado: 20-30 segundos
- Tamaño del .mrpack: 50-200 MB

### Instancia Grande (~500+ archivos)
- Tiempo esperado: 1-3 minutos
- Tamaño del .mrpack: 200+ MB

## 🔍 Verificación del Manifest

Puedes verificar el manifest usando este comando (requiere `jq`):

```bash
# Extraer y formatear el manifest
unzip -p "Mi Instancia.mrpack" modrinth.index.json | jq .
```

O manualmente:
```bash
# En Windows (con 7-Zip)
7z e "Mi Instancia.mrpack" modrinth.index.json -so

# En Linux/Mac
unzip -p "Mi Instancia.mrpack" modrinth.index.json
```

## 📁 Estructura Esperada del .mrpack

```
Mi Instancia.mrpack
├── modrinth.index.json
└── overrides/
    ├── mods/
    │   ├── jei-1.20.1-forge.jar
    │   └── other-mod.jar
    ├── config/
    │   └── some-config.toml
    ├── saves/
    ├── resourcepacks/
    └── shaderpacks/
```

## 🎯 Casos de Prueba Recomendados

### Caso 1: Instancia Mínima
- Vanilla 1.20.1
- Sin mods
- Solo archivos de configuración básicos

### Caso 2: Instancia con Mods
- Forge 1.20.1
- 5-10 mods pequeños
- Archivos de configuración

### Caso 3: Instancia Completa
- Forge 1.20.1
- 20+ mods
- Configuraciones personalizadas
- Resourcepacks
- Mundos guardados (opcional)

### Caso 4: Casos Extremos
- Instancia con 100+ mods
- Archivos muy grandes (>500MB)
- Nombres de archivo con caracteres especiales
- Rutas profundas (muchas subcarpetas)

## 📝 Logs y Debugging

Los logs de la aplicación se encuentran en:

**Windows**: `%APPDATA%\dev.alexitoo.modpackstore\logs\`  
**macOS**: `~/Library/Application Support/dev.alexitoo.modpackstore/logs/`  
**Linux**: `~/.config/dev.alexitoo.modpackstore/logs/`

Busca líneas que contengan:
- `Starting export of instance`
- `Found X files to include`
- `Successfully exported instance to`

## 🎓 Recursos Adicionales

- **Especificación .mrpack**: https://docs.modrinth.com/docs/modpacks/format/
- **Documentación Completa**: Ver `EXPORT_MRPACK_FEATURE.md`
- **Implementación Técnica**: Ver `IMPLEMENTATION_SUMMARY_EXPORT_MRPACK.md`
- **Diagramas de Flujo**: Ver `DIAGRAMA_FLUJO_EXPORT_MRPACK.md`
- **Mockups UI**: Ver `UI_MOCKUP_EXPORT_MRPACK.md`

## 🤝 Reportar Problemas

Si encuentras algún problema:

1. Verifica los logs de la aplicación
2. Toma screenshots del error
3. Incluye el `modrinth.index.json` si es posible
4. Reporta en el issue original o crea uno nuevo

## ✨ Features Implementadas

- [x] Exportación de instancias locales
- [x] Cálculo de hashes SHA1 y SHA512
- [x] Generación de manifest completo
- [x] Integración con Task Manager
- [x] Diálogo de guardado nativo
- [x] Notificaciones de éxito/error
- [x] Soporte para Forge y Vanilla
- [x] Mensajes en español

## 🚀 Próximos Pasos

Después de validar que todo funciona:

1. Crea un Pull Request en GitHub
2. Solicita revisión del código
3. Ejecuta pruebas de integración
4. Actualiza CHANGELOG.md
5. Mergea a la rama principal

---

**¡Buena suerte con las pruebas!** 🎉

Si todo funciona correctamente, ¡habrás validado exitosamente la nueva funcionalidad de exportación a .mrpack!
