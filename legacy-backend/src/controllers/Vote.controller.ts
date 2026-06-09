import { type Context } from 'hono';
import { VoteService, type VoteType } from "@/services/vote.service";
import { Modpack } from "@/entities/Modpack";
import { serializeError } from "@/utils/jsonapi";
import { AuthVariables } from "@/middlewares/auth.middleware";

export class VoteController {
    /**
     * Vote on a modpack (POST /api/v1/modpacks/:modpackId/vote)
     */
    static async voteOnModpack(c: Context<{ Variables: AuthVariables }>): Promise<Response> {
        const modpackId = c.req.param('modpackId');
        const user = c.get('user');

        if (!user) {
            return c.json(serializeError({
                status: '401',
                title: 'Unauthorized',
                detail: 'Authentication required.',
            }), 401);
        }

        try {
            const { vote } = await c.req.json();

            // Validate vote type
            if (!['like', 'dislike', 'none'].includes(vote)) {
                return c.json(serializeError({
                    status: '400',
                    title: 'Bad Request',
                    detail: 'Invalid vote type. Must be "like", "dislike", or "none".',
                }), 400);
            }

            // Get modpack
            const modpack = await Modpack.findOne({ where: { id: modpackId } });

            if (!modpack) {
                return c.json(serializeError({
                    status: '404',
                    title: 'Not Found',
                    detail: 'Modpack not found.',
                }), 404);
            }

            // Vote on modpack
            const voteResult = await VoteService.voteOnModpack(user, modpack, vote as VoteType);

            // Get updated vote counts
            const voteCounts = await VoteService.getVoteCounts(modpackId);

            return c.json({
                success: true,
                vote: voteResult ? (voteResult.vote === 1 ? 'like' : 'dislike') : 'none',
                counts: voteCounts
            }, 200);

        } catch (error: any) {
            console.error(`[VOTE_CONTROLLER] Error voting on modpack ${modpackId}:`, error);
            const statusCode = error.statusCode || 500;
            return c.json(serializeError({
                status: statusCode.toString(),
                title: error.name || 'Vote Error',
                detail: error.message || 'Failed to vote on modpack.'
            }), statusCode);
        }
    }

    /**
     * Get vote counts for a modpack (GET /api/v1/modpacks/:modpackId/votes)
     */
    static async getVoteCounts(c: Context): Promise<Response> {
        const modpackId = c.req.param('modpackId');

        try {
            const counts = await VoteService.getVoteCounts(modpackId);

            return c.json({
                modpackId,
                likes: counts.likes,
                dislikes: counts.dislikes,
                total: counts.likes + counts.dislikes
            }, 200);

        } catch (error: any) {
            console.error(`[VOTE_CONTROLLER] Error getting vote counts for ${modpackId}:`, error);
            const statusCode = error.statusCode || 500;
            return c.json(serializeError({
                status: statusCode.toString(),
                title: error.name || 'Vote Counts Error',
                detail: error.message || 'Failed to get vote counts.'
            }), statusCode);
        }
    }

    /**
     * Get user's votes (GET /api/v1/user/votes)
     */
    static async getUserVotes(c: Context<{ Variables: AuthVariables }>): Promise<Response> {
        const user = c.get('user');

        if (!user) {
            return c.json(serializeError({
                status: '401',
                title: 'Unauthorized',
                detail: 'Authentication required.',
            }), 401);
        }

        try {
            const votesMap = await VoteService.getUserVotesMap(user.id);

            return c.json({
                votes: votesMap
            }, 200);

        } catch (error: any) {
            console.error('[VOTE_CONTROLLER] Error getting user votes:', error);
            const statusCode = error.statusCode || 500;
            return c.json(serializeError({
                status: statusCode.toString(),
                title: error.name || 'User Votes Error',
                detail: error.message || 'Failed to get user votes.'
            }), statusCode);
        }
    }
}
