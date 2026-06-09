import { Hono } from 'hono';
import { SystemSettings } from '@/entities/SystemSettings';
import { isRedisConnected, ManifestCacheService } from '@/lib/redis';

const publicRoutes = new Hono();

/**
 * @openapi
 * /public/tos:
 *   get:
 *     summary: Get Terms and Conditions content
 *     tags: [Public]
 *     description: Retrieves the current Terms and Conditions content and status for public display.
 *     responses:
 *       200:
 *         description: ToS content retrieved successfully.
 *         content:
 *           application/vnd.api+json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     content:
 *                       type: string
 *                       description: Terms and Conditions content in markdown
 *                     enabled:
 *                       type: boolean
 *                       description: Whether ToS acceptance is required
 *       500:
 *         description: Internal Server Error.
 */
publicRoutes.get('/tos', async (c) => {
    const content = await SystemSettings.getToSContent();
    const enabled = await SystemSettings.isToSEnabled();

    return c.json({
        data: {
            content: content || '',
            enabled
        }
    });
});

/**
 * @openapi
 * /public/health:
 *   get:
 *     summary: System health check
 *     tags: [Public]
 *     description: Returns the health status of the system including database and cache.
 *     responses:
 *       200:
 *         description: System health status.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [healthy, degraded]
 *                 database:
 *                   type: object
 *                   properties:
 *                     connected:
 *                       type: boolean
 *                 cache:
 *                   type: object
 *                   properties:
 *                     enabled:
 *                       type: boolean
 *                     connected:
 *                       type: boolean
 *                     stats:
 *                       type: object
 *                       nullable: true
 *                       properties:
 *                         hits:
 *                           type: number
 *                         misses:
 *                           type: number
 */
publicRoutes.get('/health', async (c) => {
    const redisConnected = isRedisConnected();
    const cacheStats = redisConnected ? await ManifestCacheService.getStats() : null;

    return c.json({
        status: redisConnected ? 'healthy' : 'degraded',
        database: {
            connected: true // If we're responding, DB is connected
        },
        cache: {
            enabled: redisConnected,
            connected: redisConnected,
            stats: cacheStats
        },
        timestamp: new Date().toISOString()
    });
});

export default publicRoutes;