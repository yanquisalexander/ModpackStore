"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const hono_1 = require("hono");
// TODO: CONTROLLER_MISMATCH - The 'adminController' methods used below (getUsers, updateUser, etc.)
// are not defined in 'AdminPublishers.controller.ts'. A different controller is needed for these routes.
// For now, placeholder handlers are used.
// import { adminController } from '../../controllers'; // This would point to an index exporting various controllers
// TODO: MIGRATE_MIDDLEWARE - requireAuth (Passport.middleware) needs to be migrated and re-enabled.
// TODO: MIGRATE_MIDDLEWARE - validateAdmin (likely adminAuthMiddleware from adminAuth.middleware.ts) needs to be migrated and re-enabled.
// import { requireAuth } from '../../middleware/requireAuth';
// import { validateAdmin } from '../../middleware/validateAdmin';
const jsonapi_1 = require("../../utils/jsonapi"); // For placeholder responses
const adminRoutes = new hono_1.Hono();
// adminRoutes.use('*', requireAuth, validateAdmin); // Commented out as per instructions
// Placeholder handler for missing controller methods
const notImplementedHandler = (c) => {
    console.warn(`[ADMIN_ROUTES] Route ${c.req.path} is calling a non-existent controller method due to CONTROLLER_MISMATCH.`);
    return c.json((0, jsonapi_1.serializeError)({
        status: '501',
        title: 'Not Implemented',
        detail: `The functionality for ${c.req.method} ${c.req.path} is not yet implemented or controller is mismatched.`
    }), 501);
};
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
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       # ... other parameters
 *     responses:
 *       200:
 *         description: A list of users.
 *       401:
 *         description: Unauthorized.
 *       403:
 *         description: Forbidden.
 *       501:
 *         description: Not Implemented (due to controller mismatch).
 */
// TODO: CONTROLLER_MISMATCH - Replace with actual adminController.getUsers when available
adminRoutes.get('/users', notImplementedHandler);
/**
 * @openapi
 * /admin/users/{userId}:
 *   patch:
 *     summary: Update a user's details (Admin)
 *     tags: [Admin]
 *     description: Allows an admin to update a specific user's information.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/vnd.api+json:
 *           schema: # Define schema appropriately
 *             type: object
 *     responses:
 *       200:
 *         description: User updated successfully.
 *       400:
 *         description: Bad Request.
 *       401:
 *         description: Unauthorized.
 *       403:
 *         description: Forbidden.
 *       404:
 *         description: User not found.
 *       501:
 *         description: Not Implemented (due to controller mismatch).
 */
// TODO: CONTROLLER_MISMATCH - Replace with actual adminController.updateUser when available
adminRoutes.patch('/users/:userId', notImplementedHandler);
/**
 * @openapi
 * /admin/modpacks:
 *   get:
 *     summary: List all modpacks (Admin)
 *     tags: [Admin]
 *     description: Retrieves a list of all modpacks in the system.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       # Add pagination, filtering parameters
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
 *     responses:
 *       200:
 *         description: A list of modpacks.
 *       401:
 *         description: Unauthorized.
 *       403:
 *         description: Forbidden.
 *       501:
 *         description: Not Implemented (due to controller mismatch).
 */
// TODO: CONTROLLER_MISMATCH - Replace with actual adminController.getModpacks when available
adminRoutes.get('/modpacks', notImplementedHandler);
/**
 * @openapi
 * /admin/modpacks/{modpackId}:
 *   patch:
 *     summary: Update a modpack's details (Admin)
 *     tags: [Admin]
 *     description: Allows an admin to update any detail of a modpack.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: modpackId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/vnd.api+json:
 *           schema: # Define schema appropriately
 *             type: object
 *     responses:
 *       200:
 *         description: Modpack updated successfully.
 *       400:
 *         description: Bad Request.
 *       401:
 *         description: Unauthorized.
 *       403:
 *         description: Forbidden.
 *       404:
 *         description: Modpack not found.
 *       501:
 *         description: Not Implemented (due to controller mismatch).
 */
// TODO: CONTROLLER_MISMATCH - Replace with actual adminController.updateModpack when available
adminRoutes.patch('/modpacks/:modpackId', notImplementedHandler);
// Montar el router de usuarios admin de Express bajo /users
// Note: The original admin.routes.ts only had GET /users, PATCH /users/:userId, GET /modpacks, PATCH /modpacks/:modpackId.
// It did NOT include routes for the AdminPublishersController methods (createPublisher, listPublishers etc.).
// Those would need to be added here if they are intended to be under the /admin path.
// For example:
// import { AdminPublishersController } from '../../controllers/AdminPublishers.controller';
// adminRoutes.post('/publishers', AdminPublishersController.createPublisher);
// adminRoutes.get('/publishers', AdminPublishersController.listPublishers);
// adminRoutes.get('/publishers/:publisherId', AdminPublishersController.getPublisher);
// adminRoutes.put('/publishers/:publisherId', AdminPublishersController.updatePublisher); // Or .patch
// adminRoutes.delete('/publishers/:publisherId', AdminPublishersController.deletePublisher);
exports.default = adminRoutes;
