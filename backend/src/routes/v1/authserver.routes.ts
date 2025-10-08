import { Hono } from 'hono';
import { AuthServerController } from '@/controllers/AuthServer.controller';

const authServerRoutes = new Hono();

/**
 * @openapi
 * /authserver:
 *   get:
 *     summary: Get authserver metadata
 *     tags: [AuthServer]
 *     description: Returns metadata for authlib-injector compatibility
 *     responses:
 *       200:
 *         description: Authserver metadata
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 meta:
 *                   type: object
 *                   properties:
 *                     serverName:
 *                       type: string
 *                     implementationName:
 *                       type: string
 *                     implementationVersion:
 *                       type: string
 */
authServerRoutes.get('/', AuthServerController.getMetadata);

/**
 * @openapi
 * /authserver/authenticate:
 *   post:
 *     summary: Authenticate and create game session
 *     tags: [AuthServer]
 *     description: Authenticates a user using their ModpackStore JWT token
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
 *                 description: The username to use in-game
 *               password:
 *                 type: string
 *                 description: ModpackStore JWT access token
 *               clientToken:
 *                 type: string
 *                 description: Optional client token
 *               requestUser:
 *                 type: boolean
 *                 description: Whether to include user info in response
 *     responses:
 *       200:
 *         description: Authentication successful
 *       400:
 *         description: Missing credentials
 *       403:
 *         description: Invalid credentials
 */
authServerRoutes.post('/authenticate', AuthServerController.authenticate);

/**
 * @openapi
 * /authserver/refresh:
 *   post:
 *     summary: Refresh game session token
 *     tags: [AuthServer]
 *     description: Refreshes an existing game session
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
 *               requestUser:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *       400:
 *         description: Missing token
 *       403:
 *         description: Invalid or expired token
 */
authServerRoutes.post('/refresh', AuthServerController.refresh);

/**
 * @openapi
 * /authserver/validate:
 *   post:
 *     summary: Validate game session token
 *     tags: [AuthServer]
 *     description: Validates an access token
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
 *       400:
 *         description: Missing token
 *       403:
 *         description: Invalid token
 */
authServerRoutes.post('/validate', AuthServerController.validate);

/**
 * @openapi
 * /authserver/invalidate:
 *   post:
 *     summary: Invalidate game session token
 *     tags: [AuthServer]
 *     description: Invalidates an access token
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
 *       400:
 *         description: Missing token
 */
authServerRoutes.post('/invalidate', AuthServerController.invalidate);

/**
 * @openapi
 * /authserver/signout:
 *   post:
 *     summary: Sign out all game sessions
 *     tags: [AuthServer]
 *     description: Signs out all game sessions for a user
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
 *                 description: ModpackStore JWT access token
 *     responses:
 *       204:
 *         description: Signed out successfully
 *       400:
 *         description: Missing credentials
 *       403:
 *         description: Invalid credentials
 */
authServerRoutes.post('/signout', AuthServerController.signout);

export default authServerRoutes;
