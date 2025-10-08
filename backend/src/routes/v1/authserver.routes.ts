import { Hono } from 'hono';
import { AuthServerController } from '@/controllers/AuthServer.controller';

const authServerRoutes = new Hono();

/**
 * Root metadata endpoint for authlib-injector
 * This should be served at the root of the authserver domain
 */
authServerRoutes.get('/', AuthServerController.getMetadata);

/**
 * Yggdrasil Authentication Protocol Endpoints
 * These endpoints follow the Mojang/Yggdrasil authentication protocol
 * Compatible with authlib-injector
 */

/**
 * @openapi
 * /authserver/authenticate:
 *   post:
 *     summary: Authenticate and create game session
 *     tags: [AuthServer]
 *     description: |
 *       Authenticates a user with ModpackStore JWT token and creates a game session.
 *       Compatible with Yggdrasil/authlib-injector protocol.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *             properties:
 *               token:
 *                 type: string
 *                 description: ModpackStore JWT access token
 *               clientToken:
 *                 type: string
 *                 description: Client-provided token for session consistency (optional, will be generated if not provided)
 *               agent:
 *                 type: object
 *                 properties:
 *                   name:
 *                     type: string
 *                     example: Minecraft
 *                   version:
 *                     type: number
 *                     example: 1
 *     responses:
 *       200:
 *         description: Authentication successful
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
 *       403:
 *         description: Invalid credentials
 */
authServerRoutes.post('/authenticate', AuthServerController.authenticate);

/**
 * @openapi
 * /authserver/refresh:
 *   post:
 *     summary: Refresh access token
 *     tags: [AuthServer]
 *     description: Refreshes an access token with a valid client token
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
 *       403:
 *         description: Invalid token
 */
authServerRoutes.post('/refresh', AuthServerController.refresh);

/**
 * @openapi
 * /authserver/validate:
 *   post:
 *     summary: Validate access token
 *     tags: [AuthServer]
 *     description: Validates if an access token is still valid
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
authServerRoutes.post('/validate', AuthServerController.validate);

/**
 * @openapi
 * /authserver/invalidate:
 *   post:
 *     summary: Invalidate access token
 *     tags: [AuthServer]
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
 *       403:
 *         description: Invalid token
 */
authServerRoutes.post('/invalidate', AuthServerController.invalidate);

/**
 * @openapi
 * /authserver/signout:
 *   post:
 *     summary: Sign out all sessions
 *     tags: [AuthServer]
 *     description: Signs out all game sessions for a user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *             properties:
 *               token:
 *                 type: string
 *                 description: ModpackStore JWT access token
 *     responses:
 *       204:
 *         description: Signed out successfully
 */
authServerRoutes.post('/signout', AuthServerController.signout);

/**
 * @openapi
 * /authserver/gamesession:
 *   post:
 *     summary: Get or create game session (Custom endpoint for launcher)
 *     tags: [AuthServer]
 *     description: |
 *       Custom endpoint for the Rust launcher to get or create a game session.
 *       This is NOT part of the standard Yggdrasil protocol.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *             properties:
 *               token:
 *                 type: string
 *                 description: ModpackStore JWT access token
 *               nickname:
 *                 type: string
 *                 description: Custom nickname for this game session (optional)
 *     responses:
 *       200:
 *         description: Game session created/retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     accessToken:
 *                       type: string
 *                     clientToken:
 *                       type: string
 *                     username:
 *                       type: string
 *                     uuid:
 *                       type: string
 *       400:
 *         description: Bad request
 *       404:
 *         description: User not found
 */
authServerRoutes.post('/gamesession', AuthServerController.getGameSession);

export default authServerRoutes;
