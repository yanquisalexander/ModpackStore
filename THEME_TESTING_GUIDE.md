# Manual de Prueba del Sistema de Temas

Esta guía te ayudará a probar todas las funcionalidades del sistema de temas de ModpackStore.

## Pre-requisitos

1. Tener ModpackStore compilado y en ejecución
2. Tener una cuenta de usuario (opcional para algunas pruebas)
3. Acceso a los archivos de configuración del sistema

## Pruebas Básicas

### ✅ Prueba 1: Tema por Defecto

**Objetivo:** Verificar que la aplicación inicia con el tema "dark" por defecto.

**Pasos:**
1. Limpia la configuración existente:
   - Windows: Elimina `%LOCALAPPDATA%\dev.alexitoo.modpackstore\config.json`
   - macOS: Elimina `~/Library/Application Support/dev.alexitoo.modpackstore/config.json`
   - Linux: Elimina `~/.local/share/dev.alexitoo.modpackstore/config.json`
2. Inicia ModpackStore
3. Verifica que la aplicación use colores oscuros

**Resultado Esperado:**
- La aplicación debe usar el tema dark
- El fondo debe ser oscuro (casi negro)
- El texto debe ser claro (blanco/gris claro)

---

### ✅ Prueba 2: Cambio de Tema Básico

**Objetivo:** Verificar que se pueden cambiar los temas gratuitos.

**Pasos:**
1. Abre la Configuración (Ctrl/Cmd + ,) o haz clic en el ícono ⚙️
2. Navega a la sección "Temas"
3. Observa los temas disponibles (dark, ice, dark-knight, sunset)
4. Selecciona el tema "Ice"
5. Observa el cambio inmediato de colores

**Resultado Esperado:**
- El tema debe cambiar inmediatamente al hacer clic
- Los colores deben cambiar a tonos azules fríos
- Debe aparecer un mensaje de éxito (toast)

**Repetir con:**
- Tema "Dark Knight" (tonos púrpura muy oscuros)
- Tema "Dark" (volver al original)

---

### ✅ Prueba 3: Persistencia de Tema

**Objetivo:** Verificar que la selección de tema persiste entre sesiones.

**Pasos:**
1. Selecciona el tema "Ice"
2. Cierra completamente ModpackStore
3. Abre de nuevo ModpackStore
4. Verifica que el tema Ice sigue aplicado

**Resultado Esperado:**
- Al abrir la aplicación, debe cargar automáticamente el tema Ice
- No debe haber "flash" de tema incorrecto al iniciar

---

### ✅ Prueba 4: Tema Premium Sin Suscripción

**Objetivo:** Verificar que los temas premium están bloqueados para usuarios sin Modpack Store+.

**Pasos:**
1. Asegúrate de NO tener una suscripción activa a Modpack Store+
2. Asegúrate de NO ser administrador
3. Abre la Configuración → Temas
4. Busca el tema "Sunset"
5. Observa el icono de candado 🔒
6. Intenta hacer clic en él

**Resultado Esperado:**
- El tema debe mostrar un icono de candado
- Debe mostrar el texto "Modpack Store+ requerido"
- Al hacer clic, debe aparecer un error: "Este tema requiere Modpack Store+"
- El tema NO debe aplicarse

---

### ✅ Prueba 5: Tema Premium Como Admin

**Objetivo:** Verificar que los administradores tienen acceso a todos los temas.

**Pasos:**
1. Inicia sesión como administrador o superadministrador
2. Abre la Configuración → Temas
3. Busca el tema "Sunset"
4. Verifica que NO hay candado
5. Haz clic en el tema

**Resultado Esperado:**
- El tema NO debe mostrar candado para admins
- Debe aplicarse correctamente con tonos cálidos (naranjas/rojos)
- Debe aparecer mensaje de éxito

---

## Pruebas de Temas Externos

### ✅ Prueba 6: Carpeta de Temas Externa

**Objetivo:** Verificar que se puede abrir la carpeta de temas.

**Pasos:**
1. Abre la Configuración → Temas
2. Haz clic en el botón "Abrir carpeta de temas"
3. Verifica que se abre el explorador de archivos

**Resultado Esperado:**
- Se debe abrir el explorador en la carpeta correcta:
  - Windows: `%LOCALAPPDATA%\dev.alexitoo.modpackstore\themes\`
  - macOS: `~/Library/Application Support/dev.alexitoo.modpackstore/themes/`
  - Linux: `~/.local/share/dev.alexitoo.modpackstore/themes/`

---

### ✅ Prueba 7: Cargar Tema Externo

**Objetivo:** Verificar que se pueden cargar temas externos.

**Pasos:**
1. Abre la carpeta de temas (ver Prueba 6)
2. Crea una nueva carpeta llamada `cyberpunk-neon`
3. Dentro, crea un archivo `theme.json` con este contenido:
```json
{
  "id": "cyberpunk-neon",
  "name": "Cyberpunk Neon",
  "description": "Tema de prueba con colores neón",
  "author": "Tester",
  "version": "1.0.0",
  "isPremium": false,
  "colors": {
    "background": "oklch(0.10 0.04 280)",
    "foreground": "oklch(0.95 0.02 320)",
    "primary": "oklch(0.70 0.28 320)",
    "primaryForeground": "oklch(0.10 0.04 280)"
  }
}
```
4. Reinicia ModpackStore o recarga los temas
5. Abre Configuración → Temas
6. Busca "Cyberpunk Neon" en la lista
7. Verifica que tiene la etiqueta "Externo"
8. Selecciónalo

**Resultado Esperado:**
- El tema debe aparecer en la lista con etiqueta "Externo"
- Debe mostrar autor "Tester"
- Al aplicarlo, los colores deben cambiar a tonos magenta brillantes
- Debe funcionar correctamente

---

### ✅ Prueba 8: Tema Externo Inválido

**Objetivo:** Verificar que los temas mal formados no rompen la aplicación.

**Pasos:**
1. En la carpeta de temas, crea `tema-invalido/theme.json`:
```json
{
  "id": "invalid",
  "name": "Invalid"
}
```
2. Reinicia ModpackStore
3. Abre Configuración → Temas
4. Verifica que la aplicación NO se rompe
5. El tema inválido NO debe aparecer en la lista

**Resultado Esperado:**
- La aplicación debe seguir funcionando
- Puede haber un warning en la consola (esperado)
- Los otros temas deben seguir funcionando normalmente

---

## Pruebas Avanzadas

### ✅ Prueba 9: Tema con Imagen de Fondo

**Objetivo:** Verificar el soporte de imágenes de fondo.

**Pasos:**
1. Descarga una imagen de prueba (1920x1080)
2. En la carpeta de temas, crea `tema-bg/`
3. Coloca la imagen como `tema-bg/background.jpg`
4. Crea `tema-bg/theme.json`:
```json
{
  "id": "tema-background",
  "name": "Tema con Fondo",
  "description": "Tema con imagen de fondo",
  "author": "Tester",
  "version": "1.0.0",
  "colors": {
    "background": "oklch(0.15 0 0 / 80%)",
    "foreground": "oklch(0.95 0 0)"
  },
  "backgroundImage": "background.jpg"
}
```
5. Reinicia y selecciona el tema

**Resultado Esperado:**
- La imagen debe aparecer como fondo
- El fondo debe tener ligera transparencia (80%)
- El texto debe ser legible sobre el fondo

---

### ✅ Prueba 10: Propiedades CSS Personalizadas

**Objetivo:** Verificar que las propiedades CSS personalizadas funcionan.

**Pasos:**
1. Crea un tema con customProperties:
```json
{
  "id": "custom-props",
  "name": "Custom Props Test",
  "description": "Prueba de propiedades custom",
  "author": "Tester",
  "version": "1.0.0",
  "colors": {
    "background": "oklch(0.15 0 0)",
    "foreground": "oklch(0.95 0 0)"
  },
  "customProperties": {
    "test-color": "#ff00ff",
    "test-gradient": "linear-gradient(45deg, #f00, #00f)"
  }
}
```
2. Aplica el tema
3. Abre DevTools (F12)
4. En la consola, ejecuta:
```javascript
getComputedStyle(document.documentElement).getPropertyValue('--test-color')
```

**Resultado Esperado:**
- Debe retornar "#ff00ff"
- Las propiedades custom deben estar disponibles en CSS

---

## Pruebas de Integración

### ✅ Prueba 11: Sincronización con Config

**Objetivo:** Verificar que el tema se guarda en config.json.

**Pasos:**
1. Selecciona el tema "Ice"
2. Abre el archivo de configuración:
   - Windows: `%LOCALAPPDATA%\dev.alexitoo.modpackstore\config.json`
   - macOS: `~/Library/Application Support/dev.alexitoo.modpackstore/config.json`
   - Linux: `~/.local/share/dev.alexitoo.modpackstore/config.json`
3. Busca la clave "selectedTheme"

**Resultado Esperado:**
- Debe existir la clave `"selectedTheme": "ice"`
- El archivo debe tener formato JSON válido

---

### ✅ Prueba 12: Múltiples Ventanas (si aplica)

**Objetivo:** Verificar que el tema se aplica en todas las ventanas.

**Pasos:**
1. Selecciona un tema (ej: Ice)
2. Si hay ventanas secundarias, verifica que también usen el tema

**Resultado Esperado:**
- Todas las ventanas deben usar el mismo tema

---

## Checklist de Regresión

Después de cualquier cambio al sistema de temas, verifica:

- [ ] El tema dark es el predeterminado para nuevos usuarios
- [ ] Los 3 temas base (dark, ice, dark-knight) son accesibles sin suscripción
- [ ] Los temas premium están bloqueados para usuarios sin Modpack Store+
- [ ] Los administradores pueden acceder a todos los temas
- [ ] La selección de tema persiste entre sesiones
- [ ] Los temas externos se cargan correctamente
- [ ] Los temas con errores no rompen la aplicación
- [ ] El cambio de tema es instantáneo
- [ ] Las notificaciones (toasts) funcionan correctamente
- [ ] La carpeta de temas se puede abrir desde la UI

## Reporte de Problemas

Si encuentras un bug, reporta:

1. **Descripción del problema**
2. **Pasos para reproducir**
3. **Resultado esperado vs resultado actual**
4. **Información del sistema** (OS, versión de ModpackStore)
5. **Logs de la aplicación** (si están disponibles)
6. **Screenshots o videos** (si es relevante)

## Performance

Verifica que:
- El cambio de tema toma < 100ms
- No hay "flash" de contenido sin estilo
- La aplicación no se congela al cambiar temas
- Los temas externos no afectan negativamente el rendimiento

## Accesibilidad

Verifica que:
- El contraste entre texto y fondo es adecuado
- Los elementos interactivos son claramente visibles
- Los estados hover/focus son evidentes
- Los colores no dependen únicamente del color para comunicar información
