import { Hono } from 'hono';
import { YggdrasilController } from '@/controllers/Yggdrasil.controller';

const yggdrasilRoutes = new Hono();

/**
 * @openapi
 * /yggdrasil/:
 *   get:
 *     summary: Yggdrasil metadata endpoint
 *     tags: [Yggdrasil]
 *     description: Returns metadata for authlib-injector compatibility
 *     responses:
 *       200:
 *         description: Metadata returned successfully
 */
yggdrasilRoutes.get('/', YggdrasilController.metadata);

/**
 * @openapi
 * /yggdrasil/authenticate:
 *   post:
 *     summary: Authenticate with ModpackStore account
 *     tags: [Yggdrasil]
 *     description: Generates access and client tokens for Minecraft authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *                 description: ModpackStore user ID
 *               clientToken:
 *                 type: string
 *                 description: Client token (optional, generated if not provided)
 *               username:
 *                 type: string
 *                 description: Custom Minecraft username (ms_nickname)
 *     responses:
 *       200:
 *         description: Authentication successful
 */
yggdrasilRoutes.post('/authenticate', YggdrasilController.authenticate);

/**
 * @openapi
 * /yggdrasil/refresh:
 *   post:
 *     summary: Refresh access token
 *     tags: [Yggdrasil]
 *     description: Refreshes an existing access token
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
 *         description: Token refreshed successfully
 */
yggdrasilRoutes.post('/refresh', YggdrasilController.refresh);

/**
 * @openapi
 * /yggdrasil/validate:
 *   post:
 *     summary: Validate access token
 *     tags: [Yggdrasil]
 *     description: Validates an access token without refreshing it
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
 *         description: Token is invalid or expired
 */
yggdrasilRoutes.post('/validate', YggdrasilController.validate);

/**
 * @openapi
 * /yggdrasil/invalidate:
 *   post:
 *     summary: Invalidate access token
 *     tags: [Yggdrasil]
 *     description: Invalidates an access token (logout)
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
 *         description: Token invalidated successfully
 */
yggdrasilRoutes.post('/invalidate', YggdrasilController.invalidate);

/**
 * @openapi
 * /yggdrasil/signout:
 *   post:
 *     summary: Sign out all sessions
 *     tags: [Yggdrasil]
 *     description: Invalidates all tokens for a user
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
 *         description: Signed out successfully
 */
yggdrasilRoutes.post('/signout', YggdrasilController.signout);

/**
 * @openapi
 * /yggdrasil/session/minecraft/join:
 *   post:
 *     summary: Join server
 *     tags: [Yggdrasil]
 *     description: Called by client when joining a Minecraft server
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
 *               serverId:
 *                 type: string
 *     responses:
 *       204:
 *         description: Join request accepted
 */
yggdrasilRoutes.post('/session/minecraft/join', YggdrasilController.joinServer);

/**
 * @openapi
 * /yggdrasil/session/minecraft/hasJoined:
 *   get:
 *     summary: Verify player joined
 *     tags: [Yggdrasil]
 *     description: Called by server to verify a player has joined
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
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Player verified successfully
 *       204:
 *         description: Player not verified
 */
yggdrasilRoutes.get('/session/minecraft/hasJoined', YggdrasilController.hasJoined);

/**
 * @openapi
 * /yggdrasil/profile/{uuid}:
 *   get:
 *     summary: Get player profile
 *     tags: [Yggdrasil]
 *     description: Gets a player profile by UUID
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Profile returned successfully
 *       204:
 *         description: Profile not found
 */
yggdrasilRoutes.get('/profile/:uuid', YggdrasilController.getProfile);

export default yggdrasilRoutes;
