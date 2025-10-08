import { Hono } from 'hono';
import { AuthServerController } from '@/controllers/AuthServer.controller';

const authServerRoutes = new Hono();

/**
 * AuthServer routes - Yggdrasil/authlib-injector compatible endpoints
 * These routes implement the Mojang authentication protocol for Minecraft
 */

// Metadata endpoint for authlib-injector discovery
authServerRoutes.get('/', AuthServerController.getMetadata);

// Authentication endpoints
authServerRoutes.post('/authenticate', AuthServerController.authenticate);
authServerRoutes.post('/refresh', AuthServerController.refresh);
authServerRoutes.post('/validate', AuthServerController.validate);
authServerRoutes.post('/invalidate', AuthServerController.invalidate);
authServerRoutes.post('/signout', AuthServerController.signout);

export default authServerRoutes;
