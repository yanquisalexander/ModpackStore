import { Context, Next } from 'hono';
import { APIError } from '@/lib/APIError';
import { User } from '@/entities/User';
import { Publisher } from '@/models/Publisher.model';
import { ModpackPermission, PublisherPermission } from '@/types/enums';
import { USER_CONTEXT_KEY } from './auth.middleware';

/**
 * Middleware to check if user has a specific modpack permission
 */
export function requireModpackPermission(permission: ModpackPermission) {
    return async (c: Context, next: Next) => {
        const user = c.get(USER_CONTEXT_KEY) as User;
        const { publisherId, modpackId } = c.req.param();

        if (!user) {
            throw new APIError(401, 'Unauthorized', 'USER_NOT_AUTHENTICATED');
        }

        if (!publisherId) {
            throw new APIError(400, 'Bad Request', 'PUBLISHER_ID_REQUIRED');
        }

        if (!modpackId) {
            throw new APIError(400, 'Bad Request', 'MODPACK_ID_REQUIRED');
        }

        try {
            const publisher = await Publisher.findById(publisherId);
            if (!publisher) {
                throw new APIError(404, 'Not Found', 'PUBLISHER_NOT_FOUND');
            }

            const hasPermission = await publisher.hasModpackPermission(user.id, modpackId, permission);
            if (!hasPermission) {
                throw new APIError(403, 'Forbidden', `MISSING_PERMISSION_${permission.toUpperCase()}`);
            }

            await next();
        } catch (error) {
            if (error instanceof APIError) {
                throw error;
            }
            throw new APIError(500, 'Internal Server Error', 'PERMISSION_CHECK_FAILED');
        }
    };
}

/**
 * Middleware to check if user has a specific publisher permission
 */
export function requirePublisherPermission(permission: PublisherPermission) {
    return async (c: Context, next: Next) => {
        const user = c.get(USER_CONTEXT_KEY) as User;
        const { publisherId } = c.req.param();

        if (!user) {
            throw new APIError(401, 'Unauthorized', 'USER_NOT_AUTHENTICATED');
        }

        if (!publisherId) {
            throw new APIError(400, 'Bad Request', 'PUBLISHER_ID_REQUIRED');
        }

        try {
            const publisher = await Publisher.findById(publisherId);
            if (!publisher) {
                throw new APIError(404, 'Not Found', 'PUBLISHER_NOT_FOUND');
            }

            const hasPermission = await publisher.hasPublisherPermission(user.id, permission);
            if (!hasPermission) {
                throw new APIError(403, 'Forbidden', `MISSING_PERMISSION_${permission.toUpperCase()}`);
            }

            await next();
        } catch (error) {
            if (error instanceof APIError) {
                throw error;
            }
            throw new APIError(500, 'Internal Server Error', 'PERMISSION_CHECK_FAILED');
        }
    };
}

/**
 * Middleware to check if user can manage members (Owner or Admin only)
 */
export async function requireMemberManagement(c: Context, next: Next) {
    const user = c.get(USER_CONTEXT_KEY) as User;
    const { publisherId } = c.req.param();

    if (!user) {
        throw new APIError(401, 'Unauthorized', 'USER_NOT_AUTHENTICATED');
    }

    if (!publisherId) {
        throw new APIError(400, 'Bad Request', 'PUBLISHER_ID_REQUIRED');
    }

    try {
        const publisher = await Publisher.findById(publisherId);
        if (!publisher) {
            throw new APIError(404, 'Not Found', 'PUBLISHER_NOT_FOUND');
        }

        const canManage = await publisher.canUserManageMembers(user.id);
        if (!canManage) {
            throw new APIError(403, 'Forbidden', 'INSUFFICIENT_ROLE_FOR_MEMBER_MANAGEMENT');
        }

        await next();
    } catch (error) {
        if (error instanceof APIError) {
            throw error;
        }
        throw new APIError(500, 'Internal Server Error', 'PERMISSION_CHECK_FAILED');
    }
}

/**
 * Middleware to check if user can manage a specific role
 */
export function requireRoleManagement(targetRole: string) {
    return async (c: Context, next: Next) => {
        const user = c.get(USER_CONTEXT_KEY) as User;
        const { publisherId } = c.req.param();

        if (!user) {
            throw new APIError(401, 'Unauthorized', 'USER_NOT_AUTHENTICATED');
        }

        if (!publisherId) {
            throw new APIError(400, 'Bad Request', 'PUBLISHER_ID_REQUIRED');
        }

        try {
            const publisher = await Publisher.findById(publisherId);
            if (!publisher) {
                throw new APIError(404, 'Not Found', 'PUBLISHER_NOT_FOUND');
            }

            const canManage = await publisher.canUserManageRole(user.id, targetRole as any);
            if (!canManage) {
                throw new APIError(403, 'Forbidden', 'INSUFFICIENT_ROLE_FOR_ROLE_MANAGEMENT');
            }

            await next();
        } catch (error) {
            if (error instanceof APIError) {
                throw error;
            }
            throw new APIError(500, 'Internal Server Error', 'PERMISSION_CHECK_FAILED');
        }
    };
}