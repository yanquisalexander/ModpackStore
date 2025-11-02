import { Hono } from 'hono';
import { VoteController } from '../../controllers/Vote.controller';
import { requireAuth, optionalAuth } from '../../middlewares/auth.middleware';

const app = new Hono();

/**
 * @openapi
 * /modpacks/{modpackId}/vote:
 *   post:
 *     summary: Vote on a modpack
 *     tags: [Votes]
 *     description: Allows authenticated user to vote (like/dislike) on a modpack or remove their vote.
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
 *               vote:
 *                 type: string
 *                 enum: [like, dislike, none]
 *                 description: The vote type (like, dislike, or none to remove vote).
 *             required:
 *               - vote
 *     responses:
 *       200:
 *         description: Vote recorded successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 vote:
 *                   type: string
 *                   enum: [like, dislike, none]
 *                 counts:
 *                   type: object
 *                   properties:
 *                     likes:
 *                       type: integer
 *                     dislikes:
 *                       type: integer
 *       400:
 *         description: Bad Request (invalid vote type).
 *       401:
 *         description: Unauthorized.
 *       404:
 *         description: Modpack not found.
 *       500:
 *         description: Internal Server Error.
 */
app.post('/modpacks/:modpackId/vote', requireAuth, VoteController.voteOnModpack);

/**
 * @openapi
 * /modpacks/{modpackId}/votes:
 *   get:
 *     summary: Get vote counts for a modpack
 *     tags: [Votes]
 *     description: Returns the number of likes and dislikes for a modpack.
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
 *         description: Vote counts retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 modpackId:
 *                   type: string
 *                 likes:
 *                   type: integer
 *                 dislikes:
 *                   type: integer
 *                 total:
 *                   type: integer
 *       500:
 *         description: Internal Server Error.
 */
app.get('/modpacks/:modpackId/votes', VoteController.getVoteCounts);

/**
 * @openapi
 * /user/votes:
 *   get:
 *     summary: Get user's votes
 *     tags: [Votes]
 *     description: Returns a map of all votes by the authenticated user.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User votes retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 votes:
 *                   type: object
 *                   additionalProperties:
 *                     type: string
 *                     enum: [like, dislike]
 *                   description: Map of modpackId to vote type.
 *       401:
 *         description: Unauthorized.
 *       500:
 *         description: Internal Server Error.
 */
app.get('/user/votes', requireAuth, VoteController.getUserVotes);

export default app;
