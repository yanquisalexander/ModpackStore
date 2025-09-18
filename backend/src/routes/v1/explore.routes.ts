import { Hono } from 'hono';
import { ExploreModpacksController } from '../../controllers/ExploreModpacks.controller';
import { requireAuth, type AuthVariables } from '../../middlewares/auth.middleware';

const app = new Hono();

/**
 * @openapi
 * /explore:
 *   get:
 *     summary: Get homepage modpacks
 *     tags: [Explore]
 *     description: Retrieves a list of modpacks for the homepage or general exploration.
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination.
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of modpacks per page.
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by category slug.
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [downloads, rating, createdAt, updatedAt, name]
 *           default: downloads
 *         description: Field to sort modpacks by.
 *     responses:
 *       200:
 *         description: A list of modpacks for exploration.
 *         content:
 *           application/vnd.api+json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ModpackResource'
 *                 meta:
 *                   type: object
 *                   properties:
 *                     totalItems: { type: 'integer' }
 *                     totalPages: { type: 'integer' }
 *                     currentPage: { type: 'integer' }
 *       401:
 *         description: Unauthorized.
 *         content:
 *           application/vnd.api+json:
 *             schema:
 *               $ref: '#/components/schemas/JsonApiErrorResponse'
 *       403:
 *         description: Forbidden (e.g., if validateCanExplore fails).
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
app.get('/', ExploreModpacksController.getHomepage);

/**
 * @openapi
 * /explore/search:
 *   get:
 *     summary: Search for modpacks
 *     tags: [Explore]
 *     description: Performs a search for modpacks based on a query string.
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 3
 *         description: The search query (e.g., modpack name, tag).
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: A list of modpacks matching the search query.
 *         content:
 *           application/vnd.api+json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ModpackResource'
 *                 meta:
 *                   type: object
 *                   properties:
 *                     totalItems: { type: 'integer' }
 *                     totalPages: { type: 'integer' }
 *                     currentPage: { type: 'integer' }
 *       400:
 *         description: Bad Request (e.g., missing or too short query parameter).
 *         content:
 *           application/vnd.api+json:
 *             schema:
 *               $ref: '#/components/schemas/JsonApiErrorResponse'
 *       401:
 *         description: Unauthorized.
 *       403:
 *         description: Forbidden.
 *       500:
 *         description: Internal Server Error.
 */
app.get('/search', ExploreModpacksController.search);

/**
 * @openapi
 * /explore/modpacks/{modpackId}:
 *   get:
 *     summary: Get a specific modpack details for exploration
 *     tags: [Explore]
 *     description: Retrieves details for a specific modpack by its ID. Requires user to be authenticated and have explore permissions.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: modpackId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The ID of the modpack to retrieve.
 *     responses:
 *       200:
 *         description: Details of the requested modpack.
 *         content:
 *           application/vnd.api+json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/ModpackResource'
 *       401:
 *         description: Unauthorized.
 *       403:
 *         description: Forbidden.
 *       404:
 *         description: Modpack not found.
 *         content:
 *           application/vnd.api+json:
 *             schema:
 *               $ref: '#/components/schemas/JsonApiErrorResponse'
 *       500:
 *         description: Internal Server Error.
 */
app.get('/modpacks/:modpackId', ExploreModpacksController.getModpack);
app.get('/modpacks/:modpackId/prelaunch-appearance', ExploreModpacksController.getPrelaunchAppearance);
app.get('/modpacks/:modpackId/versions', ExploreModpacksController.getModpackVersions);
app.get('/modpacks/:modpackId/versions/:versionId', ExploreModpacksController.getModpackVersionManifest);
app.get('/modpacks/:modpackId/latest', ExploreModpacksController.getLatestVersion);

/**
 * @openapi
 * /explore/modpacks/{modpackId}/check-update:
 *   get:
 *     summary: Check for modpack updates
 *     tags: [Explore]
 *     description: Checks if there's a newer version available for a specific modpack.
 *     parameters:
 *       - in: path
 *         name: modpackId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The ID of the modpack to check for updates.
 *       - in: query
 *         name: currentVersion
 *         required: true
 *         schema:
 *           type: string
 *         description: The current version of the modpack installed.
 *     responses:
 *       200:
 *         description: Update check result.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 hasUpdate:
 *                   type: boolean
 *                   description: Whether an update is available.
 *                 currentVersion:
 *                   type: string
 *                   description: The current version provided.
 *                 latestVersion:
 *                   type: object
 *                   properties:
 *                     id: { type: 'string' }
 *                     version: { type: 'string' }
 *                     mcVersion: { type: 'string' }
 *                     forgeVersion: { type: 'string' }
 *                     releaseDate: { type: 'string', format: 'date-time' }
 *                     changelog: { type: 'string' }
 *                 modpack:
 *                   type: object
 *                   properties:
 *                     id: { type: 'string' }
 *                     name: { type: 'string' }
 *       400:
 *         description: Bad Request (missing currentVersion).
 *       404:
 *         description: Modpack or version not found.
 *       500:
 *         description: Internal Server Error.
 */
app.get('/modpacks/:modpackId/check-update', ExploreModpacksController.checkForUpdates);

/**
 * @openapi
 * /explore/modpacks/{modpackId}/validate-password:
 *   post:
 *     summary: Validate modpack password
 *     tags: [Explore]
 *     description: Validates the password for a password-protected modpack.
 *     parameters:
 *       - in: path
 *         name: modpackId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The ID of the modpack to validate password for.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               password:
 *                 type: string
 *                 description: The password to validate.
 *             required:
 *               - password
 *     responses:
 *       200:
 *         description: Password validation result.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 valid:
 *                   type: boolean
 *                   description: Whether the password is valid.
 *                 message:
 *                   type: string
 *                   description: Validation result message.
 *       400:
 *         description: Bad Request (missing password).
 *       404:
 *         description: Modpack not found.
 *       500:
 *         description: Internal Server Error.
 */
app.post('/modpacks/:modpackId/validate-password', requireAuth, ExploreModpacksController.validateModpackPassword);

/**
 * @openapi
 * /explore/modpacks/{modpackId}/acquire/twitch:
 *   post:
 *     summary: Acquire modpack access through Twitch subscription
 *     tags: [Explore]
 *     description: Grants access to a modpack if user has an active Twitch subscription to required channels.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: modpackId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The unique identifier of the modpack.
 *     responses:
 *       200:
 *         description: Twitch acquisition successful.
 *       401:
 *         description: Unauthorized.
 *       403:
 *         description: Twitch subscription required or not active.
 *       404:
 *         description: Modpack not found.
 *       500:
 *         description: Internal Server Error.
 */
app.post('/modpacks/:modpackId/acquire/twitch', requireAuth, ExploreModpacksController.acquireWithTwitch);

/**
 * @openapi
 * /explore/modpacks/{modpackId}/acquire/purchase:
 *   post:
 *     summary: Acquire modpack access through purchase
 *     tags: [Explore]
 *     description: Initiates purchase flow for paid modpacks or grants immediate access for free modpacks.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: modpackId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The unique identifier of the modpack.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               returnUrl:
 *                 type: string
 *                 format: uri
 *                 description: URL to redirect to after successful payment.
 *               cancelUrl:
 *                 type: string
 *                 format: uri
 *                 description: URL to redirect to if payment is cancelled.
 *             required:
 *               - returnUrl
 *               - cancelUrl
 *     responses:
 *       200:
 *         description: Purchase initiated or free modpack acquired.
 *       400:
 *         description: Bad Request.
 *       401:
 *         description: Unauthorized.
 *       404:
 *         description: Modpack not found.
 *       500:
 *         description: Internal Server Error.
 */
app.post('/modpacks/:modpackId/acquire/purchase', requireAuth, ExploreModpacksController.acquireWithPurchase);

/**
 * @openapi
 * /explore/paypal-webhook:
 *   post:
 *     summary: PayPal webhook endpoint
 *     tags: [Explore]
 *     description: Handles PayPal payment completion webhooks.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Webhook processed successfully.
 *       500:
 *         description: Webhook processing failed.
 */
app.post('/paypal-webhook', ExploreModpacksController.paypalWebhook);

/**
 * @openapi
 * /explore/user/acquisitions:
 *   get:
 *     summary: Get user's modpack acquisitions
 *     tags: [Explore]
 *     description: Retrieves a list of modpacks the authenticated user has acquired.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination.
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of acquisitions per page.
 *     responses:
 *       200:
 *         description: User acquisitions retrieved successfully.
 *       401:
 *         description: Unauthorized.
 *       500:
 *         description: Internal Server Error.
 */
app.get('/user/acquisitions', requireAuth, ExploreModpacksController.getUserAcquisitions);

/**
 * @openapi
 * /explore/twitch-channels:
 *   post:
 *     summary: Get Twitch channel information
 *     tags: [Explore]
 *     description: Retrieves information about Twitch channels for displaying in the UI.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - channelIds
 *             properties:
 *               channelIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of Twitch channel IDs to fetch information for.
 *     responses:
 *       200:
 *         description: Channel information retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: 'string' }
 *                       username: { type: 'string' }
 *                       displayName: { type: 'string' }
 *                       profileImageUrl: { type: 'string', nullable: true }
 *                       isLive: { type: 'boolean' }
 *       400:
 *         description: Bad Request (invalid channelIds).
 *       500:
 *         description: Internal Server Error.
 */
app.post('/twitch-channels', ExploreModpacksController.getTwitchChannelInfo);

/**
 * @openapi
 * /explore/user-twitch-subscriptions:
 *   post:
 *     summary: Check user's Twitch subscriptions
 *     tags: [Explore]
 *     description: Checks which of the required Twitch channels the authenticated user is subscribed to.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - channelIds
 *             properties:
 *               channelIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of Twitch channel IDs to check subscriptions for.
 *     responses:
 *       200:
 *         description: Subscription check completed.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 hasAccess:
 *                   type: boolean
 *                   description: Whether user has access to at least one channel.
 *                 subscribedChannels:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: 'string' }
 *                       username: { type: 'string' }
 *                       displayName: { type: 'string' }
 *                   description: List of channels the user is subscribed to.
 *       400:
 *         description: Bad Request.
 *       403:
 *         description: Forbidden (user not authenticated or no Twitch linked).
 *       500:
 *         description: Internal Server Error.
 */
app.post('/user-twitch-subscriptions', requireAuth, ExploreModpacksController.getUserTwitchSubscriptions);

/**
 * @openapi
 * /explore/modpacks/{modpackId}/check-access:
 *   get:
 *     summary: Check user access to a modpack
 *     tags: [Explore]
 *     description: Checks if the authenticated user (or anonymous) can access a specific modpack based on all access requirements including Twitch subscriptions.
 *     parameters:
 *       - in: path
 *         name: modpackId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The ID of the modpack to check access for.
 *     responses:
 *       200:
 *         description: Access check result.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 canAccess:
 *                   type: boolean
 *                   description: Whether the user can access the modpack.
 *                 reason:
 *                   type: string
 *                   nullable: true
 *                   description: Reason for access denial if applicable.
 *                 requiredChannels:
 *                   type: array
 *                   nullable: true
 *                   items:
 *                     type: string
 *                   description: Required Twitch channel IDs if access is denied due to missing subscriptions.
 *                 modpackAccessInfo:
 *                   type: object
 *                   properties:
 *                     requiresTwitchSubscription:
 *                       type: boolean
 *                     requiredTwitchChannels:
 *                       type: array
 *                       items:
 *                         type: string
 *                     isPaid:
 *                       type: boolean
 *                     price:
 *                       type: string
 *                       nullable: true
 *       404:
 *         description: Modpack not found.
 *       500:
 *         description: Internal Server Error.
 */
app.get('/modpacks/:modpackId/check-access', requireAuth, ExploreModpacksController.checkUserModpackAccess);

/**
 * @openapi
 * /explore/twitch-channels/search:
 *   get:
 *     summary: Search Twitch channels
 *     tags: [Twitch]
 *     description: Search for Twitch channels by username.
 *     parameters:
 *       - in: query
 *         name: query
 *         required: true
 *         schema:
 *           type: string
 *         description: Channel username to search for.
 *     responses:
 *       200:
 *         description: Search results for Twitch channels.
 */
app.get('/twitch-channels/search', ExploreModpacksController.searchTwitchChannels);

/**
 * @openapi
 * /explore/twitch-channels/validate:
 *   post:
 *     summary: Validate Twitch channels
 *     tags: [Twitch]
 *     description: Validate an array of Twitch channel usernames or IDs.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               channels:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of Twitch channel usernames or IDs to validate.
 *     responses:
 *       200:
 *         description: Validated Twitch channels.
 */
app.post('/twitch-channels/validate', ExploreModpacksController.validateTwitchChannels);

export default app;