# Sistema de Características Premium

Este sistema utiliza **CustomEvents** para mostrar un diálogo global cuando un usuario intenta acceder a una característica que requiere ModpackStore+.

## Componentes

### 1. `PremiumFeatureDialog.tsx`
Componente global que escucha eventos de solicitud de características premium y muestra un diálogo informativo con:
- Descripción de la característica solicitada
- Lista de todos los beneficios de ModpackStore+
- Botón para actualizar a premium
- Diseño atractivo con gradientes y animaciones

### 2. `utils/premiumFeatures.ts`
Utilidad para disparar eventos de solicitud de características premium desde cualquier parte de la aplicación.

## Uso

### 1. Añadir el componente global en App.tsx

```tsx
import { PremiumFeatureDialog } from "./components/PremiumFeatureDialog";

function App() {
  return (
    <>
      {/* ... otros componentes ... */}
      <PremiumFeatureDialog />
    </>
  );
}
```

### 2. Disparar el evento desde cualquier componente

```tsx
import { requestPremiumFeature } from "@/utils/premiumFeatures";

// En tu componente o función
const handlePremiumFeature = () => {
  if (!userHasPremium) {
    requestPremiumFeature(
      'Nombre de la Característica',
      'Descripción detallada de lo que hace esta característica premium.'
    );
    return;
  }
  
  // Continuar con la lógica de la característica
};
```

## Ejemplos de Uso Implementados

### InstanceCard.tsx
```tsx
// Gestor de Mods
if (!flags.allow_mod_manager) {
  requestPremiumFeature(
    'Gestor de Mods Avanzado',
    'Administra, habilita y deshabilita tus mods fácilmente. Organiza tus mods por categorías y mantén tu instalación limpia y optimizada.'
  );
  return;
}

// Descargador de Mods
if (!flags.enable_instance_mod_downloader) {
  requestPremiumFeature(
    'Descargador de Mods',
    'Busca y descarga mods desde Modrinth y CurseForge directamente en tu instancia. Encuentra los mejores mods sin salir de la aplicación.'
  );
  return;
}
```

### ThemeSelector.tsx
```tsx
if (theme.isPremium && !canAccessPremium) {
  requestPremiumFeature(
    'Temas Premium',
    'Personaliza tu experiencia con temas exclusivos diseñados para ModpackStore+. Accede a una colección de temas premium y transforma la apariencia de tu aplicación.'
  );
  return;
}
```

## Ventajas de este Sistema

1. **Sin Estado Global**: Usa CustomEvents nativos del navegador, evitando la complejidad de Context API o estado global
2. **Desacoplado**: Los componentes no necesitan importar el diálogo directamente
3. **Centralizado**: Un solo diálogo maneja todas las solicitudes de características premium
4. **Reutilizable**: Fácil de usar desde cualquier componente con una sola línea
5. **Consistente**: Experiencia de usuario uniforme en toda la aplicación
6. **Informativo**: Muestra todos los beneficios de premium, no solo un mensaje de error

## Características del Diálogo

- ✅ Diseño atractivo con gradientes purple/pink
- ✅ Icono de corona con efectos de brillo
- ✅ Descripción de la característica específica solicitada
- ✅ Lista completa de beneficios de ModpackStore+
- ✅ Animaciones suaves
- ✅ Botones de acción claros
- ✅ Precio visible
- ✅ Responsive y accesible

## Personalización

Para añadir más beneficios premium, edita el array `PREMIUM_FEATURES` en `PremiumFeatureDialog.tsx`:

```tsx
const PREMIUM_FEATURES: PremiumFeature[] = [
  {
    title: "Nueva Característica",
    description: "Descripción de la nueva característica",
    icon: <LucideCheck className="w-4 h-4" />
  },
  // ... más características
];
```

## Flujo de Trabajo

1. Usuario intenta usar una característica premium
2. El código verifica si tiene acceso (flags, permisos, etc.)
3. Si no tiene acceso, se llama a `requestPremiumFeature()`
4. Se dispara un CustomEvent global
5. `PremiumFeatureDialog` escucha el evento y se abre
6. Usuario ve información completa sobre premium
7. Usuario puede cerrar o proceder a actualizar

## Migración desde Toast

**Antes:**
```tsx
if (!hasPremium) {
  toast.error('Esta función requiere ModpackStore+');
  return;
}
```

**Después:**
```tsx
if (!hasPremium) {
  requestPremiumFeature(
    'Nombre de la Característica',
    'Descripción detallada de la característica'
  );
  return;
}
```
