# Custom Blocks Feature

La funcionalidad de **Custom Blocks** permite agregar elementos HTML personalizados y sanitizados a la pantalla de prelaunch de las instancias de Minecraft.

## Características

- ✅ **Sanitización automática**: Todo el contenido HTML se sanitiza usando DOMPurify
- ✅ **Soporte Markdown**: Renderizado de Markdown a HTML seguro
- ✅ **Posicionamiento absoluto**: Control total sobre la posición de los elementos
- ✅ **Estilos personalizados**: Soporte para clases CSS y estilos inline
- ✅ **Tipos de renderizado**: Texto plano, Markdown, o detección automática

## Configuración

Los custom blocks se configuran a través del objeto `PreLaunchAppearance` en el campo `customBlocks`:

```typescript
{
    "customBlocks": [
        {
            "id": "unique-id",           // Identificador único (opcional)
            "className": "css-classes",  // Clases CSS (Tailwind)
            "tagName": "div",           // Etiqueta HTML
            "style": "{\"color\": \"red\"}", // Estilos CSS como JSON
            "content": "Contenido",     // Texto o Markdown
            "renderType": "markdown",   // "text" | "markdown" | "auto"
            "position": {               // Posicionamiento absoluto
                "top": "10rem",
                "left": "2rem",
                "zIndex": 10
            }
        }
    ]
}
```

## Tipos de Renderizado

### `text`
Contenido de texto plano. Los caracteres HTML se escapan automáticamente.
```json
{
    "content": "<strong>Texto</strong> normal",
    "renderType": "text"
}
```

### `markdown`
Contenido Markdown que se convierte a HTML.
```json
{
    "content": "**Texto en negrita** y *cursiva*",
    "renderType": "markdown"
}
```

### `auto` (predeterminado)
Detecta automáticamente si usar Markdown basado en la sintaxis.
```json
{
    "content": "Texto normal sin sintaxis markdown",
    "renderType": "auto"
}
```

## Posicionamiento

Los elementos se pueden posicionar absolutamente en la pantalla:

```json
{
    "position": {
        "top": "10rem",
        "left": "50%",
        "transform": "translateX(-50%)",
        "zIndex": 15
    }
}
```

## Estilos

### Clases CSS (recomendado)
```json
{
    "className": "text-white text-xl font-bold bg-black/80 p-4 rounded-lg"
}
```

### Estilos Inline
```json
{
    "style": "{\"color\": \"#ffffff\", \"fontSize\": \"1.25rem\", \"textShadow\": \"2px 2px 4px rgba(0,0,0,0.5)\"}"
}
```

## Ejemplos Completos

### Mensaje de Bienvenida
```json
{
    "id": "welcome",
    "className": "text-center text-white text-3xl font-bold",
    "tagName": "h1",
    "content": "¡Bienvenido!",
    "renderType": "text",
    "position": {
        "top": "8rem",
        "left": "50%",
        "transform": "translateX(-50%)",
        "zIndex": 20
    }
}
```

### Sección de Noticias con Markdown
```json
{
    "id": "news",
    "className": "bg-black/80 text-white p-6 rounded-xl max-w-lg",
    "tagName": "div",
    "content": "# Últimas Noticias\n\n- Nuevo mapa disponible\n- **Eventos** semanales",
    "renderType": "markdown",
    "position": {
        "top": "15rem",
        "right": "2rem",
        "zIndex": 10
    }
}
```

### Información del Servidor
```json
{
    "id": "server-info",
    "className": "text-sm text-gray-300",
    "tagName": "p",
    "content": "🟢 Online | 127/200 players",
    "renderType": "text",
    "position": {
        "bottom": "2rem",
        "left": "2rem",
        "zIndex": 5
    }
}
```

## Seguridad

- Todo el contenido se sanitiza automáticamente
- No se permite JavaScript inline
- Los estilos se validan como JSON
- Las etiquetas HTML peligrosas se eliminan

## Integración Backend

Para usar esta funcionalidad desde el backend:

```typescript
import { customBlocksExample } from './examples/custom-blocks-example';

// Aplicar configuración
const appearance = {
    ...defaultAppearance,
    ...customBlocksExample
};

await set_prelaunch_appearance(instanceId, appearance);
```

## Notas de Desarrollo

- Los elementos se renderizan en el orden del array
- El z-index controla la superposición
- Las posiciones son absolutas respecto al contenedor principal
- Los estilos inline tienen prioridad sobre las clases CSS