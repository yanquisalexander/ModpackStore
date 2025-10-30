# Prelaunch Designer

Editor visual para crear y personalizar la apariencia de la pantalla de pre-lanzamiento de ModpackStore.

## 🎯 Características

- ✨ **Editor Visual**: Interfaz intuitiva para editar todos los aspectos de la apariencia
- 🎨 **Vista Previa en Tiempo Real**: Ve los cambios instantáneamente
- 📦 **Gestión de Custom Blocks**: Añade, edita, reordena y elimina bloques personalizados
- 💾 **Import/Export JSON**: Importa y exporta configuraciones en formato JSON
- 🔄 **Undo/Redo**: Historial completo de cambios con deshacer/rehacer
- 📱 **Responsive Preview**: Vista previa en diferentes tamaños (desktop, tablet, móvil)
- 🌙 **Tema Oscuro/Claro**: Cambia entre temas para mayor comodidad
- 🎭 **Plantillas Rápidas**: Carga plantillas predefinidas para empezar rápido

## 🚀 Instalación

```bash
# Desde el directorio raíz del monorepo
cd prelaunch-designer

# Instalar dependencias
pnpm install
```

## 💻 Desarrollo

```bash
# Iniciar servidor de desarrollo
pnpm dev

# La aplicación estará disponible en http://localhost:5174
```

## 🏗️ Build

```bash
# Construir para producción
pnpm build

# Vista previa del build de producción
pnpm preview
```

## 📖 Uso

### Panel Básico

En el panel "Básico" puedes configurar:
- Título y descripción
- Logo (URL y posición)
- Fondo (imagen o video)
- Botón de jugar (texto y colores)
- Footer

### Panel de Bloques

En el panel "Bloques" puedes:
- Agregar nuevos bloques personalizados
- Reordenar bloques (mover arriba/abajo)
- Seleccionar bloques para editar
- Eliminar bloques

### Panel Avanzado

En el panel "Avanzado" puedes:
- Editar directamente el JSON completo
- Cargar plantillas predefinidas
- Ver documentación de variables dinámicas

### Panel de Propiedades

Cuando seleccionas un bloque en el panel de bloques, el panel de propiedades muestra:
- ID del bloque
- Etiqueta HTML
- Tipo de renderizado (auto, text, markdown, html)
- Contenido
- Clases CSS
- Posición (top, bottom, left, right, transform, z-index)
- Estilos adicionales en JSON

### Vista Previa

La vista previa muestra cómo se verá la configuración en tiempo real. Puedes cambiar entre:
- 🖥️ **Desktop**: Vista de escritorio completa
- 📱 **Tablet**: Vista en tablet (768x1024)
- 📱 **Móvil**: Vista en móvil (375x667)

## 📚 Estructura del Proyecto

```
prelaunch-designer/
├── src/
│   ├── components/           # Componentes Vue
│   │   ├── BasicSettingsPanel.vue    # Panel de configuración básica
│   │   ├── BlocksPanel.vue           # Panel de gestión de bloques
│   │   ├── AdvancedPanel.vue         # Panel JSON avanzado
│   │   ├── PreviewPanel.vue          # Panel de vista previa
│   │   └── PropertiesPanel.vue       # Panel de propiedades
│   ├── views/                # Vistas principales
│   │   └── EditorView.vue            # Vista principal del editor
│   ├── store/                # Estado global con Pinia
│   │   └── appearance.ts             # Store de apariencia
│   ├── types/                # Definiciones TypeScript
│   │   └── PreLaunchAppearance.ts    # Tipos de PreLaunchAppearance
│   ├── plugins/              # Plugins de Vue
│   │   └── vuetify.ts                # Configuración de Vuetify
│   ├── router/               # Configuración del router
│   │   └── index.ts
│   ├── App.vue               # Componente raíz
│   └── main.ts               # Punto de entrada
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## 🎨 Variables Dinámicas

Los Custom Blocks soportan variables dinámicas que se procesan en tiempo real:

### Fecha y Hora
- `$date()` - Fecha actual
- `$time()` - Hora actual

### Usuario
- `$username(default)` - Nombre de usuario autenticado
- `$mcAccountName(default)` - Cuenta de Minecraft vinculada

### Red
- `$fetch(URL, default)` - Petición HTTP GET
- `$onlinePlayers(host:port)` - Jugadores online en servidor MC

### Utilidades
- `$random(min, max)` - Número aleatorio
- `$counter(name, start)` - Contador incremental
- `$format(number, fmt)` - Formatear números
- `$if(cond, true, false)` - Condicional
- `$len(text)` - Longitud de texto

## 🔗 Integración con ModpackStore

El JSON exportado desde esta herramienta puede ser usado directamente en:

1. **Backend**: Campo `prelaunchAppearance` de la entidad `Modpack`
2. **Frontend**: Componente `CustomBlocksRenderer` en la app principal
3. **API**: Endpoints de creación/actualización de modpacks

## 🛠️ Tecnologías

- **Vue 3**: Framework progresivo de JavaScript
- **Vuetify 3**: Framework de componentes Material Design
- **Vite**: Build tool rápido y moderno
- **TypeScript**: JavaScript con tipos estáticos
- **Pinia**: Store de estado oficial para Vue
- **DOMPurify**: Sanitización de HTML
- **Marked**: Parser de Markdown

## 📝 Notas

- La aplicación es completamente independiente y puede ejecutarse sin el resto del monorepo
- Los cambios no se guardan automáticamente - usa Export para guardar tu configuración
- La vista previa es aproximada - para ver el resultado exacto, prueba en la app principal
- Las variables dinámicas se muestran sin procesar en la vista previa

## 🤝 Contribuir

Para contribuir al desarrollo de Prelaunch Designer:

1. Asegúrate de seguir las convenciones de código del proyecto
2. Usa TypeScript estrictamente - evita `any`
3. Mantén la coherencia visual con la app principal
4. Documenta nuevas características

## 📄 Licencia

Este proyecto es parte de ModpackStore y comparte la misma licencia.
