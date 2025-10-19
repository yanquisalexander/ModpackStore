# Rediseño del Proceso de Creación de Modpacks - Documentación

## Resumen

Se ha implementado un rediseño completo del proceso de creación de versiones de modpacks en el Centro de Creadores, reemplazando el diálogo simple anterior con un **asistente (wizard) a pantalla completa** que proporciona una experiencia más inmersiva y guiada.

## Características Principales

### 1. Interfaz de Wizard a Pantalla Completa

El nuevo wizard ocupa toda la pantalla, minimizando distracciones y proporcionando un flujo de trabajo más enfocado.

**Componente**: `/application/src/components/creator/dialogs/ModpackVersionWizard.tsx`

#### Estructura del Wizard (4 Pasos)

1. **Paso 1 - Información Básica**
   - Campo para ingresar el nombre de la versión
   - Muestra información de la última versión publicada
   - Auto-focus en el campo de entrada
   - Validación de campo requerido

2. **Paso 2 - Configuración Técnica**
   - Selector de versión de Minecraft (releases únicamente)
   - Selector visual de tipo de modloader:
     - Vanilla (sin mods)
     - Forge
     - Fabric
     - NeoForge
     - Quilt
   - Selector de versión del modloader (carga dinámica según el tipo seleccionado)
   - Heredación automática de valores de la versión anterior

3. **Paso 3 - Confirmación**
   - Resumen de la configuración seleccionada
   - **Detección automática de cambios "breaking"**
   - Advertencia visual si hay incompatibilidades
   - Checkbox de confirmación obligatorio para cambios críticos
   - Lista de versiones anteriores afectadas

4. **Paso 4 - Procesamiento**
   - Animación Lottie mientras se crea la versión
   - Feedback visual del progreso
   - Mensaje descriptivo del proceso

### 2. Soporte Multi-Modloader

#### Modloaders Soportados

| Modloader | API Utilizada | Icono |
|-----------|---------------|-------|
| Vanilla | - | Package |
| Forge | https://mc-versions-api.net/api/forge | Anvil |
| Fabric | https://meta.fabricmc.net/v2/versions/loader/{mcVersion} | Feather |
| NeoForge | https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge | Hammer |
| Quilt | https://meta.quiltmc.org/v3/versions/loader/{mcVersion} | TestTubeDiagonal |

#### Cascada de Selectores

El sistema implementa una cascada lógica:
1. Usuario selecciona versión de Minecraft
2. Usuario selecciona tipo de modloader
3. Sistema carga versiones disponibles del modloader para esa versión de MC
4. Usuario selecciona versión específica del modloader

### 3. Detección de Cambios "Breaking"

#### Backend (`/backend/src/routes/v1/creators/modpacks.route.ts`)

```typescript
// Obtiene todas las versiones anteriores
const previousVersions = await ModpackVersion.find({
    where: { modpackId: modpack.id },
    order: { createdAt: "DESC" }
});

// Detecta cambios críticos
const breakingChanges: Array<{ version: string; mcVersion: string; loaderType: string }> = [];
const newLoaderType = loaderType || (forgeVersion ? 'forge' : 'vanilla');

for (const prevVersion of previousVersions) {
    const prevLoaderType = prevVersion.loaderType || (prevVersion.forgeVersion ? 'forge' : 'vanilla');
    
    // Verifica si hay un cambio crítico (diferente versión de MC o tipo de loader)
    if (prevVersion.mcVersion !== mcVersion || prevLoaderType !== newLoaderType) {
        breakingChanges.push({
            version: prevVersion.version,
            mcVersion: prevVersion.mcVersion,
            loaderType: prevLoaderType
        });
    }
}
```

#### Criterios de Breaking Change

Un cambio se considera "breaking" cuando:
- La versión de Minecraft es diferente a versiones anteriores
- El tipo de modloader es diferente (ej: Forge → Fabric)

#### Frontend

El wizard muestra una advertencia prominente cuando detecta cambios críticos:

```
⚠️ ¡Atención! Cambio Crítico Detectado

La nueva configuración del modloader o de la versión de Minecraft 
no es compatible con las siguientes versiones anteriores:

• v1.0 (Minecraft 1.20.1 - Forge)
• v1.1 (Minecraft 1.20.1 - Forge)
... y X más

Los usuarios que actualicen a esta nueva versión desde las mencionadas anteriormente 
deberán reinstalar la instancia por completo para evitar errores.

☑ Entiendo que esta versión no es compatible con versiones anteriores 
  y deseo continuar.
```

### 4. Animaciones y Transiciones

#### Motion/React

Se utilizan animaciones suaves entre pasos:
- Fade in/out
- Slide transitions
- Scale animations en el paso de procesamiento

#### Lottie

Animación personalizada en el paso de procesamiento:
- **Archivo**: `/application/public/animations/success.json`
- **Elementos**: Círculo expandiéndose con stroke azul
- **Duración**: ~1.5 segundos, loop continuo

### 5. Progress Indicator Visual

Barra de progreso en la parte superior del wizard que muestra:
- Paso actual (resaltado en azul)
- Pasos completados (checkmark verde)
- Pasos pendientes (gris)
- Conexiones visuales entre pasos

## Utilidades Compartidas

### `/application/src/utils/modloaderVersions.ts`

Funciones centralizadas para manejo de modloaders:

```typescript
// Fetch de versiones de Forge
fetchForgeVersions(): Promise<Record<string, string[]>>

// Fetch de versiones de Fabric
fetchFabricVersions(mcVersion: string): Promise<string[]>

// Fetch de versiones de Quilt
fetchQuiltVersions(mcVersion: string): Promise<string[]>

// Fetch de versiones de NeoForge
fetchNeoForgeVersions(): Promise<string[]>

// Fetch genérico para cualquier loader
fetchLoaderVersions(loaderType: ModLoaderType, mcVersion: string): Promise<string[]>

// Helper para nombres de display
getModLoaderDisplayName(loaderType: ModLoaderType): string

// Helper para iconos
getModLoaderIcon(loaderType: ModLoaderType): string
```

## Integración

### Reemplazo del Diálogo Anterior

El archivo `/application/src/components/creator/dialogs/ModpackVersionsDialog.tsx` ha sido actualizado para usar el nuevo wizard:

```tsx
// Antes: Diálogo simple con campos básicos
<Dialog>
  <input name="versionName" />
  <select name="mcVersion" />
  <select name="forgeVersion" />
</Dialog>

// Ahora: Wizard completo a pantalla completa
<ModpackVersionWizard
    isOpen={isNameDialogOpen}
    onClose={closeNameDialog}
    onSuccess={handleVersionCreated}
    modpack={{...}}
    existingVersions={[...]}
/>
```

## API Backend

### Endpoint: POST `/creators/publishers/:publisherId/modpacks/:modpackId/versions`

#### Request Body

```json
{
  "versionName": "1.0.0",
  "mcVersion": "1.20.1",
  "loaderType": "forge",
  "loaderVersion": "47.2.0",
  "forgeVersion": "47.2.0"  // Mantenido para retrocompatibilidad
}
```

#### Response

```json
{
  "success": true,
  "version": {
    "id": "uuid",
    "version": "1.0.0",
    "mcVersion": "1.20.1",
    "loaderType": "forge",
    "loaderVersion": "47.2.0",
    "forgeVersion": "47.2.0",
    "modpackId": "uuid",
    "createdBy": "uuid",
    "createdAt": "2025-01-01T00:00:00Z"
  },
  "breakingChanges": [
    {
      "version": "0.9.0",
      "mcVersion": "1.19.4",
      "loaderType": "forge"
    }
  ]
}
```

## Flujo de Usuario

1. Usuario hace clic en "Crear nueva versión" en el diálogo de versiones
2. Se abre el wizard a pantalla completa
3. **Paso 1**: Usuario ingresa nombre de versión
4. Usuario hace clic en "Siguiente"
5. **Paso 2**: Usuario ve valores heredados de la última versión
6. Usuario modifica versión de Minecraft si lo desea
7. Usuario selecciona tipo de modloader
8. Sistema carga versiones disponibles automáticamente
9. Usuario selecciona versión específica del modloader
10. Usuario hace clic en "Siguiente"
11. **Paso 3**: Usuario revisa resumen de configuración
12. Si hay breaking changes, sistema muestra advertencia
13. Usuario confirma entendimiento de breaking changes (si aplica)
14. Usuario hace clic en "Crear Versión"
15. **Paso 4**: Se muestra animación de procesamiento
16. Sistema envía request al backend
17. Backend detecta y retorna breaking changes
18. Al completar, se cierra el wizard y se refresca la lista de versiones

## Consideraciones de UX

### Validación
- No se permite avanzar sin completar campos requeridos
- Mensajes de error claros mediante toasts
- Validación en tiempo real de campos

### Accesibilidad
- Focus automático en campos relevantes
- Navegación con teclado soportada
- Contraste adecuado de colores
- Mensajes descriptivos

### Responsividad
- Diseño adaptable a diferentes tamaños de pantalla
- Grid responsive para selectores de modloader
- Scrolling habilitado en contenido largo

## Dependencias Añadidas

```json
{
  "lottie-react": "^2.x"  // Para animaciones Lottie
}
```

## Testing Recomendado

### Casos de Prueba

1. **Crear versión con mismo modloader y MC**
   - No debería mostrar advertencia de breaking changes

2. **Crear versión con diferente versión de MC**
   - Debe mostrar advertencia
   - Debe listar versiones anteriores afectadas

3. **Crear versión con diferente modloader**
   - Debe mostrar advertencia
   - Debe listar todas las versiones anteriores

4. **Cambiar de Forge a Fabric**
   - Verificar que versiones de Fabric se cargan correctamente

5. **Seleccionar Vanilla**
   - No debe mostrar selector de versión de modloader

6. **Heredar valores de versión anterior**
   - Valores deben pre-poblarse correctamente

7. **Cancelar en cualquier paso**
   - Debe cerrar el wizard sin crear versión

8. **Validación de campos**
   - No permitir avanzar con campos vacíos

## Mantenimiento Futuro

### Añadir nuevo Modloader

1. Añadir el tipo al enum `ModLoaderType` en `/application/src/utils/modloaderVersions.ts`
2. Implementar función de fetch correspondiente
3. Añadir caso en `fetchLoaderVersions()`
4. Añadir display name en `getModLoaderDisplayName()`
5. Añadir icono en `getModLoaderIcon()`
6. Actualizar el backend para soportar el nuevo tipo en `/backend/src/types/enums.ts`

### Modificar Animación

Reemplazar el archivo `/application/public/animations/success.json` con un nuevo JSON de Lottie.

### Añadir más pasos al wizard

1. Añadir nuevo valor al type `WizardStep`
2. Crear nuevo bloque en el `AnimatePresence`
3. Actualizar lógica de navegación en `handleNext()` y `handleBack()`
4. Actualizar el progress indicator

## Troubleshooting

### Las versiones de modloader no se cargan

**Problema**: El selector de versiones de modloader está vacío.

**Solución**: 
- Verificar que la API del modloader esté disponible
- Revisar console para errores de red
- Verificar que la versión de Minecraft seleccionada sea compatible

### Breaking changes no se detectan

**Problema**: No se muestra advertencia cuando debería.

**Solución**:
- Verificar que el backend esté retornando `breakingChanges` en la respuesta
- Revisar que `existingVersions` se esté pasando correctamente al wizard
- Verificar logs del backend para ver comparación

### Animación no se muestra

**Problema**: El paso de procesamiento no muestra la animación.

**Solución**:
- Verificar que `/animations/success.json` esté en la carpeta public
- Revisar console para errores al cargar el JSON
- Verificar que lottie-react esté instalado correctamente

## Conclusión

Este rediseño proporciona una experiencia de usuario significativamente mejorada para la creación de versiones de modpacks, con soporte completo para múltiples modloaders, detección inteligente de incompatibilidades, y una interfaz visual atractiva e intuitiva.
