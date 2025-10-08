import { Hono } from 'hono';
import { YggdrasilController } from '@/controllers/Yggdrasil.controller';
import { requireAuth } from "@/middlewares/auth.middleware";

const yggdrasilRoutes = new Hono();

/**
 * @openapi
 * /yggdrasil/authenticate:
 *   post:
 *     summary: Authenticate and get game session token
 *     tags: [Yggdrasil]
 *     description: Generates a temporary game session token for Minecraft authentication. Requires ModpackStore JWT.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: profileName
 *         schema:
 *           type: string
 *         description: Minecraft username to use (3-16 chars, alphanumeric + underscore). Defaults to user's username.
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               clientToken:
 *                 type: string
 *                 description: Optional client token for session tracking
 *     responses:
 *       200:
 *         description: Game session created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken:
 *                   type: string
 *                 clientToken:
 *                   type: string
 *                 availableProfiles:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                 selectedProfile:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *       401:
 *         description: Unauthorized
 */
yggdrasilRoutes.post('/authenticate', requireAuth, YggdrasilController.authenticate);

/**
 * @openapi
 * /yggdrasil/refresh:
 *   post:
 *     summary: Refresh game session token
 *     tags: [Yggdrasil]
 *     description: Refreshes an existing game session token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - accessToken
 *             properties:
 *               accessToken:
 *                 type: string
 *               clientToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *       403:
 *         description: Invalid or expired token
 */
yggdrasilRoutes.post('/refresh', YggdrasilController.refresh);

/**
 * @openapi
 * /yggdrasil/validate:
 *   post:
 *     summary: Validate game session token
 *     tags: [Yggdrasil]
 *     description: Validates if a game session token is still valid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - accessToken
 *             properties:
 *               accessToken:
 *                 type: string
 *               clientToken:
 *                 type: string
 *     responses:
 *       204:
 *         description: Token is valid
 *       403:
 *         description: Invalid or expired token
 */
yggdrasilRoutes.post('/validate', YggdrasilController.validate);

/**
 * @openapi
 * /yggdrasil/invalidate:
 *   post:
 *     summary: Invalidate game session token
 *     tags: [Yggdrasil]
 *     description: Invalidates a game session token (logout)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - accessToken
 *             properties:
 *               accessToken:
 *                 type: string
 *               clientToken:
 *                 type: string
 *     responses:
 *       204:
 *         description: Token invalidated successfully
 */
yggdrasilRoutes.post('/invalidate', YggdrasilController.invalidate);

/**
 * @openapi
 * /yggdrasil/sessionserver/session/minecraft/profile/{uuid}:
 *   get:
 *     summary: Get player profile
 *     tags: [Yggdrasil]
 *     description: Gets player profile for session server verification (used by Minecraft servers)
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema:
 *           type: string
 *         description: Player UUID (with or without dashes)
 *     responses:
 *       200:
 *         description: Player profile found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 name:
 *                   type: string
 *                 properties:
 *                   type: array
 *                   items:
 *                     type: object
 *       204:
 *         description: Profile not found
 */
yggdrasilRoutes.get('/sessionserver/session/minecraft/profile/:uuid', YggdrasilController.getProfile);

/**
 * @openapi
 * /:
 *   get:
 *     summary: Get authlib-injector metadata
 *     tags: [Yggdrasil]
 *     description: Returns metadata for authlib-injector compatibility
 *     responses:
 *       200:
 *         description: Metadata returned successfully
 */
yggdrasilRoutes.get('/', YggdrasilController.getMetadata);

export default yggdrasilRoutes;
