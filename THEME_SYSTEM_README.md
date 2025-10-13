# 🎨 Sistema de Temas de ModpackStore

ModpackStore incluye un sistema de temas potente y flexible que permite a los usuarios personalizar completamente la apariencia de la aplicación.

## Características Principales

### ✅ Temas Integrados
- **Dark**: Tema oscuro por defecto (gratuito)
- **Ice**: Tema con tonos azules helados (gratuito)
- **Dark Knight**: Tema ultra oscuro con acentos púrpura (gratuito)
- **Sunset**: Tema con tonos cálidos de atardecer (premium)

### ✅ Temas Externos
- Carga temas personalizados desde `%appdir%/themes/`
- Soporte para colores personalizados
- Imágenes de fondo opcionales
- Variables CSS personalizadas
- JavaScript en sandbox (seguro)

### ✅ Sistema Premium
- Los 3 temas base siempre son gratuitos
- Temas adicionales pueden ser premium (requieren Modpack Store+)
- Administradores y superadministradores tienen acceso completo
- Indicador visual de temas bloqueados 🔒

### ✅ Persistencia
- La selección de tema se guarda localmente
- Se sincroniza con la configuración del usuario
- Persistente entre sesiones
- (Próximamente) Sincronización en la nube

## Uso

### Para Usuarios

1. Abre la Configuración (⚙️)
2. Ve a la sección **Temas**
3. Selecciona el tema que prefieras
4. Los temas premium muestran un icono de candado 🔒

### Para Creadores

Consulta la [Guía de Creación de Temas](./THEME_CREATION_GUIDE.md) para aprender a crear tus propios temas.

## Arquitectura Técnica

### Frontend (React + TypeScript)

**Componentes principales:**
- `ThemeContext`: Contexto de React para estado global del tema
- `ThemeSelector`: Componente UI para selección de temas
- `theme-utils.ts`: Utilidades para aplicar temas al DOM
- `built-in-themes.ts`: Definición de temas integrados

**Flujo de datos:**
```
ThemeProvider → ThemeContext → ThemeSelector
                    ↓
              applyTheme() → CSS Custom Properties
```

### Backend (Rust + Tauri)

**Comandos Tauri:**
- `get_external_themes`: Carga temas desde el directorio del usuario
- `get_themes_directory_path`: Retorna la ruta del directorio de temas
- `get_config_value`: Lee la preferencia de tema guardada
- `set_config_value`: Guarda la preferencia de tema

**Estructura:**
```rust
core/
└── theme_manager.rs    # Lógica de carga de temas externos
```

### Configuración

**Schema YAML:**
```yaml
selectedTheme:
  type: string
  default: "dark"
  description: "Tema seleccionado por el usuario"
  ui_section: appearance
```

## Formato de Colores

ModpackStore usa el espacio de color **OKLCH** (OKLab Lightness Chroma Hue) que ofrece:

- Colores más vibrantes y consistentes
- Mejor interpolación entre colores
- Percepción uniforme de luminosidad
- Soporte nativo en CSS moderno

**Ejemplo:**
```css
--primary: oklch(0.70 0.20 250);
/* lightness: 70%, chroma: 0.20, hue: 250° */
```

## Seguridad

### Sandbox de JavaScript

Los temas externos pueden incluir JavaScript, pero se ejecuta en un sandbox que:

- ✅ Permite: `console.log/warn/error`
- ✅ Permite: Lectura de `document.documentElement` (solo propiedades)
- ✅ Permite: `window.matchMedia` para media queries
- ❌ Bloquea: APIs de Tauri
- ❌ Bloquea: `fetch` y `XMLHttpRequest`
- ❌ Bloquea: `localStorage` y `sessionStorage`
- ❌ Bloquea: Manipulación del DOM

Esto garantiza que los temas externos no puedan:
- Robar credenciales del usuario
- Acceder a archivos del sistema
- Realizar peticiones de red no autorizadas
- Modificar la aplicación de forma maliciosa

### Validación de Temas

Los temas se validan al cargar para asegurar:
- Formato JSON correcto
- Campos requeridos presentes
- Tipos de datos correctos
- Rutas de archivos válidas

## API de Backend

### Endpoints para Temas (Futuro)

**GET** `/api/v1/themes`
- Lista temas disponibles de la comunidad
- Filtros: gratuitos, premium, categoría

**GET** `/api/v1/themes/:id`
- Obtiene detalles de un tema específico
- Incluye screenshots, valoraciones, descargas

**POST** `/api/v1/themes`
- Sube un tema a la tienda (requiere autenticación)
- Validación automática del manifest

**GET** `/api/v1/user/theme-preference`
- Obtiene preferencia de tema del usuario
- Sincronización entre dispositivos

**PUT** `/api/v1/user/theme-preference`
- Actualiza preferencia de tema del usuario
- Se sincroniza automáticamente

## Integración con Patreon

El sistema verifica el acceso premium mediante:

```typescript
// Frontend
const { canAccessPremium } = useTheme();
// true si el usuario es admin/superadmin o tiene Modpack Store+

// Backend
PatreonIntegrationService.canAccessPremiumFeatures(userId)
// Verifica suscripción activa de Patreon
```

## Ejemplo de Tema Externo

Ver carpeta `/tmp/example-theme/` para un ejemplo completo de tema externo.

**Estructura mínima:**
```
mi-tema/
└── theme.json
```

**Estructura completa:**
```
mi-tema/
├── theme.json          # Manifiesto (requerido)
├── background.jpg      # Fondo opcional
├── index.js           # JS opcional (sandboxed)
└── README.md          # Documentación
```

## Roadmap

- [x] Sistema base de temas
- [x] Temas integrados (dark, ice, dark-knight, sunset)
- [x] Carga de temas externos
- [x] Persistencia local
- [x] Control de acceso premium
- [x] UI de selección de temas
- [ ] Sandbox para JavaScript externo
- [ ] Sincronización en la nube
- [ ] Marketplace de temas
- [ ] Editor visual de temas
- [ ] Importar/exportar temas
- [ ] Temas por modpack (opcional)
- [ ] Animaciones de transición entre temas
- [ ] Previsualización de temas antes de aplicar

## Contribuir

¿Quieres contribuir al sistema de temas? Consulta nuestro [Guía de Contribución](./CONTRIBUTING.md).

## Licencia

El sistema de temas de ModpackStore es parte del proyecto principal y está bajo la misma licencia.
