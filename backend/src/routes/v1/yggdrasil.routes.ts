import { Hono } from 'hono';
import { YggdrasilController } from '@/controllers/Yggdrasil.controller';

const yggdrasilRoutes = new Hono();

/**
 * @openapi
 * /yggdrasil/authenticate:
 *   post:
 *     summary: Authenticate with ModpackStore and get Yggdrasil tokens
 *     tags: [Yggdrasil]
 *     description: Exchanges ModpackStore JWT token for Yggdrasil access/client tokens
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *                 description: Requested username (ms_nickname) - optional
 *               password:
 *                 type: string
 *                 description: ModpackStore JWT token (for compatibility)
 *               clientToken:
 *                 type: string
 *                 description: Client token - optional, will be generated if not provided
 *     responses:
 *       200:
 *         description: Successfully authenticated
 *       401:
 *         description: Invalid JWT token
 */
yggdrasilRoutes.post('/authenticate', YggdrasilController.authenticate);

/**
 * @openapi
 * /yggdrasil/refresh:
 *   post:
 *     summary: Refresh Yggdrasil access token
 *     tags: [Yggdrasil]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - accessToken
 *               - clientToken
 *             properties:
 *               accessToken:
 *                 type: string
 *               clientToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Successfully refreshed
 *       401:
 *         description: Invalid token
 */
yggdrasilRoutes.post('/refresh', YggdrasilController.refresh);

/**
 * @openapi
 * /yggdrasil/validate:
 *   post:
 *     summary: Validate Yggdrasil access token
 *     tags: [Yggdrasil]
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
 *                 description: Optional client token
 *     responses:
 *       204:
 *         description: Token is valid
 *       403:
 *         description: Token is invalid
 */
yggdrasilRoutes.post('/validate', YggdrasilController.validate);

/**
 * @openapi
 * /yggdrasil/invalidate:
 *   post:
 *     summary: Invalidate Yggdrasil access token (logout)
 *     tags: [Yggdrasil]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - accessToken
 *               - clientToken
 *             properties:
 *               accessToken:
 *                 type: string
 *               clientToken:
 *                 type: string
 *     responses:
 *       204:
 *         description: Successfully invalidated
 */
yggdrasilRoutes.post('/invalidate', YggdrasilController.invalidate);

/**
 * @openapi
 * /yggdrasil/signout:
 *   post:
 *     summary: Sign out all sessions for a user
 *     tags: [Yggdrasil]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       204:
 *         description: Successfully signed out
 *       501:
 *         description: Not implemented for ModpackStore auth
 */
yggdrasilRoutes.post('/signout', YggdrasilController.signout);

/**
 * @openapi
 * /yggdrasil/session/minecraft/join:
 *   post:
 *     summary: Join Minecraft server (client-side)
 *     tags: [Yggdrasil]
 *     description: Called by Minecraft client when joining a server
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - accessToken
 *               - selectedProfile
 *               - serverId
 *             properties:
 *               accessToken:
 *                 type: string
 *               selectedProfile:
 *                 type: string
 *                 description: Player UUID
 *               serverId:
 *                 type: string
 *                 description: Server ID hash
 *     responses:
 *       204:
 *         description: Successfully joined
 *       403:
 *         description: Invalid session
 */
yggdrasilRoutes.post('/session/minecraft/join', YggdrasilController.joinServer);

/**
 * @openapi
 * /yggdrasil/session/minecraft/hasJoined:
 *   get:
 *     summary: Verify player session (server-side)
 *     tags: [Yggdrasil]
 *     description: Called by Minecraft server to verify player authentication
 *     parameters:
 *       - in: query
 *         name: username
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: serverId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: ip
 *         required: false
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Session is valid, returns player profile
 *       204:
 *         description: Session not found or invalid
 */
yggdrasilRoutes.get('/session/minecraft/hasJoined', YggdrasilController.hasJoined);

/**
 * @openapi
 * /yggdrasil/session/minecraft/profile/{uuid}:
 *   get:
 *     summary: Get player profile by UUID
 *     tags: [Yggdrasil]
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: unsigned
 *         required: false
 *         schema:
 *           type: boolean
 *           default: true
 *     responses:
 *       200:
 *         description: Player profile
 *       404:
 *         description: Profile not found
 */
yggdrasilRoutes.get('/session/minecraft/profile/:uuid', YggdrasilController.getProfile);

export default yggdrasilRoutes;
