import { Hono } from 'hono';
import { AuthServerController } from '@/controllers/AuthServer.controller';

const sessionServerRoutes = new Hono();

/**
 * @openapi
 * /sessionserver/session/minecraft/join:
 *   post:
 *     summary: Join a Minecraft server
 *     tags: [SessionServer]
 *     description: Called by the client when joining a server
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
 *         description: Join successful
 *       400:
 *         description: Missing fields
 *       403:
 *         description: Invalid token
 */
sessionServerRoutes.post('/session/minecraft/join', AuthServerController.joinServer);

/**
 * @openapi
 * /sessionserver/session/minecraft/hasJoined:
 *   get:
 *     summary: Check if player has joined server
 *     tags: [SessionServer]
 *     description: Called by the server to verify a player's session
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
 *     responses:
 *       200:
 *         description: Player profile
 *       204:
 *         description: Player not found
 *       400:
 *         description: Missing fields
 */
sessionServerRoutes.get('/session/minecraft/hasJoined', AuthServerController.hasJoined);

/**
 * @openapi
 * /sessionserver/session/minecraft/profile/{uuid}:
 *   get:
 *     summary: Get player profile by UUID
 *     tags: [SessionServer]
 *     description: Returns player profile information
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Player profile
 *       204:
 *         description: Profile not found
 *       400:
 *         description: Missing UUID
 */
sessionServerRoutes.get('/session/minecraft/profile/:uuid', AuthServerController.getProfile);

export default sessionServerRoutes;
