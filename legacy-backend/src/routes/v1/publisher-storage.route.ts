import { Hono } from 'hono';
import { requireAuth } from '@/middlewares/auth.middleware';
import { PublisherStorageController } from '@/controllers/PublisherStorage.controller';

const app = new Hono();

/**
 * @openapi
 * /v1/publishers/{publisherId}/upload/{type}:
 *   post:
 *     summary: Upload publisher logo or banner
 *     tags: [Publisher Storage]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: publisherId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [logo, banner]
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Upload successful
 */
app.post('/:publisherId/upload/:type', requireAuth, PublisherStorageController.uploadImage);

export default app;
