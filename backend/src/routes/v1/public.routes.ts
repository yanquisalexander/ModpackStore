import { Hono } from 'hono';
import { SystemSettings } from '@/entities/SystemSettings';

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

export default publicRoutes;