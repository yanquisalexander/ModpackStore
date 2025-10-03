# Sistema de Ban - Guía de Testing Visual

## 1. Setup Inicial

### Requisitos:
- PostgreSQL corriendo
- Backend iniciado (`npm run dev` en carpeta backend)
- Frontend iniciado (`npm run dev` en carpeta application)
- Cuenta de administrador creada

## 2. Test Cases Visuales

### TEST 1: Pantalla de Ban Management en Admin Panel

**Objetivo:** Verificar que la interfaz de gestión de bans aparece correctamente

**Pasos:**
1. Login como administrador
2. Navegar a `/admin/users`
3. Verificar elementos de UI:
   - ✅ Columna "Estado" en la tabla
   - ✅ Badges "ACTIVO" y "BANEADO"
   - ✅ Botón con icono de ban (rojo)
   - ✅ Botón con icono de shield (verde) para usuarios baneados
   - ✅ Botón de historial (icono reloj)

**Resultado Esperado:**
- Todos los botones visibles y correctamente posicionados
- Botones de ban deshabilitados para usuarios admin
- Estados correctamente indicados con badges de colores

**Screenshot esperado:**
```
┌─────────────────────────────────────────────────────────────┐
│ Gestión de Usuarios                    [+ Crear Usuario]   │
├─────────────────────────────────────────────────────────────┤
│ [Buscar...]                [Filtro Rol ▼]  [🔄]            │
├──────────┬──────────────┬────────┬──────────┬───────────────┤
│ Usuario  │ Email        │ Rol    │ Estado   │ Acciones      │
├──────────┼──────────────┼────────┼──────────┼───────────────┤
│ john     │ john@ex.com  │ USER   │ [ACTIVO] │ ✏️ 📜 🚫 🗑️  │
│ banned   │ ban@ex.com   │ USER   │[BANEADO] │ ✏️ 📜 ✅ 🗑️  │
│ admin    │ adm@ex.com   │ ADMIN  │ [ACTIVO] │ ✏️ 📜 🚫 🗑️  │
└──────────┴──────────────┴────────┴──────────┴───────────────┘
```

---

### TEST 2: Dialog de Banear Usuario

**Objetivo:** Verificar que el dialog de ban funciona correctamente

**Pasos:**
1. En `/admin/users`, click en botón de ban de un usuario
2. Verificar elementos del dialog:
   - ✅ Título "Banear Usuario"
   - ✅ Mensaje de confirmación con nombre de usuario
   - ✅ Campo de texto para razón (textarea)
   - ✅ Botones "Cancelar" y "Banear Usuario"
3. Ingresar razón: "Violación de términos de servicio"
4. Click en "Banear Usuario"

**Resultado Esperado:**
- Dialog se abre correctamente
- Textarea acepta texto
- Al confirmar, dialog se cierra
- Usuario aparece como BANEADO en la tabla
- Toast de éxito aparece

**Screenshot esperado:**
```
┌─────────────────────────────────────────┐
│ Banear Usuario                     [X]  │
├─────────────────────────────────────────┤
│                                         │
│ ¿Estás seguro de que quieres banear    │
│ a john?                                 │
│                                         │
│ Razón del ban (opcional)                │
│ ┌─────────────────────────────────────┐ │
│ │ Violación de términos de servicio  │ │
│ │                                     │ │
│ │                                     │ │
│ └─────────────────────────────────────┘ │
│                                         │
│         [Cancelar]  [Banear Usuario]   │
└─────────────────────────────────────────┘
```

---

### TEST 3: Historial de Bans

**Objetivo:** Verificar que el historial de bans se muestra correctamente

**Pasos:**
1. En `/admin/users`, click en botón de historial de un usuario
2. Verificar elementos:
   - ✅ Lista de bans (activos e inactivos)
   - ✅ Badge de estado (ACTIVO/INACTIVO)
   - ✅ Fecha del ban
   - ✅ Razón del ban
   - ✅ Nombre del admin que baneó
   - ✅ Nombre del admin que desbaneó (si aplica)

**Resultado Esperado:**
- Dialog muestra historial completo
- Información clara y organizada
- Scroll si hay muchos bans

**Screenshot esperado:**
```
┌───────────────────────────────────────────────┐
│ Historial de Bans - john               [X]   │
├───────────────────────────────────────────────┤
│ ┌───────────────────────────────────────────┐ │
│ │ [ACTIVO]            15/01/2024 10:30      │ │
│ │ Razón: Violación de términos              │ │
│ │ Baneado por: admin_user                   │ │
│ └───────────────────────────────────────────┘ │
│                                               │
│ ┌───────────────────────────────────────────┐ │
│ │ [INACTIVO]          10/01/2024 14:20      │ │
│ │ Razón: Spam                               │ │
│ │ Baneado por: admin_user                   │ │
│ │ Desbaneado por: superadmin                │ │
│ └───────────────────────────────────────────┘ │
└───────────────────────────────────────────────┘
```

---

### TEST 4: Pantalla de Usuario Baneado (BannedScreen)

**Objetivo:** Verificar que un usuario baneado ve la pantalla correcta

**Pasos:**
1. Banear un usuario
2. Cerrar sesión e iniciar sesión con ese usuario
3. Verificar elementos:
   - ✅ Pantalla completa con fondo rojo/oscuro
   - ✅ Icono de advertencia grande
   - ✅ Título "Cuenta Suspendida"
   - ✅ Mensaje explicativo
   - ✅ Detalles del ban (razón y fecha)
   - ✅ Botón "Contactar Soporte en Discord"
   - ✅ Botón "Cerrar Sesión"
   - ✅ Nombre de usuario al final

**Resultado Esperado:**
- Pantalla cubre toda la aplicación
- Sidebar no visible
- Navegación bloqueada
- Botones funcionan correctamente

**Screenshot esperado:**
```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│                       ⚠️                                │
│                  (icono grande)                         │
│                                                         │
│              Cuenta Suspendida                          │
│                                                         │
│    Tu cuenta ha sido baneada y no puedes               │
│    acceder a Modpack Store.                            │
│                                                         │
│    ┌────────────────────────────────────┐              │
│    │ Detalles del Ban                   │              │
│    │                                    │              │
│    │ Razón:                             │              │
│    │ Violación de términos de servicio │              │
│    │                                    │              │
│    │ Fecha del ban:                     │              │
│    │ 15 de enero de 2024, 10:30        │              │
│    └────────────────────────────────────┘              │
│                                                         │
│    Si crees que esto es un error...                    │
│                                                         │
│    [💬 Contactar Soporte en Discord]                   │
│    [🚪 Cerrar Sesión]                                  │
│                                                         │
│    Usuario: john                                        │
└─────────────────────────────────────────────────────────┘
```

---

### TEST 5: Desbanear Usuario

**Objetivo:** Verificar que desbanear funciona correctamente

**Pasos:**
1. En `/admin/users`, encontrar usuario baneado
2. Click en botón shield verde (unban)
3. Verificar:
   - ✅ Estado cambia a "ACTIVO"
   - ✅ Botón shield desaparece
   - ✅ Botón de ban aparece
   - ✅ Toast de éxito

**Resultado Esperado:**
- Usuario inmediatamente marcado como activo
- Puede iniciar sesión normalmente
- Historial registra el unban

---

### TEST 6: Validación de Admin No Puede Ser Baneado

**Objetivo:** Verificar que no se pueden banear administradores

**Pasos:**
1. En `/admin/users`, ubicar usuario con rol ADMIN o SUPERADMIN
2. Verificar botón de ban
3. Intentar hacer hover sobre el botón

**Resultado Esperado:**
- Botón de ban deshabilitado (gris)
- Tooltip muestra: "No se pueden banear administradores"
- Click no hace nada

**Screenshot esperado:**
```
┌──────────────────────────────────────────┐
│ admin │ admin@... │ ADMIN │ ACTIVO │ ... │
│                                          │
│       [✏️] [📜] [🚫] [🗑️]                │
│                    ↑                     │
│         (deshabilitado + tooltip)        │
└──────────────────────────────────────────┘
```

---

### TEST 7: WebSocket Disconnection al Banear

**Objetivo:** Verificar que el usuario es desconectado del WebSocket al ser baneado

**Pasos:**
1. Usuario conectado y activo en la aplicación
2. Admin banea al usuario
3. Verificar en consola del navegador del usuario

**Resultado Esperado:**
- Mensaje de WebSocket cerrado
- Código de cierre: 1008 (Policy Violation)
- Razón: "USER_BANNED"
- Usuario puede ver mensaje de error antes de desconexión

**Console Output esperado:**
```
[WebSocket] Connection closed
Code: 1008
Reason: USER_BANNED
```

---

## 3. Checklist de Validación Final

### Backend:
- [ ] Endpoint POST /v1/admin/bans funciona
- [ ] Endpoint DELETE /v1/admin/bans/:userId funciona
- [ ] Endpoint GET /v1/admin/bans/user/:userId/history funciona
- [ ] Auth middleware rechaza usuarios baneados
- [ ] WebSocket rechaza usuarios baneados
- [ ] Admins no pueden ser baneados
- [ ] Audit logs registran todas las acciones

### Frontend:
- [ ] BannedScreen se muestra correctamente
- [ ] ManageUsersView muestra estados de ban
- [ ] Dialog de ban funciona
- [ ] Dialog de historial funciona
- [ ] Botón de unban funciona
- [ ] Validaciones de admin funcionan
- [ ] Sidebar se oculta cuando usuario está baneado

### Integración:
- [ ] Usuario baneado no puede hacer login
- [ ] Usuario baneado es desconectado de WebSocket
- [ ] Usuario desbaneado puede volver a acceder
- [ ] Historial se actualiza correctamente
- [ ] Toasts de éxito/error funcionan

## 4. Prueba de Regresión

Después de implementar el sistema de bans, verificar que:
- [ ] Login normal sigue funcionando
- [ ] Creación de usuarios funciona
- [ ] Edición de usuarios funciona
- [ ] Eliminación de usuarios funciona
- [ ] WebSocket normal funciona
- [ ] Otras funciones de admin funcionan

## 5. Casos Edge

- [ ] ¿Qué pasa si se banea un usuario ya baneado?
  - Resultado: Error 409 "User is already banned"
  
- [ ] ¿Qué pasa si se desbanea un usuario no baneado?
  - Resultado: Error 404 "User is not banned"
  
- [ ] ¿Qué pasa si admin intenta banearse a sí mismo?
  - Resultado: Error 403 "Cannot ban administrators"
  
- [ ] ¿Qué pasa si se elimina un usuario baneado?
  - Resultado: Se elimina correctamente (CASCADE en DB)

- [ ] ¿Qué pasa con sesiones activas al banear?
  - Resultado: Próxima petición con el token recibe error 403
