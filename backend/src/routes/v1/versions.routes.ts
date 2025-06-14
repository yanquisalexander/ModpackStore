import { Router } from 'express';
// Corrected import to use UserModpacksController directly
import { UserModpacksController } from '../../controllers/UserModpacksController';
import { requireAuth } from '../../middleware/requireAuth';
import { validateCanManageModpack } from '../../middleware/validateCanManageModpack';
// Assuming upload middleware for version files
import { upload } from '../../middleware/upload.middleware'; // Path may vary, ensure it's configured for version files

// This router is mounted at /modpacks/:modpackId/versions
// So, '/' here refers to /modpacks/:modpackId/versions
const router = Router({ mergeParams: true }); // Ensure mergeParams is true to access :modpackId

/**
 * @openapi
 * /modpacks/{modpackId}/versions:
 *   post:
 *     summary: Create a new version for a modpack
 *     tags: [Versions]
 *     description: Creates a new version for the specified modpack. User must have management permissions for the modpack.
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
 *                     example: modpackVersion
 *                   attributes:
 *                     $ref: '#/components/schemas/NewModpackVersionAttributes'
 *     responses:
 *       201:
 *         description: Modpack version created successfully.
 *         content:
 *           application/vnd.api+json:
 *             schema:
 *               $ref: '#/components/schemas/ModpackVersionResource'
 *       400: { description: "Bad Request (validation error)" }
 *       401: { description: "Unauthorized" }
 *       403: { description: "Forbidden (cannot manage this modpack)" }
 *       404: { description: "Modpack not found" }
 */
router.post(
  '/',
  requireAuth,
  validateCanManageModpack, // This middleware needs access to modpackId from params
  UserModpacksController.createModpackVersion,
);

/**
 * @openapi
 * /modpacks/{modpackId}/versions:
 *   get:
 *     summary: List all versions for a modpack
 *     tags: [Versions]
 *     description: Retrieves a list of all versions for the specified modpack. User must have at least view permissions for the modpack.
 *     security:
 *       - bearerAuth: [] # Or could be less strict depending on if public modpacks can list versions
 *     parameters:
 *       - $ref: '#/components/parameters/ModpackIdPath'
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: status # Filter by version status
 *         schema: { type: string, enum: [draft, published, archived, processing, failed] }
 *     responses:
 *       200:
 *         description: A list of modpack versions.
 *         content:
 *           application/vnd.api+json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ModpackVersionResource'
 *                 meta:
 *                   type: object
 *                   properties:
 *                     totalItems: { type: 'integer' }
 *       401: { description: "Unauthorized" }
 *       403: { description: "Forbidden" }
 *       404: { description: "Modpack not found" }
 */
router.get(
    '/',
    requireAuth, // Or a more lenient auth if public can view versions
    validateCanManageModpack, // Or validateCanViewModpack if that's sufficient
    UserModpacksController.listModpackVersions
);

/**
 * @openapi
 * /modpacks/{modpackId}/versions/{versionId}:
 *   patch:
 *     summary: Update a modpack version
 *     tags: [Versions]
 *     description: Updates details for a specific modpack version. User must have management permissions for the modpack.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/ModpackIdPath'
 *       - $ref: '#/components/parameters/VersionIdPath'
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
 *                     example: modpackVersion
 *                   attributes:
 *                     $ref: '#/components/schemas/UpdateModpackVersionAttributes'
 *     responses:
 *       200:
 *         description: Modpack version updated successfully.
 *         content:
 *           application/vnd.api+json:
 *             schema:
 *               $ref: '#/components/schemas/ModpackVersionResource'
 *       400: { description: "Bad Request" }
 *       401: { description: "Unauthorized" }
 *       403: { description: "Forbidden" }
 *       404: { description: "Modpack or Version not found" }
 */
router.patch(
  '/:versionId',
  requireAuth,
  validateCanManageModpack,
  UserModpacksController.updateModpackVersion,
);

/**
 * @openapi
 * /modpacks/{modpackId}/versions/{versionId}:
 *   delete:
 *     summary: Delete a modpack version
 *     tags: [Versions]
 *     description: Deletes a specific modpack version. User must have management permissions for the modpack. This is a soft delete.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/ModpackIdPath'
 *       - $ref: '#/components/parameters/VersionIdPath'
 *     responses:
 *       204:
 *         description: Modpack version deleted successfully.
 *       401: { description: "Unauthorized" }
 *       403: { description: "Forbidden" }
 *       404: { description: "Modpack or Version not found" }
 */
router.delete(
  '/:versionId',
  requireAuth,
  validateCanManageModpack,
  UserModpacksController.deleteModpackVersion, // Assuming this method exists
);

/**
 * @openapi
 * /modpacks/{modpackId}/versions/{versionId}/file:
 *   post:
 *     summary: Upload a file for a modpack version
 *     tags: [Versions]
 *     description: Uploads the actual modpack archive (e.g., .zip) for a specific version. User must have management permissions.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/ModpackIdPath'
 *       - $ref: '#/components/parameters/VersionIdPath'
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               versionFile: # Or 'file', must match upload middleware config
 *                 type: string
 *                 format: binary
 *                 description: The modpack version archive file.
 *     responses:
 *       200:
 *         description: File uploaded successfully. Returns updated version details with file URL.
 *         content:
 *           application/vnd.api+json:
 *             schema:
 *               $ref: '#/components/schemas/VersionFileUploadResponse' # Or ModpackVersionResource with updated file attributes
 *       400: { description: "Bad Request (no file, invalid type/size)" }
 *       401: { description: "Unauthorized" }
 *       403: { description: "Forbidden" }
 *       404: { description: "Modpack or Version not found" }
 */
router.post(
  '/:versionId/file',
  requireAuth,
  validateCanManageModpack,
  upload.single('versionFile'), // Field name for the version file
  UserModpacksController.uploadModpackVersionFile, // Assuming this method exists
);

/**
 * @openapi
 * /modpacks/{modpackId}/versions/{versionId}/publish:
 *   post:
 *     summary: Publish a modpack version
 *     tags: [Versions]
 *     description: Marks a modpack version as published, making it available. User must have management permissions.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/ModpackIdPath'
 *       - $ref: '#/components/parameters/VersionIdPath'
 *     responses:
 *       200:
 *         description: Modpack version published successfully.
 *         content:
 *           application/vnd.api+json:
 *             schema:
 *               $ref: '#/components/schemas/ModpackVersionResource' # Version with status 'published'
 *       400: { description: "Bad Request (e.g., version not in a publishable state)" }
 *       401: { description: "Unauthorized" }
 *       403: { description: "Forbidden" }
 *       404: { description: "Modpack or Version not found" }
 */
router.post(
  '/:versionId/publish',
  requireAuth,
  validateCanManageModpack,
  UserModpacksController.publishModpackVersion,
);

// Helper for VersionId parameter
/**
 * @openapi
 * components:
 *   parameters:
 *     VersionIdPath:
 *       name: versionId
 *       in: path
 *       required: true
 *       description: The ID of the modpack version.
 *       schema:
 *         type: string
 *         format: uuid
 */

export default router;
