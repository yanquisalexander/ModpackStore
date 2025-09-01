import { AuditLog, AuditAction } from '../entities/AuditLog';
import { User } from '../entities/User';

export interface CreateAuditLogData {
    action: AuditAction;
    userId?: string;
    targetUserId?: string;
    targetResourceId?: string;
    details?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
}

export interface AuditLogQueryOptions {
    page?: number;
    limit?: number;
    userId?: string;
    action?: AuditAction;
    startDate?: Date;
    endDate?: Date;
}

export interface PaginatedAuditLogs {
    logs: AuditLog[];
    total: number;
    page: number;
    totalPages: number;
}

export class AuditService {
    static async createLog(data: CreateAuditLogData): Promise<AuditLog> {
        const auditLog = new AuditLog();
        auditLog.action = data.action;
        auditLog.userId = data.userId || null;
        auditLog.targetUserId = data.targetUserId || null;
        auditLog.targetResourceId = data.targetResourceId || null;
        auditLog.details = data.details || null;
        auditLog.ipAddress = data.ipAddress || null;
        auditLog.userAgent = data.userAgent || null;

        return await auditLog.save();
    }

    static async getLogs(options: AuditLogQueryOptions = {}): Promise<PaginatedAuditLogs> {
        const {
            page = 1,
            limit = 20,
            userId,
            action,
            startDate,
            endDate
        } = options;

        const query = AuditLog.createQueryBuilder('audit_log')
            .leftJoinAndSelect('audit_log.user', 'user')
            .orderBy('audit_log.createdAt', 'DESC');

        if (userId) {
            query.andWhere('audit_log.userId = :userId', { userId });
        }

        if (action) {
            query.andWhere('audit_log.action = :action', { action });
        }

        if (startDate) {
            query.andWhere('audit_log.createdAt >= :startDate', { startDate });
        }

        if (endDate) {
            query.andWhere('audit_log.createdAt <= :endDate', { endDate });
        }

        const [logs, total] = await query
            .skip((page - 1) * limit)
            .take(limit)
            .getManyAndCount();

        return {
            logs,
            total,
            page,
            totalPages: Math.ceil(total / limit)
        };
    }

    static async getLogById(id: string): Promise<AuditLog | null> {
        return await AuditLog.findOne({
            where: { id },
            relations: ['user']
        });
    }

    // Convenience methods for common audit actions
    static async logUserLogin(userId: string, ipAddress?: string, userAgent?: string): Promise<AuditLog> {
        return this.createLog({
            action: AuditAction.USER_LOGIN,
            userId,
            ipAddress,
            userAgent
        });
    }

    static async logUserLogout(userId: string, ipAddress?: string, userAgent?: string): Promise<AuditLog> {
        return this.createLog({
            action: AuditAction.USER_LOGOUT,
            userId,
            ipAddress,
            userAgent
        });
    }

    static async logUserCreated(createdByUserId: string, targetUserId: string, details?: Record<string, any>): Promise<AuditLog> {
        return this.createLog({
            action: AuditAction.USER_CREATED,
            userId: createdByUserId,
            targetUserId,
            details
        });
    }

    static async logUserUpdated(updatedByUserId: string, targetUserId: string, details?: Record<string, any>): Promise<AuditLog> {
        return this.createLog({
            action: AuditAction.USER_UPDATED,
            userId: updatedByUserId,
            targetUserId,
            details
        });
    }

    static async logUserDeleted(deletedByUserId: string, targetUserId: string, details?: Record<string, any>): Promise<AuditLog> {
        return this.createLog({
            action: AuditAction.USER_DELETED,
            userId: deletedByUserId,
            targetUserId,
            details
        });
    }

    static async logUserRoleChanged(changedByUserId: string, targetUserId: string, details: { oldRole: string, newRole: string }): Promise<AuditLog> {
        return this.createLog({
            action: AuditAction.USER_ROLE_CHANGED,
            userId: changedByUserId,
            targetUserId,
            details
        });
    }

    static async logAdminAccess(userId: string, details?: Record<string, any>, ipAddress?: string, userAgent?: string): Promise<AuditLog> {
        return this.createLog({
            action: AuditAction.ADMIN_ACCESS,
            userId,
            details,
            ipAddress,
            userAgent
        });
    }
}