import { Context } from 'hono';
import { 
    banUser, 
    unbanUser, 
    getUserBanHistory, 
    getAllBans,
    checkUserBanStatus,
    BanUserData 
} from '../services/adminBans.service';

export class AdminBansController {
    static async banUser(c: Context) {
        try {
            const body = await c.req.json() as { userId: string; reason?: string };
            const currentUser = c.get('user');
            
            const banData: BanUserData = {
                userId: body.userId,
                adminId: currentUser.id,
                reason: body.reason
            };

            const ban = await banUser(banData);
            return c.json({ 
                success: true, 
                ban: {
                    id: ban.id,
                    userId: ban.userId,
                    adminId: ban.adminId,
                    reason: ban.reason,
                    banDate: ban.banDate
                }
            }, 201);
        } catch (err) {
            const error = err instanceof Error ? err.message : String(err);
            const status = error.includes('not found') ? 404 : 
                          error.includes('already banned') ? 409 :
                          error.includes('Cannot ban') ? 403 : 500;
            return c.json({ error }, status);
        }
    }

    static async unbanUser(c: Context) {
        try {
            const { userId } = c.req.param();
            const currentUser = c.get('user');
            
            await unbanUser(userId, currentUser.id);
            return c.json({ success: true });
        } catch (err) {
            const error = err instanceof Error ? err.message : String(err);
            const status = error.includes('not banned') ? 404 : 500;
            return c.json({ error }, status);
        }
    }

    static async getUserBanHistory(c: Context) {
        try {
            const { userId } = c.req.param();
            const history = await getUserBanHistory(userId);
            return c.json({ history });
        } catch (err) {
            return c.json({ error: err instanceof Error ? err.message : String(err) }, 500);
        }
    }

    static async getAllBans(c: Context) {
        try {
            const query = c.req.query();
            const includeInactive = query.includeInactive === 'true';
            const bans = await getAllBans(includeInactive);
            return c.json({ bans });
        } catch (err) {
            return c.json({ error: err instanceof Error ? err.message : String(err) }, 500);
        }
    }

    static async checkBanStatus(c: Context) {
        try {
            const { userId } = c.req.param();
            const status = await checkUserBanStatus(userId);
            return c.json(status);
        } catch (err) {
            return c.json({ error: err instanceof Error ? err.message : String(err) }, 500);
        }
    }
}
