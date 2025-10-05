// Example configuration for customBlocks in PreLaunchAppearance
// This shows how to configure custom HTML elements that will be rendered
// in the prelaunch screen with proper sanitization

export const customBlocksExample = {
    "customBlocks": [
        {
            "id": "welcome-message",
            "className": "text-center text-white text-2xl font-bold drop-shadow-lg",
            "tagName": "h1",
            "style": "{\"marginTop\": \"2rem\", \"textShadow\": \"2px 2px 4px rgba(0,0,0,0.7)\"}",
            "content": "¡Bienvenido a Minecraft!",
            "renderType": "text",
            "position": {
                "top": "12rem",
                "left": "50%",
                "transform": "translateX(-50%)",
                "zIndex": 15
            }
        },
        {
            "id": "news-section",
            "className": "bg-black/80 text-white p-6 rounded-xl max-w-lg border border-gray-600",
            "tagName": "div",
            "content": `# 📰 Últimas Noticias\n\n## Nuevo mapa disponible\nDescubre el nuevo mapa **Survival Plus** con biomas personalizados y estructuras épicas.\n\n## Eventos semanales\n- 🏆 Torneos PvP los viernes\n- 🎨 Concursos de construcción los sábados\n- 💰 Eventos de economía los domingos\n\n## Actualizaciones\n- ✅ Mods actualizados a la última versión\n- ✅ Nuevos shaders disponibles\n- ✅ Sistema de rangos mejorado`,
            "renderType": "markdown",
            "position": {
                "top": "20rem",
                "right": "2rem",
                "zIndex": 10
            }
        },
        {
            "id": "server-status",
            "className": "bg-green-600/90 text-white px-4 py-2 rounded-full text-sm font-medium",
            "tagName": "div",
            "content": "🟢 Servidor Online - 127/200 jugadores",
            "renderType": "text",
            "position": {
                "top": "2rem",
                "right": "2rem",
                "zIndex": 20
            }
        },
        {
            "id": "server-info",
            "className": "text-sm text-gray-300 bg-black/60 px-3 py-2 rounded-lg",
            "tagName": "p",
            "content": "🌐 mc.modpackstore.com | 📦 Forge 1.20.1 | ⚡ Optimizado",
            "renderType": "text",
            "position": {
                "bottom": "8rem",
                "left": "2rem",
                "zIndex": 5
            }
        },
        {
            "id": "disclaimer",
            "className": "text-xs text-gray-400 text-center max-w-md bg-black/40 px-4 py-2 rounded-lg",
            "tagName": "small",
            "content": "💡 *Recuerda mantener tus mods actualizados para la mejor experiencia de juego.*",
            "renderType": "markdown",
            "position": {
                "bottom": "6rem",
                "left": "50%",
                "transform": "translateX(-50%)",
                "zIndex": 5
            }
        },
        {
            "id": "social-links",
            "className": "flex gap-4 text-white",
            "tagName": "div",
            "content": "[Discord](https://discord.gg/modpackstore) • [Twitter](https://twitter.com/modpackstore) • [Website](https://modpackstore.com)",
            "renderType": "markdown",
            "position": {
                "bottom": "2rem",
                "left": "50%",
                "transform": "translateX(-50%)",
                "zIndex": 5
            }
        },
        {
            "id": "nueva-era",
            "className": "text-center animate-fade-in font-monocraft text-white text-2xl font-bold drop-shadow-lg",
            "tagName": "h1",
            "style": "{\"position\": \"absolute\", \"top\": \"calc(50% + 100px)\", \"left\": \"50%\", \"transform\": \"translateX(-50%)\", \"textShadow\": \"2px 2px 4px rgba(0,0,0,0.7)\", \"animationDelay\": \"500ms\"}",
            "content": "¡Hoy comienza la <span style='color:#55FF55'>ERA DE LOS METALES</span>!",
            "renderType": "html",
            "position": {
                "zIndex": 24
            }
        },
        {
            "id": "container-with-children",
            "className": "absolute top-10 left-10 bg-black/80 p-4 rounded-lg",
            "tagName": "div",
            "children": [
                {
                    "id": "title",
                    "className": "font-minecraft-ten text-xl text-white mb-2",
                    "tagName": "h2",
                    "content": "Información del Servidor",
                    "renderType": "text"
                },
                {
                    "id": "subtitle",
                    "className": "text-gray-300 text-sm",
                    "tagName": "p",
                    "content": "Conectate y disfruta de la experiencia",
                    "renderType": "text"
                }
            ]
        }
    ]
};

/*
CustomBlock Configuration Guide:

1. id: Unique identifier for the block (optional)
2. className: Tailwind CSS classes for styling
3. tagName: HTML tag to use (div, p, h1, h2, span, etc.)
4. style: JSON string with additional CSS styles
5. content: The text/markdown content to render
6. renderType:
   - "text": Plain text (HTML characters escaped)
   - "markdown": Markdown content (converted to HTML)
   - "auto": Auto-detect based on content (default)
   - "html": Raw HTML content (use with caution)
7. position: Absolute positioning (optional)
   - top, left, right, bottom: CSS position values
   - transform: CSS transform
   - zIndex: Stacking order
8. children: Nested custom blocks (for complex layouts)

Security Notes:
- All content is sanitized using DOMPurify
- HTML tags in text content are escaped
- Markdown is converted to safe HTML
- Inline styles are parsed as JSON for security

Usage in backend:
```typescript
const appearance = {
    ...defaultAppearance,
    customBlocks: [
        {
            id: "my-custom-block",
            className: "text-white",
            tagName: "p",
            content: "Hello World!",
            renderType: "text",
            position: { top: "10rem", left: "2rem" }
        }
    ]
};

await set_prelaunch_appearance(instanceId, appearance);
```
*/