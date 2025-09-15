# Plan de Pruebas - Optimización del Botón "Jugar ahora"

## Escenarios de Prueba

### 1. Modpack Actualizado (Flujo Optimizado)
**Precondiciones:**
- Modpack ya instalado
- Versión local coincide con la última versión disponible
- `lastKnownVersion` === `latestVersion`

**Pasos:**
1. Presionar "Jugar ahora"
2. Verificar mensaje: "Verificando estado del modpack..."
3. Verificar mensaje: "Validando archivos..."
4. Verificar lanzamiento exitoso

**Resultado Esperado:**
- Tiempo total: < 10 segundos
- Stages: `CheckingModpackStatus` → `LightweightValidation` → Launch
- Sin descargas innecesarias

### 2. Modpack Desactualizado (Flujo Completo)
**Precondiciones:**
- Modpack instalado con versión anterior
- `lastKnownVersion` !== `latestVersion`

**Pasos:**
1. Presionar "Jugar ahora"
2. Verificar mensaje: "Verificando estado del modpack..."
3. Verificar mensaje: "Actualizando modpack..."
4. Verificar mensaje: "Descargando archivos del modpack..."
5. Verificar mensaje: "Validando assets..."
6. Verificar lanzamiento exitoso

**Resultado Esperado:**
- Tiempo total: Variable según tamaño de actualización
- Stages: `CheckingModpackStatus` → `DownloadingModpackFiles` → `ValidatingAssets` → Launch
- Actualización completa realizada

### 3. Primera Instalación con "latest"
**Precondiciones:**
- Modpack con `modpackVersionId` = "latest"
- Sin `lastKnownVersion` almacenada

**Pasos:**
1. Presionar "Jugar ahora"
2. Verificar flujo completo de actualización

**Resultado Esperado:**
- Comportamiento idéntico al escenario 2
- `lastKnownVersion` se establece después del proceso

### 4. Versión Específica (No "latest")
**Precondiciones:**
- Modpack con `modpackVersionId` específica (ej: "v1.2.1")

**Pasos:**
1. Presionar "Jugar ahora"
2. Verificar validación ligera directa

**Resultado Esperado:**
- Sin verificación de actualizaciones
- Directamente a validación ligera
- Tiempo mínimo de espera

## Casos de Error

### 1. Conexión a Internet Perdida
**Escenario:** Verificación de estado falla
**Resultado Esperado:** Continuar con validación ligera (modo offline)

### 2. Archivos Críticos Faltantes
**Escenario:** Validación ligera detecta problemas
**Resultado Esperado:** Error claro, no lanzar el juego

### 3. Modpack Protegido por Contraseña
**Escenario:** Modpack requiere autenticación
**Resultado Esperado:** Mantener flujo de validación existente

## Métricas de Rendimiento

### Tiempo de Respuesta
- **Modpack Actualizado:** 2-8 segundos
- **Modpack Desactualizado:** Variable (depende del tamaño)
- **Mejora Esperada:** 70-90% para casos optimizados

### Uso de Recursos
- **Modpack Actualizado:** Mínimo uso de red y CPU
- **Modpack Desactualizado:** Uso completo según necesidad

### Experiencia de Usuario
- Mensajes claros y específicos
- Feedback inmediato sobre el proceso
- Sin bloqueos innecesarios

## Verificación de Compatibilidad

### Versiones de Minecraft
- [ ] Vanilla 1.20+
- [ ] Forge 1.20+
- [ ] Versiones anteriores soportadas

### Tipos de Modpack
- [ ] Modpacks públicos
- [ ] Modpacks protegidos por contraseña
- [ ] Modpacks de suscripción Twitch
- [ ] Modpacks pagos

### Plataformas
- [ ] Windows
- [ ] Linux 
- [ ] macOS

## Checklist de Validación

### Funcionalidad Core
- [ ] Verificación de estado funciona correctamente
- [ ] Validación ligera detecta problemas críticos
- [ ] Flujo completo se ejecuta cuando es necesario
- [ ] Lanzamiento exitoso en ambos casos

### Interfaz de Usuario
- [ ] Mensajes de stage correctos
- [ ] Progreso visible para el usuario
- [ ] Botón "Jugar ahora" se actualiza apropiadamente
- [ ] Loading indicators funcionan

### Robustez
- [ ] Manejo de errores graceful
- [ ] Fallback a validación completa cuando es necesario
- [ ] No rompe funcionalidad existente
- [ ] Mantiene compatibilidad hacia atrás

## Comandos de Prueba

```bash
# Construir aplicación
cd application && npm run build

# Ejecutar en modo development
npm run dev

# Verificar TypeScript
npx tsc --noEmit

# Verificar linting
npm run lint (si existe)
```

## Notas de Implementación

1. **Verificación sin Descarga:** `check_modpack_is_up_to_date` solo consulta API, no descarga
2. **Validación Ligera:** `perform_lightweight_asset_validation` verifica existencia, no integridad completa
3. **Fallback Graceful:** Errores de red no bloquean el lanzamiento
4. **Stage Reporting:** Nuevos stages reportan progreso específico al frontend