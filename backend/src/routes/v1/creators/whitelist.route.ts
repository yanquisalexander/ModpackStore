import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { requireAuth } from '@/middlewares/auth.middleware';
import { WhitelistService } from '@/services/whitelist.service';
import { User } from '@/entities/User';

const whitelistRoute = new Hono();

// Apply authentication to all routes
whitelistRoute.use('*', requireAuth);

// Validation schemas
const addToWhitelistSchema = z.object({
    userId: z.string().uuid().optional(),
    discordUsername: z.string().optional(),
    notes: z.string().optional()
}).refine(data => data.userId || data.discordUsername, {
    message: 'Either userId or discordUsername must be provided'
});

const bulkAddSchema = z.object({
    userIds: z.array(z.string().uuid()),
    notes: z.string().optional()
});

// Get whitelisted users for a modpack
whitelistRoute.get('/:modpackId', async (c) => {
    try {
        const { modpackId } = c.req.param();
        const user = c.get('user') as User;

        const users = await WhitelistService.getWhitelistedUsers(modpackId, user.id);

        return c.json({
            data: users.map(u => ({
                id: u.id,
                username: u.username,
                discordId: u.discordId,
                avatarUrl: u.avatarUrl
            }))
        });
    } catch (error) {
        console.error('Error fetching whitelisted users:', error);
        const message = error instanceof Error ? error.message : 'Failed to fetch whitelisted users';
        const status = message.includes('not found') ? 404 : 
                      message.includes('permission') ? 403 : 500;
        return c.json({ error: message }, status);
    }
});

// Get whitelist statistics for a modpack
whitelistRoute.get('/:modpackId/stats', async (c) => {
    try {
        const { modpackId } = c.req.param();
        const user = c.get('user') as User;

        const stats = await WhitelistService.getWhitelistStats(modpackId, user.id);

        return c.json({ data: stats });
    } catch (error) {
        console.error('Error fetching whitelist stats:', error);
        const message = error instanceof Error ? error.message : 'Failed to fetch whitelist statistics';
        const status = message.includes('not found') ? 404 : 
                      message.includes('permission') ? 403 : 500;
        return c.json({ error: message }, status);
    }
});

// Add user to whitelist
whitelistRoute.post('/:modpackId', zValidator('json', addToWhitelistSchema), async (c) => {
    try {
        const { modpackId } = c.req.param();
        const user = c.get('user') as User;
        const data = c.req.valid('json');

        let whitelist;

        if (data.userId) {
            whitelist = await WhitelistService.addToWhitelist({
                modpackId,
                userId: data.userId,
                addedByUserId: user.id,
                notes: data.notes
            });
        } else if (data.discordUsername) {
            whitelist = await WhitelistService.addToWhitelistByDiscord(
                modpackId,
                data.discordUsername,
                user.id,
                data.notes
            );
        }

        return c.json({
            message: 'User added to whitelist successfully',
            data: {
                id: whitelist!.id,
                userId: whitelist!.userId,
                createdAt: whitelist!.createdAt
            }
        }, 201);
    } catch (error) {
        console.error('Error adding user to whitelist:', error);
        const message = error instanceof Error ? error.message : 'Failed to add user to whitelist';
        const status = message.includes('not found') ? 404 : 
                      message.includes('permission') || message.includes('access') ? 403 :
                      message.includes('already') ? 409 : 500;
        return c.json({ error: message }, status);
    }
});

// Bulk add users to whitelist
whitelistRoute.post('/:modpackId/bulk', zValidator('json', bulkAddSchema), async (c) => {
    try {
        const { modpackId } = c.req.param();
        const user = c.get('user') as User;
        const { userIds, notes } = c.req.valid('json');

        const result = await WhitelistService.bulkAddToWhitelist(
            modpackId,
            userIds,
            user.id,
            notes
        );

        return c.json({
            message: `Bulk add completed: ${result.added} added, ${result.failed} failed`,
            data: result
        });
    } catch (error) {
        console.error('Error bulk adding users to whitelist:', error);
        const message = error instanceof Error ? error.message : 'Failed to bulk add users';
        const status = message.includes('not found') ? 404 : 
                      message.includes('permission') || message.includes('access') ? 403 : 500;
        return c.json({ error: message }, status);
    }
});

// Remove user from whitelist
whitelistRoute.delete('/:modpackId/user/:userId', async (c) => {
    try {
        const { modpackId, userId } = c.req.param();
        const user = c.get('user') as User;

        await WhitelistService.removeFromWhitelist(modpackId, userId, user.id);

        return c.json({
            message: 'User removed from whitelist successfully'
        });
    } catch (error) {
        console.error('Error removing user from whitelist:', error);
        const message = error instanceof Error ? error.message : 'Failed to remove user from whitelist';
        const status = message.includes('not found') ? 404 : 
                      message.includes('permission') ? 403 : 500;
        return c.json({ error: message }, status);
    }
});

// Clear entire whitelist
whitelistRoute.delete('/:modpackId/clear', async (c) => {
    try {
        const { modpackId } = c.req.param();
        const user = c.get('user') as User;

        const count = await WhitelistService.clearWhitelist(modpackId, user.id);

        return c.json({
            message: 'Whitelist cleared successfully',
            data: { removedCount: count }
        });
    } catch (error) {
        console.error('Error clearing whitelist:', error);
        const message = error instanceof Error ? error.message : 'Failed to clear whitelist';
        const status = message.includes('not found') ? 404 : 
                      message.includes('permission') ? 403 : 500;
        return c.json({ error: message }, status);
    }
});

// Export whitelist
whitelistRoute.get('/:modpackId/export', async (c) => {
    try {
        const { modpackId } = c.req.param();
        const user = c.get('user') as User;

        const exportData = await WhitelistService.exportWhitelist(modpackId, user.id);

        return c.json({ data: exportData });
    } catch (error) {
        console.error('Error exporting whitelist:', error);
        const message = error instanceof Error ? error.message : 'Failed to export whitelist';
        const status = message.includes('not found') ? 404 : 
                      message.includes('permission') ? 403 : 500;
        return c.json({ error: message }, status);
    }
});

export default whitelistRoute;
