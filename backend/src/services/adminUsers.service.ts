import { User } from '../entities/User';
import { UserRole } from '../types/enums';
import { AuditService } from './audit.service';

export interface UserQueryOptions {
    page?: number;
    limit?: number;
    search?: string; // Search by username or email
    role?: UserRole;
    sortBy?: 'username' | 'email' | 'createdAt' | 'updatedAt';
    sortOrder?: 'ASC' | 'DESC';
}

export interface PaginatedUsers {
    users: User[];
    total: number;
    page: number;
    totalPages: number;
}

export interface CreateUserData {
    username: string;
    email: string;
    role?: UserRole;
    avatarUrl?: string;
}

export interface UpdateUserData {
    username?: string;
    email?: string;
    role?: UserRole;
    avatarUrl?: string;
}

export async function getAllUsers(options: UserQueryOptions = {}): Promise<PaginatedUsers> {
    const {
        page = 1,
        limit = 20,
        search,
        role,
        sortBy = 'createdAt',
        sortOrder = 'DESC'
    } = options;

    const query = User.createQueryBuilder('user')
        .select([
            'user.id',
            'user.username', 
            'user.email',
            'user.avatarUrl',
            'user.role',
            'user.createdAt',
            'user.updatedAt'
        ]);

    // Apply search filter
    if (search) {
        query.andWhere(
            '(user.username ILIKE :search OR user.email ILIKE :search)',
            { search: `%${search}%` }
        );
    }

    // Apply role filter
    if (role) {
        query.andWhere('user.role = :role', { role });
    }

    // Apply sorting
    query.orderBy(`user.${sortBy}`, sortOrder);

    // Apply pagination
    const [users, total] = await query
        .skip((page - 1) * limit)
        .take(limit)
        .getManyAndCount();

    return {
        users,
        total,
        page,
        totalPages: Math.ceil(total / limit)
    };
}

export async function getUserById(id: string): Promise<User | null> {
    return await User.findOne({
        where: { id },
        select: [
            'id',
            'username',
            'email', 
            'avatarUrl',
            'role',
            'createdAt',
            'updatedAt'
        ]
    });
}

export async function createUser(data: CreateUserData, createdByUserId: string): Promise<User> {
    const user = new User();
    user.username = data.username;
    user.email = data.email;
    user.role = data.role || UserRole.USER;
    user.avatarUrl = data.avatarUrl;

    const savedUser = await user.save();

    // Log the audit event
    await AuditService.logUserCreated(createdByUserId, savedUser.id, {
        username: data.username,
        email: data.email,
        role: savedUser.role
    });

    return savedUser;
}

export async function updateUser(id: string, data: UpdateUserData, updatedByUserId: string): Promise<User> {
    const user = await User.findOne({ where: { id } });
    if (!user) {
        throw new Error('User not found');
    }

    const oldData = {
        username: user.username,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl
    };

    // Update fields
    if (data.username !== undefined) user.username = data.username;
    if (data.email !== undefined) user.email = data.email;
    if (data.avatarUrl !== undefined) user.avatarUrl = data.avatarUrl;
    
    // Handle role change with audit logging
    if (data.role !== undefined && data.role !== user.role) {
        const oldRole = user.role;
        user.role = data.role;
        
        await AuditService.logUserRoleChanged(updatedByUserId, user.id, {
            oldRole,
            newRole: data.role
        });
    }

    const updatedUser = await user.save();

    // Log the general update
    await AuditService.logUserUpdated(updatedByUserId, user.id, {
        oldData,
        newData: {
            username: updatedUser.username,
            email: updatedUser.email,
            role: updatedUser.role,
            avatarUrl: updatedUser.avatarUrl
        }
    });

    return updatedUser;
}

export async function deleteUser(id: string, deletedByUserId: string): Promise<void> {
    const user = await User.findOne({ where: { id } });
    if (!user) {
        throw new Error('User not found');
    }

    // Log before deletion
    await AuditService.logUserDeleted(deletedByUserId, user.id, {
        username: user.username,
        email: user.email,
        role: user.role
    });

    await user.remove();
}

export async function getUserStats(): Promise<{
    totalUsers: number;
    usersByRole: Record<UserRole, number>;
    recentUsers: User[];
}> {
    const totalUsers = await User.count();
    
    const usersByRole = {
        [UserRole.USER]: await User.count({ where: { role: UserRole.USER } }),
        [UserRole.ADMIN]: await User.count({ where: { role: UserRole.ADMIN } }),
        [UserRole.SUPERADMIN]: await User.count({ where: { role: UserRole.SUPERADMIN } })
    };

    const recentUsers = await User.find({
        select: ['id', 'username', 'email', 'role', 'createdAt'],
        order: { createdAt: 'DESC' },
        take: 5
    });

    return {
        totalUsers,
        usersByRole,
        recentUsers
    };
}