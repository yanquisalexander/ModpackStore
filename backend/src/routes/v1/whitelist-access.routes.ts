import { Hono } from 'hono';
import { requireAuth } from '@/middlewares/auth.middleware';
import { WhitelistService } from '@/services/whitelist.service';
import { User } from '@/entities/User';

const whitelistAccessRoute = new Hono();

// Apply authentication to all routes
whitelistAccessRoute.use('*', requireAuth);

// Check if user has access to a specific modpack
whitelistAccessRoute.get('/modpack/:modpackId', async (c) => {
    try {
        const { modpackId } = c.req.param();
        const user = c.get('user') as User;

        const hasAccess = await WhitelistService.hasAccess(modpackId, user.id);

        return c.json({
            data: {
                hasAccess,
                modpackId,
                userId: user.id
            }
        });
    } catch (error) {
        console.error('Error checking whitelist access:', error);
        return c.json({ error: 'Failed to check whitelist access' }, 500);
    }
});

// Get all modpacks user has whitelist access to
whitelistAccessRoute.get('/my-whitelists', async (c) => {
    try {
        const user = c.get('user') as User;

        const modpacks = await WhitelistService.getUserWhitelistedModpacks(user.id);

        return c.json({
            data: modpacks.map(modpack => ({
                id: modpack.id,
                name: modpack.name,
                slug: modpack.slug,
                shortDescription: modpack.shortDescription,
                iconUrl: modpack.iconUrl,
                bannerUrl: modpack.bannerUrl,
                publisher: {
                    id: modpack.publisher.id,
                    name: modpack.publisher.publisherName,
                    logoUrl: modpack.publisher.logoUrl
                },
                latestVersion: modpack.versions && modpack.versions.length > 0 
                    ? modpack.versions.sort((a, b) => 
                        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                    )[0].version
                    : null
            }))
        });
    } catch (error) {
        console.error('Error fetching user whitelists:', error);
        return c.json({ error: 'Failed to fetch whitelisted modpacks' }, 500);
    }
});

// Check if user is in any whitelists (for client to determine view mode)
whitelistAccessRoute.get('/has-any', async (c) => {
    try {
        const user = c.get('user') as User;

        const modpacks = await WhitelistService.getUserWhitelistedModpacks(user.id);

        return c.json({
            data: {
                hasWhitelists: modpacks.length > 0,
                count: modpacks.length
            }
        });
    } catch (error) {
        console.error('Error checking user whitelists:', error);
        return c.json({ error: 'Failed to check user whitelists' }, 500);
    }
});

export default whitelistAccessRoute;
