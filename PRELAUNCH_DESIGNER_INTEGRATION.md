# Guía de Integración - Prelaunch Designer

Esta guía explica cómo integrar el JSON generado por **Prelaunch Designer** con la aplicación principal de ModpackStore.

## 📋 Tabla de Contenidos

1. [Flujo de Trabajo](#flujo-de-trabajo)
2. [Exportar desde Prelaunch Designer](#exportar-desde-prelaunch-designer)
3. [Integración en el Backend](#integración-en-el-backend)
4. [Integración en el Frontend](#integración-en-el-frontend)
5. [Ejemplos de Uso](#ejemplos-de-uso)
6. [Validación](#validación)
7. [Troubleshooting](#troubleshooting)

## Flujo de Trabajo

```
┌─────────────────────┐
│ Prelaunch Designer  │
│  (Edición Visual)   │
└──────────┬──────────┘
           │
           │ Export JSON
           ▼
┌─────────────────────┐
│   JSON File         │
│  (Configuración)    │
└──────────┬──────────┘
           │
           │ Import/API
           ▼
┌─────────────────────┐
│   Backend API       │
│ (Modpack Entity)    │
└──────────┬──────────┘
           │
           │ Fetch
           ▼
┌─────────────────────┐
│  Frontend (Tauri)   │
│ (PreLaunchInstance) │
└─────────────────────┘
```

## Exportar desde Prelaunch Designer

### Usando la UI

1. Abre **Prelaunch Designer** en `http://localhost:5174`
2. Diseña tu configuración de prelaunch
3. Haz clic en el botón flotante (esquina inferior derecha)
4. Selecciona "Exportar JSON" (icono de descarga verde)
5. El archivo `prelaunch-appearance.json` se descargará automáticamente

### Estructura del JSON Exportado

```json
{
  "title": "Mi Servidor Épico",
  "description": "La mejor experiencia de Minecraft",
  "logo": {
    "url": "https://example.com/logo.png",
    "height": "56px",
    "position": {
      "top": "8rem",
      "left": "50%",
      "transform": "translateX(-50%)"
    }
  },
  "playButton": {
    "text": "¡Jugar Ahora!",
    "backgroundColor": "#00a63e",
    "textColor": "#ffffff"
  },
  "background": {
    "videoUrl": "https://example.com/video.mp4"
  },
  "customBlocks": [
    {
      "id": "welcome-message",
      "className": "text-white text-2xl font-bold text-center",
      "tagName": "h1",
      "content": "¡Bienvenido $username(Invitado)!",
      "renderType": "text",
      "position": {
        "top": "12rem",
        "left": "50%",
        "transform": "translateX(-50%)",
        "zIndex": 15
      }
    }
  ]
}
```

## Integración en el Backend

### Opción 1: API REST

Usa el endpoint de actualización de modpacks para establecer el `prelaunchAppearance`:

```typescript
// backend/src/controllers/modpacks.controller.ts
import { Modpack } from '../entities/Modpack';

// Actualizar la configuración de prelaunch
async function updateModpackPrelaunch(modpackId: string, appearance: any) {
  const modpack = await Modpack.findOne({ where: { id: modpackId } });
  
  if (!modpack) {
    throw new Error('Modpack not found');
  }

  modpack.prelaunchAppearance = appearance;
  await modpack.save();
  
  return modpack;
}

// Endpoint ejemplo
app.patch('/api/v1/modpacks/:id/prelaunch', async (c) => {
  const id = c.req.param('id');
  const appearance = await c.req.json();
  
  // Validar el JSON aquí si es necesario
  
  const modpack = await updateModpackPrelaunch(id, appearance);
  return c.json({ modpack });
});
```

### Opción 2: Importación Directa en Base de Datos

```sql
-- Actualizar directamente en PostgreSQL
UPDATE modpacks 
SET prelaunch_appearance = '{
  "title": "Mi Servidor",
  "customBlocks": [...]
}'::jsonb
WHERE id = 'modpack-uuid';
```

### Validación en Backend

```typescript
import { z } from 'zod';

const PreLaunchAppearanceSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  logo: z.object({
    url: z.string().url().optional(),
    height: z.string().optional(),
    position: z.object({
      top: z.string().optional(),
      left: z.string().optional(),
      right: z.string().optional(),
      bottom: z.string().optional(),
      transform: z.string().optional()
    }).optional()
  }).optional(),
  playButton: z.object({
    text: z.string().optional(),
    backgroundColor: z.string().optional(),
    textColor: z.string().optional()
  }).optional(),
  background: z.object({
    imageUrl: z.string().url().optional(),
    videoUrl: z.union([z.string().url(), z.array(z.string().url())]).optional()
  }).optional(),
  customBlocks: z.array(z.object({
    id: z.string().optional(),
    className: z.string().optional(),
    tagName: z.string().optional(),
    style: z.string().optional(),
    content: z.string().optional(),
    renderType: z.enum(['auto', 'text', 'markdown', 'html']).optional(),
    position: z.object({
      top: z.string().optional(),
      left: z.string().optional(),
      right: z.string().optional(),
      bottom: z.string().optional(),
      transform: z.string().optional(),
      zIndex: z.number().optional()
    }).optional()
  })).optional()
});

// Usar en el endpoint
app.patch('/api/v1/modpacks/:id/prelaunch', zValidator('json', PreLaunchAppearanceSchema), async (c) => {
  const appearance = c.req.valid('json');
  // ... resto del código
});
```

## Integración en el Frontend

### Cargar la Configuración

El frontend (Tauri app) ya está preparado para usar la configuración:

```typescript
// application/src/hooks/usePrelaunchInstance.tsx
// La configuración se carga automáticamente desde el modpack

// El componente PreLaunchInstance.tsx ya renderiza:
<CustomBlocksRenderer
  blocks={appearance?.customBlocks}
  instance={prelaunchState.instance}
/>
```

### Editar desde el Diálogo de Modpack

Puedes integrar Prelaunch Designer en el diálogo de edición de modpack:

```tsx
// application/src/components/creator/dialogs/EditModpackDialog.tsx

import { useState } from 'react';

function EditModpackDialog({ modpack }) {
  const [showPrelaunchDesigner, setShowPrelaunchDesigner] = useState(false);

  const handleImportPrelaunch = async () => {
    // Opción 1: Abrir Prelaunch Designer en nueva ventana
    window.open('http://localhost:5174', '_blank');
    
    // Opción 2: Permitir subir archivo JSON
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const text = await file.text();
        const appearance = JSON.parse(text);
        // Actualizar modpack con la nueva configuración
        await updateModpack(modpack.id, { prelaunchAppearance: appearance });
      }
    };
    input.click();
  };

  return (
    <div>
      {/* ... otros campos ... */}
      
      <button onClick={handleImportPrelaunch}>
        Importar Prelaunch Appearance
      </button>
    </div>
  );
}
```

## Ejemplos de Uso

### Ejemplo 1: Servidor Simple

```json
{
  "title": "Servidor Survival",
  "background": {
    "imageUrl": "https://i.imgur.com/background.jpg"
  },
  "playButton": {
    "text": "Comenzar Aventura",
    "backgroundColor": "#2ecc71"
  }
}
```

### Ejemplo 2: Servidor con Estado en Vivo

```json
{
  "customBlocks": [
    {
      "id": "server-status",
      "className": "bg-green-600/90 text-white px-4 py-2 rounded-full",
      "content": "🟢 Online - $onlinePlayers(mc.myserver.com) jugadores",
      "renderType": "text",
      "position": {
        "top": "2rem",
        "right": "2rem",
        "zIndex": 20
      }
    }
  ]
}
```

### Ejemplo 3: Panel de Noticias con Markdown

```json
{
  "customBlocks": [
    {
      "id": "news",
      "className": "bg-black/80 text-white p-6 rounded-xl max-w-lg",
      "content": "# 📰 Noticias\n\n## Nueva actualización\n¡Mods actualizados!",
      "renderType": "markdown",
      "position": {
        "top": "20rem",
        "right": "2rem"
      }
    }
  ]
}
```

## Validación

### Pre-importación

Antes de importar un JSON, valida que:

1. **Es JSON válido**: `JSON.parse()` no debe lanzar error
2. **Tiene estructura correcta**: Usa Zod schema o validación manual
3. **URLs son válidas**: Verifica que las URLs de recursos existen
4. **No contiene scripts maliciosos**: DOMPurify se encarga de esto en el frontend

### Ejemplo de Validación

```typescript
function validatePrelaunchAppearance(json: string): boolean {
  try {
    const appearance = JSON.parse(json);
    
    // Validar estructura básica
    if (appearance.customBlocks) {
      if (!Array.isArray(appearance.customBlocks)) {
        throw new Error('customBlocks debe ser un array');
      }
      
      // Validar cada bloque
      for (const block of appearance.customBlocks) {
        if (block.renderType && !['auto', 'text', 'markdown', 'html'].includes(block.renderType)) {
          throw new Error(`renderType inválido: ${block.renderType}`);
        }
      }
    }
    
    return true;
  } catch (error) {
    console.error('Validación fallida:', error);
    return false;
  }
}
```

## Troubleshooting

### El JSON no se aplica correctamente

**Problema**: Los cambios no se reflejan en la app principal.

**Soluciones**:
1. Verifica que el JSON se guardó correctamente en la base de datos
2. Limpia la caché del navegador/app
3. Verifica que no haya errores en la consola del navegador
4. Revisa que las URLs de recursos (imágenes, videos) sean accesibles

### Las variables dinámicas no funcionan

**Problema**: Variables como `$username()` o `$onlinePlayers()` no se procesan.

**Soluciones**:
1. Asegúrate de que `CustomBlocksRenderer` reciba el prop `instance`
2. Verifica que el usuario esté autenticado para variables de usuario
3. Revisa que la API del servidor MC esté disponible para `$onlinePlayers()`

### Los estilos no se aplican

**Problema**: Las clases CSS o estilos no se ven en el preview.

**Soluciones**:
1. Verifica que estés usando clases de Tailwind válidas
2. Para estilos JSON personalizados, asegúrate de que el JSON sea válido
3. Revisa que no haya conflictos con otros estilos

### Errores de CORS

**Problema**: Las peticiones `$fetch()` fallan por CORS.

**Soluciones**:
1. Configura CORS en el servidor externo
2. Usa un proxy en tu backend
3. Usa valores default que no dependan de peticiones externas

## 🔗 Enlaces Relacionados

- [Documentación de PreLaunch Appearance](../PRELAUNCH_APPEARANCE_STRUCTURE.md)
- [Custom Blocks README](../CUSTOM_BLOCKS_README.md)
- [Variables Dinámicas](../CUSTOM_BLOCKS_VARIABLES_README.md)
- [Prelaunch Designer README](../prelaunch-designer/README.md)

## 📞 Soporte

Si encuentras problemas o tienes preguntas:
1. Revisa la documentación existente
2. Verifica los ejemplos en `/backend/src/examples/custom-blocks-example.ts`
3. Abre un issue en el repositorio de GitHub
