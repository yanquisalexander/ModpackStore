import { Hono } from 'hono';
import { AccountsController } from '../../controllers/Accounts.controller';
import { requireAuth } from "@/middlewares/auth.middleware";

const authRoutes = new Hono();

/**
 * @openapi
 * /auth/discord/callback:
 *   get:
 *     summary: Discord OAuth2 callback
 *     tags: [Auth]
 *     description: Handles the OAuth2 callback from Discord. Exchanges the authorization code for tokens. This endpoint is typically redirected to by Discord.
 *     parameters:
 *       - in: query
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *         description: The authorization code provided by Discord.
 *       - in: query
 *         name: state
 *         required: false # Usually required for security, but depends on initial auth request
 *         schema:
 *           type: string
 *         description: The state parameter for CSRF protection.
 *     responses:
 *       200:
 *         description: Successfully authenticated and tokens issued. Returns access and refresh tokens.
 *         content:
 *           application/vnd.api+json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/TokenResource'
 *       400:
 *         description: Bad Request - e.g., missing authorization code.
 *         content:
 *           application/vnd.api+json:
 *             schema:
 *               $ref: '#/components/schemas/JsonApiErrorResponse'
 *       500:
 *         description: Internal Server Error - e.g., failed to communicate with Discord or database error.
 *         content:
 *           application/vnd.api+json:
 *             schema:
 *               $ref: '#/components/schemas/JsonApiErrorResponse'
 */
authRoutes.get('/discord/callback', AccountsController.callbackDiscord);

/**
 * @openapi
 * /auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     tags: [Auth]
 *     description: Exchanges a valid refresh token for a new access token and a new refresh token.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refresh_token
 *             properties:
 *               refresh_token:
 *                 type: string
 *                 description: The refresh token.
 *                 example: "def50200f2992d476e880663730f8..."
 *     responses:
 *       200:
 *         description: Successfully refreshed tokens.
 *         content:
 *           application/vnd.api+json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/TokenResource'
 *       400:
 *         description: Bad Request - e.g., missing refresh token.
 *         content:
 *           application/vnd.api+json:
 *             schema:
 *               $ref: '#/components/schemas/JsonApiErrorResponse'
 *       401:
 *         description: Unauthorized - e.g., invalid or expired refresh token.
 *         content:
 *           application/vnd.api+json:
 *             schema:
 *               $ref: '#/components/schemas/JsonApiErrorResponse'
 *       500:
 *         description: Internal Server Error.
 *         content:
 *           application/vnd.api+json:
 *             schema:
 *               $ref: '#/components/schemas/JsonApiErrorResponse'
 */
authRoutes.post('/refresh', AccountsController.refreshTokens);

/**
 * @openapi
 * /auth/me:
 *   get:
 *     summary: Get current authenticated user
 *     tags: [Auth]
 *     description: Retrieves the profile information of the currently authenticated user.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved user profile.
 *         content:
 *           application/vnd.api+json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/UserResource'
 *       401:
 *         description: Unauthorized - if no valid token is provided.
 *         content:
 *           application/vnd.api+json:
 *             schema:
 *               $ref: '#/components/schemas/JsonApiErrorResponse'
 *       500:
 *         description: Internal Server Error.
 *         content:
 *           application/vnd.api+json:
 *             schema:
 *               $ref: '#/components/schemas/JsonApiErrorResponse'
 */
// TODO: MIGRATE_MIDDLEWARE - requireAuth middleware needs to be migrated and re-enabled.
// authRoutes.get('/me', requireAuth, AccountsController.getCurrentUser);
authRoutes.get('/me', requireAuth, AccountsController.getCurrentUser);

export default authRoutes;
