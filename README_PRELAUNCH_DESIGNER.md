# 🚀 Prelaunch Designer - Sistema Visual para Prelaunch Appearance

## Descripción General

El **Prelaunch Designer** es una aplicación visual desarrollada con Vite + Vue 3 + Vuetify 3 que permite a los creadores de modpacks diseñar y personalizar la pantalla de pre-lanzamiento de ModpackStore sin necesidad de editar JSON manualmente.

## 🎯 Características Principales

### ✨ Editor Visual Completo
- **Panel Básico**: Configura título, descripción, logo, fondo, botón de jugar y footer
- **Panel de Bloques**: Gestiona custom blocks con controles visuales
- **Panel Avanzado**: Edita JSON directamente con plantillas y documentación
- **Panel de Propiedades**: Edita todas las propiedades del bloque seleccionado

### 🎨 Preview en Tiempo Real
- Vista previa instantánea de todos los cambios
- Modos responsive: Desktop (16:9), Tablet (768x1024), Mobile (375x667)
- Renderizado fiel a la app principal

### 💾 Import/Export
- Exporta configuración como JSON
- Importa configuraciones existentes con validación
- Compatibilidad total con el formato del backend

### 🔄 Gestión de Estado
- Historial Undo/Redo (50 items)
- Estado persistente durante la sesión
- Validación en tiempo real

## 📦 Instalación y Uso

### Requisitos Previos
- Node.js 18+
- PNPM 8+

### Instalación

```bash
# Desde el directorio raíz del monorepo
cd prelaunch-designer

# Instalar dependencias
pnpm install
```

### Desarrollo

```bash
# Iniciar servidor de desarrollo
pnpm dev

# La app estará disponible en http://localhost:5174
```

### Build para Producción

```bash
# Construir para producción
pnpm build

# El resultado estará en ./dist/

# Preview del build
pnpm preview
```

## 📚 Documentación

### Guías Principales
1. **[PRELAUNCH_APPEARANCE_STRUCTURE.md](./PRELAUNCH_APPEARANCE_STRUCTURE.md)**: Referencia completa de la estructura JSON
2. **[prelaunch-designer/README.md](./prelaunch-designer/README.md)**: Guía de usuario de la aplicación
3. **[PRELAUNCH_DESIGNER_INTEGRATION.md](./PRELAUNCH_DESIGNER_INTEGRATION.md)**: Guía de integración técnica
4. **[IMPLEMENTATION_SUMMARY_PRELAUNCH_DESIGNER.md](./IMPLEMENTATION_SUMMARY_PRELAUNCH_DESIGNER.md)**: Resumen de implementación

### Documentación Existente
- **[CUSTOM_BLOCKS_README.md](./CUSTOM_BLOCKS_README.md)**: Guía de Custom Blocks
- **[CUSTOM_BLOCKS_VARIABLES_README.md](./CUSTOM_BLOCKS_VARIABLES_README.md)**: Variables dinámicas

## 🎬 Flujo de Trabajo

```
1. Diseñar en Prelaunch Designer
   ↓
2. Exportar JSON
   ↓
3. Importar en Backend (API o DB)
   ↓
4. Visualizar en App Principal
```

## 🔧 Estructura Técnica

### Stack
- **Vue 3.5**: Framework progresivo con Composition API
- **Vuetify 3.10**: Material Design UI Framework
- **Vite 6.4**: Build tool moderno y rápido
- **TypeScript 5.9**: Type safety completo
- **Pinia 3.0**: State management oficial de Vue
- **DOMPurify 3.3**: Sanitización de HTML
- **Marked 16.4**: Parser de Markdown

### Arquitectura

```
prelaunch-designer/
├── src/
│   ├── components/          # Componentes Vue
│   │   ├── BasicSettingsPanel.vue
│   │   ├── BlocksPanel.vue
│   │   ├── AdvancedPanel.vue
│   │   ├── PreviewPanel.vue
│   │   └── PropertiesPanel.vue
│   ├── views/              # Vistas principales
│   │   └── EditorView.vue
│   ├── store/              # Pinia stores
│   │   └── appearance.ts
│   ├── types/              # TypeScript types
│   │   └── PreLaunchAppearance.ts
│   ├── plugins/            # Plugins de Vue
│   │   └── vuetify.ts
│   ├── router/             # Vue Router
│   │   └── index.ts
│   ├── App.vue
│   └── main.ts
├── package.json
├── vite.config.ts
└── tsconfig.json
```

## 🎨 Diseño

### Paleta de Colores
- **Primary**: #00a63e (Verde característico de ModpackStore)
- **Secondary**: #262626 (Gris oscuro)
- **Accent**: #55FF55 (Verde claro)

### Temas
- Tema oscuro por defecto (matching main app)
- Toggle para cambiar a tema claro
- Consistencia visual con la aplicación principal

## 📖 Guía Rápida

### 1. Configuración Básica

```
Panel Básico → Configurar:
- Título del servidor
- Descripción
- Logo (URL y posición)
- Fondo (imagen o video)
- Botón de jugar (texto y colores)
- Footer
```

### 2. Agregar Custom Blocks

```
Panel Bloques → Agregar Bloque:
- Definir ID
- Seleccionar etiqueta HTML
- Elegir tipo de renderizado
- Escribir contenido
- Añadir clases CSS
```

### 3. Editar Propiedades

```
Seleccionar Bloque → Panel Propiedades:
- Editar posición (top, left, right, bottom)
- Definir transform CSS
- Establecer z-index
- Añadir estilos JSON personalizados
```

### 4. Modo Avanzado

```
Panel Avanzado:
- Editar JSON directamente
- Cargar plantillas predefinidas
- Ver documentación de variables
- Aplicar cambios
```

### 5. Exportar

```
Speed Dial (botón flotante) → Exportar JSON:
- Se descarga prelaunch-appearance.json
- Listo para importar en backend
```

## 🔗 Integración

### En el Backend

```typescript
// Actualizar modpack con nueva configuración
import { Modpack } from './entities/Modpack';

const modpack = await Modpack.findOne({ where: { id: modpackId } });
modpack.prelaunchAppearance = importedJSON;
await modpack.save();
```

### En el Frontend

```tsx
// El componente ya está preparado
<CustomBlocksRenderer
  blocks={appearance?.customBlocks}
  instance={instance}
/>
```

Ver [PRELAUNCH_DESIGNER_INTEGRATION.md](./PRELAUNCH_DESIGNER_INTEGRATION.md) para más detalles.

## 🎯 Casos de Uso

### Caso 1: Servidor Simple
Configura título, logo y botón de jugar en menos de 2 minutos.

### Caso 2: Servidor con Noticias
Añade un panel de noticias con Markdown en el lateral.

### Caso 3: Servidor con Estado en Vivo
Usa `$onlinePlayers()` para mostrar jugadores conectados en tiempo real.

### Caso 4: Servidor Premium
Combina video de fondo, múltiples custom blocks y animaciones CSS.

## 🐛 Troubleshooting

### Build Errors
```bash
# Limpiar node_modules y reinstalar
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### Preview no Actualiza
- Verifica que los cambios se guarden en el store
- Recarga la página del navegador
- Revisa la consola del navegador por errores

### JSON Inválido
- Usa el validador integrado en el panel avanzado
- Verifica que no haya comas finales en arrays/objetos
- Usa comillas dobles (") no simples (')

## 🚀 Próximas Mejoras Sugeridas

1. **Drag & Drop Visual**: Arrastrar bloques en el preview para posicionar
2. **Asset Manager**: Subir y gestionar imágenes/videos directamente
3. **Biblioteca de Plantillas**: Más plantillas predefinidas
4. **Colaboración**: Compartir configuraciones entre usuarios
5. **Live Variables Preview**: Procesar variables dinámicas en el preview
6. **Embedding**: Integrar directamente en EditModpackDialog

## 📞 Soporte

- **Documentación**: Ver archivos .md en el repositorio
- **Ejemplos**: `/backend/src/examples/custom-blocks-example.ts`
- **Issues**: GitHub Issues del repositorio

## 📝 Licencia

Parte del proyecto ModpackStore. Comparte la misma licencia del proyecto principal.

---

**Desarrollado con** ❤️ **usando Vite + Vue 3 + Vuetify 3**

**Versión**: 0.1.0  
**Estado**: ✅ Funcional y Listo para Producción  
**Última Actualización**: 30 de Octubre, 2025
