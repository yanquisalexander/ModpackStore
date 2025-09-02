# Sistema de Onboarding - Implementación

## Descripción

Se ha implementado un sistema completo de onboarding que se muestra automáticamente la primera vez que el usuario abre la aplicación. El sistema está diseñado para ser extensible y permite configurar la memoria RAM asignada a Minecraft como primer paso.

## Funcionalidades Implementadas

### Backend (Rust)

1. **Dependencias añadidas**:
   - `sysinfo = "0.31"` para obtener información del sistema

2. **Comandos Tauri**:
   - `get_onboarding_status()` - Retorna el estado del onboarding (firstRunAt, ramAllocation)
   - `get_system_memory()` - Obtiene información de memoria del sistema
   - `complete_onboarding(ramAllocation)` - Completa el onboarding guardando la configuración
   - `skip_onboarding()` - Omite el onboarding usando valores recomendados

3. **Configuración**:
   - Campos añadidos al esquema: `firstRunAt` y `ramAllocation`
   - Compatibilidad con el campo legacy `memory`

### Frontend (React)

1. **Componentes**:
   - `OnboardingFlow` - Componente principal que maneja el flujo
   - `OnboardingStepWrapper` - Wrapper común para todos los pasos
   - `RAMConfigurationStep` - Paso específico para configuración de RAM

2. **Hook personalizado**:
   - `useOnboarding` - Hook para gestionar el estado del onboarding

3. **Tipos TypeScript**:
   - Definiciones completas para todas las interfaces

## Arquitectura

### Flujo de Datos

1. **Primera ejecución**:
   - `useOnboarding` verifica si `firstRunAt` es null
   - Si es primera ejecución, App.tsx muestra `OnboardingFlow`
   - El usuario completa la configuración de RAM
   - Se guarda la configuración y `firstRunAt`

2. **Ejecuciones posteriores**:
   - `firstRunAt` tiene valor, no se muestra onboarding
   - La aplicación continúa normalmente

### Extensibilidad

El sistema está diseñado para ser fácilmente extensible:

```typescript
// Añadir nuevos pasos en OnboardingFlow.tsx
const steps: OnboardingStep[] = [
  {
    id: 'ram-configuration',
    title: 'Configuración de RAM',
    component: RAMConfigurationStep,
  },
  // Nuevos pasos aquí
  {
    id: 'java-configuration',
    title: 'Configuración de Java',
    component: JavaConfigurationStep,
  },
];
```

## Características

### RAM Configuration Step

- **Detección automática** de memoria del sistema
- **Valores recomendados** calculados automáticamente
- **Slider interactivo** con límites mínimos y máximos
- **Recomendaciones** contextuales para el usuario
- **Fallback graceful** si falla la detección del sistema

### UX/UI

- **Pantalla completa** con fondo gradient atractivo
- **Loading states** durante operaciones asíncronas
- **Error handling** con mensajes informativos
- **Toast notifications** para feedback al usuario
- **Opción de omitir** que usa valores recomendados

## Configuración de Memoria

- **Mínimo**: 2 GB
- **Máximo**: min(mitad de RAM física, 12 GB)
- **Recomendado**: min(4 GB, 30% de RAM total)
- **Incrementos**: 256 MB

## Integración

El onboarding se integra automáticamente en el flujo principal de la aplicación:

1. Se verifica el estado antes de mostrar cualquier otra pantalla
2. No interfiere con funcionalidades existentes
3. Mantiene compatibilidad con configuraciones previas

## Testing

- Fallback graceful para entornos sin Tauri
- Componentes funcionales en modo demo
- Build exitoso sin dependencias nativas