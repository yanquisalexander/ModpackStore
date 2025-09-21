import { Context } from 'hono';
import { SystemSettings } from '@/entities/SystemSettings';
import { User } from '@/entities/User';
import { APIError } from '@/lib/APIError';
import { AuditService } from '@/services/audit.service';
import { AuthVariables } from '@/middlewares/auth.middleware';

interface ToSSettingsUpdatePayload {
    content?: string;
    enabled?: boolean;
}

export class SystemSettingsController {
    /**
     * Get Terms and Conditions settings
     */
    static async getToSSettings(c: Context<{ Variables: AuthVariables }>): Promise<Response> {
        const user = c.get('user');
        
        // Log admin access
        await AuditService.logAdminAccess(user.id, { 
            action: 'get_tos_settings'
        });

        const content = await SystemSettings.getToSContent();
        const enabled = await SystemSettings.isToSEnabled();

        return c.json({
            data: {
                content: content || '',
                enabled
            }
        });
    }

    /**
     * Update Terms and Conditions settings
     */
    static async updateToSSettings(c: Context<{ Variables: AuthVariables }>): Promise<Response> {
        const user = c.get('user');
        const body = await c.req.json<ToSSettingsUpdatePayload>();

        // Validate request body
        if (body.content === undefined && body.enabled === undefined) {
            throw new APIError(400, 'At least one field (content or enabled) must be provided', 'INVALID_REQUEST');
        }

        // Update content if provided
        if (body.content !== undefined) {
            await SystemSettings.setToSContent(body.content);
        }

        // Update enabled status if provided
        if (body.enabled !== undefined) {
            await SystemSettings.setToSEnabled(body.enabled);
        }

        // Log admin action
        await AuditService.logAdminAccess(user.id, { 
            action: 'update_tos_settings',
            changes: body
        });

        const content = await SystemSettings.getToSContent();
        const enabled = await SystemSettings.isToSEnabled();

        return c.json({
            data: {
                content: content || '',
                enabled
            }
        });
    }

    /**
     * Revoke all user Terms and Conditions acceptances
     */
    static async revokeAllToSAcceptances(c: Context<{ Variables: AuthVariables }>): Promise<Response> {
        const user = c.get('user');

        // Execute bulk update to set tosAcceptedAt to null for all users
        const result = await User.createQueryBuilder()
            .update(User)
            .set({ tosAcceptedAt: null })
            .where('tosAcceptedAt IS NOT NULL')
            .execute();

        const usersUpdated = result.affected || 0;

        // Log admin action
        await AuditService.logAdminAccess(user.id, { 
            action: 'revoke_all_tos_acceptances',
            usersUpdated
        });

        return c.json({
            data: {
                usersUpdated
            }
        });
    }
}