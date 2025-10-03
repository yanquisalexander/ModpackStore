# Sistema de Ban de Usuarios - Implementación Completa

## Resumen de la Implementación

Se ha implementado un sistema completo de ban de usuarios para Modpack Store, incluyendo tanto el backend como el frontend.

## Backend

### 1. Entidad Ban (`backend/src/entities/Ban.ts`)
- **Campos:**
  - `id`: UUID único del ban
  - `userId`: Usuario baneado
  - `adminId`: Administrador que aplicó el ban
  - `reason`: Razón del ban (opcional)
  - `banDate`: Fecha del ban (auto-generada)
  - `unbanDate`: Fecha del desban (null si está activo)
  - `unbannedById`: Administrador que desbaneó (opcional)

- **Relaciones:**
  - `user`: Relación con el usuario baneado
  - `admin`: Relación con el admin que baneó
  - `unbannedBy`: Relación con el admin que desbaneó

- **Método helper:**
  - `isActive()`: Verifica si el ban está activo

### 2. Actualización de User Entity
- **Relación agregada:**
  - `bans`: Lista de todos los bans del usuario

- **Métodos agregados:**
  - `getActiveBan()`: Obtiene el ban activo del usuario
  - `isBanned()`: Verifica si el usuario está baneado
  - `getBanHistory()`: Obtiene el historial completo de bans

### 3. Servicio de Bans (`backend/src/services/adminBans.service.ts`)
- **Funciones:**
  - `banUser(data)`: Banea a un usuario
  - `unbanUser(userId, adminId)`: Desbanea a un usuario
  - `getUserBanHistory(userId)`: Obtiene historial de bans
  - `getAllBans(includeInactive)`: Lista todos los bans
  - `checkUserBanStatus(userId)`: Verifica estado de ban

- **Validaciones:**
  - No se puede banear a administradores
  - No se puede banear a un usuario ya baneado
  - Se desconecta al usuario del WebSocket al banearlo

### 4. Controlador de Bans (`backend/src/controllers/AdminBans.controller.ts`)
- **Endpoints:**
  - `POST /admin/bans`: Banear usuario
  - `DELETE /admin/bans/:userId`: Desbanear usuario
  - `GET /admin/bans/user/:userId/history`: Historial de bans
  - `GET /admin/bans`: Listar todos los bans
  - `GET /admin/bans/user/:userId/status`: Estado de ban

### 5. Integración con Autenticación
- **Auth Middleware (`requireAuth`):**
  - Verifica si el usuario está baneado
  - Lanza error 403 con información del ban
  - Incluye razón y fecha del ban en la respuesta

- **Auth Service (`getAuthenticatedUserProfile`):**
  - Incluye información de ban en el perfil del usuario
  - Campos agregados: `isBanned`, `banReason`, `activeBan`

### 6. Integración con WebSocket
- **Verificación en conexión:**
  - Rechaza conexiones de usuarios baneados
  - Envía mensaje de error antes de cerrar

- **Método agregado:**
  - `disconnectUser(userId, reason)`: Desconecta todas las conexiones del usuario
  - Se llama automáticamente al banear

## Frontend

### 1. Actualización de Tipos (`application/src/stores/AuthContext.tsx`)
- **UserSession actualizado con:**
  - `isBanned?: boolean`
  - `banReason?: string`
  - `activeBan?: { id, reason, banDate, adminId }`

### 2. BannedScreen Component (`application/src/components/BannedScreen.tsx`)
- **Características:**
  - Pantalla completa que cubre toda la aplicación
  - Muestra información del ban (razón y fecha)
  - Botón para cerrar sesión
  - Enlace a Discord para apelaciones
  - Diseño visual claro con iconos y gradientes

### 3. Integración en App.tsx
- **Verificación de ban:**
  - Se verifica `session?.isBanned` después de la carga
  - Si está baneado, muestra `BannedScreen` en lugar de la app
  - Oculta el sidebar cuando el usuario está baneado

### 4. Admin Panel - ManageUsersView
- **Componentes agregados:**
  - `BanDialog`: Dialog para banear con campo de razón
  - `BanHistoryDialog`: Dialog para ver historial de bans

- **Estado agregado:**
  - `banningUser`: Usuario en proceso de ban
  - `viewingBanHistory`: Usuario cuyo historial se está viendo
  - `banStatuses`: Cache de estados de ban

- **UI actualizada:**
  - Columna "Estado" en la tabla (ACTIVO/BANEADO)
  - Botón de historial de bans (icono de historial)
  - Botón de ban/unban (icono de ban/shield)
  - Los botones están deshabilitados para administradores

- **API Methods agregados:**
  - `banUser(userId, reason, accessToken)`
  - `unbanUser(userId, accessToken)`
  - `getUserBanHistory(userId, accessToken)`
  - `checkBanStatus(userId, accessToken)`

## Flujo de Funcionamiento

### Banear Usuario:
1. Admin abre ManageUsersView
2. Click en botón de ban (icono de ban rojo)
3. Se abre dialog para ingresar razón
4. Al confirmar, se llama al endpoint `/admin/bans`
5. Backend crea registro de ban
6. WebSocket desconecta al usuario
7. Audit log registra la acción
8. UI se actualiza mostrando estado "BANEADO"

### Usuario Baneado Intenta Acceder:
1. Usuario intenta hacer login o refrescar token
2. Auth middleware verifica estado de ban
3. Si está baneado, retorna error 403 con información
4. Frontend recibe sesión con `isBanned: true`
5. App.tsx detecta el ban y muestra BannedScreen
6. Usuario solo puede ver información del ban y cerrar sesión

### Desbanear Usuario:
1. Admin click en botón de unban (icono shield verde)
2. Se llama al endpoint `DELETE /admin/bans/:userId`
3. Backend actualiza registro de ban con fecha de unban
4. Audit log registra la acción
5. UI se actualiza mostrando estado "ACTIVO"

### Ver Historial:
1. Admin click en botón de historial
2. Se carga historial completo del usuario
3. Muestra todos los bans (activos e inactivos)
4. Incluye razón, fechas, y admin que aplicó/removió

## Seguridad y Validaciones

1. **No se puede banear admins:** Validación en backend y botón deshabilitado en frontend
2. **Solo admins pueden banear:** Rutas protegidas con `ensureAdmin` middleware
3. **No se puede banear usuario ya baneado:** Validación en servicio
4. **Audit logs:** Todas las acciones de ban/unban se registran
5. **WebSocket seguro:** Usuarios baneados no pueden conectarse
6. **Auto-desconexión:** Usuario es desconectado inmediatamente al ser baneado

## Testing Manual

### Prerequisitos:
1. Backend corriendo con PostgreSQL
2. Frontend corriendo
3. Cuenta de admin/superadmin

### Test 1: Banear Usuario
```bash
# 1. Login como admin
# 2. Ir a /admin/users
# 3. Seleccionar usuario no-admin
# 4. Click en icono de ban (rojo)
# 5. Ingresar razón: "Prueba de ban"
# 6. Confirmar
# Resultado esperado: Usuario aparece como BANEADO
```

### Test 2: Usuario Baneado Intenta Login
```bash
# 1. Logout del usuario baneado
# 2. Intentar login nuevamente
# Resultado esperado: Se muestra BannedScreen con razón del ban
```

### Test 3: Desbanear Usuario
```bash
# 1. Como admin, ir a /admin/users
# 2. Click en icono shield verde en usuario baneado
# Resultado esperado: Usuario aparece como ACTIVO
```

### Test 4: Ver Historial
```bash
# 1. Click en icono de historial
# Resultado esperado: Dialog muestra todos los bans del usuario
```

### Test 5: Validación Admin
```bash
# 1. Intentar banear a un usuario admin/superadmin
# Resultado esperado: Botón deshabilitado, mensaje de tooltip
```

### Test 6: WebSocket
```bash
# 1. Usuario conectado a WebSocket
# 2. Admin banea al usuario
# Resultado esperado: Usuario desconectado inmediatamente
```

## Endpoints API

### POST /v1/admin/bans
Banear un usuario
```json
{
  "userId": "uuid",
  "reason": "Razón del ban (opcional)"
}
```

### DELETE /v1/admin/bans/:userId
Desbanear un usuario

### GET /v1/admin/bans/user/:userId/history
Obtener historial de bans de un usuario

### GET /v1/admin/bans?includeInactive=true
Listar todos los bans (activos o todos)

### GET /v1/admin/bans/user/:userId/status
Verificar estado de ban de un usuario

## Archivos Modificados/Creados

### Backend:
- ✅ `backend/src/entities/Ban.ts` (nuevo)
- ✅ `backend/src/entities/User.ts` (modificado)
- ✅ `backend/src/db/data-source.ts` (modificado)
- ✅ `backend/src/services/adminBans.service.ts` (nuevo)
- ✅ `backend/src/services/auth.service.ts` (modificado)
- ✅ `backend/src/services/websocket.service.ts` (modificado)
- ✅ `backend/src/controllers/AdminBans.controller.ts` (nuevo)
- ✅ `backend/src/routes/admin/bans.route.ts` (nuevo)
- ✅ `backend/src/routes/v1/admin.routes.ts` (modificado)
- ✅ `backend/src/middlewares/auth.middleware.ts` (modificado)
- ✅ `backend/src/lib/APIError.ts` (modificado)

### Frontend:
- ✅ `application/src/components/BannedScreen.tsx` (nuevo)
- ✅ `application/src/stores/AuthContext.tsx` (modificado)
- ✅ `application/src/App.tsx` (modificado)
- ✅ `application/src/views/admin/ManageUsersView.tsx` (modificado)

## Notas Importantes

1. **Base de datos:** La entidad Ban se creará automáticamente con TypeORM synchronize
2. **Discord Link:** Actualizar el link de Discord si es necesario en BannedScreen.tsx
3. **Permisos:** Solo usuarios con rol admin/superadmin pueden acceder a las rutas de ban
4. **Audit logs:** Todas las acciones se registran automáticamente con AuditService
5. **WebSocket:** Los usuarios baneados son desconectados y no pueden reconectarse

## Mejoras Futuras Sugeridas

1. Ban temporal con fecha de expiración automática
2. Notificaciones por email al usuario baneado
3. Sistema de apelaciones integrado
4. Estadísticas de bans en dashboard
5. Exportación de historial de bans a CSV
6. Búsqueda y filtrado avanzado de bans
7. Ban por IP o dispositivo
8. Ban silencioso (shadow ban)
