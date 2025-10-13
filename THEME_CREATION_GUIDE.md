# Guía para Crear Temas Personalizados en ModpackStore

Esta guía te ayudará a crear temas personalizados para ModpackStore utilizando el sistema de temas externo.

## 📁 Ubicación de Temas

Los temas externos se deben colocar en el directorio de temas de la aplicación:

- **Windows**: `%LOCALAPPDATA%\dev.alexitoo.modpackstore\themes\`
- **macOS**: `~/Library/Application Support/dev.alexitoo.modpackstore/themes/`
- **Linux**: `~/.local/share/dev.alexitoo.modpackstore/themes/`

Puedes abrir esta carpeta fácilmente desde la aplicación:
1. Abre la configuración (⚙️)
2. Ve a la sección de **Temas**
3. Haz clic en **Abrir carpeta de temas**

## 📦 Estructura de un Tema

Cada tema debe estar en su propia carpeta con la siguiente estructura:

```
mi-tema/
├── theme.json          # Manifiesto del tema (requerido)
├── background.jpg      # Imagen de fondo (opcional)
└── index.js           # JavaScript personalizado (opcional)
```

## 📝 Archivo `theme.json`

El archivo `theme.json` es el manifiesto principal de tu tema. Aquí está un ejemplo completo:

```json
{
  "id": "mi-tema-personalizado",
  "name": "Mi Tema Personalizado",
  "description": "Un tema único con colores vibrantes",
  "author": "Tu Nombre",
  "version": "1.0.0",
  "isPremium": false,
  "colors": {
    "background": "oklch(0.12 0.05 220)",
    "foreground": "oklch(0.98 0.01 220)",
    "card": "oklch(0.18 0.06 220)",
    "cardForeground": "oklch(0.98 0.01 220)",
    "popover": "oklch(0.18 0.06 220)",
    "popoverForeground": "oklch(0.98 0.01 220)",
    "primary": "oklch(0.75 0.20 250)",
    "primaryForeground": "oklch(0.12 0.05 220)",
    "secondary": "oklch(0.25 0.08 220)",
    "secondaryForeground": "oklch(0.98 0.01 220)",
    "muted": "oklch(0.25 0.08 220)",
    "mutedForeground": "oklch(0.70 0.03 220)",
    "accent": "oklch(0.60 0.18 240)",
    "accentForeground": "oklch(0.98 0.01 220)",
    "destructive": "oklch(0.704 0.191 22.216)",
    "border": "oklch(0.90 0.03 220 / 10%)",
    "input": "oklch(0.90 0.03 220 / 15%)",
    "ring": "oklch(0.65 0.15 250)",
    "chart1": "oklch(0.65 0.18 250)",
    "chart2": "oklch(0.70 0.15 230)",
    "chart3": "oklch(0.60 0.20 270)",
    "chart4": "oklch(0.55 0.22 240)",
    "chart5": "oklch(0.75 0.12 260)",
    "sidebar": "oklch(0.18 0.06 220)",
    "sidebarForeground": "oklch(0.98 0.01 220)",
    "sidebarPrimary": "oklch(0.75 0.20 250)",
    "sidebarPrimaryForeground": "oklch(0.12 0.05 220)",
    "sidebarAccent": "oklch(0.25 0.08 220)",
    "sidebarAccentForeground": "oklch(0.98 0.01 220)",
    "sidebarBorder": "oklch(0.90 0.03 220 / 10%)",
    "sidebarRing": "oklch(0.65 0.15 250)"
  },
  "customProperties": {
    "custom-gradient": "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
  },
  "backgroundImage": "background.jpg",
  "fontFamily": "Jost Variable, sans-serif"
}
```

### Campos del Manifiesto

- **id** (string, requerido): Identificador único del tema (usa kebab-case)
- **name** (string, requerido): Nombre visible del tema
- **description** (string, requerido): Descripción del tema
- **author** (string, requerido): Tu nombre o usuario
- **version** (string, requerido): Versión del tema (formato semver)
- **isPremium** (boolean, opcional): Si el tema requiere Modpack Store+ (default: false)
- **colors** (object, requerido): Paleta de colores del tema
- **customProperties** (object, opcional): Variables CSS personalizadas adicionales
- **backgroundImage** (string, opcional): Ruta a la imagen de fondo (relativa a la carpeta del tema)
- **fontFamily** (string, opcional): Familia de fuentes personalizada
- **jsFile** (string, opcional): Ruta al archivo JavaScript (⚠️ se ejecutará en sandbox)

## 🎨 Colores del Tema

ModpackStore usa el espacio de color OKLCH para colores más vibrantes y consistentes. El formato es:

```
oklch(lightness chroma hue / alpha)
```

- **lightness**: 0-1 (0 = negro, 1 = blanco)
- **chroma**: 0-0.4 (intensidad del color, 0 = gris)
- **hue**: 0-360 (tono del color en grados)
- **alpha**: 0-1 (transparencia, opcional)

### Ejemplos de Colores:

```css
/* Negro puro */
oklch(0 0 0)

/* Blanco puro */
oklch(1 0 0)

/* Azul vibrante */
oklch(0.6 0.20 250)

/* Rojo semi-transparente */
oklch(0.5 0.25 20 / 50%)

/* Verde pastel */
oklch(0.7 0.10 140)
```

### Herramientas Útiles:

- [OKLCH Color Picker](https://oklch.com/) - Selector visual de colores OKLCH
- [OKLCH Palette Generator](https://huetone.ardov.me/) - Generador de paletas

## 🖼️ Imagen de Fondo

Puedes agregar una imagen de fondo a tu tema:

1. Coloca tu imagen en la carpeta del tema (ej: `background.jpg`)
2. Referencia el archivo en `theme.json`:
   ```json
   "backgroundImage": "background.jpg"
   ```

**Recomendaciones:**
- Resolución: 1920x1080 o superior
- Formato: JPG o PNG
- Tamaño: < 5 MB para mejor rendimiento
- Usa imágenes con bajo contraste para no afectar la legibilidad

## 🛠️ Propiedades CSS Personalizadas

Puedes agregar tus propias variables CSS:

```json
"customProperties": {
  "special-gradient": "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  "special-shadow": "0 10px 40px rgba(0, 0, 0, 0.3)",
  "border-special": "2px solid currentColor"
}
```

Estas estarán disponibles en CSS como `--special-gradient`, `--special-shadow`, etc.

## 🔒 Temas Premium

Si eres creador de contenido y quieres ofrecer temas premium:

1. Marca tu tema como premium:
   ```json
   "isPremium": true
   ```

2. Solo los usuarios con Modpack Store+ podrán usar temas premium
3. Los temas base (dark, ice, dark-knight) siempre son gratuitos

## ⚠️ JavaScript Personalizado (Avanzado)

Puedes incluir JavaScript personalizado, pero se ejecutará en un entorno sandbox limitado:

```javascript
// index.js
console.log('Mi tema personalizado cargado!');

// Solo tienes acceso a:
// - console.log/warn/error
// - document.documentElement (solo lectura de propiedades)
// - window.matchMedia

// NO tienes acceso a:
// - APIs de Tauri
// - fetch/XMLHttpRequest
// - localStorage/sessionStorage
// - Manipulación del DOM
```

**Importante:** El JavaScript se ejecuta en un sandbox seguro para proteger la aplicación.

## ✅ Validación de Temas

Antes de distribuir tu tema:

1. Verifica que el `theme.json` sea válido (usa un validador JSON)
2. Prueba el tema en la aplicación
3. Asegúrate de que todos los colores sean legibles
4. Verifica que las imágenes se carguen correctamente

## 📤 Compartir tu Tema

Para compartir tu tema:

1. Comprime la carpeta de tu tema en un archivo ZIP
2. Compártelo con otros usuarios
3. Los usuarios solo necesitan extraer el ZIP en su carpeta de temas

## 🎨 Temas de Ejemplo

### Tema Oscuro con Acentos Morados

```json
{
  "id": "purple-night",
  "name": "Purple Night",
  "description": "Tema oscuro con elegantes acentos morados",
  "author": "ModpackStore",
  "version": "1.0.0",
  "colors": {
    "background": "oklch(0.10 0.02 280)",
    "foreground": "oklch(0.95 0.01 280)",
    "primary": "oklch(0.65 0.25 290)",
    "primaryForeground": "oklch(0.98 0 0)"
  }
}
```

### Tema Claro Minimalista

```json
{
  "id": "light-minimal",
  "name": "Light Minimal",
  "description": "Tema claro y minimalista",
  "author": "ModpackStore",
  "version": "1.0.0",
  "colors": {
    "background": "oklch(0.98 0 0)",
    "foreground": "oklch(0.15 0 0)",
    "primary": "oklch(0.40 0.15 250)",
    "primaryForeground": "oklch(0.98 0 0)"
  }
}
```

## 🆘 Soporte

Si tienes problemas creando tu tema:

1. Verifica que el `theme.json` sea válido
2. Revisa la consola de la aplicación para errores
3. Consulta los temas de ejemplo incluidos
4. Reporta problemas en GitHub

## 📜 Licencia

Los temas que crees son de tu propiedad. Puedes distribuirlos bajo la licencia que prefieras.
