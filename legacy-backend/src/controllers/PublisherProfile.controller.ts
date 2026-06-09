import { Context } from 'hono';
import { PublisherProfileService } from '@/services/publisher-profile.service';

export class PublisherProfileController {
    private static publisherProfileService = new PublisherProfileService();

    public static getProfile = async (c: Context) => {
        const publisherId = c.req.param('publisherId');
        const data = await PublisherProfileController.publisherProfileService.getProfile(publisherId);
        return c.json({ data, message: 'Publisher profile retrieved successfully' });
    };

    public static updateProfile = async (c: Context) => {
        const publisherId = c.req.param('publisherId');
        const body = await c.req.json();
        // Permission check should be handled by middleware or inside service with user context
        // For now relying on route-level auth middleware, but we need to verify user is admin of publisher
        const user = c.get('user');

        // TODO: Verify permissions here or use existing middleware

        const data = await PublisherProfileController.publisherProfileService.updateProfile(publisherId, body, user.id);
        return c.json({ data, message: 'Publisher profile updated successfully' });
    };
}
