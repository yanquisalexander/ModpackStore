import { type Context } from 'hono';
import { RecommendationService } from "@/services/recommendation.service";
import { serializeError, serializeCollection } from "@/utils/jsonapi";
import { AuthVariables } from "@/middlewares/auth.middleware";

export class RecommendationController {
    /**
     * Get personalized recommendations for user (GET /api/v1/recommendations/for-you)
     */
    static async getRecommendationsForUser(c: Context<{ Variables: AuthVariables }>): Promise<Response> {
        const user = c.get('user');

        if (!user) {
            return c.json(serializeError({
                status: '401',
                title: 'Unauthorized',
                detail: 'Authentication required.',
            }), 401);
        }

        try {
            const limit = parseInt(c.req.query('limit') || '10');
            const recommendations = await RecommendationService.getRecommendationsForUser(user.id, limit);

            // Extract modpacks from recommendations
            const modpacks = recommendations.map(r => r.modpack);

            // Check if recommendations are from fallback
            const isFallback = recommendations.length > 0 && 
                (recommendations[0].algorithm === 'popular' || recommendations[0].algorithm === 'new');

            return c.json({
                data: serializeCollection('modpack', modpacks),
                meta: {
                    isFallback,
                    algorithm: recommendations.length > 0 ? recommendations[0].algorithm : null,
                    count: recommendations.length
                }
            }, 200);

        } catch (error: any) {
            console.error('[RECOMMENDATION_CONTROLLER] Error getting recommendations:', error);
            const statusCode = error.statusCode || 500;
            return c.json(serializeError({
                status: statusCode.toString(),
                title: error.name || 'Recommendations Error',
                detail: error.message || 'Failed to get recommendations.'
            }), statusCode);
        }
    }

    /**
     * Get related modpacks (GET /api/v1/recommendations/related-to/:modpackId)
     */
    static async getRelatedModpacks(c: Context): Promise<Response> {
        const modpackId = c.req.param('modpackId');

        try {
            const limit = parseInt(c.req.query('limit') || '10');
            const relatedModpacks = await RecommendationService.getRelatedModpacks(modpackId, undefined, limit);

            return c.json({
                data: serializeCollection('modpack', relatedModpacks),
                meta: {
                    count: relatedModpacks.length,
                    basedOn: modpackId
                }
            }, 200);

        } catch (error: any) {
            console.error(`[RECOMMENDATION_CONTROLLER] Error getting related modpacks for ${modpackId}:`, error);
            const statusCode = error.statusCode || 500;
            return c.json(serializeError({
                status: statusCode.toString(),
                title: error.name || 'Related Modpacks Error',
                detail: error.message || 'Failed to get related modpacks.'
            }), statusCode);
        }
    }

    /**
     * Trigger recommendation generation (admin only) (POST /api/v1/recommendations/generate)
     */
    static async generateRecommendations(c: Context<{ Variables: AuthVariables }>): Promise<Response> {
        const user = c.get('user');

        if (!user || !user.isAdmin()) {
            return c.json(serializeError({
                status: '403',
                title: 'Forbidden',
                detail: 'Admin access required.',
            }), 403);
        }

        try {
            // Run in background (don't wait for completion)
            RecommendationService.generateAllRecommendations()
                .then(() => console.log('[RECOMMENDATION] Batch generation completed'))
                .catch(err => console.error('[RECOMMENDATION] Batch generation failed:', err));

            return c.json({
                success: true,
                message: 'Recommendation generation started in background.'
            }, 202);

        } catch (error: any) {
            console.error('[RECOMMENDATION_CONTROLLER] Error starting recommendation generation:', error);
            const statusCode = error.statusCode || 500;
            return c.json(serializeError({
                status: statusCode.toString(),
                title: error.name || 'Generation Error',
                detail: error.message || 'Failed to start recommendation generation.'
            }), statusCode);
        }
    }
}
