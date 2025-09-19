import { Hono } from 'hono';
import { requireAuth } from '@/middlewares/auth.middleware';
import { PublisherPermissionsController } from '@/controllers/PublisherPermissions.controller';

const app = new Hono();

/**
 * @openapi
 * /v1/publishers/{publisherId}/members:
 *   get:
 *     summary: Get all members of a publisher
 *     tags: [Publisher Permissions]
 *     description: Gets all members of a publisher with their roles and permissions. Requires manage_members permission.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: publisherId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Publisher ID
 *     responses:
 *       200:
 *         description: Members retrieved successfully
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Publisher not found
 */
app.get('/:publisherId/members', requireAuth, PublisherPermissionsController.getMembers);

/**
 * @openapi
 * /v1/publishers/{publisherId}/members:
 *   post:
 *     summary: Add a new member to a publisher
 *     tags: [Publisher Permissions]
 *     description: Adds a new member to a publisher with a specific role. Requires manage_members permission.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: publisherId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Publisher ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - role
 *             properties:
 *               userId:
 *                 type: string
 *                 format: uuid
 *                 description: User ID to add as member
 *               role:
 *                 type: string
 *                 enum: [owner, admin, member]
 *                 description: Role to assign to the member
 *     responses:
 *       201:
 *         description: Member added successfully
 *       400:
 *         description: Invalid request data
 *       403:
 *         description: Insufficient permissions
 */
app.post('/:publisherId/members', requireAuth, PublisherPermissionsController.addMember);

/**
 * @openapi
 * /v1/publishers/{publisherId}/members/{userId}/role:
 *   put:
 *     summary: Update a member's role
 *     tags: [Publisher Permissions]
 *     description: Updates a member's role in the publisher. Requires manage_members permission.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: publisherId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Publisher ID
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - role
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [owner, admin, member]
 *                 description: New role for the member
 *     responses:
 *       200:
 *         description: Role updated successfully
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Member not found
 */
app.put('/:publisherId/members/:userId/role', requireAuth, PublisherPermissionsController.updateMemberRole);

/**
 * @openapi
 * /v1/publishers/{publisherId}/members/{userId}:
 *   delete:
 *     summary: Remove a member from a publisher
 *     tags: [Publisher Permissions]
 *     description: Removes a member from the publisher. Requires manage_members permission.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: publisherId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Publisher ID
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: User ID to remove
 *     responses:
 *       204:
 *         description: Member removed successfully
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Member not found
 */
app.delete('/:publisherId/members/:userId', requireAuth, PublisherPermissionsController.removeMember);

/**
 * @openapi
 * /v1/publishers/{publisherId}/permissions:
 *   post:
 *     summary: Assign or revoke a specific permission
 *     tags: [Publisher Permissions]
 *     description: Assigns or revokes a specific permission for a member. Requires modpack.manage_access permission.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: publisherId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Publisher ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - permission
 *               - enable
 *             properties:
 *               userId:
 *                 type: string
 *                 format: uuid
 *                 description: User ID to assign permission to
 *               permission:
 *                 type: string
 *                 enum: 
 *                   - modpack.view
 *                   - modpack.modify
 *                   - modpack.manage_versions
 *                   - modpack.publish
 *                   - modpack.delete
 *                   - modpack.manage_access
 *                   - publisher.manage_categories_tags
 *                   - publisher.view_stats
 *                 description: Permission to assign or revoke
 *               enable:
 *                 type: boolean
 *                 description: Whether to enable (true) or revoke (false) the permission
 *               modpackId:
 *                 type: string
 *                 format: uuid
 *                 description: Optional modpack ID for modpack-specific permissions
 *     responses:
 *       200:
 *         description: Permission assigned successfully
 *       400:
 *         description: Invalid request data
 *       403:
 *         description: Insufficient permissions
 */
app.post('/:publisherId/permissions', requireAuth, PublisherPermissionsController.assignPermission);

/**
 * @openapi
 * /v1/publishers/{publisherId}/members/{userId}/permissions:
 *   get:
 *     summary: Get member permissions
 *     tags: [Publisher Permissions]
 *     description: Gets all permissions/scopes for a specific member. Requires manage_members or modpack.manage_access permission.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: publisherId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Publisher ID
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: User ID
 *     responses:
 *       200:
 *         description: Permissions retrieved successfully
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Member not found
 */
app.get('/:publisherId/members/:userId/permissions', requireAuth, PublisherPermissionsController.getMemberPermissions);

export default app;