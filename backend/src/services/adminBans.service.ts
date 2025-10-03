import { Ban } from '../entities/Ban';
import { User } from '../entities/User';
import { AuditService } from './audit.service';
import { wsManager } from './websocket.service';
import { IsNull } from 'typeorm';

export interface BanUserData {
    userId: string;
    adminId: string;
    reason?: string;
}

export interface BanHistoryItem {
    id: string;
    userId: string;
    user: {
        id: string;
        username: string;
        avatarUrl?: string;
    };
    adminId: string;
    admin: {
        id: string;
        username: string;
        avatarUrl?: string;
    };
    reason?: string;
    banDate: Date;
    unbanDate?: Date;
    unbannedBy?: {
        id: string;
        username: string;
        avatarUrl?: string;
    };
    isActive: boolean;
}

export async function banUser(data: BanUserData): Promise<Ban> {
    const { userId, adminId, reason } = data;

    // Get the user to ban
    const user = await User.findOne({ where: { id: userId } });
    if (!user) {
        throw new Error('User not found');
    }

    // Check if user is an admin
    if (user.isAdmin()) {
        throw new Error('Cannot ban administrators');
    }

    // Check if user is already banned
    const existingBan = await Ban.findOne({
        where: { userId, unbanDate: IsNull() },
        relations: ['admin']
    });

    if (existingBan) {
        throw new Error('User is already banned');
    }

    // Create the ban
    const ban = new Ban();
    ban.userId = userId;
    ban.adminId = adminId;
    ban.reason = reason;

    const savedBan = await ban.save();

    // Log the audit event
    await AuditService.logUserBanned(adminId, userId, {
        reason: reason || 'No reason provided'
    });

    // Disconnect user from WebSocket if connected
    wsManager.disconnectUser(userId, 'USER_BANNED');

    return savedBan;
}

export async function unbanUser(userId: string, adminId: string): Promise<void> {
    // Get the active ban
    const activeBan = await Ban.findOne({
        where: { userId, unbanDate: IsNull() }
    });

    if (!activeBan) {
        throw new Error('User is not banned');
    }

    // Update the ban
    activeBan.unbanDate = new Date();
    activeBan.unbannedById = adminId;
    await activeBan.save();

    // Log the audit event
    await AuditService.logUserUnbanned(adminId, userId);
}

export async function getUserBanHistory(userId: string): Promise<BanHistoryItem[]> {
    const bans = await Ban.find({
        where: { userId },
        relations: ['user', 'admin', 'unbannedBy'],
        order: { banDate: 'DESC' }
    });

    return bans.map(ban => ({
        id: ban.id,
        userId: ban.userId,
        user: {
            id: ban.user.id,
            username: ban.user.username,
            avatarUrl: ban.user.avatarUrl || undefined
        },
        adminId: ban.adminId,
        admin: {
            id: ban.admin.id,
            username: ban.admin.username,
            avatarUrl: ban.admin.avatarUrl || undefined
        },
        reason: ban.reason || undefined,
        banDate: ban.banDate,
        unbanDate: ban.unbanDate || undefined,
        unbannedBy: ban.unbannedBy ? {
            id: ban.unbannedBy.id,
            username: ban.unbannedBy.username,
            avatarUrl: ban.unbannedBy.avatarUrl || undefined
        } : undefined,
        isActive: ban.isActive()
    }));
}

export async function getAllBans(includeInactive: boolean = false): Promise<BanHistoryItem[]> {
    const queryBuilder = Ban.createQueryBuilder('ban')
        .leftJoinAndSelect('ban.user', 'user')
        .leftJoinAndSelect('ban.admin', 'admin')
        .leftJoinAndSelect('ban.unbannedBy', 'unbannedBy')
        .orderBy('ban.banDate', 'DESC');

    if (!includeInactive) {
        queryBuilder.where('ban.unbanDate IS NULL');
    }

    const bans = await queryBuilder.getMany();

    return bans.map(ban => ({
        id: ban.id,
        userId: ban.userId,
        user: {
            id: ban.user.id,
            username: ban.user.username,
            avatarUrl: ban.user.avatarUrl || undefined
        },
        adminId: ban.adminId,
        admin: {
            id: ban.admin.id,
            username: ban.admin.username,
            avatarUrl: ban.admin.avatarUrl || undefined
        },
        reason: ban.reason || undefined,
        banDate: ban.banDate,
        unbanDate: ban.unbanDate || undefined,
        unbannedBy: ban.unbannedBy ? {
            id: ban.unbannedBy.id,
            username: ban.unbannedBy.username,
            avatarUrl: ban.unbannedBy.avatarUrl || undefined
        } : undefined,
        isActive: ban.isActive()
    }));
}

export async function checkUserBanStatus(userId: string): Promise<{ isBanned: boolean; ban?: BanHistoryItem }> {
    const activeBan = await Ban.findOne({
        where: { userId, unbanDate: IsNull() },
        relations: ['admin']
    });

    if (!activeBan) {
        return { isBanned: false };
    }

    return {
        isBanned: true,
        ban: {
            id: activeBan.id,
            userId: activeBan.userId,
            user: {
                id: activeBan.user.id,
                username: activeBan.user.username,
                avatarUrl: activeBan.user.avatarUrl || undefined
            },
            adminId: activeBan.adminId,
            admin: {
                id: activeBan.admin.id,
                username: activeBan.admin.username,
                avatarUrl: activeBan.admin.avatarUrl || undefined
            },
            reason: activeBan.reason || undefined,
            banDate: activeBan.banDate,
            unbanDate: undefined,
            unbannedBy: undefined,
            isActive: true
        }
    };
}
