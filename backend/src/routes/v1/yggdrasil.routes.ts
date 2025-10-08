import { Hono } from 'hono';
import { YggdrasilController } from '@/controllers/Yggdrasil.controller';

const yggdrasilRoutes = new Hono();

/**
 * Yggdrasil Authentication Server Routes
 * Compatible with authlib-injector and Minecraft authentication
 */

// Metadata endpoint
yggdrasilRoutes.get('/', YggdrasilController.getMetadata);

// Authentication endpoints
yggdrasilRoutes.post('/authserver/authenticate', YggdrasilController.authenticate);
yggdrasilRoutes.post('/authserver/refresh', YggdrasilController.refresh);
yggdrasilRoutes.post('/authserver/validate', YggdrasilController.validate);
yggdrasilRoutes.post('/authserver/invalidate', YggdrasilController.invalidate);
yggdrasilRoutes.post('/authserver/signout', YggdrasilController.signout);

// Session server endpoints
yggdrasilRoutes.get('/sessionserver/session/minecraft/profile/:uuid', YggdrasilController.getProfile);
yggdrasilRoutes.post('/sessionserver/session/minecraft/join', YggdrasilController.joinServer);
yggdrasilRoutes.get('/sessionserver/session/minecraft/hasJoined', YggdrasilController.hasJoined);

export default yggdrasilRoutes;
