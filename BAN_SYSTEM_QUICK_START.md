# 🚀 Quick Start Guide - Sistema de Bans

## Para Desarrolladores

### 1. Estructura del Código

```
Backend:
├── entities/Ban.ts              # Modelo de datos
├── services/adminBans.service.ts # Lógica de negocio
├── controllers/AdminBans.controller.ts # Endpoints
└── routes/admin/bans.route.ts   # Rutas API

Frontend:
├── components/BannedScreen.tsx  # Pantalla de ban
└── views/admin/ManageUsersView.tsx # UI de gestión
```

### 2. Endpoints Rápidos

```bash
# Banear usuario
POST /v1/admin/bans
{
  "userId": "uuid",
  "reason": "Razón"
}

# Desbanear
DELETE /v1/admin/bans/:userId

# Ver historial
GET /v1/admin/bans/user/:userId/history

# Verificar estado
GET /v1/admin/bans/user/:userId/status
```

### 3. Uso en Código

#### Backend - Verificar si usuario está baneado
```typescript
const user = await User.findOne({ where: { id: userId } });
const isBanned = await user.isBanned();
const activeBan = await user.getActiveBan();
```

#### Backend - Banear un usuario
```typescript
import { banUser } from './services/adminBans.service';

await banUser({
  userId: 'user-uuid',
  adminId: 'admin-uuid',
  reason: 'Violación de términos'
});
```

#### Frontend - Verificar ban en componente
```typescript
const { session } = useAuthentication();

if (session?.isBanned) {
  return <BannedScreen />;
}
```

## Para Administradores

### Banear un Usuario
1. Ir a `/admin/users`
2. Encontrar el usuario
3. Click en icono 🚫 rojo
4. Ingresar razón (opcional)
5. Confirmar

### Desbanear un Usuario
1. Ir a `/admin/users`
2. Encontrar usuario baneado (badge rojo)
3. Click en icono ✅ verde
4. Listo

### Ver Historial de Bans
1. Ir a `/admin/users`
2. Click en icono 📜 de historial
3. Ver todos los bans del usuario

## Testing Rápido

### Test 1: Banear
```bash
# Como admin
curl -X POST http://localhost:3000/v1/admin/bans \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"userId":"USER_ID","reason":"Test"}'
```

### Test 2: Verificar
```bash
curl http://localhost:3000/v1/admin/bans/user/USER_ID/status \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Test 3: Desbanear
```bash
curl -X DELETE http://localhost:3000/v1/admin/bans/USER_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Troubleshooting

### Usuario no se desconecta al banear
- Verificar que WebSocket está activo
- Check logs del servidor
- Usuario debe hacer nueva petición para ser bloqueado

### Botón de ban deshabilitado
- Verificar que usuario no es admin
- Verificar que no está ya baneado
- Check permisos del usuario actual

### BannedScreen no aparece
- Verificar que `isBanned` está en session
- Check AuthContext está actualizado
- Ver consola del navegador

## Configuración

### Cambiar Discord Link
Archivo: `application/src/components/BannedScreen.tsx`
Línea: 23
```typescript
url: 'https://discord.gg/TU_SERVIDOR'
```

### Desactivar Auto-desconexión WebSocket
Archivo: `backend/src/services/adminBans.service.ts`
Comentar línea:
```typescript
// wsManager.disconnectUser(userId, 'USER_BANNED');
```

## FAQs

**Q: ¿Puedo banear a un admin?**
A: No, está bloqueado tanto en backend como frontend.

**Q: ¿Los bans son permanentes?**
A: Sí, hasta que un admin desbanee al usuario.

**Q: ¿Se notifica al usuario?**
A: Sí, ve BannedScreen al intentar acceder.

**Q: ¿Puedo exportar el historial?**
A: Actualmente no, pero está en mejoras futuras.

**Q: ¿Afecta a sesiones activas?**
A: Sí, próxima petición recibe error 403.

## Recursos

- 📖 **Documentación Completa:** `BAN_SYSTEM_IMPLEMENTATION.md`
- 🧪 **Guía de Testing:** `BAN_SYSTEM_VISUAL_TESTING.md`
- 📊 **Resumen Ejecutivo:** `BAN_SYSTEM_SUMMARY.md`

## Contacto

Para preguntas o problemas, contactar al equipo de desarrollo.
