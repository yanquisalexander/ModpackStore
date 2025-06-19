import { Context } from 'hono';
import { getAllUsers, getUserById, updateUser, deleteUser } from '../services/adminUsers.service';

export class AdminUsersController {
    static async listUsers(c: Context) {
        try {
            const users = await getAllUsers();
            return c.json(users);
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

    static async updateUser(c: Context) {
        try {
            const { userId } = c.req.param();
            const body = await c.req.json();
            const updated = await updateUser(userId, body);
            return c.json(updated);
        } catch (err) {
            return c.json({ error: err instanceof Error ? err.message : String(err) }, 500);
        }
    }

    static async deleteUser(c: Context) {
        try {
            const { userId } = c.req.param();
            await deleteUser(userId);
            return c.json({ success: true });
        } catch (err) {
            return c.json({ error: err instanceof Error ? err.message : String(err) }, 500);
        }
    }
}
