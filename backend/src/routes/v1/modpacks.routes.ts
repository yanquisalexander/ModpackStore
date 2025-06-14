import { Router } from 'express';
// Corrected import to use UserModpacksController directly
import { UserModpacksController } from '../../controllers/UserModpacksController';
import { requireAuth } from '../../middleware/requireAuth';
import { validateCanManageModpack } from '../../middleware/validateCanManageModpack';
import { validateCanViewModpack } from '../../middleware/validateCanViewModpack';
// Assuming upload middleware is configured for handling file uploads (e.g., for logo)
import { upload } from '../../middleware/upload.middleware'; // Path may vary

const router = Router();

/**
 * @openapi
 * /modpacks:
 *   post:
 *     summary: Create a new modpack
 *     tags: [Modpacks]
 *     description: Creates a new modpack. The authenticated user becomes the creator.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/vnd.api+json:
 *           schema:
 *             type: object
 *             properties:
 *               data:
 *                 type: object
 *                 required: [type, attributes]
 *                 properties:
 *                   type:
 *                     type: string
 *                     example: modpack
 *                   attributes:
 *                     $ref: '#/components/schemas/NewModpackAttributes'
 *     responses:
 *       201:
 *         description: Modpack created successfully.
 *         content:
 *           application/vnd.api+json:
 *             schema:
 *               $ref: '#/components/schemas/ModpackResource'
 *       400:
 *         description: Bad Request (e.g., validation error).
 *       401:
 *         description: Unauthorized.
 *       403:
 *         description: Forbidden (e.g., insufficient permissions if specific checkModpackPermission is used).
 */
router.post('/', requireAuth, UserModpacksController.createModpack); // Added missing createModpack route

/**
 * @openapi
 * /modpacks:
 *   get:
 *     summary: List modpacks for the authenticated user
 *     tags: [Modpacks]
 *     description: Retrieves a list of modpacks associated with the authenticated user (e.g., created by them, or collaborator on).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *       # Add other filters like 'role' (owner, collaborator) if applicable
 *     responses:
 *       200:
 *         description: A list of the user's modpacks.
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
 *                     totalItems: { type: 'integer' }
 *       401:
 *         description: Unauthorized.
 */
router.get('/', requireAuth, UserModpacksController.listUserModpacks); // Added missing listUserModpacks route

/**
 * @openapi
 * /modpacks/{modpackId}:
 *   get:
 *     summary: Get a specific modpack
 *     tags: [Modpacks]
 *     description: Retrieves details for a specific modpack by its ID. User must have view permissions.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/ModpackIdPath'
 *     responses:
 *       200:
 *         description: Details of the modpack.
 *         content:
 *           application/vnd.api+json:
 *             schema:
 *               $ref: '#/components/schemas/ModpackResource'
 *       401:
 *         description: Unauthorized.
 *       403:
 *         description: Forbidden (user cannot view this modpack).
 *       404:
 *         description: Modpack not found.
 */
router.get(
  '/:modpackId',
  requireAuth,
  validateCanViewModpack,
  UserModpacksController.getModpack, // Assuming getModpack exists on UserModpacksController
);

/**
 * @openapi
 * /modpacks/{modpackId}:
 *   patch:
 *     summary: Update a modpack
 *     tags: [Modpacks]
 *     description: Updates details for a specific modpack. User must have management permissions.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/ModpackIdPath'
 *     requestBody:
 *       required: true
 *       content:
 *         application/vnd.api+json:
 *           schema:
 *             type: object
 *             properties:
 *               data:
 *                 type: object
 *                 required: [type, attributes]
 *                 properties:
 *                   type:
 *                     type: string
 *                     example: modpack
 *                   attributes:
 *                     $ref: '#/components/schemas/UpdateModpackAttributes'
 *     responses:
 *       200:
 *         description: Modpack updated successfully.
 *         content:
 *           application/vnd.api+json:
 *             schema:
 *               $ref: '#/components/schemas/ModpackResource'
 *       400:
 *         description: Bad Request (validation error).
 *       401:
 *         description: Unauthorized.
 *       403:
 *         description: Forbidden (user cannot manage this modpack).
 *       404:
 *         description: Modpack not found.
 */
router.patch(
  '/:modpackId',
  requireAuth,
  validateCanManageModpack,
  UserModpacksController.updateModpack,
);

/**
 * @openapi
 * /modpacks/{modpackId}:
 *   delete:
 *     summary: Delete a modpack
 *     tags: [Modpacks]
 *     description: Deletes a specific modpack. User must have management permissions. This is a soft delete.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/ModpackIdPath'
 *     responses:
 *       204:
 *         description: Modpack deleted successfully (No Content).
 *       401:
 *         description: Unauthorized.
 *       403:
 *         description: Forbidden (user cannot manage this modpack).
 *       404:
 *         description: Modpack not found.
 */
router.delete(
  '/:modpackId',
  requireAuth,
  validateCanManageModpack,
  UserModpacksController.deleteModpack,
);

/**
 * @openapi
 * /modpacks/{modpackId}/logo:
 *   post:
 *     summary: Upload a logo for a modpack
 *     tags: [Modpacks]
 *     description: Uploads or updates the logo for a specific modpack. User must have management permissions. Expects 'multipart/form-data'.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/ModpackIdPath'
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               logo: # Or whatever name your upload middleware expects, e.g., 'file'
 *                 type: string
 *                 format: binary
 *                 description: The logo image file (e.g., PNG, JPG).
 *     responses:
 *       200:
 *         description: Logo uploaded successfully. Returns updated modpack resource or just the new logo URL.
 *         content:
 *           application/vnd.api+json:
 *             schema:
 *               $ref: '#/components/schemas/LogoUploadResponse' # Or ModpackResource
 *       400:
 *         description: Bad Request (e.g., no file, invalid file type/size).
 *       401:
 *         description: Unauthorized.
 *       403:
 *         description: Forbidden.
 *       404:
 *         description: Modpack not found.
 */
router.post(
  '/:modpackId/logo',
  requireAuth,
  validateCanManageModpack,
  upload.single('logo'), // Assuming 'logo' is the field name for the file
  UserModpacksController.uploadLogo, // Assuming this method handles the file from req.file
);

/**
 * @openapi
 * /modpacks/{modpackId}/collaborators:
 *   post:
 *     summary: Add a collaborator to a modpack
 *     tags: [Modpacks]
 *     description: Adds a user as a collaborator to a specific modpack with a given role. User must have management permissions (typically owner).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/ModpackIdPath'
 *     requestBody:
 *       required: true
 *       content:
 *         application/vnd.api+json:
 *           schema:
 *             type: object
 *             properties:
 *               data:
 *                 type: object
 *                 required: [type, attributes]
 *                 properties:
 *                   type:
 *                     type: string
 *                     example: collaboratorInvitation # Or similar
 *                   attributes:
 *                     $ref: '#/components/schemas/AddCollaboratorRequestAttributes'
 *     responses:
 *       201:
 *         description: Collaborator added successfully.
 *         content:
 *           application/vnd.api+json:
 *             schema:
 *               $ref: '#/components/schemas/CollaboratorResource' # Or an array of current collaborators
 *       400:
 *         description: Bad Request (e.g., invalid user ID or role).
 *       401:
 *         description: Unauthorized.
 *       403:
 *         description: Forbidden (user cannot manage collaborators for this modpack).
 *       404:
 *         description: Modpack or User to add not found.
 *       409:
 *         description: Conflict (e.g., user is already a collaborator).
 */
router.post(
  '/:modpackId/collaborators',
  requireAuth,
  validateCanManageModpack,
  UserModpacksController.addCollaborator,
);

/**
 * @openapi
 * /modpacks/{modpackId}/collaborators/{userId}:
 *   delete:
 *     summary: Remove a collaborator from a modpack
 *     tags: [Modpacks]
 *     description: Removes a collaborator from a specific modpack. User must have management permissions (typically owner).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/ModpackIdPath'
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The ID of the user (collaborator) to remove.
 *     responses:
 *       204:
 *         description: Collaborator removed successfully (No Content).
 *       401:
 *         description: Unauthorized.
 *       403:
 *         description: Forbidden.
 *       404:
 *         description: Modpack or Collaborator not found.
 */
router.delete(
  '/:modpackId/collaborators/:userId',
  requireAuth,
  validateCanManageModpack,
  UserModpacksController.removeCollaborator,
);

// Helper to define common parameters
/**
 * @openapi
 * components:
 *   parameters:
 *     ModpackIdPath:
 *       name: modpackId
 *       in: path
 *       required: true
 *       description: The ID of the modpack.
 *       schema:
 *         type: string
 *         format: uuid
 */

export default router;
