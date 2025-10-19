# Guía de Testing - Refactorización de Modloaders

Esta guía describe cómo probar la refactorización del sistema de bootstrap de modloaders.

## Pre-requisitos

1. Sistema operativo soportado (Windows, Linux, macOS)
2. Rust toolchain instalado
3. Dependencias del sistema para Tauri
4. Cuenta de Microsoft para testing de autenticación

## Compilación

```bash
cd application/src-tauri
cargo build --release
```

## Tests Manuales Requeridos

### 1. Bootstrap de Instancia Vanilla ✓

**Objetivo:** Verificar que la instalación base de Minecraft funciona correctamente.

**Pasos:**
1. Abrir la aplicación
2. Crear nueva instancia
3. Seleccionar versión Vanilla (ej: 1.20.1)
4. Iniciar bootstrap
5. Verificar que se descarguen:
   - JAR del cliente
   - Librerías
   - Assets
   - Natives

**Resultado Esperado:**
- ✅ Descarga completada sin errores
- ✅ Directorio `minecraft/` creado
- ✅ Todos los assets validados
- ✅ Java detectado/instalado

**Logs a Verificar:**
```
[Instance: xxx] Starting Vanilla bootstrap
[Instance: xxx] Downloading version manifest
[Instance: xxx] Downloading libraries
[Instance: xxx] Validating assets
[Instance: xxx] Bootstrap completed successfully
```

---

### 2. Bootstrap de Instancia Forge ✓

**Objetivo:** Verificar que la nueva implementación de `ForgeInstaller` funciona correctamente.

**Pasos:**
1. Crear nueva instancia
2. Seleccionar Minecraft 1.20.1
3. Seleccionar Forge 47.2.0 (o versión disponible)
4. Iniciar bootstrap
5. Verificar:
   - Descarga del instalador de Forge
   - Ejecución del instalador
   - Creación del perfil de Forge

**Resultado Esperado:**
- ✅ Base Vanilla instalada correctamente
- ✅ Instalador de Forge descargado
- ✅ Instalador ejecutado con éxito
- ✅ Directorio `versions/1.20.1-forge-47.2.0/` creado
- ✅ Archivo JSON de versión generado

**Logs a Verificar:**
```
[Instance: xxx] Installing Forge 47.2.0 for Minecraft 1.20.1
[Instance: xxx] Downloading Forge installer from: ...
[Instance: xxx] Attempting Forge installation with 3 options
[Instance: xxx] Executing Forge installer with option '--installClient'
[Instance: xxx] Forge installation completed successfully using option '--installClient'
[Instance: xxx] Forge installation completed successfully
```

**Errores Comunes:**
- ❌ "No se especificó versión de Forge" → Verificar que forgeVersion está configurado
- ❌ "Java path is not set" → Configurar Java en settings
- ❌ "All Forge installation methods failed" → Verificar conectividad y versión de Java

---

### 3. Bootstrap de Instancia Fabric ✓

**Objetivo:** Verificar que `FabricInstaller` implementa correctamente el trait.

**Pasos:**
1. Crear nueva instancia
2. Seleccionar Minecraft 1.20.1
3. Seleccionar Fabric 0.15.0
4. Iniciar bootstrap

**Resultado Esperado:**
- ✅ Base Vanilla instalada
- ✅ Perfil de Fabric descargado
- ✅ Directorio `versions/fabric-loader-0.15.0-1.20.1/` creado
- ✅ JSON de versión con `inheritsFrom` correcto

**Logs a Verificar:**
```
[Instance: xxx] Installing Fabric 0.15.0 for Minecraft 1.20.1
[Instance: xxx] Fetching Fabric profile from: https://meta.fabricmc.net/...
[Instance: xxx] Fabric installation completed successfully
```

---

### 4. Bootstrap de Instancia NeoForge ✓

**Objetivo:** Verificar que `NeoForgeInstaller` implementa correctamente el trait.

**Pasos:**
1. Crear nueva instancia
2. Seleccionar Minecraft 1.20.1
3. Seleccionar NeoForge 20.4.80
4. Iniciar bootstrap

**Resultado Esperado:**
- ✅ Base Vanilla instalada
- ✅ Instalador de NeoForge descargado
- ✅ Instalador ejecutado
- ✅ Directorio `versions/neoforge-20.4.80/` creado

**Logs a Verificar:**
```
[Instance: xxx] Installing NeoForge 20.4.80 for Minecraft 1.20.1
[Instance: xxx] Downloading NeoForge installer from: ...
[Instance: xxx] Running NeoForge installer
[Instance: xxx] NeoForge installer completed successfully
```

---

### 5. Bootstrap de Instancia Quilt ✓

**Objetivo:** Verificar que `QuiltInstaller` implementa correctamente el trait.

**Pasos:**
1. Crear nueva instancia
2. Seleccionar Minecraft 1.20.1
3. Seleccionar Quilt 0.24.0
4. Iniciar bootstrap

**Resultado Esperado:**
- ✅ Base Vanilla instalada
- ✅ Perfil de Quilt descargado
- ✅ Directorio `versions/quilt-loader-0.24.0-1.20.1/` creado
- ✅ JSON de versión con librerías de Quilt

**Logs a Verificar:**
```
[Instance: xxx] Installing Quilt 0.24.0 for Minecraft 1.20.1
[Instance: xxx] Fetching Quilt profile from: https://meta.quiltmc.org/...
[Instance: xxx] Quilt installation completed successfully
```

---

## Tests de Regresión

### 6. Instancias Existentes ✓

**Objetivo:** Verificar que instancias previamente creadas siguen funcionando.

**Pasos:**
1. Abrir instancia creada con versión anterior del código
2. Intentar lanzar
3. Verificar que no hay errores

**Resultado Esperado:**
- ✅ Instancia se carga sin errores
- ✅ Puede ser lanzada normalmente
- ✅ Mods cargan correctamente (si aplica)

---

### 7. Actualización de Instancias ✓

**Objetivo:** Verificar que la actualización de instancias funciona.

**Pasos:**
1. Crear instancia con Forge 47.1.0
2. Actualizar a Forge 47.2.0
3. Verificar que el proceso completa correctamente

**Resultado Esperado:**
- ✅ Nueva versión descargada
- ✅ Perfil actualizado
- ✅ Instancia funcional

---

## Tests de Error Handling

### 8. Error: Sin Conexión a Internet ❌

**Pasos:**
1. Deshabilitar red
2. Intentar crear instancia
3. Verificar manejo de error

**Resultado Esperado:**
- ✅ Error mostrado al usuario
- ✅ Mensaje descriptivo
- ✅ Sugerencia de solución
- ✅ No crash de la aplicación

### 9. Error: Java No Configurado ❌

**Pasos:**
1. Limpiar configuración de Java
2. Intentar crear instancia Forge
3. Verificar manejo de error

**Resultado Esperado:**
- ✅ Error: "Java path is not set in configuration"
- ✅ Sugerencia: "Ve a Configuración → Java"
- ✅ No crash

### 10. Error: Versión Inválida ❌

**Pasos:**
1. Intentar crear instancia con versión no existente
2. Verificar manejo de error

**Resultado Esperado:**
- ✅ Error descriptivo
- ✅ No crash

---

## Tests de Performance

### 11. Tiempo de Bootstrap ⏱️

**Objetivo:** Verificar que no hay regresión en performance.

**Pasos:**
1. Medir tiempo de bootstrap antes de refactorización
2. Medir tiempo de bootstrap después
3. Comparar

**Resultado Esperado:**
- ✅ Tiempo similar o mejorado
- ✅ Sin bloqueos de UI

---

## Checklist de Validación

Antes de marcar el issue como completo, verificar:

- [ ] ✅ Todas las instancias Vanilla se crean correctamente
- [ ] ✅ Todas las instancias Forge se crean correctamente
- [ ] ✅ Todas las instancias Fabric se crean correctamente
- [ ] ✅ Todas las instancias NeoForge se crean correctamente
- [ ] ✅ Todas las instancias Quilt se crean correctamente
- [ ] ✅ Instancias existentes siguen funcionando
- [ ] ✅ Errores se manejan correctamente
- [ ] ✅ No hay regresión en performance
- [ ] ✅ Logs son claros y descriptivos
- [ ] ✅ Documentación está actualizada

---

## Reportar Problemas

Si encuentras algún problema durante el testing, reporta:

1. **Descripción del problema**
2. **Pasos para reproducir**
3. **Logs relevantes** (buscar en logs de la aplicación)
4. **Sistema operativo y versión**
5. **Versiones de Minecraft/Modloader intentadas**

### Ejemplo de Reporte

```
Problema: Forge installer falla con Java 21
Pasos: 
1. Configurar Java 21
2. Crear instancia Forge 47.2.0
3. Bootstrap falla

Logs:
[Instance: xxx] Forge installer failed - exit code: 1
stderr: "Error: JavaVersionNotSupported"

Sistema: Windows 11
Java: OpenJDK 21.0.1
MC: 1.20.1
Forge: 47.2.0
```

---

## Conclusión

Esta guía cubre los tests críticos para validar la refactorización. Todos los tests deben pasar antes de considerar el trabajo completo.

**Tiempo Estimado de Testing:** 2-3 horas
**Prioridad de Tests:** Alta (Tests 1-5), Media (Tests 6-7), Baja (Tests 8-11)
