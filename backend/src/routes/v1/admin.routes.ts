import { Router } from 'express';
import { adminController } from '../../controllers';
import { requireAuth } from '../../middleware/requireAuth';
import { validateAdmin } from '../../middleware/validateAdmin';

const router = Router();

router.use(requireAuth, validateAdmin);

/**
 * @openapi
 * /admin/users:
 *   get:
 *     summary: List all users (Admin)
 *     tags: [Admin]
 *     description: Retrieves a list of all users. Requires admin privileges.
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
 *         description: Number of users per page.
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [username, email, createdAt, role] # Example sortable fields
 *           default: createdAt
 *         description: Field to sort by.
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order.
 *     responses:
 *       200:
 *         description: A list of users.
 *         content:
 *           application/vnd.api+json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/UserResource' # Assuming UserResource is comprehensive enough for admin view
 *                 meta: # Example pagination meta
 *                   type: object
 *                   properties:
 *                     totalItems:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *                     currentPage:
 *                       type: integer
 *                     itemsPerPage:
 *                       type: integer
 *       401:
 *         description: Unauthorized.
 *         content:
 *           application/vnd.api+json:
 *             schema:
 *               $ref: '#/components/schemas/JsonApiErrorResponse'
 *       403:
 *         description: Forbidden - User is not an admin.
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
router.get('/users', adminController.getUsers);

/**
 * @openapi
 * /admin/users/{userId}:
 *   patch:
 *     summary: Update a user's details (Admin)
 *     tags: [Admin]
 *     description: Allows an admin to update a specific user's information, such as their role or username.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The ID of the user to update.
 *     requestBody:
 *       required: true
 *       content:
 *         application/vnd.api+json:
 *           schema:
 *             type: object
 *             properties:
 *               data:
 *                 type: object
 *                 required:
 *                   - type
 *                   - attributes
 *                 properties:
 *                   type:
 *                     type: string
 *                     example: user # Or a specific admin-user type if different
 *                   attributes:
 *                     $ref: '#/components/schemas/AdminUpdateUserAttributes'
 *     responses:
 *       200:
 *         description: User updated successfully.
 *         content:
 *           application/vnd.api+json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/UserResource' # Or an AdminUserResource if exists
 *       400:
 *         description: Bad Request - Invalid input data.
 *         content:
 *           application/vnd.api+json:
 *             schema:
 *               $ref: '#/components/schemas/JsonApiErrorResponse'
 *       401:
 *         description: Unauthorized.
 *         content:
 *           application/vnd.api+json:
 *             schema:
 *               $ref: '#/components/schemas/JsonApiErrorResponse'
 *       403:
 *         description: Forbidden - User is not an admin.
 *         content:
 *           application/vnd.api+json:
 *             schema:
 *               $ref: '#/components/schemas/JsonApiErrorResponse'
 *       404:
 *         description: User not found.
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
router.patch('/users/:userId', adminController.updateUser);

/**
 * @openapi
 * /admin/modpacks:
 *   get:
 *     summary: List all modpacks (Admin)
 *     tags: [Admin]
 *     description: Retrieves a list of all modpacks in the system, regardless of status or visibility. Requires admin privileges.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       # Add pagination, filtering (by status, publisher, etc.), sorting parameters as needed
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, published, archived, disabled, deleted]
 *         description: Filter by modpack status.
 *     responses:
 *       200:
 *         description: A list of modpacks.
 *         content:
 *           application/vnd.api+json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ModpackResource' # Or a more detailed AdminModpackResource
 *                 meta:
 *                   type: object
 *                   properties:
 *                     totalItems: { type: 'integer' }
 *                     totalPages: { type: 'integer' }
 *                     currentPage: { type: 'integer' }
 *       401:
 *         description: Unauthorized.
 *       403:
 *         description: Forbidden.
 *       500:
 *         description: Internal Server Error.
 */
router.get('/modpacks', adminController.getModpacks);

/**
 * @openapi
 * /admin/modpacks/{modpackId}:
 *   patch:
 *     summary: Update a modpack's details (Admin)
 *     tags: [Admin]
 *     description: Allows an admin to update any detail of a modpack, including status, visibility, or ownership.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: modpackId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The ID of the modpack to update.
 *     requestBody:
 *       required: true
 *       content:
 *         application/vnd.api+json:
 *           schema:
 *             type: object
 *             properties:
 *               data:
 *                 type: object
 *                 required:
 *                   - type
 *                   - attributes
 *                 properties:
 *                   type:
 *                     type: string
 *                     example: modpack # Or AdminModpack type
 *                   attributes:
 *                     $ref: '#/components/schemas/AdminUpdateModpackAttributes'
 *     responses:
 *       200:
 *         description: Modpack updated successfully.
 *         content:
 *           application/vnd.api+json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/ModpackResource' # Or AdminModpackResource
 *       400:
 *         description: Bad Request.
 *       401:
 *         description: Unauthorized.
 *       403:
 *         description: Forbidden.
 *       404:
 *         description: Modpack not found.
 *       500:
 *         description: Internal Server Error.
 */
router.patch('/modpacks/:modpackId', adminController.updateModpack);

export default router;
