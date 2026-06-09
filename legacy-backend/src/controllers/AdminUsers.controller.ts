import { Context } from 'hono';
import { 
    getAllUsers, 
    getUserById, 
    updateUser, 
    deleteUser, 
    createUser, 
    getUserStats,
    UserQueryOptions,
    CreateUserData,
    UpdateUserData 
} from '../services/adminUsers.service';
import { AuditService } from '../services/audit.service';

export class AdminUsersController {
    static async listUsers(c: Context) {
        try {
            const query = c.req.query();
            const options: UserQueryOptions = {
                page: query.page ? parseInt(query.page) : 1,
                limit: query.limit ? Math.min(parseInt(query.limit), 100) : 20,
                search: query.search,
                role: query.role,
                sortBy: query.sortBy as any,
                sortOrder: query.sortOrder as any
            };

            const result = await getAllUsers(options);
            
            // Log admin access
            const user = c.get('user');
            await AuditService.logAdminAccess(user.id, { 
                action: 'list_users',
                filters: options 
            });

            return c.json(result);
        } catch (err) {
            return c.json({ error: err instanceof Error ? err.message : String(err) }, 500);
        }
    }

    static async getUser(c: Context) {
        try {
            const { userId } = c.req.param();
            const user = await getUserById(userId);
            if (!user) return c.json({ error: 'User not found' }, 404);
            return c.json(user);
        } catch (err) {
            return c.json({ error: err instanceof Error ? err.message : String(err) }, 500);
        }
    }

    static async createUser(c: Context) {
        try {
            const body = await c.req.json() as CreateUserData;
            const currentUser = c.get('user');
            
            const newUser = await createUser(body, currentUser.id);
            return c.json(newUser, 201);
        } catch (err) {
            return c.json({ error: err instanceof Error ? err.message : String(err) }, 500);
        }
    }

    static async updateUser(c: Context) {
        try {
            const { userId } = c.req.param();
            const body = await c.req.json() as UpdateUserData;
            const currentUser = c.get('user');
            
            const updated = await updateUser(userId, body, currentUser.id);
            return c.json(updated);
        } catch (err) {
            return c.json({ error: err instanceof Error ? err.message : String(err) }, 500);
        }
    }

    static async deleteUser(c: Context) {
        try {
            const { userId } = c.req.param();
            const currentUser = c.get('user');
            
            // Prevent self-deletion
            if (userId === currentUser.id) {
                return c.json({ error: 'Cannot delete your own account' }, 400);
            }
            
            await deleteUser(userId, currentUser.id);
            return c.json({ success: true });
        } catch (err) {
            return c.json({ error: err instanceof Error ? err.message : String(err) }, 500);
        }
    }

    static async getUserStats(c: Context) {
        try {
            const stats = await getUserStats();
            return c.json(stats);
        } catch (err) {
            return c.json({ error: err instanceof Error ? err.message : String(err) }, 500);
        }
    }
}
