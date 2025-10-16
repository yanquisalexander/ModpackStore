# 📸 UI Mockup: Exportar Instancias Locales a .mrpack

## Vista del Menú Contextual

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                   Mi Instancia Local                  │  │
│  │                   Minecraft 1.20.1                    │  │
│  │  [🎮 Jugar]                                           │  │
│  └──────────────────────────────────────────────────────┘  │
│                          │                                  │
│                          │ Clic Derecho                     │
│                          ▼                                  │
│         ┌────────────────────────────────────┐             │
│         │  ⚙️  Configurar                    │             │
│         ├────────────────────────────────────┤             │
│         │  🔗 Crear acceso directo           │             │
│         ├────────────────────────────────────┤             │
│         │  📤 Exportar como .mrpack   ⭐ NEW │             │
│         ├────────────────────────────────────┤             │
│         │  💾 Crear copia de seguridad       │             │
│         ├────────────────────────────────────┤             │
│         │  🗑️  Eliminar instancia            │             │
│         └────────────────────────────────────┘             │
│                                                             │
└─────────────────────────────────────────────────────────────┘

Nota: La opción "Exportar como .mrpack" solo aparece en instancias locales
```

## Comparación: Local vs Modpack

### Instancia Local (Muestra opción de exportar)
```
┌─────────────────────────────┐
│  Mi Instancia Local         │
│  🖥️ LOCAL                   │
│  Minecraft 1.20.1           │
│  ────────────────────        │
│  Menú:                      │
│  ⚙️  Configurar             │
│  🔗 Crear acceso directo    │
│  📤 Exportar como .mrpack   │ ← VISIBLE
│  💾 Crear copia de seguridad│
│  🗑️  Eliminar instancia     │
└─────────────────────────────┘
```

### Instancia de Modpack (NO muestra opción de exportar)
```
┌─────────────────────────────┐
│  All the Mods 9             │
│  📦 MODPACK                 │
│  Minecraft 1.20.1           │
│  ────────────────────        │
│  Menú:                      │
│  ⚙️  Configurar             │
│  🔗 Crear acceso directo    │
│  💾 Crear copia de seguridad│ ← NO hay opción de exportar
│  🗑️  Eliminar instancia     │
└─────────────────────────────┘
```

## Flujo de Usuario Completo

### Paso 1: Seleccionar Instancia
```
┌──────────────────────────────────────────────────┐
│  Mis Instancias                                  │
├──────────────────────────────────────────────────┤
│                                                  │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐│
│  │Mi Instancia│  │All the Mods│  │Otra Instancia││
│  │LOCAL 🖥️    │  │MODPACK 📦  │  │LOCAL 🖥️    ││
│  │v1.20.1     │  │v1.20.1     │  │v1.19.2     ││
│  └────────────┘  └────────────┘  └────────────┘│
│       ▲                                          │
│       │ Clic derecho                             │
│       └─────────────────────────────────────────│
└──────────────────────────────────────────────────┘
```

### Paso 2: Menú Contextual
```
┌──────────────────────────────────┐
│  ⚙️  Configurar                  │
│  🔗 Crear acceso directo         │
│  📤 Exportar como .mrpack ◄──────┼─ Usuario hace clic
│  💾 Crear copia de seguridad     │
│  🗑️  Eliminar instancia          │
└──────────────────────────────────┘
```

### Paso 3: Diálogo de Guardado
```
┌─────────────────────────────────────────────────┐
│  Guardar archivo                           X    │
├─────────────────────────────────────────────────┤
│  Ubicación: 📁 C:\Users\Usuario\Documents      │
│                                                 │
│  Nombre del archivo:                            │
│  ┌──────────────────────────────────────────┐  │
│  │ Mi Instancia Local.mrpack                │  │
│  └──────────────────────────────────────────┘  │
│                                                 │
│  Tipo de archivo:                               │
│  ┌──────────────────────────────────────────┐  │
│  │ Modrinth Modpack (*.mrpack)         ▼   │  │
│  └──────────────────────────────────────────┘  │
│                                                 │
│                    [Cancelar]  [Guardar]        │
└─────────────────────────────────────────────────┘
```

### Paso 4: Progreso en Task Manager
```
┌─────────────────────────────────────────────────┐
│  Tareas en Curso                                │
├─────────────────────────────────────────────────┤
│                                                 │
│  📤 Exportando instancia a .mrpack              │
│     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 65%      │
│     Procesando archivo 234/360                  │
│                                                 │
│  Estados posibles:                              │
│  • 10%: Recopilando información...             │
│  • 20%: Recorriendo archivos...                │
│  • 30-70%: Procesando archivo X/Y              │
│  • 75%: Creando manifest...                    │
│  • 80-95%: Empaquetando archivo X/Y            │
│  • 100%: Instancia exportada correctamente     │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Paso 5: Notificación de Éxito
```
┌─────────────────────────────────────┐
│  ✅ Instancia exportada             │
│     correctamente                   │
│                                     │
│  El archivo se guardó en:           │
│  C:\Users\Usuario\Documents\        │
│  Mi Instancia Local.mrpack          │
│                                     │
│                          [Cerrar]   │
└─────────────────────────────────────┘
```

## Estados del Badge en las Cards

```
┌─────────────────────────┐       ┌─────────────────────────┐
│  Mi Instancia           │       │  All the Mods 9         │
│  ╭─────────────────╮    │       │  ╭─────────────────╮    │
│  │ 🖥️ LOCAL        │    │       │  │ 📦 MODPACK      │    │
│  ╰─────────────────╯    │       │  ╰─────────────────╯    │
│  Minecraft 1.20.1       │       │  Minecraft 1.20.1       │
│  [🎮 Jugar]             │       │  [🎮 Jugar]             │
└─────────────────────────┘       └─────────────────────────┘
    ↑                                 ↑
    Puede exportar                    NO puede exportar
```

## Comportamiento Hover

```
Estado Normal:
┌────────────────────────┐
│  Mi Instancia Local    │
│                        │
│  Minecraft 1.20.1      │
└────────────────────────┘

Estado Hover:
┌────────────────────────┐
│ 🖥️ LOCAL               │ ← Badge visible
│  Mi Instancia Local    │
│  Minecraft 1.20.1      │
│  [🎮 Jugar]            │ ← Botón visible
└────────────────────────┘
```

## Iconografía Utilizada

```
📤 LucideUpload     - Icono de exportar
🖥️ LucideHardDrive  - Badge de instancia local
📦 LucidePackageOpen - Badge de modpack
⚙️ LucideSettings   - Configurar
🔗 LucideFolderSymlink - Crear acceso directo
💾 LucideDownload   - Crear backup
🗑️ LucideTrash2     - Eliminar instancia
```

## Responsive Behavior

```
Desktop (Grande):
┌───────┬───────┬───────┬───────┐
│       │       │       │       │
│  Card │  Card │  Card │  Card │
│       │       │       │       │
└───────┴───────┴───────┴───────┘

Tablet (Mediano):
┌───────┬───────┬───────┐
│       │       │       │
│  Card │  Card │  Card │
│       │       │       │
└───────┴───────┴───────┘

Mobile (Pequeño):
┌───────┬───────┐
│       │       │
│  Card │  Card │
│       │       │
└───────┴───────┘
```

## Accesibilidad

```
Teclado:
- Tab: Navegar entre instancias
- Shift+F10 o Menú: Abrir menú contextual
- Flechas: Navegar opciones del menú
- Enter: Seleccionar opción
- Escape: Cerrar menú

Screen Reader:
"Instancia local: Mi Instancia Local
 Minecraft versión 1.20.1
 Presione Menú para ver opciones"
```

## Flujo de Error

```
┌─────────────────────────────────────┐
│  ❌ Error al exportar instancia     │
│                                     │
│  No se pudo crear el archivo        │
│  .mrpack. Posibles causas:          │
│  • Espacio insuficiente             │
│  • Permisos de escritura            │
│  • Ruta inválida                    │
│                                     │
│  Por favor, intente nuevamente      │
│  o contacte soporte.                │
│                                     │
│                          [Cerrar]   │
└─────────────────────────────────────┘
```

## Estilos Aplicados

```css
/* Context Menu Item */
.hover:bg-neutral-800
.focus:bg-neutral-800
.cursor-pointer

/* Badge Local */
.bg-blue-100
.text-blue-600

/* Badge Modpack */
.bg-orange-100
.text-orange-600

/* Export Icon */
.mr-2
.h-4
.w-4
```

## Notas de Diseño

1. **Consistencia**: El estilo del nuevo menú item coincide con los existentes
2. **Visibilidad**: Solo visible para instancias locales (condicional)
3. **Iconografía**: Usa LucideUpload para representar exportación
4. **Feedback**: Muestra progreso en tiempo real
5. **Accesibilidad**: Navegable por teclado y compatible con screen readers

---

**Nota**: Estos mockups son representaciones de cómo se ve la funcionalidad.
El diseño final puede variar ligeramente según el tema activo en ModpackStore.
