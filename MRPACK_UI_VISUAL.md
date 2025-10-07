# .mrpack Import UI - Visual Structure

## My Instances Section

```
┌─────────────────────────────────────────────────────────────┐
│  Mis instancias                                             │
│  Aquí puedes ver y gestionar todas tus instancias...       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐       │
│  │Instance │  │Instance │  │  [+]    │  │  [↓]    │       │
│  │  Card   │  │  Card   │  │ Nueva   │  │Importar │       │
│  │         │  │         │  │Instancia│  │.mrpack  │       │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘       │
│                                           👆 NEW!          │
│                                                             │
│  (Drag .mrpack file anywhere in this section)              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Drag-and-Drop Overlay

When dragging a .mrpack file over the section:

```
┌─────────────────────────────────────────────────────────────┐
│  ╔═══════════════════════════════════════════════════════╗  │
│  ║                                                       ║  │
│  ║          [Purple semi-transparent overlay]           ║  │
│  ║                                                       ║  │
│  ║          ┌─────────────────────────┐                 ║  │
│  ║          │                         │                 ║  │
│  ║          │    📦 (Purple Icon)     │                 ║  │
│  ║          │                         │                 ║  │
│  ║          │  Suelta el archivo      │                 ║  │
│  ║          │    .mrpack aquí         │                 ║  │
│  ║          │                         │                 ║  │
│  ║          └─────────────────────────┘                 ║  │
│  ║                                                       ║  │
│  ╚═══════════════════════════════════════════════════════╝  │
└─────────────────────────────────────────────────────────────┘
```

## Import Dialog - Initial State

```
┌───────────────────────────────────────────────────────┐
│  Importar Modpack de Modrinth                         │
│  (Purple gradient title)                              │
│  Selecciona un archivo .mrpack para crear una nueva   │
│  instancia                                            │
├───────────────────────────────────────────────────────┤
│                                                       │
│  ┌─────────────────────────────────────────────────┐ │
│  │    Seleccionar archivo .mrpack                  │ │
│  └─────────────────────────────────────────────────┘ │
│                                                       │
│                                                       │
│              [ Cancelar ]                             │
└───────────────────────────────────────────────────────┘
```

## Import Dialog - After File Selection (Compatible)

```
┌───────────────────────────────────────────────────────────┐
│  Importar Modpack de Modrinth                             │
│  Selecciona un archivo .mrpack para crear una nueva...   │
├───────────────────────────────────────────────────────────┤
│                                                           │
│  Archivo seleccionado                                     │
│  /path/to/modpack.mrpack                                  │
│                                                           │
│  ┌──────────────────┬──────────────────┐                 │
│  │ Modpack          │ Versión          │                 │
│  │ Example Pack     │ 1.0.0            │                 │
│  ├──────────────────┼──────────────────┤                 │
│  │ Minecraft        │ Loader           │                 │
│  │ 1.20.1           │ forge            │                 │
│  └──────────────────┴──────────────────┘                 │
│                                                           │
│  Descripción                                              │
│  A great modpack for Minecraft...                        │
│                                                           │
│  Archivos                                                 │
│  150 mod(s)                                               │
│                                                           │
│  ┌────────────────────────────────────────────────────┐  │
│  │ ✓ Compatible                              [Green]  │  │
│  │ Este modpack es compatible con ModpackStore        │  │
│  └────────────────────────────────────────────────────┘  │
│                                                           │
│  Nombre de la instancia                                   │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Example Pack                                       │  │
│  └────────────────────────────────────────────────────┘  │
│                                                           │
│              [ Cancelar ]  [ 📦 Instalar ]                │
└───────────────────────────────────────────────────────────┘
```

## Import Dialog - After File Selection (Incompatible)

```
┌───────────────────────────────────────────────────────────┐
│  Importar Modpack de Modrinth                             │
│  Selecciona un archivo .mrpack para crear una nueva...   │
├───────────────────────────────────────────────────────────┤
│                                                           │
│  Archivo seleccionado                                     │
│  /path/to/fabric-modpack.mrpack                           │
│                                                           │
│  ┌──────────────────┬──────────────────┐                 │
│  │ Modpack          │ Versión          │                 │
│  │ Fabric Pack      │ 1.0.0            │                 │
│  ├──────────────────┼──────────────────┤                 │
│  │ Minecraft        │ Loader           │                 │
│  │ 1.20.1           │ fabric           │                 │
│  └──────────────────┴──────────────────┘                 │
│                                                           │
│  Archivos                                                 │
│  75 mod(s)                                                │
│                                                           │
│  ┌────────────────────────────────────────────────────┐  │
│  │ ⚠ Errores                                  [Red]    │  │
│  │ • Solo se admite Forge actualmente. Fabric,        │  │
│  │   Quilt y NeoForge no están soportados todavía.    │  │
│  └────────────────────────────────────────────────────┘  │
│                                                           │
│  Nombre de la instancia                                   │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Fabric Pack                        [Disabled]      │  │
│  └────────────────────────────────────────────────────┘  │
│                                                           │
│              [ Cancelar ]  [ Instalar (Disabled) ]        │
└───────────────────────────────────────────────────────────┘
```

## Import Dialog - With Optional Mods Warning

```
┌───────────────────────────────────────────────────────────┐
│  Importar Modpack de Modrinth                             │
│  Selecciona un archivo .mrpack para crear una nueva...   │
├───────────────────────────────────────────────────────────┤
│                                                           │
│  [... manifest info ...]                                  │
│                                                           │
│  ┌────────────────────────────────────────────────────┐  │
│  │ ⚠ Advertencias                         [Yellow]    │  │
│  │ • Este modpack tiene 5 mod(s) opcional(es) que     │  │
│  │   puedes habilitar o deshabilitar durante la       │  │
│  │   instalación.                                      │  │
│  └────────────────────────────────────────────────────┘  │
│                                                           │
│  ┌────────────────────────────────────────────────────┐  │
│  │ ✓ Compatible                              [Green]  │  │
│  │ Este modpack es compatible con ModpackStore        │  │
│  └────────────────────────────────────────────────────┘  │
│                                                           │
│  [... instance name input ...]                            │
│                                                           │
│              [ Cancelar ]  [ 📦 Instalar ]                │
└───────────────────────────────────────────────────────────┘
```

## Color Scheme

### Import Button (in My Instances)
- **Idle**: Gray border, gray icon
- **Hover**: Purple border, purple icon and text
- **Theme**: Purple (`#9f4eff` to `#542fff`)

### Dialog States
- **Compatible** (Green): `bg-green-900/20 border-green-700/50`
- **Warning** (Yellow): `bg-yellow-900/20 border-yellow-700/50`
- **Error** (Red): `bg-red-900/20 border-red-700/50`

### Drag Overlay
- **Background**: `bg-purple-500/20 backdrop-blur-sm`
- **Border**: `border-purple-400 border-dashed`
- **Icon/Text**: `text-purple-300/400`

## User Flows

### Flow 1: Button Click Import
```
User clicks "Importar .mrpack" button
    ↓
File picker dialog opens (.mrpack filter)
    ↓
User selects file
    ↓
Tauri validates file and reads manifest
    ↓
Dialog shows manifest info
    ↓
Tauri checks compatibility
    ↓
Dialog shows compatibility status
    ↓
User enters instance name (or uses default)
    ↓
User clicks "Instalar"
    ↓
[Future: Instance creation process]
```

### Flow 2: Drag-and-Drop Import
```
User drags .mrpack file over window
    ↓
Section highlights with purple overlay
    ↓
User drops file
    ↓
System validates file type
    ↓
Tauri validates and reads manifest
    ↓
Tauri checks compatibility
    ↓
Toast notification shows result
    ↓
[Future: Auto-open import dialog or create instance]
```

## Keyboard/Accessibility

- **Tab Navigation**: All interactive elements are keyboard accessible
- **Escape Key**: Closes dialog
- **Enter Key**: Submits form (when enabled)
- **ARIA Labels**: Proper labels for screen readers
- **Focus Management**: Dialog traps focus when open

## Responsive Design

- **Desktop**: 600px max width dialog
- **Mobile**: Full width dialog with scrolling
- **Grid**: 2 columns for manifest info on desktop, 1 column on mobile

## Icons Used

| Icon | Purpose | Component |
|------|---------|-----------|
| `Import` | Import button | ImportMrpackDialog trigger |
| `PackageOpen` | Drag overlay | MyInstancesSection drag state |
| `AlertCircle` | Warning/Error alerts | Compatibility messages |
| `Check` | Success alert | Compatible indicator |
| `Loader2` | Loading state | Import in progress |
| `Package` | Install button | Final install action |
