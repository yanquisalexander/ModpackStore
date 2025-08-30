import { Hono } from 'hono';
import { ExploreModpacksController } from '../../controllers/ExploreModpacks.controller';
import { requireAuth } from '../../middlewares/auth.middleware';
import { validateCanExplore } from '../../middlewares/explore.middleware';

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
 * /explore/modpack/{modpackId}:
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
app.get('/modpack/:modpackId', ExploreModpacksController.getModpack);
app.get('/modpack/:modpackId/versions', ExploreModpacksController.getModpackVersions);

export default app;