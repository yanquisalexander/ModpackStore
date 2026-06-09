import { Hono } from 'hono';
import { RecommendationController } from '../../controllers/Recommendation.controller';
import { requireAuth, optionalAuth } from '../../middlewares/auth.middleware';

const app = new Hono();

/**
 * @openapi
 * /recommendations/for-you:
 *   get:
 *     summary: Get personalized recommendations
 *     tags: [Recommendations]
 *     description: Returns personalized modpack recommendations for the authenticated user based on their votes and similar users.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of recommendations to return.
 *     responses:
 *       200:
 *         description: Recommendations retrieved successfully.
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
 *                     isFallback:
 *                       type: boolean
 *                       description: Whether these are fallback recommendations (popular/new).
 *                     algorithm:
 *                       type: string
 *                       description: Algorithm used (ubcf, popular, or new).
 *                     count:
 *                       type: integer
 *       401:
 *         description: Unauthorized.
 *       500:
 *         description: Internal Server Error.
 */
app.get('/for-you', requireAuth, RecommendationController.getRecommendationsForUser);

/**
 * @openapi
 * /recommendations/related-to/{modpackId}:
 *   get:
 *     summary: Get related modpacks
 *     tags: [Recommendations]
 *     description: Returns modpacks that users who liked the specified modpack also liked.
 *     parameters:
 *       - in: path
 *         name: modpackId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The unique identifier of the modpack.
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of related modpacks to return.
 *     responses:
 *       200:
 *         description: Related modpacks retrieved successfully.
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
 *                     count:
 *                       type: integer
 *                     basedOn:
 *                       type: string
 *       500:
 *         description: Internal Server Error.
 */
app.get('/related-to/:modpackId', RecommendationController.getRelatedModpacks);

/**
 * @openapi
 * /recommendations/generate:
 *   post:
 *     summary: Generate recommendations (Admin only)
 *     tags: [Recommendations]
 *     description: Triggers the background job to generate recommendations for all users. Admin access required.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       202:
 *         description: Recommendation generation started.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       403:
 *         description: Forbidden (admin access required).
 *       500:
 *         description: Internal Server Error.
 */
app.post('/generate', requireAuth, RecommendationController.generateRecommendations);

export default app;
