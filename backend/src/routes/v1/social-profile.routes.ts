import { Hono } from 'hono';
import { SocialProfileController } from '../../controllers/SocialProfile.controller';
import { requireAuth } from "@/middlewares/auth.middleware";

const socialProfileRoutes = new Hono();

/**
 * @openapi
 * /social/profile:
 *   get:
 *     summary: Get current user's social profile
 *     tags: [Social]
 *     security:
 *       - bearerAuth: []
 */
socialProfileRoutes.get('/profile', requireAuth, SocialProfileController.getProfile);

/**
 * @openapi
 * /social/profile/{userId}:
 *   get:
 *     summary: Get specific user's social profile
 *     tags: [Social]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 */
socialProfileRoutes.get('/profile/:userId', requireAuth, SocialProfileController.getProfile);

/**
 * @openapi
 * /social/profile/cover-image:
 *   post:
 *     summary: Update user's cover image (Patreon feature)
 *     tags: [Social]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               coverImageUrl:
 *                 type: string
 *                 required: true
 *                 description: URL of the cover image
 */
socialProfileRoutes.post('/profile/cover-image', requireAuth, SocialProfileController.updateCoverImage);

/**
 * @openapi
 * /social/profile/cover-image:
 *   delete:
 *     summary: Remove user's cover image
 *     tags: [Social]
 *     security:
 *       - bearerAuth: []
 */
socialProfileRoutes.delete('/profile/cover-image', requireAuth, SocialProfileController.removeCoverImage);

/**
 * @openapi
 * /social/profile/cover-image/upload:
 *   post:
 *     summary: Upload cover image file (Patreon feature)
 *     tags: [Social]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 */
socialProfileRoutes.post('/profile/cover-image/upload', requireAuth, SocialProfileController.uploadCoverImage);

/**
 * @openapi
 * /social/profile/patreon/status:
 *   get:
 *     summary: Get user's Patreon status and available features
 *     tags: [Social]
 *     security:
 *       - bearerAuth: []
 */
socialProfileRoutes.get('/profile/patreon/status', requireAuth, SocialProfileController.getPatreonStatus);

/**
 * @openapi
 * /social/profile/patreon/link:
 *   post:
 *     summary: Link Patreon account
 *     tags: [Social]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               code:
 *                 type: string
 *                 required: true
 *                 description: Patreon OAuth authorization code
 */
socialProfileRoutes.post('/profile/patreon/link', requireAuth, SocialProfileController.linkPatreon);

/**
 * @openapi
 * /social/profile/patreon/unlink:
 *   post:
 *     summary: Unlink Patreon account
 *     tags: [Social]
 *     security:
 *       - bearerAuth: []
 */
socialProfileRoutes.post('/profile/patreon/unlink', requireAuth, SocialProfileController.unlinkPatreon);

/**
 * @openapi
 * /social/profile/stats:
 *   get:
 *     summary: Get current user's social statistics
 *     tags: [Social]
 *     security:
 *       - bearerAuth: []
 */
socialProfileRoutes.get('/profile/stats', requireAuth, SocialProfileController.getSocialStats);

/**
 * @openapi
 * /social/profile/{userId}/stats:
 *   get:
 *     summary: Get specific user's social statistics
 *     tags: [Social]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 */
socialProfileRoutes.get('/profile/:userId/stats', requireAuth, SocialProfileController.getSocialStats);

export { socialProfileRoutes };