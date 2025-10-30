# Prelaunch Appearance - Estructura JSON Completa

## Descripción General

El sistema de **Prelaunch Appearance** define la apariencia visual de la pantalla de pre-lanzamiento que se muestra antes de iniciar una instancia de Minecraft. La configuración se almacena en formato JSON en el campo `prelaunchAppearance` de la entidad `Modpack`.

## Estructura Completa del JSON

```typescript
interface PreLaunchAppearance {
    title?: string;
    description?: string;
    logo?: Logo;
    playButton?: PlayButton;
    background?: Background;
    audio?: Audio;
    news?: News;
    footerStyle?: FooterStyle;
    footerText?: string;
    customBlocks?: CustomBlock[];
}
```

## Componentes Principales

### 1. Logo

Configura el logotipo que aparece en la pantalla de pre-lanzamiento.

```json
{
    "logo": {
        "url": "https://example.com/logo.png",
        "height": "56px",
        "position": {
            "top": "8rem",
            "left": "50%",
            "transform": "translateX(-50%)"
        },
        "fadeInDuration": "500ms",
        "fadeInDelay": "1000ms"
    }
}
```

**Propiedades:**
- `url` (string): URL de la imagen del logo
- `height` (string): Altura del logo en unidades CSS
- `position` (LogoPosition): Posicionamiento absoluto del logo
  - `top`, `left`, `right`, `bottom` (string): Posiciones CSS
  - `transform` (string): Transformación CSS
- `fadeInDuration` (string): Duración de la animación de entrada
- `fadeInDelay` (string): Retraso antes de iniciar la animación

### 2. PlayButton

Configura el botón de jugar principal.

```json
{
    "playButton": {
        "text": "Jugar ahora",
        "backgroundColor": "#00a63e",
        "hoverColor": "#262626",
        "textColor": "#ffffff",
        "borderColor": "#ffffff",
        "fadeInDuration": "500ms",
        "fadeInDelay": "1500ms",
        "position": {
            "bottom": "2rem",
            "left": "50%",
            "transform": "translateX(-50%)"
        }
    }
}
```

**Propiedades:**
- `text` (string): Texto del botón
- `backgroundColor` (string): Color de fondo en formato hex/rgb
- `hoverColor` (string): Color al pasar el mouse
- `textColor` (string): Color del texto
- `borderColor` (string): Color del borde
- `fadeInDuration` (string): Duración de la animación
- `fadeInDelay` (string): Retraso de la animación
- `position` (PlayButtonPosition): Posicionamiento absoluto (opcional)

### 3. Background

Configura el fondo de la pantalla (imagen o video).

```json
{
    "background": {
        "imageUrl": "https://example.com/background.jpg",
        "videoUrl": "/assets/videos/prelaunch-default-1.mp4"
    }
}
```

**Propiedades:**
- `imageUrl` (string): URL de imagen de fondo
- `videoUrl` (string | string[]): URL(s) de video de fondo
  - Puede ser una sola URL o un array para múltiples videos

### 4. Audio

Configura música de fondo.

```json
{
    "audio": {
        "url": "https://example.com/music.mp3",
        "volume": 0.5
    }
}
```

**Propiedades:**
- `url` (string): URL del archivo de audio
- `volume` (number): Volumen de 0.0 a 1.0

### 5. News

Muestra un panel de noticias.

```json
{
    "news": {
        "position": {
            "top": "3rem",
            "right": "2rem"
        },
        "style": {
            "background": "rgba(0,0,0,0.8)",
            "color": "#ffffff",
            "borderRadius": "0.5rem",
            "padding": "1rem",
            "width": "20rem",
            "fontSize": "0.875rem"
        },
        "entries": [
            {
                "title": "Actualización 1.0",
                "content": "Nuevas características disponibles"
            }
        ]
    }
}
```

**Propiedades:**
- `position` (NewsPosition): Posición del panel
- `style` (Style): Estilos CSS del panel
- `entries` (Entry[]): Array de noticias

### 6. Footer

Configura el pie de página.

```json
{
    "footerText": "© 2024 Mi Servidor",
    "footerStyle": {
        "background": "rgba(0,0,0,0.5)",
        "color": "#ffffff",
        "borderRadius": "0.5rem",
        "padding": "1rem",
        "width": "auto",
        "fontSize": "0.875rem"
    }
}
```

**Propiedades:**
- `footerText` (string): Texto del footer
- `footerStyle` (FooterStyle): Estilos CSS del footer

### 7. Custom Blocks ⭐

Los **Custom Blocks** son el componente más flexible y poderoso del sistema. Permiten agregar elementos HTML personalizados con contenido dinámico.

```json
{
    "customBlocks": [
        {
            "id": "welcome-message",
            "className": "text-center text-white text-2xl font-bold",
            "tagName": "h1",
            "style": "{\"marginTop\": \"2rem\"}",
            "content": "¡Bienvenido $username(Invitado)!",
            "renderType": "text",
            "position": {
                "top": "12rem",
                "left": "50%",
                "transform": "translateX(-50%)",
                "zIndex": 15
            },
            "children": []
        }
    ]
}
```

**Propiedades de CustomBlock:**
- `id` (string, opcional): Identificador único
- `className` (string, opcional): Clases CSS (compatible con Tailwind)
- `tagName` (string, opcional): Etiqueta HTML (div, p, h1, span, etc.)
- `style` (string, opcional): Estilos CSS en formato JSON string
- `content` (string, opcional): Contenido del bloque (admite variables dinámicas)
- `renderType` (string, opcional): Tipo de renderizado
  - `"text"`: Texto plano (HTML escapado)
  - `"html"`: HTML sanitizado
  - `"markdown"`: Markdown a HTML
  - `"auto"`: Detección automática (default)
- `position` (CustomBlockPosition, opcional): Posicionamiento absoluto
  - `top`, `left`, `right`, `bottom` (string): Posiciones CSS
  - `transform` (string): Transformación CSS
  - `zIndex` (number): Orden de apilamiento
- `zIndex` (number, opcional): Z-index del elemento
- `children` (CustomBlock[], opcional): Bloques hijos anidados
- `dynamicContent` (objeto, opcional): Configuración de contenido dinámico
  - `enabled` (boolean): Activar contenido dinámico
  - `variables` (Record<string, any>): Variables personalizadas
  - `refreshInterval` (number): Intervalo de actualización en ms

## Variables Dinámicas en Custom Blocks

Los Custom Blocks soportan variables dinámicas que se procesan en tiempo real:

### Variables de Fecha y Hora

```
$date()              → Fecha actual en formato local
$date(iso)           → Fecha en formato ISO
$date(medium)        → Fecha formato mediano
$time()              → Hora actual
$time(24h)           → Hora en formato 24h
```

### Variables de Usuario

```
$username(default)          → Nombre del usuario autenticado
$mcAccountName(default)     → Nombre de la cuenta de Minecraft vinculada
```

### Variables de Red

```
$fetch(URL, default)                  → Petición HTTP GET
$onlinePlayers(host:port)             → Jugadores online en servidor MC
$onlinePlayers(host, port)            → Formato alternativo
```

### Variables de Utilidad

```
$random(min, max)     → Número aleatorio
$counter(name, start) → Contador incremental
$format(number, fmt)  → Formatear números
$if(cond, true, false) → Condicional
$len(text)            → Longitud de texto
```

## Ejemplo Completo

```json
{
    "title": "Mi Servidor Épico",
    "description": "La mejor experiencia de Minecraft",
    "logo": {
        "url": "https://example.com/logo.png",
        "height": "160px",
        "position": {
            "top": "50%",
            "left": "50%",
            "transform": "translateX(-50%) translateY(-50%)"
        }
    },
    "background": {
        "videoUrl": [
            "https://example.com/video1.mp4",
            "https://example.com/video2.mp4"
        ]
    },
    "playButton": {
        "text": "¡Jugar Ahora!",
        "backgroundColor": "#00a63e",
        "hoverColor": "#262626",
        "textColor": "#ffffff"
    },
    "customBlocks": [
        {
            "id": "server-status",
            "className": "bg-green-600/90 text-white px-4 py-2 rounded-full",
            "tagName": "div",
            "content": "🟢 Online - $onlinePlayers(mc.example.com) jugadores",
            "renderType": "text",
            "position": {
                "top": "2rem",
                "right": "2rem",
                "zIndex": 20
            }
        },
        {
            "id": "welcome",
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
        },
        {
            "id": "news-panel",
            "className": "bg-black/80 text-white p-6 rounded-xl max-w-lg",
            "tagName": "div",
            "content": "# 📰 Noticias\\n\\n## Nueva actualización\\n¡Mods actualizados!",
            "renderType": "markdown",
            "position": {
                "top": "20rem",
                "right": "2rem",
                "zIndex": 10
            }
        }
    ],
    "footerText": "© 2024 Mi Servidor - Todos los derechos reservados"
}
```

## Interacción con Custom Blocks

### Cómo se Cargan

1. El JSON se almacena en el campo `prelaunchAppearance` de la entidad `Modpack`
2. Al abrir una instancia, se carga desde la base de datos
3. El componente `CustomBlocksRenderer` procesa los bloques
4. Las variables dinámicas se resuelven en tiempo real
5. El contenido se sanitiza con DOMPurify antes de renderizar

### Renderizado

```typescript
// En PreLaunchInstance.tsx
<CustomBlocksRenderer
    blocks={appearance?.customBlocks}
    instance={prelaunchState.instance}
/>
```

### Seguridad

- **DOMPurify**: Todo el HTML se sanitiza automáticamente
- **Escapado**: El contenido de texto escapa caracteres HTML
- **Whitelist**: Solo se permiten etiquetas y atributos seguros
- **JSON parsing**: Los estilos inline deben ser JSON válido

## Herramientas de Edición

### Backend

El backend proporciona endpoints para:
- Crear/actualizar la configuración de prelaunch
- Validar el JSON antes de guardar
- Exportar configuraciones existentes

### Frontend (App Principal)

El diálogo `EditModpackDialog` permite:
- Editar texto básico (title, description)
- Modificar configuración de logo y botones
- Vista previa básica

### Prelaunch Designer (Nueva Herramienta)

La nueva aplicación `prelaunch-designer` proporcionará:
- Editor visual WYSIWYG
- Drag & drop de elementos
- Editor de propiedades visual
- Modo editor JSON avanzado
- Preview en tiempo real
- Import/Export de JSON
- Biblioteca de plantillas

## Referencias

- Tipo de datos: `/application/src/types/PreLaunchAppeareance.d.ts`
- Renderizador: `/application/src/components/CustomBlocksRenderer.tsx`
- Vista previa: `/application/src/views/PreLaunchInstance.tsx`
- Ejemplos: `/backend/src/examples/custom-blocks-example.ts`
- Variables dinámicas: `CUSTOM_BLOCKS_VARIABLES_README.md`
- Custom blocks: `CUSTOM_BLOCKS_README.md`
