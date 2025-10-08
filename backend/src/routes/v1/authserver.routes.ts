import { Hono } from 'hono';
import { AuthServerController } from '@/controllers/AuthServer.controller';
import { requireAuth, type AuthVariables } from '@/middlewares/auth.middleware';

const app = new Hono();

/**
 * Yggdrasil Authentication Server Routes
 * Compatible with authlib-injector for Minecraft launcher integration
 */

// Metadata endpoint (authlib-injector discovery)
app.get('/authserver', AuthServerController.getMetadata);

// Authentication endpoints
app.post('/authserver/authenticate', requireAuth, AuthServerController.authenticate);
app.post('/authserver/refresh', AuthServerController.refresh);
app.post('/authserver/validate', AuthServerController.validate);
app.post('/authserver/invalidate', AuthServerController.invalidate);
app.post('/authserver/signout', AuthServerController.signout);

// Session server endpoints (for server-side validation)
app.get('/sessionserver/session/minecraft/profile/:uuid', AuthServerController.getProfile);
app.post('/sessionserver/session/minecraft/join', AuthServerController.joinServer);
app.get('/sessionserver/session/minecraft/hasJoined', AuthServerController.hasJoined);

export default app;
