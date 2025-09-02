import { Context } from 'hono';
import { AuditService, AuditLogQueryOptions } from '../services/audit.service';
import { AuditAction } from '../entities/AuditLog';
import { USER_CONTEXT_KEY } from "@/middlewares/auth.middleware";
import { User } from "@/entities/User";

export class AuditController {
    static async listAuditLogs(c: Context) {
        try {
            const query = c.req.query();
            const options: AuditLogQueryOptions = {
                page: query.page ? parseInt(query.page) : 1,
                limit: query.limit ? Math.min(parseInt(query.limit), 100) : 20,
                userId: query.userId,
                action: query.action as AuditAction,
                startDate: query.startDate ? new Date(query.startDate) : undefined,
                endDate: query.endDate ? new Date(query.endDate) : undefined
            };

            const result = await AuditService.getLogs(options);

            // Log that audit logs were viewed
            const user = c.get(USER_CONTEXT_KEY) as User
            await AuditService.createLog({
                action: AuditAction.AUDIT_LOG_VIEWED,
                userId: user.id,
                details: { filters: options }
            });

            return c.json(result);
        } catch (err) {
            return c.json({ error: err instanceof Error ? err.message : String(err) }, 500);
        }
    }

    static async getAuditLog(c: Context) {
        try {
            const { logId } = c.req.param();
            const log = await AuditService.getLogById(logId);

            if (!log) {
                return c.json({ error: 'Audit log not found' }, 404);
            }

            return c.json(log);
        } catch (err) {
            return c.json({ error: err instanceof Error ? err.message : String(err) }, 500);
        }
    }

    static async getAuditActions(c: Context) {
        try {
            // Return available audit actions for filtering
            const actions = Object.values(AuditAction);
            return c.json({ actions });
        } catch (err) {
            return c.json({ error: err instanceof Error ? err.message : String(err) }, 500);
        }
    }
}