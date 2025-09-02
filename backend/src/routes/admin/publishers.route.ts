import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { AdminPublishersController } from '../../controllers/AdminPublishers.controller';
import { PublisherMemberRole } from '../../types/enums';

const publishersRouter = new Hono();

// Validation schemas
const createPublisherSchema = z.object({
    publisherName: z.string().min(1).max(32),
    description: z.string().min(1),
    tosUrl: z.string().url(),
    privacyUrl: z.string().url(),
    bannerUrl: z.string().url(),
    logoUrl: z.string().url(),
    websiteUrl: z.string().url().optional(),
    discordUrl: z.string().url().optional()
});

const updatePublisherSchema = z.object({
    publisherName: z.string().min(1).max(32).optional(),
    description: z.string().min(1).optional(),
    tosUrl: z.string().url().optional(),
    privacyUrl: z.string().url().optional(),
    bannerUrl: z.string().url().optional(),
    logoUrl: z.string().url().optional(),
    websiteUrl: z.string().url().optional(),
    discordUrl: z.string().url().optional(),
    verified: z.boolean().optional(),
    partnered: z.boolean().optional(),
    banned: z.boolean().optional(),
    isHostingPartner: z.boolean().optional()
});

const addMemberSchema = z.object({
    userId: z.string().uuid(),
    role: z.nativeEnum(PublisherMemberRole)
});

const updateMemberRoleSchema = z.object({
    role: z.nativeEnum(PublisherMemberRole)
});

const querySchema = z.object({
    page: z.string().transform(val => parseInt(val, 10)).optional(),
    limit: z.string().transform(val => parseInt(val, 10)).optional(),
    search: z.string().optional(),
    verified: z.string().transform(val => val === 'true').optional(),
    partnered: z.string().transform(val => val === 'true').optional(),
    sortBy: z.enum(['publisherName', 'createdAt', 'verified', 'partnered']).optional(),
    sortOrder: z.enum(['ASC', 'DESC']).optional()
});

// Routes
publishersRouter.get('/', zValidator('query', querySchema), AdminPublishersController.listPublishers);
publishersRouter.post('/', zValidator('json', createPublisherSchema), AdminPublishersController.createPublisher);
publishersRouter.get('/:publisherId', AdminPublishersController.getPublisher);
publishersRouter.put('/:publisherId', zValidator('json', updatePublisherSchema), AdminPublishersController.updatePublisher);
publishersRouter.delete('/:publisherId', AdminPublishersController.deletePublisher);

// Member management routes
publishersRouter.get('/:publisherId/members', AdminPublishersController.getPublisherMembers);
publishersRouter.post('/:publisherId/members', zValidator('json', addMemberSchema), AdminPublishersController.addMember);
publishersRouter.delete('/:publisherId/members/:userId', AdminPublishersController.removeMember);
publishersRouter.put('/:publisherId/members/:userId', zValidator('json', updateMemberRoleSchema), AdminPublishersController.updateMemberRole);

export default publishersRouter;