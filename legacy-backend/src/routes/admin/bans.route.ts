import { Hono } from 'hono';
import { AdminBansController } from '../../controllers/AdminBans.controller';
import { ensureAdmin } from '../../middlewares/adminAuth.middleware';

const bansRoute = new Hono();

bansRoute.use('*', ensureAdmin);

// Get all bans (active or all)
bansRoute.get('/', AdminBansController.getAllBans);

// Ban a user
bansRoute.post('/', AdminBansController.banUser);

// Unban a user
bansRoute.delete('/:userId', AdminBansController.unbanUser);

// Get ban history for a specific user
bansRoute.get('/user/:userId/history', AdminBansController.getUserBanHistory);

// Check ban status for a specific user
bansRoute.get('/user/:userId/status', AdminBansController.checkBanStatus);

export default bansRoute;
